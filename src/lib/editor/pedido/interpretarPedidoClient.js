import { supabase } from '@/lib/supabase'

const MENSAJES = {
  tope_diario: 'Se alcanzó el tope diario de consultas a la IA. Probá mañana o cargá la pieza a mano.',
  ia_no_disponible: 'La IA no está disponible en este momento. Probá de nuevo en unos minutos.',
  sin_configurar: 'La IA no está configurada. Avisá al administrador.',
  sin_credito: 'La cuenta de la IA no tiene saldo. Avisá al administrador.',
  respuesta_invalida: 'La IA devolvió una respuesta que no se pudo interpretar. Probá de nuevo.',
}

// Llama a la Edge Function interpretar-pedido con la sesión del usuario.
// Devuelve { operaciones, dudas } o { no_verificable: true, mensaje, razon }.
// Lanza solo ante errores de red / HTTP.
export async function llamarIaPedido({ pedido, fichas }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sin sesión')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interpretar-pedido`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ pedido, fichas }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) {
    let detalle = ''
    try { detalle = (await res.json())?.error ?? '' } catch { /* cuerpo no JSON */ }
    throw new Error(detalle || `No se pudo consultar a la IA (HTTP ${res.status}).`)
  }
  const data = await res.json()
  if (data.estado === 'no_verificable') {
    return { no_verificable: true, razon: data.razon, mensaje: MENSAJES[data.razon] ?? MENSAJES.ia_no_disponible }
  }
  return { operaciones: data.operaciones ?? [], dudas: data.dudas ?? [] }
}
