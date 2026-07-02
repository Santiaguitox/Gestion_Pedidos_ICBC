import { createCachedResource } from '@/hooks/createCachedResource'

// Lista de usuarios (profiles) para popular selectores de "usuario
// asignado" — usado tanto en Dashboard.jsx como en Pedidos.jsx.
export const useUsuarios = createCachedResource({ table: 'profiles', select: 'id, full_name', orderBy: 'full_name', key: 'usuarios' })
