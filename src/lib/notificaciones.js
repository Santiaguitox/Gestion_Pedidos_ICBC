// Lógica pura de agrupamiento de notificaciones — sin React ni Supabase,
// para poder testearla con vitest (ver __tests__/notificaciones.test.js).
//
// Diseño: cada notificación es un evento individual e inmutable en la
// base; el agrupamiento es 100% presentación. Acá vive esa capa: colapsar
// las NO LEÍDAS que comparten grupo_key en una sola entrada visual, y
// contar "pendientes reales" (grupos, no filas) para el badge.

// Tipos persistidos en la columna `tipo` de la tabla notificaciones
// (ver migración 20260708000000_notificaciones_agrupadas.sql).
export const TIPO_NOTIFICACION = {
  CAMBIO_ESTADO: 'cambio_estado',
  ASIGNACION:    'asignacion',
  APROBACION:    'aprobacion',
  VENCIMIENTO:   'vencimiento',
  SISTEMA:       'sistema',
  DESCARGA:      'descarga',
  MENCION:       'mencion',
  COMENTARIO:    'comentario',
}

// Tipos cuyos eventos no leídos se colapsan por grupo_key. 'sistema'
// queda afuera: son mensajes heterogéneos (pruebas, avisos sueltos) y
// agruparlos mezclaría cosas sin relación entre sí.
// 'comentario' y 'mencion' SÍ agrupan (cada uno por su lado, porque el
// grupo_key incluye el tipo): una ráfaga de comentarios en un pedido es
// UNA entrada en la campanita, y las menciones nunca se diluyen entre
// los comentarios genéricos — "me nombraron" pesa más que "hay
// movimiento", tanto in-app como en el push (tag = grupo_key).
const TIPOS_AGRUPABLES = new Set([
  TIPO_NOTIFICACION.CAMBIO_ESTADO,
  TIPO_NOTIFICACION.ASIGNACION,
  TIPO_NOTIFICACION.APROBACION,
  TIPO_NOTIFICACION.VENCIMIENTO,
  TIPO_NOTIFICACION.DESCARGA,
  TIPO_NOTIFICACION.MENCION,
  TIPO_NOTIFICACION.COMENTARIO,
])

// Clave de agrupamiento — espejo exacto de la columna generada
// `grupo_key`. El fallback local cubre filas que todavía no tienen las
// columnas nuevas (caché previa a la migración) u objetos parciales.
export function grupoKeyDe(n) {
  if (n.grupo_key) return n.grupo_key
  return (n.tipo ?? TIPO_NOTIFICACION.SISTEMA) + ':' + (n.pedido_id ?? 'global')
}

// Colapsa las notificaciones NO LEÍDAS que comparten grupo_key en una
// sola entrada; las leídas (y las 'sistema') se mantienen individuales.
// Espera la lista ordenada por created_at descendente y preserva ese
// orden: cada entrada queda en la posición de su evento más reciente.
//
// Devuelve entradas con la forma:
//   {
//     id,        // id del evento más reciente (estable para keys de React)
//     grupoKey,
//     tipo,
//     pedido_id,
//     leida,
//     principal, // el evento más reciente — es el que se muestra colapsado
//     items,     // todos los eventos de la entrada, en orden descendente
//     count,     // items.length
//   }
export function agruparNotificaciones(notificaciones) {
  const esAgrupable = n => !n.leida && TIPOS_AGRUPABLES.has(n.tipo)

  // Primera pasada: juntar las agrupables por clave (en orden desc,
  // así items[0] es siempre el evento más reciente del grupo).
  const porGrupo = new Map()
  for (const n of notificaciones) {
    if (!esAgrupable(n)) continue
    const key = grupoKeyDe(n)
    if (!porGrupo.has(key)) porGrupo.set(key, [])
    porGrupo.get(key).push(n)
  }

  // Segunda pasada: armar las entradas preservando el orden general.
  const emitidos = new Set()
  const entradas = []
  for (const n of notificaciones) {
    if (!esAgrupable(n)) {
      entradas.push({
        id: n.id,
        grupoKey: grupoKeyDe(n),
        tipo: n.tipo ?? TIPO_NOTIFICACION.SISTEMA,
        pedido_id: n.pedido_id ?? null,
        leida: !!n.leida,
        principal: n,
        items: [n],
        count: 1,
      })
      continue
    }
    const key = grupoKeyDe(n)
    if (emitidos.has(key)) continue
    emitidos.add(key)
    const items = porGrupo.get(key)
    entradas.push({
      id: items[0].id,
      grupoKey: key,
      tipo: items[0].tipo,
      pedido_id: items[0].pedido_id ?? null,
      leida: false,
      principal: items[0],
      items,
      count: items.length,
    })
  }
  return entradas
}

// Ruta destino al tocar una notificación (o el evento principal de una
// entrada agrupada). Para menciones y comentarios, si el data trae el
// comentario_id se arma el deep-link ?comentario=<id>: PedidoDetalle lo
// lee, abre el acordeón, scrollea al comentario y lo resalta — el que
// recibe "te mencionó" aterriza SOBRE la mención, no arriba de todo.
// En una entrada agrupada el principal es el evento más reciente, así
// que el deep-link apunta al último comentario de la ráfaga. La misma
// lógica vive server-side en enviar-push (URL de la push del SO).
export function rutaDeNotificacion(n) {
  if (!n?.pedido_id) return '/notificaciones'
  const esDeComentario =
    n.tipo === TIPO_NOTIFICACION.MENCION || n.tipo === TIPO_NOTIFICACION.COMENTARIO
  const comentarioId = esDeComentario ? n.data?.comentario_id : null
  return comentarioId
    ? `/pedidos/${n.pedido_id}?comentario=${comentarioId}`
    : `/pedidos/${n.pedido_id}`
}

// Cantidad de "pendientes reales" para el badge de la campanita:
// grupos no leídos — una ráfaga de cambios del mismo pedido cuenta
// como 1 pendiente, que es lo que el usuario percibe.
export function contarNoLeidas(notificaciones) {
  let count = 0
  for (const entrada of agruparNotificaciones(notificaciones)) {
    if (!entrada.leida) count++
  }
  return count
}

// ── Presentación del mensaje "cambió de estado" ──────────────────────
// El trigger de la base arma el mensaje con los VALUES crudos de los
// estados ('"Asunto" cambió de estado: entregable_aprobado, en_qa') —
// inmutable una vez escrito, como todo evento. La traducción a algo
// legible (label + color de la tabla estados) es 100% presentación y
// vive acá, en el front: así también las notificaciones VIEJAS ya
// guardadas se muestran lindas, sin migrar ni reescribir nada.

// Parte un mensaje de cambio de estado en { antes, valores }:
//   antes:   todo hasta el marcador inclusive ('"Asunto" cambió de estado: ')
//   valores: los values crudos ('entregable_aprobado', ...)
// Devuelve null si el mensaje no es de cambio de estado — el caller
// renderiza el texto plano como siempre. Usa lastIndexOf a propósito:
// si un asunto contuviera literalmente la frase del marcador, el
// marcador real (el que agrega el trigger) es siempre el último.
export function partirMensajeCambioEstado(mensaje) {
  if (typeof mensaje !== 'string') return null
  const marca = 'cambió de estado: '
  const idx = mensaje.lastIndexOf(marca)
  if (idx === -1) return null
  const resto = mensaje.slice(idx + marca.length).trim()
  if (!resto) return null
  return {
    antes: mensaje.slice(0, idx + marca.length),
    // El trigger une con ', ' (array_to_string) y los values no
    // contienen comas — split simple alcanza.
    valores: resto.split(',').map(v => v.trim()).filter(Boolean),
  }
}

// Fallback de label cuando el value no está en la tabla estados (el
// estado se eliminó/renombró después de emitida la notificación, o la
// caché todavía no cargó): guiones bajos a espacios + primera en
// mayúscula. 'entregable_aprobado' → 'Entregable aprobado'.
export function labelDesdeValue(value) {
  const plano = String(value ?? '').replace(/_/g, ' ').trim()
  return plano ? plano[0].toUpperCase() + plano.slice(1) : String(value ?? '')
}
