import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { Badge } from '@/components/ui/Badge'
import { colorAvatar, iniciales } from '@/components/pedidos/PedidoCard'
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown, Tag, Link2, X,
  LayoutGrid, ListTodo, CalendarDays, Bell, Users, Settings, Trash2, FileSearch, Database, MailCheck,
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

// Mismas 9 secciones y rutas que el sidebar (AppLayout.jsx) — 'rol'
// es el mínimo necesario para verla, replicando exactamente isAdminOrAbove
// / isSuperAdmin de ahí, así el buscador nunca ofrece navegar a algo que
// el usuario no vería tampoco en su menú lateral.
const SECCIONES = [
  { label: 'Dashboard', to: '/app', icon: LayoutGrid },
  { label: 'Pedidos', to: '/app/pedidos', icon: ListTodo },
  { label: 'Calendario', to: '/app/calendario', icon: CalendarDays },
  { label: 'Notificaciones', to: '/app/notificaciones', icon: Bell },
  { label: 'Usuarios', to: '/app/usuarios', icon: Users, rol: 'admin' },
  { label: 'Configuración', to: '/app/configuracion', icon: Settings, rol: 'admin' },
  { label: 'Papelera', to: '/app/papelera', icon: Trash2, rol: 'super_admin' },
  // Viewer no tiene acceso a ninguna de las 3 herramientas (ver
  // ProtectedRoute en App.jsx para la protección real de las rutas) —
  // sinViewer oculta las tres del buscador para ese rol, sin afectar el
  // resto de los roles, que siguen viéndolas igual que antes.
  { label: 'Revisión de emails', to: '/app/revision', icon: FileSearch, sinViewer: true },
  { label: 'Revisión de BBDD', to: '/app/revision-bbdd', icon: Database, sinViewer: true },
  { label: 'Revisión de envíos', to: '/app/revision-envios', icon: MailCheck, sinViewer: true },
]

function puedeVerSeccion(seccion, role) {
  if (seccion.sinViewer && role === ROLES.VIEWER) return false
  if (!seccion.rol) return true
  if (seccion.rol === 'admin') return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  if (seccion.rol === 'super_admin') return role === ROLES.SUPER_ADMIN
  return true
}

function norm(s) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const ICONO_COINCIDENCIA = { tag: Tag, pieza: Link2 }

function FilaNavegacion({ seccion, activo, onClick, onHover }) {
  const Icon = seccion.icon
  return (
    <button className={`busqueda-global-fila-nav ${activo ? 'activo' : ''}`} onClick={onClick} onMouseEnter={onHover}>
      <span className="busqueda-global-tile-nav"><Icon size={16} /></span>
      <span className="busqueda-global-nav-label">Ir a {seccion.label}</span>
      <span className="busqueda-global-nav-tag">Sección</span>
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
  const [query, setQuery] = useState('')
  const [resultadosPedidos, setResultadosPedidos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const debouncedQuery = useDebounced(query, 300)

  const seccionesVisibles = useMemo(() => SECCIONES.filter(s => puedeVerSeccion(s, role)), [role])

  const resultadosNav = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    const nq = norm(q)
    return seccionesVisibles.filter(s => norm(s.label).includes(nq))
  }, [query, seccionesVisibles])

  // Lista combinada (navegación primero, después pedidos) — es sobre
  // esta lista plana que se mueve la selección con flechas, aunque
  // se rendericen agrupadas visualmente en dos secciones.
  const itemsCombinados = useMemo(() => [
    ...resultadosNav.map(s => ({ kind: 'nav', seccion: s })),
    ...resultadosPedidos.map(p => ({ kind: 'pedido', pedido: p })),
  ], [resultadosNav, resultadosPedidos])

  // Reusa exactamente el RPC listar_pedidos que ya usa toda la app
  // (usePedidos.js) — la búsqueda por asunto/tags/piezas/persona
  // asignada ya vive del lado de la base de datos.
  useEffect(() => {
    if (!debouncedQuery.trim()) { setResultadosPedidos([]); return }
    let cancelado = false
    setCargando(true)
    supabase.rpc('listar_pedidos', {
      p_modo: 'normal', p_dias_normal: 30,
      p_vence_desde: null, p_vence_hasta: null,
      p_busqueda: debouncedQuery.trim(),
      p_prioridad: null, p_tipo: null, p_estado: null, p_tag: null, p_usuario_id: null,
      p_mostrar_finalizados: true,
      p_pagina: 0, p_pagina_size: 8,
      p_solo_id: null,
    }).then(({ data, error }) => {
      if (cancelado) return
      setCargando(false)
      if (error) { setResultadosPedidos([]); return }
      setResultadosPedidos(data?.[0]?.pedidos ?? [])
      setActiveIndex(0)
    })
    return () => { cancelado = true }
  }, [debouncedQuery])

  useEffect(() => {
    if (open) {
      setQuery(''); setResultadosPedidos([]); setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Al cambiar la lista combinada (nav+pedidos), si el índice activo
  // quedó fuera de rango, lo recorta — evita seleccionar "nada" si la
  // navegación encuentra menos secciones que antes.
  useEffect(() => {
    setActiveIndex(i => Math.min(i, Math.max(0, itemsCombinados.length - 1)))
  }, [itemsCombinados.length])

  const irAPedido = useCallback((pedido) => {
    navigate(`/app/pedidos/${pedido.id}`, { state: { from: location.pathname } })
    onClose()
  }, [navigate, onClose, location.pathname])

  const irASeccion = useCallback((seccion) => {
    navigate(seccion.to)
    onClose()
  }, [navigate, onClose])

  function abrirItem(item) {
    if (item.kind === 'nav') irASeccion(item.seccion)
    else irAPedido(item.pedido)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, itemsCombinados.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && itemsCombinados[activeIndex]) { e.preventDefault(); abrirItem(itemsCombinados[activeIndex]) }
  }

  if (!open) return null

  const hayQuery = query.trim() !== ''
  const hayResultados = itemsCombinados.length > 0

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
            placeholder="Buscar pedidos, personas o secciones…"
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
          {!hayQuery && (
            <div className="busqueda-global-empty">
              <Search size={22} />
              <p>Buscá pedidos, personas, o saltá a una sección</p>
            </div>
          )}

          {hayQuery && cargando && (
            <div className="busqueda-global-empty">
              <div className="busqueda-global-spinner" />
            </div>
          )}

          {hayQuery && !cargando && !hayResultados && (
            <div className="busqueda-global-empty">
              <p>Sin resultados para "{query.trim()}"</p>
              <span className="busqueda-global-empty-hint">Probá con otra palabra o el nombre de una sección</span>
            </div>
          )}

          {hayQuery && !cargando && hayResultados && (
            <>
              {resultadosNav.length > 0 && (
                <>
                  <div className="busqueda-global-group-label">Ir a</div>
                  {resultadosNav.map((s, i) => (
                    <FilaNavegacion
                      key={s.to}
                      seccion={s}
                      activo={i === activeIndex}
                      onClick={() => irASeccion(s)}
                      onHover={() => setActiveIndex(i)}
                    />
                  ))}
                </>
              )}
              {resultadosPedidos.length > 0 && (
                <>
                  <div className="busqueda-global-group-label">Pedidos</div>
                  {resultadosPedidos.map((p, i) => {
                    const idx = resultadosNav.length + i
                    return (
                      <FilaPedido
                        key={p.id}
                        pedido={p}
                        estados={estados}
                        tipos={tipos}
                        activo={idx === activeIndex}
                        orden={i + 1}
                        query={debouncedQuery}
                        onClick={() => irAPedido(p)}
                        onHover={() => setActiveIndex(idx)}
                      />
                    )
                  })}
                </>
              )}
            </>
          )}
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
