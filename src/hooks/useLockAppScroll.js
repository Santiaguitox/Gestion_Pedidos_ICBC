import { useEffect } from 'react'

// Cuántos overlays están pidiendo el lock a la vez (puede haber más de
// uno: sheet del editor + algo encima). El lock se libera recién cuando
// el último se cierra.
let locks = 0

// Congela el scroll de fondo mientras un overlay mobile está abierto
// (drawer del nav, bottom-sheets del editor, preview full-screen).
//
// Por qué hace falta: el scroller real de la app no es el body sino
// .main-content (overflow-y: auto). Los sheets del editor viven como
// hijos DOM de la página, o sea ADENTRO del subtree de .main-content —
// cuando el scroll interno del sheet llega a su tope, el gesto se
// encadena hacia arriba y el próximo scrollable de la cadena es
// .main-content: el usuario ve moverse el contenido de atrás
// ("scroll bleed-through", solo se nota en touch).
//
// El mecanismo es una clase en <body>; la regla CSS que la acompaña
// (ver global.css, "Scroll lock para overlays") está scopeada al media
// query mobile, así que en desktop este hook es un no-op visual.
export function useLockAppScroll(activo) {
  useEffect(() => {
    if (!activo) return
    locks++
    document.body.classList.add('twh-scroll-lock')
    return () => {
      locks--
      if (locks <= 0) {
        locks = 0
        document.body.classList.remove('twh-scroll-lock')
      }
    }
  }, [activo])
}
