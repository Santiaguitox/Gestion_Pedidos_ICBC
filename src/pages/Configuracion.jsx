import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { useInstancias } from '@/hooks/useInstancias'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { Plus, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useLocalStorage } from '@/hooks/useLocalStorage'

const COLORES_SUGERIDOS = [
  '#8B5CF6','#3B82F6','#F59E0B','#EC4899','#10B981','#059669',
  '#EF4444','#F97316','#6B7280','#0EA5E9','#D0111B','#5B4EE8',
]

function ColorPicker({ value, onChange }) {
  const [custom, setCustom] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <div className="color-swatches">
        {COLORES_SUGERIDOS.map(c => (
          <button key={c} onClick={() => { onChange(c); setCustom(false) }}
            className="color-swatch"
            style={{ background: c, border: value === c ? '2px solid var(--text-primary)' : '2px solid transparent' }} />
        ))}
        <button onClick={() => setCustom(v => !v)}
          className="color-swatch-custom"
          style={{ background: COLORES_SUGERIDOS.includes(value) ? 'var(--bg-hover)' : value }}>
          {COLORES_SUGERIDOS.includes(value) ? '+' : ''}
        </button>
      </div>
      {custom && (
        <div className="color-input-row">
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="color-input-native" />
          <span className="text-muted-sm" style={{ fontFamily: 'monospace' }}>{value}</span>
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, tabla, onSave, onDelete, showSuccess, showError }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ label: item.label, color: item.color })
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!form.label.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from(tabla).update({ label: form.label.trim(), color: form.color }).eq('id', item.id)
      if (error) throw error
      setEditando(false)
      onSave()
      showSuccess('Cambios guardados')
    } catch (err) {
      showError(err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  function cancelar() { setForm({ label: item.label, color: item.color }); setEditando(false) }

  return (
    <div className="panel" style={{ padding: '0.875rem 1rem' }}>
      {editando ? (
        <div className="flex flex-col gap-3">
          <div className="config-item-row">
            <div className="config-color-dot" style={{ background: form.color }} />
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              style={{ flex: 1, fontSize: '0.875rem' }} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') cancelar() }} />
            <button onClick={guardar} disabled={saving} className="btn-primary"
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', opacity: saving ? 0.6 : 1 }}>
              <Check size={13} />Guardar
            </button>
            <button onClick={cancelar} className="modal-close"><X size={15} /></button>
          </div>
          <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
        </div>
      ) : (
        <div className="config-item-row">
          <div className="config-color-dot" style={{ background: item.color }} />
          <span className="config-item-label">{item.label}</span>
          <span className="config-item-hex">{item.color}</span>
          <button onClick={() => setEditando(true)} className="btn-editar-ent">Editar</button>
          <button onClick={() => onDelete(item.id)}
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', opacity: 0.5, transition: 'opacity 150ms' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function SeccionConfig({ titulo, descripcion, items, tabla, loading, refetch, nombreItem, storageKey, defaultColor = '#6B7280' }) {
  const [open, setOpen] = useLocalStorage(storageKey, true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ value: '', label: '', color: defaultColor })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const { showSuccess, showError } = useNotificaciones()

  async function agregar() {
    setError('')
    if (!form.label.trim() || !form.value.trim()) { setError('Completá nombre y clave.'); return }
    setSaving(true)
    try {
      const { error: err } = await supabase.from(tabla).insert({
        value: form.value.trim().toLowerCase().replace(/\s+/g, '_'),
        label: form.label.trim(), color: form.color, orden: items.length,
      })
      if (err) throw err
      setForm({ value: '', label: '', color: defaultColor })
      setShowForm(false)
      refetch()
      showSuccess(`${nombreItem} creado correctamente`)
    } catch (err) {
      setError(err.message)
      showError(err.message || `No se pudo crear el ${nombreItem.toLowerCase()}`)
    } finally {
      setSaving(false)
    }
  }

  function eliminar(id) { setConfirmEliminar(id) }

  async function confirmarEliminar() {
    try {
      const { error } = await supabase.from(tabla).delete().eq('id', confirmEliminar)
      if (error) throw error
      setConfirmEliminar(null)
      refetch()
      showSuccess(`${nombreItem} eliminado`)
    } catch (err) {
      setConfirmEliminar(null)
      showError(err.message || `No se pudo eliminar el ${nombreItem.toLowerCase()}`)
    }
  }

  function handleLabel(val) {
    setForm(f => ({
      ...f, label: val,
      value: val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    }))
  }

  return (
    <>
      <div className="config-section">
        <div className="config-section-header" onClick={() => setOpen(v => !v)}>
          <div>
            <h2 className="config-section-title">{titulo}</h2>
            {descripcion && <p className="config-section-desc">{descripcion}</p>}
          </div>
          <div className="flex items-center gap-[0.625rem]">
            <span className="text-muted-sm">{items.length} {nombreItem.toLowerCase()}{items.length !== 1 ? 's' : ''}</span>
            {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
          </div>
        </div>

        {open && (
          <div className="config-section-body">
            <div className="config-section-toolbar">
              <button onClick={() => { setShowForm(v => !v); setError('') }} className="btn-header-action">
                <Plus size={14} />Nuevo {nombreItem.toLowerCase()}
              </button>
            </div>

            {showForm && (
              <div className="config-add-form">
                <div className="field-grid-2">
                  <div className="field">
                    <label className="field-label">Nombre <span style={{ color: 'var(--icbc-red)' }}>*</span></label>
                    <input value={form.label} onChange={e => handleLabel(e.target.value)}
                      placeholder={`Ej: Nuevo ${nombreItem.toLowerCase()}`} autoFocus />
                  </div>
                  <div className="field">
                    <label className="field-label">Clave interna <span style={{ color: 'var(--icbc-red)' }}>*</span></label>
                    <input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="clave_interna" />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Color</label>
                  <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
                </div>
                {error && <p className="msg-error">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowForm(false); setError('') }} className="btn-secondary">Cancelar</button>
                  <button onClick={agregar} disabled={saving} className="btn-primary"
                    style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Guardando…' : `Guardar ${nombreItem.toLowerCase()}`}
                  </button>
                </div>
              </div>
            )}

            {loading && <p className="text-muted-sm">Cargando…</p>}
            <div className="flex flex-col gap-2">
              {items.map(item => (
                <ItemRow
                  key={item.id} item={item} tabla={tabla}
                  onSave={refetch} onDelete={eliminar}
                  showSuccess={showSuccess} showError={showError}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmEliminar && (
        <ConfirmModal
          open={true}
          title={`¿Eliminar este ${nombreItem.toLowerCase()}?`}
          message="Los pedidos que lo tengan asignado lo perderán."
          onConfirm={confirmarEliminar}
          onCancel={() => setConfirmEliminar(null)}
        />
      )}
    </>
  )
}

export default function Configuracion() {
  useDocumentTitle('Configuración')

  const { estados, loading: loadingEstados, refetch: refetchEstados } = useEstados()
  const { tipos, loading: loadingTipos, refetch: refetchTipos } = useTipos()
  const { instancias, loading: loadingInstancias, refetch: refetchInstancias } = useInstancias()

  return (
    <div className="page-root" style={{ maxWidth: '600px' }}>
      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">Gestioná los estados, tipos e instancias disponibles para los pedidos</p>
      </div>
      <SeccionConfig titulo="Estados de pedidos" descripcion="Estados que se pueden asignar a un pedido" items={estados} tabla="estados" loading={loadingEstados} refetch={refetchEstados} nombreItem="Estado" storageKey="config:estadosOpen" defaultColor="#6B7280" />
      <SeccionConfig titulo="Tipos de pedido" descripcion="Tipos disponibles al crear un pedido" items={tipos} tabla="tipos" loading={loadingTipos} refetch={refetchTipos} nombreItem="Tipo" storageKey="config:tiposOpen" defaultColor="#6B7280" />
      <SeccionConfig titulo="Instancias" descripcion="Plataformas de envío disponibles" items={instancias} tabla="instancias" loading={loadingInstancias} refetch={refetchInstancias} nombreItem="Instancia" storageKey="config:instanciasOpen" defaultColor="#6B7280" />
    </div>
  )
}