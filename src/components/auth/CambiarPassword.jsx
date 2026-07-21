import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useNotificaciones } from '@/context/useNotificaciones'
import { X, Lock, Eye, EyeOff } from 'lucide-react'

export default function CambiarPassword({ onClose }) {
  const { showSuccess, showError } = useNotificaciones()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password })
      if (error) throw error
      showSuccess('Contraseña actualizada correctamente')
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contraseña')
      showError(err.message || 'No se pudo actualizar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <h2 className="modal-title">Cambiar contraseña</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">

          <div className="field">
            <label className="field-label">Nueva contraseña</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={15} /></span>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="input-icon-both"
                autoFocus
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="input-action">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Confirmar contraseña</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={15} /></span>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.confirm}
                onChange={e => set('confirm', e.target.value)}
                placeholder="Repetí la contraseña"
                className="input-icon-left"
              />
            </div>
          </div>

          {error && 
          <div className="field">
            <div className="input-wrapper">
              <p className="msg-error pb-5">{error}</p>
            </div>
          </div>
          }

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary"
              style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}