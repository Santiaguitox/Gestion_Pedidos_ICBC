import { useElementWidth } from '@/hooks/useElementWidth'
import { LayoutMetricsContext } from '@/context/useLayoutMetrics'

// Envuelve <main className="main-content"> (ver AppLayout.jsx) y
// expone su ancho real por contexto a cualquier página hija — así
// ninguna página necesita su propio ResizeObserver apuntando a un
// ancestro que no controla, ni recurrir a window.innerWidth (que sí
// incluye el sidebar y no representa el espacio real disponible).
//
// contentRef lo crea y lo asigna al <main> el propio AppLayout — este
// Provider solo lo observa, no es dueño del elemento.
export function LayoutMetricsProvider({ contentRef, children }) {
  const contentWidth = useElementWidth(contentRef)

  return (
    <LayoutMetricsContext.Provider value={{ contentWidth }}>
      {children}
    </LayoutMetricsContext.Provider>
  )
}
