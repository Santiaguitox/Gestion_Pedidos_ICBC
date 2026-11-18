import { Link } from 'react-router-dom'
import HerramientaIcono from './HerramientaIcono.jsx'
import { Isotipo } from '../Marca.jsx'

export default function TarjetaHerramienta({ herramienta }) {
  const { nombre, descripcion, icono, ruta, estado, nuevo } = herramienta
  const proxima = estado === 'proximamente' || !ruta
  const cuerpo = (
    <>
      <Isotipo tamano="ex-landing-iso" />
      <div className="ex-landing-tarjeta__cab">
        <span className="ex-landing-tarjeta__icono">
          <HerramientaIcono nombre={icono} size={24} />
        </span>
        {proxima && <span className="ex-landing-etiqueta">Próximamente</span>}
        {!proxima && nuevo && <span className="ex-landing-etiqueta">Nuevo</span>}
      </div>
      <h2 className="ex-landing-tarjeta__titulo">{nombre}</h2>
      <p className="ex-landing-tarjeta__desc">{descripcion}</p>
      <span className="ex-landing-tarjeta__pie">
        {proxima ? 'Todavía no disponible' : (<>Abrir<HerramientaIcono nombre="flecha" className="ex-landing-tarjeta__flecha" /></>)}
      </span>
    </>
  )
  if (proxima) {
    return <div className="ex-landing-tarjeta ex-landing-tarjeta--proxima" aria-disabled="true">{cuerpo}</div>
  }
  return <Link className="ex-landing-tarjeta" to={ruta}>{cuerpo}</Link>
}
