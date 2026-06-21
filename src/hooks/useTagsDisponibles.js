import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Trae los tags ÚNICOS de TODOS los pedidos no eliminados, sin paginar y
// sin aplicar ningún filtro (modo, fechas, búsqueda, etc.) — a diferencia
// de la lista de pedidos visible, que sí está paginada y filtrada. Esto
// evita que el selector de "Tags" se quede vacío o incompleto según qué
// pedidos haya en la página/modo actual (bug encontrado el 2026-06-20:
// activar "Ver histórico" podía hacer que el filtro de tags desaparezca
// por completo si esa página no traía ningún tag).
export function useTagsDisponibles() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    supabase
      .from('pedidos')
      .select('tags')
      .is('deleted_at', null)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) { setLoading(false); return }
        const unicos = [...new Set((data ?? []).flatMap(p => p.tags ?? []))].sort()
        setTags(unicos)
        setLoading(false)
      })
    return () => { cancelado = true }
  }, [])

  return { tags, loading }
}
