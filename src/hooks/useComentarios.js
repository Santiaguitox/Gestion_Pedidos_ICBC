import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// Comentarios + reacciones de UN pedido, con realtime.
//
// pedidoId null = no-op total (así PedidoDetalle puede llamar el hook
// incondicionalmente — las reglas de hooks no permiten condicionarlo —
// y pasarle null cuando el usuario es viewer: no se fetchea ni se
// suscribe nada; de todos modos RLS devolvería 0 filas, esto solo evita
// el request inútil).
//
// Realtime: una sola suscripción por pedido, filtrada por pedido_id en
// las dos tablas (por eso las reacciones denormalizan pedido_id — el
// filtro de postgres_changes es de una sola columna). Estrategia por
// evento, con updaters puros (misma lección que usePedidos):
//   - comentario INSERT/UPDATE -> se re-pide ESA fila con su join de
//     profiles (el payload del evento no trae joins) y se inserta o
//     reemplaza en memoria. Nunca refetch de toda la lista.
//   - reacción INSERT/DELETE -> refetch de las reacciones del pedido:
//     son filas mínimas (emoji + user) y el volumen es chico; la
//     alternativa (aplicar el delta del payload) obligaría a resolver
//     el nombre del autor aparte. Simple gana.
//
// Resiliencia (revisión de código): el canal actualiza a LOS DEMÁS;
// quien ejecuta la acción NO depende de él para ver su propio cambio —
// cada mutación exitosa refetchea su fila directo (mismo criterio que
// ya tenía toggleReaccion). Si el websocket se cayó (PWA que vuelve de
// background), publicás y lo ves igual.
export function useComentarios(pedidoId) {
  const [comentarios, setComentarios] = useState([])
  const [reacciones, setReacciones] = useState([])
  // loading y errorCarga viven juntos en un solo estado: cambian
  // siempre en el mismo momento y así el efecto de carga hace UN solo
  // setState sincrónico al arrancar (dos separados disparaban la regla
  // react-hooks/set-state-in-effect de React 19). errorCarga cubre la
  // falla de la CARGA inicial (red caída, etc.): sin esto, un error de
  // lectura mostraba el empty state alegre ("Sin comentarios todavía")
  // sobre una conversación que sí existe — falso vacío. Las mutaciones
  // ya devolvían { error }; esto cubre el lado de lectura.
  const [carga, setCarga] = useState({ loading: !!pedidoId, error: false })
  // Contador para re-disparar la carga a demanda (botón "Reintentar").
  const [intento, setIntento] = useState(0)

  // Reset por CAMBIO de pedido sin desmontar (navegar de un detalle a
  // otro con el buscador global): patrón oficial "adjusting state when
  // props change" — se compara contra el pedidoId del render anterior y
  // se ajusta DURANTE el render, no en un efecto (la regla
  // react-hooks/set-state-in-effect de React 19 rechaza el setState
  // sincrónico dentro del cuerpo del efecto; este patrón es la
  // alternativa que la propia doc de React recomienda). React re-corre
  // el render inmediatamente con el estado nuevo, antes de pintar: no
  // hay flash de la conversación del pedido anterior.
  const [prevPedidoId, setPrevPedidoId] = useState(pedidoId)
  if (prevPedidoId !== pedidoId) {
    setPrevPedidoId(pedidoId)
    setComentarios([])
    setReacciones([])
    setCarga({ loading: !!pedidoId, error: false })
  }

  const fetchReacciones = useCallback(async () => {
    if (!pedidoId) return
    const { data, error } = await supabase
      .from('pedido_comentario_reacciones')
      .select('id, comentario_id, user_id, emoji, profiles(full_name)')
      .eq('pedido_id', pedidoId)
    // Best-effort: si el refetch de reacciones falla se conserva lo que
    // había en memoria (peor es pisarlo con vacío) y el próximo evento
    // del canal reintenta solo.
    if (error) { console.warn('[comentarios] No se pudieron refrescar las reacciones:', error.message); return }
    setReacciones(data ?? [])
  }, [pedidoId])

  // Trae UN comentario (con join) y lo inserta/actualiza en memoria.
  const refrescarComentario = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('pedido_comentarios')
      .select('*, profiles(id, full_name, avatar_color)')
      .eq('id', id)
      .maybeSingle()
    if (error) { console.warn('[comentarios] No se pudo refrescar el comentario:', error.message); return }
    if (!data) return
    setComentarios(prev => {
      const existe = prev.some(c => c.id === data.id)
      if (!existe) return [...prev, data] // llega ordenado: los nuevos van al final
      return prev.map(c => (c.id === data.id ? data : c))
    })
  }, [])

  // El reset a "cargando" del retry vive acá (event handler, no efecto)
  // — el efecto de abajo solo hace el trabajo async.
  const recargar = useCallback(() => {
    setCarga({ loading: true, error: false })
    setIntento(n => n + 1)
  }, [])

  useEffect(() => {
    if (!pedidoId) return
    let cancelado = false

    Promise.all([
      supabase
        .from('pedido_comentarios')
        .select('*, profiles(id, full_name, avatar_color)')
        .eq('pedido_id', pedidoId)
        .order('created_at', { ascending: true }),
      supabase
        .from('pedido_comentario_reacciones')
        .select('id, comentario_id, user_id, emoji, profiles(full_name)')
        .eq('pedido_id', pedidoId),
    ]).then(([coms, reacs]) => {
      if (cancelado) return
      // supabase-js nunca lanza: resuelve { data, error }. Si cualquiera
      // de las dos consultas falló, se marca el error de carga para que
      // la UI muestre "no se pudo cargar" + Reintentar, en vez de un
      // falso "Sin comentarios todavía".
      if (coms.error || reacs.error) {
        console.warn('[comentarios] Falló la carga inicial:', (coms.error ?? reacs.error).message)
        setCarga({ loading: false, error: true })
        return
      }
      setComentarios(coms.data ?? [])
      setReacciones(reacs.data ?? [])
      setCarga({ loading: false, error: false })
    })

    const ch = supabase
      .channel(`comentarios-${pedidoId}-${crypto.randomUUID()}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pedido_comentarios', filter: `pedido_id=eq.${pedidoId}` },
        (payload) => {
          const id = payload.new?.id
          if (id) refrescarComentario(id)
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pedido_comentario_reacciones', filter: `pedido_id=eq.${pedidoId}` },
        () => fetchReacciones())
      .subscribe()

    return () => {
      cancelado = true
      supabase.removeChannel(ch)
    }
  }, [pedidoId, intento, refrescarComentario, fetchReacciones])

  // ── Acciones ──────────────────────────────────────────────────────
  // Todas devuelven { error } para que el componente muestre el
  // feedback con showError. Tras el éxito, cada una refetchea su fila
  // DIRECTO (sin esperar al canal): la UI de quien actuó responde al
  // instante y no depende de que el websocket esté vivo. El canal sigue
  // siendo lo que actualiza a los demás.

  async function agregar(userId, contenido, menciones) {
    const { data, error } = await supabase
      .from('pedido_comentarios')
      .insert({ pedido_id: pedidoId, user_id: userId, contenido, menciones })
      .select('id')
      .single()
    if (!error && data) await refrescarComentario(data.id)
    return { error }
  }

  async function editar(id, contenido, menciones) {
    const { data, error } = await supabase
      .from('pedido_comentarios')
      .update({ contenido, menciones, edited_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
    // RLS silencioso: 0 filas afectadas = sin permiso (no es el autor,
    // o el comentario fue moderado mientras se editaba).
    if (!error && !data?.length) return { error: new Error('Sin permiso para editar este comentario') }
    if (!error) await refrescarComentario(id)
    return { error }
  }

  // Soft delete vía RPC: autor o admin/super_admin (la función valida
  // server-side y solo toca deleted_at — un admin puede moderar pero
  // jamás editar el texto de un comentario ajeno).
  async function eliminar(id) {
    const { error } = await supabase.rpc('eliminar_comentario', { p_comentario_id: id })
    if (!error) await refrescarComentario(id)
    return { error }
  }

  // Toggle: si ya reaccioné con ese emoji la quito, si no la agrego.
  // La decisión se toma sobre el estado local (fuente: realtime) y el
  // UNIQUE de la base resuelve cualquier carrera: un insert duplicado
  // simplemente falla y el refetch del canal deja todo consistente.
  //
  // Tras la acción se refetchea DIRECTO (sin esperar al canal): la UI
  // de quien clickeó responde al instante. El canal sigue siendo lo que
  // actualiza a los demás — y para que los DELETE les lleguen, la tabla
  // tiene replica identity full (ver migración 20260709200000: sin eso,
  // el old record del DELETE no trae pedido_id y el filtro del canal
  // nunca matchea — era el bug de "no puedo sacar mi reacción").
  async function toggleReaccion(comentarioId, emoji, userId) {
    const mia = reacciones.find(r =>
      r.comentario_id === comentarioId && r.user_id === userId && r.emoji === emoji
    )
    if (mia) {
      const { error } = await supabase
        .from('pedido_comentario_reacciones')
        .delete().eq('id', mia.id)
      if (!error) await fetchReacciones()
      return { error }
    }
    const { error } = await supabase
      .from('pedido_comentario_reacciones')
      .insert({ comentario_id: comentarioId, pedido_id: pedidoId, user_id: userId, emoji })
    // 23505 = unique_violation: doble click más rápido que el realtime.
    // No es un error para el usuario — la reacción ya está.
    if (!error || error.code === '23505') {
      await fetchReacciones()
      return { error: null }
    }
    return { error }
  }

  return {
    comentarios,
    reacciones,
    loading: carga.loading,
    errorCarga: carga.error,
    recargar,
    agregar, editar, eliminar, toggleReaccion,
  }
}
