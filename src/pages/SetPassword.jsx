import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import icommLogo from '@/assets/Icomm_Logo.png'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function SetPassword() {
  useDocumentTitle('Crear contraseña')

  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    navigate('/')
  }

  // if (!ready) return (
  //   <div className="relative flex min-h-screen items-center justify-content overflow-hidden p-6 text-[var(--text-muted)]">
  //     Verificando acceso…
  //   </div>
  // )

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="blob-red-tr" />
      <div className="login-card">

        <div className="login-logo">
          <img src={icommLogo} alt="icomm" />
        </div>

        <h1 className="mb-1 text-2xl font-bold [font-family:var(--font-display)]">Crear contraseña</h1>
        <p className="mb-8 text-sm text-[var(--text-secondary)]">Elegí una contraseña para tu cuenta</p>

        <form onSubmit={handleSubmit} className="login-form">

          <div className="form-field">
            <label className="form-label">Contraseña</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" required className="input-icon-both" />
              <button type="button" onClick={() => setShowPass(v => !v)} className="input-action">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Confirmar contraseña</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input type={showPass ? 'text' : 'password'} value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repetí la contraseña" required className="input-icon-left" />
            </div>
          </div>

          {error && <p className="msg-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>

        </form>
      </div>
    </div>
  )
}