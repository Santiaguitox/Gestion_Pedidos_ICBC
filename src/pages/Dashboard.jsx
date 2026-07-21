import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TagSearch } from '@/components/ui/TagSearch'
import { useAuth } from '@/context/useAuth'
import { supabase } from '@/lib/supabase'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import {
  ChevronDown, ChevronUp, LayoutList, AlignJustify, Filter, Tag, X,
  Calendar, CalendarOff,
} from 'lucide-react'
import { endOfWeek, addWeeks, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useLocalStorage } from '@/hooks/useLocalStorage'
// calcularGrupo vivía acá y se mudó a lib (lo comparten CargaTrabajoModal
// y el criterio de vencido del Calendario) — ver src/lib/fechas.js.
import { calcularGrupo } from '@/lib/fechas'
import { useTipos } from '@/hooks/useTipos'
import { useTagsDisponibles } from '@/hooks/useTagsDisponibles'
import { useUsuarios } from '@/hooks/useUsuarios'
import { PedidoCardCompact, PedidoCardFull } from '@/components/pedidos/PedidoCard'

// Metadata de los 6 grupos "normales" (Vencidos se maneja aparte, con su
// propio componente de acordeón de alerta — ver VencidosAcordeon más
// abajo). Escala de "temperatura" decreciente según urgencia: rojo
// institucional (Hoy) → naranja (Mañana) → naranja claro (Esta semana)
// → amarillo-dorado (Próxima semana) → gris (Más adelante/Sin fecha).
// "Hoy" usa el rojo INSTITUCIONAL (--icbc-red) en lugar del rojo de
// prioridad "Urgente" — ese rojo es más pálido y queda apagado como
// fondo sólido grande (confirmado visualmente el 2026-06-20). El
// amarillo de "Próxima semana" se eligió específicamente por su buen
// contraste tanto en texto sobre blanco como en blanco sobre el color
// (confirmado visualmente, ver #F5C10B) — un amarillo más puro se
// vuelve ilegible en alguno de los dos casos.
const GRUPOS_META = [
  { key: 'hoy',            label: 'Hoy',              Icono: Calendar,    color: '#D0111B' }, // rojo institucional, mismo que Vencidos
  { key: 'mañana',         label: 'Mañana',           Icono: Calendar,    color: '#F97316' }, // naranja, como prioridad "Alta"
  { key: 'esta_semana',    label: 'Esta semana',      Icono: Calendar,    color: '#F59E0B' }, // naranja claro, como prioridad "Media"
  { key: 'proxima_semana', label: 'Próxima semana',   Icono: Calendar,    color: '#F5C10B' }, // amarillo-dorado, distinto del gris de Más adelante/Sin fecha
  { key: 'mas_adelante',   label: 'Más adelante',     Icono: Calendar,    color: '#6B7280' },
  { key: 'sin_fecha',      label: 'Sin fecha límite', Icono: CalendarOff, color: '#6B7280' },
]

// Los 5 stat cards de arriba — subconjunto de los grupos más urgentes y
// accionables del día a día. "Vencidos" NO está acá: en un día ideal
// debería estar vacío, así que no merece uno de los espacios más
// prominentes — en cambio, cuando SÍ hay vencidos, se destaca con su
// propio acordeón de alerta arriba de todo (ver VencidosAcordeon).
const STAT_CARDS_KEYS = ['hoy', 'mañana', 'esta_semana', 'proxima_semana', 'sin_fecha']

function GrupoSemantico({ meta, pedidos, vista, onTagClick, filtroTag, tipos, estados, limite, role }) {
  // El Hook va ANTES del early return de abajo — las reglas de Hooks de
  // React exigen que se llamen siempre, en el mismo orden, en CADA
  // render, sin importar si después el componente retorna null. Tenerlo
  // después del return rompía esa regla (no se llamaba cuando
  // pedidos.length === 0), lo que generaba el error interno de React
  // "Expected static flag was missing" — confirmado el 2026-06-22.
  const navigate = useNavigate()
  if (pedidos.length === 0) return null
  const { label, Icono, color } = meta
  // Límite opcional (usado solo en "Más adelante" — ver Dashboard más
  // abajo): el Dashboard se pensó para ser un vistazo rápido, no una
  // pantalla de trabajo con paginación configurable como Pedidos.jsx —
  // si hay más de los que el límite permite, se corta ahí y se ofrece
  // un link a Pedidos para ver el resto, en vez de paginar acá mismo.
  const visibles = limite ? pedidos.slice(0, limite) : pedidos
  const ocultos = pedidos.length - visibles.length

  // Al ir a Pedidos desde "Más adelante", configura automáticamente el
  // filtro de vencimiento con el rango correspondiente (desde el día
  // siguiente al fin de la próxima semana, sin límite superior) — así
  // la persona llega viendo directamente esos pedidos, sin tener que
  // buscar manualmente qué filtro activar.
  function irAPedidosConFiltro() {
    const hoyCalc = new Date(); hoyCalc.setHours(0, 0, 0, 0)
    const finProxSemana = endOfWeek(addWeeks(hoyCalc, 1), { weekStartsOn: 1 })
    const desde = new Date(finProxSemana); desde.setDate(desde.getDate() + 1)
    navigate('/pedidos', { state: { venceDesde: format(desde, 'yyyy-MM-dd') } })
  }

  return (
    <div className="dia-group">
      <div className="dia-group-header">
        <span className="grupo-semantico-icono" style={{ color }}>
          <Icono size={18} />
        </span>
        <span className="dia-group-label dia-group-label-principal">{label}</span>
        <div className="dia-group-line-flex" style={{ background: color, opacity: 0.35 }} />
        <span className="dia-group-count" style={{ color }}>{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="dia-group-cards">
        {visibles.map(p => vista === 'compact'
          ? <PedidoCardCompact key={p.id} pedido={p} onTagClick={onTagClick} filtroTag={filtroTag} tipos={tipos} estados={estados} origenRuta="/" role={role} />
          : <PedidoCardFull key={p.id} pedido={p} onTagClick={onTagClick} filtroTag={filtroTag} tipos={tipos} estados={estados} origenRuta="/" role={role} />
        )}
        {ocultos > 0 && (
          <button onClick={irAPedidosConFiltro} className="btn-ver-todos-pedidos">
            Ver {ocultos} más en Pedidos →
          </button>
        )}
      </div>
    </div>
  )
}

// Acordeón especial para "Vencidos" — la única categoría que realmente
// necesita "gritar". Arranca CERRADO (no ocupa espacio con sus tarjetas
// hasta que se hace click), con un punto rojo pulsante que llama la
// atención sin saturar el resto de la pantalla con colores. Si no hay
// ningún pedido vencido, no se renderiza nada (no tiene sentido mostrar
// una alerta vacía).
function VencidosAcordeon({ pedidos, vista, onTagClick, filtroTag, tipos, estados, role }) {
  const [open, setOpen] = useState(false)
  if (pedidos.length === 0) return null

  return (
    <div className="vencidos-acordeon">
      <button className="vencidos-acordeon-header" onClick={() => setOpen(v => !v)}>
        <span className="vencidos-acordeon-dot" />
        <span className="vencidos-acordeon-label">Vencidos</span>
        <span className="vencidos-acordeon-count">{pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}</span>
        <span className="vencidos-acordeon-chevron">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      <div className={`acordeon-anim${open ? ' abierto' : ''}`}>
        <div className="acordeon-anim-clip">
          <div className="vencidos-acordeon-cards">
            {pedidos.map(p => vista === 'compact'
              ? <PedidoCardCompact key={p.id} pedido={p} onTagClick={onTagClick} filtroTag={filtroTag} tipos={tipos} estados={estados} origenRuta="/" role={role} />
              : <PedidoCardFull key={p.id} pedido={p} onTagClick={onTagClick} filtroTag={filtroTag} tipos={tipos} estados={estados} origenRuta="/" role={role} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Stat card clickeable de arriba — funciona como filtro rápido. En
// estado normal, el bullet y el número grande llevan el color de la
// categoría (sobre fondo blanco). Al activarlo (es el grupo actualmente
// filtrado), el fondo se vuelve sólido de ese color y el contenido pasa
// a blanco, para que siga siendo legible sobre el fondo.
function StatCard({ label, cantidad, color, onClick, activo, destacado }) {
  return (
    <button
      onClick={onClick}
      className={`stat-card-clickeable ${activo ? 'stat-card-clickeable-activo' : ''} ${destacado ? 'stat-card-clickeable-destacado' : ''}`}
      style={{ '--stat-card-color': color, ...(activo ? { background: color, borderColor: color } : {}) }}
    >
      <span className="stat-card-clickeable-fila-superior">
        <span className="stat-card-clickeable-dot" style={{ background: activo ? '#fff' : color }} />
        <span className="stat-card-clickeable-label" style={activo ? { color: '#fff' } : undefined}>{label}</span>
      </span>
      <span className="stat-card-clickeable-valor" style={{ color: activo ? '#fff' : color }}>{cantidad}</span>
    </button>
  )
}

export default function Dashboard() {
  useDocumentTitle('Dashboard')

  const { user, profile, role } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const { estados } = useEstados()
  const { tipos } = useTipos()
  const { tags: tagsDisponibles } = useTagsDisponibles()
  const { usuarios } = useUsuarios()

  const [filtroEstado, setFiltroEstado] = useLocalStorage('dashboard:filtroEstado', '')
  const [filtroPrioridad, setFiltroPrioridad] = useLocalStorage('dashboard:filtroPrioridad', '')
  const [filtroTipo, setFiltroTipo] = useLocalStorage('dashboard:filtroTipo', '')
  const [filtroUsuario, setFiltroUsuario] = useLocalStorage('dashboard:filtroUsuario', '')
  const [filtroTag, setFiltroTag] = useLocalStorage('dashboard:filtroTag', '')
  const [filtroMisSubtareas, setFiltroMisSubtareas] = useLocalStorage('dashboard:filtroMisSubtareas', '')
  const [vista, setVista] = useLocalStorage('dashboard:vista', 'compact')
  const [filtrosOpen, setFiltrosOpen] = useLocalStorage('dashboard:filtrosOpen', true)
  const [excluirEsperando, setExcluirEsperando] = useLocalStorage('dashboard:excluirEsperando', false)
  const isViewer = role === ROLES.VIEWER

  const hayFiltrosActivos = filtroEstado || filtroPrioridad || filtroTipo || filtroUsuario || filtroTag || filtroMisSubtareas

  // Trae TODOS los pedidos activos (modo 'dashboard' de listar_pedidos —
  // sin paginar del lado SQL, ver comentario en la función). La
  // paginación real de esta pantalla es por GRUPO semántico, no por
  // página plana, así que no tiene sentido pedir "páginas" acá.
  // Función pura de fetch, reusada tanto por el efecto que dispara con
  // cambios de filtro como por el canal de realtime de abajo — evita
  // duplicar la misma llamada en dos lugares.
  // Sin setLoading(true) síncrono acá adentro: el flip de loading al
  // cambiar un filtro lo hace el ajuste-en-render de abajo (mismo
  // paint que el cambio, sin el render en cascada post-commit que
  // react-hooks/set-state-in-effect marca como error). CAMBIO DE
  // COMPORTAMIENTO deliberado en el camino de realtime: antes cada
  // cambio en la tabla de pedidos (incluso de otro usuario) pasaba
  // por acá y flasheaba el skeleton entero del dashboard; ahora el
  // refetch de realtime reemplaza la lista en silencio cuando llega
  // la respuesta — un refresh de fondo no debería blanquear lo que ya
  // se está viendo.
  function fetchPedidosDashboard() {
    supabase.rpc('listar_pedidos', {
      p_modo: 'dashboard',
      p_prioridad: filtroPrioridad || null,
      p_tipo: filtroTipo || null,
      p_estado: filtroEstado || null,
      p_tag: filtroTag || null,
      p_usuario_id: filtroUsuario === 'mios' ? (user?.id ?? null) : (filtroUsuario || null),
    }).then(({ data, error }) => {
      if (error) { setLoading(false); return }
      setPedidos(data?.[0]?.pedidos ?? [])
      setLoading(false)
    })
  }

  // Flip de loading al cambiar filtros — ajuste de estado DURANTE el
  // render con tracking del valor anterior (patrón de React para
  // estado derivado), en el mismo paint que el cambio. El montaje lo
  // cubre el useState(true) inicial de loading.
  const claveFiltros = JSON.stringify([filtroPrioridad, filtroTipo, filtroEstado, filtroTag, filtroUsuario, user?.id])
  const [claveFiltrosPrevia, setClaveFiltrosPrevia] = useState(claveFiltros)
  if (claveFiltros !== claveFiltrosPrevia) {
    setClaveFiltrosPrevia(claveFiltros)
    setLoading(true)
  }

  // Fetch async puro: los sets de adentro corren todos dentro del
  // .then() (post-respuesta), no hay setState síncrono en el cuerpo
  // del efecto.
  useEffect(() => {
    fetchPedidosDashboard()
  }, [filtroPrioridad, filtroTipo, filtroEstado, filtroTag, filtroUsuario, user?.id])

  // Realtime: a diferencia de usePedidos.js (que pagina y por eso
  // actualiza filas puntuales para no perder la paginación), el
  // Dashboard siempre trae TODOS los pedidos activos de una (modo
  // 'dashboard' no pagina) — así que ante cualquier cambio en la tabla,
  // alcanza con un refetch completo simple, sin la complejidad de
  // actualizar una fila a la vez.
  useEffect(() => {
    const canal = supabase
      .channel(`dashboard-pedidos-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchPedidosDashboard()
      })
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [filtroPrioridad, filtroTipo, filtroEstado, filtroTag, filtroUsuario, user?.id])

  const [grupoFiltrado, setGrupoFiltrado] = useLocalStorage('dashboard:grupoFiltrado', '')

  function limpiarFiltros() {
    setFiltroEstado(''); setFiltroPrioridad(''); setFiltroTipo('')
    setFiltroUsuario(''); setFiltroTag(''); setFiltroMisSubtareas('')
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

  // Si el switch está activo, excluye los pedidos en estado
  // "esperando_respuesta" antes de calcular grupos y conteos — así los
  // stat cards y las listas reflejan solo lo que está pendiente de
  // nuestro lado. Se aplica sobre el array crudo de la DB, antes de
  // cualquier clasificación semántica.
  const pedidosBaseSwitch = excluirEsperando
    ? pedidos.filter(p => !p.estados?.includes('esperando_respuesta'))
    : pedidos

  // Filtra por subtareas asignadas al usuario logueado.
  // "pendientes"  → tiene al menos una subtarea mía sin completar
  // "terminadas"  → tiene al menos una subtarea mía y todas están completadas
  const pedidosFiltrados = !filtroMisSubtareas ? pedidosBaseSwitch : pedidosBaseSwitch.filter(p => {
    const mias = (p.subtareas ?? []).filter(s => s.asignado_a === user?.id)
    if (!mias.length) return false
    if (filtroMisSubtareas === 'pendientes') return mias.some(s => !s.completada)
    if (filtroMisSubtareas === 'terminadas') return mias.every(s => s.completada)
    return true
  })

  // "Vencidos" se separa del resto — tiene su propio componente de
  // alerta (VencidosAcordeon), no es uno de los 6 grupos "normales".
  const vencidos = pedidosFiltrados
    .filter(p => calcularGrupo(p, hoy) === 'vencidos')
    .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))

  // Clasifica cada pedido (no vencido) en su grupo semántico y los junta
  // por grupo, en el orden definido por GRUPOS_META. Cada grupo ya viene
  // ordenado por fecha_limite ascendente (lo más próximo a vencer
  // primero) — salvo "sin_fecha", que no tiene fecha para ordenar, se
  // deja en el orden que llegó (created_at desc, heredado de la función
  // SQL).
  const gruposTodos = GRUPOS_META.map(meta => {
    const pedidosGrupo = pedidosFiltrados
      .filter(p => calcularGrupo(p, hoy) === meta.key)
      .sort((a, b) => {
        if (meta.key === 'sin_fecha') return 0
        return new Date(a.fecha_limite) - new Date(b.fecha_limite)
      })
    return { meta, pedidos: pedidosGrupo }
  })

  // Si hay un grupo filtrado (click en un stat card), solo se muestra
  // ese grupo en la lista de abajo — el resto queda oculto hasta que se
  // vuelva a hacer click en el mismo card (lo desactiva) o en otro.
  const grupos = grupoFiltrado
    ? gruposTodos.filter(g => g.meta.key === grupoFiltrado)
    : gruposTodos

  function toggleStatCard(key) {
    setGrupoFiltrado(actual => actual === key ? '' : key)
  }

  const totalVisible = pedidosFiltrados.length
  const nombrePila = (profile?.full_name ?? '').split(' ')[0]
  const fechaHoyTexto = format(hoy, "EEEE d 'de' MMMM", { locale: es })
  const fechaHoyCapitalizada = fechaHoyTexto.charAt(0).toUpperCase() + fechaHoyTexto.slice(1)

  return (
    <div className="page-root">
      <div className="dashboard-saludo">
        <h1 className="page-title">{nombrePila ? `Hola, ${nombrePila}` : 'Dashboard'}</h1>
        <p className="page-subtitle">
          {fechaHoyCapitalizada} · {totalVisible} pedido{totalVisible !== 1 ? 's' : ''} pendiente{totalVisible !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="stat-cards-row">
        {GRUPOS_META.filter(m => STAT_CARDS_KEYS.includes(m.key)).map(meta => {
          const cantidad = gruposTodos.find(g => g.meta.key === meta.key)?.pedidos.length ?? 0
          return (
            <StatCard
              key={meta.key}
              label={meta.label}
              cantidad={cantidad}
              color={meta.color}
              activo={grupoFiltrado === meta.key}
              destacado={meta.key === 'hoy'}
              onClick={() => toggleStatCard(meta.key)}
            />
          )
        })}
      </div>

      <div className="panel">
        <div className="panel-header" onClick={() => setFiltrosOpen(!filtrosOpen)}>
          <div className="panel-header-left">
            <Filter size={15} color="var(--text-muted)" />
            <span className="panel-label">Filtros y vista</span>
            {hayFiltrosActivos && <span className="badge-active-pill">activos</span>}
          </div>
          <div className="panel-header-right">
            <div className="switch-finalizados-wrapper" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                role="switch"
                aria-checked={excluirEsperando}
                onClick={() => setExcluirEsperando(v => !v)}
                className={`switch-pista ${excluirEsperando ? 'switch-pista-activo' : ''}`}
              >
                <span className="switch-circulo" />
              </button>
              <span className="switch-finalizados-label-desktop">
                {excluirEsperando ? 'Nuestros' : 'Totales'}
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
            {filtrosOpen
              ? <ChevronUp size={16} color="var(--text-muted)" />
              : <ChevronDown size={16} color="var(--text-muted)" />
            }
          </div>
        </div>

        <div className={`acordeon-anim${filtrosOpen ? ' abierto' : ''}`}>
        <div className="acordeon-anim-clip">
          <div className="panel-body">
            <div className="filters-row">
              <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)} className="select-auto">
                <option value="">Todas las prioridades</option>
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="select-auto">
                <option value="">Todos los tipos</option>
                {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="select-auto">
                <option value="">Todos los estados</option>
                <option value="sin_estado">Sin estado</option>
                {estados.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              {!isViewer && (
                <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} className="select-auto">
                  <option value="">Todos los usuarios</option>
                  <option value="mios">Mis pedidos</option>
                  {usuarios.filter(u => u.id !== user?.id).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              )}
              {!isViewer && (
                <select value={filtroMisSubtareas} onChange={e => setFiltroMisSubtareas(e.target.value)} className="select-auto">
                  <option value="">Mis subtareas</option>
                  <option value="pendientes">Pendientes</option>
                  <option value="terminadas">Terminadas</option>
                </select>
              )}
              {tagsDisponibles.length > 0 && (
                <TagSearch tags={tagsDisponibles} value={filtroTag} onChange={setFiltroTag} />
              )}
              {hayFiltrosActivos && (
                <button onClick={limpiarFiltros} className="btn-clear-filters">
                  <X size={13} />Limpiar filtros
                </button>
              )}
            </div>

            {filtroTag && (
              <div className="tag-filter-row">
                <span className="tag-filter-label">Tag:</span>
                <span className="tag-chip-filter">
                  <Tag size={10} />{filtroTag}
                  <button onClick={() => setFiltroTag('')} className="flex items-center ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {loading && <p className="text-muted-sm">Cargando…</p>}
      {!loading && totalVisible === 0 && (
        <div className="empty-state">
          <Filter size={32} />
          <p>No hay pedidos pendientes con esos filtros.</p>
        </div>
      )}

      {!grupoFiltrado && (
        <VencidosAcordeon
          pedidos={vencidos}
          vista={vista}
          onTagClick={setFiltroTag}
          filtroTag={filtroTag}
          tipos={tipos}
          estados={estados}
          role={role}
        />
      )}

      {grupos.map(({ meta, pedidos: pedidosGrupo }) => (
        <GrupoSemantico
          key={meta.key}
          meta={meta}
          pedidos={pedidosGrupo}
          vista={vista}
          onTagClick={setFiltroTag}
          filtroTag={filtroTag}
          tipos={tipos}
          estados={estados}
          limite={meta.key === 'mas_adelante' ? 15 : undefined}
          role={role}
        />
      ))}
    </div>
  )
}
