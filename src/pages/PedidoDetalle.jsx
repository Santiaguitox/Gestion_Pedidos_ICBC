import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePedidos } from '@/hooks/usePedidos'
import { useAuth } from '@/context/AuthContext'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { labelActividad, registrarActividad } from '@/hooks/useActividad'
import { PRIORIDADES, ROLES, TIPO_ACTIVIDAD } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { useInstancias } from '@/hooks/useInstancias'
import { Badge } from '@/components/ui/Badge'
import PedidoForm from '@/components/pedidos/PedidoForm'
import { DatePicker } from '@/components/ui/DatePicker'
import { ArrowLeft, ExternalLink, Plus, Trash2, Edit, ChevronDown, ChevronUp, Copy, Check, Clock, Lock, Unlock, User, FileSpreadsheet, X, CheckCircle } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={e => { e?.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      title="Copiar" className={`copy-btn ${copied ? 'copy-btn-copied' : ''}`}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function Section({ title, icon, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="section-accordion">
      <button onClick={() => setOpen(v => !v)} className="section-accordion-header">
        {icon && <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <span className="section-accordion-title">{title}</span>
        {badge != null && <span className="badge-count">{badge}</span>}
        {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
      </button>
      {open && <div className="section-accordion-body">{children}</div>}
    </div>
  )
}

function SuccessModal({ message, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '380px' }}>
        <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <CheckCircle size={26} color="#10B981" />
          </div>
          <div>
            <h2 className="modal-title" style={{ marginBottom: '0.25rem' }}>¡Registrado!</h2>
            <p className="text-muted-sm">{message}</p>
          </div>
          <button onClick={onClose} className="btn-primary" style={{ width: 'auto', marginTop: '0.25rem' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function EstadoPopover({ pedido, id, role, user, onUpdate, estados = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const estadosActivos = pedido.estados ?? []
  const canEdit = role !== ROLES.VIEWER

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
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

  return (
    <div ref={ref} className="estado-popover">
      <button onClick={() => setOpen(v => !v)} disabled={!canEdit}
        className="estado-popover-trigger"
        style={{ opacity: !canEdit ? 0.5 : 1, cursor: !canEdit ? 'default' : 'pointer' }}>
        Actualizar estado
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>
      {open && (
        <div className="estado-popover-menu">
          <p className="estado-popover-label">Togglear estados</p>
          {estados.map(e => {
            const active = estadosActivos.includes(e.value)
            return (
              <button key={e.value} onClick={() => toggle(e.value)}
                className="estado-popover-item"
                style={{ background: active ? `${e.color}12` : 'transparent', color: active ? e.color : 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                onMouseEnter={ev => { if (!active) ev.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={ev => { if (!active) ev.currentTarget.style.background = 'transparent' }}>
                <span className="estado-dot" style={{ background: active ? e.color : 'var(--border)', border: `2px solid ${active ? e.color : 'var(--border-strong)'}` }} />
                {e.label}
                {active && <span className="estado-check" style={{ color: e.color }}>✓</span>}
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
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const LIMITE = 5

  useEffect(() => {
    supabase.from('actividad').select('*, profiles(full_name)').eq('pedido_id', pedidoId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setActividad(data ?? []); setLoading(false) })
  }, [pedidoId])

  if (loading) return <p className="text-muted-sm">Cargando historial…</p>
  if (actividad.length === 0) return <p className="text-muted-sm">Sin actividad registrada.</p>

  const visible = mostrarTodos ? actividad : actividad.slice(0, LIMITE)

  return (
    <div className="flex flex-col gap-3">
      <div className="historial-list">
        {visible.map((item, i) => (
          <div key={item.id} className="historial-item" style={{ paddingBottom: i < visible.length - 1 ? '1rem' : 0 }}>
            <div className="historial-timeline">
              <div className="historial-dot" />
              {i < visible.length - 1 && <div className="historial-line" />}
            </div>
            <div className="historial-content" style={{ paddingBottom: i < visible.length - 1 ? '0.5rem' : 0 }}>
              <span className="historial-text">{labelActividad(item)}</span>
              <div className="historial-meta">
                {item.profiles?.full_name && (
                  <span className="historial-meta-item"><User size={11} />{item.profiles.full_name}</span>
                )}
                <span className="historial-meta-item">
                  {format(new Date(item.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {actividad.length > LIMITE && (
        <button onClick={() => setMostrarTodos(v => !v)} className="btn-ver-mas">
          {mostrarTodos ? 'Ver menos' : `Ver ${actividad.length - LIMITE} más`}
        </button>
      )}
    </div>
  )
}

// ─── Modal Sheet Diseño ───────────────────────────────────────────────────────
function SheetDisenoModal({ pedido, subtarea, onClose, onConfirm }) {
  const [data, setData] = useState({
    nombre_campana: pedido.asunto ?? '',
    fecha_pedido:   format(new Date(subtarea.created_at), "dd/MM/yyyy", { locale: es }),
    hora_pedido:    format(new Date(subtarea.created_at), "HH:mm", { locale: es }),
    descripcion:    subtarea.descripcion ?? '',
    fecha_entrega:  subtarea.completada_at ? format(new Date(subtarea.completada_at), "yyyy-MM-dd") : '',
    hora_entrega:   subtarea.completada_at ? format(new Date(subtarea.completada_at), "HH:mm") : '',
    aclaraciones:   '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  async function handleConfirm() {
    setSaving(true)
    const fechaFmt = data.fecha_entrega ? format(new Date(data.fecha_entrega + 'T00:00:00'), "dd/MM/yyyy") : ''
    await onConfirm({ ...data, fecha_entrega: fechaFmt })
    setSaving(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Registrar tarea de diseño</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="text-muted-sm" style={{ marginBottom: '0.75rem' }}>
            Revisá y editá los datos antes de confirmar.
          </p>
          <div className="flex flex-col gap-2">
            <div className="sheet-field">
              <label className="field-label">Nombre de campaña</label>
              <input value={data.nombre_campana} onChange={e => set('nombre_campana', e.target.value)} placeholder="Nombre de campaña…" />
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Fecha pedido</label>
                <input value={data.fecha_pedido} onChange={e => set('fecha_pedido', e.target.value)} placeholder="Fecha pedido…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora pedido</label>
                <input value={data.hora_pedido} onChange={e => set('hora_pedido', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
            <div className="sheet-field">
              <label className="field-label">Descripción</label>
              <input value={data.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción…" />
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Fecha entrega</label>
                <DatePicker value={data.fecha_entrega} onChange={val => set('fecha_entrega', val)} placeholder="Seleccionar fecha…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora entrega</label>
                <input value={data.hora_entrega} onChange={e => set('hora_entrega', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
            <div className="sheet-field">
              <label className="field-label">Aclaraciones</label>
              <input value={data.aclaraciones} onChange={e => set('aclaraciones', e.target.value)} placeholder="Aclaraciones…" />
            </div>
          </div>
          <div className="modal-footer" style={{ marginTop: '1.25rem' }}>
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={handleConfirm} disabled={saving} className="btn-primary"
              style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Registrando…' : 'Confirmar y registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Sheet Pedidos ──────────────────────────────────────────────────────
const TIPOS_ENVIO_LABELS = { test: 'Test', real: 'Real', otro: 'Otro' }

function SheetModal({ pedido, entregables, onClose, onConfirm }) {
  const primeraAprobacion = entregables.find(e => e.aprobado_at)
  const fechaAprobRef = primeraAprobacion ? new Date(primeraAprobacion.aprobado_at) : new Date()

  const [data, setData] = useState({
    nombre_campana:    pedido.asunto ?? '',
    fecha_pedido:      format(new Date(pedido.created_at), "dd/MM/yyyy", { locale: es }),
    hora_pedido:       format(new Date(pedido.created_at), "HH:mm", { locale: es }),
    descripcion:       pedido.descripcion ?? '',
    instancia:         pedido.instancia ?? '',
    fecha_aprobacion:  format(fechaAprobRef, "yyyy-MM-dd"),
    hora_aprobacion:   format(fechaAprobRef, "HH:mm", { locale: es }),
    cantidad_envios:   String(pedido.cantidad_envios ?? entregables.filter(e => e.nombre_pieza).length),
    aclaraciones:      pedido.tipo_envio === 'otro' ? (pedido.tipo_envio_otro ?? '') : (TIPOS_ENVIO_LABELS[pedido.tipo_envio] ?? ''),
    dia_programacion:  pedido.fecha_programacion ?? '',
    hora_programacion: pedido.hora_programacion ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  async function handleConfirm() {
    setSaving(true)
    const diaFmt        = data.dia_programacion  ? format(new Date(data.dia_programacion  + 'T00:00:00'), "dd/MM/yyyy") : ''
    const fechaAprobFmt = data.fecha_aprobacion  ? format(new Date(data.fecha_aprobacion  + 'T00:00:00'), "dd/MM/yyyy") : ''
    await onConfirm({ ...data, dia_programacion: diaFmt, fecha_aprobacion: fechaAprobFmt })
    setSaving(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Registrar en Google Sheets</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="text-muted-sm" style={{ marginBottom: '0.75rem' }}>
            Revisá y editá los datos antes de confirmar el registro.
          </p>
          <div className="flex flex-col gap-2">
            <div className="sheet-field">
              <label className="field-label">Nombre de campaña</label>
              <input value={data.nombre_campana} onChange={e => set('nombre_campana', e.target.value)} placeholder="Nombre de campaña…" />
            </div>
            <div className="sheet-field">
              <label className="field-label">Descripción</label>
              <input value={data.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción…" />
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Fecha pedido</label>
                <input value={data.fecha_pedido} onChange={e => set('fecha_pedido', e.target.value)} placeholder="Fecha pedido…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora pedido</label>
                <input value={data.hora_pedido} onChange={e => set('hora_pedido', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Instancia</label>
                <input value={data.instancia} onChange={e => set('instancia', e.target.value)} placeholder="Instancia…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Cantidad envíos</label>
                <input value={data.cantidad_envios} onChange={e => set('cantidad_envios', e.target.value)} placeholder="Cantidad…" />
              </div>
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Fecha aprobación</label>
                <DatePicker value={data.fecha_aprobacion} onChange={val => set('fecha_aprobacion', val)} placeholder="Seleccionar fecha…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora aprobación</label>
                <input value={data.hora_aprobacion} onChange={e => set('hora_aprobacion', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
            <div className="sheet-field">
              <label className="field-label">Aclaraciones</label>
              <input value={data.aclaraciones} onChange={e => set('aclaraciones', e.target.value)} placeholder="Aclaraciones…" />
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Día de programación</label>
                <DatePicker value={data.dia_programacion} onChange={val => set('dia_programacion', val)} placeholder="Seleccionar fecha…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora programación</label>
                <input value={data.hora_programacion} onChange={e => set('hora_programacion', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ marginTop: '1.25rem' }}>
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={handleConfirm} disabled={saving} className="btn-primary"
              style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Registrando…' : 'Confirmar y registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SubtareasTimeline({ subtareas, canWrite, canEdit, usuarios, usuariosConArea, onToggle, onEliminar, onAgregar, pedido, showSuccess, showError }) {
  const [descripcion, setDescripcion] = useState('')
  const [asignadoA, setAsignadoA] = useState('')
  const [sheetDiseno, setSheetDiseno] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  function handleAgregar() {
    if (!descripcion.trim()) return
    onAgregar(descripcion.trim(), asignadoA || null)
    setDescripcion(''); setAsignadoA('')
  }

  const completadas = subtareas.filter(s => s.completada).length
  const total = subtareas.length
  const progreso = total > 0 ? Math.round((completadas / total) * 100) : 0

  function esDiseno(userId) {
    return usuariosConArea.find(x => x.id === userId)?.area_equipo === 'Diseño'
  }

  async function handleRegistrarDiseno(data, subtarea) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escribir-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          hoja: 'diseno',
          data: [data.nombre_campana, data.fecha_pedido, data.hora_pedido, data.descripcion, data.fecha_entrega, data.hora_entrega, data.aclaraciones]
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Error al registrar')
      await supabase.from('subtareas').update({ registrado_sheet: true, registrado_sheet_at: new Date().toISOString() }).eq('id', subtarea.id)
      setSheetDiseno(null)
      setSuccessMsg('La tarea de diseño fue registrada en Google Sheets.')
    } catch (err) {
      showError(err.message || 'Error al registrar en Sheet')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {total > 0 && (
        <div className="subtareas-progreso">
          <div className="subtareas-progreso-header">
            <span className="subtareas-progreso-label">{completadas} de {total} completadas</span>
            <span className="subtareas-progreso-pct" style={{ color: progreso === 100 ? '#10B981' : 'var(--text-secondary)' }}>{progreso}%</span>
          </div>
          <div className="subtareas-progreso-bar">
            <div className="subtareas-progreso-fill" style={{ width: `${progreso}%`, background: progreso === 100 ? '#10B981' : 'var(--accent-primary)' }} />
          </div>
        </div>
      )}

      {subtareas.length === 0 && <p className="text-muted-sm">No hay subtareas.</p>}

      <div className="subtarea-list">
        {subtareas.map((s, i) => (
          <div key={s.id} className="subtarea-item">
            <div className="subtarea-timeline">
              <button onClick={() => onToggle(s.id, s.completada)}
                className="subtarea-check"
                style={{ border: `2px solid ${s.completada ? '#10B981' : 'var(--border-strong)'}`, background: s.completada ? '#10B981' : 'var(--bg-elevated)' }}>
                {s.completada && <Check size={10} color="#fff" strokeWidth={3} />}
              </button>
              {i < subtareas.length - 1 && <div className="subtarea-line" />}
            </div>
            <div className="subtarea-content" style={{ paddingBottom: i < subtareas.length - 1 ? '0.75rem' : 0 }}>
              <div className="flex items-start gap-2">
                <span className={`subtarea-text ${s.completada ? 'subtarea-text-done' : ''}`}>{s.descripcion}</span>
                {canEdit && (
                  <button onClick={() => onEliminar(s.id)}
                    className="flex items-center shrink-0 text-[var(--text-muted)]"
                    style={{ opacity: 0.5, transition: 'opacity 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {s.profiles && (
                <div className="subtarea-asignado">
                  <span className="avatar-xs-secondary">{s.profiles.full_name?.[0]?.toUpperCase()}</span>
                  <span className="subtarea-asignado-nombre">{s.profiles.full_name}</span>
                </div>
              )}
              {canEdit && s.asignado_a && esDiseno(s.asignado_a) && s.completada && (
                s.registrado_sheet ? (
                  <div className="flex items-center gap-1" style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#10B981' }}>
                    <Check size={12} strokeWidth={2.5} />
                    Registrado en Sheet
                    {s.registrado_sheet_at && ` · ${format(new Date(s.registrado_sheet_at), "d MMM HH:mm", { locale: es })}`}
                  </div>
                ) : (
                  <button onClick={() => setSheetDiseno(s)}
                    className="flex items-center gap-1"
                    style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--icomm-violet)', fontWeight: 500 }}>
                    <FileSpreadsheet size={13} />Registrar en Sheet
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="subtarea-add-form">
          <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAgregar()} placeholder="Nueva subtarea…" />
          <div className="subtarea-add-row">
            <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)} style={{ flex: 1, fontSize: '0.8125rem' }}>
              <option value="">Sin asignar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <button onClick={handleAgregar} className="btn-agregar-subtarea">
              <Plus size={15} />Agregar
            </button>
          </div>
        </div>
      )}

      {sheetDiseno && (
        <SheetDisenoModal
          pedido={pedido}
          subtarea={sheetDiseno}
          onClose={() => setSheetDiseno(null)}
          onConfirm={(data) => handleRegistrarDiseno(data, sheetDiseno)}
        />
      )}
      {successMsg && <SuccessModal message={successMsg} onClose={() => setSuccessMsg('')} />}
    </div>
  )
}

function EntregableItem({ ent, canWrite, isSuperAdmin, onUpdate, onEliminar }) {
  const [form, setForm] = useState({ nombre_pieza: ent.nombre_pieza ?? '', link_online: ent.link_online ?? '' })
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState(false)
  const bloqueado = ent.aprobado && !isSuperAdmin

  async function guardar() {
    setSaving(true)
    await supabase.from('entregable').update(form).eq('id', ent.id)
    setSaving(false); setEditando(false); onUpdate()
  }

  async function toggleAprobado() {
    await supabase.from('entregable').update({
      aprobado: !ent.aprobado,
      aprobado_at: !ent.aprobado ? new Date().toISOString() : null
    }).eq('id', ent.id)
    onUpdate()
  }

  return (
    <div className={`entregable-item ${ent.aprobado ? 'entregable-item-aprobado' : ''}`}>
      <div className="entregable-actions">
        {ent.aprobado && <span className="entregable-badge-aprobada">Aprobada</span>}
        <div style={{ flex: 1 }} />
        {canWrite && (
          <button onClick={toggleAprobado} title={ent.aprobado ? 'Desaprobar' : 'Aprobar'}
            className={`btn-aprobar ${ent.aprobado ? 'btn-aprobar-active' : ''}`}>
            {ent.aprobado ? <><Unlock size={12} />Desaprobar</> : <><Lock size={12} />Aprobar</>}
          </button>
        )}
        {!bloqueado && canWrite && !editando && (
          <button onClick={() => setEditando(true)} className="btn-editar-ent">Editar</button>
        )}
        {canWrite && (
          <button onClick={() => onEliminar(ent.id)}
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', opacity: 0.5, transition: 'opacity 150ms' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {editando && !bloqueado ? (
        <div className="entregable-edit-form">
          <input value={form.nombre_pieza} onChange={e => setForm(f => ({ ...f, nombre_pieza: e.target.value }))} placeholder="Nombre de la pieza" />
          <input value={form.link_online} onChange={e => setForm(f => ({ ...f, link_online: e.target.value }))} placeholder="https://…" />
          <div className="entregable-edit-actions">
            <button onClick={() => setEditando(false)} className="btn-secondary">Cancelar</button>
            <button onClick={guardar} disabled={saving} className="btn-primary" style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[0.375rem]">
          <div className="entregable-field-row">
            <span className="entregable-field-key">Pieza:</span>
            <span className="entregable-field-val">{ent.nombre_pieza}</span>
            <CopyBtn text={ent.nombre_pieza} />
          </div>
          {ent.link_online && (
            <div className="entregable-field-row">
              <span className="entregable-field-key">Link:</span>
              <span className="entregable-field-link">{ent.link_online}</span>
              <CopyBtn text={ent.link_online} />
              <a href={ent.link_online} target="_blank" rel="noopener" className="entregable-link-icon">
                <ExternalLink size={13} />
              </a>
            </div>
          )}
          {ent.aprobado && ent.aprobado_at && (
            <span className="entregable-aprobado-fecha">
              Aprobada el {format(new Date(ent.aprobado_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
            </span>
          )}
          {bloqueado && <span className="entregable-bloqueado-msg">Aprobada — para modificar generá una nueva versión</span>}
        </div>
      )}
    </div>
  )
}

function CopyAllBtn({ entregables }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    const texto = entregables.filter(e => e.nombre_pieza)
      .map(e => e.link_online ? `${e.nombre_pieza} || ${e.link_online}` : e.nombre_pieza).join('\n')
    navigator.clipboard.writeText(texto)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="entregables-copy-all"
      style={{ color: copied ? '#10B981' : 'var(--text-secondary)', border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, background: copied ? 'rgba(16,185,129,0.06)' : 'transparent' }}>
      {copied ? <><Check size={13} />¡Copiado!</> : <><Copy size={13} />Copiar todo</>}
    </button>
  )
}

function EntregablesSection({ pedidoId, entregables, canWrite, isSuperAdmin, onUpdate, setConfirm }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre_pieza: '', link_online: '' })
  const [saving, setSaving] = useState(false)

  async function agregar() {
    if (!form.nombre_pieza.trim()) return
    setSaving(true)
    await supabase.from('entregable').insert({ ...form, pedido_id: pedidoId })
    setForm({ nombre_pieza: '', link_online: '' }); setShowForm(false); setSaving(false); onUpdate()
  }

  function eliminar(id) {
    setConfirm({
      title: 'Eliminar pieza',
      message: '¿Querés eliminar esta pieza? Esta acción no se puede deshacer.',
      onConfirm: async () => { setConfirm(null); await supabase.from('entregable').delete().eq('id', id); onUpdate() }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {entregables.length === 0 && !showForm && <p className="text-muted-sm">No hay piezas cargadas.</p>}
      {entregables.map(ent => (
        <EntregableItem key={ent.id} ent={ent} canWrite={canWrite} isSuperAdmin={isSuperAdmin} onUpdate={onUpdate} onEliminar={eliminar} />
      ))}
      {showForm && (
        <div className="entregable-item">
          <input value={form.nombre_pieza} onChange={e => setForm(f => ({ ...f, nombre_pieza: e.target.value }))} placeholder="Nombre de la pieza *" autoFocus />
          <input value={form.link_online} onChange={e => setForm(f => ({ ...f, link_online: e.target.value }))} placeholder="Link versión online (opcional)" />
          <div className="entregable-edit-actions">
            <button onClick={() => { setShowForm(false); setForm({ nombre_pieza: '', link_online: '' }) }} className="btn-secondary">Cancelar</button>
            <button onClick={agregar} disabled={saving || !form.nombre_pieza.trim()}
              className="btn-primary" style={{ width: 'auto', opacity: saving || !form.nombre_pieza.trim() ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar pieza'}
            </button>
          </div>
        </div>
      )}
      {canWrite && !showForm && (
        <button onClick={() => setShowForm(true)} className="btn-add-dashed">
          <Plus size={14} />{entregables.length === 0 ? 'Cargar pieza' : 'Agregar otra pieza'}
        </button>
      )}
      {entregables.length > 1 && <CopyAllBtn entregables={entregables} />}
    </div>
  )
}

export default function PedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const backTo = state?.from ?? '/app/pedidos'
  const backLabel = backTo === '/app' ? 'Dashboard' : backTo === '/app/calendario' ? 'Calendario' : backTo === '/app/notificaciones' ? 'Notificaciones' : 'Pedidos'
  const { role, user } = useAuth()
  const { showSuccess, showError } = useNotificaciones()
  const { actualizarPedido, eliminarPedido } = usePedidos()
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [usuariosConArea, setUsuariosConArea] = useState([])
  const { estados } = useEstados()
  const { tipos } = useTipos()
  const { instancias } = useInstancias()
  const [showSheet, setShowSheet] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, area_equipo').order('full_name').then(({ data }) => {
      setUsuarios(data ?? [])
      setUsuariosConArea(data ?? [])
    })
  }, [])

  async function fetchPedido() {
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_asignados(user_id, profiles(id,full_name)), subtareas(*, profiles:asignado_a(full_name)), entregable(*)')
      .eq('id', id).single()
    setPedido(data); setLoading(false)
  }

  useEffect(() => { fetchPedido() }, [id])

  async function handleEdit(data) { await actualizarPedido(id, data); setEditando(false); fetchPedido() }

  function handleDelete() {
    setConfirm({
      title: 'Eliminar pedido',
      message: 'El pedido se moverá a la papelera y podrás restaurarlo desde ahí.',
      onConfirm: async () => { setConfirm(null); await eliminarPedido(id); navigate(backTo) }
    })
  }

  async function agregarSubtarea(descripcion, asignadoA) {
    await supabase.from('subtareas').insert({ pedido_id: id, descripcion, asignado_a: asignadoA })
    if (asignadoA && asignadoA !== user?.id) {
      await supabase.from('notificaciones').insert({
        user_id: asignadoA, pedido_id: id,
        mensaje: `Te asignaron una subtarea en "${pedido.asunto}": ${descripcion}`,
        leida: false
      })
    }
    fetchPedido()
  }

  async function toggleSubtarea(subId, completada) {
    await supabase.from('subtareas').update({
      completada: !completada,
      completada_at: !completada ? new Date().toISOString() : null
    }).eq('id', subId)
    fetchPedido()
  }

  async function eliminarSubtarea(subId) {
    await supabase.from('subtareas').delete().eq('id', subId); fetchPedido()
  }

  async function handleRegistrarSheet(data) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escribir-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          hoja: 'pedidos',
          data: [data.nombre_campana, data.fecha_pedido, data.hora_pedido, data.descripcion, data.instancia, data.fecha_aprobacion, data.hora_aprobacion, data.cantidad_envios, data.aclaraciones, data.dia_programacion, data.hora_programacion]
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Error al registrar en Sheet')
      setShowSheet(false)
      setSuccessMsg('El pedido fue registrado en Google Sheets correctamente.')
    } catch (err) {
      showError(err.message || 'Error al registrar en Sheet')
    }
  }

  if (loading) return <div className="loading-text">Cargando…</div>
  if (!pedido) return <div className="loading-text">Pedido no encontrado.</div>

  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const tipo = tipos.find(t => t.value === pedido.tipo)
  const estadosActivos = estados.filter(e => (pedido.estados ?? []).includes(e.value))
  const entregables = Array.isArray(pedido.entregable) ? pedido.entregable : pedido.entregable ? [pedido.entregable] : []
  const subtareas = pedido.subtareas ?? []
  const canEdit = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const canWrite = role !== ROLES.VIEWER
  const isSuperAdmin = role === ROLES.SUPER_ADMIN
  const subtareasCompletadas = subtareas.filter(s => s.completada).length

  return (
    <div className="detalle-root">
      <div className="detalle-topbar">
        <button onClick={() => navigate(backTo)} className="btn-back">
          <ArrowLeft size={16} />Volver a {backLabel}
        </button>
        {canEdit && (
          <div className="detalle-topbar-actions">
            <button onClick={() => setEditando(true)} className="btn-edit"><Edit size={15} />Editar</button>
            <button onClick={handleDelete} className="btn-delete"><Trash2 size={15} />Eliminar</button>
          </div>
        )}
      </div>

      <div className="detalle-header">
        <div className="detalle-meta-row">
          {prio && <Badge label={prio.label} color={prio.color} />}
          {tipo && <span className="detalle-tipo">{tipo.label}</span>}
          <span className="detalle-fecha">
            {format(new Date(pedido.created_at), "d 'de' MMMM yyyy", { locale: es })}
          </span>
        </div>
        <h1 className="detalle-title">{pedido.asunto}</h1>
        {pedido.descripcion && <p className="detalle-descripcion">{pedido.descripcion}</p>}
        <div className="detalle-estados-row">
          {estadosActivos.length === 0
            ? <span className="detalle-sin-estado">Sin estado asignado</span>
            : estadosActivos.map(e => <Badge key={e.value} label={e.label} color={e.color} />)
          }
          <EstadoPopover pedido={pedido} id={id} role={role} user={user} onUpdate={fetchPedido} estados={estados} />
        </div>
      </div>

      <div className="detalle-info-grid">
        <div className="info-card">
          <p className="info-card-label">Asignados</p>
          {pedido.pedido_asignados?.length === 0
            ? <p className="info-card-empty">Nadie asignado</p>
            : pedido.pedido_asignados?.map(a => (
              <div key={a.user_id} className="asignado-row">
                <span className="avatar-sm">{a.profiles?.full_name?.[0]?.toUpperCase()}</span>
                {a.profiles?.full_name}
              </div>
            ))
          }
        </div>
        {pedido.fecha_limite && (
          <div className="info-card">
            <p className="info-card-label">Fecha límite</p>
            <p className="info-card-value">
              {format(new Date(pedido.fecha_limite + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
        )}
        {pedido.tags?.length > 0 && (
          <div className="info-card">
            <p className="info-card-label">Tags</p>
            <div className="flex flex-wrap gap-[0.375rem]">
              {pedido.tags.map(t => <span key={t} className="tag-item">{t}</span>)}
            </div>
          </div>
        )}
        {pedido.instancia && (
          <div className="info-card">
            <p className="info-card-label">Instancia</p>
            {(() => {
              const inst = instancias.find(i => i.value === pedido.instancia)
              return inst
                ? <div style={{ display: 'inline-flex' }}><Badge label={inst.label} color={inst.color} size="sm" /></div>
                : <p className="info-card-value">{pedido.instancia}</p>
            })()}
          </div>
        )}
        {pedido.tipo_envio && (
          <div className="info-card">
            <p className="info-card-label">Tipo de envío</p>
            <p className="info-card-value">
              {pedido.tipo_envio === 'otro' ? pedido.tipo_envio_otro || 'Otro' : pedido.tipo_envio === 'test' ? 'Test' : 'Real'}
            </p>
          </div>
        )}
        {pedido.cantidad_envios != null && (
          <div className="info-card">
            <p className="info-card-label">Cantidad de envíos</p>
            <p className="info-card-value">{pedido.cantidad_envios}</p>
          </div>
        )}
        {(pedido.fecha_programacion || pedido.hora_programacion) && (
          <div className="info-card">
            <p className="info-card-label">Programación</p>
            <p className="info-card-value">
              {pedido.fecha_programacion && format(new Date(pedido.fecha_programacion + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}
              {pedido.hora_programacion && ` a las ${pedido.hora_programacion}`}
            </p>
          </div>
        )}
      </div>

      <Section title="Subtareas" defaultOpen={true}
        badge={subtareas.length > 0 ? `${subtareasCompletadas}/${subtareas.length}` : null}>
        <SubtareasTimeline
          subtareas={subtareas} canWrite={canWrite} canEdit={canEdit}
          usuarios={usuarios} usuariosConArea={usuariosConArea}
          onToggle={toggleSubtarea} onEliminar={eliminarSubtarea} onAgregar={agregarSubtarea}
          pedido={pedido}
          showSuccess={showSuccess}
          showError={showError}
        />
      </Section>

      <Section title="Piezas entregables" defaultOpen={true}
        badge={entregables.length > 0 ? entregables.length : null}>
        <EntregablesSection pedidoId={id} entregables={entregables} canWrite={canWrite}
          isSuperAdmin={isSuperAdmin} onUpdate={fetchPedido} setConfirm={setConfirm} />
      </Section>

      <Section title="Historial de actividad" icon={<Clock size={15} />} defaultOpen={false}>
        <Historial pedidoId={id} />
      </Section>

      {canEdit && pedido.estados?.includes('finalizado') && (
        <div className="flex justify-end">
          <button onClick={() => setShowSheet(true)}
            className="btn-primary flex items-center gap-2" style={{ width: 'auto' }}>
            <FileSpreadsheet size={16} />Registrar en Sheet
          </button>
        </div>
      )}

      {editando && <PedidoForm pedido={pedido} onSave={handleEdit} onCancel={() => setEditando(false)} />}

      {showSheet && (
        <SheetModal
          pedido={pedido}
          entregables={entregables}
          onClose={() => setShowSheet(false)}
          onConfirm={handleRegistrarSheet}
        />
      )}

      {successMsg && <SuccessModal message={successMsg} onClose={() => setSuccessMsg('')} />}

      {confirm && (
        <ConfirmModal open={true} title={confirm.title} message={confirm.message}
          confirmLabel="Eliminar" variant="danger"
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}
    </div>
  )
}