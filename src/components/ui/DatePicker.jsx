import { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isSameMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

const AÑOS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i)
const MESES = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: format(new Date(2000, i, 1), 'MMMM', { locale: es })
}))

export function DatePicker({ value, onChange, placeholder = 'Seleccionar fecha', disabled }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [viewDate, setViewDate] = useState(value ? new Date(value + 'T00:00:00') : new Date())
  const [mode, setMode] = useState('days') // 'days' | 'months' | 'years'
  const btnRef = useRef(null)
  const ref = useRef(null)

  const selected = value ? new Date(value + 'T00:00:00') : undefined
  const today = new Date()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setMode('days')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpen() {
    if (disabled) return
    const rect = btnRef.current.getBoundingClientRect()
    const calH = 320
    const calW = 280
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const top = spaceBelow >= calH || spaceBelow >= spaceAbove
      ? rect.bottom + 6
      : rect.top - calH - 6
    const left = rect.left + calW > window.innerWidth
      ? window.innerWidth - calW - 8
      : rect.left
    setCoords({ top, left })
    setOpen(v => !v)
    setMode('days')
  }

  function handleSelectDay(day) {
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
    setMode('days')
  }

  // Días del mes con offset para empezar en lunes
  const firstDay = startOfMonth(viewDate)
  const lastDay = endOfMonth(viewDate)
  const days = eachDayOfInterval({ start: firstDay, end: lastDay })
  const startOffset = (getDay(firstDay) + 6) % 7 // lunes = 0

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        title={placeholder}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '0.375rem',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem',
          fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 400,
          color: 'var(--text-muted)', cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 150ms ease',
        }}
      >
        <Calendar size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        {selected ? format(selected, "d 'de' MMMM yyyy", { locale: es }) : placeholder}
      </button>
      {selected && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Quitar fecha"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', flexShrink: 0,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-elevated)', color: 'var(--text-muted)',
            cursor: 'pointer', transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--icbc-red)'; e.currentTarget.style.color = 'var(--icbc-red)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <X size={13} />
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          width: '280px', overflow: 'hidden',
        }}>

          {/* Header navegación */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.875rem 1rem 0.75rem', borderBottom: '1px solid var(--border)',
          }}>
            <button onClick={() => setViewDate(subMonths(viewDate, 1))}
              style={{ display:'flex', alignItems:'center', padding:'0.25rem', borderRadius:'var(--radius-sm)', color:'var(--text-muted)', transition:'all 150ms' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronLeft size={16} />
            </button>

            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {/* Selector de mes */}
              <button
                onClick={() => setMode(mode === 'months' ? 'days' : 'months')}
                style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700,
                  color: mode === 'months' ? 'var(--icbc-red)' : 'var(--text-primary)',
                  padding: '0.2rem 0.375rem', borderRadius: 'var(--radius-sm)',
                  textTransform: 'capitalize', transition: 'all 150ms',
                  background: mode === 'months' ? 'rgba(208,17,27,0.08)' : 'transparent',
                }}
                onMouseEnter={e => { if (mode !== 'months') e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (mode !== 'months') e.currentTarget.style.background = 'transparent' }}
              >
                {format(viewDate, 'MMMM', { locale: es })}
              </button>

              {/* Selector de año */}
              <button
                onClick={() => setMode(mode === 'years' ? 'days' : 'years')}
                style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700,
                  color: mode === 'years' ? 'var(--icbc-red)' : 'var(--text-primary)',
                  padding: '0.2rem 0.375rem', borderRadius: 'var(--radius-sm)',
                  transition: 'all 150ms',
                  background: mode === 'years' ? 'rgba(208,17,27,0.08)' : 'transparent',
                }}
                onMouseEnter={e => { if (mode !== 'years') e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (mode !== 'years') e.currentTarget.style.background = 'transparent' }}
              >
                {format(viewDate, 'yyyy')}
              </button>
            </div>

            <button onClick={() => setViewDate(addMonths(viewDate, 1))}
              style={{ display:'flex', alignItems:'center', padding:'0.25rem', borderRadius:'var(--radius-sm)', color:'var(--text-muted)', transition:'all 150ms' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Vista meses */}
          {mode === 'months' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem', padding: '0.75rem' }}>
              {MESES.map(m => {
                const isActive = m.value === viewDate.getMonth()
                return (
                  <button key={m.value}
                    onClick={() => { setViewDate(new Date(viewDate.getFullYear(), m.value, 1)); setMode('days') }}
                    style={{
                      padding: '0.5rem 0.25rem', borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem', textTransform: 'capitalize', transition: 'all 150ms',
                      fontWeight: isActive ? 700 : 400,
                      background: isActive ? 'var(--icbc-red)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    {m.label.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          )}

          {/* Vista años */}
          {mode === 'years' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem', padding: '0.75rem' }}>
              {AÑOS.map(y => {
                const isActive = y === viewDate.getFullYear()
                return (
                  <button key={y}
                    onClick={() => { setViewDate(new Date(y, viewDate.getMonth(), 1)); setMode('days') }}
                    style={{
                      padding: '0.5rem 0.25rem', borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem', transition: 'all 150ms',
                      fontWeight: isActive ? 700 : 400,
                      background: isActive ? 'var(--icbc-red)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    {y}
                  </button>
                )
              })}
            </div>
          )}

          {/* Vista días */}
          {mode === 'days' && (
            <div style={{ padding: '0.75rem' }}>
              {/* Cabecera días semana */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '0.375rem' }}>
                {['lu','ma','mi','ju','vi','sá','do'].map(d => (
                  <div key={d} style={{
                    textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600,
                    color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '0.25rem 0',
                  }}>{d}</div>
                ))}
              </div>

              {/* Grid de días */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
                {days.map(day => {
                  const isSelected = selected && isSameDay(day, selected)
                  const isToday = isSameDay(day, today)
                  const isCurrentMonth = isSameMonth(day, viewDate)

                  return (
                    <button key={day.toISOString()} onClick={() => handleSelectDay(day)}
                      style={{
                        position: 'relative',
                        width: '100%', aspectRatio: '1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)',
                        fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                        background: isSelected ? 'var(--icbc-red)' : 'transparent',
                        color: isSelected ? '#fff' : !isCurrentMonth ? 'var(--text-muted)' : 'var(--text-primary)',
                        opacity: !isCurrentMonth ? 0.35 : 1,
                        transition: 'all 150ms',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      {format(day, 'd')}
                      {/* Circulito para el día de hoy */}
                      {isToday && !isSelected && (
                        <span style={{
                          position: 'absolute', bottom: '3px', left: '50%',
                          transform: 'translateX(-50%)',
                          width: '4px', height: '4px', borderRadius: '50%',
                          background: 'var(--icbc-red)',
                        }} />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Botón hoy */}
              <div style={{ marginTop: '0.625rem', paddingTop: '0.625rem', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => { handleSelectDay(today) }}
                  style={{
                    width: '100%', padding: '0.4rem', borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem', fontWeight: 600, color: 'var(--icbc-red)',
                    background: 'rgba(208,17,27,0.06)', transition: 'all 150ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(208,17,27,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(208,17,27,0.06)'}
                >
                  Seleccionar hoy
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}