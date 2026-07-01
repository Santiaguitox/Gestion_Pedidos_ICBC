import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { NotificacionesProvider } from '@/context/NotificacionesContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Pedidos from '@/pages/Pedidos'
import PedidoDetalle from '@/pages/PedidoDetalle'
import Calendario from '@/pages/Calendario'
import Notificaciones from '@/pages/Notificaciones'
import RevisionEmail from '@/pages/RevisionEmail'
import RevisionBase from '@/pages/RevisionBase'
import RevisionEnvios from '@/pages/RevisionEnvios'
import EditorPiezas from '@/pages/EditorPiezas'
import AuditoriaPiezas from '@/pages/AuditoriaPiezas'
import Usuarios from '@/pages/Usuarios'
import Papelera from '@/pages/Papelera'
import Configuracion from '@/pages/Configuracion'
import SetPassword from '@/pages/SetPassword'
import { ROLES } from '@/lib/constants'
import '@/styles/global.css'


export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificacionesProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="pedidos" element={<Pedidos />} />
                <Route path="pedidos/:id" element={<PedidoDetalle />} />
                <Route path="calendario" element={<Calendario />} />
                <Route path="notificaciones" element={
                  <ProtectedRoute requiredRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.COLABORADOR]}>
                    <Notificaciones />
                  </ProtectedRoute>
                } />
                <Route path="revision" element={
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
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </BrowserRouter>
        </NotificacionesProvider>
        
      </AuthProvider>
    </ThemeProvider>
  )
}