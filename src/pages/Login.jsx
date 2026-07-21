import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/useAuth'
import icommLogo from '@/assets/Icomm_Logo.png'
import { AuthBrandBackdrop } from '@/components/auth/AuthBrandBackdrop'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function Login() {
  useDocumentTitle('Iniciar sesión')

  const navigate = useNavigate()
  const { session, profile } = useAuth()

  // NAVEGACIÓN DIRIGIDA POR ESTADO — el fix del "login doble"
  // intermitente. Antes handleSubmit navegaba a mano apenas terminaba
  // SU fetch de perfil, pero ProtectedRoute lee el AuthContext, que no
  // publica la sesión hasta que resuelve SU PROPIO fetch de perfil
  // (dispara en paralelo con el onAuthStateChange de SIGNED_IN). Dos
  // fetches idénticos corriendo a la vez: si el del contexto perdía la
  // carrera, el guard veía session null al llegar a "/" y rebotaba al
  // login con el form vacío — la segunda vez entraba siempre porque el
  // contexto ya había publicado. Intermitente porque dependía de qué
  // fetch ganaba (jitter de red).
  //
  // Ahora Login no navega hasta que la MISMA fuente de verdad que usa
  // el guard (session + profile del contexto) esté lista: la carrera es
  // imposible por construcción. Bonus: entrar a /login ya autenticado
  // redirige solo, antes mostraba el form.
  useEffect(() => {
    if (session && profile) navigate('/', { replace: true })
  }, [session, profile, navigate])

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
      // Credenciales válidas pero sin fila en profiles (invitación a
      // medias): además del mensaje, se cierra la sesión — si quedara
      // abierta, el guard entraría en "sesión ok, perfil cargando" para
      // siempre (pantalla en blanco) al navegar a mano, y el efecto de
      // arriba jamás dispararía. Sesión limpia = estado consistente.
      await supabase.auth.signOut()
      setError('No se encontró el perfil del usuario.')
      setLoading(false)
      return
    }

    // No se navega acá: lo hace el efecto de arriba cuando el contexto
    // publica session + profile. El botón queda en "Ingresando…"
    // (loading true) ese instante — el unmount al navegar lo limpia.
  }

  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center gap-6 overflow-hidden p-4 sm:p-6">

      <AuthBrandBackdrop />

      <div className="login-card">

        <div className="login-logo login-brand-lockup">
          <img src="/icon-192.png" alt="TeamWorkHub" />
          <span className="wordmark">TeamWorkHub<sup>.app</sup></span>
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

          <button type="submit" disabled={loading} className="btn-primary btn-primary-brand">
            {loading ? 'Ingresando…' : <>Ingresar <span className="btn-arrow"><ArrowRight size={18} stroke-width={3} /></span></>}
          </button>

        </form>
      </div>

      <div className="powered-pill">
        Powered by <img src={icommLogo} alt="icomm" />
      </div>
    </div>
  )
}