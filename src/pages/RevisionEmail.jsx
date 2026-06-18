import { useState, useRef } from 'react'
import { REVISION_CONFIG } from '@/lib/revision/config'
import { templates } from '@/data/Templates/index'
import { CompararConTemplates } from '@/lib/revision/templates'
import { ValidarDominioImagenes, ValidarClasesDefinidas, ValidarLegal, ValidarLinks, ValidarAltImagenes, ValidarEstructuraHTML, ValidarPesoHTML } from '@/lib/revision/generales'
import { ValidarDimensionesImagenes, ValidarPesoImagenes } from '@/lib/revision/imagenes'
import ResultadoPanel from '@/components/revision/ResultadoPanel'
import { Search, Trash2, RotateCcw } from 'lucide-react'

export default function RevisionEmail() {
  const [modo, setModo] = useState('url')
  const [url, setUrl] = useState('')
  const [html, setHtml] = useState('')
  const [resultados, setResultados] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [htmlAnalizado, setHtmlAnalizado] = useState('')
  const [progreso, setProgreso] = useState('')
  const [urlError, setUrlError] = useState('')
  const iframeRef = useRef(null)

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
        if (!host.endsWith('icommarketing.com')) { setUrlError('Solo se pueden analizar piezas de icommarketing.com'); return }
      } catch { setUrlError('La URL ingresada no es válida'); return }
    }

    setUrlError('')
    setCargando(true)
    let htmlAAnalizar = ''

    if (modo === 'html') {
      htmlAAnalizar = html
    } else {
      try {
        const response = await fetch(`${REVISION_CONFIG.PROXY_URL}?url=${encodeURIComponent(url)}`)
        if (!response.ok) throw new Error('No se pudo obtener el HTML')
        htmlAAnalizar = await response.text()
        setHtml(htmlAAnalizar)
        setHtmlAnalizado(htmlAAnalizar)
      } catch {
        setCargando(false)
        return
      }
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlAAnalizar, 'text/html')
    setHtmlAnalizado(htmlAAnalizar)
    setProgreso('Analizando estructura y links...')

    const imagenes = [...doc.querySelectorAll('img')]
    const srcList = [...new Set(imagenes.map(img => img.getAttribute('src')).filter(Boolean))]
    const cacheDatos = {}

    for (let idx = 0; idx < srcList.length; idx++) {
      setProgreso(`Verificando imagen ${idx + 1} de ${srcList.length}...`)
      const src = srcList[idx]
      try {
        const response = await fetch(`${REVISION_CONFIG.PROXY_URL}?modo=imagen&url=${encodeURIComponent(src)}`)
        if (response.ok) cacheDatos[src] = await response.json()
      } catch {}
    }

    const [dominioImagenes, clasesCSS, legal, links, altImagenes, dimensiones, pesoImagenes, estructuraHTML, resumenTemplates] = await Promise.all([
      Promise.resolve(ValidarDominioImagenes(doc)),
      Promise.resolve(ValidarClasesDefinidas(doc)),
      Promise.resolve(ValidarLegal(doc)),
      Promise.resolve(ValidarLinks(doc)),
      Promise.resolve(ValidarAltImagenes(doc)),
      ValidarDimensionesImagenes(doc, cacheDatos),
      ValidarPesoImagenes(doc, cacheDatos),
      Promise.resolve(ValidarEstructuraHTML(doc, htmlAAnalizar)),
      Promise.resolve(CompararConTemplates(doc, templates)),
    ])

    setProgreso('')
    setResultados({ pesoHTML: ValidarPesoHTML(htmlAAnalizar), pesoImagenes, estructuraHTML, dominioImagenes, clasesCSS, legal, links, altImagenes, dimensiones, resumenTemplates })
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
        <div className="panel-body" style={{ padding: '1.25rem' }}>

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
