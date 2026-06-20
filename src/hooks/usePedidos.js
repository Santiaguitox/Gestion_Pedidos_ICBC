import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { registrarActividad } from '@/hooks/useActividad'
import { TIPO_ACTIVIDAD } from '@/lib/constants'

function limpiarCampos(data) {
  const limpio = { ...data }
  if (limpio.cantidad_envios === '' || limpio.cantidad_envios === undefined) limpio.cantidad_envios = null
  if (limpio.instancia === '') limpio.instancia = null
  if (limpio.tipo_envio === '') limpio.tipo_envio = null
  if (limpio.tipo_envio_otro === '') limpio.tipo_envio_otro = null
  if (limpio.fecha_limite === '') limpio.fecha_limite = null
  if (limpio.fecha_programacion === '') limpio.fecha_programacion = null
  if (limpio.hora_programacion === '') limpio.hora_programacion = null
  // tipo y prioridad son NOT NULL con CHECK en la base — un '' los viola.
  // El formulario ya preselecciona un valor válido, esto es solo respaldo.
  if (limpio.tipo === '') limpio.tipo = 'creacion_email'
  if (limpio.prioridad === '') limpio.prioridad = 'media'
  return limpio
}

// Wrapper silencioso para registrarActividad — nunca rompe el flujo principal
async function logActividad(...args) {
  try {
    await registrarActividad(...args)
  } catch (err) {
    console.warn('[actividad]', err)
  }
}

export function usePedidos(filters = {}) {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Función pura: solo busca los datos y los devuelve (o lanza si falla).
  // No toca ningún setState — así el setState queda visible en cada
  // callsite (más abajo) en vez de escondido dentro de esta función,
  // que es lo que necesita el linter para verificar que está bien
  // diferido respecto al cuerpo síncrono del efecto que la invoca.
  const queryPedidos = useCallback(async () => {
    let query = supabase
      .from('pedidos')
      .select('*, pedido_asignados(user_id, profiles(id,full_name,role)), subtareas(*), entregable(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (filters.prioridad) query = query.eq('prioridad', filters.prioridad)
    if (filters.tipo)      query = query.eq('tipo', filters.tipo)
    if (filters.search)    query = query.ilike('asunto', `%${filters.search}%`)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data ?? []
  }, [filters.prioridad, filters.tipo, filters.search])

  // Wrapper usado por las mutaciones (crearPedido, actualizarPedido, etc.)
  // y por quien necesite forzar un refetch manual sin pasar por loading.
  const fetchPedidos = useCallback(async () => {
    try {
      const data = await queryPedidos()
      setError(null)
      setPedidos(data)
    } catch (err) {
      setError(err.message)
    }
  }, [queryPedidos])

  // loading arranca en true (useState arriba) para la carga inicial, así
  // que no hace falta prenderlo ahí. Para los refetches *por cambio de
  // filtro* sí queremos mostrar loading de nuevo (puede tardar con muchos
  // pedidos); el realtime, en cambio, refresca en silencio sin loading
  // para que la lista no "parpadee" cada vez que alguien más edita algo.
  const filtrosKey = `${filters.prioridad ?? ''}|${filters.tipo ?? ''}|${filters.search ?? ''}`
  const esPrimeraCarga = useRef(true)
  useEffect(() => {
    if (!esPrimeraCarga.current) setLoading(true)
    esPrimeraCarga.current = false
    queryPedidos()
      .then(data => { setError(null); setPedidos(data) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [filtrosKey, queryPedidos])

  useEffect(() => {
    const ch = supabase
      .channel(`pedidos-rt-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        queryPedidos()
          .then(data => { setError(null); setPedidos(data) })
          .catch(err => setError(err.message))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [queryPedidos])

  async function crearPedido(data) {
    const { asignados, ...rest } = data
    const campos = limpiarCampos(rest)
    const { data: nuevo, error } = await supabase
      .from('pedidos').insert({ ...campos, created_by: user?.id }).select().single()
    if (error) throw error
    if (asignados?.length) {
      // La notificación de "te asignaron al pedido" la genera el trigger
      // trg_notif_asignacion en la base (excluye automáticamente a quien
      // hizo la asignación). No insertar notificación manual aquí para
      // evitar duplicados.
      await supabase.from('pedido_asignados').insert(asignados.map(uid => ({ pedido_id: nuevo.id, user_id: uid })))
    }
    await logActividad(nuevo.id, user?.id, TIPO_ACTIVIDAD.CREACION)
    // No se llama a fetchPedidos() aquí: la suscripción realtime (más abajo)
    // ya reacciona al INSERT en la tabla pedidos y refresca la lista sola.
    // Llamarlo también acá duplicaba el fetch completo en cada mutación.
    return nuevo
  }

  async function actualizarPedido(id, data) {
    const { asignados, ...rest } = data
    const campos = limpiarCampos(rest)
    const { data: anterior } = await supabase
      .from('pedidos').select('prioridad, estados, asunto, pedido_asignados(user_id, profiles(full_name))').eq('id', id).single()
    const { error } = await supabase.from('pedidos').update(campos).eq('id', id)
    if (error) throw error

    if (campos.prioridad && anterior?.prioridad !== campos.prioridad) {
      await logActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_PRIORIDAD, { anterior: anterior.prioridad, nuevo: campos.prioridad })
    }
    if (campos.estados) {
      const anteriores = anterior?.estados ?? []
      if (JSON.stringify([...anteriores].sort()) !== JSON.stringify([...campos.estados].sort())) {
        await logActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_ESTADO, { anteriores, nuevos: campos.estados })
      }
    }
    if (asignados !== undefined) {
      const idsAnteriores = (anterior?.pedido_asignados ?? []).map(a => a.user_id)
      const agregados = asignados.filter(uid => !idsAnteriores.includes(uid))
      const removidos = idsAnteriores.filter(uid => !asignados.includes(uid))
      // Se tocan solo las filas que realmente cambian (no se borra/reinserta
      // todo) para que el trigger trg_notif_asignacion no le mande
      // "te asignaron al pedido" de nuevo a alguien que ya estaba asignado.
      if (removidos.length) {
        await supabase.from('pedido_asignados').delete().eq('pedido_id', id).in('user_id', removidos)
      }
      if (agregados.length) {
        await supabase.from('pedido_asignados').insert(agregados.map(uid => ({ pedido_id: id, user_id: uid })))
      }
      if (agregados.length || removidos.length) {
        const { data: perfiles } = await supabase.from('profiles').select('id, full_name').in('id', [...agregados, ...removidos])
        const nombre = uid => perfiles?.find(p => p.id === uid)?.full_name ?? uid
        await logActividad(id, user?.id, TIPO_ACTIVIDAD.ASIGNACION, { agregados: agregados.map(nombre), removidos: removidos.map(nombre) })
      }
    }
    const camposEditados = Object.keys(campos).filter(k => !['prioridad', 'estados'].includes(k))
    if (camposEditados.length > 0) {
      await logActividad(id, user?.id, TIPO_ACTIVIDAD.EDICION)
    }
    // No se llama a fetchPedidos() aquí: la suscripción realtime ya
    // reacciona al UPDATE en pedidos y refresca la lista sola.
  }

  async function eliminarPedido(id) {
    const { error } = await supabase.from('pedidos')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id }).eq('id', id)
    if (error) throw error
    await logActividad(id, user?.id, TIPO_ACTIVIDAD.ELIMINACION)
    // No se llama a fetchPedidos() aquí: la suscripción realtime ya
    // reacciona al UPDATE en pedidos y refresca la lista sola.
  }

  async function restaurarPedido(id) {
    const { error } = await supabase.from('pedidos').update({ deleted_at: null, deleted_by: null }).eq('id', id)
    if (error) throw error
    await logActividad(id, user?.id, TIPO_ACTIVIDAD.RESTAURACION)
    // No se llama a fetchPedidos() aquí: la suscripción realtime ya
    // reacciona al UPDATE en pedidos y refresca la lista sola.
  }

  return { pedidos, loading, error, crearPedido, actualizarPedido, eliminarPedido, restaurarPedido, refetch: fetchPedidos }
}