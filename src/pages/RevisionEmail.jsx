import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { correrRevisionCompleta } from '@/lib/revision/ejecutarRevision'
import ResultadoPanel from '@/components/revision/ResultadoPanel'
import { Search, Trash2, RotateCcw } from 'lucide-react'

export default function RevisionEmail() {
  const location = useLocation()
  // Si se llega desde la pieza de un pedido ("Ver detalle"), state.url
  // trae el link a precargar — se arranca directo en modo 'url' con ese
  // valor, y se dispara el análisis automáticamente al montar (ver
  // useEffect más abajo), para no obligar a la persona a tocar "Analizar"
  // de nuevo si ya vino con la intención clara de ver ESE resultado.
  const urlInicial = location.state?.url ?? ''
  const [modo, setModo] = useState('url')
  const [url, setUrl] = useState(urlInicial)
  const [html, setHtml] = useState('')
  const [resultados, setResultados] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [htmlAnalizado, setHtmlAnalizado] = useState('')
  const [progreso, setProgreso] = useState('')
  const [urlError, setUrlError] = useState('')
  const iframeRef = useRef(null)

  // Si llegamos con una URL precargada (desde "Ver detalle" de una
  // pieza), disparar el análisis automáticamente al montar — solo una
  // vez, no en cada cambio de 'url' (si no, se repetiría cada vez que
  // la persona edita el campo a mano después).
  useEffect(() => {
    if (urlInicial) handleAnalizar()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReiniciar() {
    setHtml(''); setHtmlAnalizado(''); setResultados(null); setUrl(''); setUrlError('')
  }

  function handleIframeLoad() {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const h = iframe.contentDocument?.body?.scrollHeight
      if (h) iframe.style.height = h + 'px'
    } catch {}
  }

  async function handleAnalizar() {
    const inputValido = modo === 'html' ? html.trim() : url.trim()
    if (!inputValido) return

    if (modo === 'url') {
      try {
        const host = new URL(url).hostname
        // Esta validación es solo cosmética (UX) — la defensa REAL contra
        // SSRF vive en api/proxy.js (ALLOWED_HOST_SUFFIXES), porque ese
        // endpoint puede llamarse directo sin pasar por este formulario.
        // 🔧 Si se agrega un dominio nuevo a api/proxy.js, actualizar
        // también esta validación (y viceversa) — quedaron duplicadas
        // a propósito como defensa en profundidad, pero hay que
        // mantenerlas sincronizadas a mano.
        //
        // Con punto delante: evita que "evilicommarketing.com" pase la
        // validación por ser un substring que también "termina en"
        // icommarketing.com sin ser un subdominio real.
        if (host !== 'icommarketing.com' && !host.endsWith('.icommarketing.com')) {
          setUrlError('Solo se pueden analizar piezas de icommarketing.com')
          return
        }
      } catch { setUrlError('La URL ingresada no es válida'); return }
    }

    setUrlError('')
    setCargando(true)

    try {
      const { htmlAnalizado: htmlObtenido, resultados: resultadosObtenidos } = await correrRevisionCompleta({
        modo,
        url,
        html,
        onProgreso: setProgreso,
      })
      if (modo === 'url') setHtml(htmlObtenido)
      setHtmlAnalizado(htmlObtenido)
      setResultados(resultadosObtenidos)
    } catch {
      // El error ya se comunica con el estado vacío (sin resultados) —
      // no hace falta un mensaje específico acá, RevisionEmail.jsx ya
      // mostraba este mismo comportamiento antes de la extracción.
    }

    setProgreso('')
    setCargando(false)
  }

  return (
    <div className="page-root">

      {/* Header */}
      <div>
        <h1 className="page-title">Revisión de emails</h1>
        <p className="page-subtitle">Validá la estructura, links, imágenes y legales de una pieza ICBC</p>
      </div>

      {/* Input panel */}
      <div className="panel">
        <div className="panel-body" style={{ padding: '1.25rem', borderTop: 'none' }}>

          {/* Switch modo */}
          <div className="flex items-center gap-3 mb-5">
            <span className={`text-sm ${modo === 'html' ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
              Pegar HTML
            </span>
            <button
              onClick={() => { setModo(modo === 'html' ? 'url' : 'html'); setUrlError('') }}
              className="revision-switch"
              style={{ background: modo === 'url' ? 'var(--icbc-red)' : 'var(--border-strong)' }}>
              <span
                className="revision-switch-thumb"
                style={{ left: modo === 'url' ? '23px' : '3px' }}
              />
            </button>
            <span className={`text-sm ${modo === 'url' ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
              Obtener desde URL
            </span>
          </div>

          {/* Input */}
          {modo === 'html' ? (
            <div className="field">
              <label className="field-label">HTML del email</label>
              <div className="relative">
                <textarea
                  value={html}
                  onChange={e => setHtml(e.target.value)}
                  placeholder="Pegá acá el HTML completo del email…"
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem', height: '8rem', resize: 'vertical', width: '100%' }}
                />
                {html && (
                  <button onClick={() => setHtml('')}
                    className="absolute top-2 right-2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] rounded"
                    title="Limpiar">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="field">
              <label className="field-label">URL de la pieza</label>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setUrlError('') }}
                  placeholder="https://icbc-info.icommarketing.com/…"
                  className={urlError ? 'input-error' : ''}
                />
                {url && (
                  <button onClick={() => { setUrl(''); setUrlError('') }}
                    className="absolute top-2 right-2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] rounded"
                    title="Limpiar">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {urlError && <p className="msg-error mt-1">{urlError}</p>}
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleAnalizar}
              disabled={cargando || (modo === 'html' ? !html.trim() : !url.trim())}
              className="btn-primary"
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Search size={15} />
              {cargando ? 'Analizando…' : 'Analizar'}
            </button>
            {resultados && (
              <button onClick={handleReiniciar} className="btn-secondary" style={{ width: 'auto' }}>
                <RotateCcw size={15} />
              </button>
            )}
            {cargando && progreso && (
              <span className="text-sm text-[var(--text-muted)]">{progreso}</span>
            )}
          </div>

        </div>
      </div>

      {/* Resultados — layout en dos columnas */}
      {(resultados || cargando) && (
        <div className="flex gap-6 items-start w-full">

          {/* Columna izquierda: preview */}
          <div className="flex-shrink-0" style={{ width: '660px' }}>
            <p className="revision-col-label">Vista previa</p>
            <div className="revision-preview-outer">
              <iframe
                ref={iframeRef}
                srcDoc={htmlAnalizado}
                title="Vista previa del email"
                onLoad={handleIframeLoad}
                className="revision-iframe"
              />
            </div>
          </div>

          {/* Columna derecha: resultados */}
          <div className="flex-1 min-w-0">
            {cargando ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="revision-spinner" />
                <span className="text-sm text-[var(--text-muted)]">{progreso || 'Analizando…'}</span>
              </div>
            ) : (
              resultados && <ResultadoPanel resultados={resultados} />
            )}
          </div>

        </div>
      )}

    </div>
  )
}
