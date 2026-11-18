// Encabezado común de las páginas públicas: marca (link a la landing), selector
// de tema, navegación entre herramientas y título.

import { Wordmark } from '../Marca.jsx'
import SelectorTema from '../SelectorTema.jsx'
import { RUTA_INICIO } from '../../../lib/externo/herramientas.js'
import NavHerramientas from './NavHerramientas.jsx'

export default function EncabezadoHerramienta({ tema, onAlternarTema, actual, titulo, subtitulo }) {
  return (
    <header className="ex-encabezado">
      <div className="ex-encabezado__barra">
        <Wordmark to={RUTA_INICIO} />
        <SelectorTema tema={tema} onAlternar={onAlternarTema} />
      </div>
      <NavHerramientas actual={actual} />
      <div className="ex-encabezado__titulos">
        <h1 className="ex-encabezado__titulo">{titulo}</h1>
        {subtitulo && <p className="ex-encabezado__subtitulo">{subtitulo}</p>}
      </div>
    </header>
  )
}
