// Pestaña Guía: cómo funciona el campo tipo tabla, con dos ejemplos que se
// arman con el mismo generador que el diseñador, y un kit de prueba (base CSV y
// HTML del template) para mandarse un test.

import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { AccionesArchivo, Panel, TextoConSeparadores } from './Controles.jsx'
import VistaBandeja from './VistaBandeja.jsx'
import { EJEMPLOS, EMAIL_EJEMPLO, celdasDeBase } from '../../../lib/externo/estructuras/ejemplos.js'
import { generarCsv } from '../../../lib/externo/estructuras/pedido.js'
import { filaTotal, htmlParaPlataforma, vistaDeEmail } from '../../../lib/externo/estructuras/pieza.js'

const MARCADOR_TOTAL = '&lt;*total*&gt;'

export default function Guia({ alImplementar }) {
  const [id, setId] = useState('basica')
  const [email, setEmail] = useState(EMAIL_EJEMPLO)
  const [vista, setVista] = useState('resultado')
  const [resaltado, setResaltado] = useState(null)
  const ej = EJEMPLOS[id]
  const { config } = ej
  const nombre = config.nombreCampo

  const k = useMemo(() => {
    const pedido = { variables: ej.variables, contactos: [{ email: email.trim() || EMAIL_EJEMPLO, vars: ej.valores, filas: ej.filas }] }
    const resultado = vista === 'resultado'
    const extra = ej.total ? filaTotal(config, resultado ? ej.total : MARCADOR_TOTAL) : ''
    return {
      csv: generarCsv(config, pedido),
      html: htmlParaPlataforma(config, { extraAbajo: ej.total ? filaTotal(config, MARCADOR_TOTAL) : '' }),
      vista: vistaDeEmail(config, ej.filas, { extraAbajo: extra, modo: resultado ? 'ejemplo' : 'plantilla' }),
      celdas: celdasDeBase(ej),
    }
  }, [ej, config, email, vista])

  const cambiarEjemplo = nuevo => {
    setId(nuevo)
    setResaltado(null)
  }
  const enfocar = (fila, col = null) => ({
    onMouseEnter: () => setResaltado({ fila, col }),
    onFocus: () => setResaltado({ fila, col }),
    onMouseLeave: () => setResaltado(null),
    onBlur: () => setResaltado(null),
  })

  const campos = ['email', ...ej.variables, nombre]
  const valores = [email || EMAIL_EJEMPLO, ...ej.valores]

  return (
    <div className="ex-est-cuerpo">
      <div className="ex-est-columna">
        <div className="ex-est-selector" role="tablist" aria-label="Ejemplo">
          {Object.values(EJEMPLOS).map(e => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={id === e.id}
              className="ex-est-selector__tab"
              onClick={() => cambiarEjemplo(e.id)}
            >
              {e.titulo}
            </button>
          ))}
        </div>
        <p className="ex-est-resumen">{ej.resumen}</p>

        <Panel paso="1" titulo="Base de datos" ayuda="Toda la información que se utiliza para completar la tabla debe estar incluida en un único campo de la base.">
          <div className="ex-est-tablaCsv" role="region" aria-label="Base de datos de ejemplo" tabIndex={0}>
            <table>
              <thead>
                <tr>{campos.map(c => <th key={c}><code>{c}</code></th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  {valores.map((v, i) => <td key={i}>{v}</td>)}
                  <td><span className="ex-est-pastilla">{nombre}</span> <span className="ex-est-tenue">las filas de la tabla (se explican en el paso 2)</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          paso="2"
          titulo="¿Cómo debe estructurarse este campo en la base?"
          ayuda={<>Para generar una estructura tipo tabla, cada celda debe separarse de la siguiente con <span className="ex-est-sep ex-est-sep--col">||</span> (salto de columna →) y cada fila debe terminar con <span className="ex-est-sep ex-est-sep--fila">##</span> (salto de fila ↓), incluida la última.</>}
        >
          <h3 className="ex-est-subtitulo">Representación gráfica de la estructura</h3>
          <p className="ex-est-campo__ayuda">Pasá el mouse sobre las celdas o los números de fila para identificar cómo se interpreta cada dato en el resultado.</p>
          <div className="ex-est-tablaCsv ex-est-tablaCsv--datos" role="region" aria-label="Contenido del campo tipo tabla" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th className="ex-est-th-num" />
                  {config.columnas.map((c, i) => (
                    <th key={c.id} className="ex-est-th-cab">
                      <button type="button" className="ex-est-celda ex-est-celda--cab" {...enfocar(0, i)}>{c.titulo}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {k.celdas.map((fila, r) => (
                  <tr key={r}>
                    <td className="ex-est-th-num">
                      <button type="button" className="ex-est-fila-num" aria-label={`Resaltar la fila ${r + 1}`} {...enfocar(r + 1)}>{r + 1}</button>
                    </td>
                    {fila.map((valor, c) => {
                      const col = config.columnas[c]
                      const esImg = col.tipo === 'imagen'
                      return (
                        <td key={c} className="ex-est-td-dato">
                          <button type="button" className="ex-est-celda" {...enfocar(r + 1, c)}>
                            {esImg ? <code className="ex-est-celda__img">&lt;img …&gt;</code> : valor}
                          </button>
                          <span className={`ex-est-sep ex-est-sep--${c === fila.length - 1 ? 'fila' : 'col'} ex-est-sep--${c === fila.length - 1 ? 'borde' : 'divisor'}`} title={c === fila.length - 1 ? 'salto de fila' : 'salto de columna'}>
                            {c === fila.length - 1 ? '##' : '||'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="ex-est-leyenda">
            <li><span className="ex-est-sep ex-est-sep--col">||</span> salto de columna →</li>
            <li><span className="ex-est-sep ex-est-sep--fila">##</span> salto de fila ↓</li>
          </ul>
          <h3 className="ex-est-subtitulo">Otras consideraciones</h3>
          <ul className="ex-est-reglas">
            <li><strong>Ubicación del campo:</strong> el campo tipo tabla debe ubicarse al final de la base, ya que su contenido puede incluir caracteres como <code>;</code> (por ejemplo, dentro de un <code>&lt;img style="…;…"&gt;</code>), que podrían interpretarse como delimitadores.</li>
            <li><strong>Separadores:</strong> ninguna celda puede contener <code>||</code> ni <code>##</code> como parte de sus datos, porque se interpretarían como saltos de columna o de fila.</li>
            <li><strong>Configuración en icomm:</strong> al crear la base en la plataforma, este campo debe configurarse como tipo tabla.</li>
            <li><strong>Nombre del campo:</strong> como sucede con cualquier variable de icomm, el nombre debe coincidir exactamente en la base y en el HTML. Esto incluye el marcador que identifica la estructura en el template: <code>&lt;!--CampoTabla_{nombre}--&gt;</code>.</li>
            <li><strong>Encabezados:</strong> los encabezados de las columnas se definen directamente en el HTML del template. No forman parte de los datos enviados en la base.</li>
            {ej.total && <li><strong>Total:</strong> en este ejemplo, el total es otro campo de la base (<code>total</code>) que el template muestra con <code>{'<*total*>'}</code>. No forma parte de la tabla.</li>}
          </ul>
        </Panel>

        <Panel paso="3" titulo="Generá tu envío de test en la plataforma" ayuda="Descargá la base y el HTML usados en este ejemplo, subilos a la plataforma y configurá el envío de test para ver cómo se visualiza en tu bandeja de entrada.">
          <label className="ex-est-campo__etiqueta" htmlFor="ex-est-email-prueba">Tu email de prueba</label>
          <input
            id="ex-est-email-prueba"
            className="ex-est-input"
            type="email"
            value={email}
            spellCheck={false}
            autoComplete="off"
            onChange={e => setEmail(e.target.value)}
          />
          <div className="ex-est-kit">
            <div className="ex-est-kit__cab">
              <div>
                <h3 className="ex-est-kit__titulo">Base de prueba</h3>
                <p className="ex-est-kit__ayuda">Archivo CSV con los datos de ejemplo, listo para importar en icomm. Los campos están separados por <code>;</code>.</p>
              </div>
              <AccionesArchivo texto={k.csv} nombreArchivo={`base_prueba_${id}.csv`} tipo="text/csv" saltosCrlf />
            </div>
            <pre className="ex-est-codigo"><code><TextoConSeparadores texto={k.csv} /></code></pre>
          </div>
          <div className="ex-est-kit">
            <div className="ex-est-kit__cab">
              <div>
                <h3 className="ex-est-kit__titulo">HTML de prueba</h3>
                <p className="ex-est-kit__ayuda">Email completo con estilos, encabezado, textos, tabla y pie. Listo para cargar como HTML de un envío de prueba.</p>
              </div>
              <AccionesArchivo texto={k.html} nombreArchivo={`email_prueba_${id}.html`} tipo="text/html" />
            </div>
            <pre className="ex-est-codigo"><code>{k.html}</code></pre>
          </div>
        </Panel>

        <button type="button" className="ex-est-enlace-paso" onClick={alImplementar}>
          ¿Tenés que armar la tabla para un cliente? Implementala con su marca
          <ArrowRight className="ex-icono" aria-hidden="true" />
        </button>
      </div>

      <aside className="ex-est-lateral" aria-label="Vista de la pieza">
        <div className="ex-est-segmentado ex-est-segmentado--ancho" role="group" aria-label="Qué mostrar">
          <button type="button" className="ex-est-segmentado__op" aria-pressed={vista === 'resultado'} onClick={() => setVista('resultado')}>Resultado en bandeja</button>
          <button type="button" className="ex-est-segmentado__op" aria-pressed={vista === 'plantilla'} onClick={() => setVista('plantilla')}>Template en icomm</button>
        </div>
        <VistaBandeja
          html={k.vista}
          resaltado={resaltado}
          etiqueta={vista === 'resultado' ? 'Así la ve la persona en su bandeja' : 'Así se incorpora al template: la plataforma completa las filas con los datos de cada contacto al realizar el envío.'}
        />
      </aside>
    </div>
  )
}
