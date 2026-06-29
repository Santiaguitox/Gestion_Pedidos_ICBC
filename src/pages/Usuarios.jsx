import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { ROLES, ROLE_COLORS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Users, UserPlus, X, Trash2, Pencil, BarChart2, LayoutGrid, List, Plus, KeyRound } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CargaTrabajoModal } from '@/components/ui/CargaTrabajoModal'
import { colorAvatar, iniciales } from '@/components/pedidos/PedidoCard'

const AREAS_EQUIPO = ['PM', 'Diseño', 'Programación', 'Comercial', 'Otro']

// Mismos 10 colores del rediseño — se ofrecen como presets rápidos en
// el modal de editar, ADEMÁS del <input type="color"> libre que ya
// existía (no en su lugar): el picker libre permite cualquier color,
// los presets son un atajo para los más usados.
const AVATAR_COLOR_PRESETS = [
  '#D0111B', '#EA580C', '#CA8A04', '#15803D', '#0891B2',
  '#2563EB', '#5B4EE8', '#7C3AED', '#DB2777', '#6B7280',
]

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
  const [confirmReset, setConfirmReset] = useState(null)
  const [resetting, setResetting] = useState(false)
  const isMobile = useIsMobile()
  // Persiste entre sesiones, igual patrón que los filtros de
  // Notificaciones. En mobile se ignora (ver más abajo) y se fuerza
  // Grilla siempre — la Tabla tiene columnas fijas que se aprietan
  // demasiado en una pantalla angosta, mientras que la Grilla con una
  // sola tarjeta por fila entra bien.
  const [vistaGuardada, setVista] = useLocalStorage('usuarios:vista', 'grid')
  const vista = isMobile ? 'grid' : vistaGuardada

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


  async function resetearPassword(u) {
    setResetting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: u.email }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Error al resetear contraseña')
      showSuccess(`Se envió el link de reset a ${u.email}`)
    } catch (err) {
      showError(err.message || 'Error al resetear la contraseña')
    } finally {
      setResetting(false)
      setConfirmReset(null)
    }
  }

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
      // Cierra el modal solo, dando un instante para que se vea el
      // mensaje de éxito antes de desaparecer — mejor que cerrarlo de
      // golpe sin ninguna confirmación visible.
      setTimeout(() => { setShowForm(false); setInviteSuccess('') }, 1400)
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
          <button onClick={() => { setShowForm(true); setInviteError(''); setInviteSuccess('') }} className="btn-header-action">
            <UserPlus size={16} />Invitar usuario
          </button>
        </div>
      </div>

      {/* Toolbar de vista — propia fila, separada del header, alineada
          a la izquierda justo arriba de las tarjetas/tabla (no junto a
          los botones de acción del header). Oculta en mobile, donde la
          vista queda forzada a Grilla — no tiene sentido mostrar un
          control que no cambiaría nada visible. */}
      {!isMobile && (
        <div className="usuarios-toolbar">
          <div className="re-tabs">
            <button className={vista === 'grid' ? 'active' : ''} onClick={() => setVista('grid')}>
              <LayoutGrid size={14} />Grilla
            </button>
            <button className={vista === 'table' ? 'active' : ''} onClick={() => setVista('table')}>
              <List size={14} />Tabla
            </button>
          </div>
        </div>
      )}

      {showCargaTrabajo && <CargaTrabajoModal onClose={() => setShowCargaTrabajo(false)} />}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Invitar nuevo usuario</h2>
                <p className="text-muted-sm" style={{ marginTop: '0.25rem' }}>
                  Se enviará un email con un link para que el usuario establezca su contraseña.
                </p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="modal-close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInvitar} className="modal-body">
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
              <div className="modal-footer">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
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

      {!loading && usuarios.length > 0 && (
        vista === 'grid' ? (
          <div className="usuarios-grid">
            {usuarios.map(u => {
              const color = u.avatar_color || colorAvatar(u.id)
              return (
                <div key={u.id} className="usuario-card">
                  <div className="usuario-card-top">
                    <span className="usuario-card-avatar" style={{ background: color, boxShadow: `0 0 0 4px ${color}24` }}>
                      {iniciales(u.full_name)}
                    </span>
                    <div className="usuario-info" style={{ minWidth: 0, flex: 1 }}>
                      <p className="usuario-nombre usuario-card-nombre">{u.full_name || u.email}</p>
                      <p className="usuario-email usuario-card-email">{u.email}</p>
                    </div>
                  </div>
                  <div className="usuario-card-badges">
                    <Badge label={u.role} color={ROLE_COLORS[u.role] ?? '#6B7280'} />
                    {u.area_equipo && <Badge label={u.area_equipo} color="#5B4EE8" size="sm" />}
                  </div>
                  <div className="usuario-card-footer">
                    <button type="button" onClick={() => abrirEditarUsuario(u)} className="usuario-card-edit-btn">
                      <Pencil size={14} />Editar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="usuarios-table">
            <div className="usuarios-table-header">
              <div>Usuario</div><div>Rol</div><div>Área</div><div></div>
            </div>
            {usuarios.map(u => (
              <div key={u.id} className="usuarios-table-row">
                <div className="usuarios-table-user">
                  <span className="usuario-card-avatar usuario-table-avatar" style={{ background: u.avatar_color || colorAvatar(u.id) }}>
                    {iniciales(u.full_name)}
                  </span>
                  <div className="usuario-info" style={{ minWidth: 0 }}>
                    <p className="usuario-nombre usuario-card-nombre">{u.full_name || u.email}</p>
                    <p className="usuario-email usuario-card-email">{u.email}</p>
                  </div>
                </div>
                <div><Badge label={u.role} color={ROLE_COLORS[u.role] ?? '#6B7280'} /></div>
                <div>{u.area_equipo && <Badge label={u.area_equipo} color="#5B4EE8" size="sm" />}</div>
                <div style={{ textAlign: 'right' }}>
                  <button type="button" onClick={() => abrirEditarUsuario(u)} className="btn-header-action">
                    <Pencil size={16} />Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {usuarioEditando && (
        <div className="modal-overlay" onClick={cerrarEditarUsuario}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            {/* Header con banda de color — el fondo es el color del
                avatar (en vivo, sigue el color elegido en los presets
                de abajo sin necesitar guardar primero) al 12% de
                opacidad, igual patrón que el resto de la app usa para
                derivar variantes "suaves" de un color base. */}
            <div className="modal-usuario-edit-header" style={{ background: `${editForm.avatar_color || colorAvatar(usuarioEditando.id)}1F` }}>
              <button type="button" onClick={cerrarEditarUsuario} className="modal-usuario-edit-close">
                <X size={18} />
              </button>
              <div className="modal-usuario-edit-header-row">
                <span
                  className="modal-usuario-edit-avatar"
                  style={{ background: editForm.avatar_color || colorAvatar(usuarioEditando.id) }}
                >
                  {iniciales(usuarioEditando.full_name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="modal-usuario-edit-eyebrow">Editar usuario</div>
                  <div className="modal-usuario-edit-nombre">{usuarioEditando.full_name || usuarioEditando.email}</div>
                  <div className="modal-usuario-edit-email">{usuarioEditando.email}</div>
                </div>
              </div>
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
                <div className="avatar-color-presets">
                  {AVATAR_COLOR_PRESETS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, avatar_color: c }))}
                      className="avatar-color-swatch"
                      style={{
                        background: c,
                        boxShadow: editForm.avatar_color?.toLowerCase() === c.toLowerCase() ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${c}` : 'none',
                      }}
                      title={c}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                  {/* Picker libre — para cualquier color fuera de los
                      10 presets de arriba. No reemplaza a los presets,
                      los complementa. Se ve como un swatch más (con un
                      "+" adentro) en vez del cuadrado nativo del
                      navegador, y el label "Otro color" queda siempre
                      visible al lado, no solo como title al hover. */}
                  <div className="avatar-color-custom">
                    <span className="avatar-color-custom-swatch">
                      <Plus size={13} />
                      <input
                        type="color"
                        value={editForm.avatar_color}
                        onChange={e => setEditForm(f => ({ ...f, avatar_color: e.target.value }))}
                        className="avatar-color-custom-input"
                        aria-label="Elegir otro color"
                      />
                    </span>
                    <span className="avatar-color-custom-label">Otro color</span>
                  </div>
                </div>
                <span className="text-muted-sm" style={{ display: 'block', marginTop: '0.625rem' }}>
                  Se usa en los avatares de las tarjetas de pedido.
                </span>
              </div>

              {myRole === ROLES.SUPER_ADMIN && usuarioEditando.id !== myUser?.id && (
                <>
                  <div className="danger-zone">
                    <div>
                      <p className="danger-zone-title">Resetear contraseña</p>
                      <p className="danger-zone-text">
                        Se le enviará un email a {usuarioEditando.email} con un link para que establezca una nueva contraseña.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(usuarioEditando)}
                      className="btn-secondary"
                      disabled={resetting}
                    >
                      <KeyRound size={16} />Resetear
                    </button>
                  </div>
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
                </>
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

      {confirmReset && (
        <ConfirmModal
          open={true}
          title="Resetear contraseña"
          message={`Se enviará un email a ${confirmReset.email} con un link para que establezca una nueva contraseña. ¿Confirmás?`}
          confirmLabel="Enviar link de reset"
          variant="default"
          onConfirm={() => resetearPassword(confirmReset)}
          onCancel={() => setConfirmReset(null)}
        />
      )}
    </div>
  )
}