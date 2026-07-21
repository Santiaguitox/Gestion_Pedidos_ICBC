import { useEffect, useState } from 'react'
import { ThemeContext } from '@/context/useTheme'

// El contexto y el hook useTheme viven en useTheme.js — ver el
// comentario allá (Fast Refresh exige que este archivo exporte SOLO
// componentes).

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

