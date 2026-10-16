// Tema (claro / oscuro) de las páginas públicas.
//
// Se guarda en una clave PROPIA de localStorage, para no pisar la preferencia
// de la app. La primera vez se parte de lo que la persona ya tenga elegido en
// TeamWorkHub (clave "theme", solo lectura) y, si no hay nada, del tema del
// sistema. Todo el acceso a storage va en try/catch: puede estar bloqueado
// (modo privado, cookies deshabilitadas).

import { useCallback, useState } from 'react'

export const CLAVE_TEMA_EXTERNO = 'externo-tema'
const CLAVE_TEMA_APP = 'theme'

function leer(clave) {
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}

export function temaInicial() {
  const propio = leer(CLAVE_TEMA_EXTERNO)
  if (propio === 'claro' || propio === 'oscuro') return propio
  const app = leer(CLAVE_TEMA_APP)
  if (app === 'dark') return 'oscuro'
  if (app === 'light') return 'claro'
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'oscuro'
  } catch { /* sin matchMedia */ }
  return 'claro'
}

export function useTemaExterno() {
  const [tema, setTema] = useState(temaInicial)

  const alternar = useCallback(() => {
    const nuevo = tema === 'claro' ? 'oscuro' : 'claro'
    setTema(nuevo)
    try {
      window.localStorage.setItem(CLAVE_TEMA_EXTERNO, nuevo)
    } catch { /* sin storage: el cambio vale solo para esta visita */ }
  }, [tema])

  return { tema, alternar }
}
