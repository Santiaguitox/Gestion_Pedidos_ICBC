import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState, useRef, useCallback } from 'react'
import '@/styles/RevisionBase.css'
import CompareTabBase from '@/components/revision-base/CompareTabBase'
import SegmentarTabBase from '@/components/revision-base/SegmentarTabBase'
import {
  Mail, Copy, Trash2, SpellCheck, UserX, ShieldAlert,
  Upload, Download, CheckCircle2, AlertCircle, ChevronDown,
  ChevronLeft, ChevronRight, FileText,
} from 'lucide-react'

function fmt(n) {
  return Number(n).toLocaleString('es-AR')
}

function pct(n, total) {
  if (!total) return '0%'
  return ((n / total) * 100).toFixed(1) + '%'
}

// Checks de la pestaña Analizar (estado idle) — cada uno con su propio
// color de ícono, igual que el diseño de referencia (no todos en --accent).
const CHECKS = [
  { Icon: Mail, title: 'Formato de emails', sub: 'Regex + reglas RFC', tone: 'red' },
  { Icon: Copy, title: 'Duplicados', sub: 'Detección exacta en streaming', tone: 'violet' },
  { Icon: Trash2, title: 'Dominios desechables', sub: '25+ dominios conocidos', tone: 'amber' },
  { Icon: SpellCheck, title: 'Typos de dominio', sub: 'gmial, hotmial, yaho…', tone: 'green' },
  { Icon: UserX, title: 'Nombres inválidos', sub: 'Vacíos, genéricos, raros', tone: 'blue' },
  { Icon: ShieldAlert, title: 'TLDs sospechosos', sub: '.xyz, .top, .click, .loan…', tone: 'red' },
]

const TONE_STYLES = {
  red: { background: 'var(--red-bg)', color: 'var(--accent-primary)' },
  violet: { background: 'var(--badge-bg)', color: 'var(--icomm-violet)' },
  amber: { background: 'var(--yellow-bg)', color: 'var(--yellow-text)' },
  green: { background: 'var(--green-bg)', color: 'var(--green-text)' },
  blue: { background: 'var(--badge-bg)', color: 'var(--icomm-blue)' },
}


// A nivel de módulo: no toca estado del componente (recibe todo por
// parámetro) y así el analizador de react-hooks deja de marcar que se
// usa "antes de declararse" dentro del callback del worker — como
// function declaration ya estaba hoisted y funcionaba, pero mejor que
// ni haga falta el hoisting.
function downloadBlob(content, originalFileName, suffix) {
  const ext = originalFileName.split('.').pop()
  const baseName = originalFileName.replace(/\.[^/.]+$/, '')
  const blob = new Blob([content], { type: 'text/plain;charset=windows-1252' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${baseName}_${suffix}.${ext}`
  a.click()
  // Revocar con un pequeño delay en vez de inmediatamente después del
  // click — en Firefox específicamente, revocar la URL al toque puede
  // hacer que la descarga ni siquiera aparezca (el navegador todavía
  // no terminó de procesarla). Un timeout corto da margen sin
  // necesitar nada más complejo como escuchar el evento de descarga.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function RevisionBase() {
  useDocumentTitle('Revisión BBDD')

  const [tab, setTab] = useState('analizar')

  // ANALYZE
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [stats, setStats] = useState(null)
  const [issueRowsByCode, setIssueRowsByCode] = useState({})
  const [issueSummary, setIssueSummary] = useState({})
  // El getter dejó de usarse cuando la tabla de headers pasó al worker;
  // el setter sigue recibiendo el dato del parseo por si vuelve a UI.
  const [, setHeaders] = useState([])
  const [emailCol, setEmailCol] = useState(null)
  const [activeCode, setActiveCode] = useState(null)
  const [detailPage, setDetailPage] = useState(0)
  const [cleanCount, setCleanCount] = useState(0)
  const [removedCount, setRemovedCount] = useState(0)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  // CLEAN GENERATE
  const [cleanPhase, setCleanPhase] = useState('idle')
  const [cleanProgress, setCleanProgress] = useState(0)

  // REMOVED GENERATE
  const [removedPhase, setRemovedPhase] = useState('idle')
  const [removedProgress, setRemovedProgress] = useState(0)

  // VERIFY
  const [verifyPhase, setVerifyPhase] = useState('idle')
  const [verifyProgress, setVerifyProgress] = useState(0)
  const [verifyFileName, setVerifyFileName] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [verifyDragging, setVerifyDragging] = useState(false)
  const [verifyError, setVerifyError] = useState(null)

  const workerRef = useRef(null)
  const fileNameRef = useRef('')
  const DETAIL_PAGE_SIZE = 100

  const setupWorkerListeners = useCallback((worker) => {
    worker.onmessage = (e) => {
      const msg = e.data

      if (msg.type === 'progress') {
        setProgress(msg.progress)
      } else if (msg.type === 'headers') {
        setHeaders(msg.headers)
        setEmailCol(msg.emailCol)
      } else if (msg.type === 'done') {
        setStats({ total: msg.totalRows, errors: msg.errorRows, warnings: msg.warnRows, valid: msg.validRows })
        setIssueRowsByCode(msg.issueRowsByCode)
        setIssueSummary(msg.issueSummary)
        setHeaders(msg.headers)
        setEmailCol(msg.emailCol)
        setCleanCount(msg.cleanCount)
        setRemovedCount(msg.removedCount)
        setPhase('done')

      } else if (msg.type === 'clean_progress') {
        setCleanProgress(msg.progress)
      } else if (msg.type === 'clean_done') {
        setCleanProgress(100)
        downloadBlob(msg.cleanLines.join('\n'), fileNameRef.current, 'limpio')
        setCleanCount(msg.cleanCount)
        setCleanPhase('done')

      } else if (msg.type === 'removed_progress') {
        setRemovedProgress(msg.progress)
      } else if (msg.type === 'removed_done') {
        setRemovedProgress(100)
        downloadBlob(msg.removedLines.join('\n'), fileNameRef.current, 'eliminados')
        setRemovedPhase('done')

      } else if (msg.type === 'verify_progress') {
        setVerifyProgress(msg.progress)
      } else if (msg.type === 'verify_done') {
        setVerifyResult(msg)
        setVerifyPhase('done')

      } else if (msg.type === 'error') {
        setError('Error: ' + msg.message)
        setPhase('idle')
        setCleanPhase('idle')
        setRemovedPhase('idle')
        setVerifyPhase('idle')
      }
    }
  }, [])

  // El listener se configura UNA sola vez, en el momento en que el
  // worker se crea — antes se volvía a llamar setupWorkerListeners()
  // antes de cada acción (processFile, handleGenerateClean, etc.), lo
  // cual no rompía nada (worker.onmessage se reasigna sin problema),
  // pero era confuso y redundante. getWorker ya hacía lazy-init del
  // worker en sí; ahora también deja el listener listo en ese mismo
  // momento, así el resto del código solo necesita pedir el worker y
  // mandarle mensajes, sin preocuparse de "engancharlo" cada vez.
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/validator.worker.js', import.meta.url), { type: 'module' })
      setupWorkerListeners(workerRef.current)
    }
    return workerRef.current
  }, [setupWorkerListeners])


  const processFile = useCallback((file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'txt'].includes(ext)) { setError('Solo .csv o .txt'); return }
    setError(null)
    setFileName(file.name)
    fileNameRef.current = file.name
    setPhase('processing')
    setProgress(0)
    setCleanPhase('idle')
    setCleanProgress(0)
    setRemovedPhase('idle')
    setRemovedProgress(0)
    setVerifyPhase('idle')
    setVerifyResult(null)
    setActiveCode(null)

    const worker = getWorker()
    worker.postMessage({ type: 'analyze', file })
  }, [getWorker])

  const handleGenerateClean = () => {
    if (!workerRef.current) return
    setCleanPhase('generating')
    setCleanProgress(0)
    workerRef.current.postMessage({ type: 'generate_clean' })
  }

  const handleGenerateRemoved = () => {
    if (!workerRef.current) return
    setRemovedPhase('generating')
    setRemovedProgress(0)
    workerRef.current.postMessage({ type: 'generate_removed' })
  }

  const processVerifyFile = useCallback((file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'txt'].includes(ext)) { setVerifyError('Solo .csv o .txt'); return }
    if (!workerRef.current) { setVerifyError('Primero analizá la base original'); return }
    setVerifyError(null)
    setVerifyFileName(file.name)
    setVerifyPhase('processing')
    setVerifyProgress(0)
    setVerifyResult(null)
    workerRef.current.postMessage({ type: 'verify', file })
  }, [])

  const reset = () => {
    setPhase('idle'); setStats(null); setIssueRowsByCode({}); setIssueSummary({})
    setHeaders([]); setProgress(0); setError(null); setActiveCode(null)
    setCleanPhase('idle'); setCleanProgress(0)
    setRemovedPhase('idle'); setRemovedProgress(0)
    setVerifyPhase('idle'); setVerifyResult(null)
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]; if (file) processFile(file)
  }, [processFile])

  const onVerifyDrop = useCallback((e) => {
    e.preventDefault(); setVerifyDragging(false)
    const file = e.dataTransfer.files[0]; if (file) processVerifyFile(file)
  }, [processVerifyFile])

  const detailRows = activeCode ? (issueRowsByCode[activeCode] || []) : []
  const paginatedDetail = detailRows.slice(detailPage * DETAIL_PAGE_SIZE, (detailPage + 1) * DETAIL_PAGE_SIZE)
  const totalDetailPages = Math.ceil(detailRows.length / DETAIL_PAGE_SIZE)
  const baseAnalyzed = phase === 'done'

  const STEPS = [
    { id: 'analizar',   label: 'Analizar',  num: '1' },
    { id: 'verificar',  label: 'Verificar', num: '2', disabled: !baseAnalyzed },
    { id: 'comparar',   label: 'Comparar',  num: '3' },
    { id: 'segmentar',  label: 'Segmentar', num: '4' },
  ]

  return (
    <div className="page-root rb-root">

      {/* Header — título + subtítulo, mismo patrón que el resto de páginas */}
      <h1 className="page-title">Revisión de base de datos</h1>
      <p className="page-subtitle" style={{ maxWidth: 560 }}>
        Asegurá que tu base esté limpia antes de enviar. Validá, verificá y compará — sin que un solo contacto salga de tu equipo.
      </p>

      {/* Pasos guiados, numerados y conectados */}
      <div className="rb-steps">
        {STEPS.map((s, i) => {
          const active = tab === s.id
          return (
            <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="rb-step-btn"
                disabled={s.disabled}
                onClick={() => !s.disabled && setTab(s.id)}
              >
                <span className={`rb-step-circle ${active ? 'active' : ''} ${s.disabled ? 'disabled' : ''}`}>{s.num}</span>
                <span className={`rb-step-label ${active ? 'active' : ''}`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="rb-step-connector" />}
            </span>
          )
        })}
      </div>

      {tab === 'analizar' && (
        <>
          {phase === 'idle' && (
            <div>
              <div className="rb-hero">
                <h2>¿Tu base está lista para enviar?</h2>
                <p>Subí el archivo y la herramienta corre 6 chequeos en streaming, sin enviar nada a ningún servidor.</p>
              </div>
              {error && <div className="rb-error-banner">{error}</div>}
              <div
                className={`rb-dropzone ${dragging ? 'dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('rb-file-input').click()}
                role="button"
                tabIndex={0}
              >
                <div className="rb-dropzone-icon"><Upload size={26} /></div>
                <div className="rb-dropzone-title">Arrastrá tu archivo acá</div>
                <div className="rb-dropzone-sub">o <b>elegilo desde tu equipo</b> · .csv o .txt</div>
                <input id="rb-file-input" type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) processFile(e.target.files[0]) }} />
              </div>
              <div className="rb-checks-grid">
                {CHECKS.map(({ Icon, title, sub, tone }) => (
                  <div key={title} className="rb-check-card">
                    <span className="rb-check-icon" style={TONE_STYLES[tone]}><Icon size={19} /></span>
                    <div className="rb-check-title">{title}</div>
                    <div className="rb-check-sub">{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === 'processing' && (
            <div className="rb-processing">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                <div className="rb-spinner" />
                <div className="rb-processing-filename">{fileName}</div>
              </div>
              <div className="rb-processing-top">
                <div className="rb-processing-label">Procesando en streaming…</div>
                <div className="rb-processing-pct">{progress}%</div>
              </div>
              <div className="rb-progress-track"><div className="rb-progress-fill" style={{ width: `${progress}%` }} /></div>
              <div className="rb-processing-note">Leyendo por bloques — no se sube nada a ningún servidor.</div>
            </div>
          )}

          {phase === 'done' && stats && (
            <div>
              {/* file bar */}
              <div className="rb-filebar">
                <div className="rb-filebar-left">
                  <div className="rb-filebar-icon"><FileText size={18} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="rb-filebar-name">{fileName}</div>
                    <div className="rb-filebar-meta">Analizada · {fmt(stats.total)} contactos</div>
                  </div>
                </div>
                <button className="rb-btn-ghost" onClick={reset}>Analizar otra base</button>
              </div>

              {/* stat boxes con tono de color */}
              <div className="rb-stats-grid">
                <div className="rb-stat-box">
                  <div className="rb-stat-head"><span className="rb-stat-head-label">Total contactos</span></div>
                  <div className="rb-stat-num">{fmt(stats.total)}</div>
                </div>
                <div className="rb-stat-box tone-ok">
                  <div className="rb-stat-head">
                    <span className="rb-stat-head-label">Sin problemas</span>
                    <span className="rb-stat-badge" style={{ background: 'var(--green-text)' }}><CheckCircle2 size={15} /></span>
                  </div>
                  <div className="rb-stat-num">{fmt(stats.valid)} <small>· {pct(stats.valid, stats.total)}</small></div>
                </div>
                <div className="rb-stat-box tone-err">
                  <div className="rb-stat-head">
                    <span className="rb-stat-head-label">Con errores</span>
                    <span className="rb-stat-badge" style={{ background: 'var(--accent-primary)' }}><AlertCircle size={15} /></span>
                  </div>
                  <div className="rb-stat-num">{fmt(stats.errors)} <small>· {pct(stats.errors, stats.total)}</small></div>
                </div>
                <div className="rb-stat-box tone-warn">
                  <div className="rb-stat-head">
                    <span className="rb-stat-head-label">Advertencias</span>
                    <span className="rb-stat-badge" style={{ background: 'var(--yellow-text)' }}><AlertCircle size={15} /></span>
                  </div>
                  <div className="rb-stat-num">{fmt(stats.warnings)} <small>· {pct(stats.warnings, stats.total)}</small></div>
                </div>
              </div>

              {/* export boxes */}
              <div className="rb-export-grid">
                <div className="rb-export-box">
                  <div>
                    <div><span className="rb-export-count">{fmt(cleanCount)}</span> <span className="rb-export-label">contactos depurados</span></div>
                    <div className="rb-export-sub">Base lista para enviar</div>
                  </div>
                  {cleanPhase === 'idle' && (
                    <button className="rb-btn-export" onClick={handleGenerateClean}>
                      <Download size={15} /> Generar base depurada
                    </button>
                  )}
                  {cleanPhase === 'generating' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 160 }}>
                      <div className="rb-progress-track" style={{ flex: 1 }}><div className="rb-progress-fill" style={{ width: `${cleanProgress}%` }} /></div>
                      <span style={{ fontSize: 12 }}>{cleanProgress}%</span>
                    </div>
                  )}
                  {cleanPhase === 'done' && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green-text)', fontSize: 13 }}><CheckCircle2 size={15} /> Descargado</div>}
                </div>

                <div className="rb-export-box danger">
                  <div>
                    <div><span className="rb-export-count">{fmt(removedCount)}</span> <span className="rb-export-label">contactos eliminados</span></div>
                    <div className="rb-export-sub">Con errores, fuera de la base</div>
                  </div>
                  {removedPhase === 'idle' && (
                    <button className="rb-btn-export outline" onClick={handleGenerateRemoved}>
                      <Download size={15} /> Generar base eliminados
                    </button>
                  )}
                  {removedPhase === 'generating' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 160 }}>
                      <div className="rb-progress-track" style={{ flex: 1 }}><div className="rb-progress-fill" style={{ width: `${removedProgress}%` }} /></div>
                      <span style={{ fontSize: 12 }}>{removedProgress}%</span>
                    </div>
                  )}
                  {removedPhase === 'done' && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green-text)', fontSize: 13 }}><CheckCircle2 size={15} /> Descargado</div>}
                </div>
              </div>

              {!emailCol && (
                <div className="rb-error-banner" style={{ background: 'var(--yellow-bg)', borderColor: 'var(--yellow-border)', color: 'var(--yellow-text)' }}>
                  No se detectó columna de email.
                </div>
              )}

              {/* resumen de problemas — cards con borde de color */}
              <div className="rb-section-label">Qué encontramos</div>
              <div className="rb-problems">
                {Object.entries(issueSummary)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([code, { type, msg, count }]) => {
                    const open = activeCode === code
                    return (
                      <div key={code} className="rb-problem-card">
                        <button
                          className={`rb-problem-head sev-${type}`}
                          onClick={() => { if (open) { setActiveCode(null) } else { setActiveCode(code); setDetailPage(0) } }}
                        >
                          <div style={{ flex: 1 }}>
                            <div className="rb-problem-name">{msg}</div>
                          </div>
                          <span className="rb-problem-count">{fmt(count)}</span>
                          <span className="rb-problem-count-label">filas</span>
                          <span className={`rb-chevron ${open ? 'open' : ''}`}><ChevronDown size={18} /></span>
                        </button>
                        <div className={`acordeon-anim${open ? ' abierto' : ''}`}>
                        <div className="acordeon-anim-clip">
                          <div className="rb-problem-detail">
                            <div className="rb-problem-detail-shown">{fmt(detailRows.length)} filas mostradas{count > detailRows.length ? ` de ${fmt(count)} totales` : ''}</div>
                            <div className="rb-table-wrap">
                              <div className="rb-table-head"><div>Fila</div><div>Email</div><div>Detalle</div></div>
                              <div className="rb-table-body">
                                {paginatedDetail.map((r, i) => (
                                  <div key={i} className="rb-table-row">
                                    <div className="rb-table-row-num">{r.rowNum}</div>
                                    <div className="rb-table-row-email">{r.email || '—'}</div>
                                    <div className="rb-table-row-detail">{r.msg}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {totalDetailPages > 1 && (
                              <div className="rb-detail-pagination">
                                <button className="rb-page-btn" disabled={detailPage === 0} onClick={() => setDetailPage(p => p - 1)}><ChevronLeft size={16} /></button>
                                <span className="rb-page-label">Página {detailPage + 1} de {totalDetailPages}</span>
                                <button className="rb-page-btn" disabled={detailPage >= totalDetailPages - 1} onClick={() => setDetailPage(p => p + 1)}><ChevronRight size={16} /></button>
                              </div>
                            )}
                          </div>
                        </div>
                        </div>
                      </div>
                    )
                  })}
                {Object.keys(issueSummary).length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green-text)', fontSize: 14, padding: '16px 0' }}>
                    <CheckCircle2 size={18} /> Base impecable.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'verificar' && (
        <div>
          {!baseAnalyzed ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '2rem 0' }}>
              Primero analizá la base original en la pestaña <strong>Analizar</strong>.
            </div>
          ) : (
            <>
              <div className="rb-hero">
                <h2>Verificar base depurada</h2>
                <p>Subí la base depurada para validar que esté correcta respecto a <mark>{fileName}</mark></p>
              </div>

              {verifyPhase === 'idle' && (
                <>
                  {verifyError && <div className="rb-error-banner">{verifyError}</div>}
                  <div
                    className={`rb-dropzone-plain large ${verifyDragging ? 'dragging' : ''}`}
                    onDragOver={e => { e.preventDefault(); setVerifyDragging(true) }}
                    onDragLeave={() => setVerifyDragging(false)}
                    onDrop={onVerifyDrop}
                    onClick={() => document.getElementById('rb-verify-input').click()}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="rb-dropzone-plain-icon"><Upload size={23} /></div>
                    <div className="rb-dropzone-plain-title">Arrastrá la base depurada acá</div>
                    <div className="rb-dropzone-plain-sub">.csv o .txt</div>
                    <input id="rb-verify-input" type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) processVerifyFile(e.target.files[0]) }} />
                  </div>
                </>
              )}

              {verifyPhase === 'processing' && (
                <div className="rb-processing">
                  <div className="rb-processing-top">
                    <div className="rb-processing-label">Verificando…</div>
                    <div className="rb-processing-pct">{verifyProgress}%</div>
                  </div>
                  <div className="rb-progress-track"><div className="rb-progress-fill" style={{ width: `${verifyProgress}%` }} /></div>
                </div>
              )}

              {verifyPhase === 'done' && verifyResult && (
                <div>
                  <div className="rb-filebar">
                    <div className="rb-filebar-name">{verifyFileName}</div>
                    <button className="rb-btn-ghost" onClick={() => { setVerifyPhase('idle'); setVerifyResult(null) }}><ChevronLeft size={14} /> Verificar otro archivo</button>
                  </div>

                  <div className="rb-verify-stats">
                    <div className="rb-verify-stat-row">
                      <span>Contactos en base original</span>
                      <span className="rb-verify-stat-val">{fmt(verifyResult.originalTotal)}</span>
                    </div>
                    <div className="rb-verify-stat-row">
                      <span>Contactos esperados en depurada</span>
                      <span className="rb-verify-stat-val">{fmt(verifyResult.expectedCleanCount)}</span>
                    </div>
                    <div className="rb-verify-stat-row">
                      <span>Contactos en archivo subido</span>
                      <span className="rb-verify-stat-val">{fmt(verifyResult.totalRows)}</span>
                    </div>
                    <div className={`rb-verify-stat-row ${verifyResult.totalRows === verifyResult.expectedCleanCount ? 'ok' : 'warn'}`}>
                      <span>¿Coincide el total?</span>
                      <span className="rb-verify-stat-val">
                        {verifyResult.totalRows === verifyResult.expectedCleanCount
                          ? <><CheckCircle2 size={16} /> Sí</>
                          : <><AlertCircle size={16} /> Diferencia de {fmt(Math.abs(verifyResult.totalRows - verifyResult.expectedCleanCount))}</>}
                      </span>
                    </div>
                  </div>

                  <VerifyCheck title="Emails no presentes en la base original" items={verifyResult.notInOriginal} total={verifyResult.notInOriginal.length} rowsLimit={verifyResult.rowsLimit} okMsg="Todos los emails de la base subida pertenecen a la base original." renderItem={r => `fila ${r.rowNum} — ${r.email}`} />
                  <VerifyCheck title="Duplicados dentro de la base depurada" items={verifyResult.duplicatesInClean} total={verifyResult.duplicatesInClean.length} rowsLimit={verifyResult.rowsLimit} okMsg="Sin duplicados." renderItem={r => `fila ${r.rowNum} — ${r.email} (primera vez: fila ${r.firstRow})`} />
                  <VerifyCheck title="Contactos que deberían estar y no están" items={verifyResult.missingFromClean} total={verifyResult.missingFromClean.length} rowsLimit={verifyResult.rowsLimit} okMsg="No faltan contactos." renderItem={email => email} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'comparar' && <CompareTabBase />}

      {tab === 'segmentar' && <SegmentarTabBase />}

    </div>
  )
}

function VerifyCheck({ title, items, total, okMsg, renderItem, rowsLimit }) {
  const [open, setOpen] = useState(false)
  const hasIssues = total > 0
  // 'more' ya se calculaba antes pero nunca se mostraba en ningún lado
  // — solo tiene sentido un valor positivo cuando el worker realmente
  // cortó la lista en rowsLimit (si total < rowsLimit, items ya tiene
  // todo, more sería 0 o negativo y no corresponde mostrar nada).
  const more = rowsLimit && total >= rowsLimit ? total - items.length : 0

  return (
    <div className={`rb-vcheck ${hasIssues ? 'fail' : 'pass'}`}>
      <button
        className="rb-vcheck-head"
        onClick={() => hasIssues && setOpen(o => !o)}
        style={{ cursor: hasIssues ? 'pointer' : 'default' }}
      >
        <span className="rb-vcheck-icon">{hasIssues ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}</span>
        <span className="rb-vcheck-name">{title}</span>
        {hasIssues && <span className="rb-vcheck-count">{fmt(total)}</span>}
        {hasIssues && <span className={`rb-chevron ${open ? 'open' : ''}`}><ChevronDown size={18} /></span>}
      </button>
      {!hasIssues && <div className="rb-vcheck-ok-note">{okMsg}</div>}
      {hasIssues && open && (
        <div className="rb-vcheck-body">
          {more > 0 && (
            <p className="rb-vcheck-more">
              Mostrando las primeras {fmt(rowsLimit)} de {fmt(total)} — hay {fmt(more)} más sin listar.
            </p>
          )}
          <div className="rb-table-wrap" style={{ marginTop: 14 }}>
            <div className="rb-table-body" style={{ maxHeight: 300 }}>
              {items.map((item, i) => (
                <div key={i} className="rb-table-row" style={{ gridTemplateColumns: '1fr', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  {renderItem(item)}
                </div>
              ))}
            </div>
          </div>
          {more > 0 && <div className="rb-vcheck-more">y {fmt(more)} más</div>}
        </div>
      )}
    </div>
  )
}
