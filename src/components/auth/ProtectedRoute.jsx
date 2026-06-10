import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function ProtectedRoute({ children, requiredRole, requiredRoles }) {
  const { session, role, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  // Soporta tanto requiredRole (string) como requiredRoles (array)
  if (requiredRoles && !requiredRoles.includes(role)) return <Navigate to="/app" replace />
  if (requiredRole && role !== requiredRole) return <Navigate to="/app" replace />

  return children
}