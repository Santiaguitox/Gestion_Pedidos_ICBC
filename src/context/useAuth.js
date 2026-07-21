import { createContext, useContext } from 'react'

// El objeto de contexto y su hook viven ACÁ, separados del Provider
// (AuthContext.jsx), a propósito: Fast Refresh solo puede hacer hot
// reload de un archivo si TODOS sus exports son componentes — con el
// hook exportado junto al Provider (como estaba antes), editar
// cualquiera de los dos forzaba un full reload de la app en dev (el
// error react-refresh/only-export-components). El Provider importa el
// contexto desde acá; el resto de la app importa solo el hook.
export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}
