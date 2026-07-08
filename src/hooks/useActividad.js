import { supabase } from '@/lib/supabase'
import { TIPO_ACTIVIDAD } from '@/lib/constants'

export async function registrarActividad(pedidoId, userId, tipo, detalle = {}) {
  await supabase.from('actividad').insert({ pedido_id: pedidoId, user_id: userId, tipo, detalle })
}

export function labelActividad(item) {
  const nombre = item.profiles?.full_name ?? 'Alguien'
  switch (item.tipo) {
    case TIPO_ACTIVIDAD.CREACION:
      return `${nombre} creó el pedido`
    case TIPO_ACTIVIDAD.CAMBIO_ESTADO: {
      const { nuevos = [] } = item.detalle ?? {}
      return nuevos.length === 0 ? `${nombre} quitó todos los estados` : `${nombre} actualizó el estado`
    }
    case TIPO_ACTIVIDAD.CAMBIO_PRIORIDAD: {
      const { anterior, nuevo } = item.detalle ?? {}
      return `${nombre} cambió la prioridad de ${anterior} a ${nuevo}`
    }
    case TIPO_ACTIVIDAD.ASIGNACION: {
      const { agregados = [], removidos = [] } = item.detalle ?? {}
      const partes = []
      if (agregados.length) partes.push(`asignó a ${agregados.join(', ')}`)
      if (removidos.length) partes.push(`desasignó a ${removidos.join(', ')}`)
      return `${nombre} ${partes.join(' y ')}`
    }
    case TIPO_ACTIVIDAD.ELIMINACION:   return `${nombre} eliminó el pedido`
    case TIPO_ACTIVIDAD.RESTAURACION:  return `${nombre} restauró el pedido`
    case TIPO_ACTIVIDAD.EDICION:       return `${nombre} editó el pedido`
    // Este tipo lo inserta notificar_descarga_pieza() directo en la
    // base (ver 20260708130000/20260708140000) — no pasa por
    // registrarActividad() de este archivo, pero labelActividad sigue
    // siendo el lugar único donde se decide cómo mostrar cada tipo.
    case TIPO_ACTIVIDAD.DESCARGA_PIEZA: {
      const { tipo_descarga, piezas = [] } = item.detalle ?? {}
      if (tipo_descarga === 'zip') {
        return `${nombre} descargó el ZIP con ${piezas.length} pieza${piezas.length === 1 ? '' : 's'} (${piezas.join(', ')})`
      }
      return `${nombre} descargó el HTML de "${piezas[0] ?? 'una pieza'}"`
    }
    default:                           return `${nombre} realizó una acción`
  }
}