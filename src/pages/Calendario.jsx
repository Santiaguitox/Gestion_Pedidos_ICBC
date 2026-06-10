import { useState } from 'react'
import { usePedidos } from '@/hooks/usePedidos'
import { PRIORIDADES } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Calendario() {
  const { pedidos } = usePedidos()
  const [currentDate, setCurrentDate] = useState(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const startPad = (getDay(startOfMonth(currentDate)) + 6) % 7
  const pedidosConFecha = pedidos.filter(p => p.fecha_limite)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Calendario</h1>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1))} style={{ color:'var(--text-secondary)', display:'flex', alignItems:'center', padding:'0.3rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}><ChevronLeft size={18} /></button>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'1rem', textTransform:'capitalize', minWidth:'160px', textAlign:'center' }}>{format(currentDate, "MMMM yyyy", { locale:es })}</span>
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1))} style={{ color:'var(--text-secondary)', display:'flex', alignItems:'center', padding:'0.3rem', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'1px', background:'var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', border:'1px solid var(--border)' }}>
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} style={{ background:'var(--bg-surface)', textAlign:'center', fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', padding:'0.625rem 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>{d}</div>
        ))}
        {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} style={{ background:'var(--bg-base)', minHeight:'90px' }} />)}
        {days.map(day => {
          const dayPedidos = pedidosConFecha.filter(p => isSameDay(new Date(p.fecha_limite + 'T00:00:00'), day))
          const isToday = isSameDay(day, new Date())
          return (
            <div key={day.toISOString()} style={{ background: isToday ? 'rgba(208,17,27,0.05)' : 'var(--bg-surface)', minHeight:'90px', padding:'0.5rem', display:'flex', flexDirection:'column', gap:'0.25rem' }}>
              <span style={{ fontSize:'0.8125rem', fontWeight:600, color: isToday ? '#fff' : 'var(--text-secondary)', width:'22px', height:'22px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', background: isToday ? 'var(--icbc-red)' : 'transparent' }}>{format(day, 'd')}</span>
              {dayPedidos.map(p => {
                const prio = PRIORIDADES.find(x => x.value === p.prioridad)
                return (
                  <div key={p.id} style={{ borderLeft:`3px solid ${prio?.color ?? '#6B7280'}`, padding:'0.15rem 0.35rem', background:'var(--bg-elevated)', borderRadius:'0 3px 3px 0' }}>
                    <span style={{ fontSize:'0.6875rem', color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>{p.asunto}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
