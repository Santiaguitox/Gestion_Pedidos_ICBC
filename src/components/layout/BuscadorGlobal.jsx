import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/Badge'
import { colorAvatar, iniciales } from '@/lib/avatares'
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown, Tag, Link2, X,
  LayoutGrid, ListTodo, CalendarDays, Bell, Users, Settings, Trash2, FileSearch, Database, MailCheck,
  BarChart2, Plus, Sun, Moon, LogOut, History,
} from 'lucide-react'

// Debounce simple: espera a que la persona deje de tipear antes de
// disparar la búsqueda — evita pegarle al RPC en cada tecla.
function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// Mismas secciones y rutas que el sidebar (AppLayout.jsx) — 'rol'
// es el mínimo necesario para verla, replicando exactamente isAdminOrAbove
// / isSuperAdmin de ahí, así el buscador nunca ofrece navegar a algo que
// el usuario no vería tampoco en su menú lateral.
const SECCIONES = [
  { label: 'Dashboard', to: '/', icon: LayoutGrid },
  { label: 'Pedidos', to: '/pedidos', icon: ListTodo },
  { label: 'Calendario', to: '/calendario', icon: CalendarDays },
  // Mismo gate que el link del nav (isSuperAdmin || role === ADMIN) y
  // misma posición que en el sidebar (entre Calendario y Notificaciones).
  { label: 'Estadísticas', to: '/estadisticas', icon: BarChart2, rol: 'admin' },
  { label: 'Notificaciones', to: '/notificaciones', icon: Bell, sinViewer: true },
  { label: 'Usuarios', to: '/usuarios', icon: Users, rol: 'admin' },
  { label: 'Configuración', to: '/configuracion', icon: Settings, rol: 'admin' },
  { label: 'Papelera', to: '/papelera', icon: Trash2, rol: 'super_admin' },
  // Viewer no tiene acceso a ninguna de las 3 herramientas (ver
  // ProtectedRoute en App.jsx para la protección real de las rutas) —
  // sinViewer oculta las tres del buscador para ese rol, sin afectar el
  // resto de los roles, que siguen viéndolas igual que antes.
  { label: 'Revisión de emails', to: '/revision-html', icon: FileSearch, sinViewer: true },
  { label: 'Revisión de BBDD', to: '/revision-bbdd', icon: Database, sinViewer: true },
  { label: 'Revisión de envíos', to: '/revision-envios', icon: MailCheck, sinViewer: true },
]

function puedeVer(item, role) {
  if (item.sinViewer && role === ROLES.VIEWER) return false
  if (!item.rol) return true
  if (item.rol === 'admin') return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  if (item.rol === 'super_admin') return role === ROLES.SUPER_ADMIN
  return true
}

function norm(s) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ─── Pedidos recientes (localStorage) ─────────────────────────────────
// Últimos pedidos ABIERTOS DESDE EL BUSCADOR (no todo lo navegado en la
// app — eso sería otro alcance). Se muestran con el input vacío: la
// mayoría de las veces uno busca lo mismo que ayer. Solo id + asunto —
// el asunto puede quedar desactualizado si alguien lo edita, pero es un
// atajo best-effort, al hacer click siempre se navega al pedido real.
const LS_RECIENTES = 'twh_buscador_recientes'
const MAX_RECIENTES = 5

function leerRecientes() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_RECIENTES) || '[]')
    if (!Array.isArray(arr)) return []
    return arr.filter(r => r && r.id && r.asunto).slice(0, MAX_RECIENTES)
  } catch {
    return []
  }
}

function guardarReciente({ id, asunto }) {
  try {
    const sinEste = leerRecientes().filter(r => r.id !== id)
    localStorage.setItem(LS_RECIENTES, JSON.stringify([{ id, asunto }, ...sinEste].slice(0, MAX_RECIENTES)))
  } catch {
    // localStorage lleno o bloqueado (modo privado): el atajo de
    // recientes simplemente no persiste, nada que romper.
  }
}

const ICONO_COINCIDENCIA = { tag: Tag, pieza: Link2 }

// Fila genérica para todo lo que no es un pedido buscado: secciones
// ("Ir a X"), acciones ("Nuevo pedido") y pedidos recientes. Misma
// anatomía visual (tile + label + tag), reusa las clases existentes.
function FilaSimple({ icon: Icon, label, tag, activo, onClick, onHover }) {
  return (
    <button className={`busqueda-global-fila-nav ${activo ? 'activo' : ''}`} onClick={onClick} onMouseEnter={onHover}>
      <span className="busqueda-global-tile-nav"><Icon size={16} /></span>
      <span className="busqueda-global-nav-label">{label}</span>
      <span className="busqueda-global-nav-tag">{tag}</span>
      {activo && <CornerDownLeft size={14} className="busqueda-global-fila-enter" />}
    </button>
  )
}

function FilaPedido({ pedido, estados, tipos, activo, orden, query, onClick, onHover }) {
  const prio = PRIORIDADES.find(x => x.value === pedido.prioridad)
  const tipoInfo = tipos.find(t => t.value === pedido.tipo)
  const IconoTipo = ICONO_COINCIDENCIA[pedido.coincidencia_en]

  // Si la coincidencia fue por persona, se prioriza mostrar A ESA
  // persona específica en la metadata (no necesariamente la primera
  // de la lista de asignados) — para que el texto resaltado realmente
  // explique por qué apareció este resultado.
  const asignados = pedido.pedido_asignados ?? []
  const nq = norm(query)
  const asignadoQueCoincide = pedido.coincidencia_en === 'persona'
    ? asignados.find(a => norm(a.profiles?.full_name).includes(nq))
    : null
  const asignadoPrincipal = asignadoQueCoincide ?? asignados[0] ?? null
  const extraAsignados = Math.max(0, asignados.length - 1)

  let metaMatch = null
  if (pedido.coincidencia_en === 'tag') {
    metaMatch = '#' + (pedido.tags?.find(t => norm(t).includes(nq)) ?? pedido.tags?.[0])
  } else if (pedido.coincidencia_en === 'pieza') {
    const e = pedido.entregable?.find(e =>
      norm(e.nombre_pieza).includes(nq) || norm(e.link_online).includes(nq)
    )
    metaMatch = e?.nombre_pieza || e?.link_online || null
  } else if (pedido.coincidencia_en === 'persona' && asignadoQueCoincide) {
    metaMatch = 'Asignado a ' + asignadoQueCoincide.profiles?.full_name
  }

  const estadoUno = pedido.estados?.[0]
  const estadoUnoInfo = estadoUno ? estados.find(x => x.value === estadoUno) : null

  return (
    <button className={`busqueda-global-fila-pedido ${activo ? 'activo' : ''}`} onClick={onClick} onMouseEnter={onHover}>
      <span className="busqueda-global-tile-pedido" style={{ background: `${prio?.color ?? '#6B7280'}1F`, color: prio?.color ?? '#6B7280' }}>
        {orden}
      </span>
      <div className="busqueda-global-pedido-col">
        <div className="busqueda-global-pedido-l1">
          <span className="busqueda-global-fila-dot" style={{ background: prio?.color ?? '#6B7280' }} />
          <span className="busqueda-global-fila-asunto">{pedido.asunto}</span>
        </div>
        <div className="busqueda-global-pedido-l2">
          {asignadoPrincipal && (
            <span
              className="busqueda-global-mini-avatar"
              style={{ background: asignadoPrincipal.profiles?.avatar_color || colorAvatar(asignadoPrincipal.user_id) }}
              title={asignadoPrincipal.profiles?.full_name}
            >
              {iniciales(asignadoPrincipal.profiles?.full_name)}
            </span>
          )}
          {extraAsignados > 0 && <span className="busqueda-global-pedido-extra">+{extraAsignados}</span>}
          {tipoInfo && <Badge label={tipoInfo.label} color={tipoInfo.color} size="sm" />}
          {metaMatch && (
            <>
              <span className="busqueda-global-pedido-sep">·</span>
              {IconoTipo && <IconoTipo size={12} />}
              <span className="busqueda-global-pedido-meta">{metaMatch}</span>
            </>
          )}
        </div>
      </div>
      {estadoUnoInfo && (
        <span className="busqueda-global-fila-chip" style={{ background: `${estadoUnoInfo.color}18`, color: estadoUnoInfo.color }}>
          {estadoUnoInfo.label}
        </span>
      )}
      {activo && <CornerDownLeft size={14} className="busqueda-global-fila-enter" />}
    </button>
  )
}

export default function BuscadorGlobal({ open, onClose, role }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { estados } = useEstados()
  const { tipos } = useTipos()
  const { theme, toggle: toggleTema } = useTheme()
  const { signOut } = useAuth()
  const [query, setQuery] = useState('')
  const [resultadosPedidos, setResultadosPedidos] = useState([])
  // Query cuya respuesta del RPC es la que está en resultadosPedidos —
  // "cargando" y "qué resultados mostrar" se DERIVAN de comparar esto
  // contra la query actual, en vez de setear flags sincrónicos dentro
  // del efecto (que era el último set-state-in-effect del archivo).
  const [queryRespondida, setQueryRespondida] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const debouncedQuery = useDebounced(query, 300)

  // Reset al ABRIR con el patrón adjust-during-render (comparar prev
  // state) en vez de un useEffect([open]) — mismo resultado, sin el
  // error react-hooks/set-state-in-effect que tenía la versión anterior.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setQuery('')
      setResultadosPedidos([])
      setQueryRespondida('')
      setActiveIndex(0)
    }
  }

  // El autofocus sí queda en un efecto: es un side effect de DOM
  // (permitido), no un setState.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  const hayQuery = query.trim() !== ''
  // Derivados del ciclo query -> debounce -> RPC (sin flags manuales):
  // hay carga pendiente si lo tipeado todavía no coincide con lo último
  // respondido (cubre la ventana del debounce Y la del request en vuelo).
  const cargando = hayQuery && query.trim() !== queryRespondida
  // Los pedidos solo se muestran si corresponden a la query vigente —
  // evita listar resultados viejos de otra búsqueda mientras llega la
  // nueva respuesta (si la query se repite, se muestran al instante y
  // el refetch de fondo los refresca solo). Memoizado para que el []
  // del caso vacío sea referencia estable (es dep del useMemo de grupos).
  const pedidosVisibles = useMemo(
    () => ((hayQuery && queryRespondida === debouncedQuery.trim()) ? resultadosPedidos : []),
    [hayQuery, queryRespondida, debouncedQuery, resultadosPedidos]
  )

  // Recargar los recientes cada vez que el panel se abre — useMemo
  // sobre `open` en vez de estado + efecto: si otro tab agregó
  // recientes, se ven en la próxima apertura.
  const recientes = useMemo(() => (open ? leerRecientes() : []), [open])

  const seccionesVisibles = useMemo(() => SECCIONES.filter(s => puedeVer(s, role)), [role])

  // ─── Acciones ejecutables ────────────────────────────────────────
  // A diferencia de las secciones (que navegan), cada acción tiene un
  // run() propio. Mismo esquema de gates por rol que SECCIONES.
  const acciones = useMemo(() => {
    const lista = [
      {
        id: 'nuevo-pedido',
        label: 'Nuevo pedido',
        icon: Plus,
        // Viewer no puede crear pedidos (mismo gate que el botón de
        // PedidosList.jsx).
        sinViewer: true,
        // Pedidos.jsx lee state.abrirNuevo y abre el modal del form —
        // funciona desde cualquier pantalla, incluso estando ya parado
        // en /pedidos (el location.key nuevo de cada navigate() es lo
        // que Pedidos.jsx usa para no re-disparar de más).
        run: () => navigate('/pedidos', { state: { abrirNuevo: true } }),
      },
      {
        id: 'toggle-tema',
        label: theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
        icon: theme === 'dark' ? Sun : Moon,
        run: toggleTema,
      },
      {
        id: 'cerrar-sesion',
        label: 'Cerrar sesión',
        icon: LogOut,
        run: signOut,
      },
    ]
    return lista.filter(a => puedeVer(a, role))
  }, [theme, role, navigate, toggleTema, signOut])

  // ─── Listas visibles según haya query o no ───────────────────────
  // Con el input VACÍO el panel ya no muestra un placeholder: lista
  // recientes + acciones + secciones (estilo Linear) — sirve de menú
  // y de descubrimiento de las acciones. Con query, cada lista se
  // filtra por texto y se suman los pedidos del RPC.
  const resultadosNav = useMemo(() => {
    if (!hayQuery) return seccionesVisibles
    const nq = norm(query.trim())
    return seccionesVisibles.filter(s => norm(s.label).includes(nq))
  }, [hayQuery, query, seccionesVisibles])

  const resultadosAcciones = useMemo(() => {
    if (!hayQuery) return acciones
    const nq = norm(query.trim())
    return acciones.filter(a => norm(a.label).includes(nq))
  }, [hayQuery, query, acciones])

  // Grupos en el orden en que se renderizan + lista plana combinada —
  // es sobre la lista plana que se mueve la selección con flechas.
  // Cada grupo lleva su offset (índice global de su primer item) para
  // que el render no tenga que hacer aritmética de índices a mano.
  const { grupos, itemsCombinados } = useMemo(() => {
    const g = []
    if (!hayQuery && recientes.length > 0) {
      g.push({ label: 'Recientes', items: recientes.map(r => ({ kind: 'reciente', reciente: r })) })
    }
    if (resultadosAcciones.length > 0) {
      g.push({ label: 'Acciones', items: resultadosAcciones.map(a => ({ kind: 'accion', accion: a })) })
    }
    if (resultadosNav.length > 0) {
      g.push({ label: 'Ir a', items: resultadosNav.map(s => ({ kind: 'nav', seccion: s })) })
    }
    if (pedidosVisibles.length > 0) {
      g.push({ label: 'Pedidos', items: pedidosVisibles.map(p => ({ kind: 'pedido', pedido: p })) })
    }
    let acc = 0
    for (const grupo of g) {
      grupo.offset = acc
      acc += grupo.items.length
    }
    return { grupos: g, itemsCombinados: g.flatMap(x => x.items) }
  }, [hayQuery, recientes, resultadosAcciones, resultadosNav, pedidosVisibles])

  // Índice activo DERIVADO con clamp en render (reemplaza al useEffect
  // que recortaba activeIndex cuando la lista se achicaba — otro
  // set-state-in-effect menos). Si la lista encoge, el índice efectivo
  // se recorta solo; el estado crudo se corrige recién en la próxima
  // interacción de teclado, que ya parte del valor efectivo.
  const indexActivo = Math.min(activeIndex, Math.max(0, itemsCombinados.length - 1))

  // Reusa exactamente el RPC listar_pedidos que ya usa toda la app
  // (usePedidos.js) — la búsqueda por asunto/tags/piezas/persona
  // asignada ya vive del lado de la base de datos.
  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q) return
    let cancelado = false
    supabase.rpc('listar_pedidos', {
      p_modo: 'normal', p_dias_normal: 30,
      p_vence_desde: null, p_vence_hasta: null,
      p_busqueda: q,
      p_prioridad: null, p_tipo: null, p_estado: null, p_tag: null, p_usuario_id: null,
      p_mostrar_finalizados: true,
      p_pagina: 0, p_pagina_size: 8,
      p_solo_id: null,
    }).then(({ data, error }) => {
      if (cancelado) return
      // Marcar la query respondida SIEMPRE (incluso con error, en cuyo
      // caso la lista queda vacía) — es lo que apaga el spinner derivado.
      setQueryRespondida(q)
      setResultadosPedidos(error ? [] : (data?.[0]?.pedidos ?? []))
      setActiveIndex(0)
    })
    return () => { cancelado = true }
  }, [debouncedQuery])

  const irAPedido = useCallback((pedido) => {
    guardarReciente({ id: pedido.id, asunto: pedido.asunto })
    navigate(`/pedidos/${pedido.id}`, { state: { from: location.pathname } })
    onClose()
  }, [navigate, onClose, location.pathname])

  const irASeccion = useCallback((seccion) => {
    navigate(seccion.to)
    onClose()
  }, [navigate, onClose])

  const ejecutarAccion = useCallback((accion) => {
    accion.run()
    onClose()
  }, [onClose])

  function abrirItem(item) {
    if (item.kind === 'nav') irASeccion(item.seccion)
    else if (item.kind === 'accion') ejecutarAccion(item.accion)
    else if (item.kind === 'reciente') irAPedido(item.reciente)
    else irAPedido(item.pedido)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(Math.min(indexActivo + 1, itemsCombinados.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(Math.max(indexActivo - 1, 0)); return }
    if (e.key === 'Enter' && itemsCombinados[indexActivo]) { e.preventDefault(); abrirItem(itemsCombinados[indexActivo]) }
  }

  if (!open) return null

  const hayResultados = itemsCombinados.length > 0
  const mostrandoSpinner = cargando && !hayResultados

  return (
    <div className="modal-overlay busqueda-global-overlay" onClick={onClose}>
      <div className="busqueda-global-panel" onClick={e => e.stopPropagation()}>

        <div className="busqueda-global-input-row">
          <Search size={18} className="busqueda-global-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar pedidos, acciones o secciones…"
            className="busqueda-global-input"
          />
          {query && (
            <button className="busqueda-global-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }} title="Limpiar búsqueda">
              <X size={15} />
            </button>
          )}
          <kbd className="busqueda-global-kbd">esc</kbd>
        </div>

        <div className="busqueda-global-results">
          {mostrandoSpinner && (
            <div className="busqueda-global-empty">
              <div className="busqueda-global-spinner" />
            </div>
          )}

          {hayQuery && !cargando && !hayResultados && (
            <div className="busqueda-global-empty">
              <p>Sin resultados para "{query.trim()}"</p>
              <span className="busqueda-global-empty-hint">Probá con otra palabra, una acción o el nombre de una sección</span>
            </div>
          )}

          {hayResultados && grupos.map(grupo => (
            <div key={grupo.label}>
              <div className="busqueda-global-group-label">{grupo.label}</div>
              {grupo.items.map((item, i) => {
                const idx = grupo.offset + i
                const activo = idx === indexActivo
                const onHover = () => setActiveIndex(idx)
                if (item.kind === 'nav') {
                  return (
                    <FilaSimple
                      key={item.seccion.to}
                      icon={item.seccion.icon}
                      label={`Ir a ${item.seccion.label}`}
                      tag="Sección"
                      activo={activo}
                      onClick={() => irASeccion(item.seccion)}
                      onHover={onHover}
                    />
                  )
                }
                if (item.kind === 'accion') {
                  return (
                    <FilaSimple
                      key={item.accion.id}
                      icon={item.accion.icon}
                      label={item.accion.label}
                      tag="Acción"
                      activo={activo}
                      onClick={() => ejecutarAccion(item.accion)}
                      onHover={onHover}
                    />
                  )
                }
                if (item.kind === 'reciente') {
                  return (
                    <FilaSimple
                      key={item.reciente.id}
                      icon={History}
                      label={item.reciente.asunto}
                      tag="Reciente"
                      activo={activo}
                      onClick={() => irAPedido(item.reciente)}
                      onHover={onHover}
                    />
                  )
                }
                return (
                  <FilaPedido
                    key={item.pedido.id}
                    pedido={item.pedido}
                    estados={estados}
                    tipos={tipos}
                    activo={activo}
                    orden={i + 1}
                    query={debouncedQuery}
                    onClick={() => irAPedido(item.pedido)}
                    onHover={onHover}
                  />
                )
              })}
            </div>
          ))}
        </div>

        <div className="busqueda-global-footer">
          {hayResultados && (
            <>
              <span><ArrowUp size={11} /><ArrowDown size={11} /> navegar</span>
              <span><CornerDownLeft size={11} /> abrir</span>
            </>
          )}
          <span>esc cerrar</span>
        </div>
      </div>
    </div>
  )
}
