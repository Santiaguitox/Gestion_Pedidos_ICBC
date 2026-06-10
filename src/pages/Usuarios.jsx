import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ROLES } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Users } from 'lucide-react'

const ROLE_COLORS = { admin:'#D0111B', colaborador:'#5B4EE8', viewer:'#6B7280' }

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('profiles').select('*').order('full_name').then(({ data }) => { setUsuarios(data ?? []); setLoading(false) })
  }, [])

  async function cambiarRol(id, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    setUsuarios(u => u.map(x => x.id === id ? { ...x, role:newRole } : x))
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Usuarios</h1>
      {loading && <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>Cargando…</p>}
      {!loading && usuarios.length === 0 && <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', padding:'3rem', color:'var(--text-muted)' }}><Users size={32} /><p>No hay usuarios.</p></div>}
      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
        {usuarios.map(u => (
          <div key={u.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0.875rem 1.25rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <span style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--accent-primary)', color:'#fff', fontSize:'0.875rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{u.full_name?.[0]?.toUpperCase() ?? '?'}</span>
              <div>
                <p style={{ fontSize:'0.9375rem', fontWeight:600 }}>{u.full_name || u.email}</p>
                <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{u.email}</p>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <Badge label={u.role} color={ROLE_COLORS[u.role] ?? '#6B7280'} />
              <select value={u.role} onChange={e => cambiarRol(u.id, e.target.value)} style={{ width:'auto', fontSize:'0.8125rem', padding:'0.3rem 0.625rem' }}>
                {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
