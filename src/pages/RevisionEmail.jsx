import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { correrRevisionCompleta, resumirResultados, identificadorPieza } from '@/lib/revision/ejecutarRevision'
import ResultadoPanel from '@/components/revision/ResultadoPanel'
import { Search, Trash2, RotateCcw } from 'lucide-react'
import '@/styles/RevisionEmail.css'

export default function RevisionEmail() {
  useDocumentTitle('Revisión HTML')

  const location = useLocation()
  // Si se llega desde la pieza de un pedido ("Ver detalle"), state.url
  // trae el link a precargar — se arranca directo en modo 'url' con ese
  // valor, y se dispara el análisis automáticamente al montar (ver
  // useEffect más abajo), para no obligar a la persona a tocar "Analizar"
  // de nuevo si ya vino con la intención clara de ver ESE resultado.
  // state.entregableId identifica a QUÉ pieza corresponde esa URL — se
  // usa para volver a guardar el resumen actualizado si el resultado
  // cambió desde la última vez (ver guardarSiCorrespondeAPieza).
  const urlInicial = location.state?.url ?? ''
  const entregableId = location.state?.entregableId ?? null
  const [modo, setModo] = useState('url')
  const [url, setUrl] = useState(urlInicial)
  const [html, setHtml] = useState('')
  const [resultados, setResultados] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [htmlAnalizado, setHtmlAnalizado] = useState('')
  const [progreso, setProgreso] = useState('')
  const [urlError, setUrlError] = useState('')
  const iframeRef = useRef(null)
  // Ref sincronizada con 'url' — se lee desde dentro de handleAnalizar
  // para comparar contra el valor MÁS ACTUAL al momento de terminar el
  // análisis, no el valor capturado por closure al momento de empezarlo
  // (si la persona edita el campo mientras corre, la variable 'url' del
  // closure quedaría desactualizada respecto al estado real).
  const urlRef = useRef(urlInicial)
  useEffect(() => { urlRef.current = url }, [url])
  // Igual que con la url, se necesita el modo ACTUAL al terminar — si
  // cambió a 'html' mientras corría, ya no corresponde a la pieza.
  const modoRef = useRef('url')
  useEffect(() => { modoRef.current = modo }, [modo])

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
    } catch {
      // Acceder a contentDocument puede tirar un error de seguridad
      // cross-origin en algunos navegadores aunque el contenido sea
      // srcDoc local — si falla, el iframe simplemente no se
      // auto-ajusta esa vez (no es crítico, el contenido sigue siendo
      // visible con el alto que ya tenía).
    }
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

      // Si llegamos desde la pieza de un pedido (entregableId presente)
      // y, en este momento puntual, el modo sigue siendo 'url' con
      // EXACTAMENTE la misma URL que la pieza tenía al llegar — se
      // guarda el resumen actualizado en esa pieza. Si la persona
      // cambió el campo, pasó a modo HTML, o reinició la pantalla
      // mientras el análisis corría, esta condición ya no se cumple y
      // no se guarda nada (sería actualizar la pieza equivocada).
      if (entregableId && modoRef.current === 'url' && urlRef.current.trim() === urlInicial.trim()) {
        const resumen = resumirResultados(resultadosObtenidos)
        const { error: errorPersist } = await supabase.from('entregable').update({
          revision_pruebas_ok: resumen.ok,
          revision_pruebas_total: resumen.total,
          revision_severidad: resumen.severidad,
          revision_link: identificadorPieza(urlRef.current),
          revision_at: new Date().toISOString(),
        }).eq('id', entregableId)
        // El análisis en pantalla es válido igual; solo falló el volcado
        // del resumen a la pieza — queda en consola en vez de invisible.
        if (errorPersist) console.warn('[revision] No se pudo guardar el resumen en la pieza:', errorPersist.message)
      }
    } catch {
      // El error ya se comunica con el estado vacío (sin resultados) —
      // no hace falta un mensaje específico acá.
    }

    setProgreso('')
    setCargando(false)
  }

  // Resumen liviano para la score bar — mismo cálculo que resumirResultados
  // (lib/revision/ejecutarRevision.js), pero acá se necesita también la
  // cuenta de advertencias por separado (ok/warn/error en vez de solo
  // ok/total), así que se recalcula con el mismo criterio en vez de
  // reusar esa función (pensada para guardar 3 valores en la base, no
  // para alimentar esta barra visual de 3 colores).
  //
  // 'detalleMenorN' es un contador EXTRA, aparte de ok/warn/error: cuenta
  // las advertencias de "Links" (ej: falta target="_blank") y de
  // "Dimensiones" (separadores estructurales estirados) que no hacen
  // fallar la prueba en sí (Links puede seguir siendo ok:true con
  // detalles menores) — no afecta el cálculo de pruebas superadas ni a
  // resumirResultados (que sigue intacta, esto es solo informativo en
  // esta pantalla).
  function calcularScore(resultados) {
    const claves = ['estructuraHTML', 'clasesCSS', 'legal', 'links', 'dominioImagenes', 'altImagenes', 'dimensiones', 'pesoImagenes', 'pesoHTML']
    const bloques = claves.map(k => resultados[k]).filter(Boolean)
    const bloqueTemplates = { ok: (resultados.resumenTemplates?.length ?? 0) === 0, advertencia: false }
    const todos = [...bloques, bloqueTemplates]
    const okN = todos.filter(b => b.ok).length
    const warnN = todos.filter(b => !b.ok && b.advertencia).length
    const errN = todos.filter(b => !b.ok && !b.advertencia).length
    const detalleMenorN = (resultados.links?.advertencias?.length ?? 0)
      + (resultados.dimensiones?.advertencias?.length ?? 0)
    return { okN, warnN, errN, detalleMenorN, score: okN + warnN, total: todos.length }
  }
  const score = resultados ? calcularScore(resultados) : null

  return (
    <div className="page-root re-root">

      {/* Header */}
      <div>
        <h1 className="page-title">Revisión de emails</h1>
        <p className="page-subtitle">Validá la estructura, links, imágenes y legales de una pieza ICBC</p>
      </div>

      {/* Panel de carga */}
      <div className="re-load-panel">

        <div className="re-tabs">
          <button className={modo === 'html' ? 'active' : ''} onClick={() => { setModo('html'); setUrlError('') }}>HTML</button>
          <button className={modo === 'url' ? 'active' : ''} onClick={() => { setModo('url'); setUrlError('') }}>URL</button>
        </div>

        <div className="re-input-row">
          <div className="re-input-col" style={{ position: 'relative' }}>
            {modo === 'html' ? (
              <>
                <div className="re-input-field-label">HTML del email</div>
                <textarea
                  className="re-textarea"
                  value={html}
                  onChange={e => setHtml(e.target.value)}
                  placeholder="Pegá acá el HTML completo del email…"
                />
                {html && (
                  <button onClick={() => setHtml('')} className="re-clear-btn" title="Limpiar">
                    <Trash2 size={20} />
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="re-input-field-label">URL de la pieza</div>
                <input
                  type="text"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setUrlError('') }}
                  placeholder="https://icbc-info.icommarketing.com/…"
                  className={urlError ? 'input-error' : ''}
                  style={{ width: '100%' }}
                />
                {url && (
                  <button onClick={() => { setUrl(''); setUrlError('') }} className="re-clear-btn" title="Limpiar">
                    <Trash2 size={20} />
                  </button>
                )}
                {urlError && <p className="msg-error" style={{ marginTop: 6 }}>{urlError}</p>}
              </>
            )}
          </div>

          <button
            onClick={handleAnalizar}
            disabled={cargando || (modo === 'html' ? !html.trim() : !url.trim())}
            className="re-btn-analizar">
            <Search size={15} />
            {cargando ? 'Analizando…' : 'Analizar'}
          </button>

          {resultados && (
            <button onClick={handleReiniciar} className="re-btn-reset" title="Empezar de nuevo">
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Score bar */}
      {score && !cargando && (
        <div className="re-score-panel">
          <div className="re-score-num">
            <span>{score.score}</span>
            <span>/ {score.total}</span>
          </div>
          <div className="re-score-bar-col">
            <div className="re-score-bar-label">pruebas superadas</div>
            <div className="re-score-track">
              <div style={{ width: `${(score.okN / score.total) * 100}%`, background: 'var(--green-text)' }} />
              <div style={{ width: `${(score.warnN / score.total) * 100}%`, background: 'var(--yellow-text)' }} />
              <div style={{ width: `${(score.errN / score.total) * 100}%`, background: 'var(--accent-primary)' }} />
            </div>
          </div>
          <div className="re-score-badges">
            <span className="re-score-badge ok"><span className="dot" />{score.okN} OK</span>
            <span className="re-score-badge warn"><span className="dot" />{score.warnN} advertencia{score.warnN !== 1 ? 's' : ''}</span>
            <span className="re-score-badge err"><span className="dot" />{score.errN} error{score.errN !== 1 ? 'es' : ''}</span>
            {score.detalleMenorN > 0 && (
              <span className="re-score-badge minor"><span className="dot" />{score.detalleMenorN} detalle{score.detalleMenorN !== 1 ? 's' : ''} menor{score.detalleMenorN !== 1 ? 'es' : ''}</span>
            )}
          </div>
        </div>
      )}

      {/* Resultados — layout en dos columnas en desktop, apiladas
          (resultados primero, preview después) en mobile vía CSS */}
      {(resultados || cargando) && (
        <div className="re-layout">

          {/* Preview */}
          <div>
            <p className="re-col-label">Vista previa</p>
            <div className="re-preview-outer">
              <div className="re-preview-titlebar">
                <span className="dot" />
                <span>Pieza renderizada</span>
              </div>
              <div className="re-preview-body">
                {htmlAnalizado ? (
                  <iframe
                    ref={iframeRef}
                    srcDoc={htmlAnalizado}
                    title="Vista previa del email"
                    onLoad={handleIframeLoad}
                    className="re-iframe"
                  />
                ) : (
                  <div className="re-preview-empty">Analizando…</div>
                )}
              </div>
            </div>
          </div>

          {/* Resultados */}
          <div>
            <p className="re-col-label">Resultado del análisis</p>
            {cargando ? (
              <div className="re-spinner-wrap">
                <div className="re-spinner" />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{progreso || 'Analizando…'}</span>
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
