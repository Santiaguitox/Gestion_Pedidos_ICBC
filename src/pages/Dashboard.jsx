import { useState, useEffect, useMemo } from 'react'
import { TagSearch } from '@/components/ui/TagSearch'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { PRIORIDADES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { Badge } from '@/components/ui/Badge'
import { DatePicker } from '@/components/ui/DatePicker'
import {
  ListTodo, Clock, CheckCircle, AlertTriangle, Calendar, User,
  ExternalLink, Copy, Check, AlarmClock, ChevronDown, ChevronUp,
  LayoutList, AlignJustify, Filter, Tag, X
} from 'lucide-react'
import { format, differenceInDays, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useTipos } from '@/hooks/useTipos'
// TEMP - borrar después de testear
import { useNotificaciones } from '@/context/NotificacionesContext'



const PRIORIDAD_ORDEN = { urgente: 0, alta: 1, media: 2, baja: 3 }
const PAGE_OPTIONS = [10, 20, 50]

function toLocalDate(isoString) {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: `${color}1a`, color }}>
        {icon}
      </div>
      <div>
        <p className="stat-card-value">{value}</p>
        <p className="stat-card-label">{label}</p>
      </div>
    </div>
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

function EntregablesCard({ entregables }) {
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
          Piezas
          <span className="badge-count">{conNombre.length}</span>
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
          <div
            key={ent.id}
            className="entregable-row"
            style={{ borderBottom: i < visibles.length - 1 ? '1px solid var(--badge-border)' : 'none' }}
          >
            <div className="entregable-nombre">
              {ent.aprobado && <span className="aprobado-badge">✓</span>}
              <span className="entregable-nombre-text">{ent.nombre_pieza}</span>
              <CopyBtn text={ent.nombre_pieza} />
            </div>
            {ent.link_online && (
              <div className="entregable-link-row">
                <span className="entregable-link-text">{ent.link_online}</span>
                <CopyBtn text={ent.link_online} />
                <a
                  href={ent.link_online}
                  target="_blank"
                  rel="noopener"
                  onClick={e => e.stopPropagation()}
                  className="entregable-link-btn"
                >
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

function PedidoCardCompact({ pedido, onTagClick, filtroTag, tipos = [], estados = [] }) {
  const navigate = useNavigate()
  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const estadosBadge = estados.filter(e => (pedido.estados ?? []).includes(e.value))

  return (
    <div
      onClick={() => navigate(`/app/pedidos/${pedido.id}`, { state: { from: '/app' } })}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/app/pedidos/${pedido.id}`, { state: { from: '/app' } })}
      className="pedido-card-compact"
    >
      {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
      <span className="pedido-asunto-compact">{pedido.asunto}</span>

      {pedido.tags?.length > 0 && (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          {pedido.tags.map(t => (
            <button
              key={t}
              onClick={() => onTagClick(t)}
              className={`tag-chip ${filtroTag === t ? 'tag-chip-active' : ''}`}
            >
              <Tag size={9} />{t}
            </button>
          ))}
        </div>
      )}

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
}

function PedidoCardFull({ pedido, onTagClick, filtroTag, tipos = [], estados = [] }) {
  const navigate = useNavigate()
  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const estadosBadge = estados.filter(e => (pedido.estados ?? []).includes(e.value))
  const entregables = Array.isArray(pedido.entregable)
    ? pedido.entregable
    : pedido.entregable ? [pedido.entregable] : []

  return (
    <div
      onClick={() => navigate(`/app/pedidos/${pedido.id}`, { state: { from: '/app' } })}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/app/pedidos/${pedido.id}`, { state: { from: '/app' } })}
      className="pedido-card-full"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
          {(() => {
            const tipo = tipos.find(t => t.value === pedido.tipo)
            return tipo ? <span className="tipo-label" style={{ color: tipo.color }}>{tipo.label}</span> : null
          })()}
        </div>
        <div className="flex gap-[0.375rem] flex-wrap">
          {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
        </div>
      </div>

      <h3 className="pedido-title">{pedido.asunto}</h3>
      <EntregablesCard entregables={entregables} />

      {pedido.descripcion && (
        <p className="pedido-descripcion">{pedido.descripcion}</p>
      )}

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
              <button
                key={t}
                onClick={() => onTagClick(t)}
                className={`tag-chip ${filtroTag === t ? 'tag-chip-active' : ''}`}
              >
                <Tag size={9} />{t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Pagination({ pagina, totalPaginas, setPagina }) {
  if (totalPaginas <= 1) return null
  return (
    <div className="pagination">
      <button
        disabled={pagina === 0}
        onClick={() => setPagina(p => p - 1)}
        className="btn-page btn-page-nav"
        style={{ opacity: pagina === 0 ? 0.4 : 1 }}
      >←</button>

      {totalPaginas > 3
        ? <select
            value={pagina}
            onChange={e => setPagina(Number(e.target.value))}
            className="select-pagination"
          >
            {Array.from({ length: totalPaginas }, (_, i) => (
              <option key={i} value={i}>Página {i + 1}</option>
            ))}
          </select>
        : Array.from({ length: totalPaginas }, (_, i) => (
            <button
              key={i}
              onClick={() => setPagina(i)}
              className={`btn-page ${pagina === i ? 'btn-page-active' : ''}`}
            >
              {i + 1}
            </button>
          ))
      }

      <button
        disabled={pagina >= totalPaginas - 1}
        onClick={() => setPagina(p => p + 1)}
        className="btn-page btn-page-nav"
        style={{ opacity: pagina >= totalPaginas - 1 ? 0.4 : 1 }}
      >→</button>
    </div>
  )
}

function DiaGroup({ fecha, pedidos, vista, paginaSize, onTagClick, filtroTag, tipos, estados, mostrarFinalizados }) {
  const [pagina, setPagina] = useState(0)
  const total = pedidos.length
  const finalizados = pedidos.filter(p => p.estados?.includes('finalizado')).length
  const slice = pedidos.slice(pagina * paginaSize, pagina * paginaSize + paginaSize)
  const totalPaginas = Math.ceil(total / paginaSize)
  const hoyLocal = toLocalDate(new Date().toISOString())
  const esHoy = fecha === hoyLocal
  const labelRaw = esHoy ? 'Hoy' : format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })
  const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1)

  return (
    <div className="dia-group">
      <div className="dia-group-header">
        <div className="dia-group-line" />
        <span className={`dia-group-label ${esHoy ? 'dia-group-label-hoy' : ''}`}>{label}</span>
        <div className="dia-group-line-flex" />
        <span className="dia-group-count">
          {total} pedido{total !== 1 ? 's' : ''}{finalizados > 0 ? ` · ${finalizados} finalizado${finalizados !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div className="dia-group-cards">
        {slice.filter(p => !p.estados?.includes('finalizado')).length > 0 && (
          <>
            {mostrarFinalizados && (
              <div className="dia-group-header">
                <div className="dia-group-line" />
                <span className="dia-group-label dia-group-label-hoy"><span style={{ color: 'var(--text-secondary)' }}>Pedidos</span> Activos</span>
                <div className="dia-group-line-flex" />
              </div>
            )}
            {slice.filter(p => !p.estados?.includes('finalizado')).map(p => vista === 'compact'
              ? <PedidoCardCompact key={p.id} pedido={p} onTagClick={onTagClick} filtroTag={filtroTag} tipos={tipos} estados={estados} />
              : <PedidoCardFull key={p.id} pedido={p} onTagClick={onTagClick} filtroTag={filtroTag} tipos={tipos} estados={estados} />
            )}
          </>
        )}
        {slice.filter(p => p.estados?.includes('finalizado')).length > 0 && (
          <>
            <div className="dia-group-header">
              <div className="dia-group-line" />
              <span className="dia-group-label dia-group-label-hoy"><span style={{ color: 'var(--text-secondary)' }}>Pedidos</span> Finalizados</span>
              <div className="dia-group-line-flex" />
            </div>
            {slice.filter(p => p.estados?.includes('finalizado')).map(p => vista === 'compact'
              ? <PedidoCardCompact key={p.id} pedido={p} onTagClick={onTagClick} filtroTag={filtroTag} tipos={tipos} estados={estados} />
              : <PedidoCardFull key={p.id} pedido={p} onTagClick={onTagClick} filtroTag={filtroTag} tipos={tipos} estados={estados} />
            )}
          </>
        )}
      </div>

      <div className="pagination" style={{ paddingLeft: '1.5rem' }}>
        <Pagination pagina={pagina} totalPaginas={totalPaginas} setPagina={setPagina} />
      </div>
    </div>
  )
}

function ProximosPaginado({ proximos, navigate, hoy }) {
  const [pagina, setPagina] = useState(0)
  const PAGE_SIZE = 10
  const PRIO_ORDEN = { urgente: 0, alta: 1, media: 2, baja: 3 }

  const activos = proximos
    .filter(p => !p.estados?.includes('esperando_respuesta'))
    .sort((a, b) => (PRIO_ORDEN[a.prioridad] ?? 99) - (PRIO_ORDEN[b.prioridad] ?? 99))

  const hoy0 = activos.filter(p => differenceInDays(new Date(p.fecha_limite + 'T00:00:00'), hoy) <= 1)
  const semana = activos.filter(p => differenceInDays(new Date(p.fecha_limite + 'T00:00:00'), hoy) > 1)
  const totalPaginas = Math.ceil(activos.length / PAGE_SIZE)

  if (activos.length === 0) return (
    <p className="text-muted-sm" style={{ padding: '0.5rem 0' }}>
      No hay pendientes activos — los pedidos en espera de respuesta no se muestran aquí.
    </p>
  )

  function PedidoRow({ p }) {
    const dias = differenceInDays(new Date(p.fecha_limite + 'T00:00:00'), hoy)
    const prio = PRIORIDADES.find(x => x.value === p.prioridad)
    const esHoyMañana = dias <= 1
    return (
      <div
        onClick={() => navigate(`/app/pedidos/${p.id}`, { state: { from: '/app' } })}
        className={`pedido-row ${esHoyMañana ? 'pedido-row-urgent' : ''}`}
      >
        <div className="pedido-row-info">
          <span className="pedido-row-name">{p.asunto}</span>
          <span className={`pedido-row-vence ${esHoyMañana ? 'pedido-row-vence-urgent' : ''}`}>
            {dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`}
          </span>
        </div>
        {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
      </div>
    )
  }

  return (
    <div className="proximos-root">
      {hoy0.length > 0 && (
        <div className="proximos-section">
          <span className="section-label section-label-urgent">Hoy y mañana</span>
          {hoy0.map(p => <PedidoRow key={p.id} p={p} />)}
        </div>
      )}
      {semana.length > 0 && (
        <div className="proximos-section">
          <span className="section-label section-label-muted">Esta semana</span>
          {semana.map(p => <PedidoRow key={p.id} p={p} />)}
        </div>
      )}
      <Pagination pagina={pagina} totalPaginas={totalPaginas} setPagina={setPagina} />
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState([])
  const { estados } = useEstados()

  const hoyISO = toLocalDate(new Date().toISOString())

  const [filtroEstado, setFiltroEstado] = useLocalStorage('dashboard:filtroEstado', '')
  const [filtroPrioridad, setFiltroPrioridad] = useLocalStorage('dashboard:filtroPrioridad', '')
  const [filtroTipo, setFiltroTipo] = useLocalStorage('dashboard:filtroTipo', '')
  const [filtroUsuario, setFiltroUsuario] = useLocalStorage('dashboard:filtroUsuario', '')
  const [filtroTag, setFiltroTag] = useLocalStorage('dashboard:filtroTag', '')
  const [ordenUrgencia, setOrdenUrgencia] = useLocalStorage('dashboard:ordenUrgencia', false)
  const [fechaDesde, setFechaDesde] = useLocalStorage('dashboard:fechaDesde', hoyISO)
  const [fechaHasta, setFechaHasta] = useLocalStorage('dashboard:fechaHasta', hoyISO)
  const [fechaError, setFechaError] = useState('')
  const [vista, setVista] = useLocalStorage('dashboard:vista', 'compact')
  const [paginaSize, setPaginaSize] = useLocalStorage('dashboard:paginaSize', 10)
  const [proximosOpen, setProximosOpen] = useLocalStorage('dashboard:proximosOpen', true)
  const [filtrosOpen, setFiltrosOpen] = useLocalStorage('dashboard:filtrosOpen', true)
  const [mostrarFinalizados, setMostrarFinalizados] = useLocalStorage('dashboard:mostrarFinalizados', false)
  const { tipos } = useTipos()

  useEffect(() => {
    fetchPedidos()
    supabase.from('profiles').select('id, full_name').order('full_name').then(({ data }) => setUsuarios(data ?? []))
  }, [])

  async function fetchPedidos() {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_asignados(user_id, profiles(id,full_name)), subtareas(*), entregable(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setPedidos(data ?? [])
    setLoading(false)
  }

  function validarRango(desde, hasta) {
    if (!desde || !hasta) { setFechaError(''); return }
    const d = parseISO(desde), h = parseISO(hasta)
    if (h < d) { setFechaError('La fecha hasta debe ser posterior a la fecha desde.'); return }
    if (differenceInDays(h, d) > 31) { setFechaError('El rango no puede superar 31 días.'); return }
    setFechaError('')
  }

  function handleDesde(val) { setFechaDesde(val); validarRango(val, fechaHasta) }
  function handleHasta(val) { setFechaHasta(val); validarRango(fechaDesde, val) }

  function limpiarFiltros() {
    setFiltroEstado(''); setFiltroPrioridad(''); setFiltroTipo('')
    setFiltroUsuario(''); setFiltroTag(''); setOrdenUrgencia(false)
    setFechaDesde(''); setFechaHasta(''); setFechaError('')
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

  const tagsDisponibles = useMemo(() =>
    [...new Set(pedidos.flatMap(p => p.tags ?? []))].sort()
  , [pedidos])

  const hayFiltrosActivos = filtroEstado || filtroPrioridad || filtroTipo || filtroUsuario || filtroTag || ordenUrgencia || fechaDesde || fechaHasta

  const proximos = useMemo(() => pedidos.filter(p => {
    if (!p.fecha_limite || p.estados?.includes('finalizado')) return false
    const dias = differenceInDays(new Date(p.fecha_limite + 'T00:00:00'), hoy)
    return dias >= 0 && dias <= 7
  }).sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite)), [pedidos])

  const stats = {
    total: pedidos.length,
    urgentes: pedidos.filter(p => p.prioridad === 'urgente').length,
    finalizados: pedidos.filter(p => p.estados?.includes('finalizado')).length,
    sinEstado: pedidos.filter(p => !p.estados?.length).length,
  }

  const listaFiltrada = useMemo(() => {
    let lista = [...pedidos]
    if (filtroEstado === 'sin_estado') lista = lista.filter(p => !p.estados?.length)
    else if (filtroEstado) lista = lista.filter(p => p.estados?.includes(filtroEstado))
    if (filtroPrioridad) lista = lista.filter(p => p.prioridad === filtroPrioridad)
    if (filtroTipo) lista = lista.filter(p => p.tipo === filtroTipo)
    if (filtroTag) lista = lista.filter(p => p.tags?.includes(filtroTag))
    if (filtroUsuario === 'mios') lista = lista.filter(p => p.pedido_asignados?.some(a => a.user_id === user?.id))
    else if (filtroUsuario) lista = lista.filter(p => p.pedido_asignados?.some(a => a.user_id === filtroUsuario))
    if (fechaDesde && fechaHasta && !fechaError) {
      const desde = startOfDay(parseISO(fechaDesde))
      const hasta = endOfDay(parseISO(fechaHasta))
      lista = lista.filter(p => isWithinInterval(new Date(p.created_at), { start: desde, end: hasta }))
    } else if (fechaDesde && !fechaHasta) {
      lista = lista.filter(p => new Date(p.created_at) >= startOfDay(parseISO(fechaDesde)))
    }
    if (ordenUrgencia) lista = lista.sort((a, b) => (PRIORIDAD_ORDEN[a.prioridad] ?? 99) - (PRIORIDAD_ORDEN[b.prioridad] ?? 99))
    return lista
  }, [pedidos, filtroEstado, filtroPrioridad, filtroTipo, filtroUsuario, filtroTag, fechaDesde, fechaHasta, fechaError, ordenUrgencia])

  const mostrarTodoPorFiltro = filtroEstado === 'finalizado'
  const listaActivos = mostrarTodoPorFiltro ? listaFiltrada : listaFiltrada.filter(p => !p.estados?.includes('finalizado'))
  const listaFinalizados = mostrarTodoPorFiltro ? [] : listaFiltrada.filter(p => p.estados?.includes('finalizado'))
  const listaVisible = mostrarTodoPorFiltro ? listaFiltrada : [...listaActivos, ...(mostrarFinalizados ? listaFinalizados : [])]

  const porDia = useMemo(() => {
    const map = {}
    listaVisible.forEach(p => {
      const dia = toLocalDate(p.created_at)
      if (!map[dia]) map[dia] = []
      map[dia].push(p)
    })
    const hoyStr = toLocalDate(new Date().toISOString())
    return Object.entries(map).sort((a, b) => {
      if (a[0] === hoyStr) return -1
      if (b[0] === hoyStr) return 1
      return b[0].localeCompare(a[0])
    })
  }, [listaVisible])

  const pendientesActivos = proximos.filter(p => !p.estados?.includes('esperando_respuesta')).length

  return (
    <div className="page-root">
      <h1 className="page-title">Dashboard</h1>
      <div className="stat-grid">
        <StatCard icon={<ListTodo size={20} />}      label="Total pedidos" value={stats.total}       color="#5B4EE8" />
        <StatCard icon={<AlertTriangle size={20} />} label="Urgentes"      value={stats.urgentes}    color="#D0111B" />
        <StatCard icon={<CheckCircle size={20} />}   label="Finalizados"   value={stats.finalizados} color="#10B981" />
        <StatCard icon={<Clock size={20} />}         label="Sin estado"    value={stats.sinEstado}   color="#F59E0B" />
      </div>

      {proximos.length > 0 && (
        <div className="agenda-panel">
          <button className="agenda-header" onClick={() => setProximosOpen(!proximosOpen)}>
            <div className="agenda-icon">
              <AlarmClock size={16} color="var(--icomm-violet)" />
            </div>
            <div className="flex-1 text-left">
              <div className="agenda-title">Agenda del día</div>
              <div className="agenda-subtitle">
                {pendientesActivos} pendiente{pendientesActivos !== 1 ? 's' : ''} activo{pendientesActivos !== 1 ? 's' : ''} para trabajar esta semana
              </div>
            </div>
            {proximosOpen
              ? <ChevronUp size={16} color="var(--icomm-violet)" />
              : <ChevronDown size={16} color="var(--icomm-violet)" />
            }
          </button>
          {proximosOpen && (
            <div className="agenda-body">
              <ProximosPaginado proximos={proximos} navigate={navigate} hoy={hoy} />
            </div>
          )}
        </div>
      )}

      

      <div className="panel">
        <div className="panel-header panel-header-with-controls" onClick={() => setFiltrosOpen(!filtrosOpen)}>
          <div className="panel-header-left">
            <Filter size={15} color="var(--text-muted)" />
            <span className="panel-label">Filtros y vista</span>
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
              <select value={paginaSize} onChange={e => setPaginaSize(Number(e.target.value))} className="select-sm">
                {PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}/día</option>)}
              </select>
            </div>
            {filtrosOpen
              ? <ChevronUp size={16} color="var(--text-muted)" />
              : <ChevronDown size={16} color="var(--text-muted)" />
            }
          </div>
        </div>

        {filtrosOpen && (
          <div className="panel-body">
            <div className="filters-row">
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="select-auto">
                <option value="">Todos los estados</option>
                <option value="sin_estado">Sin estado</option>
                {estados.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)} className="select-auto">
                <option value="">Todas las prioridades</option>
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="select-auto">
                <option value="">Todos los tipos</option>
                {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} className="select-auto">
                <option value="">Todos los usuarios</option>
                <option value="mios">Mis pedidos</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
              {tagsDisponibles.length > 0 && (
                <TagSearch tags={tagsDisponibles} value={filtroTag} onChange={setFiltroTag} />
              )}
              <button onClick={() => setOrdenUrgencia(v => !v)}
                className={`btn-urgencia ${ordenUrgencia ? 'btn-urgencia-active' : ''}`}>
                <AlertTriangle size={13} />
                {ordenUrgencia ? 'Por urgencia ✓' : 'Ordenar por urgencia'}
              </button>
            </div>

            {filtroTag && (
              <div className="tag-filter-row">
                <span className="tag-filter-label">Tag:</span>
                <span className="tag-chip-filter">
                  <Tag size={10} />{filtroTag}
                  <button onClick={() => setFiltroTag('')} className="flex items-center ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              </div>
            )}

            <div className="filter-dates-row">
              <div className="filter-date-col">
                <span className="filter-date-label">Desde</span>
                <DatePicker value={fechaDesde} onChange={handleDesde} placeholder="Fecha desde" />
              </div>
              <div className="filter-date-col">
                <span className="filter-date-label">Hasta</span>
                <DatePicker value={fechaHasta} onChange={handleHasta} placeholder="Fecha hasta" />
              </div>
              {hayFiltrosActivos && (
                <button onClick={limpiarFiltros} className="btn-clear-filters">
                  <X size={13} />Limpiar filtros
                </button>
              )}
            </div>

            {fechaError && <p className="msg-error">{fechaError}</p>}
          </div>
        )}
      </div>

      {!mostrarTodoPorFiltro && listaFinalizados.length > 0 && (
        <button onClick={() => setMostrarFinalizados(v => !v)} className="btn-ghost-muted">
          {mostrarFinalizados
            ? <><ChevronUp size={14} />Ocultar finalizados</>
            : <><ChevronDown size={14} />Mostrar finalizados ({listaFinalizados.length})</>}
        </button>
      )}

      {loading && <p className="text-muted-sm">Cargando…</p>}
      {!loading && porDia.length === 0 && (
        <p className="text-muted-sm">No hay pedidos con esos filtros.</p>
      )}

      <div className="page-root">
        {porDia.map(([fecha, pedidosDia]) => (
          <DiaGroup
            key={fecha}
            fecha={fecha}
            pedidos={pedidosDia}
            vista={vista}
            paginaSize={paginaSize}
            onTagClick={setFiltroTag}
            filtroTag={filtroTag}
            tipos={tipos}
            estados={estados}
            mostrarFinalizados={mostrarFinalizados}
          />
        ))}
      </div>
    </div>
  )
}