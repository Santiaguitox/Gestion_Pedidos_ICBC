import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/useAuth'

export default function ProtectedRoute({ children, requiredRole, requiredRoles }) {
  const { session, profile, role, loading } = useAuth()

  if (loading) return null
  if (session && !profile) return null  // sesión ok pero perfil todavía cargando

  if (!session) return <Navigate to="/login" replace />

  if (requiredRoles && !requiredRoles.includes(role)) return <Navigate to="/" replace />
  if (requiredRole && role !== requiredRole) return <Navigate to="/" replace />

  return children
}