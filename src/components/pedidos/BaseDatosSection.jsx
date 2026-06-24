import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { leerMuestraDeArchivo, compararCampos, validateCsvHeaders } from '@/lib/revision-envios/comparar'
import { filtrarSoloUltimaVersion } from '@/lib/revision-envios/versionesPieza'
import { animarProgreso } from '@/lib/revision-envios/animarProgreso'
import { REVISION_CONFIG } from '@/lib/revision/config'
import { Upload, X, Database, CheckCircle2, AlertCircle, AlertTriangle, Loader2, RefreshCw, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Trae el HTML de una pieza via proxy — mismo criterio que RevisionEnvios.
// Si el proxy no está disponible (local sin vercel dev) lanza un error
// para que el resultado quede null y no se muestre ningún pill.
async function traerHtml(url) {
  const res = await fetch(`${REVISION_CONFIG.PROXY_URL}?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error('proxy_no_disponible')
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) throw new Error('proxy_no_disponible')
  return res.text()
}

// Corre la comparación base↔merge tags para UNA pieza. Devuelve el
// resultado "crudo" (incluye ok/miss/unused) más metadata de la pieza,
// para que quien llama pueda armar tanto el detalle por pieza como el
// agregado. tipo 'error_proxy' si el HTML no se pudo traer.
async function verificarPieza(headerLine, pieza) {
  try {
    const html = await traerHtml(pieza.link_online)
    const cmp = compararCampos(headerLine, html)
    return { entregable_id: pieza.id, nombre_pieza: pieza.nombre_pieza || null, tipo: 'ok', miss: cmp.miss }
  } catch (e) {
    return { entregable_id: pieza.id, nombre_pieza: pieza.nombre_pieza || null, tipo: 'error_proxy', miss: [] }
  }
}

// Pill de compatibilidad para UNA evaluación (ya sea la única pieza de
// una base asignada, o una de las N piezas de una base "para todas").
// onVerDetalle expande/colapsa la lista de campos faltantes in-place;
// onIrARevision navega a la herramienta completa para más contexto.
function CompatPill({ resultado, expandido, onToggleDetalle, onIrARevision }) {
  if (!resultado) return null

  if (resultado.tipo === 'error_proxy') {
    return (
      <button className="base-compat-pill base-compat-unknown" onClick={onIrARevision} title="Verificar manualmente en Revisión de envíos">
        No se pudo verificar
      </button>
    )
  }
  if (resultado.miss.length === 0) {
    return (
      <span className="base-compat-pill base-compat-ok">
        <CheckCircle2 size={12} />
        Compatible
      </span>
    )
  }
  return (
    <button className="base-compat-pill base-compat-error" onClick={onToggleDetalle} title="Ver campos faltantes">
      <AlertCircle size={12} />
      {resultado.miss.length === 1 ? '1 campo faltante' : `${resultado.miss.length} campos faltantes`}
      <ChevronDown size={11} className={`base-compat-chevron ${expandido ? 'base-compat-chevron-open' : ''}`} />
    </button>
  )
}

// Lista de campos faltantes, desplegada debajo del pill al expandir.
// Separada del pill para poder reusarla tanto en el caso "una pieza"
// como en cada fila del caso "todas las piezas".
function DetalleMiss({ miss, onIrARevision }) {
  return (
    <div className="base-miss-detalle">
      <p className="base-miss-detalle-label">Faltan en la base:</p>
      <div className="base-miss-detalle-lista">
        {miss.map(campo => (
          <span key={campo} className="base-miss-chip">{campo}</span>
        ))}
      </div>
      <button className="base-miss-ver-revision" onClick={onIrARevision}>
        Ver detalle completo en Revisión de envíos
      </button>
    </div>
  )
}

// Avisos estructurales del propio archivo de base (caracteres inválidos,
// falta de columna Email, columnas duplicadas) — independientes de si
// hay o no una pieza para comparar. Se corren una sola vez al subir el
// archivo y se guardan junto a la base, no se recalculan en cada render.
function AvisosEstructura({ avisos }) {
  if (!avisos?.length) return null
  return (
    <div className="base-avisos-estructura">
      {avisos.map((a, i) => (
        <div key={i} className={`base-aviso-row base-aviso-${a.severidad}`}>
          <AlertTriangle size={12} />
          <span>
            {a.tipo === 'falta_email' && 'No se encontró una columna exacta "Email"'}
            {a.tipo === 'duplicado' && `Columnas duplicadas: ${a.campos.join(', ')}`}
            {a.tipo === 'caracteres_invalidos' && `"${a.campo}" tiene caracteres no recomendados`}
          </span>
        </div>
      ))}
    </div>
  )
}

function resultadoDesdeSupabase(base) {
  if (!base.resultado_tipo) return null
  if (Array.isArray(base.resultado_detalle) && base.resultado_detalle.length) {
    return { porPieza: base.resultado_detalle }
  }
  // Filas viejas, de antes de resultado_detalle — degradar a un solo
  // resultado agregado sin detalle de campos (no tenemos los nombres).
  if (base.resultado_tipo === 'error_proxy') return { porPieza: [{ tipo: 'error_proxy', miss: [] }] }
  if (base.resultado_tipo === 'ok') return { porPieza: [{ tipo: 'ok', miss: [] }] }
  return { porPieza: [{ tipo: 'ok', miss: Array(base.resultado_miss_count ?? 1).fill('?') }] }
}

function BaseItem({ base, entregables, canWrite, onEliminar, onAsignar, onVerificar, verificando, progreso, resultado }) {
  const navigate = useNavigate()
  const resultadoMostrar = resultado ?? resultadoDesdeSupabase(base)
  const porPieza = resultadoMostrar?.porPieza ?? []
  // Los avisos estructurales (falta Email, duplicados, caracteres raros)
  // dependen únicamente de header_line, que sí persiste en Supabase —
  // se recalculan siempre acá en vez de depender de un campo en memoria,
  // así sobreviven a un refresh de página o a que otro usuario abra el
  // pedido. Es barato: header_line es una sola línea de texto.
  const avisosEstructura = validateCsvHeaders(base.header_line)
  // Clave de expansión: índice dentro de porPieza (un solo pill cuando
  // la base aplica a una pieza, varios cuando aplica a todas).
  const [expandidoIdx, setExpandidoIdx] = useState(null)

  function piezaDe(entregableId) {
    return entregables.find(e => e.id === entregableId)
  }

  function irARevision(entregableId) {
    const pieza = entregableId
      ? piezaDe(entregableId)
      : entregables.find(e => e.link_online)
    if (!pieza?.link_online) return
    navigate('/app/revision-envios', {
      state: { headerLine: base.header_line, url: pieza.link_online }
    })
  }

  return (
    <div className="base-item">
      <div className="base-item-top">
        <div className="base-item-info">
          <Database size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span className="base-cargada-nombre">{base.nombre_archivo}</span>
        </div>
        <div className="base-item-actions">
          {!verificando && resultadoMostrar && (
            <button
              onClick={() => onVerificar(base)}
              className="base-reverificar-btn"
              title="Volver a verificar compatibilidad"
            >
              <RefreshCw size={13} />
            </button>
          )}
          {canWrite && (
            <button onClick={() => onEliminar(base.id)} className="base-quitar-btn" title="Quitar base">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <AvisosEstructura avisos={avisosEstructura} />

      {/* Dropdown de asignación — solo si hay más de una pieza */}
      {canWrite && entregables.length > 1 && (
        <div className="base-item-asignacion">
          <span className="base-asignacion-label">Aplica a:</span>
          <select
            className="base-asignacion-select"
            value={base.entregable_id ?? ''}
            onChange={e => onAsignar(base.id, e.target.value || null)}
          >
            <option value="">Todas las piezas</option>
            {entregables.map(e => (
              <option key={e.id} value={e.id}>
                {e.nombre_pieza || e.link_online || `Pieza ${e.id.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Aviso de versiones anteriores excluidas — solo aparece justo
          después de correr la verificación automática "para todas las
          piezas", cuando había más de una versión (_v1/_v2/etc) de la
          misma pieza y se evaluó solo la última. No se persiste: es
          informativo sobre esa corrida puntual, se recalcula cada vez
          que se vuelve a verificar. No bloquea nada — el dropdown
          "Aplica a" sigue permitiendo elegir cualquier versión a mano. */}
      {!verificando && resultadoMostrar?.excluidasPorVersion?.length > 0 && (
        <p className="base-versiones-excluidas-aviso">
          Se excluyeron {resultadoMostrar.excluidasPorVersion.length === 1 ? '1 versión anterior' : `${resultadoMostrar.excluidasPorVersion.length} versiones anteriores`} de la verificación automática ({resultadoMostrar.excluidasPorVersion.map(p => p.nombre_pieza).join(', ')}) — para verificar una versión específica, asignala desde "Aplica a".
        </p>
      )}

      {/* Resultados — uno por pieza evaluada. Si la base aplica a una
          sola pieza, porPieza tiene un solo elemento y se ve igual que
          antes; si aplica a "todas", cada pieza tiene su propio pill. */}
      {!verificando && porPieza.length > 0 && (
        <div className="base-resultados-lista">
          {porPieza.map((r, idx) => {
            const pieza = r.entregable_id ? piezaDe(r.entregable_id) : null
            const mostrarNombrePieza = porPieza.length > 1
            return (
              <div key={r.entregable_id ?? idx} className="base-resultado-row">
                {mostrarNombrePieza && (
                  <span className="base-resultado-pieza-nombre">
                    {pieza?.nombre_pieza || pieza?.link_online || r.nombre_pieza || 'Pieza'}
                  </span>
                )}
                <CompatPill
                  resultado={r}
                  expandido={expandidoIdx === idx}
                  onToggleDetalle={() => setExpandidoIdx(prev => prev === idx ? null : idx)}
                  onIrARevision={() => irARevision(r.entregable_id)}
                />
                {expandidoIdx === idx && r.miss?.length > 0 && (
                  <DetalleMiss miss={r.miss} onIrARevision={() => irARevision(r.entregable_id)} />
                )}
              </div>
            )
          })}
          {base.verificado_at && (
            <p className="base-verificado-fecha">
              Verificado {formatDistanceToNow(new Date(base.verificado_at), { locale: es, addSuffix: true })}
            </p>
          )}
        </div>
      )}

      {/* Sin pieza todavía — es un flujo legítimo (la base suele llegar
          antes de tener el HTML armado), así que no es un error ni algo
          para bloquear: se puede cargar la base igual. Pero sin ninguna
          pieza con link no hay nada contra qué comparar, así que ni el
          dropdown "Aplica a" ni la verificación automática se disparan
          (ver entregables.length > 1 más arriba y el chequeo de
          link_online en cargarArchivo/asignarPieza) — este aviso explica
          por qué, para que no parezca que la base "no hizo nada". */}
      {!verificando && porPieza.length === 0 && entregables.filter(e => e.link_online).length === 0 && (
        <p className="base-sin-pieza-aviso">
          Todavía no hay ninguna pieza cargada con link — apenas se cargue una, vas a poder verificar la compatibilidad.
        </p>
      )}

      {/* Progress bar — abajo de todo, mismo patrón visual que piezas entregables */}
      {verificando && (
        <div className="base-verificando-bloque">
          <div className="base-verificando-header">
            <Loader2 size={13} className="base-verificando-spinner" />
            <span className="base-verificando-texto">Validando compatibilidad entre la base y la pieza…</span>
            <span className="base-verificando-pct">{progreso}%</span>
          </div>
          <div className="base-verificando-barra-pista">
            <div className="base-verificando-barra-relleno" style={{ width: `${progreso}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

export function BaseDatosSection({ pedidoId, canWrite, onUpdate, entregables, bases }) {
  const [dragging, setDragging] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [progresoSubida, setProgresoSubida] = useState(0)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  // Estado de verificación por base: { [baseId]: { progreso, resultado, terminado } }
  const [verificaciones, setVerificaciones] = useState({})

  async function correrVerificacion(base, entregablesActuales) {
    let piezasAEvaluar
    let excluidasPorVersion = []

    if (base.entregable_id) {
      // Asignación manual a una pieza específica — nunca se filtra por
      // versión acá. Si el usuario eligió a propósito una _v1 vieja
      // desde el dropdown "Aplica a", tiene que poder verificarla igual.
      piezasAEvaluar = entregablesActuales.filter(e => e.id === base.entregable_id && e.link_online)
    } else {
      // Modo automático ("Todas las piezas") — si hay varias versiones
      // de la misma pieza (mismo nombre base + sufijo _v1/_v2/etc), solo
      // tiene sentido verificar la última: las anteriores ya no se van
      // a enviar, comparar contra ellas es ruido. Las piezas sin patrón
      // de versión no se tocan.
      const conLink = entregablesActuales.filter(e => e.link_online)
      const { vigentes, excluidas } = filtrarSoloUltimaVersion(conLink)
      piezasAEvaluar = vigentes
      excluidasPorVersion = excluidas
    }

    if (!piezasAEvaluar.length) return

    setVerificaciones(prev => ({
      ...prev,
      [base.id]: { progreso: 0, resultado: null, terminado: false }
    }))

    // Animación y fetch en paralelo — mostramos progreso animado mientras
    // esperamos el HTML, y el resultado aparece cuando termina lo que tarde más.
    // Cada pieza se evalúa por separado (porPieza), nunca se mezclan los
    // resultados de piezas distintas en un solo conteo.
    const [porPieza] = await Promise.all([
      Promise.all(piezasAEvaluar.map(p => verificarPieza(base.header_line, p))),
      animarProgreso(pct =>
        setVerificaciones(prev => ({
          ...prev,
          [base.id]: { ...prev[base.id], progreso: pct }
        }))
      )
    ])

    const resultadoFinal = { porPieza, excluidasPorVersion }
    const verificadoAt = new Date().toISOString()

    // Para compatibilidad con el conteo agregado viejo (resultado_tipo,
    // resultado_miss_count), seguimos derivando algo razonable de
    // porPieza, pero la fuente de verdad pasa a ser resultado_detalle.
    const huboError = porPieza.some(r => r.tipo === 'error_proxy')
    const missTotal = porPieza.flatMap(r => r.miss)

    await supabase.from('pedido_base').update({
      resultado_tipo: huboError ? 'error_proxy' : (missTotal.length === 0 ? 'ok' : 'miss'),
      resultado_miss_count: missTotal.length,
      resultado_detalle: porPieza,
      verificado_at: verificadoAt,
    }).eq('id', base.id)

    setVerificaciones(prev => ({
      ...prev,
      [base.id]: { progreso: 100, resultado: resultadoFinal, terminado: true }
    }))
    onUpdate()
  }

  async function cargarArchivo(file) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'txt', 'xlsx'].includes(ext)) {
      setError('Solo se aceptan archivos .csv, .txt o .xlsx')
      return
    }
    setError('')
    setCargando(true)
    setProgresoSubida(0)

    let headerLine = ''
    let insertedBase = null

    const [leidoResult] = await Promise.all([
      leerMuestraDeArchivo(file)
        .then(r => { headerLine = r.headerLine; return r })
        .catch(e => { setError(e.message || 'No se pudo leer el archivo.'); return null }),
      animarProgreso(setProgresoSubida)
    ])

    if (headerLine) {
      const { data } = await supabase.from('pedido_base').insert({
        pedido_id: pedidoId,
        nombre_archivo: file.name,
        header_line: headerLine,
        entregable_id: null,
      }).select().single()
      insertedBase = data
      onUpdate()
    }

    setCargando(false)
    setProgresoSubida(0)

    // Si hay al menos una pieza con link, verificar automáticamente
    // (antes solo lo hacía si había exactamente una; ahora corre
    // siempre que haya algo para evaluar, mostrando un pill por pieza).
    if (insertedBase && entregables.filter(e => e.link_online).length > 0) {
      correrVerificacion(insertedBase, entregables)
    }
  }

  async function eliminarBase(baseId) {
    await supabase.from('pedido_base').delete().eq('id', baseId)
    setVerificaciones(prev => { const n = { ...prev }; delete n[baseId]; return n })
    onUpdate()
  }

  async function asignarPieza(baseId, entregableId) {
    await supabase.from('pedido_base').update({ entregable_id: entregableId }).eq('id', baseId)
    onUpdate()

    // Al asignar una pieza específica, correr la verificación automáticamente
    const base = bases.find(b => b.id === baseId)
    if (!base) return
    const baseActualizada = { ...base, entregable_id: entregableId || null }
    correrVerificacion(baseActualizada, entregables)
  }

  return (
    <div className="base-datos-section">

      {bases.map(base => {
        const verif = verificaciones[base.id]
        return (
          <BaseItem
            key={base.id}
            base={base}
            entregables={entregables}
            canWrite={canWrite}
            onEliminar={eliminarBase}
            onAsignar={asignarPieza}
            onVerificar={b => correrVerificacion(b, entregables)}
            verificando={verif ? !verif.terminado : false}
            progreso={verif?.progreso ?? 0}
            resultado={verif?.resultado ?? null}
          />
        )
      })}

      {/* Dropzone para agregar nueva base */}
      {canWrite && (
        <div
          className={`base-dropzone ${dragging ? 'dragging' : ''} ${cargando ? 'loading' : ''}`}
          onClick={() => !cargando && fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false)
            if (e.dataTransfer.files[0]) cargarArchivo(e.dataTransfer.files[0])
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) cargarArchivo(e.target.files[0]) }}
          />
          {cargando ? (
            <>
              <Loader2 size={15} className="base-dropzone-spinner" />
              <div className="base-dropzone-texto">
                <span>Leyendo encabezado…</span>
                <div className="entregable-revision-barra-pista" style={{ marginTop: '4px', maxWidth: '120px' }}>
                  <div className="entregable-revision-barra-relleno" style={{ width: `${progresoSubida}%` }} />
                </div>
              </div>
              <span className="entregable-revision-progreso-texto" style={{ marginLeft: 'auto' }}>
                {progresoSubida}%
              </span>
            </>
          ) : (
            <>
              <Upload size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div className="base-dropzone-texto">
                <span>{bases.length === 0 ? 'Subir base de datos' : 'Agregar otra base'}</span>
                <span className="base-dropzone-hint">.csv · .txt · .xlsx — solo se guarda el encabezado</span>
              </div>
            </>
          )}
        </div>
      )}

      {!canWrite && bases.length === 0 && (
        <p className="text-muted-sm">Sin bases de datos cargadas.</p>
      )}

      {error && <p className="msg-error" style={{ marginTop: '0.375rem' }}>{error}</p>}
    </div>
  )
}
