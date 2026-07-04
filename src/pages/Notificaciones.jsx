import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bell, CheckCheck, Trash2, MailOpen, Mail, ExternalLink,
  ChevronLeft, ChevronRight, MoreHorizontal, X,
} from 'lucide-react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

const PAGE_OPTIONS = [10, 20, 50]
const TABS = [
  { value: 'todas',  label: 'Todas' },
  { value: 'nuevas', label: 'No leídas' },
  { value: 'leidas', label: 'Leídas' },
]

// Agrupa por antigüedad relativa al momento actual — mismas 4 cubetas
// y mismos límites en horas que definió el rediseño (bucketOf): Hoy
// (<24h), Ayer (<48h), Esta semana (<168h = 7 días), Anteriores (el
// resto). Se calcula sobre timestamps reales (created_at), no sobre
// una cifra de horas ya calculada de antemano como en el mock de la
// IA de diseño.
function bucketDe(createdAt, ahora) {
  const horas = (ahora.getTime() - new Date(createdAt).getTime()) / 36e5
  if (horas < 24) return 'Hoy'
  if (horas < 48) return 'Ayer'
  if (horas < 168) return 'Esta semana'
  return 'Anteriores'
}
const ORDEN_GRUPOS = ['Hoy', 'Ayer', 'Esta semana', 'Anteriores']

// Agrupa una lista ya paginada en los 4 baldes de arriba, preservando
// el orden relativo dentro de cada balde y devolviendo solo los baldes
// que tienen al menos un ítem (mismo criterio que el rediseño: si no
// hay nada "Hoy", ese header de grupo no se muestra).
function agruparPorFecha(items, ahora) {
  const mapa = {}
  items.forEach(n => {
    const b = bucketDe(n.created_at, ahora)
    ;(mapa[b] = mapa[b] || []).push(n)
  })
  return ORDEN_GRUPOS.filter(b => mapa[b]).map(b => ({ label: b, items: mapa[b] }))
}

export default function Notificaciones() {
  const navigate = useNavigate()
  const {
    notificaciones,
    marcarLeida, marcarNoLeida,
    marcarTodasLeidas, marcarTodasNoLeidas,
    eliminar, eliminarVarias, eliminarTodas,
  } = useNotificaciones()

  const [filtro, setFiltro] = useLocalStorage('notif:filtro', 'todas')
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [pagina, setPagina] = useState(0)
  const [pageSize, setPageSize] = useLocalStorage('notif:pageSize', 10)
  const [confirmEliminarTodas, setConfirmEliminarTodas] = useState(false)
  // Menú "⋮" del header (marcar todas no leídas / eliminar todas) y el
  // de cada ítem individual — uno solo abierto a la vez, igual patrón
  // que ya usa EstadoPopover.jsx: un ref que apunta al menú actualmente
  // abierto, mousedown global lo cierra si el click fue afuera.
  const [menuHeaderOpen, setMenuHeaderOpen] = useState(false)
  const [menuItemAbierto, setMenuItemAbierto] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuHeaderOpen(false)
        setMenuItemAbierto(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const noLeidas = notificaciones.filter(n => !n.leida).length
  const haLeidas = notificaciones.some(n => n.leida)

  const lista = notificaciones.filter(n => {
    if (filtro === 'nuevas') return !n.leida
    if (filtro === 'leidas') return n.leida
    return true
  })

  const totalPaginas = Math.max(1, Math.ceil(lista.length / pageSize))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const listaVisible = lista.slice(paginaActual * pageSize, (paginaActual + 1) * pageSize)
  const haySeleccion = seleccionadas.size > 0
  const todasSeleccionadas = seleccionadas.size === listaVisible.length && listaVisible.length > 0

  // Agrupación por fecha — sobre la página actual, mismo criterio que
  // el rediseño original (no sobre el total filtrado): es más barato y
  // en la práctica, al estar ordenado por fecha descendente, un mismo
  // grupo no debería partirse entre dos páginas salvo casos de borde
  // con pocos ítems por página.
  const grupos = agruparPorFecha(listaVisible, new Date())

  const selItems = notificaciones.filter(n => seleccionadas.has(n.id))
  const selTodasLeidas = selItems.length > 0 && selItems.every(n => n.leida)
  const selTodasNoLeidas = selItems.length > 0 && selItems.every(n => !n.leida)

  function toggleSeleccion(id) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodas() {
    setSeleccionadas(todasSeleccionadas ? new Set() : new Set(listaVisible.map(n => n.id)))
  }

  async function handleEliminarSeleccionadas() {
    await eliminarVarias([...seleccionadas])
    setSeleccionadas(new Set())
  }

  async function handleMarcarSeleccionadasLeidas() {
    for (const id of seleccionadas) {
      const n = notificaciones.find(x => x.id === id)
      if (n && !n.leida) await marcarLeida(id)
    }
    setSeleccionadas(new Set())
  }

  async function handleMarcarSeleccionadasNoLeidas() {
    for (const id of seleccionadas) {
      const n = notificaciones.find(x => x.id === id)
      if (n && n.leida) await marcarNoLeida(id)
    }
    setSeleccionadas(new Set())
  }

  function handleFiltro(f) {
    setFiltro(f); setPagina(0); setSeleccionadas(new Set())
  }

  function handlePageSize(n) {
    setPageSize(n); setPagina(0); setSeleccionadas(new Set())
  }

  function handleClick(n) {
    if (!n.leida) marcarLeida(n.id)
    if (n.pedido_id) navigate(`/pedidos/${n.pedido_id}`, { state: { from: '/notificaciones' } })
  }

  return (
    <div className="page-root">

      <div className="page-header">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="page-subtitle">
            {notificaciones.length} en total{noLeidas > 0 ? ` · ${noLeidas} sin leer` : ''}
          </p>
        </div>
      </div>

      {/* Tabs + acciones — reemplaza al panel "Filtros y acciones"
          colapsable: los 3 filtros ahora son pestañas siempre visibles
          (no hay nada que esconder ahí), y las acciones masivas viven
          en un botón de acceso directo ("Marcar todas como leídas",
          solo si hay alguna sin leer) + un menú "⋮" para las acciones
          menos frecuentes (marcar todas no leídas, eliminar todas). */}
      <div className="notif-toolbar">
        <div className="notif-tabs">
          {TABS.map(t => (
            <button key={t.value} onClick={() => handleFiltro(t.value)}
              className={filtro === t.value ? 'active' : ''}>
              {t.label}
              {t.value === 'nuevas' && noLeidas > 0 && (
                <span style={{ marginLeft: '0.3rem', fontWeight: 700 }}>({noLeidas})</span>
              )}
            </button>
          ))}
        </div>

        <div className="notif-toolbar-actions" ref={menuHeaderOpen ? menuRef : null}>
          {noLeidas > 0 && (
            <button onClick={marcarTodasLeidas} className="notif-btn-outline">
              <CheckCheck size={15} />Marcar todas como leídas
            </button>
          )}
          {notificaciones.length > 0 && (
            <button onClick={() => setMenuHeaderOpen(v => !v)} className="notif-btn-icon" title="Más acciones">
              <MoreHorizontal size={16} />
            </button>
          )}
          {menuHeaderOpen && (
            <div className="notif-dropdown">
              {haLeidas && (
                <button onClick={() => { marcarTodasNoLeidas(); setMenuHeaderOpen(false) }}>
                  <Mail size={15} />Marcar todas como no leídas
                </button>
              )}
              <button
                onClick={() => { setConfirmEliminarTodas(true); setMenuHeaderOpen(false) }}
                className="notif-dropdown-danger"
              >
                <Trash2 size={15} />Eliminar todas
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty */}
      {lista.length === 0 && (
        <div className="notif-empty">
          <Bell size={40} />
          <p className="notif-empty-title">
            {filtro === 'todas' ? 'No tenés notificaciones'
              : filtro === 'nuevas' ? 'No tenés notificaciones sin leer'
              : 'No tenés notificaciones leídas'}
          </p>
          <p className="notif-empty-sub">
            {filtro === 'todas' ? 'Te vamos a avisar acá cuando tengas algo nuevo.' : 'Cambiá el filtro para ver el resto.'}
          </p>
        </div>
      )}

      {/* Toolbar + Lista */}
      {lista.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Toolbar */}
          <div className="notif-meta-row">
            <span className="text-muted-sm">
              Mostrando {paginaActual * pageSize + 1}–{Math.min((paginaActual + 1) * pageSize, lista.length)} de {lista.length}
            </span>
            <label className="notif-pagesize-label">
              Por página
              <select value={pageSize} onChange={e => handlePageSize(Number(e.target.value))}>
                {PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          {/* Lista */}
          <div className="notif-container">

            {/* Header / Bulk bar */}
            {haySeleccion ? (
              <div className="notif-bulkbar notif-bulkbar-active">
                <div className="notif-bulkbar-row">
                  <input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas} />
                  <span className="notif-bulkbar-count">{seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? 's' : ''}</span>
                </div>
                <div className="notif-bulkbar-actions">
                  {!selTodasLeidas && (
                    <button onClick={handleMarcarSeleccionadasLeidas} className="notif-btn-outline notif-btn-sm">
                      <MailOpen size={13} />Marcar como leídas
                    </button>
                  )}
                  {!selTodasNoLeidas && (
                    <button onClick={handleMarcarSeleccionadasNoLeidas} className="notif-btn-outline notif-btn-sm">
                      <Mail size={13} />Marcar como no leídas
                    </button>
                  )}
                  <button onClick={handleEliminarSeleccionadas} className="notif-btn-outline notif-btn-sm notif-btn-danger">
                    <Trash2 size={13} />Eliminar
                  </button>
                  <button onClick={() => setSeleccionadas(new Set())} className="notif-btn-clear">
                    <X size={13} />Deseleccionar
                  </button>
                </div>
              </div>
            ) : (
              <div className="notif-bulkbar">
                <label className="notif-bulkbar-row" style={{ cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={false} onChange={toggleTodas} />
                  <span className="text-muted-sm">Seleccionar todo</span>
                </label>
                <span className="text-muted-sm">{lista.length} notificacion{lista.length !== 1 ? 'es' : ''}</span>
              </div>
            )}

            {/* Items — agrupados por antigüedad (Hoy/Ayer/Esta semana/
                Anteriores), un header de sección antes de cada grupo
                que tenga al menos un ítem. */}
            {grupos.map(grupo => (
              <div key={grupo.label}>
                <div className="notif-group-label">{grupo.label}</div>
                {grupo.items.map(n => (
                  <div key={n.id} className="notif-item-v2" style={{ background: seleccionadas.has(n.id) ? 'rgba(208,17,27,0.04)' : undefined }}>

                    <input type="checkbox"
                      className={`notif-checkbox ${seleccionadas.has(n.id) ? 'notif-checkbox-visible' : ''}`}
                      checked={seleccionadas.has(n.id)}
                      onChange={e => { e.stopPropagation(); toggleSeleccion(n.id) }}
                      onClick={e => e.stopPropagation()} />

                    <span className={`notif-item-dot ${n.leida ? 'notif-item-dot-leida' : ''}`} />

                    <div className="notif-item-content" onClick={() => handleClick(n)}>
                      <p className={`notif-item-msg ${n.leida ? 'notif-item-msg-leida' : 'notif-item-msg-nueva'}`}>
                        {n.mensaje}
                      </p>
                      <span className="notif-item-time">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                      </span>
                    </div>

                    {/* Un solo botón "⋮" en vez de 3 acciones siempre
                        visibles — el menú se abre/cierra con el mismo
                        ref callback en los N ítems + el del header: el
                        ref solo se "enchufa" al nodo del menú que está
                        realmente abierto en cada momento (a lo sumo
                        uno), así un solo mousedown listener alcanza
                        para cerrar cualquiera de todos ellos. */}
                    <div
                      className="notif-item-actions"
                      ref={menuItemAbierto === n.id ? menuRef : null}
                      style={menuItemAbierto === n.id ? { opacity: 1 } : undefined}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); setMenuItemAbierto(v => v === n.id ? null : n.id); setMenuHeaderOpen(false) }}
                        className="notif-btn-icon"
                        title="Más acciones"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      {menuItemAbierto === n.id && (
                        <div className="notif-dropdown" onClick={e => e.stopPropagation()}>
                          {n.pedido_id && (
                            <button onClick={() => { navigate(`/pedidos/${n.pedido_id}`, { state: { from: '/notificaciones' } }); setMenuItemAbierto(null) }}>
                              <ExternalLink size={15} />Ir al pedido
                            </button>
                          )}
                          <button onClick={() => { n.leida ? marcarNoLeida(n.id) : marcarLeida(n.id); setMenuItemAbierto(null) }}>
                            {n.leida ? <Mail size={15} /> : <MailOpen size={15} />}
                            {n.leida ? 'Marcar como no leída' : 'Marcar como leída'}
                          </button>
                          <div className="notif-dropdown-sep" />
                          <button onClick={() => { eliminar(n.id); setMenuItemAbierto(null) }} className="notif-dropdown-danger">
                            <Trash2 size={15} />Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Paginador */}
            {totalPaginas > 1 && (
              <div className="pagination" style={{ padding: '0.75rem' }}>
                <button disabled={paginaActual === 0} onClick={() => { setPagina(p => p - 1); setMenuItemAbierto(null) }}
                  className="btn-page btn-page-nav" style={{ opacity: paginaActual === 0 ? 0.4 : 1 }}>
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPaginas }, (_, i) => (
                  <button key={i} onClick={() => { setPagina(i); setMenuItemAbierto(null) }}
                    className={`btn-page ${paginaActual === i ? 'btn-page-active' : ''}`}>
                    {i + 1}
                  </button>
                ))}
                <button disabled={paginaActual >= totalPaginas - 1} onClick={() => { setPagina(p => p + 1); setMenuItemAbierto(null) }}
                  className="btn-page btn-page-nav" style={{ opacity: paginaActual >= totalPaginas - 1 ? 0.4 : 1 }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

          </div>
        </div>
      )}


      <ConfirmModal
        open={confirmEliminarTodas}
        title="Eliminar todas las notificaciones"
        message="Se eliminarán todas las notificaciones permanentemente. Esta acción no se puede deshacer."
        confirmLabel="Eliminar todas"
        variant="danger"
        onConfirm={() => { setConfirmEliminarTodas(false); eliminarTodas() }}
        onCancel={() => setConfirmEliminarTodas(false)}
      />
    </div>
  )
}