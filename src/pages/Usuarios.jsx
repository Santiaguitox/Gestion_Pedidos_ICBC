import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { ROLES, ROLE_COLORS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Users, UserPlus, X, Trash2, Pencil, BarChart2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CargaTrabajoModal } from '@/components/ui/CargaTrabajoModal'
import { colorAvatar, iniciales } from '@/components/pedidos/PedidoCard'

const AREAS_EQUIPO = ['PM', 'Diseño', 'Programación', 'Comercial', 'Otro']

export default function Usuarios() {
  const { role: myRole, user: myUser } = useAuth()
  const { showSuccess, showError } = useNotificaciones()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showCargaTrabajo, setShowCargaTrabajo] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'colaborador', area_equipo: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [editingUserId, setEditingUserId] = useState(null)
  const [usuarioEditando, setUsuarioEditando] = useState(null)
  const [editForm, setEditForm] = useState({ role: '', area_equipo: '', avatar_color: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { fetchUsuarios() }, [])

  function abrirEditarUsuario(u) {
    setUsuarioEditando(u)
    setEditForm({ role: u.role, area_equipo: u.area_equipo ?? '', avatar_color: u.avatar_color || colorAvatar(u.id) })
  }

  function cerrarEditarUsuario() {
    setUsuarioEditando(null)
    setEditForm({ role: '', area_equipo: '', avatar_color: '' })
  }

  async function guardarUsuarioEditado(e) {
    e.preventDefault()
    if (!usuarioEditando) return
    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: editForm.role, area_equipo: editForm.area_equipo || null, avatar_color: editForm.avatar_color || null })
        .eq('id', usuarioEditando.id)
      if (error) throw error
      setUsuarios(prev =>
        prev.map(u => u.id === usuarioEditando.id
          ? { ...u, role: editForm.role, area_equipo: editForm.area_equipo || null, avatar_color: editForm.avatar_color || null }
          : u
        )
      )
      cerrarEditarUsuario()
      showSuccess('Usuario actualizado correctamente')
    } catch (err) {
      showError(err.message || 'Error al actualizar usuario')
    } finally {
      setSavingEdit(false)
    }
  }

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

  async function cambiarArea(id, area) {
    const { error } = await supabase.from('profiles').update({ area_equipo: area || null }).eq('id', id)
    if (error) { showError(error.message || 'No se pudo actualizar el área'); return }
    setUsuarios(u => u.map(x => x.id === id ? { ...x, area_equipo: area } : x))
  }

  function pedirEliminarUsuario(u) { setConfirmEliminar(u) }

  async function eliminarUsuario(u) {
    setConfirmEliminar(null)
    setDeletingId(u.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: u.id }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Error al eliminar usuario')
      setUsuarios(prev => prev.filter(x => x.id !== u.id))
      showSuccess(`Usuario ${u.full_name || u.email} eliminado`)
    } catch (err) {
      showError(err.message || 'Error al eliminar usuario')
    } finally {
      setDeletingId(null)
    }
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
      setForm({ email: '', full_name: '', role: 'colaborador', area_equipo: '' })
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
        <div className="flex gap-2">
          {myRole === ROLES.SUPER_ADMIN && (
            <button onClick={() => setShowCargaTrabajo(true)} className="btn-estadisticas">
              <BarChart2 size={16} />Estadísticas
            </button>
          )}
          <button onClick={() => { setShowForm(v => !v); setInviteError(''); setInviteSuccess('') }}
            className="btn-header-action">
            {showForm ? <X size={16} /> : <UserPlus size={16} />}
            {showForm ? 'Cancelar' : 'Invitar usuario'}
          </button>
        </div>
      </div>

      {showCargaTrabajo && <CargaTrabajoModal onClose={() => setShowCargaTrabajo(false)} />}

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
              <div className="field-grid-2">
                <div className="field">
                  <label className="field-label">Rol</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Área / Equipo</label>
                  <select value={form.area_equipo} onChange={e => setForm(f => ({ ...f, area_equipo: e.target.value }))}>
                    <option value="">Sin área</option>
                    {AREAS_EQUIPO.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
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
              <span className="usuario-avatar" style={{ background: u.avatar_color || colorAvatar(u.id) }}>
                {iniciales(u.full_name)}
              </span>
              <div className="usuario-info">
                <p className="usuario-nombre">{u.full_name || u.email}</p>
                <p className="usuario-email">{u.email}</p>
              </div>
            </div>
            <div className="usuario-actions">
              <Badge label={u.role} color={ROLE_COLORS[u.role] ?? '#6B7280'} />
              {u.area_equipo && <Badge label={u.area_equipo} color="#5B4EE8" size="sm" />}
              <button type="button" onClick={() => abrirEditarUsuario(u)} className="btn-header-action">
                <Pencil size={16} />Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {usuarioEditando && (
        <div className="modal-overlay" onClick={cerrarEditarUsuario}>
          <div className="modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Editar usuario</h2>
                <p className="text-muted-sm" style={{ marginTop: '0.25rem' }}>
                  {usuarioEditando.full_name || usuarioEditando.email}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <Badge label={usuarioEditando.role} color={ROLE_COLORS[usuarioEditando.role] ?? '#6B7280'} />
                  {usuarioEditando.area_equipo && (
                    <Badge label={usuarioEditando.area_equipo} color="#5B4EE8" size="sm" />
                  )}
                </div>
              </div>
              <button type="button" onClick={cerrarEditarUsuario} className="modal-close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={guardarUsuarioEditado} className="modal-body">
              <div className="field">
                <label className="field-label">Rol</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Área / Equipo</label>
                <select value={editForm.area_equipo} onChange={e => setEditForm(f => ({ ...f, area_equipo: e.target.value }))}>
                  <option value="">Sin área</option>
                  {AREAS_EQUIPO.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Color del avatar</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editForm.avatar_color}
                    onChange={e => setEditForm(f => ({ ...f, avatar_color: e.target.value }))}
                    className="color-picker-input"
                  />
                  <span className="text-muted-sm">Se usa en los avatares de las tarjetas de pedido.</span>
                </div>
              </div>

              {myRole === ROLES.SUPER_ADMIN && usuarioEditando.id !== myUser?.id && (
                <div className="danger-zone">
                  <div>
                    <p className="danger-zone-title">Eliminar usuario</p>
                    <p className="danger-zone-text">
                      Esta acción elimina el acceso del usuario y no se puede deshacer.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const usuarioAEliminar = usuarioEditando
                      cerrarEditarUsuario()
                      pedirEliminarUsuario(usuarioAEliminar)
                    }}
                    className="btn-danger-outline"
                  >
                    <Trash2 size={16} />Eliminar
                  </button>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" onClick={cerrarEditarUsuario} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={savingEdit} className="btn-primary"
                  style={{ width: 'auto', opacity: savingEdit ? 0.6 : 1 }}>
                  {savingEdit ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmEliminar && (
        <ConfirmModal
          open={true}
          title="Eliminar usuario"
          message={`¿Eliminar a ${confirmEliminar.full_name || confirmEliminar.email}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar usuario"
          variant="danger"
          onConfirm={() => eliminarUsuario(confirmEliminar)}
          onCancel={() => setConfirmEliminar(null)}
        />
      )}
    </div>
  )
}