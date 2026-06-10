import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export function useNotificaciones() {
  const { user } = useAuth()
  const [notificaciones, setNotificaciones] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function fetchNotificaciones() {
    if (!user) return
    const { data } = await supabase.from('notificaciones').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    setNotificaciones(data ?? [])
    setUnreadCount((data ?? []).filter(n => !n.leida).length)
  }

  useEffect(() => {
    fetchNotificaciones()
    if (!user) return
    const ch = supabase.channel('notif-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${user.id}` }, fetchNotificaciones)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id])

  async function marcarLeida(id) {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  async function marcarTodasLeidas() {
    if (!user) return
    await supabase.from('notificaciones').update({ leida: true }).eq('user_id', user.id).eq('leida', false)
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
    setUnreadCount(0)
  }

  return { notificaciones, unreadCount, marcarLeida, marcarTodasLeidas }
}
