import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarActividad } from '@/hooks/useActividad'
import { ROLES, TIPO_ACTIVIDAD } from '@/lib/constants'

// Los toggles se acumulan localmente y se commitea UN solo UPDATE con el
// estado final, DEBOUNCE_MS después del último click (o al cerrar el
// popover, lo que ocurra primero). Así una transición A -> B (dos clicks)
// genera un solo UPDATE en la base -> una sola notificación y una sola
// entrada de actividad, sin estados intermedios.
const DEBOUNCE_MS = 800

export function EstadoPopover({ pedido, id, role, user, onUpdate, estados = [] }) {
  const [open, setOpen] = useState(false)
  // Cambios locales todavía no commiteados (null = sin cambios pendientes)
  const [pendientes, setPendientes] = useState(null)
  const ref = useRef(null)
  const timerRef = useRef(null)
  const pendRef = useRef(null)        // espejo de `pendientes` para leer en callbacks
  const anterioresRef = useRef(null)  // estados originales al iniciar el batch
  const commitRef = useRef(() => {})  // versión fresca de commit para listeners/cleanup

  const estadosActivos = pendientes ?? pedido.estados ?? []
  const canEdit = role !== ROLES.VIEWER

  async function commit() {
    clearTimeout(timerRef.current)
    const nuevos = pendRef.current
    if (!nuevos) return
    const anteriores = anterioresRef.current ?? []
    pendRef.current = null
    anterioresRef.current = null

    // Si el resultado final es el mismo set de estados que el original
    // (ej: activó y desactivó lo mismo), no hay nada que persistir.
    const setAnterior = [...anteriores].sort().join('|')
    const setNuevo = [...nuevos].sort().join('|')
    if (setAnterior === setNuevo) {
      setPendientes(null)
      return
    }

    await supabase.from('pedidos').update({ estados: nuevos }).eq('id', id)
    await registrarActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_ESTADO, { anteriores, nuevos })
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
