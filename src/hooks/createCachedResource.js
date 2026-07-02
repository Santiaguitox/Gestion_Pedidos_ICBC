import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Factory para hooks de listas "de catálogo" (estados, tipos,
// instancias, usuarios) — datos que cambian poco, se piden una sola
// vez y se comparten entre TODAS las instancias del hook montadas en
// simultáneo, vía un cache a nivel de módulo (no de React, para que
// sobreviva a que un componente se desmonte) + un listener por
// instancia montada.
//
// Antes cada hook (useEstados/useInstancias/useTipos/useUsuarios)
// tenía su propia copia de este mismo patrón, letra por letra
// idéntica salvo la tabla/columnas/orden — cualquier fix futuro al
// patrón de cache en sí (ej. invalidación al reconectar) hubiera
// habido que aplicarlo 4 veces por separado, con el riesgo real de
// que una copia se actualice y las otras queden desincronizadas.
//
// Nota de comportamiento (preservada tal cual del código original,
// no es un bug nuevo): si dos instancias del hook montan mientras el
// fetch inicial todavía está en vuelo, LAS DOS disparan su propio
// fetch (cache sigue siendo null hasta que el primero resuelve) —
// redundante pero no incorrecto, cada instancia maneja su propio
// 'loading' de punta a punta. No se "arregla" acá para no cambiar
// comportamiento existente como parte de un refactor que debería ser
// puramente estructural.
//
// `key` es el nombre de la propiedad de datos en el objeto que
// devuelve el hook (ej. 'estados' para useEstados) — configurable
// porque cada hook expone un nombre de propiedad distinto y el resto
// de la app ya desestructura por ese nombre específico
// (ej. `const { estados } = useEstados()`), no se puede unificar sin
// tocar cada call site.
export function createCachedResource({ table, select = '*', orderBy, ascending = true, key }) {
  let cache = null
  let listeners = []

  function notify(data) {
    cache = data
    listeners.forEach(fn => fn(data))
  }

  return function useCachedResource() {
    const [data, setData] = useState(cache ?? [])
    const [loading, setLoading] = useState(!cache)

    useEffect(() => {
      listeners.push(setData)
      if (!cache) fetchData()
      return () => { listeners = listeners.filter(fn => fn !== setData) }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function fetchData() {
      setLoading(true)
      let query = supabase.from(table).select(select)
      if (orderBy) query = query.order(orderBy, { ascending })
      const { data: rows } = await query
      notify(rows ?? [])
      setLoading(false)
    }

    async function refetch() {
      cache = null
      await fetchData()
    }

    return { [key]: data, loading, refetch }
  }
}
