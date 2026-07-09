import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { contarNoLeidas } from '@/lib/notificaciones'

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
  const [toast, setToast] = useState(null)
  const [feedback, setFeedback] = useState(null) // { type: 'success'|'error'|'info', message: string }
  const [sonidoActivo, setSonidoActivo] = useState(() => localStorage.getItem('notif:sonido') !== 'false')
  const feedbackTimer = useRef(null)

  // El contador del badge se DERIVA de la lista (una sola fuente de
  // verdad, sin contadores manuales que puedan desincronizarse) y
  // cuenta GRUPOS no leídos, no filas: una ráfaga de cambios de estado
  // del mismo pedido es 1 pendiente. Ver src/lib/notificaciones.js.
  const unreadCount = useMemo(() => contarNoLeidas(notificaciones), [notificaciones])

  // Función pura: trae y depura el exceso de notificaciones (sin tocar
  // estado). Devuelve la lista final (ya recortada a LIMITE_NOTIFICACIONES)
  // para que cada callsite decida qué hacer con el setState.
  const queryNotificaciones = useCallback(async () => {
    if (!user) return []
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60)

    const todas = data ?? []
    if (todas.length > LIMITE_NOTIFICACIONES) {
      const aEliminar = todas.slice(LIMITE_NOTIFICACIONES)
      // Best-effort: si el prune falla no hay nada útil que mostrarle
      // al usuario — se reintenta solo en la próxima carga.
      const { error } = await supabase.from('notificaciones').delete().in('id', aEliminar.map(n => n.id))
      if (error) console.warn('[notificaciones] No se pudo depurar el excedente:', error.message)
      return todas.slice(0, LIMITE_NOTIFICACIONES)
    }
    return todas
  }, [user])

  async function fetchNotificaciones() {
    setNotificaciones(await queryNotificaciones())
  }

  function handleNueva(payload) {
    fetchNotificaciones()
    const n = payload.new
    if (!n) return
    setToast(n)
    setTimeout(() => setToast(null), 10000)
    if (document.hidden && sonidoActivo) playNotifSound()
  }

  useEffect(() => {
    if (!user) return
    queryNotificaciones().then(setNotificaciones)
    const chName = 'notif-' + user.id + '-' + Date.now()
    const ch = supabase
      .channel(chName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${user.id}` }, handleNueva)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id, queryNotificaciones])

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
  // Todas las mutaciones actualizan SOLO la lista; el contador se deriva.
  // Las variantes "Varias" son un único request batcheado (.in), no un
  // request por id — las usan las acciones de grupo y las masivas.
  //
  // Manejo de errores en dos capas (supabase-js NUNCA lanza: siempre
  // resuelve { data, error }):
  //   Capa A — el server rechazó (constraint, red, permiso): viene en
  //   `error`.
  //   Capa B — RLS filtró en silencio (como el bug histórico de la
  //   policy DELETE faltante): NO viene error, la operación "funciona"
  //   sobre 0 filas. Se detecta pidiendo las filas afectadas con
  //   .select('id') y verificando que haya alguna.
  // En ambos casos: toast de error y SIN update optimista — la UI no
  // debe mostrar éxito sobre algo que no ocurrió. En las variantes
  // "Todas" afectar 0 filas puede ser legítimo (no había nada para
  // tocar), así que la Capa B solo cuenta si localmente sí había filas.

  async function marcarLeida(id) {
    const { data, error } = await supabase.from('notificaciones')
      .update({ leida: true }).eq('id', id).select('id')
    if (error || !data?.length) {
      showError('No se pudo marcar la notificación como leída')
      return
    }
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  async function marcarNoLeida(id) {
    const { data, error } = await supabase.from('notificaciones')
      .update({ leida: false }).eq('id', id).select('id')
    if (error || !data?.length) {
      showError('No se pudo marcar la notificación como no leída')
      return
    }
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: false } : n))
  }

  async function marcarVariasLeidas(ids) {
    if (!ids.length) return
    const { data, error } = await supabase.from('notificaciones')
      .update({ leida: true }).in('id', ids).select('id')
    if (error || !data?.length) {
      showError('No se pudieron marcar las notificaciones como leídas')
      return
    }
    const set = new Set(ids)
    setNotificaciones(prev => prev.map(n => set.has(n.id) ? { ...n, leida: true } : n))
  }

  async function marcarVariasNoLeidas(ids) {
    if (!ids.length) return
    const { data, error } = await supabase.from('notificaciones')
      .update({ leida: false }).in('id', ids).select('id')
    if (error || !data?.length) {
      showError('No se pudieron marcar las notificaciones como no leídas')
      return
    }
    const set = new Set(ids)
    setNotificaciones(prev => prev.map(n => set.has(n.id) ? { ...n, leida: false } : n))
  }

  async function marcarTodasLeidas() {
    if (!user) return
    const habiaNoLeidas = notificaciones.some(n => !n.leida)
    const { data, error } = await supabase.from('notificaciones')
      .update({ leida: true }).eq('user_id', user.id).eq('leida', false).select('id')
    if (error || (habiaNoLeidas && !data?.length)) {
      showError('No se pudieron marcar las notificaciones como leídas')
      return
    }
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
  }

  async function marcarTodasNoLeidas() {
    if (!user) return
    const habiaLeidas = notificaciones.some(n => n.leida)
    const { data, error } = await supabase.from('notificaciones')
      .update({ leida: false }).eq('user_id', user.id).eq('leida', true).select('id')
    if (error || (habiaLeidas && !data?.length)) {
      showError('No se pudieron marcar las notificaciones como no leídas')
      return
    }
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: false })))
  }

  async function eliminar(id) {
    const { data, error } = await supabase.from('notificaciones')
      .delete().eq('id', id).select('id')
    if (error || !data?.length) {
      showError('No se pudo eliminar la notificación')
      return
    }
    setNotificaciones(prev => prev.filter(n => n.id !== id))
  }

  async function eliminarVarias(ids) {
    if (!ids.length) return
    const { data, error } = await supabase.from('notificaciones')
      .delete().in('id', ids).select('id')
    if (error || !data?.length) {
      showError('No se pudieron eliminar las notificaciones')
      return
    }
    const set = new Set(ids)
    setNotificaciones(prev => prev.filter(n => !set.has(n.id)))
  }

  async function eliminarTodas() {
    if (!user) return
    const habiaFilas = notificaciones.length > 0
    const { data, error } = await supabase.from('notificaciones')
      .delete().eq('user_id', user.id).select('id')
    if (error || (habiaFilas && !data?.length)) {
      showError('No se pudieron eliminar las notificaciones')
      return
    }
    setNotificaciones([])
  }

  function toggleSonido() {
    const nuevoValor = !sonidoActivo
    setSonidoActivo(nuevoValor)
    localStorage.setItem('notif:sonido', nuevoValor ? 'true' : 'false')
    return nuevoValor
  }

  return (
    <NotificacionesContext.Provider value={{
      notificaciones, unreadCount, toast,
      dismissToast: () => setToast(null),
      marcarLeida, marcarNoLeida,
      marcarVariasLeidas, marcarVariasNoLeidas,
      marcarTodasLeidas, marcarTodasNoLeidas,
      eliminar, eliminarVarias, eliminarTodas,
      toggleSonido, sonidoActivo,
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
