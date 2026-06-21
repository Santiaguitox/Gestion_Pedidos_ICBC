import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

let cache = null
let listeners = []

function notify(data) {
  cache = data
  listeners.forEach(fn => fn(data))
}

// Lista de usuarios (profiles) para popular selectores de "usuario
// asignado" — usado tanto en Dashboard.jsx como en Pedidos.jsx. Mismo
// patrón de caché compartido que useTipos/useEstados.
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    listeners.push(setUsuarios)
    if (!cache) fetchUsuarios()
    return () => { listeners = listeners.filter(fn => fn !== setUsuarios) }
  }, [])

  async function fetchUsuarios() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
    notify(data ?? [])
    setLoading(false)
  }

  async function refetch() {
    cache = null
    await fetchUsuarios()
  }

  return { usuarios, loading, refetch }
}
