/* Service worker de TeamWorkHub — Fase 2: Web Push.
 *
 * Solo maneja push por ahora (sin caching offline — eso sería una fase
 * aparte si algún día hace falta). Dos responsabilidades:
 *
 * 1. 'push': mostrar la notificación del sistema. El `tag` viene de la
 *    Edge Function con el grupo_key de la notificación — el sistema
 *    operativo REEMPLAZA cualquier notificación visible con el mismo
 *    tag, así una ráfaga de cambios del mismo pedido se ve como una
 *    sola, siempre con el último estado (renotify: true hace que igual
 *    vibre/suene al actualizarse).
 *
 * 2. 'notificationclick': enfocar una pestaña abierta de la app y
 *    navegarla al pedido (o abrir una ventana nueva si no hay ninguna).
 */

self.addEventListener('push', (event) => {
  let payload
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'TeamWorkHub'
  const opciones = {
    body: payload.body || '',
    icon: '/icon-192.png',
    // Badge dedicado: Android lo tiñe de blanco usando solo el canal
    // alfa, así que necesita ser el glifo del abanico con las aspas
    // separadas por transparencia (icon-192 entero se veía como una
    // mancha blanca — las aspas se tocan y la silueta las fusiona).
    badge: '/badge-96.png',
    data: { url: payload.url || '/notificaciones' },
  }
  if (payload.tag) {
    opciones.tag = payload.tag
    opciones.renotify = true
  }

  event.waitUntil(self.registration.showNotification(title, opciones))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/notificaciones'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if ('focus' in ventana) {
          ventana.navigate(url)
          return ventana.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
