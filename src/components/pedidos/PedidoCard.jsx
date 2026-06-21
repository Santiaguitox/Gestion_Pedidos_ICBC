import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { PRIORIDADES } from '@/lib/constants'
import { Calendar, ExternalLink, Copy, Check, ChevronDown, ChevronUp, Tag } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Paleta fija de colores para avatares — cada persona obtiene siempre el
// mismo color en toda la app, derivado de su user_id (estable aunque el
// nombre cambie), sin necesitar guardar nada nuevo en la base.
const PALETA_AVATARES = [
  '#5B4EE8', '#D0111B', '#10B981', '#F59E0B',
  '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6',
]

export function colorAvatar(userId) {
  if (!userId) return PALETA_AVATARES[0]
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash + userId.charCodeAt(i)) % PALETA_AVATARES.length
  return PALETA_AVATARES[hash]
}

// Iniciales de nombre + apellido (primera y última palabra del nombre
// completo) — si solo hay una palabra, usa esa única inicial.
export function iniciales(nombreCompleto) {
  const partes = (nombreCompleto ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function AvatarAsignado({ asignado }) {
  const nombre = asignado.profiles?.full_name ?? ''
  const color = asignado.profiles?.avatar_color || colorAvatar(asignado.user_id)
  return (
    <span className="avatar-asignado" style={{ background: color }} title={nombre}>
      {iniciales(nombre)}
    </span>
  )
}

// El peor resultado de revisión entre todas las piezas de un pedido —
// usado en la vista COMPACTA, que no tiene espacio para mostrar cada
// pieza por separado (eso sí pasa en EntregablesCard, usado en la
// vista FULL). Prioridad: error > advertencia > ok — si CUALQUIER
// pieza tiene un error, el badge consolidado lo muestra, aunque el
// resto esté perfecto, para no esconder un problema real detrás de
// piezas que sí pasaron bien.
const ORDEN_SEVERIDAD = { error: 0, advertencia: 1, ok: 2 }

export function peorRevisionDePedido(entregables) {
  const conRevision = (entregables ?? []).filter(e => e.revision_pruebas_total != null)
  if (conRevision.length === 0) return null
  return conRevision.reduce((peor, e) =>
    ORDEN_SEVERIDAD[e.revision_severidad] < ORDEN_SEVERIDAD[peor.revision_severidad] ? e : peor
  )
}

export function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      title="Copiar"
      className={`copy-btn ${copied ? 'copy-btn-copied' : ''}`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

function CopyAllBtnInline({ entregables }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e) {
    e.stopPropagation()
    const texto = entregables
      .filter(e => e.nombre_pieza)
      .map(e => e.link_online ? `${e.nombre_pieza} || ${e.link_online}` : e.nombre_pieza)
      .join('\n')
    navigator.clipboard.writeText(texto)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className={`copy-all-btn ${copied ? 'copy-all-btn-copied' : ''}`}>
      {copied ? <><Check size={11} />¡Copiado!</> : <><Copy size={11} />Copiar todo</>}
    </button>
  )
}

export function EntregablesCard({ entregables }) {
  const navigate = useNavigate()
  const [expandido, setExpandido] = useState(false)
  if (!entregables?.length) return null
  const conNombre = entregables.filter(e => e.nombre_pieza)
  if (!conNombre.length) return null
  const visibles = expandido ? conNombre : conNombre.slice(0, 2)
  const hayMas = conNombre.length > 2

  return (
    <div onClick={e => e.stopPropagation()} className="entregables-card">
      <div
        className="entregables-header"
        onClick={hayMas ? () => setExpandido(v => !v) : undefined}
        style={{ cursor: hayMas ? 'pointer' : 'default' }}
      >
        <span className="entregables-header-left">
          Piezas <span className="badge-count">{conNombre.length}</span>
        </span>
        <div className="entregables-header-right">
          {conNombre.length > 1 && <CopyAllBtnInline entregables={conNombre} />}
          {hayMas && (
            <span className="entregables-expand-hint">
              {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expandido ? 'Ver menos' : `Ver ${conNombre.length - 2} más`}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col">
        {visibles.map((ent, i) => (
          <div key={ent.id} className="entregable-row"
            style={{ borderBottom: i < visibles.length - 1 ? '1px solid var(--badge-border)' : 'none' }}>
            <div className="entregable-nombre">
              {ent.aprobado && <span className="aprobado-badge">✓</span>}
              <span className="entregable-nombre-text">{ent.nombre_pieza}</span>
              <CopyBtn text={ent.nombre_pieza} />
            </div>
            {ent.link_online && (
              <div className="entregable-link-row">
                <span className="entregable-link-text">{ent.link_online}</span>
                <CopyBtn text={ent.link_online} />
                <a href={ent.link_online} target="_blank" rel="noopener"
                  onClick={e => e.stopPropagation()} className="entregable-link-btn">
                  <ExternalLink size={11} />
                </a>
              </div>
            )}
            {ent.revision_pruebas_total != null && (
              ent.revision_pruebas_ok === ent.revision_pruebas_total ? (
                <span className={`entregable-revision-resumen entregable-revision-${ent.revision_severidad}`}>
                  {ent.revision_pruebas_ok}/{ent.revision_pruebas_total} pruebas superadas
                </span>
              ) : (
                <button
                  onClick={() => navigate('/app/revision', { state: { url: ent.link_online, entregableId: ent.id } })}
                  className={`entregable-revision-resumen entregable-revision-${ent.revision_severidad}`}
                >
                  {ent.revision_pruebas_ok}/{ent.revision_pruebas_total} pruebas superadas
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Tarjeta compacta: en pantallas angostas (mobile) se reorganiza en filas
// con etiqueta — Asunto+fecha / Prioridad / Estados / Tags — en vez de
// apretar todo en una sola línea horizontal. El quiebre de línea lo hace
// el CSS (.pedido-card-compact, ver global.css) vía flex-wrap + el orden
// de los elementos acá ya está pensado para leerse bien apilado.
export function PedidoCardCompact({ pedido, onTagClick, filtroTag, tipos = [], estados = [], origenRuta = '/app' }) {
  const navigate = useNavigate()
  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const tipo = tipos.find(t => t.value === pedido.tipo)
  const estadosBadge = estados.filter(e => (pedido.estados ?? []).includes(e.value))
  const irAlDetalle = () => navigate(`/app/pedidos/${pedido.id}`, { state: { from: origenRuta } })
  const fechaTexto = pedido.fecha_limite
    ? format(new Date(pedido.fecha_limite + 'T00:00:00'), 'd MMM', { locale: es })
    : null
  const peorRevision = peorRevisionDePedido(pedido.entregable)

  return (
    <div
      onClick={irAlDetalle}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && irAlDetalle()}
      className="pedido-card-compact"
    >
      {/* Desktop: una sola línea, orden original — prioridad, título, tags,
          estados, fecha — con un separador "|" entre tags/estados/fecha.
          Oculto en mobile vía CSS (.pedido-compact-desktop). */}
      <div className="pedido-compact-desktop">
        {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
        <span className="pedido-asunto-compact">{pedido.asunto}</span>
        <div className="pedido-compact-grupos-derecha">
          {pedido.tags?.length > 0 && (
            <div className="pedido-compact-grupo" onClick={e => e.stopPropagation()}>
              {pedido.tags.map(t => (
                <button key={t} onClick={() => onTagClick?.(t)}
                  className={`tag-chip ${filtroTag === t ? 'tag-chip-active' : ''}`}>
                  <Tag size={9} />{t}
                </button>
              ))}
            </div>
          )}
          {estadosBadge.length > 0 && (
            <div className="pedido-compact-grupo">
              {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
            </div>
          )}
          {peorRevision && (
            peorRevision.revision_pruebas_ok === peorRevision.revision_pruebas_total ? (
              <span className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}>
                {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total}
              </span>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); navigate('/app/revision', { state: { url: peorRevision.link_online, entregableId: peorRevision.id } }) }}
                className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}
              >
                {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total}
              </button>
            )
          )}
          <span className="pedido-meta-item">
            <Calendar size={12} />
            {fechaTexto ?? 'Sin fecha'}
          </span>
        </div>
      </div>

      {/* Mobile: filas apiladas con etiquetas — título+fecha, prioridad+tipo,
          estados, tags. Oculto en desktop vía CSS (.pedido-compact-mobile). */}
      <div className="pedido-compact-mobile">
        <div className="pedido-compact-fila pedido-compact-fila-titulo">
          <span className="pedido-asunto-compact">{pedido.asunto}</span>
          <span className={`pedido-meta-item ${!fechaTexto ? 'pedido-meta-sin-fecha' : ''}`}>
            <Calendar size={12} />
            {fechaTexto ?? 'Sin fecha'}
          </span>
        </div>

        {prio && (
          <div className="pedido-compact-fila">
            <span className="pedido-compact-fila-label">Prioridad · Tipo:</span>
            <Badge label={prio.label} color={prio.color} size="sm" />
            {tipo && <Badge label={tipo.label} color={tipo.color} size="sm" />}
          </div>
        )}

        {estadosBadge.length > 0 && (
          <div className="pedido-compact-fila">
            <span className="pedido-compact-fila-label">Estados:</span>
            <div className="flex gap-[0.3rem] flex-wrap">
              {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
            </div>
          </div>
        )}

        {pedido.tags?.length > 0 && (
          <div className="pedido-compact-fila" onClick={e => e.stopPropagation()}>
            <span className="pedido-compact-fila-label">Tags:</span>
            <div className="flex gap-1 flex-wrap">
              {pedido.tags.map(t => (
                <button key={t} onClick={() => onTagClick?.(t)}
                  className={`tag-chip ${filtroTag === t ? 'tag-chip-active' : ''}`}>
                  <Tag size={9} />{t}
                </button>
              ))}
            </div>
          </div>
        )}

        {peorRevision && (
          <div className="pedido-compact-fila" onClick={e => e.stopPropagation()}>
            <span className="pedido-compact-fila-label">Revisión:</span>
            {peorRevision.revision_pruebas_ok === peorRevision.revision_pruebas_total ? (
              <span className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}>
                {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total}
              </span>
            ) : (
              <button
                onClick={() => navigate('/app/revision', { state: { url: peorRevision.link_online, entregableId: peorRevision.id } })}
                className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}
              >
                {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function PedidoCardFull({ pedido, onTagClick, filtroTag, tipos = [], estados = [], origenRuta = '/app' }) {
  const navigate = useNavigate()
  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const estadosBadge = estados.filter(e => (pedido.estados ?? []).includes(e.value))
  const entregables = Array.isArray(pedido.entregable)
    ? pedido.entregable
    : pedido.entregable ? [pedido.entregable] : []
  const irAlDetalle = () => navigate(`/app/pedidos/${pedido.id}`, { state: { from: origenRuta } })

  return (
    <div
      onClick={irAlDetalle}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && irAlDetalle()}
      className="pedido-card-full"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
          {(() => {
            const tipo = tipos.find(t => t.value === pedido.tipo)
            return tipo ? <span className="tipo-label" style={{ color: tipo.color }}>{tipo.label}</span> : null
          })()}
        </div>
        <div className="flex gap-[0.375rem] flex-wrap">
          {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
        </div>
      </div>

      <h3 className="pedido-title">{pedido.asunto}</h3>
      <EntregablesCard entregables={entregables} />

      {pedido.descripcion && <p className="pedido-descripcion">{pedido.descripcion}</p>}

      {pedido.subtareas?.length > 0 && (() => {
        const completadas = pedido.subtareas.filter(s => s.completada).length
        const total = pedido.subtareas.length
        const porcentaje = Math.round((completadas / total) * 100)
        return (
          <div className="pedido-progreso">
            <span className="pedido-progreso-label">Tareas {completadas}/{total}</span>
            <div className="pedido-progreso-barra">
              <div className="pedido-progreso-relleno" style={{ width: `${porcentaje}%` }} />
            </div>
          </div>
        )
      })()}

      <div className="pedido-meta">
        {pedido.fecha_limite ? (
          <span className="pedido-meta-item">
            <Calendar size={13} />
            {format(new Date(pedido.fecha_limite + 'T00:00:00'), 'd MMM yyyy', { locale: es })}
          </span>
        ) : (
          <span className="pedido-meta-item pedido-meta-sin-fecha">
            <Calendar size={13} />
            Sin fecha de vencimiento
          </span>
        )}
        {pedido.pedido_asignados?.length > 0 && (
          <span className="pedido-meta-item pedido-meta-avatares">
            {pedido.pedido_asignados.map(a => <AvatarAsignado key={a.user_id} asignado={a} />)}
          </span>
        )}
        {pedido.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
            {pedido.tags.map(t => (
              <button key={t} onClick={() => onTagClick?.(t)}
                className={`tag-chip ${filtroTag === t ? 'tag-chip-active' : ''}`}>
                <Tag size={9} />{t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
