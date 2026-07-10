import { useState, useEffect, Suspense } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { LayoutGrid, ListTodo, CalendarDays, Bell, Users, LogOut, Sun, Moon, ChevronLeft, Trash2, Settings, X, ExternalLink, Menu, CheckCircle2, AlertCircle, Info, FileSearch, Database, Search, MailCheck, PenLine, ScanSearch } from 'lucide-react'
import { ROLES } from '@/lib/constants'
import { rutaDeNotificacion } from '@/lib/notificaciones'
import PerfilUsuario from '@/components/auth/PerfilUsuario'
import BuscadorGlobal from '@/components/layout/BuscadorGlobal'
import { LogoRotator } from '@/components/layout/LogoRotator'

function NotifToast({ toast, onDismiss, onNavigate }) {
  if (!toast) return null
  return (
    <div className="toast">
      <div className="toast-main">
        <div className="toast-header">
          <div className="toast-dot-wrapper">
            <svg className="toast-ring" width="18" height="18" viewBox="0 0 18 18">
              <circle cx="9" cy="9" r="8" fill="none" stroke="var(--border)" strokeWidth="1.5" />
              <circle cx="9" cy="9" r="8" fill="none" stroke="var(--icbc-red)" strokeWidth="1.5"
                strokeDasharray="50.26" strokeDashoffset="0"
                style={{ animation: 'toastRing 10000ms linear forwards' }} />
            </svg>
            <span className="toast-dot" />
          </div>
          <span className="toast-label">Nueva notificación</span>
          <button onClick={onDismiss} className="toast-dismiss"><X size={15} /></button>
        </div>
        <div className="toast-body">
          <p className="toast-mensaje">{toast.mensaje}</p>
          {toast.pedido_id && (
            <button onClick={() => { onNavigate(toast); onDismiss() }} className="toast-link">
              <ExternalLink size={12} />Ver pedido
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const FEEDBACK_CONFIG = {
  success: { icon: CheckCircle2, color: '#22c55e',  label: 'Listo'      },
  error:   { icon: AlertCircle,  color: '#D0111B',  label: 'Error'      },
  info:    { icon: Info,         color: '#5B4EE8',  label: 'Información' },
}

function FeedbackToast({ feedback, onDismiss }) {
  if (!feedback) return null
  const { icon: Icon, color, label } = FEEDBACK_CONFIG[feedback.type] ?? FEEDBACK_CONFIG.info
  return (
    <div className="feedback-toast" style={{ '--feedback-color': color }}>
      <div className="feedback-toast-inner">
        <Icon size={16} className="feedback-toast-icon" />
        <div className="feedback-toast-body">
          <span className="feedback-toast-label">{label}</span>
          <span className="feedback-toast-message">{feedback.message}</span>
        </div>
        <button onClick={onDismiss} className="toast-dismiss"><X size={14} /></button>
      </div>
    </div>
  )
}

function SidebarContent({ collapsed, onNavClick, onPerfil }) {
  const { profile, role, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { unreadCount } = useNotificaciones()
  const isAdminOrAbove = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const isSuperAdmin = role === ROLES.SUPER_ADMIN
  // Viewer no tiene acceso a ninguna de las herramientas (Revisión de
  // emails, Revisión de BBDD, Revisión de envíos) — ni se muestran en el
  // menú ni son accesibles por URL directa (ver el ProtectedRoute con
  // requiredRoles en App.jsx para la protección real; ocultar el link
  // acá es solo para no mostrar una opción que de todas formas
  // redirigiría al Dashboard al clickearla).
  const isViewer = role === ROLES.VIEWER

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-center border-b border-[var(--border)]"
        style={{ padding: '1.25rem 1rem', minHeight: '70px' }}>
        <LogoRotator variant={collapsed ? 'mobile' : 'full'} />
      </div>

      {/* Nav */}
      <nav className="sidebar-nav flex flex-col flex-1 overflow-y-auto">
        {[
          { to: '/',            label: 'Dashboard',  icon: LayoutGrid,  end: true },
          { to: '/pedidos',    label: 'Pedidos',    icon: ListTodo },
          { to: '/calendario', label: 'Calendario', icon: CalendarDays },
        ].map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            onClick={onNavClick}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={collapsed ? label : undefined}>
            <Icon size={18} />{!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* Viewer no puede tener pedidos ni subtareas asignadas (no
            aparece como opción en esos selects — ver PedidoForm /
            SubtareasTimeline), así que no tiene sentido de negocio que
            reciba notificaciones — se oculta la sección entera junto
            con el resto de las herramientas. */}
        {!isViewer && (
          <NavLink to="/notificaciones" onClick={onNavClick}
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
        )}

        {isAdminOrAbove && (
          <>
            <div className="sidebar-separator" />
            <NavLink to="/usuarios" onClick={onNavClick}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? 'Usuarios' : undefined}>
              <Users size={18} />{!collapsed && <span>Usuarios</span>}
            </NavLink>
            <NavLink to="/configuracion" onClick={onNavClick}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? 'Configuración' : undefined}>
              <Settings size={18} />{!collapsed && <span>Configuración</span>}
            </NavLink>
          </>
        )}

        {isSuperAdmin && (
          <NavLink to="/papelera" onClick={onNavClick}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={collapsed ? 'Papelera' : undefined}>
            <Trash2 size={18} />{!collapsed && <span>Papelera</span>}
          </NavLink>
        )}

        {!isViewer && (
          <>
            <div className="sidebar-separator" />
            {!collapsed && <span className="sidebar-section-label">Herramientas</span>}
            <NavLink to="/revision-html" onClick={onNavClick}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? 'Revisión de emails' : undefined}>
              <FileSearch size={18} />{!collapsed && <span>Revisión de emails</span>}
            </NavLink>
            <NavLink to="/revision-bbdd" onClick={onNavClick}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? 'Revisión de BBDD' : undefined}>
              <Database size={18} />{!collapsed && <span>Revisión de BBDD</span>}
            </NavLink>
            <NavLink to="/revision-envios" onClick={onNavClick}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? 'Revisión de envíos' : undefined}>
              <MailCheck size={18} />{!collapsed && <span>Revisión de envíos</span>}
            </NavLink>
            <NavLink to="/editor-piezas" onClick={onNavClick}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? 'Editor de piezas' : undefined}>
              <PenLine size={18} />{!collapsed && <span>Editor de piezas</span>}
            </NavLink>
            <NavLink to="/auditoria-piezas" onClick={onNavClick}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              title={collapsed ? 'Auditoría de piezas' : undefined}>
              <ScanSearch size={18} />{!collapsed && <span>Auditoría de piezas</span>}
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer flex flex-col border-t border-[var(--border)]">
        <button onClick={toggle} className="nav-btn" title="Cambiar tema">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
        </button>
        {profile && (
          <button onClick={onPerfil} className="sidebar-profile-btn" title="Mi perfil">
            <div className="sidebar-avatar">{profile.full_name?.[0]?.toUpperCase() ?? '?'}</div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="sidebar-username">{profile.full_name || profile.email}</span>
                <span className="sidebar-role">{profile.role}</span>
              </div>
            )}
          </button>
        )}
        <button onClick={signOut} className="nav-btn" title="Cerrar sesión">
          <LogOut size={16} />{!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </>
  )
}

export default function AppLayout() {
  const { role } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showPerfil, setShowPerfil] = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const { toast, dismissToast, feedback, dismissFeedback } = useNotificaciones()
  const navigate = useNavigate()

  // Atajo global Cmd+K (Mac) / Ctrl+K (Windows/Linux) — funciona desde
  // cualquier pantalla de la app, no solo desde un input específico.
  // Se ignora si ya hay otro modal abierto (perfil, cambiar contraseña)
  // para no superponer dos overlays a la vez.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!showPerfil) setShowBuscador(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showPerfil])

  // El drawer se cierra desde el onClick de cada NavLink (onNavClick, ver
  // SidebarContent más abajo) — no hace falta un efecto aparte. Mientras
  // el drawer está abierto en mobile tapa toda la pantalla, así que no hay
  // forma real de navegar sin pasar por esos clicks.

  return (
    <div className="app-shell flex h-screen overflow-hidden">

      {/* Sidebar desktop */}
      <aside
        className={`sidebar-desktop flex flex-col shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] ${collapsed ? 'sidebar-collapsed' : ''}`}
        style={{ width: collapsed ? '72px' : '220px', transition: 'width 200ms ease' }}
      >
        <SidebarContent collapsed={collapsed} onNavClick={null} onPerfil={() => setShowPerfil(true)} />
      </aside>

      {/* Chevron de colapsar — vive FUERA del <aside> a propósito, con
          position:fixed (no recortado por el overflow:hidden del
          sidebar ni del contenedor general), flotando sobre el borde
          derecho. Antes vivía adentro del header, al lado del logo de
          texto — con el logo rotador nuevo (más ancho que el texto que
          tenía antes) ya no había buen lugar ahí sin que se pisaran.
          'left' se recalcula según el ancho real del sidebar en cada
          estado, sincronizado con la misma transición de 200ms. */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="sidebar-collapse-toggle"
        style={{ left: collapsed ? '72px' : '220px' }}
        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        <ChevronLeft size={15} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
      </button>

      {/* Drawer mobile */}
      <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`sidebar-drawer ${drawerOpen ? 'open' : ''}`}>
        <SidebarContent collapsed={false} onNavClick={() => setDrawerOpen(false)} onPerfil={() => setShowPerfil(true)} />
      </aside>

      {/* Contenido */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Topbar mobile */}
        <div className="mobile-topbar">
          <div className="mobile-topbar-logo">
            <LogoRotator variant="mobile" />
          </div>
          <div className="mobile-topbar-actions">
            <button onClick={() => setShowBuscador(true)} className="mobile-search-btn" title="Buscar">
              <Search size={19} />
            </button>
            <button onClick={() => setDrawerOpen(true)} className="mobile-hamburger">
              <Menu size={20} />
            </button>
          </div>
        </div>

        <main className="main-content">
          <Suspense fallback={<div className="page-loading"><div className="page-loading-spinner" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <NotifToast toast={toast} onDismiss={dismissToast} onNavigate={(n) => navigate(rutaDeNotificacion(n))} />
      <FeedbackToast feedback={feedback} onDismiss={dismissFeedback} />
      {showPerfil && <PerfilUsuario onClose={() => setShowPerfil(false)} />}
      <BuscadorGlobal open={showBuscador} onClose={() => setShowBuscador(false)} role={role} />
    </div>
  )
}