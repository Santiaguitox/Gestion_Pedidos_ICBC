import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Acordeón con ícono circular de color + badge — usado en las 4
// secciones de Detalle de Pedido (Detalles del pedido, Subtareas,
// Piezas, Historial). Reemplaza al <Section> genérico solo en esta
// pantalla; Section.jsx queda intacto por si se reusa en otro lado.
export function DetalleAcordeon({ id, icon, iconColor, iconBg, title, badge, badgeColor, badgeBg, defaultOpen = true, headerAction, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div id={id} className="det-acc">
      <div className="det-acc-header-wrap">
        <button onClick={() => setOpen(v => !v)} className="det-acc-header">
          <span className="det-acc-icon" style={{ color: iconColor, background: iconBg }}>{icon}</span>
          <span className="det-acc-title">{title}</span>
          {badge != null && (
            <span className="det-acc-badge" style={{ color: badgeColor, background: badgeBg }}>{badge}</span>
          )}
          <ChevronDown size={18} className="det-acc-chevron" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </button>
        {headerAction && <div className="det-acc-header-action" onClick={e => e.stopPropagation()}>{headerAction}</div>}
      </div>
      <div className={`acordeon-anim${open ? ' abierto' : ''}`}>
        <div className="acordeon-anim-clip">
          <div className="det-acc-body">{children}</div>
        </div>
      </div>
    </div>
  )
}
