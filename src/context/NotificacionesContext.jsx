import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const NotificacionesContext = createContext(null)
const LIMITE_NOTIFICACIONES = 50
const FEEDBACK_DURATION = 4000

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
  const [feedback, setFeedback] = useState(null) // { type: 'success'|'error'|'info', message: string }
  const sonidoActivo = useRef(localStorage.getItem('notif:sonido') !== 'false')
  const feedbackTimer = useRef(null)

  async function fetchNotificaciones() {
    if (!user) return
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60)

    const todas = data ?? []

    if (todas.length > LIMITE_NOTIFICACIONES) {
      const aEliminar = todas.slice(LIMITE_NOTIFICACIONES)
      const ids = aEliminar.map(n => n.id)
      await supabase.from('notificaciones').delete().in('id', ids)
      const visibles = todas.slice(0, LIMITE_NOTIFICACIONES)
      setNotificaciones(visibles)
      setUnreadCount(visibles.filter(n => !n.leida).length)
    } else {
      setNotificaciones(todas)
      setUnreadCount(todas.filter(n => !n.leida).length)
    }
  }

  function handleNueva(payload) {
    fetchNotificaciones()
    const n = payload.new
    if (!n) return
    setToast(n)
    setTimeout(() => setToast(null), 10000)
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

  // ─── Feedback toasts (success / error / info) ─────────────────────────────

  const showFeedback = useCallback((type, message) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    setFeedback({ type, message })
    feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION)
  }, [])

  const showSuccess = useCallback((message) => showFeedback('success', message), [showFeedback])
  const showError   = useCallback((message) => showFeedback('error',   message), [showFeedback])
  const showInfo    = useCallback((message) => showFeedback('info',    message), [showFeedback])
  const dismissFeedback = useCallback(() => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    setFeedback(null)
  }, [])

  // ─── Notificaciones ───────────────────────────────────────────────────────

  async function marcarLeida(id) {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  async function marcarNoLeida(id) {
    await supabase.from('notificaciones').update({ leida: false }).eq('id', id)
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: false } : n))
    setUnreadCount(c => c + 1)
  }

  async function marcarTodasLeidas() {
    if (!user) return
    await supabase.from('notificaciones').update({ leida: true }).eq('user_id', user.id).eq('leida', false)
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
    setUnreadCount(0)
  }

  async function marcarTodasNoLeidas() {
    if (!user) return
    await supabase.from('notificaciones').update({ leida: false }).eq('user_id', user.id).eq('leida', true)
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: false })))
    setUnreadCount(notificaciones.length)
  }

  async function eliminar(id) {
    await supabase.from('notificaciones').delete().eq('id', id)
    const eliminada = notificaciones.find(n => n.id === id)
    setNotificaciones(prev => prev.filter(n => n.id !== id))
    if (eliminada && !eliminada.leida) setUnreadCount(c => Math.max(0, c - 1))
  }

  async function eliminarVarias(ids) {
    await supabase.from('notificaciones').delete().in('id', ids)
    const noLeidas = notificaciones.filter(n => ids.includes(n.id) && !n.leida).length
    setNotificaciones(prev => prev.filter(n => !ids.includes(n.id)))
    setUnreadCount(c => Math.max(0, c - noLeidas))
  }

  async function eliminarTodas() {
    if (!user) return
    await supabase.from('notificaciones').delete().eq('user_id', user.id)
    setNotificaciones([])
    setUnreadCount(0)
  }

  function toggleSonido() {
    sonidoActivo.current = !sonidoActivo.current
    localStorage.setItem('notif:sonido', sonidoActivo.current ? 'true' : 'false')
    return sonidoActivo.current
  }

  return (
    <NotificacionesContext.Provider value={{
      notificaciones, unreadCount, toast,
      dismissToast: () => setToast(null),
      marcarLeida, marcarNoLeida,
      marcarTodasLeidas, marcarTodasNoLeidas,
      eliminar, eliminarVarias, eliminarTodas,
      toggleSonido, sonidoActivo: sonidoActivo.current,
      // Feedback
      feedback, showSuccess, showError, showInfo, dismissFeedback,
    }}>
      {children}
    </NotificacionesContext.Provider>
  )
}

export function useNotificaciones() {
  return useContext(NotificacionesContext)
}