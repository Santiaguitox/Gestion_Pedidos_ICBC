import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, requireUser, errorResponse } from '../_shared/auth.ts'

const ROLES_PERMITIDOS = ['super_admin', 'admin']
const ROLES_VALIDOS = ['super_admin', 'admin', 'colaborador', 'viewer']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Valida que quien llama esté logueado y tenga rol admin/super_admin.
    const { profile } = await requireUser(req, ROLES_PERMITIDOS)

    const { email, full_name, role } = await req.json()

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!ROLES_VALIDOS.includes(role)) {
      return new Response(JSON.stringify({ error: 'Rol inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Solo super_admin puede crear otro super_admin.
    if (role === 'super_admin' && profile.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Solo un super_admin puede asignar el rol super_admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Cliente con service role para poder crear usuarios
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Invitar usuario — Supabase manda el email automáticamente
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role },
      // Dominio custom (antes apuntaba al alias *.vercel.app — quedaba
      // funcionando de casualidad gracias al redirect 308 de vercel.json,
      // pero el link del email debe nacer apuntando al dominio real).
      redirectTo: 'https://teamworkhub.app/set-password'
    })

    if (error) throw error

    // Actualizar el perfil con nombre y rol
    await supabaseAdmin.from('profiles').update({ full_name, role }).eq('id', data.user.id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return errorResponse(err)
  }
})
