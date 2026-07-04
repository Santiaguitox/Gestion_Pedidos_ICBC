import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import icommLogo from '@/assets/Icomm_Logo.png'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      setError('No se encontró el perfil del usuario.')
      setLoading(false)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">

      <div className="blob-red-tr" />

      <div className="login-card">

        <div className="login-logo">
          <img src={icommLogo} alt="icomm" />
        </div>

        <h1 className="text-2xl font-bold [font-family:var(--font-display)]">Gestión de pedidos</h1>
        <p className="text-sm text-[var(--text-secondary)]">Ingresá con tu cuenta de equipo</p>

        <form onSubmit={handleSubmit} autoComplete="off" className="login-form">

          <div className="form-field">
            <label className="form-label">Email</label>
            <div className="input-wrapper">
              <span className="input-icon"><Mail size={16} /></span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@icomm.com"
                required
                className="input-icon-left"
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Contraseña</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-icon-both"
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="input-action">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="msg-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>

        </form>
      </div>
    </div>
  )
}