import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { LayoutGrid, ListTodo, CalendarDays, Bell, Users, LogOut, Sun, Moon, ChevronLeft, Trash2, Settings } from 'lucide-react'
import { ROLES } from '@/lib/constants'

const S = {
  layout: { display:'flex', height:'100vh', overflow:'hidden' },
  sidebar: (col) => ({ width: col ? '60px' : '220px', background:'var(--bg-surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, transition:'width 200ms ease', overflow:'hidden' }),
  sidebarHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 1rem', borderBottom:'1px solid var(--border)', minHeight:'60px' },
  brand: { display:'flex', alignItems:'center', gap:'0.375rem', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.9rem', whiteSpace:'nowrap' },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  content: { flex:1, overflowY:'auto', padding:'1.75rem 2rem' },
  nav: { flex:1, padding:'0.75rem 0.5rem', display:'flex', flexDirection:'column', gap:'0.125rem', overflowY:'auto' },
  footer: { padding:'0.75rem 0.5rem', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'0.25rem' },
  userInfo: { display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.5rem 0.75rem' },
  avatar: { width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent-primary)', color:'#fff', fontSize:'0.75rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  divider: { height:'1px', background:'var(--border)', margin:'0.5rem 0.25rem' },
}

function NavBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title}
      style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.55rem 0.75rem', borderRadius:'var(--radius-md)', color:'var(--text-secondary)', fontSize:'0.8125rem', fontWeight:500, transition:'background 150ms ease, color 150ms ease', whiteSpace:'nowrap', overflow:'hidden', width:'100%', textAlign:'left' }}
      onMouseEnter={e => { e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.color='var(--text-primary)' }}
      onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-secondary)' }}>
      {children}
    </button>
  )
}

export default function AppLayout() {
  const { profile, role, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  const navItemStyle = (isActive) => ({
    display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.55rem 0.75rem',
    borderRadius:'var(--radius-md)', fontSize:'0.875rem', fontWeight:500,
    whiteSpace:'nowrap', overflow:'hidden', transition:'background 150ms, color 150ms',
    background: isActive ? 'rgba(208,17,27,0.1)' : 'transparent',
    color: isActive ? 'var(--icbc-red)' : 'var(--text-secondary)',
  })

  const isAdminOrAbove = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const isSuperAdmin = role === ROLES.SUPER_ADMIN

  return (
    <div style={S.layout}>
      <aside style={S.sidebar(collapsed)}>
        <div style={S.sidebarHeader}>
          {!collapsed && (
            <div style={S.brand}>
              <span style={{ color:'var(--icbc-red)' }}>ICBC</span>
              <span style={{ color:'var(--text-muted)', fontWeight:300 }}>×</span>
              <span style={{ color:'var(--icomm-violet)' }}>icomm</span>
            </div>
          )}
          <button onClick={() => setCollapsed(v => !v)} style={{ color:'var(--text-muted)', display:'flex', alignItems:'center', padding:'0.25rem', borderRadius:'var(--radius-sm)', marginLeft:'auto', transform: collapsed ? 'rotate(180deg)' : 'none', transition:'transform 200ms' }}>
            <ChevronLeft size={16} />
          </button>
        </div>

        <nav style={S.nav}>
          {[
            { to:'/app',                label:'Dashboard',      icon:LayoutGrid,  end:true },
            { to:'/app/pedidos',        label:'Pedidos',        icon:ListTodo },
            { to:'/app/calendario',     label:'Calendario',     icon:CalendarDays },
            { to:'/app/notificaciones', label:'Notificaciones', icon:Bell },
          ].map(({ to, label, icon:Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => navItemStyle(isActive)} title={collapsed ? label : undefined}>
              <Icon size={18} />{!collapsed && <span>{label}</span>}
            </NavLink>
          ))}

          {isAdminOrAbove && (
            <>
              <div style={S.divider} />
              <NavLink to="/app/usuarios" style={({ isActive }) => navItemStyle(isActive)} title={collapsed ? 'Usuarios' : undefined}>
                <Users size={18} />{!collapsed && <span>Usuarios</span>}
              </NavLink>
              <NavLink to="/app/configuracion" style={({ isActive }) => navItemStyle(isActive)} title={collapsed ? 'Configuración' : undefined}>
                <Settings size={18} />{!collapsed && <span>Configuración</span>}
              </NavLink>
            </>
          )}

          {isSuperAdmin && (
            <NavLink to="/app/papelera" style={({ isActive }) => navItemStyle(isActive)} title={collapsed ? 'Papelera' : undefined}>
              <Trash2 size={18} />{!collapsed && <span>Papelera</span>}
            </NavLink>
          )}
        </nav>

        <div style={S.footer}>
          <NavBtn onClick={toggle} title="Cambiar tema">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
          </NavBtn>
          {!collapsed && profile && (
            <div style={S.userInfo}>
              <div style={S.avatar}>{profile.full_name?.[0]?.toUpperCase() ?? '?'}</div>
              <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <span style={{ fontSize:'0.8125rem', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile.full_name || profile.email}</span>
                <span style={{ fontSize:'0.6875rem', color:'var(--text-muted)', textTransform:'capitalize' }}>{profile.role}</span>
              </div>
            </div>
          )}
          <NavBtn onClick={signOut} title="Cerrar sesión">
            <LogOut size={16} />{!collapsed && <span>Cerrar sesión</span>}
          </NavBtn>
        </div>
      </aside>

      <div style={S.main}>
        <main style={S.content}><Outlet /></main>
      </div>
    </div>
  )
}