import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

let cache = null
let listeners = []

function notify(data) {
  cache = data
  listeners.forEach(fn => fn(data))
}

export function useInstancias() {
  const [instancias, setInstancias] = useState(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    listeners.push(setInstancias)
    if (!cache) fetchInstancias()
    return () => { listeners = listeners.filter(fn => fn !== setInstancias) }
  }, [])

  async function fetchInstancias() {
    setLoading(true)
    const { data } = await supabase
      .from('instancias')
      .select('*')
      .order('orden', { ascending: true })
    notify(data ?? [])
    setLoading(false)
  }

  async function refetch() {
    cache = null
    await fetchInstancias()
  }

  return { instancias, loading, refetch }
}