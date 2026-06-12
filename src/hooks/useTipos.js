import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

let cache = null
let listeners = []

function notify(data) {
  cache = data
  listeners.forEach(fn => fn(data))
}

export function useTipos() {
  const [tipos, setTipos] = useState(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    listeners.push(setTipos)
    if (!cache) fetchTipos()
    return () => { listeners = listeners.filter(fn => fn !== setTipos) }
  }, [])

  async function fetchTipos() {
    setLoading(true)
    const { data } = await supabase.from('tipos').select('*').order('orden', { ascending: true })
    notify(data ?? [])
    setLoading(false)
  }

  async function refetch() {
    cache = null
    await fetchTipos()
  }

  return { tipos, loading, refetch }
}