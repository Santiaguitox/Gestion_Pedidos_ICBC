import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { Calendar, ExternalLink, Copy, Check, ChevronDown, ChevronUp, Tag, Database, FileSearch } from 'lucide-react'
import { format } from 'date-fns'
// Utils puros mudados a lib (los importaban 6 archivos desde acá, y un
// componente que exporta funciones rompe react-refresh/only-export-components
// — Fast Refresh recarga la página entera en vez del componente solo).
import { colorAvatar, iniciales } from '@/lib/avatares'
import { peorRevisionDePedido, peorBaseDePedido } from '@/lib/severidad'
import { es } from 'date-fns/locale'

function AvatarAsignado({ asignado }) {
  const nombre = asignado.profiles?.full_name ?? ''
  const color = asignado.profiles?.avatar_color || colorAvatar(asignado.user_id)
  return (
    <span className="avatar-asignado" style={{ background: color }} title={nombre}>
      {iniciales(nombre)}
    </span>
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
                  onClick={() => navigate('/revision-html', { state: { url: ent.link_online, entregableId: ent.id } })}
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
                  onClick={() => navigate('/revision-envios', { state: { headerLine: r.base.header_line, url: ent.link_online, volverA: { pedidoId: r.base.pedido_id } } })}
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
export function PedidoCardCompact({ pedido, onTagClick, filtroTag, tipos = [], estados = [], origenRuta = '/', role }) {
  const navigate = useNavigate()
  const ocultarRevisiones = role === ROLES.VIEWER
  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const tipo = tipos.find(t => t.value === pedido.tipo)
  const estadosBadge = estados.filter(e => (pedido.estados ?? []).includes(e.value))
  const irAlDetalle = () => navigate(`/pedidos/${pedido.id}`, { state: { from: origenRuta } })
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
    navigate('/revision-envios', { state: { headerLine, url, volverA: { pedidoId: pedido.id } } })
  }
  // Acordeón mobile: arranca colapsado (tipo y prioridad son campos
  // obligatorios al crear un pedido, así que el cuerpo expandido nunca
  // queda vacío — siempre hay algo que mostrar al abrirlo).
  const [expandidoMobile, setExpandidoMobile] = useState(false)
  // Punto de atención en el header mobile (rediseño 2026-07): NO es
  // prioridad, es "necesita atención en la revisión" — sin punto si no
  // hay piezas con revisión o si el resultado es perfecto (10/10);
  // ámbar si la peor severidad es 'advertencia'; rojo si es 'error'.
  // Reusa peorRevisionDePedido (ya calculado arriba), sin lógica de
  // severidad nueva. Antes este mismo color iba en el borde izquierdo
  // de la tarjeta como franja — ahora es un punto a la derecha de la
  // fila 2 del header, como en la variante 4b del rediseño.
  const esRevisionPerfecta = peorRevision && peorRevision.revision_pruebas_ok === peorRevision.revision_pruebas_total
  const colorAtencionRevision = ocultarRevisiones || !peorRevision || esRevisionPerfecta
    ? null
    : peorRevision.revision_severidad === 'error' ? 'var(--icbc-red)' : '#F59E0B'
  // Peor resultado de Revisión de envíos — hoisted acá (antes se
  // calculaba inline en el body) porque ahora lo necesitan tanto la
  // sección QA del cajón como la condición de si mostrarla.
  const peorBase = peorBaseDePedido(pedido.pedido_base)
  // Fecha vencida = anterior a HOY (el día del vencimiento todavía no
  // cuenta como vencido — recién a partir del día siguiente). Solo se
  // usa en mobile para pintar la fecha de rojo en el header, como en
  // el rediseño 4b; desktop no cambia.
  const fechaVencida = pedido.fecha_limite
    ? new Date(pedido.fecha_limite + 'T23:59:59') < new Date()
    : false
  const asignados = pedido.pedido_asignados ?? []

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
                    onClick={e => { e.stopPropagation(); navigate('/revision-html', { state: { url: peorRevision.link_online, entregableId: peorRevision.id } }) }}
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

      {/* Mobile: acordeón colapsado por default — rediseño "cajón gris,
          grilla 2 columnas con pills" (variante 4b, 2026-07-10). Header
          siempre visible de dos filas: (1) ↗ al detalle + título en UNA
          línea con ellipsis + chevron que rota al abrir; (2) prioridad +
          fecha (roja si venció) + avatares de asignados + punto de
          atención de revisión a la derecha. Oculto en desktop vía CSS
          (.pedido-compact-mobile). El click del header solo abre/cierra —
          NUNCA navega (a diferencia del bloque desktop de arriba); al
          detalle se va con el ↗ del header o el botón "Ver pedido". */}
      <div className="pedido-compact-mobile">
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
            <ChevronDown size={16} className={`pedido-compact-mobile-chevron ${expandidoMobile ? 'pedido-compact-mobile-chevron-abierto' : ''}`} />
          </div>
          <div className="pedido-compact-mobile-header-fila2">
            {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
            <span className={`pedido-meta-item ${!fechaTexto ? 'pedido-meta-sin-fecha' : ''} ${fechaVencida ? 'pedido-fecha-vencida' : ''}`}>
              <Calendar size={12} />
              {fechaTexto ?? 'Sin fecha'}
            </span>
            <div className="pedido-compact-mobile-fila2-derecha">
              {asignados.length > 0 && (
                <span className="pedido-meta-avatares pedido-compact-mobile-avatares">
                  {asignados.map(a => <AvatarAsignado key={a.user_id} asignado={a} />)}
                </span>
              )}
              {colorAtencionRevision && (
                <span
                  className="pedido-compact-mobile-punto-atencion"
                  style={{ background: colorAtencionRevision }}
                  title="Requiere revisión"
                />
              )}
            </div>
          </div>
        </div>

        {/* Cuerpo expandido (rediseño 4b): un "cajón" gris en grilla de
            2 columnas — Tipo + Estados a la izquierda, Tags + QA a la
            derecha — para que un pedido cargado ocupe menos alto total
            que la lista apilada anterior. Abajo del todo, DENTRO del
            cajón y al 100% del ancho (grid-column: 1 / -1), la barra de
            Tareas con el mismo look de la vista mobile extendida
            (PedidoCardFull → .pedido-progreso). El botón "Ver pedido" va
            al 100% debajo del cajón, no adentro de una columna. */}
        {expandidoMobile && (
          <div className="pedido-compact-mobile-body" onClick={e => e.stopPropagation()}>
            <div className="pedido-compact-mobile-cajon">
              <div className="pedido-compact-mobile-col">
                {tipo && (
                  <div className="pedido-compact-mobile-seccion">
                    <span className="pedido-compact-mobile-label">Tipo</span>
                    <div className="pedido-compact-mobile-pills">
                      <Badge label={tipo.label} color={tipo.color} size="sm" />
                    </div>
                  </div>
                )}
                {estadosBadge.length > 0 && (
                  <div className="pedido-compact-mobile-seccion">
                    <span className="pedido-compact-mobile-label">Estados</span>
                    <div className="pedido-compact-mobile-pills">
                      {estadosBadge.map(e => <Badge key={e.value} label={e.label} color={e.color} size="sm" />)}
                    </div>
                  </div>
                )}
              </div>

              <div className="pedido-compact-mobile-col">
                {pedido.tags?.length > 0 && (
                  <div className="pedido-compact-mobile-seccion">
                    <span className="pedido-compact-mobile-label">Tags</span>
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
                {!ocultarRevisiones && (peorRevision || peorBase) && (
                  <div className="pedido-compact-mobile-seccion">
                    <span className="pedido-compact-mobile-label">QA</span>
                    <div className="pedido-compact-mobile-pills">
                      {peorRevision && (
                        esRevisionPerfecta ? (
                          <span
                            className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}
                            title={`Revisión de HTML: ${peorRevision.revision_pruebas_ok}/${peorRevision.revision_pruebas_total} pruebas superadas`}
                          >
                            <FileSearch size={10} style={{ marginRight: '3px' }} />
                            {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total} pruebas
                          </span>
                        ) : (
                          <button
                            onClick={() => navigate('/revision-html', { state: { url: peorRevision.link_online, entregableId: peorRevision.id } })}
                            className={`entregable-revision-badge-compacto entregable-revision-${peorRevision.revision_severidad}`}
                            title={`Revisión de HTML: ${peorRevision.revision_pruebas_ok}/${peorRevision.revision_pruebas_total} pruebas superadas`}
                          >
                            <FileSearch size={10} style={{ marginRight: '3px' }} />
                            {peorRevision.revision_pruebas_ok}/{peorRevision.revision_pruebas_total} pruebas
                          </button>
                        )
                      )}
                      {peorBase && (
                        <PillBaseCompacto pedidoBase={pedido.pedido_base} entregables={entregablesNorm} onClick={irARevisionEnvios} />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {pedido.subtareas?.length > 0 && (() => {
                const completadas = pedido.subtareas.filter(s => s.completada).length
                const total = pedido.subtareas.length
                const porcentaje = Math.round((completadas / total) * 100)
                return (
                  <div className="pedido-progreso pedido-compact-mobile-tareas">
                    <span className="pedido-progreso-label">Tareas {completadas}/{total}</span>
                    <div className="pedido-progreso-barra">
                      <div className="pedido-progreso-relleno" style={{ width: `${porcentaje}%` }} />
                    </div>
                  </div>
                )
              })()}
            </div>

            <button onClick={irAlDetalle} className="pedido-compact-mobile-ver-pedido">
              <ExternalLink size={13} />Ver pedido
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function PedidoCardFull({ pedido, onTagClick, filtroTag, tipos = [], estados = [], origenRuta = '/', role }) {
  const navigate = useNavigate()
  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const estadosBadge = estados.filter(e => (pedido.estados ?? []).includes(e.value))
  const entregables = Array.isArray(pedido.entregable)
    ? pedido.entregable
    : pedido.entregable ? [pedido.entregable] : []
  const irAlDetalle = () => navigate(`/pedidos/${pedido.id}`, { state: { from: origenRuta } })

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
