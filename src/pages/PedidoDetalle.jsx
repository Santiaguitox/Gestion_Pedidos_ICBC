import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePedidos } from '@/hooks/usePedidos'
import { useAuth } from '@/context/AuthContext'
import { labelActividad, registrarActividad } from '@/hooks/useActividad'
import { PRIORIDADES, TIPOS, ESTADOS, ROLES, TIPO_ACTIVIDAD } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import PedidoForm from '@/components/pedidos/PedidoForm'
import { ArrowLeft, ExternalLink, Plus, Trash2, Edit, ChevronDown, ChevronUp, Copy, Check, Clock, Lock, Unlock, User } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// Acordeón reutilizable
function Section({ title, icon, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.625rem', padding:'1rem 1.25rem', cursor:'pointer', background:'none', textAlign:'left' }}>
        {icon && <span style={{ color:'var(--text-muted)', display:'flex', alignItems:'center' }}>{icon}</span>}
        <span style={{ fontFamily:'var(--font-display)', fontSize:'0.9375rem', fontWeight:600, flex:1 }}>{title}</span>
        {badge != null && (
          <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', background:'var(--bg-hover)', border:'1px solid var(--border)', padding:'0.1rem 0.5rem', borderRadius:'99px' }}>
            {badge}
          </span>
        )}
        {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
      </button>
      {open && (
        <div style={{ padding:'1.25rem 1.25rem 1.25rem', display:'flex', flexDirection:'column', gap:'1rem', borderTop:'1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Estado popover ───────────────────────────────────────────────────────────

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
    let nuevos
    if (valor === 'finalizado') {
      nuevos = estadosActivos.includes('finalizado') ? [] : ['finalizado']
    } else {
      nuevos = estadosActivos.includes(valor)
        ? estadosActivos.filter(x => x !== valor)
        : [...estadosActivos.filter(x => x !== 'finalizado'), valor]
    }
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

// ─── Historial ────────────────────────────────────────────────────────────────

function Historial({ pedidoId }) {
  const [actividad, setActividad] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const LIMITE = 5

  useEffect(() => {
    supabase.from('actividad').select('*, profiles(full_name)').eq('pedido_id', pedidoId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setActividad(data ?? []); setLoading(false) })
  }, [pedidoId])

  if (loading) return <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>Cargando historial…</p>
  if (actividad.length === 0) return <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>Sin actividad registrada.</p>

  const visible = mostrarTodos ? actividad : actividad.slice(0, LIMITE)
  const hayMas = actividad.length > LIMITE

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {visible.map((item, i) => (
          <div key={item.id} style={{ display:'flex', gap:'0.75rem', paddingBottom: i < visible.length - 1 ? '1rem' : 0 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--border-strong)', marginTop:'4px', flexShrink:0 }} />
              {i < visible.length - 1 && <div style={{ width:'1px', flex:1, background:'var(--border)', marginTop:'4px' }} />}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.125rem', flex:1, paddingBottom: i < visible.length - 1 ? '0.5rem' : 0 }}>
              <span style={{ fontSize:'0.875rem', color:'var(--text-primary)' }}>{labelActividad(item)}</span>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                {item.profiles?.full_name && (
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'0.25rem' }}>
                    <User size={11} />{item.profiles.full_name}
                  </span>
                )}
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                  {format(new Date(item.created_at), "d 'de' MMMM 'a las' HH:mm", { locale:es })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {hayMas && (
        <button onClick={() => setMostrarTodos(v => !v)}
          style={{ fontSize:'0.8125rem', color:'var(--text-muted)', padding:'0.375rem 0.75rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', alignSelf:'flex-start', transition:'all 150ms' }}>
          {mostrarTodos ? 'Ver menos' : `Ver ${actividad.length - LIMITE} más`}
        </button>
      )}
    </div>
  )
}

// ─── Subtareas ────────────────────────────────────────────────────────────────

function SubtareasTimeline({ subtareas, canWrite, canEdit, usuarios, onToggle, onEliminar, onAgregar }) {
  const [descripcion, setDescripcion] = useState('')
  const [asignadoA, setAsignadoA] = useState('')

  function handleAgregar() {
    if (!descripcion.trim()) return
    onAgregar(descripcion.trim(), asignadoA || null)
    setDescripcion('')
    setAsignadoA('')
  }

  const completadas = subtareas.filter(s => s.completada).length
  const total = subtareas.length
  const progreso = total > 0 ? Math.round((completadas / total) * 100) : 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      {total > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{completadas} de {total} completadas</span>
            <span style={{ fontSize:'0.75rem', fontWeight:600, color: progreso === 100 ? '#10B981' : 'var(--text-secondary)' }}>{progreso}%</span>
          </div>
          <div style={{ height:'4px', background:'var(--border)', borderRadius:'99px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progreso}%`, background: progreso === 100 ? '#10B981' : 'var(--accent-primary)', borderRadius:'99px', transition:'width 300ms ease' }} />
          </div>
        </div>
      )}
      {subtareas.length === 0 && <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>No hay subtareas.</p>}
      <div style={{ display:'flex', flexDirection:'column' }}>
        {subtareas.map((s, i) => {
          const asignado = s.profiles
          return (
            <div key={s.id} style={{ display:'flex', gap:'0.875rem' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, width:'20px' }}>
                <button onClick={() => onToggle(s.id, s.completada)}
                  style={{ width:'20px', height:'20px', borderRadius:'50%', flexShrink:0, border:`2px solid ${s.completada ? '#10B981' : 'var(--border-strong)'}`, background: s.completada ? '#10B981' : 'var(--bg-elevated)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 150ms', marginTop:'2px' }}>
                  {s.completada && <Check size={10} color="#fff" strokeWidth={3} />}
                </button>
                {i < subtareas.length - 1 && <div style={{ width:'2px', flex:1, background:'var(--border)', minHeight:'16px', margin:'3px 0' }} />}
              </div>
              <div style={{ flex:1, paddingBottom: i < subtareas.length - 1 ? '0.75rem' : 0 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem' }}>
                  <span style={{ flex:1, fontSize:'0.875rem', lineHeight:1.4, textDecoration: s.completada ? 'line-through' : 'none', color: s.completada ? 'var(--text-muted)' : 'var(--text-primary)', marginTop:'1px' }}>{s.descripcion}</span>
                  {canEdit && (
                    <button onClick={() => onEliminar(s.id)}
                      style={{ color:'var(--text-muted)', display:'flex', alignItems:'center', flexShrink:0, opacity:0.5, transition:'opacity 150ms' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                {asignado && (
                  <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', marginTop:'0.25rem' }}>
                    <span style={{ width:'16px', height:'16px', borderRadius:'50%', background:'var(--accent-secondary)', color:'#fff', fontSize:'0.5625rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{asignado.full_name?.[0]?.toUpperCase()}</span>
                    <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{asignado.full_name}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {canWrite && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', paddingTop:'0.5rem', borderTop:'1px solid var(--border)' }}>
          <input value={descripcion} onChange={e => setDescripcion(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAgregar()} placeholder="Nueva subtarea…" />
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)} style={{ flex:1, fontSize:'0.8125rem' }}>
              <option value="">Sin asignar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <button onClick={handleAgregar}
              style={{ display:'flex', alignItems:'center', gap:'0.25rem', background:'var(--bg-hover)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:'0.8125rem', fontWeight:500, padding:'0.5rem 0.875rem', borderRadius:'var(--radius-sm)', whiteSpace:'nowrap' }}>
              <Plus size={15} />Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Entregables ──────────────────────────────────────────────────────────────

function EntregableItem({ ent, canWrite, isSuperAdmin, onUpdate, onEliminar }) {
  const [form, setForm] = useState({ nombre_pieza: ent.nombre_pieza ?? '', link_online: ent.link_online ?? '' })
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState(false)
  const bloqueado = ent.aprobado && !isSuperAdmin

  async function guardar() {
    setSaving(true)
    await supabase.from('entregable').update(form).eq('id', ent.id)
    setSaving(false)
    setEditando(false)
    onUpdate()
  }

  async function toggleAprobado() {
    await supabase.from('entregable').update({
      aprobado: !ent.aprobado,
      aprobado_at: !ent.aprobado ? new Date().toISOString() : null
    }).eq('id', ent.id)
    onUpdate()
  }

  return (
    <div style={{ background:'var(--bg-elevated)', border:`1px solid ${ent.aprobado ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius:'var(--radius-md)', padding:'0.875rem', display:'flex', flexDirection:'column', gap:'0.625rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
        {ent.aprobado && (
          <span style={{ fontSize:'0.6875rem', fontWeight:600, background:'rgba(16,185,129,0.12)', color:'#10B981', border:'1px solid rgba(16,185,129,0.3)', padding:'0.1rem 0.5rem', borderRadius:'99px', flexShrink:0 }}>Aprobada</span>
        )}
        <div style={{ flex:1 }} />
        {canWrite && (
          <button onClick={toggleAprobado} title={ent.aprobado ? 'Desaprobar' : 'Aprobar'}
            style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.75rem', fontWeight:500, padding:'0.2rem 0.625rem', borderRadius:'var(--radius-sm)', border:`1px solid ${ent.aprobado ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, color: ent.aprobado ? '#10B981' : 'var(--text-muted)', background:'transparent', transition:'all 150ms' }}>
            {ent.aprobado ? <><Unlock size={12} />Desaprobar</> : <><Lock size={12} />Aprobar</>}
          </button>
        )}
        {!bloqueado && canWrite && !editando && (
          <button onClick={() => setEditando(true)}
            style={{ fontSize:'0.75rem', color:'var(--text-muted)', padding:'0.2rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
            Editar
          </button>
        )}
        {canWrite && (
          <button onClick={() => onEliminar(ent.id)}
            style={{ color:'var(--text-muted)', display:'flex', alignItems:'center', opacity:0.5, transition:'opacity 150ms' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {editando && !bloqueado ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <input value={form.nombre_pieza} onChange={e => setForm(f => ({ ...f, nombre_pieza: e.target.value }))} placeholder="Nombre de la pieza" />
          <input value={form.link_online} onChange={e => setForm(f => ({ ...f, link_online: e.target.value }))} placeholder="https://…" />
          <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
            <button onClick={() => setEditando(false)} style={{ fontSize:'0.8125rem', padding:'0.375rem 0.75rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', color:'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{ fontSize:'0.8125rem', fontWeight:600, padding:'0.375rem 0.875rem', borderRadius:'var(--radius-sm)', background:'var(--accent-primary)', color:'#fff', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <span style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', fontWeight:500, flexShrink:0 }}>Pieza:</span>
            <span style={{ fontSize:'0.8125rem', color:'var(--text-primary)', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ent.nombre_pieza}</span>
            <CopyBtn text={ent.nombre_pieza} />
          </div>
          {ent.link_online && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <span style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', fontWeight:500, flexShrink:0 }}>Link:</span>
              <span style={{ fontSize:'0.8125rem', color:'var(--accent-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ent.link_online}</span>
              <CopyBtn text={ent.link_online} />
              <a href={ent.link_online} target="_blank" rel="noopener"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'26px', height:'26px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'var(--bg-hover)', color:'var(--accent-secondary)', flexShrink:0 }}>
                <ExternalLink size={13} />
              </a>
            </div>
          )}
          {ent.aprobado && ent.aprobado_at && (
            <span style={{ fontSize:'0.75rem', color:'#10B981', marginTop:'0.125rem' }}>
              Aprobada el {format(new Date(ent.aprobado_at), "d 'de' MMMM 'a las' HH:mm", { locale:es })}
            </span>
          )}
          {bloqueado && (
            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontStyle:'italic' }}>
              Aprobada — para modificar generá una nueva versión
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function EntregablesSection({ pedidoId, entregables, canWrite, isSuperAdmin, onUpdate }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre_pieza:'', link_online:'' })
  const [saving, setSaving] = useState(false)

  async function agregar() {
    if (!form.nombre_pieza.trim()) return
    setSaving(true)
    await supabase.from('entregable').insert({ ...form, pedido_id: pedidoId })
    setForm({ nombre_pieza:'', link_online:'' })
    setShowForm(false)
    setSaving(false)
    onUpdate()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta pieza?')) return
    await supabase.from('entregable').delete().eq('id', id)
    onUpdate()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
      {entregables.length === 0 && !showForm && (
        <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>No hay piezas cargadas.</p>
      )}
      {entregables.map(ent => (
        <EntregableItem key={ent.id} ent={ent} canWrite={canWrite} isSuperAdmin={isSuperAdmin} onUpdate={onUpdate} onEliminar={eliminar} />
      ))}
      {showForm && (
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0.875rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <input value={form.nombre_pieza} onChange={e => setForm(f => ({ ...f, nombre_pieza: e.target.value }))} placeholder="Nombre de la pieza *" autoFocus />
          <input value={form.link_online} onChange={e => setForm(f => ({ ...f, link_online: e.target.value }))} placeholder="Link versión online (opcional)" />
          <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
            <button onClick={() => { setShowForm(false); setForm({ nombre_pieza:'', link_online:'' }) }}
              style={{ fontSize:'0.8125rem', padding:'0.375rem 0.75rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', color:'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={agregar} disabled={saving || !form.nombre_pieza.trim()}
              style={{ fontSize:'0.8125rem', fontWeight:600, padding:'0.375rem 0.875rem', borderRadius:'var(--radius-sm)', background:'var(--accent-primary)', color:'#fff', opacity: saving || !form.nombre_pieza.trim() ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar pieza'}
            </button>
          </div>
        </div>
      )}
      {canWrite && !showForm && (
        <button onClick={() => setShowForm(true)}
          style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)', padding:'0.5rem 0.875rem', borderRadius:'var(--radius-md)', border:'1px dashed var(--border)', alignSelf:'flex-start', transition:'all 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
          <Plus size={14} />{entregables.length === 0 ? 'Cargar pieza' : 'Agregar otra pieza'}
        </button>
      )}
      {entregables.length > 1 && (
        <CopyAllBtn entregables={entregables} />
      )}
    </div>
  )
}

function CopyAllBtn({ entregables }) {
  const [copied, setCopied] = useState(false)
  
  function handleCopy() {
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
      style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', fontWeight:500, color: copied ? '#10B981' : 'var(--text-secondary)', padding:'0.375rem 0.875rem', border:`1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius:'var(--radius-sm)', background: copied ? 'rgba(16,185,129,0.06)' : 'transparent', transition:'all 150ms', alignSelf:'flex-start' }}>
      {copied ? <><Check size={13} />¡Copiado!</> : <><Copy size={13} />Copiar todo</>}
    </button>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function PedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, user } = useAuth()
  const { actualizarPedido, eliminarPedido } = usePedidos()
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [usuarios, setUsuarios] = useState([])

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').order('full_name').then(({ data }) => setUsuarios(data ?? []))
  }, [])

  async function fetchPedido() {
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_asignados(user_id, profiles(id,full_name)), subtareas(*, profiles:asignado_a(full_name)), entregable(*)')
      .eq('id', id).single()
    setPedido(data)
    setLoading(false)
  }

  useEffect(() => { fetchPedido() }, [id])

  async function handleEdit(data) { await actualizarPedido(id, data); setEditando(false); fetchPedido() }
  async function handleDelete() {
    if (!confirm('¿Eliminar este pedido? Podrá restaurarse desde la papelera.')) return
    await eliminarPedido(id); navigate('/app/pedidos')
  }
  async function agregarSubtarea(descripcion, asignadoA) {
    await supabase.from('subtareas').insert({ pedido_id:id, descripcion, asignado_a: asignadoA })
    fetchPedido()
  }
  async function toggleSubtarea(subId, completada) {
    await supabase.from('subtareas').update({ completada: !completada }).eq('id', subId); fetchPedido()
  }
  async function eliminarSubtarea(subId) {
    await supabase.from('subtareas').delete().eq('id', subId); fetchPedido()
  }

  if (loading) return <div style={{ padding:'3rem', color:'var(--text-muted)' }}>Cargando…</div>
  if (!pedido)  return <div style={{ padding:'3rem', color:'var(--text-muted)' }}>Pedido no encontrado.</div>

  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const tipo = TIPOS.find(t => t.value === pedido.tipo)
  const estadosActivos = ESTADOS.filter(e => (pedido.estados ?? []).includes(e.value))
  const entregables = Array.isArray(pedido.entregable) ? pedido.entregable : pedido.entregable ? [pedido.entregable] : []
  const subtareas = pedido.subtareas ?? []
  const canEdit = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const canWrite = role !== ROLES.VIEWER
  const isSuperAdmin = role === ROLES.SUPER_ADMIN

  const subtareasCompletadas = subtareas.filter(s => s.completada).length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', maxWidth:'860px' }}>
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

        {/* Piezas aprobadas destacadas 
        {entregables.filter(e => e.aprobado).map(ent => (
          <div key={ent.id} style={{ display:'flex', flexDirection:'column', gap:'0.375rem', padding:'0.75rem 1rem', background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:'var(--radius-md)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
              <span style={{ fontSize:'0.6875rem', fontWeight:600, background:'rgba(16,185,129,0.12)', color:'#10B981', border:'1px solid rgba(16,185,129,0.3)', padding:'0.1rem 0.5rem', borderRadius:'99px', flexShrink:0 }}>Aprobada</span>
              <span style={{ fontSize:'0.8125rem', color:'var(--text-primary)', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ent.nombre_pieza}</span>
              <CopyBtn text={ent.nombre_pieza} />
              {ent.link_online && (
                <>
                  <CopyBtn text={ent.link_online} />
                  <a href={ent.link_online} target="_blank" rel="noopener"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'26px', height:'26px', borderRadius:'var(--radius-sm)', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.08)', color:'#10B981', flexShrink:0 }}>
                    <ExternalLink size={13} />
                  </a>
                </>
              )}
            </div>
          </div>
        ))}
          */}

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

      {/* Subtareas — acordeón, badge con progreso */}
      <Section
        title="Subtareas"
        defaultOpen={true}
        badge={subtareas.length > 0 ? `${subtareasCompletadas}/${subtareas.length}` : null}
      >
        <SubtareasTimeline
          subtareas={subtareas}
          canWrite={canWrite}
          canEdit={canEdit}
          usuarios={usuarios}
          onToggle={toggleSubtarea}
          onEliminar={eliminarSubtarea}
          onAgregar={agregarSubtarea}
        />
      </Section>

      {/* Entregables — acordeón, badge con cantidad */}
      <Section
        title="Piezas entregables"
        defaultOpen={true}
        badge={entregables.length > 0 ? entregables.length : null}
      >
        <EntregablesSection
          pedidoId={id}
          entregables={entregables}
          canWrite={canWrite}
          isSuperAdmin={isSuperAdmin}
          onUpdate={fetchPedido}
        />
      </Section>

      {/* Historial — cerrado por defecto, badge con total de eventos */}
      <Section
        title="Historial de actividad"
        icon={<Clock size={15} />}
        defaultOpen={false}
      >
        <Historial pedidoId={id} />
      </Section>

      {editando && <PedidoForm pedido={pedido} onSave={handleEdit} onCancel={() => setEditando(false)} />}
    </div>
  )
}