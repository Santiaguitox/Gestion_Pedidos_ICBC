import { Fragment } from 'react'
import { Badge } from '@/components/ui/Badge'
import { useEstados } from '@/hooks/useEstados'
import { partirMensajeCambioEstado, labelDesdeValue } from '@/lib/notificaciones'

// Color del fallback cuando el value no existe (más) en la tabla
// estados — el mismo default que tiene la columna color en la base.
const COLOR_FALLBACK = '#6B7280'

// Renderiza el mensaje de una notificación. Si es un cambio de estado
// ('"Asunto" cambió de estado: entregable_aprobado, ...'), la parte de
// estados se muestra como badges con el label y color reales de la
// tabla estados (los mismos que usa el form de pedidos / PedidoCard) en
// vez del value crudo con guiones bajos. Cualquier otro mensaje se
// devuelve tal cual, texto plano — este componente es un passthrough
// seguro para TODOS los tipos de notificación.
//
// Se usa en los tres lugares donde se muestra el mensaje: la entrada
// principal y los subitems agrupados de /notificaciones, y el toast de
// notificación nueva (AppLayout). Va DENTRO del <p>/<span> existente de
// cada lugar — devuelve contenido inline, no un bloque propio.
//
// Los estados salen del mismo cache compartido de useEstados que ya usa
// media app (un solo fetch global); mientras carga, o si un value fue
// eliminado de la tabla después de emitida la notificación, cae al
// fallback legible de labelDesdeValue ('entregable_aprobado' →
// 'Entregable aprobado') con el color gris default — nunca vuelve a
// mostrarse el value crudo.
export function MensajeNotificacion({ mensaje }) {
  const { estados } = useEstados()
  const partes = partirMensajeCambioEstado(mensaje)
  if (!partes) return mensaje ?? null

  return (
    <>
      {partes.antes}
      {partes.valores.map((value, i) => {
        const estado = estados?.find(e => e.value === value)
        return (
          <Fragment key={value}>
            {i > 0 && ' '}
            <Badge
              label={estado?.label ?? labelDesdeValue(value)}
              color={estado?.color ?? COLOR_FALLBACK}
              size="sm"
            />
          </Fragment>
        )
      })}
    </>
  )
}
