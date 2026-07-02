import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, requireUser, errorResponse } from '../_shared/auth.ts'

// Solo super_admin puede disparar resets de contraseña de otros usuarios.
const ROLES_PERMITIDOS = ['super_admin']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await requireUser(req, ROLES_PERMITIDOS)

    const { email } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Falta el email del usuario' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Genera un link de recovery y DEVUELVE el action_link para que el
    // super_admin se lo pase al usuario a mano (por Slack/WhatsApp/etc).
    //
    // IMPORTANTE: generateLink() NO envía ningún email por sí solo —
    // solo genera el link. (El envío automático de mail lo hace el flujo
    // de resetPasswordForEmail(), que es distinto.) Antes esta función
    // solo devolvía { success: true } y el front decía "se envió el mail",
    // pero al usuario nunca le llegaba nada: el reset estaba roto en
    // silencio. Ahora devolvemos el link explícitamente.
    //
    // El redirectTo tiene que estar en la lista de Redirect URLs
    // permitidas en Supabase (Authentication > URL Configuration) — es
    // el mismo destino que ya usa el flujo de invitación (/set-password),
    // que además ya maneja el evento PASSWORD_RECOVERY, así que el usuario
    // cae en la misma pantalla de "Crear contraseña".
    //
    // El link es de UN SOLO USO y caduca según el tiempo de expiración
    // de OTP configurado en Supabase (por defecto ~1h). Es una credencial:
    // quien lo tenga puede setear la contraseña y entrar como ese usuario,
    // así que no conviene compartirlo por canales públicos.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://gestion-pedidos-icbc.vercel.app/set-password',
      },
    })

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      action_link: data.properties?.action_link ?? null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return errorResponse(err)
  }
})
