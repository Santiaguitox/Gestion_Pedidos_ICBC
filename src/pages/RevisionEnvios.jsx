import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { REVISION_CONFIG } from '@/lib/revision/config'
import {
  compararCampos, validateCsvHeaders, leerMuestraDeArchivo,
} from '@/lib/revision-envios/comparar'
import { animarProgreso } from '@/lib/revision-envios/animarProgreso'
import { Search, Trash2, RotateCcw, Upload, FileText, AlertTriangle, X, Check, Lock, Table2, ArrowLeft, RefreshCw, Info } from 'lucide-react'
import { Section } from '@/components/pedidos/Section'
import '@/styles/RevisionEnvios.css'

// Hace que un textarea crezca con su contenido en vez de quedar fijo en
// 1 línea con scroll interno — el patrón estándar es resetear a 'auto'
// y leer scrollHeight (la altura real necesaria para mostrar todo sin
// scroll), después fijar el alto a ese valor. maxHeightPx pone un techo
// para casos extremos (headers con 70+ columnas) — al llegarlo, recién
// ahí aparece scroll real dentro del textarea, en vez de crecer sin
// límite y empujar el resto de la página.
function useAutoResize(value, maxHeightPx = 220) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const needed = el.scrollHeight
    el.style.height = `${Math.min(needed, maxHeightPx)}px`
  }, [value, maxHeightPx])
  return ref
}

// Trae el HTML crudo de una pieza por URL — a propósito NO reusa
// correrRevisionCompleta (la función pesada de Revisión de emails, que
// además analiza estructura/links/imágenes): acá solo se necesita el
// HTML para extraer los campos <*CAMPO*>, no todo ese análisis. Mismo
// proxy y misma validación de dominio que esa herramienta sí, para no
// duplicar el riesgo de seguridad (SSRF) con un criterio distinto.
async function traerHtmlDeUrl(url) {
  const response = await fetch(`${REVISION_CONFIG.PROXY_URL}?url=${encodeURIComponent(url)}`)
  if (!response.ok) throw new Error('No se pudo obtener el HTML')
  return await response.text()
}

const ICONO_AVISO = { caracteres_invalidos: AlertTriangle, falta_email: X, duplicado: X }

function AvisoHeader({ aviso }) {
  const Icono = ICONO_AVISO[aviso.tipo]
  let texto
  if (aviso.tipo === 'caracteres_invalidos') {
    const detalle = Object.entries(aviso.chars).map(([ch, { label, count }]) =>
      `"${ch === ' ' ? '·' : ch}" (${label}${count > 1 ? ` ×${count}` : ''})`
    ).join(', ')
    texto = <span><b>{aviso.campo}</b> tiene caracteres inválidos: {detalle}</span>
  } else if (aviso.tipo === 'falta_email') {
    texto = aviso.suspects.length > 0
      ? <span>No se encontró un campo <b>Email</b> válido. ¿Quisiste decir: {aviso.suspects.map(s => <b key={s}>{s}</b>).reduce((a, b) => [a, ', ', b])}? El campo debe llamarse exactamente <b>Email</b>.</span>
      : <span>Falta el campo <b>Email</b> en el encabezado. Es obligatorio y debe llamarse exactamente <b>Email</b>.</span>
  } else {
    texto = <span>Campo duplicado: {aviso.campos.map(f => <b key={f}>{f}</b>).reduce((a, b) => [a, ' y ', b])} aparecen más de una vez.</span>
  }
  return (
    <div className={`re2-aviso re2-aviso-${aviso.severidad}`}>
      <Icono size={13} />
      {texto}
    </div>
  )
}

// Set con los nombres de columna (en minúscula) que tienen algún aviso
// de "caracteres inválidos" — para resaltar esa columna puntual en la
// tabla de muestra, no solo en la lista de avisos de arriba.
function columnasConAviso(avisos) {
  const set = new Set()
  avisos.forEach(a => { if (a.tipo === 'caracteres_invalidos') set.add(a.campo.toLowerCase()) })
  return set
}

function TablaMuestra({ headers, filas, avisos }) {
  if (!headers.length) return null
  const conAviso = columnasConAviso(avisos)
  return (
    <div className="re2-muestra">
      <div className="re2-muestra-head">
        <Table2 size={13} />
        <span>Muestra · {filas.length} fila{filas.length !== 1 ? 's' : ''}</span>
        <span className="re2-muestra-lock"><Lock size={10} />no se almacena</span>
      </div>
      <div className="re2-muestra-scroll">
        <table className="re2-muestra-table">
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} className={conAviso.has(h.toLowerCase()) ? 'col-aviso' : ''}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i}>
                {headers.map((h, j) => (
                  <td key={h} className={conAviso.has(h.toLowerCase()) ? 'col-aviso' : ''}>{fila[j] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RevisionEnvios() {
  const { state: navState } = useLocation()
  const navigate = useNavigate()
  const [modo, setModo] = useState('url')
  const [html, setHtml] = useState('')
  const [url, setUrl] = useState(navState?.url ?? '')
  const [urlError, setUrlError] = useState('')
  const [headerRaw, setHeaderRaw] = useState(navState?.headerLine ?? '')
  const headerInputRef = useAutoResize(headerRaw)
  const [muestra, setMuestra] = useState(null) // { headers, filas } o null
  const [dragging, setDragging] = useState(false)
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)
  const [progreso, setProgreso] = useState(0)
  const fileInputRef = useRef(null)

  const avisosHeader = headerRaw.trim() ? validateCsvHeaders(headerRaw) : []

  async function cargarArchivo(file) {
    setNombreArchivo(file.name)
    try {
      const { headerLine, headers, filas } = await leerMuestraDeArchivo(file)
      setHeaderRaw(headerLine)
      setMuestra({ headers, filas })
    } catch {
      setError('No se pudo leer el archivo. Verificá que sea un .csv, .txt o .xlsx válido.')
    }
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) cargarArchivo(file)
  }

  function handleReiniciar() {
    setHtml(''); setUrl(''); setUrlError(''); setHeaderRaw(''); setMuestra(null)
    setNombreArchivo(''); setError(''); setResultado(null)
  }

  async function handleAnalizar() {
    if (!headerRaw.trim()) { setError('Falta el encabezado de la base.'); return }
    const inputValido = modo === 'html' ? html.trim() : url.trim()
    if (!inputValido) { setError(modo === 'html' ? 'Falta el HTML del mail.' : 'Falta la URL de la pieza.'); return }

    if (modo === 'url') {
      try {
        const host = new URL(url).hostname
        // Misma validación (y mismo motivo) que en RevisionEmail.jsx —
        // ver ese archivo para el detalle completo del porqué del
        // punto delante en .icommarketing.com.
        if (host !== 'icommarketing.com' && !host.endsWith('.icommarketing.com')) {
          setUrlError('Solo se pueden analizar piezas de icommarketing.com')
          return
        }
      } catch { setUrlError('La URL ingresada no es válida'); return }
    }

    setUrlError(''); setError(''); setCargando(true); setResultado(null); setProgreso(0)
    try {
      // Animación y fetch en paralelo — el usuario ve avance mientras
      // se espera el HTML real, en vez de quedarse con el botón en
      // "Analizando…" sin ninguna señal de que algo está pasando.
      const [htmlAAnalizar] = await Promise.all([
        modo === 'html' ? Promise.resolve(html) : traerHtmlDeUrl(url),
        animarProgreso(setProgreso)
      ])
      setResultado(compararCampos(headerRaw, htmlAAnalizar))
    } catch (err) {
      setError(err.message || 'No se pudo completar el análisis.')
    }
    setCargando(false)
  }

  // Auto-disparo del análisis cuando se llega desde el deep-link de
  // "Base de datos" en el detalle de un pedido (con headerLine + url ya
  // precargados vía navState) — no tiene sentido obligar a apretar
  // "Analizar" si ya tenemos todo lo necesario, el usuario solo quiere
  // ver el resultado. autoRunDone evita que se dispare más de una vez
  // (ej. si el componente re-renderiza por otra razón) y evita pisar un
  // análisis manual posterior si el usuario edita y vuelve a analizar.
  const autoRunDone = useRef(false)
  useEffect(() => {
    if (autoRunDone.current) return
    autoRunDone.current = true
    if (navState?.url && navState?.headerLine) {
      handleAnalizar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page-root re2-root">

      {/* Solo aparece si se llegó acá desde el riel/acordeón de un
          pedido puntual (vía navState.volverA) — vuelve directo a ese
          pedido en vez de obligar a navegar por el menú. Mismo patrón
          de state que ya usa el resto de la app (PedidoCard, Calendario,
          Notificaciones) para "Volver a…", no hay localStorage de por
          medio. Si se llegó por cualquier otro camino, no se muestra. */}
      {navState?.volverA && (
        <button
          onClick={() => navigate(`/app/pedidos/${navState.volverA.pedidoId}`)}
          className="btn-back"
        >
          <ArrowLeft size={16} /><span>Volver al pedido</span>
        </button>
      )}

      <div>
        <h1 className="page-title">Revisión de envíos</h1>
        <p className="page-subtitle">Campos &lt;*Campo*&gt; del mail vs. columnas de la base</p>
      </div>

      <div className="re2-workspace">

        {/* Sección — Encabezado de la base */}
        <div className="re2-ws-section">
          <div className="re2-ws-section-label"><span>Encabezado de la base</span><div className="re2-ws-rule" /></div>

          {nombreArchivo ? (
            <div className="re2-file-chip">
              <FileText size={15} /><span>{nombreArchivo}</span><Check size={14} />
            </div>
          ) : (
            <div
              className={`re2-dropzone ${dragging ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) cargarArchivo(e.target.files[0]) }} />
              <Upload size={16} />
              <div>
                <span>Subí .csv / .txt / .xlsx</span>
                <span className="re2-dropzone-hint">solo se lee la 1ª línea</span>
              </div>
            </div>
          )}

          <textarea
            ref={headerInputRef}
            className="re2-header-input"
            value={headerRaw}
            onChange={e => { setHeaderRaw(e.target.value); setNombreArchivo(''); setMuestra(null) }}
            placeholder="…o pegá el encabezado: Email;Nombre;Empresa…"
            rows={1}
          />

          {avisosHeader.length > 0 && (
            <div className="re2-avisos">
              {avisosHeader.map((a, i) => <AvisoHeader key={i} aviso={a} />)}
            </div>
          )}

          {muestra && <TablaMuestra headers={muestra.headers} filas={muestra.filas} avisos={avisosHeader} />}
        </div>

        {/* Sección — Pieza a validar */}
        <div className="re2-ws-section">
          <div className="re2-ws-section-label">
            <span>Pieza a validar</span>
            <div className="re2-ws-rule" />
            <div className="re2-tabs">
              <button className={modo === 'html' ? 'active' : ''} onClick={() => { setModo('html'); setUrlError('') }}>HTML</button>
              <button className={modo === 'url' ? 'active' : ''} onClick={() => { setModo('url'); setUrlError('') }}>URL</button>
            </div>
          </div>

          {modo === 'html' ? (
            <div style={{ position: 'relative' }}>
              <textarea
                className="re2-header-input"
                value={html}
                onChange={e => setHtml(e.target.value)}
                placeholder="<td>Hola <*Nombre*>, …</td>"
                rows={4}
              />
              {html && (
                <button onClick={() => setHtml('')} className="re2-clear-btn" title="Limpiar">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setUrlError('') }}
                placeholder="https://icbc-info.icommarketing.com/…"
                className={urlError ? 'input-error' : ''}
                style={{ width: '100%' }}
              />
              {url && (
                <button onClick={() => { setUrl(''); setUrlError('') }} className="re2-clear-btn" title="Limpiar">
                  <Trash2 size={16} />
                </button>
              )}
              {urlError && <p className="msg-error" style={{ marginTop: 6 }}>{urlError}</p>}
            </div>
          )}
        </div>

        {error && <div className="re2-error-banner">{error}</div>}

        <div className="re2-actions">
          <button onClick={handleAnalizar} disabled={cargando} className="re2-btn-analizar">
            <Search size={15} />
            {cargando ? 'Analizando…' : 'Analizar'}
          </button>
          {(resultado || headerRaw || html || url) && (
            <button onClick={handleReiniciar} className="re2-btn-reset" title="Empezar de nuevo">
              <RotateCcw size={15} />
            </button>
          )}
        </div>

      </div>

      {/* Resultado en un acordeón separado del formulario de arriba —
          así se puede cerrar para comparar la tabla de muestra (las
          filas reales de la base) sin que el resultado ocupe toda la
          pantalla. Arranca abierto si ya hay algo para mostrar
          (cargando o resultado), cerrado si todavía no se analizó
          nada — incluye el caso de auto-run con datos precargados,
          que debe verse de una sin tener que abrir nada. */}
      {(cargando || resultado) && (
        <Section
          title="Resultado"
          icon={<Search size={16} />}
          defaultOpen={true}
        >
          {/* Progress bar — mismo lenguaje visual que "Revisión de BBDD"
              (spinner + label + % grande + barra en rojo), pero con
              clases propias re2-* — cada herramienta tiene su CSS
              aislado, no se importa RevisionBase.css desde acá. Antes,
              mientras se esperaba el fetch del HTML, el botón solo decía
              "Analizando…" sin ninguna señal de avance. */}
          {cargando && (
            <div className="re2-processing">
              <div className="re2-processing-head">
                <div className="re2-spinner" />
                <div className="re2-processing-filename">
                  {modo === 'html' ? 'Analizando HTML pegado' : (url || 'Analizando pieza')}
                </div>
              </div>
              <div className="re2-processing-top">
                <div className="re2-processing-label">Comparando campos…</div>
                <div className="re2-processing-pct">{progreso}%</div>
              </div>
              <div className="re2-progress-track"><div className="re2-progress-fill" style={{ width: `${progreso}%` }} /></div>
              <div className="re2-processing-note">Comparando contra el encabezado de la base — no se guarda nada.</div>
            </div>
          )}

          {resultado && (
            <div className="re2-resultado">
              {/* Caso especial: el HTML no tiene ningún campo <*Campo*>
                  personalizado — pasa seguido con piezas que no llevan
                  merge tags. Sin esto, los 3 pills mostrarían "0 OK / 0
                  sin match / N no usadas" (técnicamente cierto pero
                  confuso, ya que las "N no usadas" son TODAS las
                  columnas de la base sin que eso sea un problema real),
                  y la tabla de detalle se vería con el header pero sin
                  ninguna fila. Mejor un mensaje directo que explique
                  que no hay nada para comparar. */}
              {resultado.htmlFields.size === 0 ? (
                <div className="re2-sin-campos">
                  <Info size={18} />
                  <p>
                    Esta pieza no tiene ningún campo personalizado <code>&lt;*Campo*&gt;</code> en su HTML —
                    no hay nada para comparar contra la base.
                  </p>
                </div>
              ) : (
                <>
                  <div className="re2-resultado-header">
                    <div className="re2-pills">
                      <span className="re2-pill re2-pill-ok"><Check size={13} />{resultado.ok.length} campo{resultado.ok.length !== 1 ? 's' : ''} OK</span>
                      <span className="re2-pill re2-pill-miss"><X size={13} />{resultado.miss.length} campo{resultado.miss.length !== 1 ? 's' : ''} sin match</span>
                      <span className="re2-pill re2-pill-unused"><AlertTriangle size={13} />{resultado.unused.length} columna{resultado.unused.length !== 1 ? 's' : ''} no usada{resultado.unused.length !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Re-verificar — mismo ícono y criterio que ya usa
                        BaseDatosSection.jsx: solo aparece una vez que hubo
                        un resultado, nunca mientras se está verificando. */}
                    <button onClick={handleAnalizar} className="re2-reverificar-btn" title="Volver a analizar">
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  {resultado.miss.length > 0 && (
                    <div className="re2-tag-section">
                      <div className="re2-tag-section-title">Campos sin match</div>
                      <div className="re2-tag-grid">
                        {resultado.miss.map(f => <span key={f} className="re2-tag re2-tag-miss"><X size={11} />{f}</span>)}
                      </div>
                    </div>
                  )}
                  {resultado.ok.length > 0 && (
                    <div className="re2-tag-section">
                      <div className="re2-tag-section-title">Campos OK</div>
                      <div className="re2-tag-grid">
                        {resultado.ok.map(f => <span key={f} className="re2-tag re2-tag-ok"><Check size={11} />{f}</span>)}
                      </div>
                    </div>
                  )}
                  {resultado.unused.length > 0 && (
                    <div className="re2-tag-section">
                      <div className="re2-tag-section-title">Columnas de la base no usadas en el HTML</div>
                      <div className="re2-tag-grid">
                        {resultado.unused.map(f => <span key={f} className="re2-tag re2-tag-unused"><AlertTriangle size={11} />{f}</span>)}
                      </div>
                    </div>
                  )}

                  <div className="re2-tag-section-title" style={{ marginTop: '0.5rem' }}>Detalle completo — campos del HTML</div>
                  <div className="re2-report">
                    <div className="re2-report-scroll">
                      <table className="re2-report-table">
                        <thead>
                          <tr><th>Campo en el HTML</th><th>Estado</th><th>Columna en base</th></tr>
                        </thead>
                        <tbody>
                          {[...resultado.htmlFields].sort().map(f => {
                            const inBase = resultado.headersMap.hasOwnProperty(f.toLowerCase())
                            const colName = inBase ? resultado.headersMap[f.toLowerCase()] : null
                            return (
                              <tr key={f}>
                                <td className="re2-report-field">&lt;*{f}*&gt;</td>
                                <td>
                                  <span className={`re2-status-badge ${inBase ? 're2-sb-ok' : 're2-sb-miss'}`}>
                                    {inBase ? <><Check size={11} />encontrado</> : <><X size={11} />no encontrado</>}
                                  </span>
                                </td>
                                <td className="re2-report-col">{colName || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </Section>
      )}

    </div>
  )
}
