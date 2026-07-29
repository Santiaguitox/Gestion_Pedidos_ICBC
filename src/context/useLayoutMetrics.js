import { createContext, useContext } from 'react'

// El contexto y su hook viven ACÁ, separados del Provider
// (LayoutMetricsContext.jsx) — mismo motivo que useTheme.js: Fast
// Refresh solo puede hacer hot-reload de un archivo si TODOS sus
// exports son componentes.
//
// contentWidth: ancho real en px de <main className="main-content">
// (AppLayout) — el contenedor que le queda a cada página UNA VEZ
// descontado el sidebar (220px expandido / 72px colapsado). Ninguna
// página necesita saber cuánto mide el sidebar ni restarlo a mano: ya
// viene descontado, porque se mide el propio elemento que le queda
// como espacio real, no window.innerWidth.
//
// null hasta la primera medición (ver useElementWidth) — evita que una
// página lo lea como 0 en el primer render y dispare una decisión de
// layout "mobile" falsa antes de que el ResizeObserver mida algo real.
export const LayoutMetricsContext = createContext({ contentWidth: null })

export function useLayoutMetrics() {
  return useContext(LayoutMetricsContext)
}
