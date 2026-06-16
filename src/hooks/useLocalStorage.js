import { useState } from 'react'

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  function set(newValue) {
    setValue(prev => {
      const resolved = typeof newValue === 'function' ? newValue(prev) : newValue
      if (resolved === undefined) return prev
      try {
        localStorage.setItem(key, JSON.stringify(resolved))
      } catch {}
      return resolved
    })
  }

  return [value, set]
}