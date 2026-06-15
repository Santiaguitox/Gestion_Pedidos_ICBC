import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PRIORIDADES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { X, Check } from 'lucide-react'
import { DatePicker } from '@/components/ui/DatePicker'

export default function PedidoForm({ pedido, onSave, onCancel }) {
  const isEdit = !!pedido
  const [form, setForm] = useState({
    asunto:       pedido?.asunto ?? '',
    descripcion:  pedido?.descripcion ?? '',
    prioridad:    pedido?.prioridad ?? '',
    tipo:         pedido?.tipo ?? '',
    fecha_limite: pedido?.fecha_limite ?? '',
    tags:         pedido?.tags ?? [],
    estados:      pedido?.estados ?? [],
    asignados:    pedido?.pedido_asignados?.map(a => a.user_id) ?? [],
  })
  const [usuarios, setUsuarios] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const { estados } = useEstados()
  const { tipos } = useTipos()
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

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t])
    setTagInput('')
  }

  // Inactivo: solo color de texto. Activo: fondo + borde coloreado
  function chipStyle(color, active) {
    if (active) return { color, borderColor: `${color}60`, background: `${color}20` }
    return { color }
  }

  // Label con check cuando el campo tiene valor
  function FieldLabel({ children, done }) {
    return (
      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {children}
        {done && <Check size={12} style={{ color: '#10B981', strokeWidth: 2.5 }} />}
      </label>
    )
  }

  return (
    <div className="modal-overlay">
      <div className="modal">

        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Editar pedido' : 'Nuevo pedido'}</h2>
          <button onClick={onCancel} className="modal-close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">

          {/* Asunto */}
          <div className="field">
            <FieldLabel done={!!form.asunto.trim()}>
              Asunto / origen del mail <span style={{ color: 'var(--icbc-red)' }}>*</span>
            </FieldLabel>
            <input value={form.asunto} onChange={e => set('asunto', e.target.value)}
              placeholder="Ej: Campaña Día del Padre - ICBC" />
          </div>

          {/* Descripción */}
          <div className="field">
            <FieldLabel done={!!form.descripcion.trim()}>
              Descripción <span className="field-label-optional">opcional</span>
            </FieldLabel>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              rows={3} placeholder="Detalles del pedido…" />
          </div>

          <div className="form-divider" />

          <div className="field">
            <FieldLabel done={!!form.tipo}>Tipo</FieldLabel>
            <div className="chip-group">
              {tipos.map(t => (
                <button key={t.value} type="button"
                  onClick={() => set('tipo', form.tipo === t.value ? '' : t.value)}
                  className="chip"
                  style={chipStyle(t.color, form.tipo === t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-divider" />

          <div className="field">
            <FieldLabel done={!!form.prioridad}>Prioridad</FieldLabel>
            <div className="chip-group">
              {PRIORIDADES.map(p => (
                <button key={p.value} type="button"
                  onClick={() => set('prioridad', form.prioridad === p.value ? '' : p.value)}
                  className="chip"
                  style={chipStyle(p.color, form.prioridad === p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-divider" />

          <div className="field">
            <FieldLabel done={form.estados.length > 0}>Estado inicial</FieldLabel>
            <div className="chip-group">
              {estados.map(e => {
                const active = form.estados.includes(e.value)
                return (
                  <button key={e.value} type="button"
                    onClick={() => set('estados', active
                      ? form.estados.filter(x => x !== e.value)
                      : [...form.estados, e.value]
                    )}
                    className="chip"
                    style={chipStyle(e.color, active)}>
                    {e.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-divider" />

          {/* Fecha límite */}
          <div className="field">
            <FieldLabel done={!!form.fecha_limite}>
              Fecha límite <span className="field-label-optional">opcional</span>
            </FieldLabel>
            <DatePicker value={form.fecha_limite} onChange={val => set('fecha_limite', val)} />
          </div>

          <div className="form-divider" />

          {/* Asignar a */}
          <div className="field">
            <FieldLabel done={form.asignados.length > 0}>Asignar a</FieldLabel>
            <div className="chip-group">
              {usuarios.map(u => {
                const active = form.asignados.includes(u.id)
                return (
                  <button key={u.id} type="button"
                    onClick={() => set('asignados', active
                      ? form.asignados.filter(x => x !== u.id)
                      : [...form.asignados, u.id]
                    )}
                    className="chip"
                    style={active ? { background: 'rgba(208,17,27,0.1)', borderColor: 'rgba(208,17,27,0.4)', color: 'var(--icbc-red)' } : {}}>
                    <span className="avatar-xs">{u.full_name?.[0]?.toUpperCase()}</span>
                    {u.full_name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-divider" />

          {/* Tags */}
          <div className="field">
            <FieldLabel done={form.tags.length > 0}>
              Tags <span className="field-label-optional">opcional</span>
            </FieldLabel>
            <div className="tag-input-row">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Escribí y presioná Enter…" />
              <button type="button" onClick={addTag} className="btn-add-tag">+</button>
            </div>
            {form.tags.length > 0 && (
              <div className="tag-list">
                {form.tags.map(t => (
                  <span key={t} className="tag-item">
                    {t}
                    <button type="button" onClick={() => set('tags', form.tags.filter(x => x !== t))}
                      className="tag-item-remove">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="msg-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary"
              style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear pedido'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}