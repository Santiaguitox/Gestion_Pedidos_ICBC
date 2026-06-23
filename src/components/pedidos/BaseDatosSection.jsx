import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { leerMuestraDeArchivo, compararCampos } from '@/lib/revision-envios/comparar'
import { REVISION_CONFIG } from '@/lib/revision/config'
import { Upload, X, Database, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

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

// Simula progreso visual en ~1.5s independientemente de cuánto tarde
// la operación real — garantiza que el usuario vea que se está trabajando.
// Devuelve una Promise que resuelve cuando termina la animación.
function animarProgreso(onProgreso) {
  return new Promise(resolve => {
    const pasos = [
      { pct: 15, ms: 150 },
      { pct: 35, ms: 350 },
      { pct: 60, ms: 650 },
      { pct: 80, ms: 950 },
      { pct: 95, ms: 1200 },
      { pct: 100, ms: 1500 },
    ]
    pasos.forEach(({ pct, ms }) => {
      setTimeout(() => {
        onProgreso(pct)
        if (pct === 100) setTimeout(resolve, 150)
      }, ms)
    })
  })
}

// Corre la comparación base↔merge tags para una pieza dada.
// Trae el HTML via proxy y compara con el header_line de la base.
async function verificarCompatibilidad(headerLine, linkOnline) {
  try {
    const html = await traerHtml(linkOnline)
    return { tipo: 'ok', ...compararCampos(headerLine, html) }
  } catch (e) {
    return { tipo: 'error_proxy' }
  }
}

function CompatPill({ resultado, onClick }) {
  if (!resultado) return null
  if (resultado.tipo === 'error_proxy') {
    return (
      <button className="base-compat-pill base-compat-unknown" onClick={onClick} title="Verificar manualmente en Revisión de envíos">
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
    <button className="base-compat-pill base-compat-error" onClick={onClick} title="Ver detalle en Revisión de envíos">
      <AlertCircle size={12} />
      {resultado.miss.length === 1
        ? '1 campo faltante'
        : `${resultado.miss.length} campos faltantes`}
    </button>
  )
}

function resultadoDesdeSupabase(base) {
  if (!base.resultado_tipo) return null
  if (base.resultado_tipo === 'error_proxy') return { tipo: 'error_proxy' }
  if (base.resultado_tipo === 'ok') return { tipo: 'ok', miss: [] }
  return { tipo: 'ok', miss: Array(base.resultado_miss_count ?? 1).fill('?') }
}

function BaseItem({ base, entregables, canWrite, onEliminar, onAsignar, verificando, progreso, resultado }) {
  const navigate = useNavigate()
  const resultadoMostrar = resultado ?? resultadoDesdeSupabase(base)

  function irARevision() {
    const pieza = entregables.find(e =>
      base.entregable_id ? e.id === base.entregable_id : e.link_online
    )
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
            <CompatPill resultado={resultadoMostrar} onClick={irARevision} />
          )}
          {canWrite && (
            <button onClick={() => onEliminar(base.id)} className="base-quitar-btn" title="Quitar base">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

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

  // Estado de verificación por base: { [baseId]: { progreso, resultado } }
  const [verificaciones, setVerificaciones] = useState({})

  async function correrVerificacion(base, entregablesActuales) {
    const piezasAEvaluar = base.entregable_id
      ? entregablesActuales.filter(e => e.id === base.entregable_id && e.link_online)
      : entregablesActuales.filter(e => e.link_online)

    if (!piezasAEvaluar.length) return

    setVerificaciones(prev => ({
      ...prev,
      [base.id]: { progreso: 0, resultado: null, terminado: false }
    }))

    // Animación y fetch en paralelo — mostramos progreso animado mientras
    // esperamos el HTML, y el resultado aparece cuando termina lo que tarde más
    const [resultado] = await Promise.all([
      Promise.all(piezasAEvaluar.map(p => verificarCompatibilidad(base.header_line, p.link_online)))
        .then(resultados => {
          // Si alguno falló por proxy, devolver ese estado
          if (resultados.some(r => r.tipo === 'error_proxy')) return { tipo: 'error_proxy' }
          const todosLosMiss = resultados.flatMap(r => r.miss)
          return { tipo: 'ok', ...resultados[0], miss: todosLosMiss }
        }),
      animarProgreso(pct =>
        setVerificaciones(prev => ({
          ...prev,
          [base.id]: { ...prev[base.id], progreso: pct }
        }))
      )
    ])

    const resultadoFinal = resultado ?? { tipo: 'error_proxy' }

    // Persistir resultado en Supabase para que sobreviva entre sesiones
    await supabase.from('pedido_base').update({
      resultado_tipo: resultadoFinal.tipo === 'ok' && resultadoFinal.miss.length === 0
        ? 'ok'
        : resultadoFinal.tipo === 'error_proxy'
          ? 'error_proxy'
          : 'miss',
      resultado_miss_count: resultadoFinal.miss?.length ?? null,
    }).eq('id', base.id)

    setVerificaciones(prev => ({
      ...prev,
      [base.id]: { progreso: 100, resultado: resultadoFinal, terminado: true }
    }))
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

    // Si hay exactamente una pieza con link, verificar automáticamente
    if (insertedBase && entregables.filter(e => e.link_online).length === 1) {
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
