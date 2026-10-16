import { CircleAlert, CircleCheck, CircleX, Info, Wrench } from 'lucide-react'
import MenuDescarga from './MenuDescarga.jsx'
import { formatoPeso } from '../../lib/externo/formato.js'

function Tramo({ clase, n }) {
  if (!n) return null
  return <span className={`ex-barra-estado__tramo ex-barra-estado__tramo--${clase}`} style={{ '--n': n }} />
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

export default function PuntajeInforme({ puntaje, recorte, nombreArchivo, onDescargar, onDescargarOriginal, onCopiar }) {
  const { okN, warnN, errN, detalleMenorN, score, total } = puntaje
  return (
    <section className="ex-puntaje" aria-label="Puntaje del análisis">
      <div className="ex-puntaje__principal">
        <p className="ex-puntaje__titulo">
          <span className="ex-puntaje__cifra">{score} de {total}</span> pruebas superadas
        </p>
        <div
          className="ex-barra-estado"
          role="img"
          aria-label={`${plural(okN, 'correcta', 'correctas')}, ${plural(warnN, 'advertencia', 'advertencias')}, ${plural(errN, 'error', 'errores')}`}
        >
          <Tramo clase="ok" n={okN} />
          <Tramo clase="aviso" n={warnN} />
          <Tramo clase="error" n={errN} />
        </div>
        <div className="ex-conteos">
          <span className="ex-insignia ex-insignia--ok"><CircleCheck className="ex-icono" aria-hidden="true" />{plural(okN, 'correcta', 'correctas')}</span>
          <span className="ex-insignia ex-insignia--aviso"><CircleAlert className="ex-icono" aria-hidden="true" />{plural(warnN, 'advertencia', 'advertencias')}</span>
          <span className="ex-insignia ex-insignia--error"><CircleX className="ex-icono" aria-hidden="true" />{plural(errN, 'error', 'errores')}</span>
          {detalleMenorN > 0 && (
            <span className="ex-insignia ex-insignia--menor"><Info className="ex-icono" aria-hidden="true" />{plural(detalleMenorN, 'detalle menor', 'detalles menores')}</span>
          )}
        </div>
      </div>
      <div className="ex-puntaje__accion">
        <MenuDescarga onDescargar={onDescargar} onDescargarOriginal={onDescargarOriginal} onCopiar={onCopiar} arreglos={recorte.arreglos + (recorte.protegidos || 0) + (recorte.extensiones || 0)} />
        <span className="ex-puntaje__nota">{nombreArchivo} · {formatoPeso(recorte.bytes)}</span>
        {(recorte.arreglos > 0 || recorte.protegidos > 0 || recorte.extensiones > 0) && (
          <span className="ex-puntaje__nota ex-puntaje__nota--arreglo" title="Se aplica en la descarga y en la copia al portapapeles">
            <Wrench className="ex-icono" aria-hidden="true" />
            <span className="ex-puntaje__arreglos">
              {recorte.arreglos > 0 && <span>{plural(recorte.arreglos, 'etiqueta corregida', 'etiquetas corregidas')}</span>}
              {recorte.protegidos > 0 && <span>{plural(recorte.protegidos, 'comentario del editor repuesto', 'comentarios del editor repuestos')}</span>}
              {recorte.extensiones > 0 && <span>{plural(recorte.extensiones, 'bloque de extensión sacado', 'bloques de extensión sacados')} ({formatoPeso(recorte.bytesExtensiones)})</span>}
            </span>
          </span>
        )}
      </div>
    </section>
  )
}
