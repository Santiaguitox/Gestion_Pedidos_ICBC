import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { usePedidos } from '@/hooks/usePedidos'
import { useAuth } from '@/context/AuthContext'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { DatePicker } from '@/components/ui/DatePicker'
import { GrupoLabel } from '@/components/ui/GrupoLabel'
import {
  Plus, Search, Filter, AlignJustify, LayoutList, ChevronDown, ChevronUp, X, Tag,
  ArrowUp, ChevronLeft, ChevronRight, Calendar, History,
} from 'lucide-react'
import { TagSearch } from '@/components/ui/TagSearch'
import { useTipos } from '@/hooks/useTipos'
import { useTagsDisponibles } from '@/hooks/useTagsDisponibles'
import { useUsuarios } from '@/hooks/useUsuarios'
import { PedidoCardCompact, PedidoCardFull } from '@/components/pedidos/PedidoCard'
import { HelpPopover } from '@/components/ui/HelpPopover'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

const PAGINA_SIZE = 30

// Misma técnica que toLocalDate del Dashboard: evita el desfasaje de un
// día que da .toISOString().slice(0,10) en husos horarios negativos.
function toLocalDate(isoString) {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtFecha(d) { return format(d, 'yyyy-MM-dd') }

function GrupoDiaLabel({ fecha, cantidad, finalizados }) {
  const hoy = fmtFecha(new Date())
  const esHoy = fecha === hoy
  const labelRaw = esHoy ? 'Hoy' : format(new Date(fecha + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })
  const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1)
  return (
    <div className="dia-group-header">
      <span className={`dia-group-label dia-group-label-principal ${esHoy ? 'dia-group-label-hoy' : ''}`}>{label}</span>
      <div className="dia-group-line-flex" />
      <span className="dia-group-count">
        {cantidad} pedido{cantidad !== 1 ? 's' : ''}{finalizados > 0 ? ` · ${finalizados} finalizado${finalizados !== 1 ? 's' : ''}` : ''}
      </span>
    </div>
  )
}

function Paginacion({ pagina, totalPaginas, setPagina }) {
  if (totalPaginas <= 1) return null
  return (
    <div className="pagination">
      <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}
        className="btn-page btn-page-nav" style={{ opacity: pagina === 0 ? 0.4 : 1 }}>
        <ChevronLeft size={14} />
      </button>
      <span className="pedido-meta-item">Página {pagina + 1} de {totalPaginas}</span>
      <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}
        className="btn-page btn-page-nav" style={{ opacity: pagina >= totalPaginas - 1 ? 0.4 : 1 }}>
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

export default function PedidosList({ onNew }) {
  const { role, user } = useAuth()
  const { estados } = useEstados()
  const { tipos } = useTipos()
  const location = useLocation()
  // Si se llega desde el Dashboard (grupo "Más adelante"), state.venceDesde
  // trae la fecha a partir de la cual filtrar por vencimiento — se lee
  // directo en la inicialización del estado (no en un useEffect) para
  // que arranque ya configurado desde el primer render, sin parpadeo
  // mostrando primero la vista normal y después saltando al filtro.
  const venceDesdeInicial = location.state?.venceDesde ?? ''

  // Filtros básicos
  const [prioridad, setPrioridad] = useState('')
  const [tipo, setTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useLocalStorage('pedidos:filtroEstado', '')
  const [filtroUsuario, setFiltroUsuario] = useLocalStorage('pedidos:filtroUsuario', '')
  const [filtroTag, setFiltroTag] = useLocalStorage('pedidos:filtroTag', '')
  const [modoHistorico, setModoHistorico] = useState(false)
  const [mostrarFinalizados, setMostrarFinalizados] = useLocalStorage('pedidos:mostrarFinalizados', false)

  // Fechas de vencimiento (se guardan aunque estén deshabilitadas — ver
  // más abajo soloModoNormal — y se reactivan solas al volver a
  // estar disponibles, sin que el usuario tenga que volver a tipearlas)
  const [fechaDesde, setFechaDesde] = useState(venceDesdeInicial)
  const [fechaHasta, setFechaHasta] = useState('')

  // Búsqueda
  const [busqueda, setBusqueda] = useState('')

  // Paginación y vista
  // Nota: la paginación de la consulta al servidor (cargar más días)
  // ahora vive DENTRO de usePedidos — no hay un estado 'pagina' acá.
  // Lo que sigue siendo local a este componente es paginaSizeGrupo/
  // paginaPorSubgrupo (paginación VISUAL dentro de cada grupo de día ya
  // cargado, ver más abajo) — son conceptos distintos.
  const [vista, setVista] = useLocalStorage('pedidos:vista', 'full')
  const [filtrosOpen, setFiltrosOpen] = useLocalStorage('pedidos:filtrosOpen', true)

  // Cuántos pedidos mostrar por página DENTRO de cada sub-lista
  // (activos/finalizados) de un grupo de día — preferencia persistida,
  // aplica igual a todos los grupos de la pantalla. Si un grupo no
  // supera este límite, no se muestra ningún control de paginación ahí.
  const [paginaSizeGrupo, setPaginaSizeGrupo] = useLocalStorage('pedidos:paginaSizeGrupo', 10)
  // Flag separado del valor numérico: permite que el <select> se quede
  // mostrando "Personalizado…" aunque el número elegido coincida por
  // casualidad con 10/15/20, o incluso antes de que se termine de
  // escribir un valor en el input que aparece al lado.
  const [modoPersonalizado, setModoPersonalizado] = useState(![10, 15, 20].includes(paginaSizeGrupo))
  // Texto del input personalizado, separado del valor numérico real
  // (paginaSizeGrupo) — permite que el campo quede vacío momentáneamente
  // mientras se escribe, sin que React lo "rellene" de nuevo con el
  // último valor válido en cada tecla (problema típico de inputs
  // numéricos controlados sin un estado de texto intermedio).
  const [textoPersonalizado, setTextoPersonalizado] = useState(String(paginaSizeGrupo))
  // Página actual DENTRO de cada sub-lista — independiente por grupo y
  // por tipo (activos/finalizados), así avanzar la página de "Hoy" no
  // afecta a "Ayer". No se persiste: arranca de cero en cada carga.
  const [paginaPorSubgrupo, setPaginaPorSubgrupo] = useState({})

  const hayBusqueda = busqueda.trim().length > 0
  const hayFechaVencimiento = !hayBusqueda && !modoHistorico && (fechaDesde || fechaHasta)
  // Mientras hay búsqueda activa o el modo histórico está prendido, las
  // fechas de vencimiento y el botón "mostrar finalizados" no tienen
  // ningún efecto (la función SQL los ignora en esos casos) — se
  // deshabilitan visualmente para no generar la sensación de "toqué algo
  // y no pasó nada". El valor de las fechas se mantiene guardado (no se
  // borra) para que se reactive solo si se desactiva lo que lo bloqueaba.
  const soloModoNormal = hayBusqueda || modoHistorico

  const modo = hayBusqueda ? 'normal' // no importa, la función ignora el modo si hay búsqueda
    : modoHistorico ? 'historico'
    : (fechaDesde || fechaHasta) ? 'vencimiento'
    : 'normal'

  // Qué shortcut está "activo" — se deriva directamente del rango actual,
  // no de un estado separado. Si el usuario edita las fechas a mano y ya
  // no coinciden con ningún shortcut, automáticamente ninguno se marca.
  const hoyParaShortcut = new Date()
  const shortcutActivo =
    fechaDesde === fmtFecha(hoyParaShortcut) && fechaHasta === fmtFecha(hoyParaShortcut) ? 'hoy'
    : fechaDesde === fmtFecha(startOfWeek(hoyParaShortcut, { weekStartsOn: 1 })) && fechaHasta === fmtFecha(endOfWeek(hoyParaShortcut, { weekStartsOn: 1 })) ? 'semana'
    : fechaDesde === fmtFecha(startOfMonth(hoyParaShortcut)) && fechaHasta === fmtFecha(endOfMonth(hoyParaShortcut)) ? 'mes'
    : null

  const filters = {
    modo,
    venceDesde: modo === 'vencimiento' ? fechaDesde : undefined,
    venceHasta: modo === 'vencimiento' ? fechaHasta : undefined,
    busqueda: hayBusqueda ? busqueda.trim() : undefined,
    prioridad: prioridad || undefined,
    tipo: tipo || undefined,
    estado: filtroEstado || undefined,
    tag: filtroTag || undefined,
    usuarioId: filtroUsuario === 'mios' ? (user?.id ?? undefined) : (filtroUsuario || undefined),
    mostrarFinalizados,
    paginaSize: PAGINA_SIZE,
  }

  const { pedidos, total, loading, hayNuevos, verNuevos, cargarMas, cargandoMas, hayMas } = usePedidos(filters)

  const { tags: tagsDisponibles } = useTagsDisponibles()
  const { usuarios } = useUsuarios()

  const hayFiltrosActivos = busqueda || prioridad || tipo || filtroEstado || filtroUsuario || filtroTag || fechaDesde || fechaHasta || modoHistorico

  function limpiarFiltros() {
    setPrioridad(''); setTipo(''); setFiltroEstado(''); setFiltroUsuario(''); setFiltroTag('')
    setBusqueda(''); setFechaDesde(''); setFechaHasta(''); setModoHistorico(false)

  }

  // Los 3 shortcuts completan Vence desde/hasta de una — semana y mes
  // calendario, no ventana móvil de N días (confirmado: "esta semana"
  // significa lunes a domingo de la semana actual, no "hoy menos/más 7").
  // Son togglables: si el shortcut clickeado ya está activo, un segundo
  // click lo desactiva (limpia las fechas) en vez de volver a aplicarlo —
  // mismo comportamiento que "Ver histórico" y "Mostrar finalizados".
  function aplicarShortcutFecha(rango) {
    if (shortcutActivo === rango) {
      setFechaDesde(''); setFechaHasta('')
      return
    }
    const hoy = new Date()
    if (rango === 'hoy') {
      setFechaDesde(fmtFecha(hoy)); setFechaHasta(fmtFecha(hoy))
    } else if (rango === 'semana') {
      setFechaDesde(fmtFecha(startOfWeek(hoy, { weekStartsOn: 1 })))
      setFechaHasta(fmtFecha(endOfWeek(hoy, { weekStartsOn: 1 })))
    } else if (rango === 'mes') {
      setFechaDesde(fmtFecha(startOfMonth(hoy)))
      setFechaHasta(fmtFecha(endOfMonth(hoy)))
    }
    setModoHistorico(false)

  }

  // Ids de pedidos recién insertados por "Ver nuevos" — se usan para
  // hacer scroll automático hasta el primero y aplicar un resaltado
  // visual breve (ver handleVerNuevos más abajo), se limpia solo a los
  // pocos segundos.
  const [pedidosRecienLlegados, setPedidosRecienLlegados] = useState([])

  function renderPedido(pedido) {
    const tarjeta = vista === 'compact'
      ? <PedidoCardCompact pedido={pedido} onTagClick={setFiltroTag} filtroTag={filtroTag} tipos={tipos} estados={estados} origenRuta="/app/pedidos" />
      : <PedidoCardFull pedido={pedido} onTagClick={setFiltroTag} filtroTag={filtroTag} tipos={tipos} estados={estados} origenRuta="/app/pedidos" />
    return (
      <div
        key={pedido.id}
        id={`pedido-${pedido.id}`}
        className={pedidosRecienLlegados.includes(pedido.id) ? 'pedido-recien-llegado' : undefined}
      >
        {tarjeta}
      </div>
    )
  }

  async function handleVerNuevos() {
    const idsNuevos = await verNuevos()
    if (idsNuevos.length === 0) return
    setPedidosRecienLlegados(idsNuevos)
    // Los pedidos nuevos son siempre de HOY y siempre activos (recién
    // creados) — si la página interna de ese subgrupo estaba en una
    // página distinta de la primera (por mucho volumen), la reseteamos
    // para garantizar que el pedido nuevo quede visible al hacer scroll.
    setPaginaPorSubgrupo(prev => ({ ...prev, [`${fmtFecha(new Date())}:activos`]: 0 }))
    // Pequeño delay para que el DOM ya tenga renderizado el pedido nuevo
    // antes de intentar hacer scroll hacia él.
    setTimeout(() => {
      document.getElementById(`pedido-${idsNuevos[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    setTimeout(() => setPedidosRecienLlegados([]), 2500)
  }

  // Agrupación visual por día (de creación), igual estilo que el
  // Dashboard pero SIN paginar dentro de cada grupo (la paginación es de
  // la vista general — ver spec-paginacion-pedidos-v2.md). Los pedidos ya
  // vienen ordenados por created_at DESC desde la función SQL, así que el
  // día más reciente queda arriba sin tener que volver a ordenar acá.
  const grupos = []
  for (const p of pedidos) {
    const fecha = toLocalDate(p.created_at)
    let grupo = grupos.find(g => g.fecha === fecha)
    if (!grupo) { grupo = { fecha, pedidos: [] }; grupos.push(grupo) }
    grupo.pedidos.push(p)
  }

  return (
    <div className="page-root">

      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">{total} pedido{total !== 1 ? 's' : ''}</p>
        </div>
        {role !== ROLES.VIEWER && (
          <button onClick={onNew} className="btn-header-action">
            <Plus size={16} />Nuevo pedido
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-header" onClick={() => setFiltrosOpen(v => !v)}>
          <div className="panel-header-left">
            <Filter size={15} color="var(--text-muted)" />
            <span className="panel-label">Filtros</span>
            {hayFiltrosActivos && <span className="badge-active-pill">activos</span>}
          </div>
          <div className="panel-header-right">
            <div className="switch-finalizados-wrapper" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                role="switch"
                aria-checked={mostrarFinalizados}
                disabled={soloModoNormal}
                onClick={() => setMostrarFinalizados(v => !v)}
                className={`switch-pista ${mostrarFinalizados ? 'switch-pista-activo' : ''}`}
                title={soloModoNormal ? 'No aplica en modo histórico ni con búsqueda activa' : undefined}
              >
                <span className="switch-circulo" />
              </button>
              <span className="switch-finalizados-label-desktop">
                {mostrarFinalizados ? 'Mostrando' : 'Ocultando'} finalizados
              </span>
              <span className="switch-finalizados-label-mobile">
                <HelpPopover>
                  Este switch <strong>muestra u oculta los pedidos ya finalizados</strong> dentro de los últimos 30 días. No aplica en modo histórico ni con búsqueda activa.
                </HelpPopover>
              </span>
            </div>
            <div className="vista-controls" onClick={e => e.stopPropagation()}>
              <button onClick={() => setVista('compact')} title="Vista compacta"
                className={`btn-toggle ${vista === 'compact' ? 'btn-toggle-active' : ''}`}>
                <AlignJustify size={13} />
              </button>
              <button onClick={() => setVista('full')} title="Vista completa"
                className={`btn-toggle ${vista === 'full' ? 'btn-toggle-active' : ''}`}>
                <LayoutList size={13} />
              </button>
            </div>
            {filtrosOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </div>
        </div>

        {filtrosOpen && (
          <div className="panel-body">

            {/* Bloque 1: Filtros básicos */}
            <div className="filtros-bloque">
              <span className="filtros-bloque-titulo">Filtros básicos</span>
              <div className="filters-row">
                <select value={prioridad} onChange={e => { setPrioridad(e.target.value) }} className="select-auto">
                  <option value="">Todas las prioridades</option>
                  {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <select value={tipo} onChange={e => { setTipo(e.target.value) }} className="select-auto">
                  <option value="">Todos los tipos</option>
                  {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value) }} className="select-auto">
                  <option value="">Todos los estados</option>
                  <option value="sin_estado">Sin estado</option>
                  {estados.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
                <select value={filtroUsuario} onChange={e => { setFiltroUsuario(e.target.value) }} className="select-auto">
                  <option value="">Todos los usuarios</option>
                  <option value="mios">Mis pedidos</option>
                  {usuarios.filter(u => u.id !== user?.id).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
                {tagsDisponibles.length > 0 && (
                  <div className="tags-filtro-ancho">
                    <TagSearch tags={tagsDisponibles} value={filtroTag} onChange={v => { setFiltroTag(v) }} />
                  </div>
                )}
                <button
                  onClick={() => { setModoHistorico(v => !v) }}
                  className={`select-auto btn-toggle-pill btn-historico-ancho ${modoHistorico ? 'btn-toggle-pill-active' : ''}`}
                  title="Pedidos activos (sin finalizar) que quedaron fuera del rango habitual"
                >
                  <History size={13} />Ver histórico sin finalizar
                </button>
              </div>
              {filtroTag && (
                <div className="tag-filter-row">
                  <span className="tag-filter-label">Tag:</span>
                  <span className="tag-chip-filter">
                    <Tag size={10} />{filtroTag}
                    <button onClick={() => setFiltroTag('')} className="flex items-center ml-0.5"><X size={10} /></button>
                  </span>
                </div>
              )}
            </div>

            {/* Bloque 2: Fechas de vencimiento */}
            <div className="filtros-bloque">
              <span className="filtros-bloque-titulo-row">
                <span className="filtros-bloque-titulo">Fechas de vencimiento de pedidos</span>
                <HelpPopover>
                  Esta sección filtra por <strong>fechas de vencimiento de pedidos</strong>, no por <strong>fechas de creación</strong>.
                </HelpPopover>
              </span>
              <div className="filter-dates-row">
                <div className="filter-date-col">
                  <DatePicker value={fechaDesde} onChange={v => { setFechaDesde(v) }} placeholder="Vence desde" disabled={soloModoNormal} />
                </div>
                <div className="filter-date-col">
                  <DatePicker value={fechaHasta} onChange={v => { setFechaHasta(v) }} placeholder="Vence hasta" disabled={soloModoNormal} />
                </div>
                <div className="filter-shortcuts-row">
                  <button disabled={soloModoNormal} onClick={() => aplicarShortcutFecha('hoy')}
                    className={`btn-shortcut-fecha ${shortcutActivo === 'hoy' ? 'btn-shortcut-fecha-active' : ''}`}>Hoy</button>
                  <button disabled={soloModoNormal} onClick={() => aplicarShortcutFecha('semana')}
                    className={`btn-shortcut-fecha ${shortcutActivo === 'semana' ? 'btn-shortcut-fecha-active' : ''}`}>Esta semana</button>
                  <button disabled={soloModoNormal} onClick={() => aplicarShortcutFecha('mes')}
                    className={`btn-shortcut-fecha ${shortcutActivo === 'mes' ? 'btn-shortcut-fecha-active' : ''}`}>Este mes</button>
                </div>
              </div>
              {hayFechaVencimiento && (
                <p className="filtros-bloque-nota">
                  <Calendar size={12} />Mostrando por fecha de vencimiento, sin límite de antigüedad.
                </p>
              )}
            </div>

            {/* Bloque 3: Búsqueda */}
            <div className="filtros-bloque">
              <span className="filtros-bloque-titulo">Búsqueda</span>
              <div className="search-wrapper">
                <span className="search-icon"><Search size={15} /></span>
                <input
                  placeholder="Buscar por asunto, pieza, link o tag…"
                  value={busqueda}
                  onChange={e => { setBusqueda(e.target.value) }}
                  className="input-icon-left"
                />
              </div>
              {hayBusqueda && (
                <p className="filtros-bloque-nota">
                  <Search size={12} />Buscando en todo el historial, sin límite de antigüedad.
                </p>
              )}
            </div>

            {/* Bloque 4: Visualización — no es un filtro de qué pedidos
                ver, es una preferencia de cómo se muestran dentro de
                cada grupo de día. */}
            <div className="filtros-bloque">
              <span className="filtros-bloque-titulo-row">
                <span className="filtros-bloque-titulo">Visualización</span>
                <HelpPopover>
                  Aplica dentro de cada día, separado entre pedidos activos y finalizados.
                </HelpPopover>
              </span>
              <div className="filters-row">
                <select
                  value={modoPersonalizado ? 'custom' : paginaSizeGrupo}
                  onChange={e => {
                    if (e.target.value === 'custom') {
                      setModoPersonalizado(true)
                      return // el valor numérico se define con el input que aparece al lado
                    }
                    setModoPersonalizado(false)
                    setPaginaSizeGrupo(Number(e.target.value))
                    setTextoPersonalizado(e.target.value)
                    setPaginaPorSubgrupo({})
                  }}
                  className="select-auto"
                >
                  <option value={10}>10 pedidos por página</option>
                  <option value={15}>15 pedidos por página</option>
                  <option value={20}>20 pedidos por página</option>
                  <option value="custom">Personalizado…</option>
                </select>
                {modoPersonalizado && (
                  <input
                    type="number"
                    min={1}
                    value={textoPersonalizado}
                    onChange={e => {
                      const texto = e.target.value
                      setTextoPersonalizado(texto)
                      const valor = parseInt(texto, 10)
                      if (!Number.isNaN(valor) && valor > 0) {
                        setPaginaSizeGrupo(valor)
                        setPaginaPorSubgrupo({})
                      }
                    }}
                    placeholder="Cantidad"
                    style={{ width: '110px' }}
                  />
                )}
              </div>
            </div>

            {hayFiltrosActivos && (
              <button onClick={limpiarFiltros} className="btn-clear-filters">
                <X size={13} />Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {hayNuevos && (
        <button onClick={handleVerNuevos} className="btn-nuevos-pedidos">
          <ArrowUp size={14} />Hay pedidos nuevos — ver
        </button>
      )}

      {loading && <div className="loading-text">Cargando pedidos…</div>}

      {!loading && pedidos.length === 0 && (
        <div className="empty-state">
          <Filter size={32} />
          <p>No hay pedidos.</p>
          {role !== ROLES.VIEWER && !hayFiltrosActivos && (
            <button onClick={onNew} className="btn-primary" style={{ width: 'auto', marginTop: '0.75rem', padding: '0.5rem 1.25rem' }}>
              Crear el primero
            </button>
          )}
        </div>
      )}

      {!loading && grupos.map(grupo => {
        const activos = grupo.pedidos.filter(p => !p.estados?.includes('finalizado'))
        const finalizados = grupo.pedidos.filter(p => p.estados?.includes('finalizado'))

        // Página actual de cada sub-lista, independiente por grupo+tipo.
        const keyActivos = `${grupo.fecha}:activos`
        const keyFinalizados = `${grupo.fecha}:finalizados`
        const paginaActivos = paginaPorSubgrupo[keyActivos] ?? 0
        const paginaFinalizados = paginaPorSubgrupo[keyFinalizados] ?? 0

        const totalPaginasActivos = Math.max(1, Math.ceil(activos.length / paginaSizeGrupo))
        const totalPaginasFinalizados = Math.max(1, Math.ceil(finalizados.length / paginaSizeGrupo))

        const activosVisibles = activos.slice(paginaActivos * paginaSizeGrupo, (paginaActivos + 1) * paginaSizeGrupo)
        const finalizadosVisibles = finalizados.slice(paginaFinalizados * paginaSizeGrupo, (paginaFinalizados + 1) * paginaSizeGrupo)

        function setPaginaActivos(updater) {
          setPaginaPorSubgrupo(prev => ({ ...prev, [keyActivos]: updater(prev[keyActivos] ?? 0) }))
        }
        function setPaginaFinalizados(updater) {
          setPaginaPorSubgrupo(prev => ({ ...prev, [keyFinalizados]: updater(prev[keyFinalizados] ?? 0) }))
        }

        return (
          <div key={grupo.fecha} className="flex flex-col" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
            <GrupoDiaLabel fecha={grupo.fecha} cantidad={grupo.pedidos.length} finalizados={finalizados.length} />
            {activos.length > 0 && <GrupoLabel texto="Activos" />}
            <div className="flex flex-col" style={{ gap: vista === 'compact' ? '0.375rem' : '0.625rem' }}>
              {activosVisibles.map(p => renderPedido(p))}
            </div>
            <Paginacion pagina={paginaActivos} totalPaginas={totalPaginasActivos} setPagina={setPaginaActivos} />

            {finalizados.length > 0 && <GrupoLabel texto="Finalizados" />}
            <div className="flex flex-col" style={{ gap: vista === 'compact' ? '0.375rem' : '0.625rem' }}>
              {finalizadosVisibles.map(p => renderPedido(p))}
            </div>
            <Paginacion pagina={paginaFinalizados} totalPaginas={totalPaginasFinalizados} setPagina={setPaginaFinalizados} />
          </div>
        )
      })}

      {!loading && hayMas && (
        <button onClick={cargarMas} disabled={cargandoMas} className="btn-cargar-mas">
          {cargandoMas ? 'Cargando…' : <><ChevronDown size={16} />Cargar más pedidos ({total - pedidos.length} restantes)</>}
        </button>
      )}

    </div>
  )
}
