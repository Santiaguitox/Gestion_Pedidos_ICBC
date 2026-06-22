import { useState } from 'react'

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      // localStorage puede fallar (modo privado, cuota llena) o el
      // valor guardado puede estar corrupto (JSON inválido, restos de
      // una versión vieja de la app) — en cualquier caso, seguir
      // funcionando con el valor por defecto en memoria es mejor que
      // romper la pantalla por una preferencia de UI no crítica.
      return defaultValue
    }
  })

  function set(newValue) {
    setValue(prev => {
      const resolved = typeof newValue === 'function' ? newValue(prev) : newValue
      if (resolved === undefined) return prev
      try {
        localStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        // Mismo criterio que en la carga: si falla el guardado, el
        // valor sigue viviendo en el state de React durante esta
        // sesión — se pierde la persistencia entre recargas, pero no
        // se rompe la interacción actual del usuario.
      }
      return resolved
    })
  }

  return [value, set]
}