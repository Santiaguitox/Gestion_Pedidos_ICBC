// Cabecera del documento de las páginas públicas nuevas: título propio, sin
// indexar (son herramientas con link público, no páginas para buscadores) y las
// tipografías del diseño. Si las fuentes no cargan (red corporativa, bloqueador),
// la página se ve igual con las del sistema.

import { useEffect } from 'react'

const FUENTES = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Poppins:wght@600&display=swap'

export function useCabeceraExterna(titulo) {
  useEffect(() => {
    const anterior = document.title
    document.title = titulo
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const fuentes = document.createElement('link')
    fuentes.rel = 'stylesheet'
    fuentes.href = FUENTES
    document.head.appendChild(fuentes)
    return () => {
      document.title = anterior
      meta.remove()
      fuentes.remove()
    }
  }, [titulo])
}
