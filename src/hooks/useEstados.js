import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

let cache = null
let listeners = []

function notify(data) {
  cache = data
  listeners.forEach(fn => fn(data))
}

export function useEstados() {
  const [estados, setEstados] = useState(cache ?? [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    listeners.push(setEstados)
    if (!cache) {
      fetchEstados()
    }
    return () => { listeners = listeners.filter(fn => fn !== setEstados) }
  }, [])

  async function fetchEstados() {
    setLoading(true)
    const { data } = await supabase
      .from('estados')
      .select('*')
      .order('orden', { ascending: true })
    notify(data ?? [])
    setLoading(false)
  }

  async function refetch() {
    cache = null
    await fetchEstados()
  }

  return { estados, loading, refetch }
}