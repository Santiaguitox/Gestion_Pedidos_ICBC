import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePedidos } from '@/hooks/usePedidos'
import { useAuth } from '@/context/AuthContext'
import { labelActividad } from '@/hooks/useActividad'
import { registrarActividad } from '@/hooks/useActividad'
import { PRIORIDADES, TIPOS, ESTADOS, ROLES, TIPO_ACTIVIDAD } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import PedidoForm from '@/components/pedidos/PedidoForm'
import { ArrowLeft, ExternalLink, Plus, Trash2, CheckSquare, Square, Edit, ChevronDown, Copy, Check, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e) {
    e?.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handleCopy} title="Copiar"
      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'26px', height:'26px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background: copied ? 'rgba(16,185,129,0.1)' : 'var(--bg-hover)', color: copied ? '#10B981' : 'var(--text-muted)', flexShrink:0, transition:'all 150ms ease' }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function EstadoPopover({ pedido, id, role, user, onUpdate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const estadosActivos = pedido.estados ?? []

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function toggle(valor) {
    const anteriores = [...estadosActivos]
    const nuevos = estadosActivos.includes(valor)
      ? estadosActivos.filter(x => x !== valor)
      : [...estadosActivos, valor]
    await supabase.from('pedidos').update({ estados: nuevos }).eq('id', id)
    await registrarActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_ESTADO, { anteriores, nuevos })
    onUpdate()
  }

  const canEdit = role !== ROLES.VIEWER

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(v => !v)} disabled={!canEdit}
        style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', fontWeight:500, padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', border:'1px solid var(--border)', color:'var(--text-secondary)', opacity: !canEdit ? 0.5 : 1, cursor: !canEdit ? 'default' : 'pointer' }}>
        Actualizar estado <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform 150ms' }} />
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:300, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)', padding:'0.625rem', minWidth:'220px', display:'flex', flexDirection:'column', gap:'0.25rem' }}>
          <p style={{ fontSize:'0.6875rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', padding:'0.25rem 0.5rem 0.5rem' }}>Togglear estados</p>
          {ESTADOS.map(e => {
            const active = estadosActivos.includes(e.value)
            return (
              <button key={e.value} onClick={() => toggle(e.value)}
                style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-md)', fontSize:'0.875rem', fontWeight:500, textAlign:'left', background: active ? `${e.color}12` : 'transparent', color: active ? e.color : 'var(--text-secondary)', transition:'background 150ms ease' }}
                onMouseEnter={ev => { if (!active) ev.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={ev => { if (!active) ev.currentTarget.style.background = 'transparent' }}>
                <span style={{ width:'8px', height:'8px', borderRadius:'50%', flexShrink:0, background: active ? e.color : 'var(--border)', border:`2px solid ${active ? e.color : 'var(--border-strong)'}` }} />
                {e.label}
                {active && <span style={{ marginLeft:'auto', fontSize:'0.6875rem', color:e.color, fontWeight:600 }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Historial({ pedidoId }) {
  const [actividad, setActividad] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('actividad').select('*, profiles(full_name)').eq('pedido_id', pedidoId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setActividad(data ?? []); setLoading(false) })
  }, [pedidoId])

  if (loading) return <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>Cargando historial…</p>
  if (actividad.length === 0) return <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>Sin actividad registrada.</p>

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {actividad.map((item, i) => (
        <div key={item.id} style={{ display:'flex', gap:'0.75rem', paddingBottom: i < actividad.length - 1 ? '1rem' : 0 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--border-strong)', marginTop:'4px', flexShrink:0 }} />
            {i < actividad.length - 1 && <div style={{ width:'1px', flex:1, background:'var(--border)', marginTop:'4px' }} />}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.125rem', flex:1, paddingBottom: i < actividad.length - 1 ? '0.5rem' : 0 }}>
            <span style={{ fontSize:'0.875rem', color:'var(--text-primary)' }}>{labelActividad(item)}</span>
            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
              {format(new Date(item.created_at), "d 'de' MMMM 'a las' HH:mm", { locale:es })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, user } = useAuth()
  const { actualizarPedido, eliminarPedido } = usePedidos()
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [nuevaSubtarea, setNuevaSubtarea] = useState('')
  const [entregable, setEntregable] = useState({ nombre_pieza:'', link_online:'' })
  const [savingEntregable, setSavingEntregable] = useState(false)

  async function fetchPedido() {
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_asignados(user_id, profiles(id,full_name)), subtareas(*), entregable(*)')
      .eq('id', id).single()
    setPedido(data)
    if (data?.entregable?.nombre_pieza !== undefined) {
      setEntregable({ nombre_pieza: data.entregable.nombre_pieza ?? '', link_online: data.entregable.link_online ?? '' })
    }
    setLoading(false)
  }

  useEffect(() => { fetchPedido() }, [id])

  async function handleEdit(data) { await actualizarPedido(id, data); setEditando(false); fetchPedido() }
  async function handleDelete() {
    if (!confirm('¿Eliminar este pedido? Podrá restaurarse desde la papelera.')) return
    await eliminarPedido(id); navigate('/app/pedidos')
  }
  async function agregarSubtarea() {
    if (!nuevaSubtarea.trim()) return
    await supabase.from('subtareas').insert({ pedido_id:id, descripcion:nuevaSubtarea.trim() })
    setNuevaSubtarea(''); fetchPedido()
  }
  async function toggleSubtarea(subId, completada) {
    await supabase.from('subtareas').update({ completada: !completada }).eq('id', subId); fetchPedido()
  }
  async function eliminarSubtarea(subId) {
    await supabase.from('subtareas').delete().eq('id', subId); fetchPedido()
  }
  async function guardarEntregable() {
    setSavingEntregable(true)
    const existing = pedido?.entregable?.id
    if (existing) await supabase.from('entregable').update(entregable).eq('id', existing)
    else await supabase.from('entregable').insert({ ...entregable, pedido_id:id })
    await fetchPedido()
    setSavingEntregable(false)
  }

  if (loading) return <div style={{ padding:'3rem', color:'var(--text-muted)' }}>Cargando…</div>
  if (!pedido)  return <div style={{ padding:'3rem', color:'var(--text-muted)' }}>Pedido no encontrado.</div>

  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const tipo = TIPOS.find(t => t.value === pedido.tipo)
  const estadosActivos = ESTADOS.filter(e => (pedido.estados ?? []).includes(e.value))
  const ent = pedido?.entregable
  const canEdit = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const canWrite = role !== ROLES.VIEWER

  const sectionStyle = { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1rem' }
  const sectionTitleStyle = { fontFamily:'var(--font-display)', fontSize:'0.9375rem', fontWeight:600 }
  const btnPrimary = { background:'var(--accent-primary)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.875rem', padding:'0.5rem 1.25rem', borderRadius:'var(--radius-md)' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'2rem', maxWidth:'860px' }}>
      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => navigate('/app/pedidos')} style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.875rem', color:'var(--text-secondary)', padding:'0.375rem 0.75rem', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
          <ArrowLeft size={16} />Volver
        </button>
        {canEdit && (
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <button onClick={() => setEditando(true)} style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', fontWeight:500, padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', border:'1px solid var(--border)', color:'var(--text-secondary)' }}><Edit size={15} />Editar</button>
            <button onClick={handleDelete} style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', fontWeight:500, padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', border:'1px solid rgba(208,17,27,0.3)', color:'var(--icbc-red)' }}><Trash2 size={15} />Eliminar</button>
          </div>
        )}
      </div>

      {/* Header */}
      <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', flexWrap:'wrap' }}>
          {prio && <Badge label={prio.label} color={prio.color} />}
          {tipo && <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{tipo.label}</span>}
          <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginLeft:'auto' }}>
            {format(new Date(pedido.created_at), "d 'de' MMMM yyyy", { locale:es })}
          </span>
        </div>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.625rem', fontWeight:700, lineHeight:1.2 }}>{pedido.asunto}</h1>
        {pedido.descripcion && <p style={{ fontSize:'0.9375rem', color:'var(--text-secondary)', lineHeight:1.6 }}>{pedido.descripcion}</p>}

        {ent?.nombre_pieza && (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem', padding:'0.75rem 1rem', background:'var(--badge-bg)', border:'1px solid var(--badge-border)', borderRadius:'var(--radius-md)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
              <span style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', fontWeight:500, flexShrink:0 }}>Pieza:</span>
              <span style={{ fontSize:'0.8125rem', color:'var(--text-primary)', fontWeight:600, flex:1 }}>{ent.nombre_pieza}</span>
              <CopyBtn text={ent.nombre_pieza} />
            </div>
            {ent.link_online && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                <span style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', fontWeight:500, flexShrink:0 }}>Link:</span>
                <span style={{ fontSize:'0.8125rem', color:'var(--accent-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ent.link_online}</span>
                <CopyBtn text={ent.link_online} />
                <a href={ent.link_online} target="_blank" rel="noopener"
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'26px', height:'26px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'var(--bg-hover)', color:'var(--accent-secondary)', flexShrink:0 }}>
                  <ExternalLink size={13} />
                </a>
              </div>
            )}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', flexWrap:'wrap' }}>
          {estadosActivos.length === 0
            ? <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)', fontStyle:'italic' }}>Sin estado asignado</span>
            : estadosActivos.map(e => <Badge key={e.value} label={e.label} color={e.color} />)
          }
          <EstadoPopover pedido={pedido} id={id} role={role} user={user} onUpdate={fetchPedido} />
        </div>
      </div>

      {/* Cards info */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'1rem' }}>
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem', display:'flex', flexDirection:'column', gap:'0.625rem' }}>
          <p style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>Asignados</p>
          {pedido.pedido_asignados?.length === 0
            ? <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>Nadie asignado</p>
            : pedido.pedido_asignados?.map(a => (
              <div key={a.user_id} style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.875rem' }}>
                <span style={{ width:'26px', height:'26px', borderRadius:'50%', background:'var(--accent-primary)', color:'#fff', fontSize:'0.6875rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{a.profiles?.full_name?.[0]?.toUpperCase()}</span>
                {a.profiles?.full_name}
              </div>
            ))
          }
        </div>
        {pedido.fecha_limite && (
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem' }}>
            <p style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:'0.625rem' }}>Fecha límite</p>
            <p style={{ fontSize:'0.9375rem', fontWeight:600 }}>{format(new Date(pedido.fecha_limite + 'T00:00:00'), "d 'de' MMMM yyyy", { locale:es })}</p>
          </div>
        )}
        {pedido.tags?.length > 0 && (
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem' }}>
            <p style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:'0.625rem' }}>Tags</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.375rem' }}>
              {pedido.tags.map(t => <span key={t} style={{ background:'var(--badge-bg)', border:'1px solid var(--badge-border)', color:'var(--accent-secondary)', fontSize:'0.75rem', padding:'0.15rem 0.5rem', borderRadius:'99px' }}>{t}</span>)}
            </div>
          </div>
        )}
      </div>

      {/* Subtareas */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Subtareas</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {(pedido.subtareas ?? []).map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.5rem 0.625rem', borderRadius:'var(--radius-sm)' }}>
              <button onClick={() => toggleSubtarea(s.id, s.completada)} style={{ display:'flex', alignItems:'center', color:'var(--text-muted)', flexShrink:0 }}>
                {s.completada ? <CheckSquare size={18} color="#10B981" /> : <Square size={18} />}
              </button>
              <span style={{ flex:1, fontSize:'0.875rem', textDecoration: s.completada ? 'line-through' : 'none', color: s.completada ? 'var(--text-muted)' : 'inherit' }}>{s.descripcion}</span>
              {canEdit && <button onClick={() => eliminarSubtarea(s.id)} style={{ color:'var(--text-muted)', display:'flex', alignItems:'center' }}><Trash2 size={14} /></button>}
            </div>
          ))}
          {(pedido.subtareas ?? []).length === 0 && <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>No hay subtareas.</p>}
        </div>
        {canWrite && (
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <input value={nuevaSubtarea} onChange={e => setNuevaSubtarea(e.target.value)} onKeyDown={e => e.key==='Enter' && agregarSubtarea()} placeholder="Nueva subtarea…" />
            <button onClick={agregarSubtarea} style={{ display:'flex', alignItems:'center', gap:'0.25rem', background:'var(--bg-hover)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:'0.8125rem', fontWeight:500, padding:'0.5rem 0.875rem', borderRadius:'var(--radius-sm)', whiteSpace:'nowrap' }}>
              <Plus size={16} />Agregar
            </button>
          </div>
        )}
      </div>

      {/* Entregable */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Entregable</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
            <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Nombre de la pieza</label>
            <input value={entregable.nombre_pieza} onChange={e => setEntregable(f => ({ ...f, nombre_pieza:e.target.value }))} placeholder="Ej: Campaña Día del Padre - Signature" disabled={!canWrite} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
            <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Link versión online</label>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              <input value={entregable.link_online} onChange={e => setEntregable(f => ({ ...f, link_online:e.target.value }))} placeholder="https://…" disabled={!canWrite} />
              {entregable.link_online && (
                <a href={entregable.link_online} target="_blank" rel="noopener" style={{ display:'flex', alignItems:'center', padding:'0 0.75rem', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-muted)', background:'var(--bg-hover)', flexShrink:0 }}>
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>
          {canWrite && (
            <button onClick={guardarEntregable} disabled={savingEntregable} style={{ ...btnPrimary, alignSelf:'flex-start', opacity: savingEntregable ? 0.6 : 1 }}>
              {savingEntregable ? 'Guardando…' : 'Guardar entregable'}
            </button>
          )}
        </div>
      </div>

      {/* Historial */}
      <div style={sectionStyle}>
        <h3 style={{ ...sectionTitleStyle, display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <Clock size={16} />Historial de actividad
        </h3>
        <Historial pedidoId={id} />
      </div>

      {editando && <PedidoForm pedido={pedido} onSave={handleEdit} onCancel={() => setEditando(false)} />}
    </div>
  )
}