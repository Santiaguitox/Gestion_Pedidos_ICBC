import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import 'react-day-picker/dist/style.css'

export function DatePicker({ value, onChange, placeholder = 'Seleccionar fecha', disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selected = value ? new Date(value + 'T00:00:00') : undefined

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(date) {
    if (date) onChange(format(date, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem',
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.875rem', cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 150ms ease',
        }}
      >
        <Calendar size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        {selected ? format(selected, "d 'de' MMMM yyyy", { locale: es }) : placeholder}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '0.75rem',
        }}>
          <style>{`
            .rdp { --rdp-accent-color: var(--icbc-red); --rdp-background-color: rgba(208,17,27,0.1); margin: 0; }
            .rdp-day_selected, .rdp-day_selected:hover { background: var(--icbc-red) !important; color: #fff !important; }
            .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background: var(--bg-hover) !important; }
            .rdp-head_cell { color: var(--text-muted); font-size: 0.75rem; font-weight: 600; }
            .rdp-day { color: var(--text-primary); border-radius: var(--radius-sm) !important; }
            .rdp-day_outside { color: var(--text-muted) !important; opacity: 0.4; }
            .rdp-caption_label { color: var(--text-primary); font-family: var(--font-display); font-weight: 600; }
            .rdp-nav_button { color: var(--text-secondary) !important; }
          `}</style>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={es}
            showOutsideDays
          />
        </div>
      )}
    </div>
  )
}