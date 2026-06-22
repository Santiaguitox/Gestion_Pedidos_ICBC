import { useState, useRef, useCallback } from 'react'
import { Upload, CheckCircle2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowRight, Download } from 'lucide-react'

function fmt(n) { return Number(n).toLocaleString('es-AR') }
function pct(n, total) { if (!total) return '0%'; return ((n / total) * 100).toFixed(1) + '%' }

function DropZone({ label, sub, onFile, dragging, setDragging, inputId, disabled }) {
  return (
    <div
      className={`rb-dropzone-plain ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={e => { if (!disabled) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); if (!disabled && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]) }}
      onClick={() => !disabled && document.getElementById(inputId).click()}
      role="button"
      tabIndex={0}
    >
      <div className="rb-dropzone-plain-icon"><Upload size={21} /></div>
      <div className="rb-dropzone-plain-title">{label}</div>
      <div className="rb-dropzone-plain-sub">{sub}</div>
      <input id={inputId} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]) }} />
    </div>
  )
}

function DownloadBox({ label, count, onClick, phase, featured }) {
  return (
    <div className={`rb-download-box ${featured ? 'featured' : ''}`}>
      <div>
        <div className="rb-download-num">{fmt(count)}</div>
        <div className="rb-download-sub">{label}</div>
      </div>
      {phase === 'idle' && (
        <button className={`rb-btn-download-sm ${featured ? 'featured' : ''}`} onClick={onClick}>
          <Download size={14} /> Descargar
        </button>
      )}
      {phase === 'generating' && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>generando…</span>}
      {phase === 'done' && <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green-text)', fontSize: 12 }}><CheckCircle2 size={14} /> Listo</span>}
    </div>
  )
}

export default function CompareTabBase() {
  const [stateA, setStateA] = useState('idle')
  const [stateB, setStateB] = useState('idle')
  const [progressA, setProgressA] = useState(0)
  const [progressB, setProgressB] = useState(0)
  const [fileNameA, setFileNameA] = useState('')
  const [fileNameB, setFileNameB] = useState('')
  const [infoA, setInfoA] = useState(null)
  const [infoB, setInfoB] = useState(null)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [draggingA, setDraggingA] = useState(false)
  const [draggingB, setDraggingB] = useState(false)

  const [dlNuevos, setDlNuevos] = useState('idle')
  const [dlMadre, setDlMadre] = useState('idle')
  const [dlPerdidos, setDlPerdidos] = useState('idle')

  // Diffs (solo contactos con cambios reales — se calculan una vez,
  // completos, y se paginan/filtran localmente sin volver a leer los
  // archivos)
  const [diffsPhase, setDiffsPhase] = useState('idle') // idle | choosing_mode | computing | done
  const [diffsProgress, setDiffsProgress] = useState(0)
  const [diffsMode, setDiffsMode] = useState(null) // 'fast' | 'safe', el que efectivamente se usó
  const [totalChanged, setTotalChanged] = useState(0)
  const [colChangeSorted, setColChangeSorted] = useState([])
  const [fieldFilter, setFieldFilter] = useState(null)
  const [diffsPage, setDiffsPage] = useState({ rows: [], page: 0, totalFiltered: 0 })
  const [diffsPageLoading, setDiffsPageLoading] = useState(false)
  const [expandedEmail, setExpandedEmail] = useState(null)
  const [showDiffs, setShowDiffs] = useState(false)
  const [rowPage, setRowPage] = useState(0)

  const workerRef = useRef(null)
  const fileNamesRef = useRef({ a: '', b: '' })

  const handleWorkerMsg = useCallback((e) => {
    const msg = e.data
    if (msg.type === 'progress_a') setProgressA(msg.progress)
    else if (msg.type === 'progress_b') setProgressB(msg.progress)
    else if (msg.type === 'loaded_a') { setInfoA(msg); setStateA('loaded') }
    else if (msg.type === 'loaded_b') { setInfoB(msg); setStateB('loaded') }
    else if (msg.type === 'stats_done') { setStats(msg.stats) }
    else if (msg.type === 'download_ready') {
      const { key, lines, headerLine } = msg
      const content = [headerLine, ...lines].join('\n')
      const which = key === 'perdidos' ? 'a' : 'b'
      const name = fileNamesRef.current[which]
      const ext = name.split('.').pop()
      const base = name.replace(/\.[^/.]+$/, '')
      const blob = new Blob([content], { type: 'text/plain;charset=windows-1252' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${base}_${key}.${ext}`
      a.click()
      URL.revokeObjectURL(a.href)
      if (key === 'nuevos') setDlNuevos('done')
      else if (key === 'madre') setDlMadre('done')
      else if (key === 'perdidos') setDlPerdidos('done')
    }
    else if (msg.type === 'diffs_progress') setDiffsProgress(msg.progress)
    else if (msg.type === 'diffs_done') {
      setTotalChanged(msg.totalChanged)
      setColChangeSorted(msg.colChangeSorted)
      setDiffsMode(msg.mode)
      setDiffsPhase('done')
      requestDiffsPage(0, null)
    }
    else if (msg.type === 'diffs_page_done') {
      setDiffsPage(msg)
      setDiffsPageLoading(false)
      setExpandedEmail(null)
    }
    else if (msg.type === 'error') {
      setError(msg.message)
      setStateA(s => s === 'loading' ? 'idle' : s)
      setStateB(s => s === 'loading' ? 'idle' : s)
      setDiffsPhase('idle')
      setDiffsPageLoading(false)
    }
  }, [])

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../../workers/compare.worker.js', import.meta.url), { type: 'module' })
    }
    workerRef.current.onmessage = handleWorkerMsg
    return workerRef.current
  }, [handleWorkerMsg])

  function loadFile(file, which) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'txt'].includes(ext)) { setError('Solo .csv o .txt'); return }
    setError(null)
    fileNamesRef.current[which] = file.name
    if (which === 'a') { setFileNameA(file.name); setStateA('loading'); setProgressA(0); setStats(null); setDiffsPhase('idle') }
    else { setFileNameB(file.name); setStateB('loading'); setProgressB(0); setStats(null); setDiffsPhase('idle') }
    getWorker().postMessage({ type: `load_${which}`, file })
  }

  function runStats() {
    setStats(null); setDiffsPhase('idle'); setShowDiffs(false)
    setDlNuevos('idle'); setDlMadre('idle'); setDlPerdidos('idle')
    getWorker().postMessage({ type: 'compare_stats' })
  }

  // Si cualquiera de las 2 bases es grande, se le pregunta al usuario
  // qué modo prefiere antes de arrancar — en vez de decidir por él. Si
  // ninguna es grande, se va directo a modo rápido (el de siempre, sin
  // fricción para el caso común).
  const needsModeChoice = infoA?.suggestSafeMode || infoB?.suggestSafeMode

  function startComputeDiffs() {
    if (needsModeChoice) {
      setDiffsPhase('choosing_mode')
    } else {
      runComputeDiffs('fast')
    }
  }

  function runComputeDiffs(mode) {
    setDiffsPhase('computing')
    setDiffsProgress(0)
    setFieldFilter(null)
    setDiffsMode(mode)
    getWorker().postMessage({ type: 'compute_diffs', mode })
  }

  function requestDiffsPage(page, filter) {
    setDiffsPageLoading(true)
    setRowPage(page)
    getWorker().postMessage({ type: 'get_diffs_page', page, pageSize: PAGE_SIZE, fieldFilter: filter })
  }

  function toggleFieldFilter(col) {
    const next = fieldFilter === col ? null : col
    setFieldFilter(next)
    requestDiffsPage(0, next)
  }

  const canCompare = stateA === 'loaded' && stateB === 'loaded'
  const PAGE_SIZE = 100
  const totalRowPages = Math.ceil(diffsPage.totalFiltered / PAGE_SIZE)

  return (
    <div>
      <div className="rb-hero">
        <h2>Comparar bases</h2>
        <p>Cargá la base actual (A) y la nueva (B) para ver qué cambió.</p>
      </div>

      {error && <div className="rb-error-banner">{error}</div>}

      <div className="rb-compare-grid">
        <div>
          <div className="rb-compare-col-label">Base A · actual</div>
          {stateA === 'idle' && <DropZone label="Arrastrá la base A" sub=".csv o .txt" onFile={f => loadFile(f, 'a')} dragging={draggingA} setDragging={setDraggingA} inputId="rb-cmp-a" />}
          {stateA === 'loading' && (
            <div className="rb-compare-loaded">
              <div className="rb-compare-loaded-name">{fileNameA}</div>
              <div className="rb-progress-track" style={{ margin: '8px 0' }}><div className="rb-progress-fill" style={{ width: `${progressA}%`, background: 'var(--text-muted)' }} /></div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{progressA}%</div>
            </div>
          )}
          {stateA === 'loaded' && (
            <div className="rb-compare-loaded">
              <div className="rb-compare-loaded-name">{fileNameA}</div>
              <div className="rb-compare-loaded-stats"><span><b>{fmt(infoA.totalRows)}</b> filas</span><span><b>{fmt(infoA.uniqueEmails)}</b> emails únicos</span><span>{infoA.sizeMb} MB</span></div>
              <button className="rb-btn-change" onClick={() => { setStateA('idle'); setInfoA(null); setStats(null); setDiffsPhase('idle') }}>cambiar</button>
            </div>
          )}
        </div>

        <div>
          <div className="rb-compare-col-label">Base B · nueva</div>
          {stateB === 'idle' && <DropZone label="Arrastrá la base B" sub=".csv o .txt" onFile={f => loadFile(f, 'b')} dragging={draggingB} setDragging={setDraggingB} inputId="rb-cmp-b" disabled={stateA !== 'loaded'} />}
          {stateB === 'loading' && (
            <div className="rb-compare-loaded">
              <div className="rb-compare-loaded-name">{fileNameB}</div>
              <div className="rb-progress-track" style={{ margin: '8px 0' }}><div className="rb-progress-fill" style={{ width: `${progressB}%` }} /></div>
              <div style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>{progressB}%</div>
            </div>
          )}
          {stateB === 'loaded' && (
            <div className="rb-compare-loaded">
              <div className="rb-compare-loaded-name">{fileNameB}</div>
              <div className="rb-compare-loaded-stats"><span><b>{fmt(infoB.totalRows)}</b> filas</span><span><b>{fmt(infoB.uniqueEmails)}</b> emails únicos</span><span>{infoB.sizeMb} MB</span></div>
              <button className="rb-btn-change" onClick={() => { setStateB('idle'); setInfoB(null); setStats(null); setDiffsPhase('idle') }}>cambiar</button>
            </div>
          )}
        </div>
      </div>

      {canCompare && !stats && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button className="rb-btn-compare" onClick={runStats}>Comparar bases <ArrowRight size={16} /></button>
        </div>
      )}

      {stats && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="rb-section-label" style={{ marginTop: '26px' }}>Resumen</div>
          <div className="rb-compare-summary-grid">
            <div className="rb-stat-box plain"><div className="rb-stat-num">{fmt(stats.uniqueA)}</div><div className="rb-stat-label">únicos en A</div></div>
            <div className="rb-stat-box plain"><div className="rb-stat-num">{fmt(stats.uniqueB)}</div><div className="rb-stat-label">únicos en B</div></div>
            <div className="rb-stat-box plain"><div className="rb-stat-num" style={{ color: 'var(--green-text)' }}>{fmt(stats.nuevosCount)}</div><div className="rb-stat-label">nuevos en B</div></div>
            <div className="rb-stat-box plain"><div className="rb-stat-num" style={{ color: 'var(--accent-primary)' }}>{fmt(stats.perdidosCount)}</div><div className="rb-stat-label">perdidos de A</div></div>
          </div>

          <div className="rb-madre-box">
            <div><span className="rb-madre-num">{fmt(stats.madreCount)}</span> <span className="rb-madre-label">contactos en ambas bases (base madre)</span></div>
            <span className="rb-madre-pct">{pct(stats.madreCount, stats.uniqueA)} de la base actual</span>
          </div>

          <div className="rb-section-label" style={{ marginTop: '24px' }}>Descargas</div>
          <div className="rb-downloads-grid">
            <DownloadBox label="nuevos (en B, no en A)" count={stats.nuevosCount} onClick={() => { setDlNuevos('generating'); getWorker().postMessage({ type: 'download_nuevos' }) }} phase={dlNuevos} />
            <DownloadBox label="base madre (en A y B)" count={stats.madreCount} onClick={() => { setDlMadre('generating'); getWorker().postMessage({ type: 'download_madre' }) }} phase={dlMadre} featured />
            <DownloadBox label="perdidos (en A, no en B)" count={stats.perdidosCount} onClick={() => { setDlPerdidos('generating'); getWorker().postMessage({ type: 'download_perdidos' }) }} phase={dlPerdidos} />
          </div>

          {/* CAMBIOS CAMPO A CAMPO */}
          <div className="rb-diff-panel">
            <button
              className="rb-diff-head"
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onClick={() => {
                if (!showDiffs) { setShowDiffs(true); if (diffsPhase === 'idle') startComputeDiffs() }
                else setShowDiffs(false)
              }}
            >
              <span className="rb-diff-badge">datos</span>
              <span className="rb-diff-title">Cambios campo a campo en la base madre</span>
              <span className="rb-diff-meta">
                {diffsPhase === 'done' ? `${fmt(totalChanged)} contactos con cambios de ${fmt(stats.madreCount)}` : `${fmt(stats.madreCount)} contactos`}
              </span>
              <span className={`rb-chevron ${showDiffs ? 'open' : ''}`}><ChevronDown size={18} /></span>
            </button>

            {showDiffs && (
              <>
                {diffsPhase === 'choosing_mode' && (
                  <div style={{ padding: '20px 18px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
                      {(() => {
                        const grandeA = infoA?.suggestSafeMode
                        const grandeB = infoB?.suggestSafeMode
                        const cual = grandeA && grandeB ? 'Las dos bases son'
                          : grandeA ? `La base A (${fmt(infoA.sizeMb)} MB) es`
                          : `La base B (${fmt(infoB.sizeMb)} MB) es`
                        return `${cual} bastante pesada. Elegí cómo calcular los cambios campo a campo:`
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <button
                        className="rb-btn-ghost"
                        style={{ flex: '1 1 200px', flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '14px 16px', gap: 4 }}
                        onClick={() => runComputeDiffs('fast')}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Modo rápido</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'normal', textAlign: 'left' }}>
                          El más veloz de los dos. Con bases muy pesadas como esta, existe el riesgo de que el navegador se quede sin memoria y se cierre la pestaña — si pasa, solo hay que volver a entrar y cargar las bases otra vez, no se pierde nada guardado.
                        </span>
                      </button>
                      <button
                        className="rb-btn-ghost"
                        style={{ flex: '1 1 200px', flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '14px 16px', gap: 4, borderColor: 'var(--accent-primary)' }}
                        onClick={() => runComputeDiffs('safe')}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Modo seguro</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'normal', textAlign: 'left' }}>
                          Puede tardar notablemente más (varios minutos con bases grandes), pero nunca se queda sin memoria — la opción recomendada si no tenés apuro.
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {diffsPhase === 'computing' && (
                  <div style={{ padding: '24px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Comparando campo a campo{diffsMode === 'safe' ? ' (modo seguro)' : ' (modo rápido)'}…
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)' }}>{diffsProgress}%</span>
                    </div>
                    <div className="rb-progress-track"><div className="rb-progress-fill" style={{ width: `${diffsProgress}%` }} /></div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>Recorriendo {fmt(stats.madreCount)} contactos en común.</div>
                  </div>
                )}

                {diffsPhase === 'done' && (
                  <>
                    {totalChanged === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green-text)', fontSize: 14, padding: '18px' }}>
                        <CheckCircle2 size={18} /> Sin cambios entre ambas bases.
                      </div>
                    ) : (
                      <>
                        {colChangeSorted?.length > 0 && (
                          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>campos que cambiaron — click para filtrar:</span>
                            {colChangeSorted.map(([col, count]) => (
                              <button
                                key={col}
                                className="rb-diff-badge"
                                onClick={() => toggleFieldFilter(col)}
                                style={{
                                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                  color: fieldFilter === col ? '#fff' : 'var(--yellow-text)',
                                  background: fieldFilter === col ? 'var(--yellow-text)' : 'var(--yellow-bg)',
                                }}
                              >
                                {col} ({fmt(count)})
                              </button>
                            ))}
                            {fieldFilter && (
                              <button className="rb-btn-ghost" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => toggleFieldFilter(fieldFilter)}>
                                quitar filtro
                              </button>
                            )}
                          </div>
                        )}

                        <div className="rb-diff-table-head"><div>Email</div><div>Campos cambiados</div><div></div></div>

                        {diffsPageLoading && (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                            Cargando…
                          </div>
                        )}

                        {!diffsPageLoading && diffsPage.rows.map((r) => (
                          <div key={r.email}>
                            <button
                              className="rb-diff-row"
                              onClick={() => setExpandedEmail(expandedEmail === r.email ? null : r.email)}
                            >
                              <div className="rb-diff-email">{r.email}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.diffs.map(d => d.col).join(', ')}</div>
                              <div style={{ color: 'var(--border-strong)', display: 'flex', justifyContent: 'flex-end' }}>
                                {expandedEmail === r.email ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </button>
                            {expandedEmail === r.email && (
                              <div className="rb-diff-detail">
                                <div className="rb-diff-fields">
                                  <div className="rb-diff-fields-head"><div>Campo</div><div>Valor en A</div><div>Valor en B</div></div>
                                  {r.diffs.map((d, j) => (
                                    <div key={j} className="rb-diff-fields-row changed">
                                      <div className="rb-diff-field-key">{d.col}</div>
                                      <div className="rb-diff-field-val-old">{d.valA || '—'}</div>
                                      <div className="rb-diff-field-val-new">{d.valB || '—'}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {totalRowPages > 1 && (
                          <div className="rb-detail-pagination" style={{ padding: '14px 0' }}>
                            <button className="rb-page-btn" disabled={rowPage === 0 || diffsPageLoading} onClick={() => requestDiffsPage(rowPage - 1, fieldFilter)}><ChevronLeft size={16} /></button>
                            <span className="rb-page-label">pág {rowPage + 1} / {totalRowPages}</span>
                            <button className="rb-page-btn" disabled={rowPage >= totalRowPages - 1 || diffsPageLoading} onClick={() => requestDiffsPage(rowPage + 1, fieldFilter)}><ChevronRight size={16} /></button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
