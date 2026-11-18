// Estado de la herramienta (diseño + pedido), guardado en el navegador para no
// perder el trabajo al recargar. Todo el acceso a storage va en try/catch: puede
// estar bloqueado (modo privado, cookies deshabilitadas) y la página funciona igual.

import { useCallback, useEffect, useState } from 'react'
import { estadoDesdeGuardado, estadoEnBlanco, estadoInicial } from '../../../lib/externo/estructuras/estado.js'

export const CLAVE_ESTRUCTURAS = 'externo-estructuras-v1'

function leer() {
  try {
    return estadoDesdeGuardado(window.localStorage.getItem(CLAVE_ESTRUCTURAS))
  } catch {
    return null
  }
}

export function useEstadoEstructuras() {
  const [estado, setEstado] = useState(() => leer() ?? estadoInicial())

  useEffect(() => {
    try {
      window.localStorage.setItem(CLAVE_ESTRUCTURAS, JSON.stringify(estado))
    } catch { /* sin storage: el trabajo vale solo para esta visita */ }
  }, [estado])

  const actualizarConfig = useCallback(fn => setEstado(e => ({ ...e, config: fn(e.config) })), [])
  const actualizarPedido = useCallback(fn => setEstado(e => ({ ...e, pedido: fn(e.pedido) })), [])
  const empezarDeCero = useCallback(() => setEstado(estadoEnBlanco()), [])

  return { estado, setEstado, actualizarConfig, actualizarPedido, empezarDeCero }
}
