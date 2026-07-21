import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'

const fmt = d => format(d, 'yyyy-MM-dd')

// ============================================================================
// SISTEMA DE RANGOS — meses calendario.
//
// Se reemplazó acá un primer intento con presets de ventana móvil (7/30
// días, trimestre, rango personalizado libre) que era, palabras del
// cliente, "la idea de la otra IA" aplicada sin pensarla contra el uso
// real: esta pantalla es interna (nadie le reporta a ICBC con esto), así
// que no hace falta ese menú — alcanza con moverse mes a mes.
//
// Se deja comentado abajo por si en el futuro hace falta reactivar rangos
// más flexibles (ver bloque LEGACY).
// ============================================================================

// Dado el primer día de un mes, arma su rango: si es el mes en curso, va
// hasta HOY (parcial); si es un mes ya cerrado, va hasta su último día.
export function rangoDeMes(primerDia, hoy = new Date()) {
  const desde = startOfMonth(primerDia)
  const hasta = isSameMonth(desde, hoy) ? hoy : endOfMonth(desde)
  return { desde: fmt(desde), hasta: fmt(hasta) }
}

// Período de comparación: el mismo rango, un mes calendario antes. Usar
// subMonths en las dos puntas (no restar N días) es lo que hace que esto
// funcione bien en los bordes de mes — ej. 31 de marzo menos 1 mes cae
// en 28/29 de febrero (el último día real de febrero), que es exactamente
// lo que se espera al comparar "fin de marzo" contra "fin de febrero".
export function rangoMesAnterior({ desde, hasta }) {
  const d = new Date(desde + 'T00:00:00')
  const h = new Date(hasta + 'T00:00:00')
  return { desde: fmt(subMonths(d, 1)), hasta: fmt(subMonths(h, 1)) }
}

export function labelMes(primerDia) {
  return format(primerDia, 'MMMM yyyy', { locale: es })
}

// Opciones para el dropdown "Elegir otro mes": del mes actual hacia atrás
// hasta el arranque del histórico confiable (stats_desde) — o, si todavía
// no cargó la config, un tope de 12 meses para no dejar la lista vacía.
export function mesesDisponibles(statsDesde, hoy = new Date()) {
  const limite = statsDesde ? new Date(statsDesde + 'T00:00:00') : subMonths(hoy, 11)
  const meses = []
  let cursor = startOfMonth(hoy)
  while (cursor >= startOfMonth(limite)) {
    meses.push(cursor)
    cursor = subMonths(cursor, 1)
  }
  return meses
}

/* ────────────────────────────────────────────────────────────────────────
   LEGACY — sistema de presets de ventana móvil (7d/30d/trimestre/rango
   libre). Se saca de uso por decisión de producto (ver header), pero
   queda comentado por si en algún momento esta pantalla empieza a
   necesitar reportes hacia afuera y hace falta más flexibilidad que
   "mes calendario".

export const PRESETS_RANGO = [
  { key: '7d',        label: 'Últimos 7 días' },
  { key: '30d',       label: 'Últimos 30 días' },
  { key: 'mes',       label: 'Este mes' },
  { key: 'mes_pasado', label: 'Mes pasado' },
  { key: 'trimestre', label: 'Este trimestre' },
  { key: 'custom',    label: 'Personalizado' },
]

export function rangoDePreset(preset, hoy = new Date()) {
  switch (preset) {
    case '7d':  return { desde: fmt(subDays(hoy, 6)),  hasta: fmt(hoy) }
    case '30d': return { desde: fmt(subDays(hoy, 29)), hasta: fmt(hoy) }
    case 'mes': return { desde: fmt(startOfMonth(hoy)), hasta: fmt(hoy) }
    case 'mes_pasado': {
      const mesPasado = subMonths(hoy, 1)
      return { desde: fmt(startOfMonth(mesPasado)), hasta: fmt(endOfMonth(mesPasado)) }
    }
    case 'trimestre': return { desde: fmt(startOfQuarter(hoy)), hasta: fmt(hoy) }
    default: return null // 'custom'
  }
}

// Rango inmediatamente anterior de la MISMA cantidad de días — servía
// para el rango libre, donde "un mes antes" no tenía sentido porque el
// rango no era necesariamente un mes.
export function rangoAnterior({ desde, hasta }) {
  const d = new Date(desde + 'T00:00:00')
  const h = new Date(hasta + 'T00:00:00')
  const dias = Math.round((h - d) / 86400000) + 1
  const hastaPrev = subDays(d, 1)
  const desdePrev = subDays(hastaPrev, dias - 1)
  return { desde: fmt(desdePrev), hasta: fmt(hastaPrev) }
}
──────────────────────────────────────────────────────────────────────── */

async function rpcEstadisticas({ desde, hasta, tipo, instancia, usuarioId }) {
  const { data, error } = await supabase.rpc('estadisticas_periodo', {
    p_desde: desde || null,
    p_hasta: hasta || null,
    p_tipo: tipo || null,
    p_instancia: instancia || null,
    p_usuario_id: usuarioId || null,
  })
  if (error) throw error
  return data
}

// Hook de datos de la pantalla Estadísticas.
// - data / loading / error: el mes elegido — TODO lo que se ve en
//   pantalla (kpis + gráficos) sale de acá.
// - dataAnterior / loadingComparar / errorComparar: el mes calendario
//   anterior al elegido, en un fetch APARTE que solo se dispara si
//   `comparar` está activo. A propósito NO comparte `loading` con el
//   fetch principal — tildar/destildar el switch de "Período anterior"
//   (con el mismo mes y filtros) no debe hacer parpadear el resto de la
//   pantalla con el skeleton entero; solo el bloque de KPIs se entera,
//   vía `loadingComparar`.
// - config: fila de estadisticas_config, se lee una vez.
export function useEstadisticas({ desde, hasta, comparar, tipo, instancia, usuarioId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [dataAnterior, setDataAnterior] = useState(null)
  // Si el hook se monta con el switch de comparar YA activo (estado
  // persistido), el primer fetch de comparación arranca al toque — el
  // loading inicial tiene que reflejarlo, porque el ajuste en render
  // solo se dispara en CAMBIOS de la clave, no en el montaje.
  const [loadingComparar, setLoadingComparar] = useState(Boolean(comparar && desde && hasta))
  const [errorComparar, setErrorComparar] = useState(null)

  const [config, setConfig] = useState(null)

  useEffect(() => {
    supabase.from('estadisticas_config').select('stats_desde, reprog_desde').maybeSingle()
      .then(({ data: cfg }) => setConfig(cfg ?? null))
  }, [])

  // Flip de loading/error al cambiar los parámetros — como AJUSTE DE
  // ESTADO DURANTE EL RENDER (con tracking del valor anterior), no
  // dentro de los fetch: el setLoading(true) síncrono adentro del
  // useCallback invocado desde el useEffect era el patrón que
  // react-hooks/set-state-in-effect marca como error (render en
  // cascada post-commit). Con el ajuste en render, el skeleton aparece
  // en el MISMO paint que el cambio de filtro (antes tardaba un
  // commit extra) y los fetch quedan puramente async. La clave
  // serializa exactamente las deps que re-disparan cada fetch — si se
  // agrega un parámetro nuevo al hook, sumarlo acá Y en las deps del
  // useCallback correspondiente.
  const claveParams = JSON.stringify([desde, hasta, tipo, instancia, usuarioId])
  const [claveParamsPrevia, setClaveParamsPrevia] = useState(claveParams)
  const claveComparar = JSON.stringify([comparar, desde, hasta, tipo, instancia, usuarioId])
  const [claveCompararPrevia, setClaveCompararPrevia] = useState(claveComparar)
  if (claveParams !== claveParamsPrevia) {
    setClaveParamsPrevia(claveParams)
    if (desde && hasta) { setLoading(true); setError(null) }
  }
  if (claveComparar !== claveCompararPrevia) {
    setClaveCompararPrevia(claveComparar)
    if (!comparar || !desde || !hasta) { setDataAnterior(null); setErrorComparar(null) }
    else { setLoadingComparar(true); setErrorComparar(null) }
  }

  // Los fetch NO tocan loading/error de forma síncrona — eso ya lo
  // hizo el ajuste en render de arriba (camino de cambio de params) o
  // el wrapper refetch (camino manual desde un handler, donde el set
  // síncrono es legítimo). Acá queda solo el trabajo async.
  const fetchPrincipal = useCallback(async () => {
    if (!desde || !hasta) return
    try {
      const actual = await rpcEstadisticas({ desde, hasta, tipo, instancia, usuarioId })
      setData(actual)
    } catch (err) {
      setError(err.message ?? 'No se pudieron cargar las estadísticas')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [desde, hasta, tipo, instancia, usuarioId])

  // Fetch async puro: todos los sets de adentro corren después del
  // await (post-respuesta), no hay setState síncrono en la cadena del
  // efecto — los flips síncronos de loading/error ya se movieron al
  // ajuste-en-render de arriba. La regla igual marca CUALQUIER
  // setState alcanzable desde un efecto, incluso post-await, lo que
  // condena el patrón estándar de fetch-en-efecto que la propia doc
  // de React usa — para ese caso el disable documentado es la salida
  // honesta (la alternativa real sería una librería de datos o un
  // external store, otro proyecto).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchPrincipal() }, [fetchPrincipal])

  const fetchComparacion = useCallback(async () => {
    // La limpieza de dataAnterior/errorComparar al apagar el switch y
    // el flip de loadingComparar al prenderlo ya los hizo el ajuste
    // en render — acá solo se decide si hay que fetchear.
    if (!comparar || !desde || !hasta) return
    try {
      const anterior = await rpcEstadisticas({ ...rangoMesAnterior({ desde, hasta }), tipo, instancia, usuarioId })
      setDataAnterior(anterior)
    } catch (err) {
      setErrorComparar(err.message ?? 'No se pudo cargar la comparación')
      setDataAnterior(null)
    } finally {
      setLoadingComparar(false)
    }
  }, [comparar, desde, hasta, tipo, instancia, usuarioId])

  // Mismo caso que el efecto de fetchPrincipal de arriba.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchComparacion() }, [fetchComparacion])

  // refetch manual (botón "Reintentar" y similares): acá el flip
  // síncrono de loading/error es correcto — se llama desde un event
  // handler, no desde un efecto, así que no genera cascada post-commit.
  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchPrincipal()
  }, [fetchPrincipal])

  return {
    data, loading, error, refetch,
    dataAnterior, loadingComparar, errorComparar,
    config,
  }
}
