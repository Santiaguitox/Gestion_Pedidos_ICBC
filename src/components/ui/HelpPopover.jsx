import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

const ANCHO_PANEL = 260 // debe coincidir con el width fijo de .help-popover-panel en el CSS
const ALTO_PANEL_ESTIMADO = 130 // estimación conservadora — el contenido es variable, no se puede medir antes de montarlo

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
//
// Mismo problema pero vertical: si el ícono vive dentro de un modal con
// scroll (ej. un checkbox a mitad de un formulario largo) y no hay
// suficiente espacio visible debajo, el panel — que por defecto se abre
// hacia abajo — quedaba recortado por el overflow del contenedor
// scrolleable, ilegible. Se mide también el espacio disponible debajo
// vs. arriba del ícono al abrir, y si no alcanza, se abre hacia arriba.
export function HelpPopover({ children }) {
  const [open, setOpen] = useState(false)
  const [alinearDerecha, setAlinearDerecha] = useState(false)
  const [abrirArriba, setAbrirArriba] = useState(false)
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
      // El popover suele vivir dentro de un modal centrado, mucho más
      // angosto que la ventana del navegador — medir contra
      // window.innerWidth/innerHeight decía "entra perfecto" aunque en
      // los hechos se saliera de la tarjeta blanca del modal hacia el
      // fondo oscuro. Si hay un .modal como ancestro, se mide contra
      // SUS bordes en vez de los de la ventana; si no (ej. la barra de
      // filtros de Pedidos, que no es un modal), se sigue usando la
      // ventana como antes.
      const contenedor = ref.current.closest('.modal')
      const limites = contenedor ? contenedor.getBoundingClientRect() : { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }
      // Si abrir hacia la derecha (comportamiento por defecto) haría que
      // el panel se salga del contenedor, se ancla hacia la izquierda en
      // su lugar (el panel "crece" hacia la izquierda del ícono).
      setAlinearDerecha(rect.left + ANCHO_PANEL > limites.right - 16)
      // Mismo criterio para el eje vertical: si no hay lugar suficiente
      // debajo pero sí arriba, se abre hacia arriba.
      const espacioAbajo = limites.bottom - rect.bottom
      const espacioArriba = rect.top - limites.top
      setAbrirArriba(espacioAbajo < ALTO_PANEL_ESTIMADO && espacioArriba > espacioAbajo)
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
        <div className={`help-popover-panel ${alinearDerecha ? 'help-popover-panel-derecha' : ''} ${abrirArriba ? 'help-popover-panel-arriba' : ''}`}>
          {children}
        </div>
      )}
    </div>
  )
}

