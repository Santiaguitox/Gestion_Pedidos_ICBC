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
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      title="Copiar"
      className={`copy-btn ${copied ? 'copy-btn-copied' : ''}`}
    >
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
    <button onClick={handleCopy} className={`copy-all-btn ${copied ? 'copy-all-btn-copied' : ''}`}>
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
    <div onClick={e => e.stopPropagation()} className="entregables-card">
      <div
        className="entregables-header"
        onClick={hayMas ? () => setExpandido(v => !v) : undefined}
        style={{ cursor: hayMas ? 'pointer' : 'default' }}
      >
        <span className="entregables-header-left">
          Piezas <span className="badge-count">{conNombre.length}</span>
        </span>
        <div className="entregables-header-right">
          {conNombre.length > 1 && <CopyAllBtnInline entregables={conNombre} />}
          {hayMas && (
            <span className="entregables-expand-hint">
              {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expandido ? 'Ver menos' : `Ver ${conNombre.length - 2} más`}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col">
        {visibles.map((ent, i) => (
          <div key={ent.id} className="entregable-row"
            style={{ borderBottom: i < visibles.length - 1 ? '1px solid var(--badge-border)' : 'none' }}>
            <div className="entregable-nombre">
              {ent.aprobado && <span className="aprobado-badge">✓</span>}
              <span className="entregable-nombre-text">{ent.nombre_pieza}</span>
              <CopyBtn text={ent.nombre_pieza} />
            </div>
            {ent.link_online && (
              <div className="entregable-link-row">
                <span className="entregable-link-text">{ent.link_online}</span>
                <CopyBtn text={ent.link_online} />
                <a href={ent.link_online} target="_blank" rel="noopener"
                  onClick={e => e.stopPropagation()} className="entregable-link-btn">
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
  const [filters, setFilters] = useState({ prioridad: '', tipo: '' })
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

  const tagsDisponibles = [...new Set(pedidos.flatMap(p => p.tags ?? []))].sort()

  let listaBase = [...pedidos]
  if (filtroEstado === 'sin_estado') listaBase = listaBase.filter(p => !p.estados?.length)
  else if (filtroEstado) listaBase = listaBase.filter(p => p.estados?.includes(filtroEstado))
  if (filtroTag) listaBase = listaBase.filter(p => p.tags?.includes(filtroTag))
  if (fechaDesde) listaBase = listaBase.filter(p => p.created_at.slice(0, 10) >= fechaDesde)
  if (fechaHasta) listaBase = listaBase.filter(p => p.created_at.slice(0, 10) <= fechaHasta)
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

  function limpiarFiltros() {
    setFilters({ prioridad: '', tipo: '' })
    setSearch(''); setFiltroEstado(''); setFiltroTag(''); setFechaDesde(''); setFechaHasta('')
  }

  return (
    <div className="page-root">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">{lista.length} pedido{lista.length !== 1 ? 's' : ''}</p>
        </div>
        {role !== ROLES.VIEWER && (
          <button onClick={onNew} className="btn-header-action">
            <Plus size={16} />Nuevo pedido
          </button>
        )}
      </div>

      {/* Panel de filtros */}
      <div className="panel">
        <div className="panel-header" onClick={() => setFiltrosOpen(v => !v)}>
          <div className="panel-header-left">
            <Filter size={15} color="var(--text-muted)" />
            <span className="panel-label">Filtros</span>
            {hayFiltrosActivos && <span className="badge-active-pill">activos</span>}
          </div>
          <div className="panel-header-right">
            <div className="vista-controls" onClick={e => e.stopPropagation()}>
              <button onClick={() => setVista('compact')} title="Vista compacta"
                className={`btn-toggle ${vista === 'compact' ? 'btn-toggle-active' : ''}`}>
                <AlignJustify size={13} />
              </button>
              <button onClick={() => setVista('full')} title="Vista completa"
                className={`btn-toggle ${vista === 'full' ? 'btn-toggle-active' : ''}`}>
                <LayoutList size={13} />
              </button>
            </div>
            {filtrosOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </div>
        </div>

        {filtrosOpen && (
          <div className="panel-body">
            {/* Búsqueda */}
            <div className="search-wrapper">
              <span className="search-icon"><Search size={15} /></span>
              <input
                placeholder="Buscar por asunto, pieza o link…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-icon-left"
              />
            </div>

            {/* Selects */}
            <div className="filters-row">
              <select value={filters.prioridad} onChange={e => setFilters(f => ({ ...f, prioridad: e.target.value }))} className="select-auto">
                <option value="">Todas las prioridades</option>
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))} className="select-auto">
                <option value="">Todos los tipos</option>
                {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="select-auto">
                <option value="">Todos los estados</option>
                <option value="sin_estado">Sin estado</option>
                {estados.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              {tagsDisponibles.length > 0 && (
                <TagSearch tags={tagsDisponibles} value={filtroTag} onChange={setFiltroTag} />
              )}
            </div>

            {/* Tag activo */}
            {filtroTag && (
              <div className="tag-filter-row">
                <span className="tag-filter-label">Tag:</span>
                <span className="tag-chip-filter">
                  <Tag size={10} />{filtroTag}
                  <button onClick={() => setFiltroTag('')} className="flex items-center ml-0.5"><X size={10} /></button>
                </span>
              </div>
            )}

            {/* Fechas */}
            <div className="filter-dates-row">
              <div className="filter-date-col">
                <span className="filter-date-label">Desde</span>
                <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Fecha desde" />
              </div>
              <div className="filter-date-col">
                <span className="filter-date-label">Hasta</span>
                <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Fecha hasta" />
              </div>
              {hayFiltrosActivos && (
                <button onClick={limpiarFiltros} className="btn-clear-filters">
                  <X size={13} />Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && <div className="loading-text">Cargando pedidos…</div>}

      {!loading && lista.length === 0 && (
        <div className="empty-state">
          <Filter size={32} />
          <p>No hay pedidos.</p>
          {role !== ROLES.VIEWER && (
            <button onClick={onNew} className="btn-primary" style={{ width: 'auto', marginTop: '0.75rem', padding: '0.5rem 1.25rem' }}>
              Crear el primero
            </button>
          )}
        </div>
      )}

      {!mostrarTodoPorFiltro && listaFinalizados.length > 0 && (
        <button onClick={() => setMostrarFinalizados(v => !v)} className="btn-ghost-muted">
          {mostrarFinalizados
            ? <><ChevronUp size={14} />Ocultar finalizados</>
            : <><ChevronDown size={14} />Mostrar finalizados ({listaFinalizados.length})</>}
        </button>
      )}

      {/* Lista de pedidos */}
      <div className="flex flex-col" style={{ gap: vista === 'compact' ? '0.375rem' : '0.625rem' }}>
        {lista.map(pedido => {
          const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
          const estadosBadge = estados.filter(e => (pedido.estados ?? []).includes(e.value))
          const entregables = Array.isArray(pedido.entregable)
            ? pedido.entregable
            : pedido.entregable ? [pedido.entregable] : []

          if (vista === 'compact') return (
            <div key={pedido.id}
              onClick={() => navigate(`/app/pedidos/${pedido.id}`)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/app/pedidos/${pedido.id}`)}
              className="pedido-card-compact"
            >
              {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
              <span className="pedido-asunto-compact">{pedido.asunto}</span>
              <div className="flex gap-[0.3rem] shrink-0">
                {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
              </div>
              {pedido.fecha_limite && (
                <span className="pedido-meta-item">
                  <Calendar size={12} />
                  {format(new Date(pedido.fecha_limite + 'T00:00:00'), 'd MMM', { locale: es })}
                </span>
              )}
            </div>
          )

          return (
            <div key={pedido.id}
              onClick={() => navigate(`/app/pedidos/${pedido.id}`)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/app/pedidos/${pedido.id}`)}
              className="pedido-card-full"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
                  {(() => { const tipo = tipos.find(t => t.value === pedido.tipo); return tipo ? <span className="tipo-label" style={{ color: tipo.color }}>{tipo.label}</span> : null })()}
                </div>
                <div className="flex gap-[0.375rem] flex-wrap">
                  {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
                </div>
              </div>

              <h3 className="pedido-title">{pedido.asunto}</h3>
              <EntregablesInline entregables={entregables} />

              {pedido.descripcion && <p className="pedido-descripcion">{pedido.descripcion}</p>}

              <div className="pedido-meta">
                {pedido.fecha_limite && (
                  <span className="pedido-meta-item">
                    <Calendar size={13} />
                    {format(new Date(pedido.fecha_limite + 'T00:00:00'), 'd MMM yyyy', { locale: es })}
                  </span>
                )}
                {pedido.pedido_asignados?.length > 0 && (
                  <span className="pedido-meta-item">
                    <User size={13} />
                    {pedido.pedido_asignados.length} asignado{pedido.pedido_asignados.length !== 1 ? 's' : ''}
                  </span>
                )}
                {pedido.tags?.length > 0 && (
                  <div className="flex gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                    {pedido.tags.map(t => (
                      <button key={t} onClick={() => setFiltroTag(t)}
                        className={`tag-chip ${filtroTag === t ? 'tag-chip-active' : ''}`}>
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