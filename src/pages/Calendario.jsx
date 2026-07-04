import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePedidos } from '@/hooks/usePedidos'
import { useEstados } from '@/hooks/useEstados'
import { PRIORIDADES } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isToday, isPast } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid, List } from 'lucide-react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useIsMobile } from '@/hooks/useIsMobile'
import { GrupoLabel } from '@/components/ui/GrupoLabel'

function EstadoChip({ est, estados }) {
  const e = estados.find(x => x.value === est)
  return (
    <span style={{
      fontSize: '0.6875rem', padding: '0.1rem 0.4rem', borderRadius: '99px',
      background: e ? `${e.color}18` : 'var(--bg-hover)',
      color: e ? e.color : 'var(--text-muted)',
      border: `1px solid ${e ? `${e.color}40` : 'var(--border)'}`,
    }}>
      {e ? e.label : est.replace(/_/g, ' ')}
    </span>
  )
}

function PedidoItemPanel({ p, estados, navigate }) {
  const prio = PRIORIDADES.find(x => x.value === p.prioridad)
  const esFinalizado = p.estados?.includes('finalizado')
  return (
    <div onClick={() => navigate(`/pedidos/${p.id}`, { state: { from: '/calendario' } })}
      className="cal-pedido-item"
      style={{ opacity: esFinalizado ? 0.6 : 1 }}>
      <div className="flex items-center gap-2">
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: prio?.color ?? '#6B7280', flexShrink: 0 }} />
        <span className="cal-pedido-nombre">{p.asunto}</span>
      </div>
      {p.estados?.length > 0 && (
        <div className="cal-pedido-estados">
          {p.estados.map(est => <EstadoChip key={est} est={est} estados={estados} />)}
        </div>
      )}
    </div>
  )
}

export default function Calendario() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  // Ref al bloque del día de "hoy" dentro de la lista de timeline — solo
  // existe cuando ese día efectivamente se está renderizando ahí (mes
  // actual + tiene pedidos), se usa para el scroll suave al tocar "Hoy".
  const refHoyTimeline = useRef(null)
  // Disparador del scroll: un simple contador que se incrementa cada vez
  // que se toca "Hoy" — el efecto reacciona a ESTE valor (no directo
  // dentro del onClick), para que el scroll ocurra DESPUÉS de que React
  // ya terminó de re-renderizar con el mes/datos correctos. Si el botón
  // disparara el scroll directo, correría contra el DOM viejo (mes
  // anterior) en vez del nuevo.
  const [scrollHoyTrigger, setScrollHoyTrigger] = useState(0)
  useEffect(() => {
    if (scrollHoyTrigger > 0) {
      // requestAnimationFrame espera a que el navegador termine de pintar
      // el layout nuevo (relevante sobre todo si "Hoy" implicó además
      // cambiar de mes, lo que dispara una recarga de datos) antes de
      // intentar el scroll — sin esto, en ese caso puntual el scroll
      // podría correr contra un DOM que todavía no tiene el día de hoy.
      requestAnimationFrame(() => {
        refHoyTimeline.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [scrollHoyTrigger])

  // Calendario necesita TODOS los pedidos con fecha_limite en el mes
  // visible, sin importar cuándo se crearon ni si están finalizados —
  // por eso usa el modo 'vencimiento' del RPC (filtra por fecha_limite,
  // no por created_at, e incluye finalizados siempre) en vez del modo
  // 'normal' que usa Pedidos.jsx (pensado para un listado paginado de
  // actividad reciente, no para "todo lo que vence este mes").
  //
  // paginaSize generoso (200, vs el default de 30) para que la mayoría
  // de los meses entren en una sola página — y como red de seguridad
  // extra, el efecto de abajo sigue pidiendo más automáticamente
  // mientras hayMas siga en true, así nunca queda nada afuera sin
  // tener que adivinar un límite fijo.
  const venceDesde = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const venceHasta = format(endOfMonth(currentDate), 'yyyy-MM-dd')
  const { pedidos, hayMas, cargandoMas, cargarMas } = usePedidos({
    modo: 'vencimiento', venceDesde, venceHasta, paginaSize: 200,
  })
  useEffect(() => {
    if (hayMas && !cargandoMas) cargarMas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayMas, cargandoMas])

  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const { estados } = useEstados()
  const isMobile = useIsMobile()
  const [vistaDesktop, setVistaDesktop] = useLocalStorage('cal:vista', 'grid')

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const startPad = (getDay(startOfMonth(currentDate)) + 6) % 7

  // Todos los pedidos con fecha, sin importar estado
  const todosConFecha = pedidos.filter(p => p.fecha_limite)
  const activosConFecha = todosConFecha.filter(p => !p.estados?.includes('finalizado'))

  const diaRef = selectedDay ?? new Date()
  const pedidosDia = todosConFecha.filter(p => isSameDay(new Date(p.fecha_limite + 'T00:00:00'), diaRef))
  const pedidosDiaActivos = pedidosDia.filter(p => !p.estados?.includes('finalizado'))
  const pedidosDiaFinalizados = pedidosDia.filter(p => p.estados?.includes('finalizado'))

  const pedidosMes = todosConFecha.filter(p => {
    const d = new Date(p.fecha_limite + 'T00:00:00')
    return d >= startOfMonth(currentDate) && d <= endOfMonth(currentDate)
  })
  const vencidosMes = pedidosMes.filter(p => isPast(new Date(p.fecha_limite + 'T00:00:00')) && !p.estados?.includes('finalizado'))

  // Timeline: agrupar todos (activos + finalizados) por día
  const pedidosPorDia = days.reduce((acc, day) => {
    const dp = todosConFecha.filter(p => isSameDay(new Date(p.fecha_limite + 'T00:00:00'), day))
    if (dp.length > 0) acc.push({ day, pedidos: dp })
    return acc
  }, [])

  const Nav = () => (
    <div className="flex items-center gap-3 flex-wrap">
      {!isMobile && (
        <div className="vista-controls">
          <button onClick={() => setVistaDesktop('grid')} title="Vista calendario"
            className={`btn-toggle ${vistaDesktop === 'grid' ? 'btn-toggle-active' : ''}`}>
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setVistaDesktop('timeline')} title="Vista timeline"
            className={`btn-toggle ${vistaDesktop === 'timeline' ? 'btn-toggle-active' : ''}`}>
            <List size={14} />
          </button>
        </div>
      )}
      <button onClick={() => { const hoy = new Date(); setCurrentDate(hoy); setSelectedDay(hoy); setScrollHoyTrigger(t => t + 1) }}
        className={`btn-ver-mas ${selectedDay && isToday(selectedDay) ? 'btn-toggle-active' : ''}`}>
        Hoy
      </button>
      <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="cal-nav-btn">
        <ChevronLeft size={18} />
      </button>
      <span className="cal-month-label">{format(currentDate, 'MMMM yyyy', { locale: es })}</span>
      <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="cal-nav-btn">
        <ChevronRight size={18} />
      </button>
    </div>
  )

  const mostrarTimeline = isMobile || vistaDesktop === 'timeline'

  return (
    <div className="page-root">

      <div className="page-header" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Calendario</h1>
          <p className="page-subtitle">
            {pedidosMes.length} pedido{pedidosMes.length !== 1 ? 's' : ''} con fecha límite este mes
            {vencidosMes.length > 0 && (
              <span style={{ color: 'var(--icbc-red)', marginLeft: '0.5rem' }}>
                · {vencidosMes.length} vencido{vencidosMes.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <Nav />
      </div>

      {mostrarTimeline ? (
        <div className="flex flex-col gap-3">

          {pedidosPorDia.length === 0 ? (
            <div className="empty-state"><Calendar size={32} /><p>No hay pedidos este mes</p></div>
          ) : pedidosPorDia.map(({ day, pedidos: dp }) => {
            const esHoy = isToday(day)
            const esPasado = isPast(day) && !esHoy
            const activos = dp.filter(p => !p.estados?.includes('finalizado'))
            const finalizados = dp.filter(p => p.estados?.includes('finalizado'))
            return (
              <div key={day.toISOString()} ref={esHoy ? refHoyTimeline : null} className="flex gap-3">
                <div style={{ flexShrink: 0, width: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.25rem' }}>
                  <span style={{
                    width: '36px', height: '36px', borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9375rem',
                    background: esHoy ? 'var(--icbc-red)' : 'var(--bg-surface)',
                    color: esHoy ? '#fff' : esPasado ? 'var(--text-muted)' : 'var(--text-primary)',
                    border: esHoy ? 'none' : '1px solid var(--border)',
                  }}>
                    {format(day, 'd')}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.2rem', textTransform: 'uppercase' }}>
                    {format(day, 'EEE', { locale: es })}
                  </span>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {activos.length > 0 && <GrupoLabel texto="Activos" />}
                  {activos.map(p => {
                    const prio = PRIORIDADES.find(x => x.value === p.prioridad)
                    return (
                      <div key={p.id} onClick={() => navigate(`/pedidos/${p.id}`, { state: { from: '/calendario' } })}
                        className="pedido-card-full" style={{ cursor: 'pointer' }}>
                        <div className="flex items-center gap-2">
                          {prio && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: prio.color, flexShrink: 0 }} />}
                          <span className="pedido-title" style={{ fontSize: '0.875rem' }}>{p.asunto}</span>
                        </div>
                        {p.estados?.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {p.estados.map(est => <EstadoChip key={est} est={est} estados={estados} />)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {finalizados.length > 0 && (
                    <>
                      <GrupoLabel texto="Finalizados" />
                      {finalizados.map(p => {
                        const prio = PRIORIDADES.find(x => x.value === p.prioridad)
                        return (
                          <div key={p.id} onClick={() => navigate(`/pedidos/${p.id}`, { state: { from: '/calendario' } })}
                            className="pedido-card-full" style={{ cursor: 'pointer', opacity: 0.6 }}>
                            <div className="flex items-center gap-2">
                              {prio && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: prio.color, flexShrink: 0 }} />}
                              <span className="pedido-title" style={{ fontSize: '0.875rem' }}>{p.asunto}</span>
                            </div>
                            {p.estados?.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {p.estados.map(est => <EstadoChip key={est} est={est} estados={estados} />)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="cal-root">

          {/* Panel del día — protagonista, va primero en el layout */}
          <div className="cal-panel">
            <div className="cal-panel-header">
              <div className="cal-panel-header-top">
                <span className="cal-panel-num">{format(diaRef, 'd')}</span>
                <div>
                  <p className="cal-panel-title">{format(diaRef, 'EEEE', { locale: es })}</p>
                  <p className="cal-panel-month">{format(diaRef, 'MMMM yyyy', { locale: es })}</p>
                </div>
              </div>
              <p className="cal-panel-subtitle">
                {pedidosDia.length === 0 ? 'Sin pedidos' : `${pedidosDia.length} pedido${pedidosDia.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="cal-panel-body">
              {pedidosDia.length === 0 ? (
                <div className="cal-empty"><Calendar size={24} /><p>Sin pedidos este día</p></div>
              ) : (
                <>
                  {pedidosDiaActivos.map(p => (
                    <PedidoItemPanel key={p.id} p={p} estados={estados} navigate={navigate} />
                  ))}
                  {pedidosDiaFinalizados.length > 0 && (
                    <>
                      <div className="cal-section-label-panel">Finalizados</div>
                      {pedidosDiaFinalizados.map(p => (
                        <PedidoItemPanel key={p.id} p={p} estados={estados} navigate={navigate} />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Grilla mensual */}
          <div className="cal-grid">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="cal-header-cell">{d}</div>
            ))}
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className="cal-day-empty" />
            ))}
            {days.map(day => {
              // Grid muestra todos (activos + finalizados)
              const dayPedidos = todosConFecha.filter(p => isSameDay(new Date(p.fecha_limite + 'T00:00:00'), day))
              const todayFlag = isToday(day)
              const isSelected = selectedDay && isSameDay(day, selectedDay)
              const isPastDay = isPast(day) && !todayFlag
              return (
                <div key={day.toISOString()}
                  onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(-1)) ? null : day)}
                  className={`cal-day ${isSelected ? 'cal-day-selected' : todayFlag ? 'cal-day-today' : ''}`}
                  style={{ cursor: dayPedidos.length > 0 ? 'pointer' : 'default', borderTop: isSelected ? '2px solid var(--icbc-red)' : '2px solid transparent' }}>
                  <span className={`cal-day-number ${todayFlag ? 'cal-day-number-today' : isSelected ? 'cal-day-number-selected' : isPastDay ? 'cal-day-number-past' : 'cal-day-number-normal'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayPedidos.slice(0, 3).map(p => {
                    const prio = PRIORIDADES.find(x => x.value === p.prioridad)
                    const esFinalizado = p.estados?.includes('finalizado')
                    return (
                      <div key={p.id}
                        onClick={e => { e.stopPropagation(); navigate(`/pedidos/${p.id}`, { state: { from: '/calendario' } }) }}
                        className="cal-event"
                        style={{ borderLeft: `3px solid ${prio?.color ?? '#6B7280'}`, opacity: esFinalizado ? 0.5 : 1 }}>
                        <span className="cal-event-text">{p.asunto}</span>
                      </div>
                    )
                  })}
                  {dayPedidos.length > 3 && <span className="cal-more">+{dayPedidos.length - 3} más</span>}
                </div>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}