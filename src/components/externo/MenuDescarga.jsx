import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Download, FileDown } from 'lucide-react'

// Botón partido: el principal descarga el HTML; la flecha abre el menú con el
// resto de las formas de llevarse la pieza (copiar al portapapeles).
// Las acciones reciben `indentado`: true si se hizo clic con Shift apretado.
// Sin Shift sale minificado; con Shift, indentado (para leerlo en el editor).
export default function MenuDescarga({ onDescargar, onDescargarOriginal, onCopiar, arreglos = 0 }) {
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [falloCopia, setFalloCopia] = useState(false)
  const raiz = useRef(null)
  const temporizador = useRef(0)

  useEffect(() => {
    if (!abierto) return undefined
    const fuera = e => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false) }
    const tecla = e => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const copiar = useCallback(async e => {
    const ok = await onCopiar(e.shiftKey)
    setFalloCopia(!ok)
    setCopiado(ok)
    setAbierto(false)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => { setCopiado(false); setFalloCopia(false) }, 2500)
  }, [onCopiar])

  return (
    <div className="ex-menu" ref={raiz}>
      <div className="ex-boton-partido">
        <button className="ex-boton ex-boton--descarga ex-boton-partido__principal" type="button" title="Minificado. Con Shift, indentado" onClick={e => onDescargar(e.shiftKey)}>
          <Download className="ex-icono" aria-hidden="true" />
          Descargar HTML
        </button>
        <button
          className="ex-boton ex-boton--descarga ex-boton-partido__flecha"
          type="button"
          aria-haspopup="menu"
          aria-expanded={abierto}
          aria-label="Más opciones"
          onClick={() => setAbierto(v => !v)}
        >
          <ChevronDown className="ex-icono" aria-hidden="true" />
        </button>
      </div>
      {abierto && (
        <div className="ex-menu__lista" role="menu">
          <button className="ex-menu__item" type="button" role="menuitem" onClick={e => { onDescargar(e.shiftKey); setAbierto(false) }}>
            <Download className="ex-icono" aria-hidden="true" />Descargar .html
          </button>
          {arreglos > 0 && (
            <button className="ex-menu__item" type="button" role="menuitem" onClick={e => { onDescargarOriginal(e.shiftKey); setAbierto(false) }}>
              <FileDown className="ex-icono" aria-hidden="true" />Descargar sin corregir
            </button>
          )}
          <button className="ex-menu__item" type="button" role="menuitem" onClick={copiar}>
            <Copy className="ex-icono" aria-hidden="true" />Copiar HTML al portapapeles
          </button>
          <div className="ex-menu__separador" role="separator" />
          <p className="ex-menu__pista"><kbd className="ex-tecla">Shift</kbd><span>+ clic: código indentado</span></p>
        </div>
      )}
      <p className="ex-menu__estado" role="status" aria-live="polite">
        {copiado && <><Check className="ex-icono" aria-hidden="true" />HTML copiado al portapapeles</>}
        {falloCopia && 'No se pudo copiar. Probá descargar el HTML.'}
      </p>
    </div>
  )
}
