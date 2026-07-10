import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { colorAvatar, iniciales } from '@/components/pedidos/PedidoCard'
import { validateCsvHeaders } from '@/lib/revision-envios/comparar'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react'

// Una fila por evaluación (base × pieza) — "La base en negrita es/no es
// compatible con la pieza, por estos campos". Mismo nivel de detalle
// que pidió el usuario para no tener que ir al acordeón a enterarse
// qué falta exactamente. onIrARevision navega a Revisión de envíos con
// el header y la URL ya precargados — esa pantalla los auto-analiza
// sola, sin necesitar tocar el botón "Analizar" de nuevo.
function FilaEvaluacion({ base, evaluacion, pieza, onIrARevision }) {
  const compatible = evaluacion.tipo === 'ok' && (evaluacion.miss?.length ?? 0) === 0
  const sinVerificar = evaluacion.tipo === 'error_proxy'
  const nombrePieza = pieza?.nombre_pieza || pieza?.link_online || evaluacion.nombre_pieza || 'la pieza'

  if (sinVerificar) {
    return (
      <button className="det-info-revision-fila det-info-revision-fila-clickeable" onClick={onIrARevision}>
        <AlertTriangle size={14} className="det-info-revision-icon det-info-revision-icon-warning" />
        <span className="det-info-revision-texto">
          No se pudo verificar <b>{base.nombre_archivo}</b> contra <b>{nombrePieza}</b>
        </span>
        <ExternalLink size={13} className="det-info-revision-chevron" />
      </button>
    )
  }

  if (compatible) {
    return (
      <div className="det-info-revision-fila">
        <CheckCircle2 size={14} className="det-info-revision-icon det-info-revision-icon-ok" />
        <span className="det-info-revision-texto">
          <b>{base.nombre_archivo}</b> es compatible con <b>{nombrePieza}</b>
        </span>
      </div>
    )
  }

  return (
    <button className="det-info-revision-fila det-info-revision-fila-clickeable" onClick={onIrARevision}>
      <AlertCircle size={14} className="det-info-revision-icon det-info-revision-icon-error" />
      <span className="det-info-revision-texto">
        <b>{base.nombre_archivo}</b> no es compatible con <b>{nombrePieza}</b> — falta{evaluacion.miss.length !== 1 ? 'n' : ''}{' '}
        {evaluacion.miss.map((campo, i) => (
          <span key={campo}>
            {i > 0 && ', '}<b>&lt;*{campo}*&gt;</b>
          </span>
        ))}
      </span>
      <ExternalLink size={13} className="det-info-revision-chevron" />
    </button>
  )
}

// Resumen de solo lectura de las bases de datos cargadas en el pedido
// y sus revisiones de compatibilidad — vive en el riel de info junto a
// Asignados/Fecha límite/etc, NO duplica la herramienta interactiva
// (subir, asignar pieza, eliminar) que sigue siendo exclusiva del
// acordeón "Base de datos" del panel izquierdo. Acá se ve, fila por
// fila, qué base es compatible con qué pieza y qué falta exactamente —
// sin necesidad de abrir el acordeón para enterarse.
function RevisionesBloque({ pedido, bases, entregables }) {
  const navigate = useNavigate()
  if (!bases?.length) return null

  // Una fila por cada evaluación (base × pieza) que tenga resultado
  // real (no las que todavía no se verificaron) — esas se resumen
  // aparte en "sin verificar todavía", no fila por fila.
  const filas = bases.flatMap(b =>
    (Array.isArray(b.resultado_detalle) ? b.resultado_detalle : []).map(evaluacion => ({
      base: b,
      evaluacion,
      pieza: evaluacion.entregable_id ? entregables.find(e => e.id === evaluacion.entregable_id) : null,
    }))
  )

  const sinVerificar = bases.filter(b => !b.resultado_tipo).length

  // Avisos estructurales (falta Email, duplicados, caracteres raros) de
  // cualquiera de las bases cargadas — basta con que una tenga un error
  // para que valga la pena el aviso acá arriba.
  const basesConAvisoError = bases.filter(b => validateCsvHeaders(b.header_line).some(a => a.severidad === 'error'))

  const fechasVerificacion = bases.map(b => b.verificado_at).filter(Boolean)
  const ultimaVerificacion = fechasVerificacion.length
    ? new Date(Math.max(...fechasVerificacion.map(f => new Date(f).getTime())))
    : null

  function irABaseDatos(e) {
    e.preventDefault()
    const el = document.getElementById('base-datos-acordeon')
    if (!el) return
    // Si el acordeón está cerrado, su body no existe todavía — abrirlo
    // haciendo click en el header antes de hacer scroll, así el usuario
    // no llega a una sección colapsada y vacía.
    const header = el.querySelector('.det-acc-header')
    if (header && !el.querySelector('.det-acc-body')) header.click()
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Lleva a Revisión de envíos con el header de la base y el link de la
  // pieza ya precargados — esa pantalla detecta que llegó con los dos
  // datos puestos y corre el análisis sola, sin esperar un click más.
  // volverA viaja en el mismo state (no hay localStorage de por medio,
  // sigue el mismo patrón que ya usa headerLine/url) — le permite a
  // Revisión de envíos mostrar un botón "Volver a {pedido}" que regresa
  // directo a este pedido en vez de a la lista general de Pedidos.
  function irARevisionDirecto(base, pieza) {
    const link = pieza?.link_online || entregables.find(e => e.link_online)?.link_online
    if (!link) { irABaseDatos({ preventDefault: () => {} }); return }
    navigate('/revision-envios', {
      state: {
        headerLine: base.header_line,
        url: link,
        volverA: { pedidoId: pedido.id, asunto: pedido.asunto },
      }
    })
  }

  return (
    <div className="det-info-block">
      <p className="det-info-label">Revisión de envíos</p>
      <div className="det-info-revisiones">

        {filas.map(({ base, evaluacion, pieza }, idx) => (
          <FilaEvaluacion
            key={`${base.id}-${evaluacion.entregable_id ?? idx}`}
            base={base}
            evaluacion={evaluacion}
            pieza={pieza}
            onIrARevision={() => irARevisionDirecto(base, pieza)}
          />
        ))}

        {basesConAvisoError.map(b => (
          <div key={b.id} className="det-info-revision-fila det-info-revision-fila-clickeable" onClick={irABaseDatos}>
            <AlertTriangle size={14} className="det-info-revision-icon det-info-revision-icon-warning" />
            <span className="det-info-revision-texto">
              <b>{b.nombre_archivo}</b> tiene un problema de formato en su encabezado
            </span>
            <ExternalLink size={13} className="det-info-revision-chevron" />
          </div>
        ))}

        {filas.length === 0 && basesConAvisoError.length === 0 && sinVerificar > 0 && (
          <p className="det-info-sub">Sin verificar todavía</p>
        )}

        {ultimaVerificacion && (
          <p className="det-info-sub">
            Última revisión {formatDistanceToNow(ultimaVerificacion, { locale: es, addSuffix: true })}
          </p>
        )}

        <a href="#base-datos-acordeon" onClick={irABaseDatos} className="det-info-revisiones-link">
          Ver detalle
        </a>
      </div>
    </div>
  )
}


// Los 4 bloques de info del pedido (Asignados, Fecha límite, Tags,
// Instancia·Envío) — mismo contenido para el riel sticky de desktop
// (DetalleInfoRiel) y el acordeón "Detalles del pedido" de mobile, solo
// cambia el wrapper visual alrededor de estos bloques. El 5to bloque
// (Revisión de envíos) es opcional, solo aparece si el pedido tiene
// alguna base de datos cargada.
export function DetalleInfoBloques({ pedido, instancias, bases = [], entregables = [], isViewer = false }) {
  const inst = pedido.instancia ? instancias.find(i => i.value === pedido.instancia) : null
  return (
    <>
      <div className="det-info-block">
        <p className="det-info-label">Asignados</p>
        {pedido.pedido_asignados?.length === 0 || !pedido.pedido_asignados ? (
          <p className="info-card-empty">Nadie asignado</p>
        ) : (
          <div className="det-info-asignados">
            {pedido.pedido_asignados.map(a => (
              <div key={a.user_id} className="det-info-asignado-row">
                <span
                  className="det-info-avatar"
                  style={{ background: a.profiles?.avatar_color || colorAvatar(a.user_id) }}
                >
                  {iniciales(a.profiles?.full_name)}
                </span>
                <span>{a.profiles?.full_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {pedido.fecha_limite && (
        <div className="det-info-block">
          <p className="det-info-label">Fecha límite</p>
          <p className="det-info-value">
            {format(new Date(pedido.fecha_limite + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}
          </p>
          {(pedido.fecha_programacion || pedido.hora_programacion) && (
            <p className="det-info-sub">
              Programación · {pedido.fecha_programacion && format(new Date(pedido.fecha_programacion + 'T00:00:00'), 'd MMM yyyy', { locale: es })}
              {pedido.hora_programacion && ` · ${pedido.hora_programacion}`}
            </p>
          )}
        </div>
      )}

      {pedido.tags?.length > 0 && (
        <div className="det-info-block">
          <p className="det-info-label">Tags</p>
          <div className="det-info-tags">
            {pedido.tags.map(t => <span key={t} className="tag-item">{t}</span>)}
          </div>
        </div>
      )}

      {(pedido.instancia || pedido.tipo_envio || pedido.cantidad_envios != null) && (
        <div className="det-info-block">
          <p className="det-info-label">Instancia · Envío</p>
          <div className="det-info-instancia-row">
            {inst && <Badge label={inst.label} color={inst.color} size="sm" />}
            {pedido.tipo_envio && (
              <span className="det-info-envio-tipo">
                {pedido.tipo_envio === 'otro' ? pedido.tipo_envio_otro || 'Otro' : pedido.tipo_envio === 'test' ? 'Test' : 'Real'}
              </span>
            )}
            {pedido.cantidad_envios != null && (
              <>
                <span className="det-info-sep">·</span>
                <span className="det-info-envio-cant">{pedido.cantidad_envios} envíos</span>
              </>
            )}
          </div>
        </div>
      )}

      {!isViewer && <RevisionesBloque pedido={pedido} bases={bases} entregables={entregables} />}
    </>
  )
}
