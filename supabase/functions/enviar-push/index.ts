import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { corsHeaders, errorResponse } from '../_shared/auth.ts'

/**
 * enviar-push — despacha una notificación in-app como Web Push a todos
 * los dispositivos suscriptos del usuario destinatario.
 *
 * Invocada por el trigger trg_notif_despachar_push (pg_net) con body
 * { notificacion_id }. Diseño de seguridad: NO se confía en el body —
 * se re-consulta la fila con service role y se usa únicamente lo que
 * hay en la base. Como el endpoint es invocable con la anon key
 * (pública), esto garantiza que nadie pueda fabricar contenido de push
 * ni dirigirlo a otro usuario: a lo sumo re-dispara una notificación
 * legítima a su dueño real.
 *
 * El colapso en el dispositivo lo hace el sistema operativo vía
 * `tag = grupo_key`: dos cambios de estado del mismo pedido se ven
 * como UNA notificación, siempre con el último estado (mismo criterio
 * que el agrupado in-app de la Fase 1).
 *
 * Secrets requeridos (supabase secrets set):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
 */

type FilaSuscripcion = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? ''
    if (!vapidPublic || !vapidPrivate || !vapidSubject) {
      return new Response(JSON.stringify({ error: 'VAPID sin configurar' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    const { notificacion_id } = await req.json().catch(() => ({}))
    if (!notificacion_id || typeof notificacion_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Falta notificacion_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Fuente de verdad: la fila real — y además CLAIM atómico de
    // idempotencia (ver migración 20260709000000_push_idempotente.sql).
    // El UPDATE condicionado por push_despachado_at IS NULL garantiza
    // que cada notificación se despacha UNA sola vez: si el id no
    // existe, o ya fue despachado (re-disparo con la anon key pública),
    // no vuelve fila y se responde { enviadas: 0 } sin enviar nada ni
    // filtrar el motivo. Dos requests simultáneos por el mismo id
    // tampoco pueden despachar los dos: el UPDATE es atómico, uno gana
    // la fila y el otro recibe 0 filas.
    const { data: notif, error: notifError } = await supabaseAdmin
      .from('notificaciones')
      .update({ push_despachado_at: new Date().toISOString() })
      .eq('id', notificacion_id)
      .is('push_despachado_at', null)
      .select('id, user_id, pedido_id, mensaje, tipo, grupo_key, data')
      .maybeSingle()

    if (notifError || !notif) {
      return new Response(JSON.stringify({ enviadas: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: suscripciones } = await supabaseAdmin
      .from('push_suscripciones')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', notif.user_id)

    if (!suscripciones?.length) {
      return new Response(JSON.stringify({ enviadas: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Deep-link para menciones y comentarios: la URL de la push lleva
    // ?comentario=<id> y PedidoDetalle abre el acordeón, scrollea al
    // comentario y lo resalta. Espejo exacto de rutaDeNotificacion()
    // en src/lib/notificaciones.js (que resuelve lo mismo para la
    // campanita in-app). El comentario_id sale de la fila re-consultada
    // con service role, nunca del body: mismo criterio de no confiar en
    // la entrada que el resto de la función.
    const comentarioId =
      (notif.tipo === 'mencion' || notif.tipo === 'comentario')
        ? (notif.data as { comentario_id?: string } | null)?.comentario_id
        : undefined
    const url = notif.pedido_id
      ? (comentarioId
          ? `/pedidos/${notif.pedido_id}?comentario=${comentarioId}`
          : `/pedidos/${notif.pedido_id}`)
      : '/notificaciones'

    const payload = JSON.stringify({
      title: 'TeamWorkHub',
      body: notif.mensaje,
      tag: notif.grupo_key ?? `${notif.tipo}:${notif.pedido_id ?? 'global'}`,
      url,
    })

    let enviadas = 0
    const vencidas: string[] = []

    await Promise.all(suscripciones.map(async (s: FilaSuscripcion) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        enviadas++
      } catch (err) {
        // 404/410 = suscripción vencida o revocada por el navegador:
        // se depura de la tabla. Otros errores se ignoran (best-effort).
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) vencidas.push(s.id)
      }
    }))

    if (vencidas.length) {
      await supabaseAdmin.from('push_suscripciones').delete().in('id', vencidas)
    }

    return new Response(JSON.stringify({ enviadas, depuradas: vencidas.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return errorResponse(err)
  }
})
