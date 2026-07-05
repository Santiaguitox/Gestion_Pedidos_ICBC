import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export function Section({ title, icon, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="section-accordion">
      <button onClick={() => setOpen(v => !v)} className="section-accordion-header">
        {icon && <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <span className="section-accordion-title">{title}</span>
        {badge != null && <span className="badge-count">{badge}</span>}
        {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
      </button>
      <div className={`acordeon-anim${open ? ' abierto' : ''}`}>
        <div className="acordeon-anim-clip">
          <div className="section-accordion-body">{children}</div>
        </div>
      </div>
    </div>
  )
}
