import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, requireUser, errorResponse } from '../_shared/auth.ts'

const ROLES_PERMITIDOS = ['super_admin', 'admin']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Valida que quien llama esté logueado y tenga rol admin/super_admin.
    await requireUser(req, ROLES_PERMITIDOS)

    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Falta user_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return errorResponse(err)
  }
})
