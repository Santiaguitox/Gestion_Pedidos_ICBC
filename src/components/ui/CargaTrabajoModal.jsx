import { useState, useEffect } from 'react'
import { X, Users as UsersIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { calcularGrupo } from '@/lib/fechas'
import { colorAvatar, iniciales } from '@/components/pedidos/PedidoCard'

// Categorías de urgencia, en el mismo orden que ya usa el Dashboard
// (máxima urgencia primero) — se muestran como FILAS de la tabla.
const GRUPOS_TABLA = [
  { key: 'vencidos',        label: 'Vencidos' },
  { key: 'hoy',              label: 'Hoy' },
  { key: 'mañana',           label: 'Mañana' },
  { key: 'esta_semana',      label: 'Esta semana' },
  { key: 'proxima_semana',   label: 'Próxima semana' },
  { key: 'mas_adelante',     label: 'Más adelante' },
  { key: 'sin_fecha',        label: 'Sin fecha límite' },
]

export function CargaTrabajoModal({ onClose }) {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  // Arranca con el propio usuario seleccionado — el caso más común al
  // abrir esto es "¿cómo estoy yo?", y de ahí se puede ir agregando
  // gente para comparar.
  const [seleccionados, setSeleccionados] = useState(() => new Set(user?.id ? [user.id] : []))

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.rpc('listar_pedidos', { p_modo: 'dashboard' }),
      supabase.from('profiles').select('id, full_name, avatar_color').order('full_name'),
    ]).then(([pedidosRes, usuariosRes]) => {
      setPedidos(pedidosRes.data?.[0]?.pedidos ?? [])
      setUsuarios(usuariosRes.data ?? [])
      setLoading(false)
    })
  }, [])

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

  // Por cada usuario: cuántos pedidos activos tiene asignados,
  // desglosados por grupo de urgencia. Un pedido con varios asignados
  // cuenta una vez para CADA persona asignada (refleja la carga real
  // de cada una, no se "reparte" entre los asignados).
  const datosPorPersona = usuarios.map(u => {
    const pedidosDeEsta = pedidos.filter(p => p.pedido_asignados?.some(a => a.user_id === u.id))
    const fila = { id: u.id, nombre: u.full_name, color: u.avatar_color || colorAvatar(u.id), total: pedidosDeEsta.length }
    for (const g of GRUPOS_TABLA) {
      fila[g.key] = pedidosDeEsta.filter(p => calcularGrupo(p, hoy) === g.key).length
    }
    return fila
  }).sort((a, b) => b.total - a.total)

  const sinAsignar = pedidos.filter(p => !p.pedido_asignados || p.pedido_asignados.length === 0).length

  const personasConCarga = datosPorPersona.filter(d => d.total > 0)
  const promedio = personasConCarga.length > 0
    ? (personasConCarga.reduce((acc, d) => acc + d.total, 0) / personasConCarga.length).toFixed(1)
    : 0

  function toggleSeleccion(id) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const personasSeleccionadas = datosPorPersona.filter(d => seleccionados.has(d.id))

  return (
    <div className="modal-overlay" style={{ zIndex: 9998 }} onClick={onClose}>
      <div className="modal carga-trabajo-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-[0.625rem]">
            <div className="confirm-icon-wrap" style={{ background: 'rgba(91,78,232,0.08)', border: '1px solid rgba(91,78,232,0.2)' }}>
              <UsersIcon size={16} color="var(--icomm-violet)" />
            </div>
            <h2 className="modal-title">Carga de trabajo del equipo</h2>
          </div>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        <div className="confirm-body carga-trabajo-body">
          {loading ? (
            <p className="text-muted-sm">Cargando…</p>
          ) : (
            <>
              <div className="carga-trabajo-stats-row">
                <div className="carga-trabajo-stat">
                  <span className="carga-trabajo-stat-valor">{pedidos.length}</span>
                  <span className="carga-trabajo-stat-label">Pedidos activos totales</span>
                </div>
                <div className="carga-trabajo-stat">
                  <span className="carga-trabajo-stat-valor" style={{ color: sinAsignar > 0 ? 'var(--icbc-red)' : undefined }}>
                    {sinAsignar}
                  </span>
                  <span className="carga-trabajo-stat-label">Sin asignar</span>
                </div>
                <div className="carga-trabajo-stat">
                  <span className="carga-trabajo-stat-valor">{promedio}</span>
                  <span className="carga-trabajo-stat-label">Promedio por usuario</span>
                </div>
              </div>

              {datosPorPersona.length === 0 ? (
                <p className="text-muted-sm">No hay usuarios para mostrar.</p>
              ) : (
                <>
                  <div className="carga-trabajo-chips">
                    {datosPorPersona.map(p => {
                      const activo = seleccionados.has(p.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleSeleccion(p.id)}
                          className={`carga-trabajo-chip ${activo ? 'carga-trabajo-chip-activo' : ''}`}
                          style={activo
                            ? { background: p.color, borderColor: p.color }
                            : { borderColor: p.color, color: p.color }
                          }
                        >
                          <span className="carga-trabajo-chip-avatar" style={{ background: activo ? 'rgba(255,255,255,0.25)' : p.color }}>
                            {iniciales(p.nombre)}
                          </span>
                          {p.nombre}
                          <span className="carga-trabajo-chip-total">{p.total}</span>
                        </button>
                      )
                    })}
                  </div>

                  {personasSeleccionadas.length === 0 ? (
                    <p className="text-muted-sm">Elegí uno o más usuarios arriba para ver su detalle.</p>
                  ) : (
                    <div className="carga-trabajo-tabla-wrapper">
                      <table className="carga-trabajo-tabla">
                        <thead>
                          <tr>
                            <th></th>
                            {personasSeleccionadas.map(p => (
                              <th key={p.id} style={{ color: p.color }}>
                                {/* Solo el avatar, sin el nombre completo — el
                                    nombre ya se ve en los chips de selección
                                    de arriba; repetirlo acá ocupa espacio de
                                    más, sobre todo con 3+ personas
                                    seleccionadas, que es justo lo que esta
                                    tabla necesita acomodar bien. */}
                                <span className="carga-trabajo-chip-avatar" style={{ background: p.color }} title={p.nombre}>
                                  {iniciales(p.nombre)}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {GRUPOS_TABLA.map(g => (
                            <tr key={g.key}>
                              <td className="carga-trabajo-tabla-label">{g.label}</td>
                              {personasSeleccionadas.map(p => (
                                <td key={p.id} style={{ color: p.color }}>{p[g.key]}</td>
                              ))}
                            </tr>
                          ))}
                          <tr className="carga-trabajo-tabla-total">
                            <td className="carga-trabajo-tabla-label">Total</td>
                            {personasSeleccionadas.map(p => (
                              <td key={p.id} style={{ color: p.color }}>{p.total}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
