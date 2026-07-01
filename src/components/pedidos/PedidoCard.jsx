import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { Calendar, ExternalLink, Copy, Check, ChevronDown, ChevronUp, Tag, Database, FileSearch } from 'lucide-react'
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

// Mismo patrón que peorRevisionDePedido, pero para Revisión de envíos
// (compatibilidad base↔pieza, ver BaseDatosSection.jsx) — el peor
// resultado entre todas las bases cargadas en el pedido. Jerarquía:
// 'miss' (campos realmente faltantes, problema de compatibilidad real)
// > 'error_proxy' (no se pudo verificar, falla técnica, no implica que
// esté mal) > 'ok'. Bases sin resultado_tipo (nunca verificadas) se
// ignoran acá — no hay nada que mostrar todavía, no es lo mismo que un
// error.
const ORDEN_SEVERIDAD_BASE = { miss: 0, error_proxy: 1, ok: 2 }

export function peorBaseDePedido(pedidoBase) {
  const conResultado = (pedidoBase ?? []).filter(b => b.resultado_tipo != null)
  if (conResultado.length === 0) return null
  return conResultado.reduce((peor, b) =>
    ORDEN_SEVERIDAD_BASE[b.resultado_tipo] < ORDEN_SEVERIDAD_BASE[peor.resultado_tipo] ? b : peor
  )
}

// Mapea resultado_tipo de pedido_base a la misma escala de color que ya
// usa Revisión de emails (ok/advertencia/error) — error_proxy es una
// falla técnica al verificar (no necesariamente la base está mal), por
// eso es "advertencia" (ámbar) y no "error" (rojo); miss es un problema
// de compatibilidad real, ese sí es "error".
const SEVERIDAD_VISUAL_BASE = { ok: 'ok', error_proxy: 'advertencia', miss: 'error' }

// Pill compacto del resultado de Revisión de envíos para una tarjeta de
// pedido — mismo patrón visual que el badge de Revisión de emails
// (entregable-revision-badge-compacto), reusado tal cual con un ícono
// de base de datos en vez del número de pruebas, porque "compatible /
// no compatible" no tiene un ratio limpio como "8/10 pruebas". Click
// navega a Revisión de envíos con header+url precargados — mismo
// deep-link que ya usa el riel de info de PedidoDetalle.
function PillBaseCompacto({ pedidoBase, entregables, onClick }) {
  const peorBase = peorBaseDePedido(pedidoBase)
  if (!peorBase) return null
  const severidad = SEVERIDAD_VISUAL_BASE[peorBase.resultado_tipo]
  const texto = peorBase.resultado_tipo === 'ok' ? 'Compatible'
    : peorBase.resultado_tipo === 'error_proxy' ? 'No verificado'
    : `${peorBase.resultado_miss_count ?? '?'} falta${peorBase.resultado_miss_count === 1 ? '' : 'n'}`
  // Title informativo (no solo el nombre de la herramienta) — mismo
  // criterio que el pill de Revisión de HTML: da contexto rápido al
  // pasar el mouse, sin tener que hacer click para enterarse a qué
  // base/resultado corresponde.
  const titleTexto = peorBase.resultado_tipo === 'ok'
    ? `${peorBase.nombre_archivo} es compatible con la pieza`
    : peorBase.resultado_tipo === 'error_proxy'
      ? `No se pudo verificar ${peorBase.nombre_archivo}`
      : `${peorBase.nombre_archivo}: ${peorBase.resultado_miss_count ?? '?'} campo${peorBase.resultado_miss_count === 1 ? '' : 's'} faltante${peorBase.resultado_miss_count === 1 ? '' : 's'}`

  function irARevision(e) {
    e.stopPropagation()
    const pieza = peorBase.entregable_id
      ? entregables.find(en => en.id === peorBase.entregable_id)
      : entregables.find(en => en.link_online)
    if (!pieza?.link_online) return
    onClick(peorBase.header_line, pieza.link_online)
  }

  return (
    <button
      onClick={irARevision}
      className={`entregable-revision-badge-compacto entregable-revision-${severidad}`}
      title={titleTexto}
    >
      <Database size={10} style={{ marginRight: '3px' }} />
      {texto}
    </button>
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

// Para una pieza puntual, busca el resultado de Revisión de envíos que
// le corresponde — prioriza una base asignada DIRECTAMENTE a esa pieza
// (entregable_id === ent.id) sobre una base "para todas las piezas"
// (entregable_id null), igual prioridad que ya usa BaseDatosSection al
// resolver qué evaluar. Devuelve { base, evaluacion } o null si no hay
// ningún resultado aplicable a esta pieza todavía.
function resultadoBaseParaPieza(pedidoBase, entregableId) {
  const bases = pedidoBase ?? []
  const directa = bases.find(b => b.entregable_id === entregableId && b.resultado_tipo != null)
  const general = bases.find(b => b.entregable_id == null && b.resultado_tipo != null)
  const base = directa ?? general
  if (!base) return null
  // Busca la evaluación de ESTA pieza puntual dentro del detalle — si
  // no está (la base se verificó pero no incluyó esta pieza, por
  // ejemplo si en ese momento no tenía link todavía), no hay nada que
  // mostrar para ella. No usar un fallback al primer elemento del
  // array: eso mostraría el resultado de OTRA pieza como si fuera de
  // esta, que es peor que no mostrar nada.
  const evaluacion = Array.isArray(base.resultado_detalle)
    ? base.resultado_detalle.find(e => e.entregable_id === entregableId)
    : null
  if (!evaluacion) return null
  return { base, evaluacion }
}

export function EntregablesCard({ entregables, pedidoBase, role }) {
  const navigate = useNavigate()
  const [expandido, setExpandido] = useState(false)
  const ocultarRevisiones = role === ROLES.VIEWER
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
            {!ocultarRevisiones && ent.revision_pruebas_total != null && (
              ent.revision_pruebas_ok === ent.revision_pruebas_total ? (
                <span className={`entregable-revision-resumen entregable-revision-${ent.revision_severidad}`}>
                  <FileSearch size={11} style={{ verticalAlign: '-1px' }} />
                  {ent.revision_pruebas_ok}/{ent.revision_pruebas_total} pruebas superadas
                </span>
              ) : (
                <button
                  onClick={() => navigate('/app/revision', { state: { url: ent.link_online, entregableId: ent.id } })}
                  className={`entregable-revision-resumen entregable-revision-${ent.revision_severidad}`}
                >
                  <FileSearch size={11} style={{ verticalAlign: '-1px' }} />
                  {ent.revision_pruebas_ok}/{ent.revision_pruebas_total} pruebas superadas
                </button>
              )
            )}
            {!ocultarRevisiones && (() => {
              const r = resultadoBaseParaPieza(pedidoBase, ent.id)
              if (!r?.evaluacion) return null
              const severidad = SEVERIDAD_VISUAL_BASE[r.evaluacion.tipo === 'error_proxy' ? 'error_proxy' : (r.evaluacion.miss?.length ? 'miss' : 'ok')]
              const texto = r.evaluacion.tipo === 'error_proxy'
                ? 'No se pudo verificar la base'
                : r.evaluacion.miss?.length
                  ? `${r.evaluacion.miss.length} campo${r.evaluacion.miss.length !== 1 ? 's' : ''} faltante${r.evaluacion.miss.length !== 1 ? 's' : ''} en la base`
                  : 'Compatible con la base'
              return (
                <button
                  onClick={() => navigate('/app/revision-envios', { state: { headerLine: r.base.header_line, url: ent.link_online, volverA: { pedidoId: r.base.pedido_id } } })}
                  className={`entregable-revision-resumen entregable-revision-${severidad}`}
                >
                  <Database size={11} style={{ verticalAlign: '-1px' }} />
                  {texto}
                </button>
              )
            })()}
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
export function PedidoCardCompact({ pedido, onTagClick, filtroTag, tipos = [], estados = [], origenRuta = '/app', role }) {
  const navigate = useNavigate()
  const ocultarRevisiones = role === ROLES.VIEWER
  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const tipo = tipos.find(t => t.value === pedido.tipo)
  const estadosBadge = estados.filter(e => (pedido.estados ?? []).includes(e.value))
  const irAlDetalle = () => navigate(`/app/pedidos/${pedido.id}`, { state: { from: origenRuta } })
  const fechaTexto = pedido.fecha_limite
    ? format(new Date(pedido.fecha_limite + 'T00:00:00'), 'd MMM', { locale: es })
    : null
  const peorRevision = peorRevisionDePedido(pedido.entregable)
  // pedido.entregable puede venir como array (caso normal) o como
  // objeto único (cuando Supabase/la RPC devuelve una sola fila para
  // la relación) — normalizado acá una sola vez, igual criterio que ya
  // usa PedidoCardFull más abajo.
  const entregablesNorm = Array.isArray(pedido.entregable)
    ? pedido.entregable
    : pedido.entregable ? [pedido.entregable] : []
  // Lleva a Revisión de envíos con el header+url ya precargados, mismo
  // deep-link que usa el riel de info en PedidoDetalle — auto-corre el
  // análisis sin esperar un click más.
  function irARevisionEnvios(headerLine, url) {
    navigate('/app/revision-envios', { state: { headerLine, url, volverA: { pedidoId: pedido.id } } })
  }
  // Acordeón mobile: arranca colapsado (tipo y prioridad son campos
  // obligatorios al crear un pedido, así que el cuerpo expandido nunca
  // queda vacío — siempre hay algo que mostrar al abrirlo).
  const [expandidoMobile, setExpandidoMobile] = useState(false)
  // Color del borde izquierdo en mobile: NO es prioridad, es "necesita
  // atención en la revisión" — sin color si no hay piezas con revisión
  // o si el resultado es perfecto (10/10); ámbar si la peor severidad
  // es 'advertencia'; rojo si es 'error'. Reusa peorRevisionDePedido
  // (ya calculado arriba), sin lógica de severidad nueva.
  const esRevisionPerfecta = peorRevision && peorRevision.revision_pruebas_ok === peorRevision.revision_pruebas_total
  const colorBordeRevision = ocultarRevisiones || !peorRevision || esRevisionPerfecta
    ? null
    : peorRevision.revision_severidad === 'error' ? 'var(--icbc-red)' : '#F59E0B'

  return (
    <div className="pedido-card-compact">
      {/* Desktop: una sola línea, orden original — prioridad, título, tags,
          estados, fecha — con un separador "|" entre tags/estados/fecha.
          Oculto en mobile vía CSS (.pedido-compact-desktop). El click de
          TODA la fila navega al detalle — comportamiento exclusivo de
          desktop, ver el bloque mobile más abajo para su propio manejo
          de click (acordeón, no navegación). */}
      <div
        onClick={irAlDetalle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && irAlDetalle()}
        className="pedido-compact-desktop"
      >
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
          {!ocultarRevisiones && (peorRevision || peorBaseDePedido(pedido.pedido_base)) && (
            <div className="pedido-compact-grupo">
              {peorRevision && (
                peorRevision.revision_pruebas_ok === peorRevision.revision_pruebas_total ? (
                  <span
                    className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}
                    title={`Revisión de HTML: ${peorRevision.revision_pruebas_ok}/${peorRevision.revision_pruebas_total} pruebas superadas`}
                  >
                    <FileSearch size={10} style={{ marginRight: '3px' }} />
                    {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total}
                  </span>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); navigate('/app/revision', { state: { url: peorRevision.link_online, entregableId: peorRevision.id } }) }}
                    className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}
                    title={`Revisión de HTML: ${peorRevision.revision_pruebas_ok}/${peorRevision.revision_pruebas_total} pruebas superadas`}
                  >
                    <FileSearch size={10} style={{ marginRight: '3px' }} />
                    {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total}
                  </button>
                )
              )}
              <PillBaseCompacto pedidoBase={pedido.pedido_base} entregables={entregablesNorm} onClick={irARevisionEnvios} />
            </div>
          )}
          <span className="pedido-meta-item">
            <Calendar size={12} />
            {fechaTexto ?? 'Sin fecha'}
          </span>
        </div>
      </div>

      {/* Mobile: acordeón colapsado por default — header siempre visible
          (franja de color + título + prioridad + fecha + chevron), cuerpo
          expandible con Tipo/Estados/Tags/Revisión + botón Ver pedido.
          Oculto en desktop vía CSS (.pedido-compact-mobile). El click del
          header solo abre/cierra — NUNCA navega (a diferencia del bloque
          desktop de arriba); la única forma de ir al detalle es el botón
          "Ver pedido" de adentro. */}
      <div className="pedido-compact-mobile" style={colorBordeRevision ? { borderLeftColor: colorBordeRevision } : undefined}>
        <div
          onClick={() => setExpandidoMobile(v => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setExpandidoMobile(v => !v)}
          className="pedido-compact-mobile-header"
        >
          <div className="pedido-compact-mobile-header-fila1">
            <button
              onClick={e => { e.stopPropagation(); irAlDetalle() }}
              className="pedido-compact-mobile-ir-detalle"
              title="Ir al detalle del pedido"
            >
              <ExternalLink size={14} />
            </button>
            <span className="pedido-asunto-compact">{pedido.asunto}</span>
            {expandidoMobile ? <ChevronUp size={16} className="pedido-compact-mobile-chevron" /> : <ChevronDown size={16} className="pedido-compact-mobile-chevron" />}
          </div>
          <div className="pedido-compact-mobile-header-fila2">
            {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
            <span className={`pedido-meta-item ${!fechaTexto ? 'pedido-meta-sin-fecha' : ''}`}>
              <Calendar size={12} />
              {fechaTexto ?? 'Sin fecha'}
            </span>
          </div>
        </div>

        {expandidoMobile && (
          <div className="pedido-compact-mobile-body" onClick={e => e.stopPropagation()}>
            {tipo && (
              <div className="pedido-compact-mobile-seccion">
                <span className="pedido-compact-fila-label">Tipo:</span>
                <div className="pedido-compact-mobile-pills">
                  <Badge label={tipo.label} color={tipo.color} size="sm" />
                </div>
              </div>
            )}

            {estadosBadge.length > 0 && (
              <div className="pedido-compact-mobile-seccion">
                <span className="pedido-compact-fila-label">Estados:</span>
                <div className="pedido-compact-mobile-pills">
                  {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
                </div>
              </div>
            )}

            {pedido.tags?.length > 0 && (
              <div className="pedido-compact-mobile-seccion">
                <span className="pedido-compact-fila-label">Tags:</span>
                <div className="pedido-compact-mobile-pills">
                  {pedido.tags.map(t => (
                    <button key={t} onClick={() => onTagClick?.(t)}
                      className={`tag-chip ${filtroTag === t ? 'tag-chip-active' : ''}`}>
                      <Tag size={9} />{t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!ocultarRevisiones && (() => {
              const peorBase = peorBaseDePedido(pedido.pedido_base)
              const cantidadRevisiones = (peorRevision ? 1 : 0) + (peorBase ? 1 : 0)
              if (cantidadRevisiones === 0) return null
              return (
                <div className="pedido-compact-mobile-seccion">
                  <span className="pedido-compact-fila-label">
                    {cantidadRevisiones === 1 ? 'Revisión:' : 'Revisiones:'}
                  </span>
                  <div className="pedido-compact-mobile-pills">
                    {peorRevision && (
                      esRevisionPerfecta ? (
                        <span
                          className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}
                          title={`Revisión de HTML: ${peorRevision.revision_pruebas_ok}/${peorRevision.revision_pruebas_total} pruebas superadas`}
                        >
                          <FileSearch size={10} style={{ marginRight: '3px' }} />
                          {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total}
                        </span>
                      ) : (
                        <button
                          onClick={() => navigate('/app/revision', { state: { url: peorRevision.link_online, entregableId: peorRevision.id } })}
                          className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}
                          title={`Revisión de HTML: ${peorRevision.revision_pruebas_ok}/${peorRevision.revision_pruebas_total} pruebas superadas`}
                        >
                          <FileSearch size={10} style={{ marginRight: '3px' }} />
                          {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total}
                        </button>
                      )
                    )}
                    {peorBase && (
                      <PillBaseCompacto pedidoBase={pedido.pedido_base} entregables={entregablesNorm} onClick={irARevisionEnvios} />
                    )}
                  </div>
                </div>
              )
            })()}

            <button onClick={irAlDetalle} className="pedido-compact-mobile-ver-pedido">
              <ExternalLink size={13} />Ver pedido
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function PedidoCardFull({ pedido, onTagClick, filtroTag, tipos = [], estados = [], origenRuta = '/app', role }) {
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
      <EntregablesCard entregables={entregables} pedidoBase={pedido.pedido_base} role={role} />

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
