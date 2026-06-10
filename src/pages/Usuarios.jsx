import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROLES, ROLE_COLORS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Users, UserPlus, X, Trash2 } from 'lucide-react'

export default function Usuarios() {
  const { role: myRole, user: myUser } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'colaborador' })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { fetchUsuarios() }, [])

  async function fetchUsuarios() {
    supabase.from('profiles').select('*').order('full_name').then(({ data }) => {
      setUsuarios(data ?? [])
      setLoading(false)
    })
  }

  async function cambiarRol(id, newRole) {
    if (newRole === ROLES.SUPER_ADMIN && myRole !== ROLES.SUPER_ADMIN) return
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    setUsuarios(u => u.map(x => x.id === id ? { ...x, role: newRole } : x))
  }

  async function eliminarUsuario(u) {
    if (!confirm(`¿Eliminar a ${u.full_name || u.email}? Esta acción no se puede deshacer.`)) return
    setDeletingId(u.id)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: u.id }),
    })
    const result = await res.json()
    if (res.ok) {
      setUsuarios(prev => prev.filter(x => x.id !== u.id))
    } else {
      alert(result.error ?? 'Error al eliminar usuario.')
    }
    setDeletingId(null)
  }

  async function handleInvitar(e) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    if (!form.email || !form.full_name) { setInviteError('Email y nombre son obligatorios.'); return }
    setInviting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(form),
    })
    const result = await res.json()
    if (!res.ok) {
      setInviteError(result.error ?? 'Error al invitar usuario.')
    } else {
      setInviteSuccess(`Invitación enviada a ${form.email}`)
      setForm({ email: '', full_name: '', role: 'colaborador' })
      fetchUsuarios()
    }
    setInviting(false)
  }

  const rolesDisponibles = myRole === ROLES.SUPER_ADMIN
    ? Object.values(ROLES)
    : Object.values(ROLES).filter(r => r !== ROLES.SUPER_ADMIN)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Usuarios</h1>
        <button onClick={() => { setShowForm(v => !v); setInviteError(''); setInviteSuccess('') }}
          style={{ display:'flex', alignItems:'center', gap:'0.375rem', background:'var(--accent-primary)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.875rem', padding:'0.5rem 1rem', borderRadius:'var(--radius-md)' }}>
          {showForm ? <X size={16} /> : <UserPlus size={16} />}
          {showForm ? 'Cancelar' : 'Invitar usuario'}
        </button>
      </div>

      {/* Formulario de invitación */}
      {showForm && (
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
          <h3 style={{ fontFamily:'var(--font-display)', fontSize:'0.9375rem', fontWeight:600 }}>Invitar nuevo usuario</h3>
          <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>Se enviará un email con un link para que el usuario establezca su contraseña.</p>
          <form onSubmit={handleInvitar} style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Email <span style={{ color:'var(--icbc-red)' }}>*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@icomm.com" />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Nombre completo <span style={{ color:'var(--icbc-red)' }}>*</span></label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nombre Apellido" />
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', maxWidth:'200px' }}>
              <label style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--text-secondary)' }}>Rol</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width:'auto' }}>
                {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {inviteError && (
              <p style={{ fontSize:'0.8125rem', color:'var(--icbc-red)', background:'rgba(208,17,27,0.08)', border:'1px solid rgba(208,17,27,0.2)', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-sm)' }}>{inviteError}</p>
            )}
            {inviteSuccess && (
              <p style={{ fontSize:'0.8125rem', color:'#10B981', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-sm)' }}>{inviteSuccess}</p>
            )}
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button type="submit" disabled={inviting}
                style={{ background:'var(--accent-primary)', color:'#fff', fontFamily:'var(--font-display)', fontWeight:600, fontSize:'0.875rem', padding:'0.5rem 1.25rem', borderRadius:'var(--radius-md)', opacity: inviting ? 0.6 : 1 }}>
                {inviting ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>Cargando…</p>}
      {!loading && usuarios.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', padding:'3rem', color:'var(--text-muted)' }}>
          <Users size={32} /><p>No hay usuarios.</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
        {usuarios.map(u => (
          <div key={u.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0.875rem 1.25rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <span style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--accent-primary)', color:'#fff', fontSize:'0.875rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {u.full_name?.[0]?.toUpperCase() ?? '?'}
              </span>
              <div>
                <p style={{ fontSize:'0.9375rem', fontWeight:600 }}>{u.full_name || u.email}</p>
                <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{u.email}</p>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <Badge label={u.role} color={ROLE_COLORS[u.role] ?? '#6B7280'} />
              <select value={u.role} onChange={e => cambiarRol(u.id, e.target.value)}
                style={{ width:'auto', fontSize:'0.8125rem', padding:'0.3rem 0.625rem' }}>
                {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {/* Solo super_admin puede eliminar, y no puede eliminarse a sí mismo */}
              {myRole === ROLES.SUPER_ADMIN && u.id !== myUser?.id && (
                <button onClick={() => eliminarUsuario(u)} disabled={deletingId === u.id}
                  style={{ display:'flex', alignItems:'center', padding:'0.3rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1px solid rgba(208,17,27,0.3)', color:'var(--icbc-red)', opacity: deletingId === u.id ? 0.5 : 1 }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}