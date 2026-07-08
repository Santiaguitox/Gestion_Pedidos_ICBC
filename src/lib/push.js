// Circuito Web Push del lado del cliente — Fase 2.
//
// Responsabilidades:
//   - registrar el service worker (/sw.js)
//   - suscribir este dispositivo al push (permiso + PushManager + upsert
//     en push_suscripciones)
//   - dar de baja la suscripción (unsubscribe + delete de la fila)
//   - reportar el estado actual para la UI
//
// La clave pública VAPID viene de VITE_VAPID_PUBLIC_KEY (par generado
// con `npx web-push generate-vapid-keys`; la privada vive solo como
// secret de la Edge Function enviar-push).

import { supabase } from '@/lib/supabase'

// El PushManager espera la applicationServerKey como Uint8Array; la
// clave VAPID viene en base64url.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function pushSoportado() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

// Registrar el SW al arrancar la app (idempotente). Se llama desde
// main.jsx — el registro temprano hace que las suscripciones existentes
// sigan recibiendo push aunque el usuario nunca vuelva a tocar el toggle.
export async function registrarServiceWorker() {
  if (!pushSoportado()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

// Estado del push EN ESTE DISPOSITIVO: 'no-soportado' | 'denegado'
// | 'activo' | 'inactivo'.
export async function estadoPush() {
  if (!pushSoportado()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'denegado'
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return 'inactivo'
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'activo' : 'inactivo'
}

// Activa el push en este dispositivo para el usuario logueado.
// Devuelve el estado resultante ('activo' | 'denegado') o lanza si
// falla la persistencia (para que la UI muestre el error).
export async function suscribirsePush(userId) {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) throw new Error('Falta configurar VITE_VAPID_PUBLIC_KEY')

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return 'denegado'

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registrarServiceWorker())
  if (!reg) throw new Error('No se pudo registrar el service worker')
  await navigator.serviceWorker.ready

  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  }))

  const json = sub.toJSON()
  // Upsert por endpoint: si otro usuario había activado push en este
  // mismo navegador, la fila se reasigna a quien está logueado ahora
  // (la policy de UPDATE exige que quede a nombre propio).
  const { error } = await supabase.from('push_suscripciones').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
  }, { onConflict: 'endpoint' })

  if (error) {
    // Si no se pudo persistir, la suscripción del navegador no sirve
    // de nada (el server no la conoce): se revierte.
    await sub.unsubscribe().catch(() => {})
    throw new Error('No se pudo guardar la suscripción')
  }
  return 'activo'
}

// Desactiva el push en este dispositivo: da de baja la suscripción del
// navegador y borra la fila correspondiente.
export async function desuscribirsePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return 'inactivo'

  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  await supabase.from('push_suscripciones').delete().eq('endpoint', endpoint)
  return 'inactivo'
}
