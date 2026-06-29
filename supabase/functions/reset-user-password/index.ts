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

    // Genera un link de recovery y lo envía al email del usuario.
    // El usuario hace click, elige su nueva contraseña y listo —
    // la contraseña nueva nunca pasa por este servidor ni por el admin.
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return errorResponse(err)
  }
})
