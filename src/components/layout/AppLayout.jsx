import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { LayoutGrid, ListTodo, CalendarDays, Bell, Users, LogOut, Sun, Moon, ChevronLeft, Trash2, Settings, X, ExternalLink } from 'lucide-react'
import { ROLES } from '@/lib/constants'

function NotifToast({ toast, onDismiss, onNavigate }) {
  if (!toast) return null
  return (
    <div className="toast">
      <div className="toast-main">
        {/* Header: anillo+dot + label + X */}
        <div className="toast-header">
          <div className="toast-dot-wrapper">
            {/* Anillo SVG — r=8, circunferencia = 2π×8 ≈ 50.26 */}
            <svg className="toast-ring" width="18" height="18" viewBox="0 0 18 18">
              <circle cx="9" cy="9" r="8" fill="none" stroke="var(--border)" strokeWidth="1.5" />
              <circle cx="9" cy="9" r="8" fill="none" stroke="var(--icbc-red)" strokeWidth="1.5"
                strokeDasharray="50.26" strokeDashoffset="0"
                style={{ animation: 'toastRing 10000ms linear forwards' }} />
            </svg>
            <span className="toast-dot" />
          </div>
          <span className="toast-label">Nueva notificación</span>
          <button onClick={onDismiss} className="toast-dismiss">
            <X size={15} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="toast-body">
          <p className="toast-mensaje">{toast.mensaje}</p>
          {toast.pedido_id && (
            <button onClick={() => { onNavigate(toast.pedido_id); onDismiss() }} className="toast-link">
              <ExternalLink size={12} />Ver pedido
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { profile, role, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const { unreadCount, toast, dismissToast } = useNotificaciones()
  const navigate = useNavigate()

  const isAdminOrAbove = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const isSuperAdmin = role === ROLES.SUPER_ADMIN

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={`flex flex-col shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-surface)] ${collapsed ? 'sidebar-collapsed' : ''}`}
        style={{ width: collapsed ? '72px' : '220px', transition: 'width 200ms ease' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)]"
          style={{ padding: '1.25rem 1rem', minHeight: '70px' }}>
          {!collapsed && (
            <div className="sidebar-logo">
              <span className="text-[var(--icbc-red)]">ICBC</span>
              <span className="text-[var(--text-muted)] font-light">×</span>
              <span className="text-[var(--icomm-violet)]">icomm</span>
            </div>
          )}
          <button onClick={() => setCollapsed(v => !v)}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shrink-0">
            <ChevronLeft size={18} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav flex flex-col flex-1 overflow-y-auto">
          {[
            { to: '/app',            label: 'Dashboard',  icon: LayoutGrid,  end: true },
            { to: '/app/pedidos',    label: 'Pedidos',    icon: ListTodo },
            { to: '/app/calendario', label: 'Calendario', icon: CalendarDays },
          ].map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? label : undefined}>
              <Icon size={18} />{!collapsed && <span>{label}</span>}
            </NavLink>
          ))}

          <NavLink to="/app/notificaciones"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={collapsed ? 'Notificaciones' : undefined}>
            <div className="relative flex items-center shrink-0">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </div>
            {!collapsed && <span>Notificaciones</span>}
          </NavLink>

          {isAdminOrAbove && (
            <>
              <div className="sidebar-separator" />
              <NavLink to="/app/usuarios"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                title={collapsed ? 'Usuarios' : undefined}>
                <Users size={18} />{!collapsed && <span>Usuarios</span>}
              </NavLink>
              <NavLink to="/app/configuracion"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                title={collapsed ? 'Configuración' : undefined}>
                <Settings size={18} />{!collapsed && <span>Configuración</span>}
              </NavLink>
            </>
          )}

          {isSuperAdmin && (
            <NavLink to="/app/papelera"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? 'Papelera' : undefined}>
              <Trash2 size={18} />{!collapsed && <span>Papelera</span>}
            </NavLink>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer flex flex-col border-t border-[var(--border)]">
          <button onClick={toggle} className="nav-btn" title="Cambiar tema">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
          </button>

          {!collapsed && profile && (
            <div className="sidebar-profile">
              <div className="sidebar-avatar">{profile.full_name?.[0]?.toUpperCase() ?? '?'}</div>
              <div className="flex flex-col overflow-hidden">
                <span className="sidebar-username">{profile.full_name || profile.email}</span>
                <span className="sidebar-role">{profile.role}</span>
              </div>
            </div>
          )}

          <button onClick={signOut} className="nav-btn" title="Cerrar sesión">
            <LogOut size={16} />{!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <NotifToast toast={toast} onDismiss={dismissToast} onNavigate={(pedidoId) => navigate(`/app/pedidos/${pedidoId}`)} />
    </div>
  )
}