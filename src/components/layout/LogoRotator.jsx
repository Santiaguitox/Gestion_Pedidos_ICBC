import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/context/ThemeContext'
import iconmLogoFull from '@/assets/Icomm_Logo.png'
import iconmLogoMobile from '@/assets/Icomm_Logo_Mobile.png'
import icbcLogoFull from '@/assets/ICBC_Logo.png'
import icbcLogoFullDark from '@/assets/ICBC_Logo_Dark.png'
import icbcLogoMobile from '@/assets/ICBC_Logo_Mobile.png'

// Mismo timing que el prototipo de referencia (HTML standalone, opción
// "4 — Blur dissolve"): 2.8s de espera entre logos, transición de 0.6s
// vía CSS (ver .logo-rotator-img en global.css), todo en loop infinito
// mientras el componente esté montado.
const DELAY_MS = 10000

// variant 'full' = logo completo (isotipo + nombre), usado en el
// sidebar expandido. variant 'mobile' = solo el isotipo (cuadrado),
// usado en el sidebar colapsado de desktop Y en la topbar de mobile
// real — ambos casos comparten el mismo par de imágenes reducidas.
//
// El ICBC "full" tiene una franja en negro que no se lee bien sobre
// el fondo oscuro del sidebar — 'fullDark' es la misma pieza con esa
// versión armada para tema oscuro. No hace falta un dark del
// 'mobile': ese es solo el isotipo rojo, se ve bien en los dos temas
// (por eso no tiene entrada acá).
const LOGOS = {
  full: [iconmLogoFull, icbcLogoFull],
  fullDark: [iconmLogoFull, icbcLogoFullDark],
  mobile: [iconmLogoMobile, icbcLogoMobile],
}

export function LogoRotator({ variant = 'full' }) {
  const { theme } = useTheme()
  // Swap puntual: solo la variante 'full' tiene versión dark, y solo
  // se usa con el tema en 'dark'. 'mobile' nunca entra acá.
  const logos = variant === 'full' && theme === 'dark' ? LOGOS.fullDark : LOGOS[variant]
  // visibleIndex: qué logo tiene la clase "visible"; el resto "hidden"
  const [visibleIndex, setVisibleIndex] = useState(0)
  const nextIndex = useRef(1)

  useEffect(() => {
    const id = setInterval(() => {
      const next = nextIndex.current % logos.length

      // Fase 1: sacar el actual (opacity 0, blur 6px) — el browser
      // registra el cambio de clase y dispara la CSS transition.
      setVisibleIndex(-1)

      // Fase 2: un frame después entrar el siguiente (opacity 1, blur 0).
      // requestAnimationFrame garantiza que el browser ya pintó la fase 1
      // antes de aplicar la fase 2, así la transición se ve completa.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisibleIndex(next)
          nextIndex.current = next + 1
        })
      })
    }, DELAY_MS)

    return () => clearInterval(id)
  }, [logos.length])

  return (
    <div className={`logo-rotator logo-rotator-${variant}`}>
      {logos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === 0 ? 'icomm' : 'ICBC'}
          aria-hidden={i !== visibleIndex}
          className={`logo-rotator-img ${i === visibleIndex ? 'lr-on' : 'lr-off'}`}
        />
      ))}
    </div>
  )
}
