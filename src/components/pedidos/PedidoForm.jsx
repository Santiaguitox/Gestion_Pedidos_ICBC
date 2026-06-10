import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PRIORIDADES, TIPOS, ESTADOS } from '@/lib/constants'
import { X } from 'lucide-react'
import { DatePicker } from '@/components/ui/DatePicker'

export default function PedidoForm({ pedido, onSave, onCancel }) {
  const isEdit = !!pedido
  const [form, setForm] = useState({
    asunto: pedido?.asunto ?? '', descripcion: pedido?.descripcion ?? '',
    prioridad: pedido?.prioridad ?? 'media', tipo: pedido?.tipo ?? 'creacion_email',
    fecha_limite: pedido?.fecha_limite ?? '', tags: pedido?.tags ?? [],
    estados: pedido?.estados ?? [], asignados: pedido?.pedido_asignados?.map(a => a.user_id) ?? [],
  })
  const [usuarios, setUsuarios] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,role').then(({ data }) => setUsuarios(data ?? []))
  }, [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.asunto.trim()) { setError('El asunto es obligatorio.'); return }
    setSaving(true); setError('')
    try { await onSave(form) } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const overlayStyle = { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }
  const modalStyle = { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-xl)', width:'100%', maxWidth:'560px', maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--shadow-lg)' }
  const fieldStyle = { display:'flex', flexDirection:'column', gap:'0.375rem' }
  const labelStyle = { fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }
  const chipBase = { display:'inline-flex', alignItems:'center', gap:'0.375rem', padding:'0.3rem 0.75rem', borderRadius:'99px', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:'0.8125rem', fontWeight:500, cursor:'pointer', background:'transparent' }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1.5rem', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--bg-surface)', zIndex:1 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.125rem', fontWeight:700 }}>{isEdit ? 'Editar pedido' : 'Nuevo pedido'}</h2>
          <button onClick={onCancel} style={{ color:'var(--text-muted)', display:'flex', alignItems:'center', padding:'0.25rem', borderRadius:'var(--radius-sm)' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Asunto / origen del mail <span style={{ color:'var(--icbc-red)' }}>*</span></label>
            <input value={form.asunto} onChange={e => set('asunto', e.target.value)} placeholder="Ej: Campaña Día del Padre - ICBC" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Descripción <span style={{ color:'var(--text-muted)', fontWeight:400, fontSize:'0.75rem' }}>opcional</span></label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} placeholder="Detalles del pedido…" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Prioridad</label>
              <select value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Fecha límite <span style={{ color:'var(--text-muted)', fontWeight:400, fontSize:'0.75rem' }}>opcional</span></label>
            <DatePicker value={form.fecha_limite} onChange={val => set('fecha_limite', val)} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Estados activos</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem' }}>
              {ESTADOS.map(e => {
                const active = form.estados.includes(e.value)
                return (
                  <button key={e.value} type="button" onClick={() => set('estados', active ? form.estados.filter(x => x !== e.value) : [...form.estados, e.value])}
                    style={{ ...chipBase, ...(active ? { background:`${e.color}20`, borderColor:`${e.color}60`, color:e.color } : {}) }}>
                    {e.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Asignar a</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem' }}>
              {usuarios.map(u => {
                const active = form.asignados.includes(u.id)
                return (
                  <button key={u.id} type="button" onClick={() => set('asignados', active ? form.asignados.filter(x => x !== u.id) : [...form.asignados, u.id])}
                    style={{ ...chipBase, ...(active ? { background:'rgba(208,17,27,0.1)', borderColor:'rgba(208,17,27,0.4)', color:'var(--icbc-red)' } : {}) }}>
                    <span style={{ width:'18px', height:'18px', borderRadius:'50%', background:'var(--accent-primary)', color:'#fff', fontSize:'0.625rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{u.full_name?.[0]?.toUpperCase()}</span>
                    {u.full_name}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Tags <span style={{ color:'var(--text-muted)', fontWeight:400, fontSize:'0.75rem' }}>opcional</span></label>
            <div style={{ display:'flex', gap:'0.5rem' }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); const t=tagInput.trim(); if(t&&!form.tags.includes(t)) set('tags',[...form.tags,t]); setTagInput('') }}} placeholder="Escribí y presioná Enter…" />
              <button type="button" onClick={() => { const t=tagInput.trim(); if(t&&!form.tags.includes(t)) set('tags',[...form.tags,t]); setTagInput('') }} style={{ background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', width:'36px', fontSize:'1.2rem' }}>+</button>
            </div>
            {form.tags.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.375rem', marginTop:'0.375rem' }}>
                {form.tags.map(t => (
                  <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', background:'var(--badge-bg)', border:'1px solid var(--badge-border)', color:'var(--accent-secondary)', fontSize:'0.75rem', padding:'0.15rem 0.5rem', borderRadius:'99px' }}>
                    {t}<button type="button" onClick={() => set('tags', form.tags.filter(x=>x!==t))} style={{ color:'inherit', opacity:0.6, fontSize:'0.875rem', lineHeight:1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {error && <p style={{ fontSize:'0.8125rem', color:'var(--icbc-red)', background:'rgba(208,17,27,0.08)', border:'1px solid rgba(208,17,27,0.2)', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-sm)' }}>{error}</p>}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.75rem', paddingTop:'0.5rem', borderTop:'1px solid var(--border)' }}>
            <button type="button" onClick={onCancel} style={{ padding:'0.5rem 1.25rem', borderRadius:'var(--radius-md)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:'0.875rem', fontWeight:500 }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ padding:'0.5rem 1.25rem', borderRadius:'var(--radius-md)', background:'var(--accent-primary)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.875rem', opacity: saving ? 0.6 : 1 }}>{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear pedido'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
