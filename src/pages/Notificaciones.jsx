import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { agruparNotificaciones, rutaDeNotificacion } from '@/lib/notificaciones'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bell, BellRing, BellOff, CheckCheck, Trash2, MailOpen, Mail, ExternalLink,
  ChevronLeft, ChevronRight, ChevronDown, MoreHorizontal, X,
} from 'lucide-react'
import { usePush } from '@/hooks/usePush'
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

// Agrupa una lista de ENTRADAS ya paginada en los 4 baldes de arriba
// (por la fecha de su evento más reciente), preservando el orden
// relativo dentro de cada balde y devolviendo solo los baldes que
// tienen al menos un ítem.
function agruparPorFecha(entradas, ahora) {
  const mapa = {}
  entradas.forEach(e => {
    const b = bucketDe(e.principal.created_at, ahora)
    ;(mapa[b] = mapa[b] || []).push(e)
  })
  return ORDEN_GRUPOS.filter(b => mapa[b]).map(b => ({ label: b, items: mapa[b] }))
}

export default function Notificaciones() {
  useDocumentTitle('Notificaciones')

  const navigate = useNavigate()
  const {
    notificaciones, unreadCount,
    marcarLeida, marcarNoLeida,
    marcarVariasLeidas, marcarVariasNoLeidas,
    marcarTodasLeidas, marcarTodasNoLeidas,
    eliminar, eliminarVarias, eliminarTodas,
    showInfo, showError,
  } = useNotificaciones()

  // Web Push de este dispositivo (Fase 2) — el toggle vive en la
  // toolbar de esta página. En navegadores sin soporte (o Safari de
  // iOS sin instalar la PWA) el botón directamente no se muestra.
  const { estado: estadoPush, ocupado: pushOcupado, activar: activarPush, desactivar: desactivarPush } = usePush()

  async function handleTogglePush() {
    try {
      if (estadoPush === 'activo') {
        await desactivarPush()
        showInfo('Avisos desactivados en este dispositivo')
      } else {
        const resultado = await activarPush()
        if (resultado === 'activo') showInfo('Avisos activados en este dispositivo')
        if (resultado === 'denegado') showError('Las notificaciones están bloqueadas para este sitio — habilitalas desde la configuración del navegador')
      }
    } catch (err) {
      showError(err.message)
    }
  }

  const [filtro, setFiltro] = useLocalStorage('notif:filtro', 'todas')
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [pagina, setPagina] = useState(0)
  const [pageSize, setPageSize] = useLocalStorage('notif:pageSize', 10)
  const [confirmEliminarTodas, setConfirmEliminarTodas] = useState(false)
  // grupo_keys de las entradas agrupadas actualmente expandidas
  const [expandidos, setExpandidos] = useState(new Set())
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

  // unreadCount cuenta GRUPOS pendientes (misma semántica que el badge
  // de la campanita); haLeidas sigue siendo sobre filas reales.
  const noLeidas = unreadCount
  const haLeidas = notificaciones.some(n => n.leida)

  const filtradas = notificaciones.filter(n => {
    if (filtro === 'nuevas') return !n.leida
    if (filtro === 'leidas') return n.leida
    return true
  })

  // Colapso por grupo_key: las no leídas de un mismo pedido y tipo se
  // muestran como UNA entrada (con su ráfaga expandible); las leídas
  // quedan individuales como historial. Ver src/lib/notificaciones.js.
  const entradas = agruparNotificaciones(filtradas)

  const totalPaginas = Math.max(1, Math.ceil(entradas.length / pageSize))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const entradasVisibles = entradas.slice(paginaActual * pageSize, (paginaActual + 1) * pageSize)
  const haySeleccion = seleccionadas.size > 0

  const entradaSeleccionada = e => e.items.every(i => seleccionadas.has(i.id))
  const todasSeleccionadas = entradasVisibles.length > 0 && entradasVisibles.every(entradaSeleccionada)

  // Agrupación por fecha — sobre la página actual, mismo criterio que
  // el rediseño original (no sobre el total filtrado).
  const gruposFecha = agruparPorFecha(entradasVisibles, new Date())

  const selItems = notificaciones.filter(n => seleccionadas.has(n.id))
  const selTodasLeidas = selItems.length > 0 && selItems.every(n => n.leida)
  const selTodasNoLeidas = selItems.length > 0 && selItems.every(n => !n.leida)

  function toggleSeleccion(entrada) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (entradaSeleccionada(entrada)) {
        entrada.items.forEach(i => next.delete(i.id))
      } else {
        entrada.items.forEach(i => next.add(i.id))
      }
      return next
    })
  }

  function toggleTodas() {
    if (todasSeleccionadas) {
      setSeleccionadas(new Set())
    } else {
      setSeleccionadas(new Set(entradasVisibles.flatMap(e => e.items.map(i => i.id))))
    }
  }

  function toggleExpandido(grupoKey) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(grupoKey) ? next.delete(grupoKey) : next.add(grupoKey)
      return next
    })
  }

  async function handleEliminarSeleccionadas() {
    await eliminarVarias([...seleccionadas])
    setSeleccionadas(new Set())
  }

  async function handleMarcarSeleccionadasLeidas() {
    await marcarVariasLeidas(selItems.filter(n => !n.leida).map(n => n.id))
    setSeleccionadas(new Set())
  }

  async function handleMarcarSeleccionadasNoLeidas() {
    await marcarVariasNoLeidas(selItems.filter(n => n.leida).map(n => n.id))
    setSeleccionadas(new Set())
  }

  function handleFiltro(f) {
    setFiltro(f); setPagina(0); setSeleccionadas(new Set())
  }

  function handlePageSize(n) {
    setPageSize(n); setPagina(0); setSeleccionadas(new Set())
  }

  function handleClick(entrada) {
    const sinLeer = entrada.items.filter(i => !i.leida).map(i => i.id)
    if (sinLeer.length) marcarVariasLeidas(sinLeer)
    // Deep-link: para mención/comentario la ruta lleva ?comentario=<id>
    // y PedidoDetalle scrollea y resalta el comentario destino.
    if (entrada.pedido_id) navigate(rutaDeNotificacion(entrada.principal), { state: { from: '/notificaciones' } })
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

      {/* Tabs + acciones — los 3 filtros como pestañas siempre visibles,
          acciones masivas en un acceso directo ("Marcar todas como
          leídas") + menú "⋮" para las menos frecuentes. */}
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
          {estadoPush !== 'no-soportado' && estadoPush !== 'cargando' && (
            <button
              onClick={handleTogglePush}
              className="notif-btn-outline"
              disabled={pushOcupado || estadoPush === 'denegado'}
              title={estadoPush === 'denegado'
                ? 'Las notificaciones están bloqueadas en el navegador'
                : estadoPush === 'activo'
                  ? 'Dejar de recibir avisos del sistema en este dispositivo'
                  : 'Recibir avisos del sistema en este dispositivo'}
            >
              {estadoPush === 'activo' ? <BellOff size={15} /> : <BellRing size={15} />}
              {estadoPush === 'activo' ? 'Silenciar dispositivo' : 'Avisos en este dispositivo'}
            </button>
          )}
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
      {entradas.length === 0 && (
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
      {entradas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Toolbar */}
          <div className="notif-meta-row">
            <span className="text-muted-sm">
              Mostrando {paginaActual * pageSize + 1}–{Math.min((paginaActual + 1) * pageSize, entradas.length)} de {entradas.length}
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
                <span className="text-muted-sm">
                  {filtradas.length} notificacion{filtradas.length !== 1 ? 'es' : ''}
                  {entradas.length !== filtradas.length ? ` en ${entradas.length} grupos` : ''}
                </span>
              </div>
            )}

            {/* Items — agrupados por antigüedad (Hoy/Ayer/Esta semana/
                Anteriores). Cada ítem es una ENTRADA: una notificación
                individual, o una ráfaga colapsada del mismo grupo_key
                (chip ×N + expandible). */}
            {gruposFecha.map(grupo => (
              <div key={grupo.label}>
                <div className="notif-group-label">{grupo.label}</div>
                {grupo.items.map(entrada => {
                  const n = entrada.principal
                  const agrupada = entrada.count > 1
                  const expandida = expandidos.has(entrada.grupoKey)
                  const sel = entradaSeleccionada(entrada)
                  return (
                    <div key={entrada.id} className="notif-item-v2" style={{ background: sel ? 'rgba(208,17,27,0.04)' : undefined }}>

                      <input type="checkbox"
                        className={`notif-checkbox ${sel ? 'notif-checkbox-visible' : ''}`}
                        checked={sel}
                        onChange={e => { e.stopPropagation(); toggleSeleccion(entrada) }}
                        onClick={e => e.stopPropagation()} />

                      <span className={`notif-item-dot ${entrada.leida ? 'notif-item-dot-leida' : ''}`} />

                      <div className="notif-item-content" onClick={() => handleClick(entrada)}>
                        <p className={`notif-item-msg ${entrada.leida ? 'notif-item-msg-leida' : 'notif-item-msg-nueva'}`}>
                          {n.mensaje}
                          {agrupada && <span className="notif-chip-count">×{entrada.count}</span>}
                        </p>
                        <span className="notif-item-time">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                        </span>

                        {agrupada && (
                          <button
                            className="notif-expand-btn"
                            onClick={e => { e.stopPropagation(); toggleExpandido(entrada.grupoKey) }}
                          >
                            <ChevronDown size={13} style={{ transform: expandida ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
                            {expandida ? 'Ocultar' : `Ver los ${entrada.count} avisos`}
                          </button>
                        )}

                        {agrupada && expandida && (
                          <div className="notif-subitems" onClick={e => e.stopPropagation()}>
                            {/* Cada aviso interno navega POR SU CUENTA: en una
                                ráfaga de comentarios, cada item lleva SU
                                comentario_id en data, así que el deep-link de
                                rutaDeNotificacion apunta a ESE comentario — no
                                al más reciente del grupo como el click de la
                                entrada. Solo se marca leído el item tocado: el
                                resto de la ráfaga sigue pendiente (modelo de
                                eventos individuales). El stopPropagation del
                                contenedor ya evita que el click burbujee al
                                handleClick de la entrada. */}
                            {entrada.items.map(item => (
                              <button
                                key={item.id}
                                type="button"
                                className="notif-subitem"
                                onClick={() => {
                                  if (!item.leida) marcarLeida(item.id)
                                  if (item.pedido_id) navigate(rutaDeNotificacion(item), { state: { from: '/notificaciones' } })
                                }}
                              >
                                <span className="notif-subitem-msg">{item.mensaje}</span>
                                <span className="notif-subitem-time">
                                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Un solo botón "⋮" — mismo patrón de ref
                          compartido que el menú del header. */}
                      <div
                        className="notif-item-actions"
                        ref={menuItemAbierto === entrada.id ? menuRef : null}
                        style={menuItemAbierto === entrada.id ? { opacity: 1 } : undefined}
                      >
                        <button
                          onClick={e => { e.stopPropagation(); setMenuItemAbierto(v => v === entrada.id ? null : entrada.id); setMenuHeaderOpen(false) }}
                          className="notif-btn-icon"
                          title="Más acciones"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {menuItemAbierto === entrada.id && (
                          <div className="notif-dropdown" onClick={e => e.stopPropagation()}>
                            {entrada.pedido_id && (
                              <button onClick={() => { navigate(rutaDeNotificacion(entrada.principal), { state: { from: '/notificaciones' } }); setMenuItemAbierto(null) }}>
                                <ExternalLink size={15} />Ir al pedido
                              </button>
                            )}
                            {agrupada ? (
                              <button onClick={() => { marcarVariasLeidas(entrada.items.map(i => i.id)); setMenuItemAbierto(null) }}>
                                <MailOpen size={15} />Marcar {entrada.count} como leídas
                              </button>
                            ) : (
                              <button onClick={() => { entrada.leida ? marcarNoLeida(entrada.id) : marcarLeida(entrada.id); setMenuItemAbierto(null) }}>
                                {entrada.leida ? <Mail size={15} /> : <MailOpen size={15} />}
                                {entrada.leida ? 'Marcar como no leída' : 'Marcar como leída'}
                              </button>
                            )}
                            <div className="notif-dropdown-sep" />
                            <button
                              onClick={() => { agrupada ? eliminarVarias(entrada.items.map(i => i.id)) : eliminar(entrada.id); setMenuItemAbierto(null) }}
                              className="notif-dropdown-danger"
                            >
                              <Trash2 size={15} />{agrupada ? `Eliminar las ${entrada.count}` : 'Eliminar'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
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
