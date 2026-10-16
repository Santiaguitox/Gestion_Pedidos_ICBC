import { Wordmark } from './Marca.jsx'
import SelectorTema from './SelectorTema.jsx'

export default function Encabezado({ tema, onAlternarTema }) {
  return (
    <header className="ex-encabezado">
      <div className="ex-encabezado__barra">
        <Wordmark />
        <SelectorTema tema={tema} onAlternar={onAlternarTema} />
      </div>
      <div className="ex-encabezado__titulos">
        <h1 className="ex-encabezado__titulo">Análisis de piezas</h1>
        <p className="ex-encabezado__subtitulo">
          Pegá el link de una pieza HTML y revisá en un minuto si está lista para salir: estructura, links, imágenes y pesos.
        </p>
      </div>
    </header>
  )
}
