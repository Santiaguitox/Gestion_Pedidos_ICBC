import { supabase } from '@/lib/supabase'

// Llama a la Edge Function revisar-ortografia con la sesión del usuario (la
// función exige login y rol distinto de viewer). Devuelve la respuesta tal
// como la arma la función ({ estado, hallazgos?, razon? }) o lanza si no se
// pudo — quien llama (ValidarOrtografiaYRedaccion) lo traduce en "no se
// pudo revisar", nunca en error de la pieza.
export async function revisarOrtografiaConIA({ textos, glosario }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sin sesión')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revisar-ortografia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ textos, glosario }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}
