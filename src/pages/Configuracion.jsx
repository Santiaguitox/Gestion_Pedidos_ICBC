import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { Plus, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

const COLORES_SUGERIDOS = [
  '#8B5CF6','#3B82F6','#F59E0B','#EC4899','#10B981','#059669',
  '#EF4444','#F97316','#6B7280','#0EA5E9','#D0111B','#5B4EE8',
]

function ColorPicker({ value, onChange }) {
  const [custom, setCustom] = useState(false)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
      <div style={{ display:'flex', gap:'0.375rem', flexWrap:'wrap' }}>
        {COLORES_SUGERIDOS.map(c => (
          <button key={c} onClick={() => { onChange(c); setCustom(false) }}
            style={{ width:'24px', height:'24px', borderRadius:'50%', background:c, border: value === c ? '2px solid var(--text-primary)' : '2px solid transparent', transition:'border 150ms', flexShrink:0 }} />
        ))}
        <button onClick={() => setCustom(v => !v)}
          style={{ width:'24px', height:'24px', borderRadius:'50%', background: COLORES_SUGERIDOS.includes(value) ? 'var(--bg-hover)' : value, border:'1px dashed var(--border)', fontSize:'0.6rem', color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {COLORES_SUGERIDOS.includes(value) ? '+' : ''}
        </button>
      </div>
      {custom && (
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            style={{ width:'36px', height:'36px', padding:'2px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', cursor:'pointer' }} />
          <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{value}</span>
        </div>
      )}
    </div>
  )
}

// ─── Row reutilizable para estados y tipos ────────────────────────────────────

function ItemRow({ item, tabla, onSave, onDelete }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ label: item.label, color: item.color })
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!form.label.trim()) return
    setSaving(true)
    await supabase.from(tabla).update({ label: form.label.trim(), color: form.color }).eq('id', item.id)
    setSaving(false)
    setEditando(false)
    onSave()
  }

  function cancelar() {
    setForm({ label: item.label, color: item.color })
    setEditando(false)
  }

  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0.875rem 1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
      {editando ? (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div style={{ width:'12px', height:'12px', borderRadius:'50%', background:form.color, flexShrink:0 }} />
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              style={{ flex:1, fontSize:'0.875rem' }} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') cancelar() }} />
            <button onClick={guardar} disabled={saving}
              style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.8125rem', fontWeight:600, padding:'0.3rem 0.75rem', borderRadius:'var(--radius-sm)', background:'var(--accent-primary)', color:'#fff', opacity: saving ? 0.6 : 1 }}>
              <Check size={13} />Guardar
            </button>
            <button onClick={cancelar} style={{ display:'flex', alignItems:'center', color:'var(--text-muted)', padding:'0.3rem' }}>
              <X size={15} />
            </button>
          </div>
          <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
        </>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <div style={{ width:'12px', height:'12px', borderRadius:'50%', background:item.color, flexShrink:0 }} />
          <span style={{ flex:1, fontSize:'0.875rem', fontWeight:500 }}>{item.label}</span>
          <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontFamily:'monospace' }}>{item.color}</span>
          <button onClick={() => setEditando(true)}
            style={{ fontSize:'0.75rem', color:'var(--text-muted)', padding:'0.2rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
            Editar
          </button>
          <button onClick={() => onDelete(item.id)}
            style={{ color:'var(--text-muted)', display:'flex', alignItems:'center', opacity:0.5, transition:'opacity 150ms' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sección genérica colapsable ──────────────────────────────────────────────

function SeccionConfig({ titulo, descripcion, items, tabla, loading, refetch, nombreItem, defaultColor = '#6B7280' }) {
  const [open, setOpen] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ value:'', label:'', color: defaultColor })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function agregar() {
    setError('')
    if (!form.label.trim() || !form.value.trim()) { setError('Completá nombre y clave.'); return }
    setSaving(true)
    const { error: err } = await supabase.from(tabla).insert({
      value: form.value.trim().toLowerCase().replace(/\s+/g, '_'),
      label: form.label.trim(),
      color: form.color,
      orden: items.length,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setForm({ value:'', label:'', color: defaultColor })
    setShowForm(false)
    setSaving(false)
    refetch()
  }

  async function eliminar(id) {
    if (!confirm(`¿Eliminar este ${nombreItem.toLowerCase()}? Los pedidos que lo tengan asignado lo perderán.`)) return
    await supabase.from(tabla).delete().eq('id', id)
    refetch()
  }

  function handleLabel(val) {
    setForm(f => ({
      ...f,
      label: val,
      value: val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    }))
  }

  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', cursor:'pointer', userSelect:'none' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'0.9375rem', fontWeight:600 }}>{titulo}</h2>
          {descripcion && <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.125rem' }}>{descripcion}</p>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
          <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{items.length} {nombreItem.toLowerCase()}{items.length !== 1 ? 's' : ''}</span>
          {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
        </div>
      </div>

      {open && (
        <div style={{ padding:'0 1.25rem 1.25rem', display:'flex', flexDirection:'column', gap:'1rem', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:'0.75rem' }}>
            <button onClick={() => { setShowForm(v => !v); setError('') }}
              style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', fontWeight:600, padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', background:'var(--accent-primary)', color:'#fff' }}>
              <Plus size={14} />Nuevo {nombreItem.toLowerCase()}
            </button>
          </div>

          {showForm && (
            <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              <div style={{ display:'flex', gap:'0.625rem' }}>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                  <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Nombre <span style={{ color:'var(--icbc-red)' }}>*</span></label>
                  <input value={form.label} onChange={e => handleLabel(e.target.value)} placeholder={`Ej: Nuevo ${nombreItem.toLowerCase()}`} autoFocus />
                </div>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                  <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Clave interna <span style={{ color:'var(--icbc-red)' }}>*</span></label>
                  <input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="clave_interna" />
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Color</label>
                <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
              </div>
              {error && <p style={{ fontSize:'0.8125rem', color:'var(--icbc-red)' }}>{error}</p>}
              <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
                <button onClick={() => { setShowForm(false); setError('') }}
                  style={{ fontSize:'0.8125rem', padding:'0.375rem 0.75rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', color:'var(--text-secondary)' }}>Cancelar</button>
                <button onClick={agregar} disabled={saving}
                  style={{ fontSize:'0.8125rem', fontWeight:600, padding:'0.375rem 0.875rem', borderRadius:'var(--radius-sm)', background:'var(--accent-primary)', color:'#fff', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Guardando…' : `Guardar ${nombreItem.toLowerCase()}`}
                </button>
              </div>
            </div>
          )}

          {loading && <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>Cargando…</p>}
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {items.map(item => (
              <ItemRow key={item.id} item={item} tabla={tabla} onSave={refetch} onDelete={eliminar} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Configuracion() {
  const { estados, loading: loadingEstados, refetch: refetchEstados } = useEstados()
  const { tipos, loading: loadingTipos, refetch: refetchTipos } = useTipos()

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', maxWidth:'600px' }}>
      <div>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Configuración</h1>
        <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:'0.125rem' }}>Gestioná los estados y tipos disponibles para los pedidos</p>
      </div>

      <SeccionConfig
        titulo="Estados de pedidos"
        descripcion="Estados que se pueden asignar a un pedido"
        items={estados}
        tabla="estados"
        loading={loadingEstados}
        refetch={refetchEstados}
        nombreItem="Estado"
        defaultColor="#6B7280"
      />

      <SeccionConfig
        titulo="Tipos de pedido"
        descripcion="Tipos disponibles al crear un pedido"
        items={tipos}
        tabla="tipos"
        loading={loadingTipos}
        refetch={refetchTipos}
        nombreItem="Tipo"
        defaultColor="#6B7280"
      />
    </div>
  )
}