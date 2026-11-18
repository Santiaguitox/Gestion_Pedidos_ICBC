// Marca de TeamWorkHub en las páginas públicas: isotipo, wordmark y el fondo
// con el isotipo grande (igual que la pantalla de login de la app).

import { Link } from 'react-router-dom'

export function Isotipo({ tamano = '' }) {
  return <img className={`ex-isotipo ${tamano}`} src="/icon-512.png" alt="" aria-hidden="true" width="32" height="32" />
}

export function MarcaFondo() {
  return (
    <>
      <Isotipo tamano="ex-marca-fondo ex-marca-fondo--grande" />
      <Isotipo tamano="ex-marca-fondo ex-marca-fondo--chica" />
    </>
  )
}

// Con `to` la marca es un link (a la landing de herramientas); sin `to` queda como texto.
export function Wordmark({ to }) {
  const contenido = (
    <>
      <Isotipo tamano="ex-isotipo--chico" />
      <span className="ex-wordmark">TeamWorkHub<sup>.app</sup></span>
    </>
  )
  if (to) {
    return (
      <Link className="ex-marca ex-marca--enlace" to={to} aria-label="TeamWorkHub, ir al inicio de las herramientas">
        {contenido}
      </Link>
    )
  }
  return <p className="ex-marca">{contenido}</p>
}
