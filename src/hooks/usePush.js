import { useEffect, useState } from 'react'
import { useAuth } from '@/context/useAuth'
import { estadoPush, suscribirsePush, desuscribirsePush } from '@/lib/push'

// Estado y acciones del Web Push PARA ESTE DISPOSITIVO.
//
// estado: 'cargando' | 'no-soportado' | 'denegado' | 'activo' | 'inactivo'
//   - 'no-soportado': navegador sin Push API. En iOS además la PWA
//     tiene que estar instalada en la pantalla de inicio (iOS 16.4+);
//     en Safari suelto este hook devuelve 'no-soportado', que es
//     exactamente el comportamiento deseado (no ofrecer lo que no anda).
//   - 'denegado': el usuario bloqueó las notificaciones a nivel
//     navegador; solo se revierte desde la configuración del sitio.
export function usePush() {
  const { user } = useAuth()
  const [estado, setEstado] = useState('cargando')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vigente = true
    estadoPush().then(e => { if (vigente) setEstado(e) })
    return () => { vigente = false }
  }, [])

  async function activar() {
    if (!user || ocupado) return
    setOcupado(true)
    try {
      const resultado = await suscribirsePush(user.id)
      setEstado(resultado)
      return resultado
    } finally {
      setOcupado(false)
    }
  }

  async function desactivar() {
    if (ocupado) return
    setOcupado(true)
    try {
      const resultado = await desuscribirsePush()
      setEstado(resultado)
      return resultado
    } finally {
      setOcupado(false)
    }
  }

  return { estado, ocupado, activar, desactivar }
}
