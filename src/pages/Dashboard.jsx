import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { PRIORIDADES, ESTADOS, TIPOS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { DatePicker } from '@/components/ui/DatePicker'
import {
  ListTodo, Clock, CheckCircle, AlertTriangle, Calendar, User,
  ExternalLink, Copy, Check, AlarmClock, ChevronDown, ChevronUp,
  LayoutList, AlignJustify
} from 'lucide-react'
import { format, differenceInDays, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { useLocalStorage } from '@/hooks/useLocalStorage'

const PRIORIDAD_ORDEN = { urgente: 0, alta: 1, media: 2, baja: 3 }
const PAGE_OPTIONS = [10, 20, 50]
function toLocalDate(isoString) {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const hoyISO = toLocalDate(new Date().toISOString())

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

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem', display:'flex', alignItems:'center', gap:'1rem' }}>
      <div style={{ width:'44px', height:'44px', borderRadius:'var(--radius-md)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:`${color}18`, color }}>{icon}</div>
      <div>
        <p style={{ fontFamily:'var(--font-display)', fontSize:'1.75rem', fontWeight:700, lineHeight:1 }}>{value}</p>
        <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>{label}</p>
      </div>
    </div>
  )
}

function PedidoCardCompact({ pedido }) {
  const navigate = useNavigate()
  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const estados = ESTADOS.filter(e => (pedido.estados ?? []).includes(e.value))
  return (
    <div onClick={() => navigate(`/app/pedidos/${pedido.id}`)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/app/pedidos/${pedido.id}`)}
      style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0.6rem 1rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.75rem' }}>
      {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
      <span style={{ fontFamily:'var(--font-display)', fontSize:'0.875rem', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pedido.asunto}</span>
      <div style={{ display:'flex', gap:'0.3rem', flexShrink:0 }}>
        {estados.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
      </div>
      {pedido.fecha_limite && (
        <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', flexShrink:0, display:'flex', alignItems:'center', gap:'0.25rem' }}>
          <Calendar size={12} />{format(new Date(pedido.fecha_limite + 'T00:00:00'), "d MMM", { locale:es })}
        </span>
      )}
    </div>
  )
}

function PedidoCardFull({ pedido }) {
  const navigate = useNavigate()
  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const estados = ESTADOS.filter(e => (pedido.estados ?? []).includes(e.value))
  const ent = pedido.entregable
  return (
    <div onClick={() => navigate(`/app/pedidos/${pedido.id}`)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/app/pedidos/${pedido.id}`)}
      style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem', cursor:'pointer', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
          <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{TIPOS.find(t => t.value === pedido.tipo)?.label}</span>
        </div>
        <div style={{ display:'flex', gap:'0.375rem', flexWrap:'wrap' }}>
          {estados.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
        </div>
      </div>
      <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.9375rem', fontWeight:600 }}>{pedido.asunto}</h3>
      {ent?.nombre_pieza && (
        <div onClick={e => e.stopPropagation()} style={{ display:'flex', flexDirection:'column', gap:'0.3rem', padding:'0.5rem 0.75rem', background:'var(--badge-bg)', border:'1px solid var(--badge-border)', borderRadius:'var(--radius-sm)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)', fontWeight:500, flexShrink:0 }}>Pieza:</span>
            <span style={{ fontSize:'0.75rem', color:'var(--text-primary)', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ent.nombre_pieza}</span>
            <CopyBtn text={ent.nombre_pieza} />
          </div>
          {ent.link_online && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)', fontWeight:500, flexShrink:0 }}>Link:</span>
              <span style={{ fontSize:'0.75rem', color:'var(--accent-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ent.link_online}</span>
              <CopyBtn text={ent.link_online} />
              <a href={ent.link_online} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'22px', height:'22px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'var(--bg-hover)', color:'var(--accent-secondary)', flexShrink:0 }}>
                <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>
      )}
      {pedido.descripcion && (
        <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{pedido.descripcion}</p>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginTop:'0.25rem' }}>
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
      </div>
    </div>
  )
}

function DiaGroup({ fecha, pedidos, vista, paginaSize }) {
  const [pagina, setPagina] = useState(0)
  const total = pedidos.length
  const finalizados = pedidos.filter(p => p.estados?.includes('finalizado')).length
  const inicio = pagina * paginaSize
  const slice = pedidos.slice(inicio, inicio + paginaSize)
  const totalPaginas = Math.ceil(total / paginaSize)

  // fecha es YYYY-MM-DD local — comparar con hoy local
  const hoyLocal = toLocalDate(new Date().toISOString())
  const esHoy = fecha === hoyLocal
  const label = esHoy ? 'Hoy' : format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
        <div style={{ height:'1px', width:'12px', background:'var(--border)', flexShrink:0 }} />
        <span style={{ fontFamily:'var(--font-display)', fontSize:'0.875rem', fontWeight:700, color: esHoy ? 'var(--icbc-red)' : 'var(--text-secondary)', textTransform:'capitalize', whiteSpace:'nowrap' }}>
          {label}
        </span>
        <div style={{ height:'1px', flex:1, background:'var(--border)' }} />
        <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', flexShrink:0 }}>
          {total} pedido{total !== 1 ? 's' : ''}{finalizados > 0 ? ` · ${finalizados} finalizado${finalizados !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', paddingLeft:'1.5rem' }}>
        {slice.map(p => vista === 'compact'
          ? <PedidoCardCompact key={p.id} pedido={p} />
          : <PedidoCardFull key={p.id} pedido={p} />
        )}
      </div>

      {totalPaginas > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', paddingLeft:'1.5rem', flexWrap:'wrap' }}>
          <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}
            style={{ fontSize:'0.8125rem', padding:'0.3rem 0.75rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', color:'var(--text-secondary)', opacity: pagina === 0 ? 0.4 : 1 }}>
            ←
          </button>
          {/* Selector de página si hay más de 3 páginas */}
          {totalPaginas > 3
            ? (
              <select value={pagina} onChange={e => setPagina(Number(e.target.value))}
                style={{ fontSize:'0.8125rem', padding:'0.3rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)' }}>
                {Array.from({ length: totalPaginas }, (_, i) => (
                  <option key={i} value={i}>Página {i + 1}</option>
                ))}
              </select>
            ) : (
              Array.from({ length: totalPaginas }, (_, i) => (
                <button key={i} onClick={() => setPagina(i)}
                  style={{ fontSize:'0.8125rem', padding:'0.3rem 0.625rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background: pagina === i ? 'var(--accent-primary)' : 'transparent', color: pagina === i ? '#fff' : 'var(--text-secondary)' }}>
                  {i + 1}
                </button>
              ))
            )
          }
          <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}
            style={{ fontSize:'0.8125rem', padding:'0.3rem 0.75rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', color:'var(--text-secondary)', opacity: pagina >= totalPaginas - 1 ? 0.4 : 1 }}>
            →
          </button>
        </div>
      )}
    </div>
  )
}

// Paginación con selector para proximos vencimientos
function ProximosPaginado({ proximos, navigate, hoy }) {
  const [pagina, setPagina] = useState(0)
  const PAGE_SIZE = 10
  const totalPaginas = Math.ceil(proximos.length / PAGE_SIZE)
  const slice = proximos.slice(pagina * PAGE_SIZE, pagina * PAGE_SIZE + PAGE_SIZE)

  return (
    <>
      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
        {slice.map(p => {
          const dias = differenceInDays(new Date(p.fecha_limite + 'T00:00:00'), hoy)
          const prio = PRIORIDADES.find(x => x.value === p.prioridad)
          return (
            <div key={p.id} onClick={() => navigate(`/app/pedidos/${p.id}`)}
              style={{ display:'flex', alignItems:'center', gap:'1rem', background:'var(--bg-surface)', border:'1px solid rgba(208,17,27,0.15)', borderRadius:'var(--radius-md)', padding:'0.75rem 1rem', cursor:'pointer' }}>
              <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
                <span style={{ fontSize:'0.875rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.asunto}</span>
                <span style={{ fontSize:'0.75rem', color:'var(--icbc-red)', marginTop:'0.125rem', opacity:0.8 }}>
                  {dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`}
                </span>
              </div>
              {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
            </div>
          )
        })}
      </div>

      {totalPaginas > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', marginTop:'1rem', flexWrap:'wrap' }}>
          <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}
            style={{ fontSize:'0.8125rem', padding:'0.3rem 0.75rem', borderRadius:'var(--radius-sm)', border:'1px solid rgba(208,17,27,0.2)', color:'var(--icbc-red)', opacity: pagina === 0 ? 0.4 : 1 }}>←</button>
          {totalPaginas > 3
            ? (
              <select value={pagina} onChange={e => setPagina(Number(e.target.value))}
                style={{ fontSize:'0.8125rem', padding:'0.3rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1px solid rgba(208,17,27,0.2)', background:'var(--bg-elevated)', color:'var(--icbc-red)', width:'auto' }}>
                {Array.from({ length: totalPaginas }, (_, i) => <option key={i} value={i}>Página {i + 1}</option>)}
              </select>
            ) : (
              Array.from({ length: totalPaginas }, (_, i) => (
                <button key={i} onClick={() => setPagina(i)}
                  style={{ fontSize:'0.8125rem', padding:'0.3rem 0.625rem', borderRadius:'var(--radius-sm)', border:'1px solid rgba(208,17,27,0.2)', background: pagina === i ? 'var(--icbc-red)' : 'transparent', color: pagina === i ? '#fff' : 'var(--icbc-red)' }}>
                  {i + 1}
                </button>
              ))
            )
          }
          <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}
            style={{ fontSize:'0.8125rem', padding:'0.3rem 0.75rem', borderRadius:'var(--radius-sm)', border:'1px solid rgba(208,17,27,0.2)', color:'var(--icbc-red)', opacity: pagina >= totalPaginas - 1 ? 0.4 : 1 }}>→</button>
        </div>
      )}
    </>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState([])

  const hoyISO = toLocalDate(new Date().toISOString())

  const [filtroEstado, setFiltroEstado] = useLocalStorage('dashboard:filtroEstado', '')
  const [filtroPrioridad, setFiltroPrioridad] = useLocalStorage('dashboard:filtroPrioridad', '')
  const [filtroTipo, setFiltroTipo] = useLocalStorage('dashboard:filtroTipo', '')
  const [filtroUsuario, setFiltroUsuario] = useLocalStorage('dashboard:filtroUsuario', '')
  const [ordenUrgencia, setOrdenUrgencia] = useLocalStorage('dashboard:ordenUrgencia', false)

  const [fechaDesde, setFechaDesde] = useLocalStorage('dashboard:fechaDesde', hoyISO)
  const [fechaHasta, setFechaHasta] = useLocalStorage('dashboard:fechaHasta', hoyISO)
  const [fechaError, setFechaError] = useState('')

  const [vista, setVista] = useLocalStorage('dashboard:vista', 'compact')
  const [paginaSize, setPaginaSize] = useLocalStorage('dashboard:paginaSize', 10)
  const [proximosOpen, setProximosOpen] = useLocalStorage('dashboard:proximosOpen', true)
  const [filtrosOpen, setFiltrosOpen] = useLocalStorage('dashboard:filtrosOpen', true)

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

  const hoy = new Date(); hoy.setHours(0,0,0,0)

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
  }, [pedidos, filtroEstado, filtroPrioridad, filtroTipo, filtroUsuario, fechaDesde, fechaHasta, fechaError, ordenUrgencia])

  // Agrupar por día LOCAL
  const porDia = useMemo(() => {
    const map = {}
    listaFiltrada.forEach(p => {
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
  }, [listaFiltrada])

  const selectStyle = { width:'auto', minWidth:'150px', fontSize:'0.8125rem' }
  const accordionHeaderStyle = { width:'100%', display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.875rem 1.25rem', cursor:'pointer' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'2rem' }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Dashboard</h1>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'1rem' }}>
        <StatCard icon={<ListTodo size={20} />}      label="Total pedidos" value={stats.total}       color="var(--icomm-violet)" />
        <StatCard icon={<AlertTriangle size={20} />} label="Urgentes"      value={stats.urgentes}    color="var(--icbc-red)" />
        <StatCard icon={<CheckCircle size={20} />}   label="Finalizados"   value={stats.finalizados} color="#10B981" />
        <StatCard icon={<Clock size={20} />}         label="Sin estado"    value={stats.sinEstado}   color="#F59E0B" />
      </div>

      {/* Próximos vencimientos — colapsable con paginación */}
      {proximos.length > 0 && (
        <div style={{ background:'rgba(208,17,27,0.03)', border:'1px solid rgba(208,17,27,0.15)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
          <div onClick={() => setProximosOpen(!proximosOpen)} style={accordionHeaderStyle}>
            <AlarmClock size={15} color="var(--icbc-red)" />
            <span style={{ fontFamily:'var(--font-display)', fontSize:'0.9375rem', fontWeight:600, color:'var(--icbc-red)', flex:1, textAlign:'left' }}>
              Vencen en los próximos 7 días
            </span>
            <span style={{ fontSize:'0.75rem', color:'var(--icbc-red)', opacity:0.7, marginRight:'0.5rem' }}>
              {proximos.length} pedido{proximos.length !== 1 ? 's' : ''}
            </span>
            {proximosOpen ? <ChevronUp size={16} color="var(--icbc-red)" /> : <ChevronDown size={16} color="var(--icbc-red)" />}
          </div>
          {proximosOpen && (
            <div style={{ padding:'0 1.25rem 1rem' }}>
              <ProximosPaginado proximos={proximos} navigate={navigate} hoy={hoy} />
            </div>
          )}
        </div>
      )}

      {/* Filtros — colapsable */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)' }}>
        <div onClick={() => setFiltrosOpen(!filtrosOpen)} style={{ ...accordionHeaderStyle, cursor:'pointer' }}>
          <span style={{ fontFamily:'var(--font-display)', fontSize:'0.875rem', fontWeight:600, color:'var(--text-secondary)', flex:1, textAlign:'left' }}>Filtros y vista</span>
          <div style={{ display:'flex', gap:'0.375rem', marginRight:'0.5rem' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setVista('compact')} title="Vista compacta"
              style={{ display:'flex', alignItems:'center', padding:'0.3rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background: vista === 'compact' ? 'var(--accent-primary)' : 'transparent', color: vista === 'compact' ? '#fff' : 'var(--text-muted)', transition:'all 150ms' }}>
              <AlignJustify size={13} />
            </button>
            <button onClick={() => setVista('full')} title="Vista completa"
              style={{ display:'flex', alignItems:'center', padding:'0.3rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background: vista === 'full' ? 'var(--accent-primary)' : 'transparent', color: vista === 'full' ? '#fff' : 'var(--text-muted)', transition:'all 150ms' }}>
              <LayoutList size={13} />
            </button>
            <select value={paginaSize} onChange={e => setPaginaSize(Number(e.target.value))}
              style={{ width:'auto', fontSize:'0.8125rem', padding:'0.25rem 0.5rem' }}>
              {PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}/día</option>)}
            </select>
          </div>
          {filtrosOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>

        {filtrosOpen && (
          <div style={{ padding:'0 1.25rem 1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <div style={{ display:'flex', gap:'0.625rem', flexWrap:'wrap', alignItems:'flex-start' }}>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={selectStyle}>
                <option value="">Todos los estados</option>
                <option value="sin_estado">Sin estado</option>
                {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)} style={selectStyle}>
                <option value="">Todas las prioridades</option>
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selectStyle}>
                <option value="">Todos los tipos</option>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} style={selectStyle}>
                <option value="">Todos los usuarios</option>
                <option value="mios">Mis pedidos</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
              <button onClick={() => setOrdenUrgencia(v => !v)}
                style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', fontWeight:500, padding:'0.4rem 0.875rem', borderRadius:'var(--radius-md)', border:'1px solid var(--border)', color: ordenUrgencia ? 'var(--icbc-red)' : 'var(--text-secondary)', background: ordenUrgencia ? 'rgba(208,17,27,0.08)' : 'transparent', transition:'all 150ms ease', whiteSpace:'nowrap' }}>
                <AlertTriangle size={13} />
                {ordenUrgencia ? 'Por urgencia ✓' : 'Ordenar por urgencia'}
              </button>
            </div>
            <div style={{ display:'flex', gap:'0.625rem', alignItems:'flex-end', flexWrap:'wrap' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem', minWidth:'180px' }}>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:500 }}>Desde</span>
                <DatePicker value={fechaDesde} onChange={handleDesde} placeholder="Fecha desde" />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem', minWidth:'180px' }}>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:500 }}>Hasta</span>
                <DatePicker value={fechaHasta} onChange={handleHasta} placeholder="Fecha hasta" />
              </div>
              {(fechaDesde || fechaHasta) && (
                <button onClick={() => { setFechaDesde(''); setFechaHasta(''); setFechaError('') }}
                  style={{ fontSize:'0.8125rem', color:'var(--text-muted)', padding:'0.5rem 0.75rem', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)' }}>
                  Limpiar fechas
                </button>
              )}
            </div>
            {fechaError && (
              <p style={{ fontSize:'0.8125rem', color:'var(--icbc-red)', background:'rgba(208,17,27,0.08)', border:'1px solid rgba(208,17,27,0.2)', padding:'0.4rem 0.75rem', borderRadius:'var(--radius-sm)' }}>
                {fechaError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      {loading && <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>Cargando…</p>}
      {!loading && porDia.length === 0 && (
        <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>No hay pedidos con esos filtros.</p>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:'2rem' }}>
        {porDia.map(([fecha, pedidosDia]) => (
          <DiaGroup key={fecha} fecha={fecha} pedidos={pedidosDia} vista={vista} paginaSize={paginaSize} />
        ))}
      </div>
    </div>
  )
}