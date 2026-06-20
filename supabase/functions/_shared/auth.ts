import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Headers CORS compartidos por todas las Edge Functions.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

/**
 * Valida el JWT del request (header Authorization) contra Supabase Auth
 * y devuelve el usuario autenticado junto con su perfil (incluye `role`).
 *
 * Lanza AuthError (401) si no hay token o es inválido.
 * Lanza AuthError (403) si se pasan `allowedRoles` y el rol del usuario no está incluido.
 *
 * Usa internamente un cliente con SERVICE_ROLE solo para verificar el token
 * y leer el perfil — nunca se expone ese cliente fuera de este módulo.
 */
export async function requireUser(req: Request, allowedRoles?: string[]) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw new AuthError('Falta el header Authorization', 401)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) {
    throw new AuthError('Token inválido o expirado', 401)
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, full_name, email, area_equipo')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile) {
    throw new AuthError('No se encontró el perfil del usuario', 403)
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw new AuthError('No tenés permisos para realizar esta acción', 403)
  }

  return { user: userData.user, profile, supabaseAdmin }
}

/**
 * Convierte un AuthError (o cualquier error) en una Response JSON
 * con el status correcto, ya con los headers de CORS puestos.
 */
export function errorResponse(err: unknown, extraHeaders: Record<string, string> = {}) {
  const status = err instanceof AuthError ? err.status : 500
  const message = err instanceof Error ? err.message : 'Error inesperado'
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
  })
}
