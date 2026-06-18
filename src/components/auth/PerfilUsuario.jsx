import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ROLE_COLORS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import CambiarPassword from '@/components/auth/CambiarPassword'
import { X, KeyRound, Mail, User, Briefcase } from 'lucide-react'

export default function PerfilUsuario({ onClose }) {
  const { profile } = useAuth()
  const [showCambiarPassword, setShowCambiarPassword] = useState(false)

  if (!profile) return null

  const roleColor = ROLE_COLORS[profile.role] ?? '#6B7280'

  if (showCambiarPassword) {
    return <CambiarPassword onClose={() => setShowCambiarPassword(false)} />
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <h2 className="modal-title">Mi perfil</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        <div className="modal-body">

          <div className="perfil-hero">
            <div className="perfil-avatar">{profile.full_name?.[0]?.toUpperCase() ?? '?'}</div>
            <div className="perfil-hero-info">
              <span className="perfil-nombre">{profile.full_name}</span>
              <div className="flex gap-2 flex-wrap">
                <Badge label={profile.role} color={roleColor} />
                {profile.area_equipo && <Badge label={profile.area_equipo} color="#5B4EE8" size="sm" />}
              </div>
            </div>
          </div>

          <div className="perfil-fields">
            <div className="perfil-field">
              <span className="perfil-field-icon"><Mail size={14} /></span>
              <div className="perfil-field-body">
                <span className="perfil-field-label">Email</span>
                <span className="perfil-field-value">{profile.email}</span>
              </div>
            </div>
            <div className="perfil-field">
              <span className="perfil-field-icon"><User size={14} /></span>
              <div className="perfil-field-body">
                <span className="perfil-field-label">Rol</span>
                <span className="perfil-field-value">{profile.role}</span>
              </div>
            </div>
            {profile.area_equipo && (
              <div className="perfil-field">
                <span className="perfil-field-icon"><Briefcase size={14} /></span>
                <div className="perfil-field-body">
                  <span className="perfil-field-label">Área</span>
                  <span className="perfil-field-value">{profile.area_equipo}</span>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
            <button onClick={onClose} className="btn-secondary">Cerrar</button>
            <button onClick={() => setShowCambiarPassword(true)} className="btn-primary"
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <KeyRound size={15} />Cambiar contraseña
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}