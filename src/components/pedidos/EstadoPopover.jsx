import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarActividad } from '@/hooks/useActividad'
import { ROLES, TIPO_ACTIVIDAD } from '@/lib/constants'

export function EstadoPopover({ pedido, id, role, user, onUpdate, estados = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const estadosActivos = pedido.estados ?? []
  const canEdit = role !== ROLES.VIEWER

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function toggle(valor) {
    const anteriores = [...estadosActivos]
    let nuevos
    if (valor === 'finalizado') {
      nuevos = estadosActivos.includes('finalizado') ? [] : ['finalizado']
    } else {
      nuevos = estadosActivos.includes(valor)
        ? estadosActivos.filter(x => x !== valor)
        : [...estadosActivos.filter(x => x !== 'finalizado'), valor]
    }
    await supabase.from('pedidos').update({ estados: nuevos }).eq('id', id)
    await registrarActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_ESTADO, { anteriores, nuevos })
    onUpdate()
  }

  return (
    <div ref={ref} className="estado-popover">
      <button onClick={() => setOpen(v => !v)} disabled={!canEdit}
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
