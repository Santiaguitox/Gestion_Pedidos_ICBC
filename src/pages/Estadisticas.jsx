import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { startOfMonth, subMonths, isSameMonth, startOfWeek, endOfWeek, isSameDay, isToday } from 'date-fns'
import {
  Download, RotateCcw, AlertCircle, Info, CalendarClock, Hourglass, Filter,
  ChevronDown, ChevronUp, X, BarChart2, Plus, CheckCircle2, Clock, Zap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTipos } from '@/hooks/useTipos'
import { useInstancias } from '@/hooks/useInstancias'
import { useUsuarios } from '@/hooks/useUsuarios'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useEstadisticas, rangoDeMes, rangoMesAnterior, labelMes, mesesDisponibles } from '@/hooks/useEstadisticas'
import { colorAvatar, iniciales } from '@/lib/avatares'
import { AuthBrandBackdrop } from '@/components/auth/AuthBrandBackdrop'
import '@/styles/Estadisticas.css'

const PALETA_FALLBACK = ['#1A2EE6', '#5B4EE8', '#10B981', '#F59E0B', '#EC4899', '#14B8A6', '#F97316', '#6B7280']

const fmtDia = f => format(new Date(f + 'T00:00:00'), "d 'de' MMM", { locale: es })

function labelBucket(bucket, gran) {
  const d = new Date(bucket + 'T00:00:00')
  if (gran === 'day') return format(d, 'd MMM', { locale: es })
  if (gran === 'week') return format(d, "'Sem' d MMM", { locale: es })
  return format(d, 'MMM yy', { locale: es })
}

// Mismo criterio que TODA la app: el color elegido a mano en Usuarios.jsx
// (profiles.avatar_color) siempre pisa al hash automático.
function colorDePersona(userId, avatarColor) {
  return avatarColor || colorAvatar(userId)
}

// ── Sistema de cards ──────────────────────────────────────────────────────

function Card({ titulo, ayuda, span = 6, footer, children, headerExtra }) {
  return (
    <div className="est-card" style={{ gridColumn: `span ${span}` }}>
      <div className="est-card-header">
        <div className="est-card-header-left">
          <span className="est-card-titulo">{titulo}</span>
          {ayuda && (
            <span className="est-help" tabIndex={0}>
              ?
              <span className="est-popover" role="tooltip">{ayuda}</span>
            </span>
          )}
        </div>
        {headerExtra}
      </div>
      <div className="est-card-body">{children}</div>
      {footer && <div className="est-card-footer">{footer}</div>}
    </div>
  )
}

function EmptyMini({ texto = 'Sin datos en este período' }) {
  return <div className="est-empty"><Info size={16} />{texto}</div>
}

function Delta({ actual, anterior, mejorAbajo = false }) {
  if (anterior === null || anterior === undefined || actual === null || actual === undefined) return null
  const a = Number(actual); const b = Number(anterior)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  const diff = a - b
  if (diff === 0) return <span className="est-delta-pill est-delta-neutro">= igual</span>
  const pct = b !== 0 ? Math.round(Math.abs(diff) / Math.abs(b) * 100) : null
  const sube = diff > 0
  const bueno = mejorAbajo ? !sube : sube
  return (
    <span className={`est-delta-pill ${bueno ? 'est-delta-bueno' : 'est-delta-malo'}`}>
      {sube ? '▲' : '▼'} {pct !== null ? `${pct}%` : Math.abs(diff)}
    </span>
  )
}

// Cada KPI con su propio color de acento (fondo tintado + ícono + valor
// del mismo color): creados en azul de marca, finalizados en verde,
// tiempo promedio en naranja, activos en rojo ICBC.
function Kpi({ icono: Icono, label, valor, sufijo, delta, colorClase }) {
  return (
    <div className={`est-kpi-color ${colorClase}`}>
      <div className="est-kpi-color-top">
        <Icono size={15} />
        <span className="est-kpi-color-label">{label}</span>
      </div>
      <div className="est-kpi-color-valor-row">
        <span className="est-kpi-color-valor">{valor ?? '—'}{sufijo}</span>
        {delta}
      </div>
    </div>
  )
}

// ── Gráficos ──────────────────────────────────────────────────────────────

// SVG con viewBox fijo + width:100% (preserveAspectRatio="none"): a
// diferencia de barras con ancho mínimo por columna (lo que obligaba a
// scroll horizontal en mobile con muchos puntos — un mes parcial largo
// llega a ~21 barras), una línea se estira sola al ancho disponible sin
// importar cuántos puntos tenga. Las etiquetas del eje X se muestran
// salteadas (máximo ~6) para que no se pisen entre sí con muchos puntos.
// Paleta elegida en el diseño aprobado (opción 3a): violeta de marca para
// Creados, verde oscuro para Finalizados — reemplaza al azul/verde clásico
// que traía antes. Puntual de ESTE gráfico, no toca el resto de la
// pantalla (ej. "Trabajo interno" en Tiempo promedio sigue con su verde).
const COLOR_CREADOS = '#5B4EE8'
const COLOR_FINALIZADOS = '#0E9E72'

// ── Desktop: EL ORIGINAL — barras CSS puras (no SVG), con tooltip nativo
// del navegador vía `title`. Se probó reemplazarlo por una versión SVG
// con grilla/tooltip propio y salió peor: no ocupaba el 100% del ancho
// y la zona de hover para el tooltip no agarraba bien. Se vuelve a esto,
// solo actualizando los colores a la paleta nueva (violeta/verde oscuro).
function ThroughputBarsDesktop({ serie }) {
  if (!serie?.length) return <EmptyMini />
  const max = Math.max(1, ...serie.map(s => Math.max(s.creados, s.finalizados)))
  return (
    <>
      <div className="est-leyenda">
        <span><i style={{ background: COLOR_CREADOS }} />Creados</span>
        <span><i style={{ background: COLOR_FINALIZADOS }} />Finalizados</span>
      </div>
      <div className="est-through">
        {serie.map(s => (
          <div key={s.bucket} className="est-through-col">
            <div className="est-through-barras">
              <div className="est-barra" style={{ height: `${s.creados / max * 100}%`, background: COLOR_CREADOS }} title={`Creados: ${s.creados}`} />
              <div className="est-barra" style={{ height: `${s.finalizados / max * 100}%`, background: COLOR_FINALIZADOS }} title={`Finalizados: ${s.finalizados}`} />
            </div>
            <span className="est-through-label">{labelBucket(s.bucket, 'day')}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Mobile: acordeón semanal ── agrupa el mismo array diario en semanas
// lunes-domingo (mismo criterio que el resto de la app — ver
// startOfWeek/endOfWeek con weekStartsOn:1 en PedidosList/fechas.js).
// El header de cada semana muestra el total SIEMPRE visible (dos
// mini-barras con el valor), y al tocarlo se expande el detalle día a
// día — así se ve de un vistazo sin tener que abrir nada, y el detalle
// completo queda a un toque.
function agruparPorSemana(serie) {
  const semanas = new Map()
  for (const s of serie) {
    const d = new Date(s.bucket + 'T00:00:00')
    const inicio = startOfWeek(d, { weekStartsOn: 1 })
    const key = format(inicio, 'yyyy-MM-dd')
    if (!semanas.has(key)) {
      semanas.set(key, { inicio, fin: endOfWeek(d, { weekStartsOn: 1 }), dias: [], creados: 0, finalizados: 0 })
    }
    const sem = semanas.get(key)
    sem.dias.push(s)
    sem.creados += s.creados
    sem.finalizados += s.finalizados
  }
  return Array.from(semanas.values())
}

function ThroughputAccordionMobile({ serie }) {
  const semanas = useMemo(() => agruparPorSemana(serie ?? []), [serie])
  const [abiertas, setAbiertas] = useState(() => new Set())
  if (!serie?.length) return <EmptyMini />

  const maxSemana = Math.max(1, ...semanas.map(s => Math.max(s.creados, s.finalizados)))

  function toggle(key) {
    setAbiertas(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <>
      <div className="est-leyenda">
        <span><i style={{ background: COLOR_CREADOS }} />Creados</span>
        <span><i style={{ background: COLOR_FINALIZADOS }} />Finalizados</span>
      </div>
      {semanas.map((sem, idx) => {
        const key = format(sem.inicio, 'yyyy-MM-dd')
        const abierta = abiertas.has(key)
        return (
          <div key={key} className="est-semana-acordeon">
            <button type="button" className="est-semana-header" onClick={() => toggle(key)}>
              <div className="est-semana-header-top">
                <span className="est-semana-label">
                  Semana {idx + 1} <em>({format(sem.inicio, 'd MMM', { locale: es })} – {format(sem.fin, 'd MMM', { locale: es })})</em>
                </span>
                {abierta ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
              </div>
              <div className="est-semana-mini-row">
                <span className="est-semana-mini-label">Creados</span>
                <div className="est-semana-mini-pista">
                  <div style={{ width: `${sem.creados / maxSemana * 100}%`, background: COLOR_CREADOS }} />
                </div>
                <span className="est-semana-mini-valor">{sem.creados}</span>
              </div>
              <div className="est-semana-mini-row">
                <span className="est-semana-mini-label">Finalizados</span>
                <div className="est-semana-mini-pista">
                  <div style={{ width: `${sem.finalizados / maxSemana * 100}%`, background: COLOR_FINALIZADOS }} />
                </div>
                <span className="est-semana-mini-valor">{sem.finalizados}</span>
              </div>
            </button>
            {abierta && (
              <div className="est-semana-detalle">
                {sem.dias.map(d => {
                  const fecha = new Date(d.bucket + 'T00:00:00')
                  return (
                    <div key={d.bucket} className={`est-semana-dia-row${isToday(fecha) ? ' est-semana-dia-hoy' : ''}`}>
                      <span className="est-semana-dia-label">{format(fecha, "EEE d", { locale: es })}</span>
                      <span className="est-semana-dia-valor"><i style={{ background: COLOR_CREADOS }} />{d.creados}</span>
                      <span className="est-semana-dia-valor"><i style={{ background: COLOR_FINALIZADOS }} />{d.finalizados}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

// Wrapper: elige la versión según el ancho real de pantalla (useIsMobile,
// mismo hook y mismo breakpoint —640px— que ya usa el resto de la app).
function ThroughputChart({ serie }) {
  const isMobile = useIsMobile()
  return isMobile ? <ThroughputAccordionMobile serie={serie} /> : <ThroughputBarsDesktop serie={serie} />
}

function LeadTipoBars({ filas, labelTipo }) {
  if (!filas?.length) return <EmptyMini texto="Sin pedidos finalizados en este período" />
  const max = Math.max(1, ...filas.map(f => Number(f.total)))
  return (
    <>
      <div className="est-leyenda">
        <span><i style={{ background: '#5B4EE8' }} />Trabajo interno</span>
        <span><i style={{ background: '#9EA3BE' }} />Espera del cliente</span>
      </div>
      {filas.map(f => (
        <div key={f.tipo} className="est-hbar-row">
          <div className="est-hbar-top">
            <span>{labelTipo(f.tipo)} <em className="est-n">({f.n})</em></span>
            <b>{f.total} d</b>
          </div>
          <div className="est-hbar-pista" style={{ width: `${Number(f.total) / max * 100}%` }}>
            <div style={{ width: `${f.total > 0 ? f.interno / f.total * 100 : 0}%`, background: '#5B4EE8' }} title={`Interno: ${f.interno} d`} />
            <div style={{ width: `${f.total > 0 ? f.espera / f.total * 100 : 0}%`, background: '#9EA3BE' }} title={`Espera: ${f.espera} d`} />
          </div>
        </div>
      ))}
    </>
  )
}

function DonutTipos({ filas, labelTipo, colorTipo }) {
  if (!filas?.length) return <EmptyMini texto="Sin pedidos creados en este período" />
  const total = filas.reduce((acc, f) => acc + f.n, 0)
  let acum = 0
  const stops = filas.map((f, i) => {
    const desde = acum / total * 360
    acum += f.n
    const hasta = acum / total * 360
    return `${colorTipo(f.tipo, i)} ${desde}deg ${hasta}deg`
  }).join(', ')
  return (
    <div className="est-donut-wrap">
      <div className="est-donut" style={{ background: `conic-gradient(${stops})` }}>
        <div className="est-donut-centro"><b>{total}</b><span>pedidos</span></div>
      </div>
      <div className="est-donut-leyenda">
        {filas.map((f, i) => (
          <div key={f.tipo}>
            <span><i style={{ background: colorTipo(f.tipo, i) }} />{labelTipo(f.tipo)}</span>
            <b>{Math.round(f.n / total * 100)}%</b>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────

export default function Estadisticas() {
  useDocumentTitle('Estadísticas')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tipos } = useTipos()
  const { instancias } = useInstancias()
  const { usuarios } = useUsuarios()

  const hoy = useMemo(() => new Date(), [])
  const inicioMesActual = useMemo(() => startOfMonth(hoy), [hoy])
  const inicioMesAnterior = useMemo(() => subMonths(inicioMesActual, 1), [inicioMesActual])

  // Se guarda el mes como string 'yyyy-MM-01' en localStorage (Date no
  // serializa limpio) y se reconstruye a Date acá.
  const [mesISO, setMesISO] = useLocalStorage('estadisticas:mes', format(inicioMesActual, 'yyyy-MM-dd'))
  const mesSeleccionado = useMemo(() => new Date(mesISO + 'T00:00:00'), [mesISO])

  const [comparar, setComparar] = useLocalStorage('estadisticas:comparar', false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroInstancia, setFiltroInstancia] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)

  const hayFiltrosActivos = !!(filtroTipo || filtroInstancia || filtroUsuario)
  function limpiarFiltros() {
    setFiltroTipo(''); setFiltroInstancia(''); setFiltroUsuario('')
  }

  const rango = useMemo(() => rangoDeMes(mesSeleccionado, hoy), [mesSeleccionado, hoy])

  const esMesActual = isSameMonth(mesSeleccionado, inicioMesActual)
  const esMesAnterior = isSameMonth(mesSeleccionado, inicioMesAnterior)

  const {
    data, loading, error, refetch,
    dataAnterior, loadingComparar,
    config,
  } = useEstadisticas({
    desde: rango?.desde,
    hasta: rango?.hasta,
    comparar,
    tipo: filtroTipo,
    instancia: filtroInstancia,
    usuarioId: filtroUsuario,
  })

  const opcionesMes = useMemo(() => mesesDisponibles(config?.stats_desde, hoy), [config?.stats_desde, hoy])

  const labelTipo = v => tipos.find(t => t.value === v)?.label ?? v
  const colorTipo = (v, i) => tipos.find(t => t.value === v)?.color ?? PALETA_FALLBACK[i % PALETA_FALLBACK.length]
  const labelInstancia = v => v === 'sin_instancia' ? 'Sin instancia' : (instancias.find(x => x.value === v)?.label ?? v)

  const kpis = data?.kpis
  const kpisPrev = dataAnterior?.kpis
  const maxInst = Math.max(1, ...(data?.distribucion_instancia ?? []).map(i => i.n))
  const reprogSinHistorico = config?.reprog_desde && rango?.desde && rango.desde < config.reprog_desde
  const hayReprogramaciones = (data?.reprogramaciones?.total ?? 0) > 0

  function exportarCSV() {
    if (!data) return
    const m = data.meta
    const filas = [
      ['Estadísticas Gestión de Pedidos ICBC'],
      ['Período', `${m.desde} a ${m.hasta}`],
      [],
      ['KPI', 'Valor'],
      ['Pedidos creados', kpis.creados],
      ['Pedidos finalizados', kpis.finalizados],
      ['Lead time promedio (días)', kpis.lead_promedio ?? ''],
      ['Lead time mediana (días)', kpis.lead_mediana ?? ''],
      ['% entregado a tiempo', kpis.pct_a_tiempo ?? ''],
      ['Pedidos activos al cierre del período', kpis.activos_hoy],
      [],
      ['Creados vs finalizados', 'Creados', 'Finalizados'],
      ...data.throughput.map(s => [s.bucket, s.creados, s.finalizados]),
      [],
      ['Tiempo promedio por tipo', 'Total (d)', 'Interno (d)', 'Espera (d)', 'N'],
      ...data.lead_por_tipo.map(t => [labelTipo(t.tipo), t.total, t.interno, t.espera, t.n]),
    ]
    const csv = filas.map(f => f.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `estadisticas_${m.desde}_${m.hasta}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page-root est-page-con-fondo">
      {/* Mismo isotipo de fondo que Login/SetPassword (AuthBrandBackdrop,
          compartido) — se pidió a propósito para esta pantalla: mientras
          esté en pulido, un fondo distinto la marca como "especial"
          dentro de la app. .est-page-con-fondo es lo que le da el
          position:relative + overflow:hidden que necesita el
          posicionamiento absoluto de los isotipos — page-root en el
          resto de las páginas no lleva esta clase, así que no las afecta. */}
      <AuthBrandBackdrop />
      <div className="page-header">
        <div>
          <h1 className="page-title">Estadísticas</h1>
          <p className="page-subtitle">
            Rendimiento del equipo{rango ? ` · ${fmtDia(rango.desde)} – ${fmtDia(rango.hasta)}` : ''}
          </p>
        </div>
        <button onClick={exportarCSV} disabled={!data} className="btn-header-action">
          <Download size={15} />Exportar
        </button>
      </div>

      {/* Filtros: acordeón. El selector de mes vive acá adentro junto con
          tipo/instancia/usuario. Solo 3 formas de elegir mes: actual,
          anterior, o cualquier otro vía dropdown — nada de rangos
          libres (ver nota LEGACY en useEstadisticas.js: se sacó a
          propósito, esta pantalla es interna, nadie le reporta esto al
          cliente, no hace falta esa flexibilidad). */}
      <div className="panel">
        <div className="panel-header" onClick={() => setFiltrosOpen(v => !v)}>
          <div className="panel-header-left">
            <Filter size={15} color="var(--text-muted)" />
            <span className="panel-label">Filtros</span>
            {!filtrosOpen && <span className="est-filtro-actual">{labelMes(mesSeleccionado)}</span>}
            {hayFiltrosActivos && <span className="badge-active-pill">activos</span>}
          </div>
          <div className="panel-header-right">
            {filtrosOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </div>
        </div>
        <div className={`acordeon-anim${filtrosOpen ? ' abierto' : ''}`}>
          <div className="acordeon-anim-clip">
            <div className="panel-body">
              {/* Todo en una sola fila: mes + tipo/instancia/usuario +
                  limpiar. Antes eran dos <div> separados (uno para el
                  mes, otro para el resto) y por más que cada uno wrappeara
                  bien, quedaban en líneas distintas siempre — con un solo
                  contenedor flex, todo fluye junto y wrappea como una
                  unidad si no entra en el ancho disponible. */}
              <div className="est-presets-row">
                {/* Envueltos juntos en .est-botones-mes: en mobile este
                    wrapper pasa a display:flex ocupando 100% del ancho
                    con cada botón al 50% (ver CSS) — separado del resto
                    para que ese comportamiento no afecte a los selects. */}
                <div className="est-botones-mes">
                  <button onClick={() => setMesISO(format(inicioMesAnterior, 'yyyy-MM-dd'))}
                    className={`est-preset ${esMesAnterior ? 'est-preset-activo' : ''}`}>
                    Mes anterior
                  </button>
                  <button onClick={() => setMesISO(format(inicioMesActual, 'yyyy-MM-dd'))}
                    className={`est-preset ${esMesActual ? 'est-preset-activo' : ''}`}>
                    Mes actual
                  </button>
                </div>
                {/* Placeholder real: mientras el mes elegido sea uno de
                    los dos botones, el dropdown no repite ese mismo
                    nombre — muestra "Seleccionar mes" neutro. Solo
                    cuando se elige un mes DISTINTO a esos dos, el
                    dropdown pasa a mostrar ese mes y se resalta. */}
                <select value={(esMesActual || esMesAnterior) ? '' : mesISO}
                  onChange={e => setMesISO(e.target.value)}
                  className={`select-auto est-select-mes ${!esMesActual && !esMesAnterior ? 'est-select-mes-activo' : ''}`}>
                  <option value="" disabled>Seleccionar mes</option>
                  {!opcionesMes.some(m => format(m, 'yyyy-MM-dd') === mesISO) && (
                    <option value={mesISO}>{labelMes(mesSeleccionado)}</option>
                  )}
                  {opcionesMes.map(m => (
                    <option key={m.toISOString()} value={format(m, 'yyyy-MM-dd')}>{labelMes(m)}</option>
                  ))}
                </select>
                <div className="est-divisor-vertical" />
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="select-auto">
                  <option value="">Todos los tipos</option>
                  {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={filtroInstancia} onChange={e => setFiltroInstancia(e.target.value)} className="select-auto">
                  <option value="">Todas las instancias</option>
                  {instancias.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
                <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} className="select-auto">
                  <option value="">Todos los usuarios</option>
                  <option value={user?.id ?? ''}>Mis pedidos</option>
                  {usuarios.filter(u => u.id !== user?.id).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
                {hayFiltrosActivos && (
                  <button onClick={limpiarFiltros} className="btn-clear-filters">
                    <X size={13} />Limpiar filtros
                  </button>
                )}
              </div>
              {/* El aviso de histórico recortado vive ACÁ adentro (no
                  suelto en la pantalla) — es justo donde corresponde
                  prestarle atención al tema de fechas, junto al resto
                  de los controles de rango. */}
              {data?.meta?.recortado && (
                <div className="est-aviso">
                  <Info size={14} />
                  El histórico arranca el {fmtDia(data.meta.stats_desde)} (inicio del registro de actividad) — el rango se ajustó a esa fecha.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs: card fija, NO acordeón — se ve siempre. El switch de
          comparación vive donde antes estaba el chevron (arriba a la
          derecha del header de la card), y solo afecta a estas 4
          tarjetas — el resto de la pantalla no se entera de que existe. */}
      <div className="est-card est-kpis-card">
        <div className="est-card-header">
          <div className="est-card-header-left">
            <BarChart2 size={15} color="var(--text-muted)" />
            <span className="est-card-titulo">KPIs</span>
          </div>
          {!loading && data && (
            <div className="est-periodo-tabs">
              <button type="button" className={!comparar ? 'active' : ''} onClick={() => setComparar(false)}>
                Período actual
              </button>
              <button type="button" className={comparar ? 'active' : ''} onClick={() => setComparar(true)}>
                Período anterior
              </button>
            </div>
          )}
        </div>
        {loading && (
          <div className="est-kpis-row">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="est-card est-skeleton" style={{ height: 96 }} />
            ))}
          </div>
        )}
        {!loading && data && (
          <div className={`est-kpis-row${loadingComparar ? ' est-kpis-row-cargando' : ''}`}>
            <Kpi icono={Plus} colorClase="est-kpi-azul" label="Pedidos creados" valor={kpis.creados}
              delta={comparar && <Delta actual={kpis.creados} anterior={kpisPrev?.creados} />} />
            <Kpi icono={CheckCircle2} colorClase="est-kpi-verde" label="Pedidos finalizados" valor={kpis.finalizados}
              delta={comparar && <Delta actual={kpis.finalizados} anterior={kpisPrev?.finalizados} />} />
            <Kpi icono={Clock} colorClase="est-kpi-naranja" label="Tiempo promedio"
              valor={kpis.lead_promedio !== null ? kpis.lead_promedio : '—'} sufijo=" d"
              delta={comparar && <Delta actual={kpis.lead_promedio} anterior={kpisPrev?.lead_promedio} mejorAbajo />} />
            {/* "Activos" (ya no "Activos hoy"): reconstruye el backlog
                real al cierre del período elegido, no un número fijo del
                instante actual — por eso ahora SÍ tiene sentido
                comparar: si sube, el backlog está creciendo (malo). */}
            <Kpi icono={Zap} colorClase="est-kpi-rojo" label="Activos al cierre" valor={kpis.activos_hoy}
              delta={comparar && <Delta actual={kpis.activos_hoy} anterior={kpisPrev?.activos_hoy} mejorAbajo />} />
          </div>
        )}
        {!loading && !data && <EmptyMini texto="Sin datos para este mes" />}
      </div>

      {error && (
        <div className="est-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={refetch}><RotateCcw size={13} />Reintentar</button>
        </div>
      )}

      {loading && rango && (
        <div className="est-grid">
          {[12, 5, 4, 3, 9, 3].map((span, i) => (
            <div key={i} className="est-card est-skeleton" style={{ gridColumn: `span ${span}`, height: 220 }} />
          ))}
        </div>
      )}

      {!loading && !error && data && (
        <div className="est-grid">
          <Card span={12} titulo="Creados vs. finalizados"
            ayuda="Compara, período a período, cuántos pedidos se crearon contra cuántos se finalizaron.">
            <ThroughputChart serie={data.throughput} />
          </Card>

          {/* Fila 2: 5/4/3 — la última (donut, 25%) queda alineada con
              "Ranking de tags" de la fila 3, que también es 25% siempre
              (ver fila 3: ya no cambia de ancho según haya o no
              reprogramaciones — esa era la causa real de que antes no
              alinearan). */}
          <Card span={5} titulo="Tiempo promedio por tipo de pedido"
            ayuda="Días promedio desde creación a finalización, desglosado en trabajo interno vs. tiempo en 'esperando respuesta' del cliente. Reconstruido del historial de cambios de estado.">
            <LeadTipoBars filas={data.lead_por_tipo} labelTipo={labelTipo} />
          </Card>
          <Card span={4} titulo="Pedidos por instancia" ayuda="Pedidos creados en el período, agrupados por instancia.">
            {data.distribucion_instancia.length === 0 ? <EmptyMini texto="Sin pedidos creados en este período" /> :
              data.distribucion_instancia.map(i => (
                <div key={i.instancia} className="est-hbar-row">
                  <div className="est-hbar-top"><span>{labelInstancia(i.instancia)}</span><b>{i.n}</b></div>
                  <div className="est-hbar-pista"><div style={{ width: `${i.n / maxInst * 100}%`, background: '#1A2EE6' }} /></div>
                </div>
              ))}
          </Card>
          <Card span={3} titulo="Cantidad de pedidos por tipo" ayuda="Pedidos creados en el período, agrupados por tipo.">
            <DonutTipos filas={data.distribucion_tipo} labelTipo={labelTipo} colorTipo={colorTipo} />
          </Card>

          {/* Fila 3: SIEMPRE 9/3, ancho fijo — Reprogramaciones (cuando
              aparece) ya no comparte esta fila, va en su propia fila
              full-width más abajo. Así el 25% de acá siempre queda
              alineado con el 25% de la fila 2, sin condicionales. */}
          <Card span={9} titulo="Pedidos sin actividad"
            ayuda="Pedidos activos sin ningún movimiento (actividad ni comentarios) hace más de 7 días. Click para abrir el pedido.">
            {data.estancados.length === 0
              ? <EmptyMini texto="No hay pedidos sin actividad." />
              : data.estancados.map(s => (
                <button key={s.id} className="est-fila-link" onClick={() => navigate(`/pedidos/${s.id}`)}>
                  <Hourglass size={13} className="est-fila-icono" />
                  <span className="est-fila-asunto">{s.asunto}</span>
                  <span className="est-avatares-mini">
                    {(s.asignados ?? []).slice(0, 3).map(a => (
                      <i key={a.user_id} style={{ background: colorDePersona(a.user_id, a.avatar_color) }} title={a.nombre}>{iniciales(a.nombre)}</i>
                    ))}
                  </span>
                  <span className={`est-badge-dias ${s.dias > 14 ? 'est-badge-rojo' : 'est-badge-naranja'}`}>{s.dias} días</span>
                </button>
              ))}
          </Card>
          <Card span={3} titulo="Ranking de tags" ayuda="Tags más usados en los pedidos creados en el período.">
            {data.top_tags.length === 0 ? <EmptyMini texto="Sin tags en este período" /> : (
              <div className="est-tags">
                {data.top_tags.map(t => <span key={t.tag} className="est-tag-chip">{t.tag} <b>{t.n}</b></span>)}
              </div>
            )}
          </Card>

          {hayReprogramaciones && (
            <Card span={12} titulo="Reprogramaciones"
              ayuda="Cuántas veces se cambió la fecha límite de los pedidos en el período, y los más reprogramados."
              footer={reprogSinHistorico && (
                <span className="est-nota-metrica">
                  <CalendarClock size={12} />Métrica registrada desde el {fmtDia(config.reprog_desde)}
                </span>
              )}>
              <div className="est-reprog-total"><b>{data.reprogramaciones.total}</b> cambios de fecha en el período</div>
              {data.reprogramaciones.top.map(r => (
                <button key={r.id} className="est-fila-link" onClick={() => navigate(`/pedidos/${r.id}`)}>
                  <span className="est-fila-asunto">{r.asunto}</span>
                  <span className="est-reprog-count"><RotateCcw size={12} />{r.n}×</span>
                </button>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
