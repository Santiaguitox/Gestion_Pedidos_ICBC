import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePedidos } from '@/hooks/usePedidos'
import { useAuth } from '@/context/AuthContext'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { Badge } from '@/components/ui/Badge'
import { DatePicker } from '@/components/ui/DatePicker'
import { Plus, Search, Filter, Calendar, User, ExternalLink, Copy, Check, AlignJustify, LayoutList, ChevronDown, ChevronUp, X, Tag } from 'lucide-react'
import { TagSearch } from '@/components/ui/TagSearch'
import { useTipos } from '@/hooks/useTipos'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      title="Copiar"
      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'22px', height:'22px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background: copied ? 'rgba(16,185,129,0.1)' : 'var(--bg-hover)', color: copied ? '#10B981' : 'var(--text-muted)', flexShrink:0, transition:'all 150ms ease' }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

function CopyAllBtnInline({ entregables }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e) {
    e.stopPropagation()
    const texto = entregables
      .filter(e => e.nombre_pieza)
      .map(e => e.link_online ? `${e.nombre_pieza} || ${e.link_online}` : e.nombre_pieza)
      .join('\n')
    navigator.clipboard.writeText(texto)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy}
      style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.75rem', fontWeight:600, color: copied ? '#10B981' : 'var(--icomm-violet)', padding:'0.25rem 0.625rem', border:`1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(91,78,232,0.3)'}`, borderRadius:'var(--radius-sm)', background: copied ? 'rgba(16,185,129,0.06)' : 'rgba(91,78,232,0.08)', transition:'all 150ms', alignSelf:'flex-start' }}>
      {copied ? <><Check size={11} />¡Copiado!</> : <><Copy size={11} />Copiar todo</>}
    </button>
  )
}

function EntregablesInline({ entregables }) {
  const [expandido, setExpandido] = useState(false)
  if (!entregables?.length) return null

  const conNombre = entregables.filter(e => e.nombre_pieza)
  if (!conNombre.length) return null

  const visibles = expandido ? conNombre : conNombre.slice(0, 2)
  const hayMas = conNombre.length > 2

  return (
    <div onClick={e => e.stopPropagation()}
      style={{ border:'1px solid var(--badge-border)', borderRadius:'var(--radius-md)', overflow:'hidden', background:'var(--badge-bg)' }}>
      <div
        onClick={hayMas ? () => setExpandido(v => !v) : undefined}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.5rem 0.75rem', borderBottom:'1px solid var(--badge-border)', cursor: hayMas ? 'pointer' : 'default' }}>
        <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:'0.375rem' }}>
          Piezas
          <span style={{ fontSize:'0.6875rem', fontWeight:600, background:'var(--bg-hover)', border:'1px solid var(--border)', color:'var(--text-muted)', padding:'0.05rem 0.4rem', borderRadius:'99px' }}>
            {conNombre.length}
          </span>
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          {conNombre.length > 1 && <CopyAllBtnInline entregables={conNombre} />}
          {hayMas && (
            <span style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.75rem', color:'var(--text-muted)' }}>
              {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expandido ? 'Ver menos' : `Ver ${conNombre.length - 2} más`}
            </span>
          )}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {visibles.map((ent, i) => (
          <div key={ent.id}
            style={{ padding:'0.5rem 0.75rem', borderBottom: i < visibles.length - 1 ? '1px solid var(--badge-border)' : 'none', display:'flex', flexDirection:'column', gap:'0.25rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              {ent.aprobado && <span style={{ fontSize:'0.6rem', fontWeight:700, background:'rgba(16,185,129,0.12)', color:'#10B981', border:'1px solid rgba(16,185,129,0.3)', padding:'0.05rem 0.375rem', borderRadius:'99px', flexShrink:0 }}>✓</span>}
              <span style={{ fontSize:'0.75rem', color:'var(--text-primary)', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ent.nombre_pieza}</span>
              <CopyBtn text={ent.nombre_pieza} />
            </div>
            {ent.link_online && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <span style={{ fontSize:'0.75rem', color:'var(--accent-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ent.link_online}</span>
                <CopyBtn text={ent.link_online} />
                <a href={ent.link_online} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'22px', height:'22px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'var(--bg-hover)', color:'var(--accent-secondary)', flexShrink:0 }}>
                  <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PedidosList({ onNew }) {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [filters, setFilters] = useState({ prioridad:'', tipo:'' })
  const [search, setSearch] = useState('')
  const { estados } = useEstados()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTag, setFiltroTag] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [vista, setVista] = useState('full')
  const [filtrosOpen, setFiltrosOpen] = useState(true)
  const { pedidos, loading } = usePedidos(filters)
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false)
  const { tipos } = useTipos()

  // Todos los tags disponibles en los pedidos
  const tagsDisponibles = [...new Set(pedidos.flatMap(p => p.tags ?? []))].sort()

  let listaBase = [...pedidos]
  if (filtroEstado === 'sin_estado') listaBase = listaBase.filter(p => !p.estados?.length)
  else if (filtroEstado) listaBase = listaBase.filter(p => p.estados?.includes(filtroEstado))
  if (filtroTag) listaBase = listaBase.filter(p => p.tags?.includes(filtroTag))
  if (fechaDesde) listaBase = listaBase.filter(p => p.created_at.slice(0,10) >= fechaDesde)
  if (fechaHasta) listaBase = listaBase.filter(p => p.created_at.slice(0,10) <= fechaHasta)
    if (search.trim()) {
  const q = search.toLowerCase()
  listaBase = listaBase.filter(p =>
    p.asunto?.toLowerCase().includes(q) ||
    (Array.isArray(p.entregable) ? p.entregable : p.entregable ? [p.entregable] : [])
      .some(e => e.nombre_pieza?.toLowerCase().includes(q) || e.link_online?.toLowerCase().includes(q))
  )
}

  const mostrarTodoPorFiltro = filtroEstado === 'finalizado'
  const listaActivos = mostrarTodoPorFiltro ? listaBase : listaBase.filter(p => !p.estados?.includes('finalizado'))
  const listaFinalizados = mostrarTodoPorFiltro ? [] : listaBase.filter(p => p.estados?.includes('finalizado'))
  const lista = mostrarTodoPorFiltro ? listaBase : [...listaActivos, ...(mostrarFinalizados ? listaFinalizados : [])]

  const hayFiltrosActivos = search || filters.prioridad || filters.tipo || filtroEstado || filtroTag || fechaDesde || fechaHasta
  const selectStyle = { width:'auto', minWidth:'150px', fontSize:'0.8125rem' }

  function limpiarFiltros() {
    setFilters({ prioridad:'', tipo:'' })
    setSearch('')
    setFiltroEstado('')
    setFiltroTag('')
    setFechaDesde('')
    setFechaHasta('')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Pedidos</h1>
          <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:'0.125rem' }}>{lista.length} pedido{lista.length !== 1 ? 's' : ''}</p>
        </div>
        {role !== ROLES.VIEWER && (
          <button onClick={onNew} style={{ display:'flex', alignItems:'center', gap:'0.375rem', background:'var(--accent-primary)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.875rem', padding:'0.5rem 1rem', borderRadius:'var(--radius-md)', whiteSpace:'nowrap' }}>
            <Plus size={16} />Nuevo pedido
          </button>
        )}
      </div>

      {/* Panel de filtros colapsable */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)' }}>
        <div onClick={() => setFiltrosOpen(v => !v)}
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 1rem', cursor:'pointer', userSelect:'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
            <Filter size={15} color="var(--text-muted)" />
            <span style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-secondary)' }}>Filtros</span>
            {hayFiltrosActivos && (
              <span style={{ fontSize:'0.6875rem', fontWeight:600, background:'var(--accent-primary)', color:'#fff', padding:'0.1rem 0.5rem', borderRadius:'99px' }}>activos</span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div onClick={e => e.stopPropagation()} style={{ display:'flex', gap:'0.25rem' }}>
              <button onClick={() => setVista('compact')} title="Vista compacta"
                style={{ display:'flex', alignItems:'center', padding:'0.3rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background: vista === 'compact' ? 'var(--accent-primary)' : 'transparent', color: vista === 'compact' ? '#fff' : 'var(--text-muted)', transition:'all 150ms' }}>
                <AlignJustify size={13} />
              </button>
              <button onClick={() => setVista('full')} title="Vista completa"
                style={{ display:'flex', alignItems:'center', padding:'0.3rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background: vista === 'full' ? 'var(--accent-primary)' : 'transparent', color: vista === 'full' ? '#fff' : 'var(--text-muted)', transition:'all 150ms' }}>
                <LayoutList size={13} />
              </button>
            </div>
            {filtrosOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </div>
        </div>

        {filtrosOpen && (
          <div style={{ padding:'0.75rem 1rem 1rem', display:'flex', flexDirection:'column', gap:'0.75rem', borderTop:'1px solid var(--border)' }}>
            {/* Búsqueda */}
            <div style={{ position:'relative' }}>
              <Search size={15} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
              <input placeholder="Buscar por asunto, pieza o link…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:'2.25rem' }} />
            </div>
            {/* Selects */}
            <div style={{ display:'flex', gap:'0.625rem', flexWrap:'wrap' }}>
              <select value={filters.prioridad} onChange={e => setFilters(f => ({ ...f, prioridad:e.target.value }))} style={selectStyle}>
                <option value="">Todas las prioridades</option>
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo:e.target.value }))} style={selectStyle}>
                <option value="">Todos los tipos</option>
                {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={selectStyle}>
                <option value="">Todos los estados</option>
                <option value="sin_estado">Sin estado</option>
                {estados.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              {tagsDisponibles.length > 0 && (
                <TagSearch tags={tagsDisponibles} value={filtroTag} onChange={setFiltroTag} />
              )}
            </div>
            {/* Tag activo como chip */}
            {filtroTag && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.375rem' }}>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Tag:</span>
                <span style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.75rem', fontWeight:600, background:'rgba(91,78,232,0.1)', color:'var(--icomm-violet)', border:'1px solid rgba(91,78,232,0.25)', padding:'0.15rem 0.5rem', borderRadius:'99px' }}>
                  <Tag size={10} />{filtroTag}
                  <button onClick={() => setFiltroTag('')} style={{ display:'flex', alignItems:'center', color:'var(--icomm-violet)', marginLeft:'0.125rem' }}><X size={10} /></button>
                </span>
              </div>
            )}
            {/* Fechas + limpiar */}
            <div style={{ display:'flex', gap:'0.625rem', flexWrap:'wrap', alignItems:'flex-end' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:500 }}>Desde</span>
                <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Fecha desde" />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.2rem' }}>
                <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:500 }}>Hasta</span>
                <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Fecha hasta" />
              </div>
              {hayFiltrosActivos && (
                <button onClick={limpiarFiltros}
                  style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', fontWeight:600, color:'var(--icbc-red)', padding:'0.5rem 0.875rem', border:'1px solid rgba(208,17,27,0.3)', borderRadius:'var(--radius-sm)', background:'rgba(208,17,27,0.06)', transition:'all 150ms' }}>
                  <X size={13} />Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && <div style={{ padding:'3rem', color:'var(--text-muted)', textAlign:'center' }}>Cargando pedidos…</div>}
      {!loading && lista.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', padding:'3rem', color:'var(--text-muted)', fontSize:'0.875rem', textAlign:'center' }}>
          <Filter size={32} /><p>No hay pedidos.</p>
          {role !== ROLES.VIEWER && <button onClick={onNew} style={{ background:'var(--accent-primary)', color:'#fff', fontSize:'0.875rem', fontWeight:600, padding:'0.5rem 1.25rem', borderRadius:'var(--radius-md)', marginTop:'0.75rem' }}>Crear el primero</button>}
        </div>
      )}

      {!mostrarTodoPorFiltro && listaFinalizados.length > 0 && (
        <button onClick={() => setMostrarFinalizados(v => !v)}
          style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8125rem', fontWeight:500, color:'var(--text-muted)', padding:'0.625rem 1rem', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', alignSelf:'flex-start', transition:'all 150ms', background:'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
          {mostrarFinalizados ? '▲ Ocultar finalizados' : `▼ Mostrar finalizados (${listaFinalizados.length})`}
        </button>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap: vista === 'compact' ? '0.375rem' : '0.625rem' }}>
        {lista.map(pedido => {
          const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
          const estadosBadge = estados.filter(e => (pedido.estados ?? []).includes(e.value))
          const entregables = Array.isArray(pedido.entregable)
            ? pedido.entregable
            : pedido.entregable ? [pedido.entregable] : []

          if (vista === 'compact') {
            return (
              <div key={pedido.id} onClick={() => navigate(`/app/pedidos/${pedido.id}`)} role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(`/app/pedidos/${pedido.id}`)}
                style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0.6rem 1rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
                <span style={{ fontFamily:'var(--font-display)', fontSize:'0.875rem', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pedido.asunto}</span>
                <div style={{ display:'flex', gap:'0.3rem', flexShrink:0 }}>
                  {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
                </div>
                {pedido.fecha_limite && (
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', flexShrink:0, display:'flex', alignItems:'center', gap:'0.25rem' }}>
                    <Calendar size={12} />{format(new Date(pedido.fecha_limite + 'T00:00:00'), "d MMM", { locale:es })}
                  </span>
                )}
              </div>
            )
          }

          return (
            <div key={pedido.id} onClick={() => navigate(`/app/pedidos/${pedido.id}`)} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/app/pedidos/${pedido.id}`)}
              style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem', cursor:'pointer', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
                  {(() => { const tipo = tipos.find(t => t.value === pedido.tipo); return tipo ? <span style={{ fontSize:'0.75rem', color: tipo.color, fontWeight:500 }}>{tipo.label}</span> : null })()}
                </div>
                <div style={{ display:'flex', gap:'0.375rem', flexWrap:'wrap' }}>
                  {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
                </div>
              </div>
              <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.9375rem', fontWeight:600 }}>{pedido.asunto}</h3>

              <EntregablesInline entregables={entregables} />

              {pedido.descripcion && (
                <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{pedido.descripcion}</p>
              )}

              <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginTop:'0.25rem', flexWrap:'wrap' }}>
                {pedido.fecha_limite && (
                  <span style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.75rem', color:'var(--text-muted)' }}>
                    <Calendar size={13} />{format(new Date(pedido.fecha_limite + 'T00:00:00'), "d MMM yyyy", { locale:es })}
                  </span>
                )}
                {pedido.pedido_asignados?.length > 0 && (
                  <span style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.75rem', color:'var(--text-muted)' }}>
                    <User size={13} />{pedido.pedido_asignados.length} asignado{pedido.pedido_asignados.length !== 1 ? 's' : ''}
                  </span>
                )}
                {pedido.tags?.length > 0 && (
                  <div style={{ display:'flex', gap:'0.25rem', flexWrap:'wrap' }} onClick={e => e.stopPropagation()}>
                    {pedido.tags.map(t => (
                      <button key={t} onClick={() => setFiltroTag(t)}
                        style={{ fontSize:'0.7rem', fontWeight:500, background: filtroTag === t ? 'rgba(91,78,232,0.15)' : 'var(--badge-bg)', color: filtroTag === t ? 'var(--icomm-violet)' : 'var(--text-muted)', border:`1px solid ${filtroTag === t ? 'rgba(91,78,232,0.3)' : 'var(--badge-border)'}`, padding:'0.1rem 0.4rem', borderRadius:'99px', display:'flex', alignItems:'center', gap:'0.2rem', transition:'all 150ms' }}>
                        <Tag size={9} />{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
    </div>
  )
}