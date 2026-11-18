// Navegación compartida de las páginas públicas: Inicio (la landing) y una
// pestaña por herramienta. En pantallas angostas pasa a ser un menú desplegable.
// Se alimenta de src/lib/externo/herramientas.js.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { itemsDeNavegacion } from '../../../lib/externo/herramientas.js'
import HerramientaIcono from './HerramientaIcono.jsx'

export default function NavHerramientas({ actual }) {
  const items = itemsDeNavegacion()
  const itemActual = items.find(i => i.id === actual) ?? items[0]
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef(null)
  const disparador = useRef(null)

  // Cierra el menú con clic afuera o con Esc
  useEffect(() => {
    if (!abierto) return undefined
    const afuera = e => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false) }
    const tecla = e => {
      if (e.key === 'Escape') {
        setAbierto(false)
        disparador.current?.focus()
      }
    }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  const enlace = (item, enPanel) => {
    const esActual = item.id === itemActual.id
    return (
      <Link
        to={item.ruta}
        className={`ex-nav-item${enPanel ? ' ex-nav-item--panel' : ''}${esActual ? ' ex-nav-item--activo' : ''}`}
        aria-current={esActual ? 'page' : undefined}
        onClick={() => setAbierto(false)}
      >
        <HerramientaIcono nombre={item.icono} />
        <span>{item.nombre}</span>
        {enPanel && esActual && <HerramientaIcono nombre="check" className="ex-nav-item__check" />}
      </Link>
    )
  }

  return (
    <nav className="ex-nav" aria-label="Herramientas" ref={raiz}>
      <ul className="ex-nav-lista">
        {items.map(item => <li key={item.id}>{enlace(item, false)}</li>)}
      </ul>
      <div className="ex-nav-movil">
        <button
          type="button"
          ref={disparador}
          className="ex-nav-disparador"
          aria-expanded={abierto}
          aria-controls="ex-nav-panel"
          onClick={() => setAbierto(v => !v)}
        >
          <HerramientaIcono nombre="menu" size={20} />
          <span className="ex-nav-actual">{itemActual.nombre}</span>
          <HerramientaIcono nombre="chevron" />
        </button>
        {abierto && (
          <ul className="ex-nav-panel" id="ex-nav-panel">
            {items.map(item => <li key={item.id}>{enlace(item, true)}</li>)}
          </ul>
        )}
      </div>
    </nav>
  )
}
