/**
 * Ejecuta una query de Supabase y lanza un Error si falla.
 * Uso: const data = await runSupabase(supabase.from('tabla').select('*'))
 */
export async function runSupabase(query, fallbackMessage = 'Ocurrió un error') {
  const { data, error } = await query
  if (error) {
    console.error('[Supabase]', error)
    throw new Error(error.message || fallbackMessage)
  }
  return data
}

/**
 * Igual que runSupabase pero silencioso: si falla, loguea y devuelve null.
 * Útil para operaciones secundarias (ej: registrarActividad) que no deben
 * interrumpir el flujo principal.
 */
export async function runSupabaseSilent(query, label = 'operación secundaria') {
  try {
    const { data, error } = await query
    if (error) console.warn(`[Supabase silent – ${label}]`, error)
    return data ?? null
  } catch (err) {
    console.warn(`[Supabase silent – ${label}]`, err)
    return null
  }
}