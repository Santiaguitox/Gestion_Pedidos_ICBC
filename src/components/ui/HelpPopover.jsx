import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

const ANCHO_PANEL = 260 // debe coincidir con el width fijo de .help-popover-panel en el CSS

// Ícono de ayuda clickeable que muestra un popover con contenido — usado
// para sacar texto explicativo que antes estaba siempre visible (ocupando
// espacio permanentemente, sobre todo molesto en mobile) y convertirlo en
// algo opcional, que la persona consulta solo si lo necesita.
//
// El panel se ancla a la izquierda del ícono por defecto, pero si el
// ícono está cerca del borde derecho de la pantalla (común cuando el
// popover vive en un header con varios controles a la derecha, como
// "Filtros y vista"), el panel se desbordaría fuera del viewport — para
// evitarlo, se mide la posición real del ícono al abrir y se decide
// dinámicamente si anclar a la izquierda o a la derecha.
export function HelpPopover({ children }) {
  const [open, setOpen] = useState(false)
  const [alinearDerecha, setAlinearDerecha] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function toggleOpen() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      // Si abrir hacia la derecha (comportamiento por defecto) haría que
      // el panel se salga del viewport, se ancla hacia la izquierda en
      // su lugar (el panel "crece" hacia la izquierda del ícono).
      setAlinearDerecha(rect.left + ANCHO_PANEL > window.innerWidth - 16)
    }
    setOpen(v => !v)
  }

  return (
    <div className="help-popover-wrapper" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        className="help-popover-trigger"
        aria-label="Más información"
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <div className={`help-popover-panel ${alinearDerecha ? 'help-popover-panel-derecha' : ''}`}>
          {children}
        </div>
      )}
    </div>
  )
}

