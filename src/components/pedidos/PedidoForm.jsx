import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { PRIORIDADES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { useInstancias } from '@/hooks/useInstancias'
import { X, Check } from 'lucide-react'
import { DatePicker } from '@/components/ui/DatePicker'

const TIPOS_ENVIO = [
  { value: 'test', label: 'Test' },
  { value: 'real', label: 'Real' },
  { value: 'otro', label: 'Otro' },
]

export default function PedidoForm({ pedido, onSave, onCancel }) {
  const isEdit = !!pedido
  const { showSuccess, showError } = useNotificaciones()
  const [form, setForm] = useState({
    asunto:             pedido?.asunto ?? '',
    descripcion:        pedido?.descripcion ?? '',
    prioridad:          pedido?.prioridad ?? '',
    tipo:               pedido?.tipo ?? '',
    fecha_limite:       pedido?.fecha_limite ?? '',
    tags:               pedido?.tags ?? [],
    estados:            pedido?.estados ?? [],
    asignados:          pedido?.pedido_asignados?.map(a => a.user_id) ?? [],
    instancia:          pedido?.instancia ?? '',
    tipo_envio:         pedido?.tipo_envio ?? '',
    tipo_envio_otro:    pedido?.tipo_envio_otro ?? '',
    cantidad_envios:    pedido?.cantidad_envios ?? '',
    fecha_programacion: pedido?.fecha_programacion ?? '',
    hora_programacion:  pedido?.hora_programacion ?? '',
  })
  const [usuarios, setUsuarios] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const { estados } = useEstados()
  const { tipos } = useTipos()
  const { instancias } = useInstancias()
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id,full_name,role').then(({ data }) => setUsuarios(data ?? []))
  }, [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.asunto.trim()) { setError('El asunto es obligatorio.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      showSuccess(isEdit ? 'Pedido actualizado correctamente' : 'Pedido creado correctamente')
    } catch (err) {
      setError(err.message)
      showError(err.message || 'No se pudo guardar el pedido')
    } finally {
      setSaving(false)
    }
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t])
    setTagInput('')
  }

  function chipStyle(color, active) {
    if (active) return { color, borderColor: `${color}60`, background: `${color}20` }
    return { color }
  }

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

          <div className="field">
            <FieldLabel done={!!form.asunto.trim()}>
              Asunto / origen del mail <span style={{ color: 'var(--icbc-red)' }}>*</span>
            </FieldLabel>
            <input value={form.asunto} onChange={e => set('asunto', e.target.value)}
              placeholder="Ej: Campaña Día del Padre - ICBC" />
          </div>

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
                  className="chip" style={chipStyle(t.color, form.tipo === t.value)}>
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
                  className="chip" style={chipStyle(p.color, form.prioridad === p.value)}>
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
                    className="chip" style={chipStyle(e.color, active)}>
                    {e.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-divider" />

          <div className="field">
            <FieldLabel done={!!form.instancia}>
              Instancia <span className="field-label-optional">opcional</span>
            </FieldLabel>
            <div className="chip-group">
              {instancias.map(i => (
                <button key={i.value} type="button"
                  onClick={() => set('instancia', form.instancia === i.value ? '' : i.value)}
                  className="chip" style={chipStyle(i.color, form.instancia === i.value)}>
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-divider" />

          <div className="field">
            <FieldLabel done={!!form.tipo_envio}>
              Tipo de envío <span className="field-label-optional">opcional</span>
            </FieldLabel>
            <div className="chip-group">
              {TIPOS_ENVIO.map(t => (
                <button key={t.value} type="button"
                  onClick={() => set('tipo_envio', form.tipo_envio === t.value ? '' : t.value)}
                  className="chip"
                  style={form.tipo_envio === t.value ? { background: 'rgba(91,78,232,0.1)', borderColor: 'rgba(91,78,232,0.4)', color: 'var(--icomm-violet)' } : {}}>
                  {t.label}
                </button>
              ))}
            </div>
            {form.tipo_envio === 'otro' && (
              <input value={form.tipo_envio_otro}
                onChange={e => set('tipo_envio_otro', e.target.value)}
                placeholder="Especificá el tipo de envío…"
                style={{ marginTop: '0.5rem' }} />
            )}
          </div>

          <div className="form-divider" />

          <div className="field">
            <FieldLabel done={!!form.fecha_limite}>
              Fecha límite <span className="field-label-optional">opcional</span>
            </FieldLabel>
            <DatePicker value={form.fecha_limite} onChange={val => set('fecha_limite', val)} />
          </div>

          <div className="form-divider" />

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