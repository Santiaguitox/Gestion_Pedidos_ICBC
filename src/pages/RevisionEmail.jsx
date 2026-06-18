import { useState } from 'react'
import { REVISION_CONFIG } from '@/lib/revision/config'
import { templates } from '@/data/Templates/index'
import { CompararConTemplates } from '@/lib/revision/templates'
import { ValidarDominioImagenes, ValidarClasesDefinidas, ValidarLegal, ValidarLinks, ValidarAltImagenes, ValidarEstructuraHTML, ValidarPesoHTML } from '@/lib/revision/generales'
import { ValidarDimensionesImagenes, ValidarPesoImagenes } from '@/lib/revision/imagenes'
import ResultadoPanel from '@/components/revision/ResultadoPanel'
import { Search, Trash2, RotateCcw } from 'lucide-react'

export default function RevisionEmail() {
  const [modo, setModo] = useState('html')
  const [url, setUrl] = useState('')
  const [html, setHtml] = useState('')
  const [resultados, setResultados] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [htmlAnalizado, setHtmlAnalizado] = useState('')
  const [progreso, setProgreso] = useState('')
  const [urlError, setUrlError] = useState('')

  function handleReiniciar() {
    setHtml(''); setHtmlAnalizado(''); setResultados(null); setUrl(''); setUrlError('')
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
      <div>
        <h1 className="page-title">Revisión de emails</h1>
        <p className="page-subtitle">Validá la estructura, links, imágenes y legales de una pieza ICBC</p>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ padding: '1.25rem' }}>

          {/* Switch modo */}
          <div className="revision-modo-switch">
            <span className={`revision-modo-label ${modo === 'html' ? 'revision-modo-label-active' : ''}`}>Pegar HTML</span>
            <button onClick={() => { setModo(modo === 'html' ? 'url' : 'html'); setUrlError('') }}
              className={`revision-toggle ${modo === 'url' ? 'revision-toggle-on' : ''}`}>
              <span className={`revision-toggle-thumb ${modo === 'url' ? 'revision-toggle-thumb-on' : ''}`} />
            </button>
            <span className={`revision-modo-label ${modo === 'url' ? 'revision-modo-label-active' : ''}`}>Obtener desde URL</span>
          </div>

          {/* Input */}
          {modo === 'html' ? (
            <div className="field">
              <label className="field-label">HTML del email</label>
              <div className="revision-input-wrapper">
                <textarea value={html} onChange={e => setHtml(e.target.value)}
                  placeholder="Pegá acá el HTML completo del email…"
                  className="revision-textarea" />
                {html && (
                  <button onClick={() => setHtml('')} className="revision-clear-btn" title="Limpiar">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="field">
              <label className="field-label">URL de la pieza</label>
              <div className="revision-input-wrapper">
                <input type="text" value={url}
                  onChange={e => { setUrl(e.target.value); setUrlError('') }}
                  placeholder="https://icbc-info.icommarketing.com/…"
                  className={urlError ? 'input-error' : ''} />
                {url && (
                  <button onClick={() => { setUrl(''); setUrlError('') }} className="revision-clear-btn" title="Limpiar">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {urlError && <p className="msg-error">{urlError}</p>}
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 items-center">
            <button onClick={handleAnalizar}
              disabled={cargando || (modo === 'html' ? !html.trim() : !url.trim())}
              className="btn-primary"
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem', opacity: cargando || (modo === 'html' ? !html.trim() : !url.trim()) ? 0.5 : 1 }}>
              <Search size={15} />
              {cargando ? 'Analizando…' : 'Analizar'}
            </button>
            {resultados && (
              <button onClick={handleReiniciar} className="btn-secondary" style={{ width: 'auto' }} title="Reiniciar">
                <RotateCcw size={15} />
              </button>
            )}
            {cargando && progreso && (
              <span className="text-muted-sm">{progreso}</span>
            )}
          </div>
        </div>
      </div>

      {/* Resultados */}
      {(resultados || cargando) && (
        <div className="revision-layout">

          {/* Preview */}
          <div className="revision-preview-wrap">
            <p className="revision-section-label">Vista previa</p>
            <div className="revision-preview-frame">
              <iframe
                srcDoc={htmlAnalizado}
                className="revision-iframe"
                title="Vista previa del email"
                onLoad={e => { e.target.style.height = e.target.contentDocument?.body?.scrollHeight + 'px' }}
              />
            </div>
          </div>

          {/* Panel resultados */}
          <div className="revision-resultados-wrap">
            {cargando && (
              <div className="revision-loading">
                <div className="revision-spinner" />
                <span className="text-muted-sm">{progreso || 'Analizando…'}</span>
              </div>
            )}
            {resultados && <ResultadoPanel resultados={resultados} />}
          </div>

        </div>
      )}
    </div>
  )
}
