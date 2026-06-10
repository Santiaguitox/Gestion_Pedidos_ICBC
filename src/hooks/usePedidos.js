import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { registrarActividad } from '@/hooks/useActividad'
import { TIPO_ACTIVIDAD } from '@/lib/constants'

export function usePedidos(filters = {}) {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPedidos = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('pedidos')
      .select('*, pedido_asignados(user_id, profiles(id,full_name,role)), subtareas(*), entregable(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (filters.prioridad) query = query.eq('prioridad', filters.prioridad)
    if (filters.tipo)      query = query.eq('tipo', filters.tipo)
    if (filters.search)    query = query.ilike('asunto', `%${filters.search}%`)
    const { data, error } = await query
    if (error) setError(error.message)
    else setPedidos(data ?? [])
    setLoading(false)
  }, [filters.prioridad, filters.tipo, filters.search])

  useEffect(() => { fetchPedidos() }, [fetchPedidos])

  useEffect(() => {
    const ch = supabase
      .channel(`pedidos-rt-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchPedidos)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchPedidos])

  async function crearPedido(data) {
    const { asignados, ...rest } = data
    const { data: nuevo, error } = await supabase
      .from('pedidos').insert({ ...rest, created_by: user?.id }).select().single()
    if (error) throw error
    if (asignados?.length) {
      await supabase.from('pedido_asignados').insert(asignados.map(uid => ({ pedido_id: nuevo.id, user_id: uid })))
    }
    await registrarActividad(nuevo.id, user?.id, TIPO_ACTIVIDAD.CREACION)
    await fetchPedidos()
    return nuevo
  }

  async function actualizarPedido(id, data) {
    const { asignados, ...rest } = data
    const { data: anterior } = await supabase
      .from('pedidos').select('prioridad, estados, pedido_asignados(user_id, profiles(full_name))').eq('id', id).single()
    const { error } = await supabase.from('pedidos').update(rest).eq('id', id)
    if (error) throw error

    if (rest.prioridad && anterior?.prioridad !== rest.prioridad) {
      await registrarActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_PRIORIDAD, { anterior: anterior.prioridad, nuevo: rest.prioridad })
    }
    if (rest.estados) {
      const anteriores = anterior?.estados ?? []
      if (JSON.stringify([...anteriores].sort()) !== JSON.stringify([...rest.estados].sort())) {
        await registrarActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_ESTADO, { anteriores, nuevos: rest.estados })
      }
    }
    if (asignados !== undefined) {
      const idsAnteriores = (anterior?.pedido_asignados ?? []).map(a => a.user_id)
      const agregados = asignados.filter(uid => !idsAnteriores.includes(uid))
      const removidos = idsAnteriores.filter(uid => !asignados.includes(uid))
      await supabase.from('pedido_asignados').delete().eq('pedido_id', id)
      if (asignados.length) {
        await supabase.from('pedido_asignados').insert(asignados.map(uid => ({ pedido_id: id, user_id: uid })))
      }
      if (agregados.length || removidos.length) {
        const { data: perfiles } = await supabase.from('profiles').select('id, full_name').in('id', [...agregados, ...removidos])
        const nombre = uid => perfiles?.find(p => p.id === uid)?.full_name ?? uid
        await registrarActividad(id, user?.id, TIPO_ACTIVIDAD.ASIGNACION, { agregados: agregados.map(nombre), removidos: removidos.map(nombre) })
      }
    }
    const camposEditados = Object.keys(rest).filter(k => !['prioridad','estados'].includes(k))
    if (camposEditados.length > 0) {
      await registrarActividad(id, user?.id, TIPO_ACTIVIDAD.EDICION)
    }
    await fetchPedidos()
  }

  async function eliminarPedido(id) {
    const { error } = await supabase.from('pedidos')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id }).eq('id', id)
    if (error) throw error
    await registrarActividad(id, user?.id, TIPO_ACTIVIDAD.ELIMINACION)
    await fetchPedidos()
  }

  async function restaurarPedido(id) {
    const { error } = await supabase.from('pedidos').update({ deleted_at: null, deleted_by: null }).eq('id', id)
    if (error) throw error
    await registrarActividad(id, user?.id, TIPO_ACTIVIDAD.RESTAURACION)
    await fetchPedidos()
  }

  return { pedidos, loading, error, crearPedido, actualizarPedido, eliminarPedido, restaurarPedido, refetch: fetchPedidos }
}