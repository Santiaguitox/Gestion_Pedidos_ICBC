// Marca de TeamWorkHub en las páginas públicas: isotipo, wordmark y el fondo
// con el isotipo grande (igual que la pantalla de login de la app).

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

export function Wordmark() {
  return (
    <p className="ex-marca">
      <Isotipo tamano="ex-isotipo--chico" />
      <span className="ex-wordmark">TeamWorkHub<sup>.app</sup></span>
    </p>
  )
}
