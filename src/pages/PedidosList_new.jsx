import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePedidos } from '@/hooks/usePedidos'
import { useAuth } from '@/context/AuthContext'
import { PRIORIDADES, TIPOS, ESTADOS, ROLES } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Plus, Search, Filter, Calendar, User, ExternalLink, Copy, Check } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '22px', height: '22px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', background: copied ? 'rgba(16,185,129,0.1)' : 'var(--bg-hover)',
        color: copied ? '#10B981' : 'var(--text-muted)', flexShrink: 0,
        transition: 'all 150ms ease',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

export default function PedidosList({ onNew }) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [filters, setFilters] = useState({ prioridad: '', tipo: '', search: '' })
  const { pedidos, loading } = usePedidos(filters)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>Pedidos</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}</p>
        </div>
        {role === ROLES.ADMIN && (
          <button onClick={onNew} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'var(--accent-primary)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.875rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap' }}>
            <Plus size={16} />Nuevo pedido
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input placeholder="Buscar por asunto…" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} style={{ paddingLeft: '2.25rem' }} />
        </div>
        <select value={filters.prioridad} onChange={e => setFilters(f => ({ ...f, prioridad: e.target.value }))} style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">Todas las prioridades</option>
          {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))} style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading && <div style={{ padding: '3rem', color: 'var(--text-muted)', textAlign: 'center' }}>Cargando pedidos…</div>}
      {!loading && pedidos.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
          <Filter size={32} /><p>No hay pedidos.</p>
          {role === ROLES.ADMIN && <button onClick={onNew} style={{ background: 'var(--accent-primary)', color: '#fff', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-md)', marginTop: '0.75rem' }}>Crear el primero</button>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {pedidos.map(pedido => {
          const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
          const estados = ESTADOS.filter(e => (pedido.estados ?? []).includes(e.value))
          const ent = pedido.entregable
          return (
            <div key={pedido.id}
              onClick={() => navigate(`/app/pedidos/${pedido.id}`)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/app/pedidos/${pedido.id}`)}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

              {/* Prioridad + tipo + estados */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{TIPOS.find(t => t.value === pedido.tipo)?.label}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {estados.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
                </div>
              </div>

              {/* Asunto */}
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 600 }}>{pedido.asunto}</h3>

              {/* Entregable */}
              {ent?.nombre_pieza && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.5rem 0.75rem', background: 'var(--badge-bg)', border: '1px solid var(--badge-border)', borderRadius: 'var(--radius-sm)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, flexShrink: 0 }}>Pieza:</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ent.nombre_pieza}
                    </span>
                    <CopyBtn text={ent.nombre_pieza} />
                  </div>
                  {ent.link_online && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, flexShrink: 0 }}>Link:</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ent.link_online}
                      </span>
                      <CopyBtn text={ent.link_online} />
                      <a href={ent.link_online} target="_blank" rel="noopener"
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--accent-secondary)', flexShrink: 0 }}>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Descripción */}
              {pedido.descripcion && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {pedido.descripcion}
                </p>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                {pedido.fecha_limite && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Calendar size={13} />{format(new Date(pedido.fecha_limite + 'T00:00:00'), "d MMM yyyy", { locale: es })}
                  </span>
                )}
                {pedido.pedido_asignados?.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <User size={13} />{pedido.pedido_asignados.length} asignado{pedido.pedido_asignados.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
