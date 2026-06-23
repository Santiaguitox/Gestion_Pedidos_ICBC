import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Acordeón con ícono circular de color + badge — usado en las 4
// secciones de Detalle de Pedido (Detalles del pedido, Subtareas,
// Piezas, Historial). Reemplaza al <Section> genérico solo en esta
// pantalla; Section.jsx queda intacto por si se reusa en otro lado.
export function DetalleAcordeon({ icon, iconColor, iconBg, title, badge, badgeColor, badgeBg, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="det-acc">
      <button onClick={() => setOpen(v => !v)} className="det-acc-header">
        <span className="det-acc-icon" style={{ color: iconColor, background: iconBg }}>{icon}</span>
        <span className="det-acc-title">{title}</span>
        {badge != null && (
          <span className="det-acc-badge" style={{ color: badgeColor, background: badgeBg }}>{badge}</span>
        )}
        <ChevronDown size={18} className="det-acc-chevron" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && <div className="det-acc-body">{children}</div>}
    </div>
  )
}
