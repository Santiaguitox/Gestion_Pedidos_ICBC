import { useState, useEffect } from 'react'

// Hook reactivo real (useState + listener de resize) — distinto de
// simplemente leer window.innerWidth una vez por render, que no
// reacciona a cambios de tamaño en vivo. setIsMobile solo se llama
// cuando el valor booleano realmente cambia, para no disparar
// re-renders de sobra en cada pixel de resize.
export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    function onResize() {
      const nowMobile = window.innerWidth <= breakpoint
      setIsMobile(prev => prev === nowMobile ? prev : nowMobile)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}
