import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, CheckCheck, Trash2, MailOpen, Mail, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

const PAGE_OPTIONS = [10, 20, 50]
const FILTROS = [
  { value: 'todas',  label: 'Todas' },
  { value: 'nuevas', label: 'No leídas' },
  { value: 'leidas', label: 'Leídas' },
]

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
  const [panelOpen, setPanelOpen] = useLocalStorage('notif:panelOpen', true)
  const [pageSize, setPageSize] = useLocalStorage('notif:pageSize', 10)
  const [confirmEliminarTodas, setConfirmEliminarTodas] = useState(false)

  const noLeidas = notificaciones.filter(n => !n.leida).length

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
    if (n.pedido_id) navigate(`/app/pedidos/${n.pedido_id}`, { state: { from: '/app/notificaciones' } })
  }

  return (
    <div className="page-root" style={{ maxWidth: '680px' }}>

      <div className="page-header">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="page-subtitle">
            {notificaciones.length} en total{noLeidas > 0 ? ` · ${noLeidas} sin leer` : ''}
          </p>
        </div>
      </div>

      {/* Panel filtros y acciones */}
      <div className="panel">
        <div className="panel-header" onClick={() => setPanelOpen(v => !v)}>
          <div className="panel-header-left">
            <Filter size={15} color="var(--text-muted)" />
            <span className="panel-label">Filtros y acciones</span>
            {filtro !== 'todas' && <span className="badge-active-pill">activos</span>}
          </div>
          <div className="panel-header-right">
            {panelOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </div>
        </div>

        {panelOpen && (
          <div className="panel-body">
            <span className="filter-date-label">Filtrar por</span>
            <div className="filters-row">
              {FILTROS.map(f => (
                <button key={f.value} onClick={() => handleFiltro(f.value)}
                  className={`notif-filter-btn ${filtro === f.value ? 'notif-filter-btn-active' : ''}`}>
                  {f.label}
                  {f.value === 'nuevas' && noLeidas > 0 && (
                    <span style={{ marginLeft: '0.375rem', fontWeight: 700 }}>({noLeidas})</span>
                  )}
                </button>
              ))}
            </div>

            <div className="form-divider" />
            <span className="filter-date-label">Acciones</span>
            <div className="filters-row">
              {noLeidas > 0 && (
                <button onClick={marcarTodasLeidas} className="btn-edit"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <CheckCheck size={14} />Marcar todas como leídas
                </button>
              )}
              {notificaciones.some(n => n.leida) && (
                <button onClick={marcarTodasNoLeidas} className="btn-edit"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Mail size={14} />Marcar todas como no leídas
                </button>
              )}
              {notificaciones.length > 0 && (
                <button onClick={() => setConfirmEliminarTodas(true)}
                  className="btn-delete"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Trash2 size={14} />Eliminar todas
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Empty */}
      {lista.length === 0 && (
        <div className="empty-state notif-container" style={{ padding: '3rem' }}>
          <Bell size={36} style={{ opacity: 0.4 }} />
          <p style={{ fontWeight: 500 }}>
            {filtro === 'todas' ? 'No tenés notificaciones'
              : filtro === 'nuevas' ? 'No tenés notificaciones sin leer'
              : 'No tenés notificaciones leídas'}
          </p>
        </div>
      )}

      {/* Toolbar + Lista */}
      {lista.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.75rem' }}>
            <span className="text-muted-sm">
              Mostrando {paginaActual * pageSize + 1}–{Math.min((paginaActual + 1) * pageSize, lista.length)} de {lista.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="filter-date-label">Por página</span>
              <select value={pageSize} onChange={e => handlePageSize(Number(e.target.value))}
                style={{ width: 'auto', fontSize: '0.8125rem', padding: '0.25rem 1.5rem 0.25rem 0.5rem' }}>
                {PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Lista */}
          <div className="notif-container">

            {/* Header / Bulk bar */}
            {haySeleccion ? (
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                {/* Línea 1: checkbox + contador */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas}
                    style={{ width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                  <span style={{ width: '8px', flexShrink: 0 }} />
                  <span className="text-muted-sm">
                    <span className="notif-bulk-count">{seleccionadas.size}</span>{' '}
                    seleccionada{seleccionadas.size !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Línea 2: botones de acción */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  {!selTodasLeidas && (
                    <button onClick={handleMarcarSeleccionadasLeidas} className="btn-edit"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem' }}>
                      <MailOpen size={13} />Marcar leídas
                    </button>
                  )}
                  {!selTodasNoLeidas && (
                    <button onClick={handleMarcarSeleccionadasNoLeidas} className="btn-edit"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem' }}>
                      <Mail size={13} />Marcar como no leídas
                    </button>
                  )}
                  <button onClick={handleEliminarSeleccionadas} className="btn-delete"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem' }}>
                    <Trash2 size={13} />Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '1.125rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="checkbox" checked={false} onChange={toggleTodas}
                  style={{ width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--accent-primary)', cursor: 'pointer' }} />
                <span style={{ width: '8px', flexShrink: 0 }} />
                <span className="text-muted-sm" style={{ flex: 1 }}>Seleccionar todo</span>
                <span className="text-muted-sm">
                  {lista.length} notificacion{lista.length !== 1 ? 'es' : ''}
                </span>
              </div>
            )}

            {/* Items */}
            {listaVisible.map(n => (
              <div key={n.id} className="notif-item-v2"
                style={{ background: seleccionadas.has(n.id) ? 'rgba(208,17,27,0.03)' : undefined }}>

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

                <div className="notif-item-actions">
                  {n.pedido_id && (
                    <button onClick={e => { e.stopPropagation(); navigate(`/app/pedidos/${n.pedido_id}`, { state: { from: '/app/notificaciones' } }) }}
                      className="notif-action-btn" title="Ver pedido">
                      <ExternalLink size={13} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); n.leida ? marcarNoLeida(n.id) : marcarLeida(n.id) }}
                    className="notif-action-btn"
                    title={n.leida ? 'Marcar como no leída' : 'Marcar como leída'}>
                    {n.leida ? <Mail size={13} /> : <MailOpen size={13} />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); eliminar(n.id) }}
                    className="notif-action-btn notif-action-btn-danger" title="Eliminar">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {/* Paginador */}
            {totalPaginas > 1 && (
              <div className="pagination" style={{ padding: '0.75rem' }}>
                <button disabled={paginaActual === 0} onClick={() => setPagina(p => p - 1)}
                  className="btn-page btn-page-nav" style={{ opacity: paginaActual === 0 ? 0.4 : 1 }}>
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPaginas }, (_, i) => (
                  <button key={i} onClick={() => setPagina(i)}
                    className={`btn-page ${paginaActual === i ? 'btn-page-active' : ''}`}>
                    {i + 1}
                  </button>
                ))}
                <button disabled={paginaActual >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}
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