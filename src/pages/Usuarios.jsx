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
      setUsuarios(data ?? []); setLoading(false)
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_id: u.id }),
    })
    const result = await res.json()
    if (res.ok) setUsuarios(prev => prev.filter(x => x.id !== u.id))
    else alert(result.error ?? 'Error al eliminar usuario.')
    setDeletingId(null)
  }

  async function handleInvitar(e) {
    e.preventDefault()
    setInviteError(''); setInviteSuccess('')
    if (!form.email || !form.full_name) { setInviteError('Email y nombre son obligatorios.'); return }
    setInviting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
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
    <div className="page-root">

      <div className="page-header">
        <h1 className="page-title">Usuarios</h1>
        <button onClick={() => { setShowForm(v => !v); setInviteError(''); setInviteSuccess('') }}
          className="btn-header-action">
          {showForm ? <X size={16} /> : <UserPlus size={16} />}
          {showForm ? 'Cancelar' : 'Invitar usuario'}
        </button>
      </div>

      {/* Formulario de invitación */}
      {showForm && (
        <div className="panel">
          <div className="panel-body" style={{ padding: '1.25rem' }}>
            <div>
              <h3 className="section-accordion-title">Invitar nuevo usuario</h3>
              <p className="text-muted-sm" style={{ marginTop: '0.25rem' }}>
                Se enviará un email con un link para que el usuario establezca su contraseña.
              </p>
            </div>
            <form onSubmit={handleInvitar} className="flex flex-col gap-[0.875rem]">
              <div className="field-grid-2">
                <div className="field">
                  <label className="field-label">Email <span style={{ color: 'var(--icbc-red)' }}>*</span></label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@icomm.com" />
                </div>
                <div className="field">
                  <label className="field-label">Nombre completo <span style={{ color: 'var(--icbc-red)' }}>*</span></label>
                  <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nombre Apellido" />
                </div>
              </div>
              <div className="field" style={{ maxWidth: '200px' }}>
                <label className="field-label">Rol</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width: 'auto' }}>
                  {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {inviteError && <p className="msg-error">{inviteError}</p>}
              {inviteSuccess && <p className="msg-success">{inviteSuccess}</p>}
              <div className="flex justify-end">
                <button type="submit" disabled={inviting} className="btn-primary" style={{ width: 'auto', opacity: inviting ? 0.6 : 1 }}>
                  {inviting ? 'Enviando…' : 'Enviar invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && <p className="loading-text">Cargando…</p>}
      {!loading && usuarios.length === 0 && (
        <div className="empty-state"><Users size={32} /><p>No hay usuarios.</p></div>
      )}

      <div className="flex flex-col gap-2">
        {usuarios.map(u => (
          <div key={u.id} className="usuario-item">
            <div className="flex items-center gap-3">
              <span className="usuario-avatar">{u.full_name?.[0]?.toUpperCase() ?? '?'}</span>
              <div className="usuario-info">
                <p className="usuario-nombre">{u.full_name || u.email}</p>
                <p className="usuario-email">{u.email}</p>
              </div>
            </div>
            <div className="usuario-actions">
              <Badge label={u.role} color={ROLE_COLORS[u.role] ?? '#6B7280'} />
              <select value={u.role} onChange={e => cambiarRol(u.id, e.target.value)} style={{ width: 'auto', fontSize: '0.8125rem', padding: '0.3rem 1.5rem 0.3rem 0.625rem' }}>
                {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {myRole === ROLES.SUPER_ADMIN && u.id !== myUser?.id && (
                <button onClick={() => eliminarUsuario(u)} disabled={deletingId === u.id}
                  className="btn-delete-user" style={{ opacity: deletingId === u.id ? 0.5 : 1 }}>
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