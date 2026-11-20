import { supabase } from '@/lib/supabase'

// Llama a la Edge Function verificar-alt-imagenes con la sesión del usuario
// (la función exige login y rol distinto de viewer). Devuelve el array
// `resultados` tal como lo arma la función, o lanza si no se pudo — quien
// llama (ValidarAltCoincideImagen) traduce el fallo en "no verificable".
export async function verificarAltsConIA(items) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sin sesión')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verificar-alt-imagenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ imagenes: items.map(({ src, alt }) => ({ src, alt })) }),
    // 25 imágenes con 4 consultas en paralelo entran de sobra; este tope
    // evita que una IA colgada deje la revisión esperando.
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = await res.json()
  return data.resultados
}
