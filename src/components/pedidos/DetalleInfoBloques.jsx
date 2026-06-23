import { Badge } from '@/components/ui/Badge'
import { colorAvatar, iniciales } from '@/components/pedidos/PedidoCard'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Los 4 bloques de info del pedido (Asignados, Fecha límite, Tags,
// Instancia·Envío) — mismo contenido para el riel sticky de desktop
// (DetalleInfoRiel) y el acordeón "Detalles del pedido" de mobile, solo
// cambia el wrapper visual alrededor de estos bloques.
export function DetalleInfoBloques({ pedido, instancias }) {
  const inst = pedido.instancia ? instancias.find(i => i.value === pedido.instancia) : null
  return (
    <>
      <div className="det-info-block">
        <p className="det-info-label">Asignados</p>
        {pedido.pedido_asignados?.length === 0 || !pedido.pedido_asignados ? (
          <p className="info-card-empty">Nadie asignado</p>
        ) : (
          <div className="det-info-asignados">
            {pedido.pedido_asignados.map(a => (
              <div key={a.user_id} className="det-info-asignado-row">
                <span
                  className="det-info-avatar"
                  style={{ background: a.profiles?.avatar_color || colorAvatar(a.user_id) }}
                >
                  {iniciales(a.profiles?.full_name)}
                </span>
                <span>{a.profiles?.full_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {pedido.fecha_limite && (
        <div className="det-info-block">
          <p className="det-info-label">Fecha límite</p>
          <p className="det-info-value">
            {format(new Date(pedido.fecha_limite + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}
          </p>
          {(pedido.fecha_programacion || pedido.hora_programacion) && (
            <p className="det-info-sub">
              Programación · {pedido.fecha_programacion && format(new Date(pedido.fecha_programacion + 'T00:00:00'), 'd MMM yyyy', { locale: es })}
              {pedido.hora_programacion && ` · ${pedido.hora_programacion}`}
            </p>
          )}
        </div>
      )}

      {pedido.tags?.length > 0 && (
        <div className="det-info-block">
          <p className="det-info-label">Tags</p>
          <div className="det-info-tags">
            {pedido.tags.map(t => <span key={t} className="tag-item">{t}</span>)}
          </div>
        </div>
      )}

      {(pedido.instancia || pedido.tipo_envio || pedido.cantidad_envios != null) && (
        <div className="det-info-block">
          <p className="det-info-label">Instancia · Envío</p>
          <div className="det-info-instancia-row">
            {inst && <Badge label={inst.label} color={inst.color} size="sm" />}
            {pedido.tipo_envio && (
              <span className="det-info-envio-tipo">
                {pedido.tipo_envio === 'otro' ? pedido.tipo_envio_otro || 'Otro' : pedido.tipo_envio === 'test' ? 'Test' : 'Real'}
              </span>
            )}
            {pedido.cantidad_envios != null && (
              <>
                <span className="det-info-sep">·</span>
                <span className="det-info-envio-cant">{pedido.cantidad_envios} envíos</span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
