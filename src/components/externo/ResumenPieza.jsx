import { Code, FileCode, Image, Images, LayoutTemplate, Link as LinkIcon } from 'lucide-react'
import { formatoNumero, formatoKb, partesPeso } from '../../lib/externo/formato.js'

const TIPOS = {
  custom: { texto: 'HTML custom', clase: 'ex-etiqueta-tipo--custom', Icono: Code },
  editor: { texto: 'Editor de icomm', clase: 'ex-etiqueta-tipo--editor', Icono: LayoutTemplate },
}

function Dato({ Icono, etiqueta, children }) {
  return (
    <div className="ex-dato">
      <span className="ex-dato__icono"><Icono className="ex-icono" aria-hidden="true" /></span>
      <div className="ex-dato__texto">
        <span className="ex-dato__etiqueta">{etiqueta}</span>
        {children}
      </div>
    </div>
  )
}

function Valor({ valor, unidad }) {
  return <span className="ex-dato__valor">{valor}{unidad && <span className="ex-dato__unidad">{unidad}</span>}</span>
}

export default function ResumenPieza({ resumen }) {
  const peso = partesPeso(resumen.pesoImagenesBytes)
  const tipo = TIPOS[resumen.tipo]
  return (
    <section className="ex-resumen" aria-label="Resumen de la pieza">
      <Dato Icono={Image} etiqueta="Imágenes"><Valor valor={formatoNumero(resumen.imagenes)} /></Dato>
      <Dato Icono={LinkIcon} etiqueta="Links"><Valor valor={formatoNumero(resumen.links)} /></Dato>
      <Dato Icono={FileCode} etiqueta="Peso del HTML">
        <Valor valor={formatoKb(resumen.pesoHTMLkb).replace(' kb', '')} unidad="kb" />
      </Dato>
      <Dato Icono={Images} etiqueta="Peso de imágenes">
        <Valor valor={peso.valor} unidad={peso.unidad} />
      </Dato>
      <Dato Icono={LayoutTemplate} etiqueta="Tipo de pieza">
        {tipo ? (
          <span className={`ex-etiqueta-tipo ${tipo.clase}`}><tipo.Icono className="ex-icono" aria-hidden="true" />{tipo.texto}</span>
        ) : (
          <span className="ex-etiqueta-tipo ex-etiqueta-tipo--ninguno">No reconocido</span>
        )}
      </Dato>
    </section>
  )
}
