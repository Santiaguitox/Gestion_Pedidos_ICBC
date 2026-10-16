import { useEffect, useMemo, useRef } from 'react'
import { FileSearch, LoaderCircle, Lock, Monitor } from 'lucide-react'
import { documentoVistaPrevia } from '../../lib/externo/recorte.js'

function direccionCorta(url) {
  try {
    const u = new URL(url)
    return u.hostname + u.pathname.replace(/\/$/, '')
  } catch {
    return url
  }
}

// Marco con la pieza renderizada. Muestra exactamente lo que se descarga.
// El iframe no ejecuta scripts (sandbox sin allow-scripts) y se agranda hasta
// el alto real de la pieza para que el scroll sea el del marco, no el del iframe.
function PiezaRenderizada({ recorte }) {
  const marco = useRef(null)
  const observador = useRef(null)
  const documento = useMemo(() => documentoVistaPrevia(recorte), [recorte])

  function ajustarAlto() {
    const doc = marco.current?.contentDocument
    if (!doc?.documentElement) return
    const alto = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0)
    if (alto) marco.current.style.height = `${alto}px`
  }

  function alCargar() {
    ajustarAlto()
    const doc = marco.current?.contentDocument
    if (!doc?.body || typeof ResizeObserver === 'undefined') return
    // Las imágenes siguen cargando después del load del documento
    const obs = new ResizeObserver(ajustarAlto)
    obs.observe(doc.body)
    observador.current?.disconnect()
    observador.current = obs
  }

  useEffect(() => () => observador.current?.disconnect(), [documento])

  return (
    <iframe
      ref={marco}
      className="ex-pieza-marco"
      title="Vista previa de la pieza"
      scrolling="no"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={documento}
      onLoad={alCargar}
    />
  )
}

export default function VistaPrevia({ fase, url, recorte }) {
  const conPieza = fase === 'resultado' && recorte
  let direccion = 'Tu pieza va a aparecer acá'
  if (fase === 'analizando' || conPieza) direccion = direccionCorta(url)

  return (
    <div className="ex-vista">
      <div className="ex-ventana">
        <div className="ex-ventana__barra">
          <span className="ex-ventana__puntos" aria-hidden="true">
            <span className="ex-ventana__punto" /><span className="ex-ventana__punto" /><span className="ex-ventana__punto" />
          </span>
          <span className="ex-ventana__direccion"><Lock className="ex-icono" aria-hidden="true" />{direccion}</span>
          <span className="ex-ventana__ancho"><Monitor className="ex-icono" aria-hidden="true" />600 px</span>
        </div>
        <div className={`ex-ventana__lienzo${conPieza ? '' : ' ex-ventana__lienzo--vacio'}`}>
          {conPieza && <PiezaRenderizada recorte={recorte} />}
          {!conPieza && fase === 'analizando' && (
            <div className="ex-estado-vacio">
              <span className="ex-estado-vacio__icono"><LoaderCircle className="ex-icono ex-icono--giro" aria-hidden="true" /></span>
              <p className="ex-estado-vacio__titulo">Renderizando la pieza</p>
              <p>En cuanto termine el análisis la ves a 600 px de ancho.</p>
            </div>
          )}
          {!conPieza && fase !== 'analizando' && (
            <div className="ex-estado-vacio">
              <span className="ex-estado-vacio__icono"><FileSearch className="ex-icono" aria-hidden="true" /></span>
              <p className="ex-estado-vacio__titulo">Todavía no hay nada para mostrar</p>
              <p>Pegá el link de una pieza arriba y tocá Analizar para ver cómo se renderiza.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
