import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
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

    // Esperar a que el perfil cargue antes de navegar
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

    navigate('/app', { replace: true })
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-200px', right:'-200px', width:'600px', height:'600px', borderRadius:'50%', background:'radial-gradient(circle, rgba(208,17,27,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-xl)', padding:'2.5rem', width:'100%', maxWidth:'400px', boxShadow:'var(--shadow-lg)', position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'2rem', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem' }}>
          <span style={{ color:'var(--icbc-red)' }}>ICBC</span>
          <span style={{ color:'var(--text-muted)', fontWeight:300 }}>×</span>
          <span style={{ color:'var(--icomm-violet)' }}>icomm</span>
        </div>

        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700, marginBottom:'0.25rem' }}>Gestión de pedidos</h1>
        <p style={{ fontSize:'0.875rem', color:'var(--text-secondary)', marginBottom:'2rem' }}>Ingresá con tu cuenta de equipo</p>

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Email</label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <Mail size={16} style={{ position:'absolute', left:'0.75rem', color:'var(--text-muted)', pointerEvents:'none' }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@icomm.com"
                required
                style={{ paddingLeft:'2.25rem' }}
              />
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Contraseña</label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <Lock size={16} style={{ position:'absolute', left:'0.75rem', color:'var(--text-muted)', pointerEvents:'none' }} />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ paddingLeft:'2.25rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position:'absolute', right:'0.75rem', color:'var(--text-muted)', display:'flex', alignItems:'center' }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ fontSize:'0.8125rem', color:'var(--icbc-red)', background:'rgba(208,17,27,0.08)', border:'1px solid rgba(208,17,27,0.2)', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-sm)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background:'var(--accent-primary)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.9375rem', padding:'0.75rem', borderRadius:'var(--radius-md)', marginTop:'0.5rem', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}