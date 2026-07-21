import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useNotificaciones } from '@/context/useNotificaciones'
import { logActividad } from '@/hooks/useActividad'
import { ROLES, TIPO_ACTIVIDAD } from '@/lib/constants'

// Los toggles se acumulan localmente y se commitea UN solo UPDATE con el
// estado final, DEBOUNCE_MS después del último click (o al cerrar el
// popover, lo que ocurra primero). Así una transición A -> B (dos clicks)
// genera un solo UPDATE en la base -> una sola notificación y una sola
// entrada de actividad, sin estados intermedios.
const DEBOUNCE_MS = 800

export function EstadoPopover({ pedido, id, role, user, onUpdate, estados = [] }) {
  const { showError } = useNotificaciones()
  const [open, setOpen] = useState(false)
  // Cambios locales todavía no commiteados (null = sin cambios pendientes)
  const [pendientes, setPendientes] = useState(null)
  const ref = useRef(null)
  const timerRef = useRef(null)
  const pendRef = useRef(null)        // espejo de `pendientes` — solo para el preview optimista
  const anterioresRef = useRef(null)  // estados originales al iniciar el batch (para el log de actividad)
  const togglesRef = useRef(null)     // secuencia CRUDA de estados tocados, en orden — lo que se manda a la RPC
  const commitRef = useRef(() => {})  // versión fresca de commit para listeners/cleanup

  const estadosActivos = pendientes ?? pedido.estados ?? []
  const canEdit = role !== ROLES.VIEWER

  async function commit() {
    clearTimeout(timerRef.current)
    const nuevosLocal = pendRef.current
    const toggles = togglesRef.current
    if (!nuevosLocal || !toggles?.length) return
    const anteriores = anterioresRef.current ?? []
    pendRef.current = null
    anterioresRef.current = null
    togglesRef.current = null

    // Si el preview local neto es igual al original (ej: activó y
    // desactivó lo mismo dentro del batch), no hay nada que mandar a la
    // base — optimización pura, no afecta la corrección: aunque el
    // snapshot local esté viejo, un batch que localmente cancela contra
    // sí mismo cancela igual al aplicarse contra cualquier estado real.
    const setAnterior = [...anteriores].sort().join('|')
    const setNuevoLocal = [...nuevosLocal].sort().join('|')
    if (setAnterior === setNuevoLocal) {
      setPendientes(null)
      return
    }

    // La RPC hace el replay de los toggles CONTRA EL VALOR VIGENTE en la
    // base (row lockeado con FOR UPDATE, todo en una transacción) — no
    // contra este snapshot local, que puede tener minutos de antigüedad
    // (el detalle no tiene realtime). Así se elimina la carrera de raíz:
    // no importa qué tan vieja esté la pantalla, no hay forma de pisar
    // el cambio de otra persona.
    const { data, error } = await supabase.rpc('aplicar_toggles_estado_pedido', {
      p_pedido_id: id,
      p_toggles: toggles,
    })
    if (error || !data) {
      // La base no cambió: se revierte el preview local para que la UI
      // no mienta, y no se registra actividad de algo que no pasó.
      setPendientes(null)
      showError('No se pudo actualizar el estado del pedido')
      return
    }

    const nuevos = data.estados ?? []
    const setNuevoReal = [...nuevos].sort().join('|')
    if (setAnterior !== setNuevoReal) {
      await logActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_ESTADO, { anteriores, nuevos })
    }
    setPendientes(null)
    onUpdate()
  }

  // Patrón "latest ref": la asignación corre después de cada render (no
  // durante — React 19 lo prohíbe), así los listeners y cleanups de
  // abajo siempre invocan la versión fresca de commit sin closures viejas.
  useEffect(() => {
    commitRef.current = commit
  })

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        commitRef.current() // flush al cerrar clickeando afuera
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      commitRef.current() // flush si el componente se desmonta con cambios pendientes
    }
  }, [])

  function toggleOpen() {
    if (open) commitRef.current() // flush al cerrar desde el trigger
    setOpen(v => !v)
  }

  function toggle(valor) {
    // Al primer toggle del batch, guardar el estado original para el
    // registro de actividad ({ anteriores, nuevos }).
    if (pendRef.current == null) anterioresRef.current = [...(pedido.estados ?? [])]
    if (togglesRef.current == null) togglesRef.current = []
    togglesRef.current.push(valor)

    const base = pendRef.current ?? pedido.estados ?? []
    let nuevos
    if (valor === 'finalizado') {
      nuevos = base.includes('finalizado') ? [] : ['finalizado']
    } else {
      nuevos = base.includes(valor)
        ? base.filter(x => x !== valor)
        : [...base.filter(x => x !== 'finalizado'), valor]
    }
    pendRef.current = nuevos
    setPendientes(nuevos)

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => commitRef.current(), DEBOUNCE_MS)
  }

  return (
    <div ref={ref} className="estado-popover">
      <button onClick={toggleOpen} disabled={!canEdit}
        className="estado-popover-trigger"
        style={{ opacity: !canEdit ? 0.5 : 1, cursor: !canEdit ? 'default' : 'pointer' }}>
        Actualizar estado
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>
      {open && (
        <div className="estado-popover-menu">
          <p className="estado-popover-label">Togglear estados</p>
          {estados.map(e => {
            const active = estadosActivos.includes(e.value)
            return (
              <button key={e.value} onClick={() => toggle(e.value)}
                className="estado-popover-item"
                style={{ background: active ? `${e.color}12` : 'transparent', color: active ? e.color : 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                onMouseEnter={ev => { if (!active) ev.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={ev => { if (!active) ev.currentTarget.style.background = 'transparent' }}>
                <span className="estado-dot" style={{ background: active ? e.color : 'var(--border)', border: `2px solid ${active ? e.color : 'var(--border-strong)'}` }} />
                {e.label}
                {active && <span className="estado-check" style={{ color: e.color }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
