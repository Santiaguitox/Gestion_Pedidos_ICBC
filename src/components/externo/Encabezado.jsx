import EncabezadoHerramienta from './herramientas/EncabezadoHerramienta.jsx'

export default function Encabezado({ tema, onAlternarTema }) {
  return (
    <EncabezadoHerramienta
      tema={tema}
      onAlternarTema={onAlternarTema}
      actual="analisis"
      titulo="Análisis HTML"
      subtitulo="Pegá el link de una pieza HTML y revisá en un minuto si está lista para salir: estructura, links, imágenes y pesos."
    />
  )
}
