import { useState, useEffect } from 'react'

// Mide el ancho REAL de un elemento del DOM de forma reactiva (vía
// ResizeObserver), no el de window. Sirve para decisiones de layout
// que dependen del espacio efectivamente disponible dentro de un
// contenedor puntual — a diferencia de window.innerWidth, no se ve
// distorsionado por elementos hermanos (sidebars, paneles fijos,
// barras laterales) que le comen ancho a ese contenedor pero no
// aparecen reflejados en el tamaño de la ventana entera.
//
// Devuelve null hasta la primera medición real (en vez de 0), para que
// quien lo consuma pueda distinguir "todavía no sé" de "mide 0px" y
// evitar decisiones erróneas en el primer render antes de que el
// ResizeObserver dispare.
export function useElementWidth(ref) {
  const [width, setWidth] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    setWidth(el.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [ref])

  return width
}
