import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Supabase pone el token en el hash de la URL automáticamente
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Usuario llegó desde el link — ya está autenticado temporalmente
      }
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    navigate('/app')
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
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700, marginBottom:'0.25rem' }}>Crear contraseña</h1>
        <p style={{ fontSize:'0.875rem', color:'var(--text-secondary)', marginBottom:'2rem' }}>Elegí una contraseña para tu cuenta</p>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Contraseña</label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <Lock size={16} style={{ position:'absolute', left:'0.75rem', color:'var(--text-muted)', pointerEvents:'none' }} />
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required style={{ paddingLeft:'2.25rem' }} />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{ position:'absolute', right:'0.75rem', color:'var(--text-muted)', display:'flex', alignItems:'center' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Confirmar contraseña</label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <Lock size={16} style={{ position:'absolute', left:'0.75rem', color:'var(--text-muted)', pointerEvents:'none' }} />
              <input type={showPass ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetí la contraseña" required style={{ paddingLeft:'2.25rem' }} />
            </div>
          </div>
          {error && <p style={{ fontSize:'0.8125rem', color:'var(--icbc-red)', background:'rgba(208,17,27,0.08)', border:'1px solid rgba(208,17,27,0.2)', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-sm)' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ background:'var(--accent-primary)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.9375rem', padding:'0.75rem', borderRadius:'var(--radius-md)', marginTop:'0.5rem', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}