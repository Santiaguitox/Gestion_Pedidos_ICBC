import { useState, useRef, useCallback, useMemo } from 'react'
import { Upload, Plus, X, Download, Filter, ChevronLeft, ChevronRight, FileText } from 'lucide-react'

function fmt(n) { return Number(n).toLocaleString('es-AR') }

// ============================================================================
// OPERADORES
// ============================================================================

const OPERADORES = [
  { value: 'eq',        label: 'es igual a' },
  { value: 'neq',       label: 'no es igual a' },
  { value: 'contains',  label: 'contiene' },
  { value: 'ncontains', label: 'no contiene' },
  { value: 'starts',    label: 'empieza con' },
  { value: 'empty',     label: 'es vacío' },
  { value: 'nempty',    label: 'no es vacío' },
]

const SIN_VALOR = new Set(['empty', 'nempty'])

function nuevaCondicion(primeraCol = '') {
  return {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    columna: primeraCol,
    operador: 'eq',
    valor: '',
  }
}

// ============================================================================
// FILA DE CONDICIÓN
// ============================================================================

function FilaCondicion({ condicion, headers, onChange, onEliminar, puedeEliminar }) {
  const sinValor = SIN_VALOR.has(condicion.operador)
  return (
    <div className="seg-condicion-fila">
      <select className="seg-select" value={condicion.columna}
        onChange={e => onChange({ ...condicion, columna: e.target.value })}>
        <option value="">Columna…</option>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <select className="seg-select seg-select-op" value={condicion.operador}
        onChange={e => onChange({ ...condicion, operador: e.target.value, valor: '' })}>
        {OPERADORES.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      {!sinValor
        ? <input className="seg-input-valor" placeholder="Valor…" value={condicion.valor}
            onChange={e => onChange({ ...condicion, valor: e.target.value })} />
        : <div className="seg-input-valor seg-input-vacio" />
      }
      <button type="button" className="seg-btn-eliminar-condicion"
        onClick={onEliminar} disabled={!puedeEliminar} title="Eliminar condición">
        <X size={15} />
      </button>
    </div>
  )
}

// ============================================================================
// TABLA DE PREVIEW
// ============================================================================

const PAGE_SIZE = 50

function TablaPreview({ headers, rows, totalMatch }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const visibles = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const hayMasNoMostradas = totalMatch > rows.length

  return (
    <div className="seg-tabla-wrap">
      <div className="seg-tabla-scroll">
        <table className="seg-tabla">
          <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {visibles.map((row, i) => (
              <tr key={i}>{headers.map(h => <td key={h} title={String(row[h] ?? '')}>{row[h] ?? ''}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {(totalPages > 1 || hayMasNoMostradas) && (
        <div className="seg-paginacion">
          <button className="rb-pg-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={16} />
          </button>
          <span className="rb-pg-label">
            Página {page + 1} de {totalPages}
            {hayMasNoMostradas && ` · Preview de ${fmt(rows.length)} de ${fmt(totalMatch)} — descargá el CSV para el total completo`}
          </span>
          <button className="rb-pg-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SegmentarTabBase() {
  // Estado de fase: 'idle' | 'processing' | 'done'
  const [phase, setPhase] = useState('idle')
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [progressMatch, setProgressMatch] = useState(0)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  // Resultado
  const [headers, setHeaders] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [matchedRows, setMatchedRows] = useState(0)
  const [csvBlob, setCsvBlob] = useState(null)

  // Filtros — separados del resultado para poder re-correr sin perder la config
  const [condiciones, setCondiciones] = useState([nuevaCondicion()])
  const [operadorGlobal, setOperadorGlobal] = useState('AND')

  const workerRef = useRef(null)
  const fileRef = useRef(null)

  function getWorker() {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../../workers/segmentar.worker.js', import.meta.url),
        { type: 'module' }
      )
      workerRef.current.onmessage = (e) => {
        const msg = e.data
        if (msg.type === 'progress') {
          setProgress(msg.progress)
          setProgressTotal(msg.totalRows)
          setProgressMatch(msg.matchedRows)
        } else if (msg.type === 'done') {
          setHeaders(msg.headers)
          setPreviewRows(msg.previewRows)
          setTotalRows(msg.totalRows)
          setMatchedRows(msg.matchedRows)
          setCsvBlob(msg.csvBlob)
          setPhase('done')
        } else if (msg.type === 'error') {
          setError(msg.message)
          setPhase('idle')
        }
      }
    }
    return workerRef.current
  }

  const processFile = useCallback((file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'txt'].includes(ext)) { setError('Solo .csv o .txt'); return }

    setError(null)
    setFileName(file.name)
    fileRef.current = file
    setPhase('processing')
    setProgress(0)
    setProgressTotal(0)
    setProgressMatch(0)
    setHeaders([])
    setPreviewRows([])
    setCsvBlob(null)

    // Actualiza la primera condición para usar la primera columna
    // (se descubrirá una vez procesado, hasta entonces dejamos como está)
    const worker = getWorker()
    const condicionesValidas = condiciones.filter(c =>
      c.columna && (SIN_VALOR.has(c.operador) || c.valor.trim() !== '')
    )
    worker.postMessage({ type: 'segment', file, condiciones: condicionesValidas, operadorGlobal })
  }, [condiciones, operadorGlobal]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  function reset() {
    setPhase('idle')
    setFileName('')
    setProgress(0)
    setHeaders([])
    setPreviewRows([])
    setTotalRows(0)
    setMatchedRows(0)
    setCsvBlob(null)
    setError(null)
    setCondiciones([nuevaCondicion()])
    setSegmentoCreado(false)
    setCondicionesAplicadas([])
    fileRef.current = null
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null }
  }

  // Vuelve al formulario de filtros sin borrar el resultado —
  // así se puede ajustar una condición y volver a correr sin
  // tener que re-subir el archivo (igual que el paso 1 con "Analizar otra base").
  // NOTA: este botón solo reinicia la FASE, no el worker ni los datos.
  // Para cambiar el archivo hay que usar "Cambiar archivo".
  function volverAFiltros() {
    setPhase('idle')
    // Mantener headers en el state para que el selector de columnas
    // ya muestre las columnas reales del archivo anterior
  }

  function actualizarCondicion(id, nueva) {
    setCondiciones(cs => cs.map(c => c.id === id ? nueva : c))
  }
  function eliminarCondicion(id) {
    setCondiciones(cs => cs.filter(c => c.id !== id))
  }
  function agregarCondicion() {
    // Arranca sin columna seleccionada ('') para que el usuario elija
    // explícitamente — no hereda la columna de la primera condición.
    setCondiciones(cs => [...cs, nuevaCondicion('')])
  }

  function descargarCSV() {
    if (!csvBlob) return
    const url = URL.createObjectURL(csvBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `segmento-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Rastrea si el usuario aplicó al menos UNA vez filtros con condiciones
  // reales — el botón "Descargar segmento" solo aparece después de eso,
  // no ni bien se carga la base sin filtros configurados.
  const [segmentoCreado, setSegmentoCreado] = useState(false)
  const [condicionesAplicadas, setCondicionesAplicadas] = useState([])

  const headersParaSelectores = headers.length ? headers : []

  return (
    <div className="seg-root">

      {/* ── IDLE: carga del archivo ── */}
      {phase === 'idle' && (
        <>
          {/* Si ya hay un archivo cargado (viene de "Ajustar filtros"),
              mostrar barra de archivo. Si no, mostrar el dropzone hero. */}
          {fileRef.current ? (
            <div className="rb-filebar">
              <div className="rb-filebar-left">
                <div className="rb-filebar-icon"><FileText size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="rb-filebar-name">{fileName}</div>
                  <div className="rb-filebar-meta">{fmt(totalRows)} filas · {headers.length} columnas</div>
                </div>
              </div>
              <button className="rb-btn-ghost" onClick={reset}>Cambiar archivo</button>
            </div>
          ) : (
            <div>
              <div className="rb-hero">
                <h2>Segmentá tu base</h2>
                <p>Subí un CSV, configurá los filtros y descargá el resultado. Todo corre en tu equipo, sin subir nada a ningún servidor.</p>
              </div>
              {error && <div className="rb-error-banner">{error}</div>}
              <div
                className={`rb-dropzone ${dragging ? 'dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('seg-file-input').click()}
                role="button"
                tabIndex={0}
              >
                <div className="rb-dropzone-icon"><Upload size={26} /></div>
                <div className="rb-dropzone-title">Arrastrá tu archivo acá</div>
                <div className="rb-dropzone-sub">o <b>elegilo desde tu equipo</b> · .csv o .txt</div>
                <input id="seg-file-input" type="file" accept=".csv,.txt" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) processFile(e.target.files[0]) }} />
              </div>
            </div>
          )}

          {/* Panel de filtros — solo visible si hay un archivo cargado */}
          {fileRef.current && (
            <div className="seg-panel">
              <div className="seg-panel-header">
                <div className="seg-panel-titulo">
                  <Filter size={15} />
                  Condiciones de filtro
                </div>
                {condiciones.length > 1 && (
                  <div className="seg-toggle-operador">
                    <span className="seg-toggle-label">Combinar con</span>
                    <button type="button"
                      className={`seg-toggle-op${operadorGlobal === 'AND' ? ' activo' : ''}`}
                      onClick={() => setOperadorGlobal('AND')}
                      title="Todas las condiciones deben cumplirse">AND</button>
                    <button type="button"
                      className={`seg-toggle-op${operadorGlobal === 'OR' ? ' activo' : ''}`}
                      onClick={() => setOperadorGlobal('OR')}
                      title="Alcanza con que se cumpla una condición">OR</button>
                  </div>
                )}
              </div>
              <div className="seg-condiciones-lista">
                {condiciones.map(c => (
                  <FilaCondicion
                    key={c.id}
                    condicion={c}
                    headers={headersParaSelectores}
                    onChange={nueva => actualizarCondicion(c.id, nueva)}
                    onEliminar={() => eliminarCondicion(c.id)}
                    puedeEliminar={condiciones.length > 1}
                  />
                ))}
              </div>
              <div className="seg-panel-footer">
                <button type="button" className="seg-btn-agregar" onClick={agregarCondicion}>
                  <Plus size={14} /> Agregar condición
                </button>
                <button
                  type="button"
                  className="seg-btn-correr"
                  onClick={() => {
                    const condicionesValidas = condiciones.filter(c =>
                      c.columna && (SIN_VALOR.has(c.operador) || c.valor.trim() !== '')
                    )
                    if (condicionesValidas.length > 0) {
                      setSegmentoCreado(true)
                      setCondicionesAplicadas(condicionesValidas)
                    }
                    setPhase('processing')
                    setProgress(0)
                    setProgressTotal(0)
                    setProgressMatch(0)
                    setPreviewRows([])
                    setCsvBlob(null)
                    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null }
                    getWorker().postMessage({ type: 'segment', file: fileRef.current, condiciones: condicionesValidas, operadorGlobal })
                  }}
                >
                  <Filter size={14} /> Aplicar filtros
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── PROCESSING: barra de progreso estilo paso 1 ── */}
      {phase === 'processing' && (
        <div className="rb-processing">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div className="rb-spinner" />
            <div className="rb-processing-filename">{fileName}</div>
          </div>
          <div className="rb-processing-top">
            <div className="rb-processing-label">
              Filtrando en streaming…
              {progressTotal > 0 && <span style={{ color: 'var(--green-text)', marginLeft: 8 }}>
                {fmt(progressMatch)} coincidencias en {fmt(progressTotal)} filas leídas
              </span>}
            </div>
            <div className="rb-processing-pct">{progress}%</div>
          </div>
          <div className="rb-progress-track">
            <div className="rb-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="rb-processing-note">Procesando por bloques — no se sube nada a ningún servidor.</div>
        </div>
      )}

      {/* ── DONE: resultado ── */}
      {phase === 'done' && (
        <>
          <div className="rb-filebar">
            <div className="rb-filebar-left">
              <div className="rb-filebar-icon"><FileText size={18} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="rb-filebar-name">{fileName}</div>
                <div className="rb-filebar-meta">{fmt(totalRows)} filas en total · {headers.length} columnas</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="rb-btn-ghost" onClick={volverAFiltros}>
                {segmentoCreado ? 'Ajustar filtros' : 'Crear filtros'}
              </button>
              <button className="rb-btn-ghost" onClick={reset}>Cambiar archivo</button>
            </div>
          </div>

          <div className="seg-resultado-header">
            <div className="seg-resultado-stats">
              <span className="seg-resultado-count">
                {fmt(matchedRows)}
                <span className="seg-resultado-de"> de {fmt(totalRows)}</span>
              </span>
              <span className="seg-resultado-label">
                {segmentoCreado ? 'filas coinciden con los filtros' : 'filas cargadas — creá un filtro para segmentar'}
              </span>
            </div>
            {segmentoCreado && (
              <button type="button" className="seg-btn-descargar"
                onClick={descargarCSV} disabled={!csvBlob || matchedRows === 0}>
                <Download size={15} /> Descargar segmento
              </button>
            )}
          </div>

          {segmentoCreado && condicionesAplicadas.length > 0 && (
            <div className="seg-filtros-aplicados">
              <span className="seg-filtros-aplicados-label">
                Filtros aplicados
                {condicionesAplicadas.length > 1 && (
                  <span className="seg-filtros-aplicados-op">{operadorGlobal}</span>
                )}
              </span>
              <div className="seg-filtros-aplicados-chips">
                {condicionesAplicadas.map((c, i) => (
                  <span key={i} className="seg-filtro-chip">
                    <span className="seg-filtro-chip-col">{c.columna}</span>
                    <span className="seg-filtro-chip-op">{OPERADORES.find(o => o.value === c.operador)?.label ?? c.operador}</span>
                    {!SIN_VALOR.has(c.operador) && <span className="seg-filtro-chip-val">"{c.valor}"</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {matchedRows > 0
            ? <TablaPreview headers={headers} rows={previewRows} totalMatch={matchedRows} />
            : <div className="seg-sin-resultados">Ninguna fila coincide con las condiciones actuales.</div>
          }
        </>
      )}
    </div>
  )
}
