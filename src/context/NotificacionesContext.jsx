import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const NotificacionesContext = createContext(null)

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
  } catch {}
}

export function NotificacionesProvider({ children }) {
  const { user } = useAuth()
  const [notificaciones, setNotificaciones] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [toast, setToast] = useState(null)
  const sonidoActivo = useRef(localStorage.getItem('notif:sonido') !== 'false')

  async function fetchNotificaciones() {
    if (!user) return
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotificaciones(data ?? [])
    setUnreadCount((data ?? []).filter(n => !n.leida).length)
  }

  function handleNueva(payload) {
    fetchNotificaciones()
    const n = payload.new
    if (!n) return
    setToast(n)
    setTimeout(() => setToast(null), 5000)
    if (document.hidden && sonidoActivo.current) playNotifSound()
  }

  useEffect(() => {
    if (!user) return
    fetchNotificaciones()
    const chName = 'notif-' + user.id + '-' + Date.now()
    const ch = supabase
      .channel(chName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${user.id}` }, handleNueva)
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

  function toggleSonido() {
    sonidoActivo.current = !sonidoActivo.current
    localStorage.setItem('notif:sonido', sonidoActivo.current ? 'true' : 'false')
    return sonidoActivo.current
  }

  return (
    <NotificacionesContext.Provider value={{ notificaciones, unreadCount, toast, dismissToast: () => setToast(null), marcarLeida, marcarTodasLeidas, toggleSonido, sonidoActivo: sonidoActivo.current }}>
      {children}
    </NotificacionesContext.Provider>
  )
}

export function useNotificaciones() {
  return useContext(NotificacionesContext)
}