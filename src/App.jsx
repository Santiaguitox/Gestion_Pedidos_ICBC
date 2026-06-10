import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Pedidos from '@/pages/Pedidos'
import PedidoDetalle from '@/pages/PedidoDetalle'
import Calendario from '@/pages/Calendario'
import Notificaciones from '@/pages/Notificaciones'
import Usuarios from '@/pages/Usuarios'
import Papelera from '@/pages/Papelera'
import { ROLES } from '@/lib/constants'
import '@/styles/global.css'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="pedidos/:id" element={<PedidoDetalle />} />
              <Route path="calendario" element={<Calendario />} />
              <Route path="notificaciones" element={<Notificaciones />} />
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
            </Route>
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}