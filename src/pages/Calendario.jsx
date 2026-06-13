import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePedidos } from '@/hooks/usePedidos'
import { PRIORIDADES } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isToday, isPast, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

export default function Calendario() {
  const navigate = useNavigate()
  const { pedidos } = usePedidos()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const startPad = (getDay(startOfMonth(currentDate)) + 6) % 7
  const pedidosConFecha = pedidos.filter(p => p.fecha_limite && !p.estados?.includes('finalizado'))
  const todosConFecha = pedidos.filter(p => p.fecha_limite)

  // Pedidos del día seleccionado o de hoy
  const diaRef = selectedDay ?? new Date()
  const pedidosDia = todosConFecha.filter(p => isSameDay(new Date(p.fecha_limite + 'T00:00:00'), diaRef))

  // Stats del mes
  const pedidosMes = todosConFecha.filter(p => {
    const d = new Date(p.fecha_limite + 'T00:00:00')
    return d >= startOfMonth(currentDate) && d <= endOfMonth(currentDate)
  })
  const vencidosMes = pedidosMes.filter(p => isPast(new Date(p.fecha_limite + 'T00:00:00')) && !p.estados?.includes('finalizado'))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Calendario</h1>
          <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:'0.125rem' }}>
            {pedidosMes.length} pedido{pedidosMes.length !== 1 ? 's' : ''} con fecha límite este mes
            {vencidosMes.length > 0 && <span style={{ color:'var(--icbc-red)', marginLeft:'0.5rem' }}>· {vencidosMes.length} vencido{vencidosMes.length !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <button onClick={() => { setCurrentDate(new Date()); setSelectedDay(null) }}
            style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', padding:'0.3rem 0.75rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
            Hoy
          </button>
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}
            style={{ color:'var(--text-secondary)', display:'flex', alignItems:'center', padding:'0.3rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'1rem', textTransform:'capitalize', minWidth:'160px', textAlign:'center' }}>
            {format(currentDate, "MMMM yyyy", { locale:es })}
          </span>
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}
            style={{ color:'var(--text-secondary)', display:'flex', alignItems:'center', padding:'0.3rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'1.5rem', alignItems:'start' }}>
        {/* Grilla del calendario */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'1px', background:'var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', border:'1px solid var(--border)' }}>
          {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
            <div key={d} style={{ background:'var(--bg-surface)', textAlign:'center', fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', padding:'0.625rem 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>{d}</div>
          ))}
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} style={{ background:'var(--bg-base)', minHeight:'90px' }} />)}
          {days.map(day => {
            const dayPedidos = pedidosConFecha.filter(p => isSameDay(new Date(p.fecha_limite + 'T00:00:00'), day))
            const todayFlag = isToday(day)
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const isPastDay = isPast(day) && !todayFlag
            const hasPedidos = dayPedidos.length > 0
            return (
              <div key={day.toISOString()}
                onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(-1)) ? null : day)}
                style={{ background: isSelected ? 'rgba(208,17,27,0.06)' : todayFlag ? 'rgba(208,17,27,0.03)' : 'var(--bg-surface)', minHeight:'90px', padding:'0.5rem', display:'flex', flexDirection:'column', gap:'0.25rem', cursor: hasPedidos ? 'pointer' : 'default', borderTop: isSelected ? '2px solid var(--icbc-red)' : '2px solid transparent', transition:'background 100ms' }}>
                <span style={{ fontSize:'0.8125rem', fontWeight:600, color: todayFlag ? '#fff' : isPastDay ? 'var(--text-muted)' : 'var(--text-secondary)', width:'22px', height:'22px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', background: todayFlag ? 'var(--icbc-red)' : 'transparent', flexShrink:0 }}>
                  {format(day, 'd')}
                </span>
                {dayPedidos.slice(0, 3).map(p => {
                  const prio = PRIORIDADES.find(x => x.value === p.prioridad)
                  return (
                    <div key={p.id}
                      onClick={e => { e.stopPropagation(); navigate(`/app/pedidos/${p.id}`) }}
                      style={{ borderLeft:`3px solid ${prio?.color ?? '#6B7280'}`, padding:'0.15rem 0.35rem', background:'var(--bg-elevated)', borderRadius:'0 3px 3px 0', cursor:'pointer', transition:'opacity 100ms' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                      <span style={{ fontSize:'0.6875rem', color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>{p.asunto}</span>
                    </div>
                  )
                })}
                {dayPedidos.length > 3 && (
                  <span style={{ fontSize:'0.6875rem', color:'var(--text-muted)', paddingLeft:'0.35rem' }}>+{dayPedidos.length - 3} más</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Panel lateral — pedidos del día */}
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
          <div style={{ padding:'0.875rem 1rem', borderBottom:'1px solid var(--border)' }}>
            <p style={{ fontFamily:'var(--font-display)', fontSize:'0.9375rem', fontWeight:600 }}>
              {selectedDay ? format(selectedDay, "d 'de' MMMM", { locale:es }) : format(new Date(), "d 'de' MMMM", { locale:es })}
            </p>
            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.125rem' }}>
              {pedidosDia.length === 0 ? 'Sin pedidos' : `${pedidosDia.length} pedido${pedidosDia.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0', maxHeight:'600px', overflowY:'auto' }}>
            {pedidosDia.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', padding:'2rem', color:'var(--text-muted)', fontSize:'0.875rem' }}>
                <Calendar size={24} />
                <p>No hay pedidos para este día</p>
              </div>
            ) : pedidosDia.map((p, i) => {
              const prio = PRIORIDADES.find(x => x.value === p.prioridad)
              const esFinalizado = p.estados?.includes('finalizado')
              return (
                <div key={p.id}
                  onClick={() => navigate(`/app/pedidos/${p.id}`)}
                  style={{ padding:'0.875rem 1rem', borderBottom: i < pedidosDia.length - 1 ? '1px solid var(--border)' : 'none', cursor:'pointer', display:'flex', flexDirection:'column', gap:'0.375rem', opacity: esFinalizado ? 0.6 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <span style={{ width:'10px', height:'10px', borderRadius:'50%', background: prio?.color ?? '#6B7280', flexShrink:0 }} />
                    <span style={{ fontSize:'0.875rem', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.asunto}</span>
                  </div>
                  {p.estados?.length > 0 && (
                    <div style={{ display:'flex', gap:'0.25rem', flexWrap:'wrap', paddingLeft:'1.375rem' }}>
                      {p.estados.map(est => (
                        <span key={est} style={{ fontSize:'0.6875rem', padding:'0.1rem 0.4rem', borderRadius:'99px', background:'var(--bg-hover)', color:'var(--text-muted)', border:'1px solid var(--border)' }}>{est.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}