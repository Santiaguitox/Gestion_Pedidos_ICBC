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
// Deduplicación de fetch en vuelo: si dos instancias del hook montan
// mientras el fetch inicial todavía no resolvió, comparten la MISMA
// promesa (inflight) en vez de disparar dos requests idénticos. El
// cache (resultado ya resuelto) y el inflight (promesa en curso) son
// dos estados distintos: cache corta el fetch cuando ya hay datos,
// inflight lo corta mientras están en camino.
//
// `key` es el nombre de la propiedad de datos en el objeto que
// devuelve el hook (ej. 'estados' para useEstados) — configurable
// porque cada hook expone un nombre de propiedad distinto y el resto
// de la app ya desestructura por ese nombre específico
// (ej. `const { estados } = useEstados()`), no se puede unificar sin
// tocar cada call site.
export function createCachedResource({ table, select = '*', orderBy, ascending = true, key }) {
  let cache = null
  let inflight = null   // promesa del fetch en curso, compartida entre instancias
  let listeners = []

  function notify(data) {
    cache = data
    listeners.forEach(fn => fn(data))
  }

  // Devuelve una promesa con los datos, garantizando UN solo request:
  // si ya hay cache, resuelve al toque; si hay un fetch en vuelo,
  // devuelve esa misma promesa; si no, arranca uno nuevo y lo guarda
  // en inflight. El try/finally asegura que inflight se limpie tanto
  // si el fetch resuelve como si tira una excepción — así un error
  // puntual no deja el inflight "pegado" bloqueando futuros reintentos.
  function loadData() {
    if (cache) return Promise.resolve(cache)
    if (inflight) return inflight
    inflight = (async () => {
      try {
        let query = supabase.from(table).select(select)
        if (orderBy) query = query.order(orderBy, { ascending })
        const { data: rows, error } = await query
        // Un error acá NO debe cachearse como "lista vacía": la UI
        // mostraría "no hay estados/tipos" (mentira) y el cache
        // impediría cualquier reintento posterior. Se propaga: cache
        // queda en null, así el próximo mount o refetch reintenta.
        if (error) throw new Error(error.message || `No se pudo cargar ${table}`)
        const result = rows ?? []
        notify(result)
        return result
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  return function useCachedResource() {
    const [data, setData] = useState(cache ?? [])
    const [loading, setLoading] = useState(!cache)
    const [error, setError] = useState(null)

    useEffect(() => {
      listeners.push(setData)
      if (!cache) {
        setLoading(true)
        loadData()
          .then(() => setError(null))
          .catch(err => setError(err.message))
          .finally(() => setLoading(false))
      }
      return () => { listeners = listeners.filter(fn => fn !== setData) }
    }, [])

    async function refetch() {
      cache = null
      inflight = null
      setLoading(true)
      try {
        await loadData()
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    // `error` es aditivo: ningún call site existente lo desestructura,
    // así que nadie se rompe — los que quieran mostrarlo, lo toman.
    return { [key]: data, loading, error, refetch }
  }
}
