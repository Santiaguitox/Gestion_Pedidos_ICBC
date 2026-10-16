import { useMemo, useState } from 'react'
import { ChevronDown, Download, FlaskConical } from 'lucide-react'
import { camposDeBase, generarCsvBaseTest, nombreBaseTest, parsearEmails, tipoCampo, valorPorDefecto } from '../../lib/externo/baseTest.js'

const ETIQUETA_TIPO = { link: 'Link', imagen: 'Imagen', texto: 'Texto' }

function bajar(texto, nombre, tipo) {
  // El BOM al inicio hace que Excel detecte UTF-8 (acentos en los nombres)
  const blob = new Blob(['﻿' + texto], { type: `${tipo};charset=utf-8` })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

// Plegable dentro de la tarjeta de variables: arma una base de contactos de
// prueba con una columna por variable de la pieza.
export default function BaseTest({ html, nombreArchivo }) {
  const { campos, tieneEmail } = useMemo(() => camposDeBase(html), [html])
  const [valores, setValores] = useState({})
  const [emailsTexto, setEmailsTexto] = useState('')
  const { validos, invalidos } = useMemo(() => parsearEmails(emailsTexto), [emailsTexto])

  const valorDe = campo => valores[campo] ?? valorPorDefecto(campo)
  const valoresActuales = Object.fromEntries(campos.map(c => [c, valorDe(c)]))
  const puedeBajar = validos.length > 0 && invalidos.length === 0

  const descargar = extension => {
    const csv = generarCsvBaseTest(campos, valoresActuales, validos)
    bajar(csv, nombreBaseTest(nombreArchivo, extension), extension === 'csv' ? 'text/csv' : 'text/plain')
  }

  return (
    <details className="ex-plegable ex-base-test">
      <summary className="ex-plegable__resumen">
        <FlaskConical className="ex-icono" aria-hidden="true" />
        Generar base de test
        <ChevronDown className="ex-icono ex-plegable__flecha" aria-hidden="true" />
      </summary>
      <div className="ex-plegable__contenido ex-base-test__contenido">
        <p className="ex-nota">
          Una columna Email y una por variable, con una fila por cada email de prueba. Los valores son de ejemplo y podés editarlos.
          {tieneEmail && ' La pieza usa <*Email*>: se completa sola con el email de cada fila.'}
        </p>

        {campos.length > 0 && (
          <div className="ex-tabla-envoltorio">
            <table className="ex-tabla">
              <thead>
                <tr><th scope="col">Variable</th><th scope="col">Tipo</th><th scope="col">Valor de prueba</th></tr>
              </thead>
              <tbody>
                {campos.map(c => (
                  <tr key={c}>
                    <td className="ex-tabla__etiqueta">{c}</td>
                    <td><span className="ex-tipo-link">{ETIQUETA_TIPO[tipoCampo(c)]}</span></td>
                    <td>
                      <input
                        className="ex-entrada"
                        type="text"
                        aria-label={`Valor de prueba de ${c}`}
                        value={valorDe(c)}
                        onChange={e => setValores(v => ({ ...v, [c]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label className="ex-base-test__etiqueta" htmlFor="ex-base-test-emails">Emails de prueba (uno por línea)</label>
        <textarea
          id="ex-base-test-emails"
          className={`ex-entrada ex-entrada--area${invalidos.length ? ' ex-entrada--error' : ''}`}
          rows={3}
          placeholder="test@icomm.com.ar"
          value={emailsTexto}
          onChange={e => setEmailsTexto(e.target.value)}
        />
        {invalidos.length > 0 && (
          <p className="ex-base-test__error" role="alert">
            Revisá el formato de: {invalidos.join(', ')}
          </p>
        )}

        <div className="ex-base-test__acciones">
          <button className="ex-boton ex-boton--secundario ex-boton--chico" type="button" disabled={!puedeBajar} onClick={() => descargar('csv')}>
            <Download className="ex-icono" aria-hidden="true" />Descargar .csv
          </button>
          <button className="ex-boton ex-boton--secundario ex-boton--chico" type="button" disabled={!puedeBajar} onClick={() => descargar('txt')}>
            <Download className="ex-icono" aria-hidden="true" />Descargar .txt
          </button>
          <span className="ex-base-test__nota">{validos.length === 0 ? 'Cargá al menos un email' : `${validos.length} ${validos.length === 1 ? 'fila' : 'filas'}`}</span>
        </div>
      </div>
    </details>
  )
}
