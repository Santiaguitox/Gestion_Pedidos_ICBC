import { lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { NotificacionesProvider } from '@/context/NotificacionesContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import SetPassword from '@/pages/SetPassword'
import { ROLES } from '@/lib/constants'
import '@/styles/global.css'

// Code-splitting por ruta: estas páginas NO se importan estático —
// antes, TODO el JS de las 13 páginas (EditorPiezas.jsx solo son
// ~5.700 líneas) bajaba entero en el primer load de cualquier
// usuario, incluso alguien que jamás abre esa herramienta en la
// sesión (o que ni siquiera tiene el rol para hacerlo, como 'viewer'
// con Editor de Piezas / Auditoría de Piezas / las 3 de Revisión).
// Con lazy(), Vite genera un chunk aparte por página que recién se
// pide de la red cuando React Router realmente navega a esa ruta.
// Login, Dashboard y SetPassword quedan afuera de esto a propósito:
// son las páginas que se ven sí o sí apenas se entra a la app (login,
// landing post-login, link de reseteo de contraseña) — lazy-loadearlas
// solo agregaría un flash de loading en el camino más común, sin
// ahorrar nada real (se piden igual, siempre).
const Pedidos = lazy(() => import('@/pages/Pedidos'))
const PedidoDetalle = lazy(() => import('@/pages/PedidoDetalle'))
const Calendario = lazy(() => import('@/pages/Calendario'))
const Notificaciones = lazy(() => import('@/pages/Notificaciones'))
const RevisionEmail = lazy(() => import('@/pages/RevisionEmail'))
const RevisionBase = lazy(() => import('@/pages/RevisionBase'))
const RevisionEnvios = lazy(() => import('@/pages/RevisionEnvios'))
const EditorPiezas = lazy(() => import('@/pages/EditorPiezas'))
const AuditoriaPiezas = lazy(() => import('@/pages/AuditoriaPiezas'))
const Usuarios = lazy(() => import('@/pages/Usuarios'))
const Papelera = lazy(() => import('@/pages/Papelera'))
const Configuracion = lazy(() => import('@/pages/Configuracion'))


export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificacionesProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="pedidos" element={<Pedidos />} />
                <Route path="pedidos/:id" element={<PedidoDetalle />} />
                <Route path="calendario" element={<Calendario />} />
                <Route path="notificaciones" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COLABORADOR]}>
                    <Notificaciones />
                  </ProtectedRoute>
                } />
                <Route path="revision-html" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COLABORADOR]}>
                    <RevisionEmail />
                  </ProtectedRoute>
                } />
                <Route path="revision-bbdd" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COLABORADOR]}>
                    <RevisionBase />
                  </ProtectedRoute>
                } />
                <Route path="revision-envios" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COLABORADOR]}>
                    <RevisionEnvios />
                  </ProtectedRoute>
                } />
                <Route path="editor-piezas" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COLABORADOR]}>
                    <EditorPiezas />
                  </ProtectedRoute>
                } />
                <Route path="auditoria-piezas" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COLABORADOR]}>
                    <AuditoriaPiezas />
                  </ProtectedRoute>
                } />
                <Route path="usuarios" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}>
                    <Usuarios />
                  </ProtectedRoute>
                } />
                <Route path="papelera" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN]}>
                    <Papelera />
                  </ProtectedRoute>
                } />
                <Route path="configuracion" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}>
                    <Configuracion />
                  </ProtectedRoute>
                } />
              </Route>
              <Route path="/set-password" element={<SetPassword />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </NotificacionesProvider>
        
      </AuthProvider>
    </ThemeProvider>
  )
}