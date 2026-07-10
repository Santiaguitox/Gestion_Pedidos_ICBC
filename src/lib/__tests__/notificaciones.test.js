import { describe, it, expect } from 'vitest'
import {
  agruparNotificaciones,
  contarNoLeidas,
  grupoKeyDe,
  TIPO_NOTIFICACION,
} from '@/lib/notificaciones.js'

// Helper: notificación de prueba con timestamps decrecientes según el
// orden del array (la lib espera orden descendente por created_at,
// igual que la query del contexto).
let seq = 0
function notif(overrides = {}) {
  seq++
  return {
    id: `id-${seq}`,
    user_id: 'user-1',
    pedido_id: 'pedido-A',
    mensaje: 'mensaje de prueba',
    tipo: TIPO_NOTIFICACION.CAMBIO_ESTADO,
    leida: false,
    created_at: new Date(Date.now() - seq * 60_000).toISOString(),
    ...overrides,
  }
}

describe('grupoKeyDe', () => {
  it('usa grupo_key de la base cuando existe', () => {
    expect(grupoKeyDe({ grupo_key: 'cambio_estado:X', tipo: 'otro', pedido_id: 'Y' }))
      .toBe('cambio_estado:X')
  })

  it('deriva la clave localmente cuando falta (filas pre-migración)', () => {
    expect(grupoKeyDe({ tipo: 'asignacion', pedido_id: 'P1' })).toBe('asignacion:P1')
  })

  it('sin tipo ni pedido cae a sistema:global (espejo de la columna generada)', () => {
    expect(grupoKeyDe({})).toBe('sistema:global')
  })
})

describe('agruparNotificaciones', () => {
  it('colapsa no leídas del mismo tipo y pedido en una entrada', () => {
    const lista = [
      notif({ mensaje: 'cambió de estado: esperando_respuesta' }),
      notif({ mensaje: 'cambió de estado: en_desarrollo, esperando_respuesta' }),
    ]
    const entradas = agruparNotificaciones(lista)
    expect(entradas).toHaveLength(1)
    expect(entradas[0].count).toBe(2)
    // El principal es el evento más reciente (primero en orden desc):
    // el usuario ve el estado FINAL, no el intermedio.
    expect(entradas[0].principal.mensaje).toBe('cambió de estado: esperando_respuesta')
    expect(entradas[0].items).toHaveLength(2)
  })

  it('no mezcla tipos distintos del mismo pedido', () => {
    const lista = [
      notif({ tipo: TIPO_NOTIFICACION.CAMBIO_ESTADO }),
      notif({ tipo: TIPO_NOTIFICACION.ASIGNACION }),
    ]
    expect(agruparNotificaciones(lista)).toHaveLength(2)
  })

  it('no mezcla pedidos distintos del mismo tipo', () => {
    const lista = [
      notif({ pedido_id: 'pedido-A' }),
      notif({ pedido_id: 'pedido-B' }),
    ]
    expect(agruparNotificaciones(lista)).toHaveLength(2)
  })

  it('las leídas nunca se agrupan: quedan como historial individual', () => {
    const lista = [
      notif({ leida: true }),
      notif({ leida: true }),
      notif({ leida: true }),
    ]
    const entradas = agruparNotificaciones(lista)
    expect(entradas).toHaveLength(3)
    entradas.forEach(e => expect(e.count).toBe(1))
  })

  it('las sistema no se agrupan entre sí aunque compartan grupo_key', () => {
    const lista = [
      notif({ tipo: TIPO_NOTIFICACION.SISTEMA, pedido_id: null }),
      notif({ tipo: TIPO_NOTIFICACION.SISTEMA, pedido_id: null }),
    ]
    const entradas = agruparNotificaciones(lista)
    expect(entradas).toHaveLength(2)
  })

  it('preserva el orden descendente: la entrada queda donde su evento más reciente', () => {
    const lista = [
      notif({ pedido_id: 'pedido-A' }),                 // más reciente
      notif({ pedido_id: 'pedido-B' }),
      notif({ pedido_id: 'pedido-A' }),                 // más viejo, agrupa con el 1ro
    ]
    const entradas = agruparNotificaciones(lista)
    expect(entradas).toHaveLength(2)
    expect(entradas[0].pedido_id).toBe('pedido-A')
    expect(entradas[0].count).toBe(2)
    expect(entradas[1].pedido_id).toBe('pedido-B')
  })

  it('mezcla de leídas y no leídas del mismo grupo: solo las no leídas colapsan', () => {
    const lista = [
      notif({ leida: false }),
      notif({ leida: false }),
      notif({ leida: true }),
    ]
    const entradas = agruparNotificaciones(lista)
    expect(entradas).toHaveLength(2)
    expect(entradas[0].leida).toBe(false)
    expect(entradas[0].count).toBe(2)
    expect(entradas[1].leida).toBe(true)
    expect(entradas[1].count).toBe(1)
  })

  it('filas pre-migración (sin tipo) no explotan: caen a sistema individual', () => {
    const lista = [
      { id: 'x1', mensaje: 'vieja', leida: false, created_at: new Date().toISOString() },
      { id: 'x2', mensaje: 'vieja 2', leida: false, created_at: new Date().toISOString() },
    ]
    const entradas = agruparNotificaciones(lista)
    expect(entradas).toHaveLength(2)
    entradas.forEach(e => expect(e.tipo).toBe(TIPO_NOTIFICACION.SISTEMA))
  })
})

describe('contarNoLeidas', () => {
  it('cuenta grupos, no filas: la ráfaga A->B del bug original es 1 pendiente', () => {
    const lista = [
      notif({ mensaje: 'cambió de estado: esperando_respuesta' }),
      notif({ mensaje: 'cambió de estado: en_desarrollo, esperando_respuesta' }),
      notif({ pedido_id: 'pedido-B' }),
      notif({ leida: true }),
    ]
    expect(contarNoLeidas(lista)).toBe(2)
  })

  it('lista vacía devuelve 0', () => {
    expect(contarNoLeidas([])).toBe(0)
  })
})

describe('comentarios y menciones (tipos nuevos)', () => {
  it('una ráfaga de comentarios del mismo pedido agrupa en 1 entrada', () => {
    const lista = [
      notif({ tipo: TIPO_NOTIFICACION.COMENTARIO, mensaje: 'Ana comentó: dale' }),
      notif({ tipo: TIPO_NOTIFICACION.COMENTARIO, mensaje: 'Ana comentó: mirá esto' }),
      notif({ tipo: TIPO_NOTIFICACION.COMENTARIO, mensaje: 'Beto comentó: ok' }),
    ]
    const entradas = agruparNotificaciones(lista)
    expect(entradas).toHaveLength(1)
    expect(entradas[0].count).toBe(3)
    expect(entradas[0].grupoKey).toBe('comentario:pedido-A')
  })

  it('mencion y comentario del mismo pedido NO se mezclan entre sí', () => {
    const lista = [
      notif({ tipo: TIPO_NOTIFICACION.MENCION, mensaje: 'Ana te mencionó' }),
      notif({ tipo: TIPO_NOTIFICACION.COMENTARIO, mensaje: 'Ana comentó' }),
    ]
    const entradas = agruparNotificaciones(lista)
    expect(entradas).toHaveLength(2)
    expect(entradas.map(e => e.tipo).sort()).toEqual(['comentario', 'mencion'])
  })

  it('el badge cuenta la ráfaga de comentarios como 1 pendiente', () => {
    const lista = [
      notif({ tipo: TIPO_NOTIFICACION.COMENTARIO }),
      notif({ tipo: TIPO_NOTIFICACION.COMENTARIO }),
      notif({ tipo: TIPO_NOTIFICACION.MENCION }),
    ]
    expect(contarNoLeidas(lista)).toBe(2)
  })
})
