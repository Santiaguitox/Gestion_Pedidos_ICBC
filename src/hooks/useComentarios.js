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
export function useComentarios(pedidoId) {
  const [comentarios, setComentarios] = useState([])
  const [reacciones, setReacciones] = useState([])
  const [loading, setLoading] = useState(!!pedidoId)

  const fetchReacciones = useCallback(async () => {
    if (!pedidoId) return
    const { data } = await supabase
      .from('pedido_comentario_reacciones')
      .select('id, comentario_id, user_id, emoji, profiles(full_name)')
      .eq('pedido_id', pedidoId)
    setReacciones(data ?? [])
  }, [pedidoId])

  // Trae UN comentario (con join) y lo inserta/actualiza en memoria.
  const refrescarComentario = useCallback(async (id) => {
    const { data } = await supabase
      .from('pedido_comentarios')
      .select('*, profiles(id, full_name, avatar_color)')
      .eq('id', id)
      .maybeSingle()
    if (!data) return
    setComentarios(prev => {
      const existe = prev.some(c => c.id === data.id)
      if (!existe) return [...prev, data] // llega ordenado: los nuevos van al final
      return prev.map(c => (c.id === data.id ? data : c))
    })
  }, [])

  useEffect(() => {
    if (!pedidoId) return
    let cancelado = false

    setLoading(true)
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
      setComentarios(coms.data ?? [])
      setReacciones(reacs.data ?? [])
      setLoading(false)
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
  }, [pedidoId, refrescarComentario, fetchReacciones])

  // ── Acciones ──────────────────────────────────────────────────────
  // Sin optimistic updates: el propio INSERT vuelve por el canal en
  // <200ms y hay una sola fuente de verdad (mismo criterio que
  // usePedidos). Todas devuelven { error } para que el componente
  // muestre el feedback con showError.

  async function agregar(userId, contenido, menciones) {
    const { error } = await supabase
      .from('pedido_comentarios')
      .insert({ pedido_id: pedidoId, user_id: userId, contenido, menciones })
    return { error }
  }

  async function editar(id, contenido, menciones) {
    const { data, error } = await supabase
      .from('pedido_comentarios')
      .update({ contenido, menciones, edited_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
    // RLS silencioso: 0 filas afectadas = sin permiso (no es el autor).
    if (!error && !data?.length) return { error: new Error('Sin permiso para editar este comentario') }
    return { error }
  }

  // Soft delete vía RPC: autor o admin/super_admin (la función valida
  // server-side y solo toca deleted_at — un admin puede moderar pero
  // jamás editar el texto de un comentario ajeno).
  async function eliminar(id) {
    const { error } = await supabase.rpc('eliminar_comentario', { p_comentario_id: id })
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

  return { comentarios, reacciones, loading, agregar, editar, eliminar, toggleReaccion }
}
