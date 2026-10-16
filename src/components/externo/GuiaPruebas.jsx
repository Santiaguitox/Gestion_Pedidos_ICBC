import { CircleCheck, CircleDashed, LoaderCircle } from 'lucide-react'
import { PRUEBAS } from '../../lib/externo/puntaje.js'

const TEXTO = { pendiente: 'Pendiente', verificando: 'Verificando', lista: 'Lista' }

function IconoEstado({ estado }) {
  if (estado === 'lista') return <CircleCheck className="ex-icono" aria-hidden="true" />
  if (estado === 'verificando') return <LoaderCircle className="ex-icono ex-icono--giro" aria-hidden="true" />
  return <CircleDashed className="ex-icono" aria-hidden="true" />
}

// "Qué revisamos": antes de analizar muestra las 7 pruebas pendientes y,
// mientras analiza, cuáles ya están listas.
export default function GuiaPruebas({ estados = {}, analizando = false }) {
  const listas = PRUEBAS.filter(p => estados[p.clave] === 'lista').length
  return (
    <section className="ex-informe" aria-labelledby="ex-guia-titulo">
      <div className="ex-informe__cabecera">
        <h2 className="ex-seccion-titulo" id="ex-guia-titulo">Qué revisamos</h2>
        <span className="ex-informe__cabecera-nota">{analizando ? `${listas} de ${PRUEBAS.length} listas` : `${PRUEBAS.length} pruebas`}</span>
      </div>
      <ol className="ex-guia__lista">
        {PRUEBAS.map(p => {
          const estado = estados[p.clave] || 'pendiente'
          const clase = estado === 'lista' ? ' ex-guia__fila--listo' : estado === 'verificando' ? ' ex-guia__fila--activa' : ''
          return (
            <li key={p.clave} className={`ex-guia__fila${clase}`}>
              <span className="ex-guia__numero">{p.numero}</span>
              <span className="ex-guia__nombre">{p.titulo}</span>
              <span className="ex-guia__estado"><IconoEstado estado={estado} />{TEXTO[estado]}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
