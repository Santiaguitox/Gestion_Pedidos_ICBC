// Pasos de diseño de "Implementar": campo y márgenes, encabezado, filas y columnas.
// Cada uno es el contenido de un panel plegable; el orden y la vista previa los
// maneja Implementar.jsx.

import { useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { Avisos, Ayudita, Campo, Color, Contador, Interruptor, Numero, Segmentado } from './Controles.jsx'
import { DOBLE_MIN, ESTILOS_BORDE, FUENTES, MARGEN_MAX, MAX_COLUMNAS } from '../../../lib/externo/estructuras/constantes.js'
import { anchoColumnaPx, anchoTabla, maxAnchoImagen, repartirAnchos } from '../../../lib/externo/estructuras/bloque.js'
import { agregarColumna, quitarColumna } from '../../../lib/externo/estructuras/estado.js'
import { columnaTieneDatos } from '../../../lib/externo/estructuras/pedido.js'
import { normalizarNombre } from '../../../lib/externo/estructuras/nombre.js'

const ALINEACIONES = [
  { valor: 'left', etiqueta: 'Izq.', titulo: 'Alinear a la izquierda' },
  { valor: 'center', etiqueta: 'Centro', titulo: 'Centrar' },
  { valor: 'right', etiqueta: 'Der.', titulo: 'Alinear a la derecha' },
]
const TIPOS = [
  { valor: 'texto', etiqueta: 'Texto' },
  { valor: 'imagen', etiqueta: 'Imagen' },
]
const SEPARACION = [
  { valor: 'ninguna', etiqueta: 'Ninguna' },
  { valor: 'linea', etiqueta: 'Línea' },
  { valor: 'espacio', etiqueta: 'Espacio' },
]

const AVISO_OUTLOOK =
  'Outlook de escritorio puede mostrar los bordes rayados, punteados o dobles de forma diferente. Gmail, Apple Mail y otros clientes suelen respetarlos. Para lograr mayor compatibilidad, usá bordes sólidos.'

/** El borde doble solo se ve doble con 3 px o más de grosor. */
function avisoDoble(borde) {
  if (borde.estilo !== 'double' || Number(borde.ancho) >= DOBLE_MIN) return undefined
  return `Para que el borde se vea doble, necesita un grosor mínimo de ${DOBLE_MIN} px. Con ${Number(borde.ancho) || 0} px se muestra como una línea común.`
}

function SelectorEstilo({ valor, onChange, ariaLabel }) {
  return (
    <Campo etiqueta="Estilo" extra={<Ayudita etiqueta="Sobre los estilos de borde en Outlook">{AVISO_OUTLOOK}</Ayudita>}>
      {id => (
        <select id={id} className="ex-est-input" value={valor || 'solid'} aria-label={ariaLabel} onChange={e => onChange(e.target.value)}>
          {ESTILOS_BORDE.map(e => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
        </select>
      )}
    </Campo>
  )
}

function Bordes({ titulo, bordes, borde, lados, onBordes, onBorde }) {
  return (
    <fieldset className="ex-est-grupo">
      <legend className="ex-est-grupo__titulo">{titulo}</legend>
      <div className="ex-est-fila-controles">
        {lados.map(([clave, texto]) => (
          <Interruptor key={clave} marcado={Boolean(bordes[clave])} onChange={v => onBordes(clave, v)}>{texto}</Interruptor>
        ))}
      </div>
      <div className="ex-est-rejilla ex-est-rejilla--3">
        <Campo etiqueta="Grosor" aviso={avisoDoble(borde)}>{id => <Numero id={id} valor={borde.ancho} min={0} max={20} sufijo="px" onChange={v => onBorde('ancho', v)} />}</Campo>
        <SelectorEstilo valor={borde.estilo} onChange={v => onBorde('estilo', v)} ariaLabel={`Estilo del borde: ${titulo}`} />
        <Campo etiqueta="Color">{id => <Color id={id} valor={borde.color} onChange={v => onBorde('color', v)} ariaLabel={`Color del borde: ${titulo}`} />}</Campo>
      </div>
    </fieldset>
  )
}

/** Paso 1 · Campo y márgenes */
export function PasoCampo({ config, cambiar, avisos, ancho, nombreAjustado, setNombreAjustado }) {
  const nombreAviso = avisos.find(a => a.campo === 'nombreCampo')
  const escribirNombre = valor => {
    const limpio = normalizarNombre(valor, { recortar: false })
    setNombreAjustado(limpio !== valor)
    cambiar(['nombreCampo'], limpio)
  }
  return (
    <div className="ex-est-rejilla">
      <Campo
        etiqueta="Nombre del campo tipo tabla"
        error={nombreAviso?.mensaje}
        ayuda={nombreAjustado ? 'Se ajustó el nombre: los espacios y guiones se reemplazaron por _ y se quitaron símbolos y acentos.' : 'Usá solo letras, números y guiones bajos (_).'}
      >
        {id => (
          <input
            id={id}
            className="ex-est-input"
            type="text"
            spellCheck={false}
            autoComplete="off"
            value={config.nombreCampo}
            aria-invalid={Boolean(nombreAviso) || undefined}
            onChange={e => escribirNombre(e.target.value)}
          />
        )}
      </Campo>
      <Campo
        etiqueta="Margen horizontal"
        error={avisos.find(a => a.campo === 'margen')?.mensaje}
        ayuda={`Espacio a cada lado de la tabla. La tabla queda de ${ancho} px (600 − 2 × margen).`}
      >
        {id => <Numero id={id} valor={config.margen} min={0} max={MARGEN_MAX} sufijo="px" onChange={v => cambiar(['margen'], v)} />}
      </Campo>
      <Campo etiqueta="Color de fondo del bloque">{id => <Color id={id} valor={config.fondoContenedor} onChange={v => cambiar(['fondoContenedor'], v)} ariaLabel="Color de fondo del bloque" />}</Campo>
      <Campo etiqueta="Tipografía" ayuda="Fuentes de sistema para mejorar la compatibilidad entre clientes de mail.">
        {id => (
          <select id={id} className="ex-est-input" value={config.fuente} onChange={e => cambiar(['fuente'], e.target.value)}>
            {FUENTES.map(f => <option key={f.id} value={f.id}>{f.etiqueta}</option>)}
          </select>
        )}
      </Campo>
    </div>
  )
}

/** Paso 2 · Encabezado de la tabla: cantidad de columnas, nombres y estilo del encabezado */
export function PasoEncabezado({ config, pedido, cambiar, cambiarColumna, setEstado, enfocar }) {
  const n = config.columnas.length
  const [pendiente, setPendiente] = useState(null) // índice de la columna con contenido que se quiere quitar
  // Si la columna tiene contenido cargado en la base de prueba, primero se pide confirmación
  const pedirQuitar = i => {
    if (columnaTieneDatos(pedido, i)) setPendiente(i)
    else setEstado(e => quitarColumna(e, i))
  }
  const cambiarCantidad = nueva => {
    if (nueva > n) setEstado(e => agregarColumna(e))
    else if (nueva < n) pedirQuitar(n - 1)
  }
  const pend = pendiente != null && pendiente < n ? config.columnas[pendiente] : null
  return (
    <>
      <div className="ex-est-cantidad">
        <span className="ex-est-campo__etiqueta" id="ex-est-etq-cantidad">Cantidad de columnas</span>
        <Contador valor={n} min={1} max={MAX_COLUMNAS} etiqueta="Cantidad de columnas" onChange={cambiarCantidad} />
        <span className="ex-est-campo__ayuda">Podés crear de 1 a {MAX_COLUMNAS} columnas. Si cambiás la cantidad, los anchos se ajustan automáticamente. Podés modificarlos en el paso 4.</span>
      </div>
      {pend && (
        <div className="ex-est-aviso ex-est-aviso--aviso ex-est-confirmar" role="alert">
          <p>La columna {pendiente + 1}{pend.sinTitulo || !pend.titulo.trim() ? '' : ` («${pend.titulo.trim()}»)`} tiene contenido cargado en el paso 5. Si la eliminás, ese contenido se perderá.</p>
          <div className="ex-est-fila-controles">
            <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico ex-est-peligro" onClick={() => { setEstado(e => quitarColumna(e, pendiente)); setPendiente(null) }}>Quitar igual</button>
            <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={() => setPendiente(null)}>Cancelar</button>
          </div>
        </div>
      )}
      <ol className="ex-est-nombres">
        {config.columnas.map((col, i) => (
          <li key={col.id} className="ex-est-nombre" onMouseEnter={() => enfocar(i)} onMouseLeave={() => enfocar(null)} onFocus={() => enfocar(i)} onBlur={() => enfocar(null)}>
            <div className="ex-est-nombre__fila">
              <span className="ex-est-col__num" aria-hidden="true">{i + 1}</span>
              <input
                className="ex-est-input"
                type="text"
                value={col.titulo}
                disabled={col.sinTitulo}
                placeholder={`Encabezado de la columna ${i + 1}`}
                aria-label={`Encabezado de la columna ${i + 1}`}
                onChange={e => cambiarColumna(i, { titulo: e.target.value })}
              />
              {n > 1 && (
                <button type="button" className="ex-est-icono-btn" aria-label={`Quitar la columna ${i + 1}`} title="Quitar columna" onClick={() => pedirQuitar(i)}>
                  <Trash2 className="ex-icono" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="ex-est-nombre__opciones">
              <Interruptor marcado={Boolean(col.sinTitulo)} onChange={v => cambiarColumna(i, { sinTitulo: v })}>Dejar encabezado vacío</Interruptor>
              <Campo etiqueta="Fondo">{id => <Color id={id} valor={col.encabezadoFondo} opcional placeholder="general" onChange={v => cambiarColumna(i, { encabezadoFondo: v })} ariaLabel={`Fondo del encabezado de la columna ${i + 1}`} />}</Campo>
              <Campo etiqueta="Color del texto">{id => <Color id={id} valor={col.encabezadoColor} opcional placeholder="general" onChange={v => cambiarColumna(i, { encabezadoColor: v })} ariaLabel={`Color del texto del encabezado de la columna ${i + 1}`} />}</Campo>
            </div>
          </li>
        ))}
      </ol>
      <fieldset className="ex-est-grupo">
        <legend className="ex-est-grupo__titulo">Estilo del encabezado</legend>
        <div className="ex-est-rejilla">
          <Campo etiqueta="Color de fondo general" ayuda="Se aplica a las columnas que no tienen un color de fondo propio.">{id => <Color id={id} valor={config.encabezado.fondo} onChange={v => cambiar(['encabezado', 'fondo'], v)} ariaLabel="Fondo del encabezado" />}</Campo>
          <Campo etiqueta="Color del texto (general)">{id => <Color id={id} valor={config.encabezado.color} onChange={v => cambiar(['encabezado', 'color'], v)} ariaLabel="Color del texto del encabezado" />}</Campo>
          <Campo etiqueta="Tamaño de letra">{id => <Numero id={id} valor={config.encabezado.tamano} min={8} max={40} sufijo="px" onChange={v => cambiar(['encabezado', 'tamano'], v)} />}</Campo>
          <Campo etiqueta="Interlineado">{id => <Numero id={id} valor={config.encabezado.interlineado} min={8} max={60} sufijo="px" onChange={v => cambiar(['encabezado', 'interlineado'], v)} />}</Campo>
          <Campo etiqueta="Alto mínimo (opcional)" ayuda="Si lo dejás vacío, el alto se ajusta al contenido.">{id => <Numero id={id} valor={config.encabezado.alto} min={10} max={200} sufijo="px" placeholder="auto" onChange={v => cambiar(['encabezado', 'alto'], v)} />}</Campo>
          <Campo etiqueta="Relleno vertical">{id => <Numero id={id} valor={config.encabezado.paddingV} min={0} max={40} sufijo="px" onChange={v => cambiar(['encabezado', 'paddingV'], v)} />}</Campo>
        </div>
        <Campo etiqueta="Alineación del texto">
          {() => (
            <Segmentado
              opciones={[{ valor: 'columna', etiqueta: 'Como la columna', titulo: 'Cada encabezado se alinea igual que el contenido de su columna' }, ...ALINEACIONES]}
              valor={config.encabezado.alineacion || 'columna'}
              onChange={v => cambiar(['encabezado', 'alineacion'], v)}
              ariaLabel="Alineación del texto del encabezado"
            />
          )}
        </Campo>
        <Interruptor marcado={config.encabezado.negrita} onChange={v => cambiar(['encabezado', 'negrita'], v)}>Texto en negrita</Interruptor>
      </fieldset>
      <Bordes
        titulo="Bordes del encabezado"
        bordes={config.encabezado.bordes}
        borde={config.encabezado.borde}
        lados={[['arriba', 'Arriba'], ['abajo', 'Abajo'], ['izquierda', 'Izquierda'], ['derecha', 'Derecha'], ['divisores', 'Entre columnas']]}
        onBordes={(k, v) => cambiar(['encabezado', 'bordes', k], v)}
        onBorde={(k, v) => cambiar(['encabezado', 'borde', k], v)}
      />
    </>
  )
}

/** Paso 3 · Filas */
export function PasoFilas({ config, cambiar }) {
  const sep = config.cuerpo.separacion
  return (
    <>
      <div className="ex-est-rejilla">
        <Campo etiqueta="Color de fondo de las filas">{id => <Color id={id} valor={config.cuerpo.fondo} opcional onChange={v => cambiar(['cuerpo', 'fondo'], v)} ariaLabel="Fondo de las filas" />}</Campo>
        <Campo etiqueta="Color del texto">{id => <Color id={id} valor={config.cuerpo.color} onChange={v => cambiar(['cuerpo', 'color'], v)} ariaLabel="Color del texto de las filas" />}</Campo>
        <Campo etiqueta="Tamaño de letra">{id => <Numero id={id} valor={config.cuerpo.tamano} min={8} max={40} sufijo="px" onChange={v => cambiar(['cuerpo', 'tamano'], v)} />}</Campo>
        <Campo etiqueta="Interlineado">{id => <Numero id={id} valor={config.cuerpo.interlineado} min={8} max={60} sufijo="px" onChange={v => cambiar(['cuerpo', 'interlineado'], v)} />}</Campo>
        <Campo etiqueta="Alto mínimo de fila (opcional)" ayuda="Si lo dejás vacío, la altura de cada fila se ajusta automáticamente a su contenido.">{id => <Numero id={id} valor={config.cuerpo.alto} min={10} max={300} sufijo="px" placeholder="auto" onChange={v => cambiar(['cuerpo', 'alto'], v)} />}</Campo>
      </div>
      <Bordes
        titulo="Bordes de las filas"
        bordes={config.cuerpo.bordes}
        borde={config.cuerpo.borde}
        lados={[['izquierda', 'Izquierda'], ['derecha', 'Derecha'], ['divisores', 'Entre columnas']]}
        onBordes={(k, v) => cambiar(['cuerpo', 'bordes', k], v)}
        onBorde={(k, v) => cambiar(['cuerpo', 'borde', k], v)}
      />
      <fieldset className="ex-est-grupo">
        <legend className="ex-est-grupo__titulo">Separación entre filas</legend>
        <Segmentado opciones={SEPARACION} valor={sep.tipo} onChange={v => cambiar(['cuerpo', 'separacion', 'tipo'], v)} ariaLabel="Separación entre filas" />
        {sep.tipo !== 'ninguna' && (
          <div className={`ex-est-rejilla ${sep.tipo === 'linea' ? 'ex-est-rejilla--3' : 'ex-est-rejilla--2'}`}>
            <Campo etiqueta={sep.tipo === 'linea' ? 'Grosor de la línea' : 'Alto del espacio'} ayuda={sep.tipo === 'espacio' ? 'Para generar el espacio entre filas, se utiliza un borde sólido del mismo color que el fondo. Esto permite mantener una mayor compatibilidad entre los distintos clientes de correo.' : undefined} aviso={sep.tipo === 'linea' ? avisoDoble(sep) : undefined}>
              {id => <Numero id={id} valor={sep.ancho} min={1} max={40} sufijo="px" onChange={v => cambiar(['cuerpo', 'separacion', 'ancho'], v)} />}
            </Campo>
            {sep.tipo === 'linea' && <SelectorEstilo valor={sep.estilo} onChange={v => cambiar(['cuerpo', 'separacion', 'estilo'], v)} ariaLabel="Estilo de la línea entre filas" />}
            <Campo etiqueta={sep.tipo === 'linea' ? 'Color de la línea' : 'Color del espacio'}>
              {id => <Color id={id} valor={sep.color} onChange={v => cambiar(['cuerpo', 'separacion', 'color'], v)} ariaLabel="Color de la separación" />}
            </Campo>
          </div>
        )}
      </fieldset>
    </>
  )
}

/** Paso 4 · Columnas: se edita cada columna que se nombró en el encabezado (cada tarjeta se pliega) */
export function PasoColumnas({ config, avisos, cambiarColumna, cambiarTipo, actualizarConfig, enfocar, alIrAlEncabezado }) {
  const [abiertas, setAbiertas] = useState(() => ({ [config.columnas[0]?.id]: true }))
  const [conEstilo, setConEstilo] = useState({})
  const suma = config.columnas.reduce((t, c) => t + (Number(c.ancho) || 0), 0)
  const T = anchoTabla(config)
  const alternar = id => setAbiertas(a => ({ ...a, [id]: !a[id] }))
  return (
    <>
      <div className="ex-est-fila-controles ex-est-fila-controles--entre">
        <p className={`ex-est-suma${suma === 100 ? ' ex-est-suma--ok' : ' ex-est-suma--mal'}`} role="status">Suman {suma}%</p>
        <button
          type="button"
          className="ex-boton ex-boton--secundario ex-boton--chico"
          onClick={() => actualizarConfig(c => ({ ...c, columnas: c.columnas.map((x, i) => ({ ...x, ancho: repartirAnchos(c.columnas.length)[i] })) }))}
        >
          Repartir parejo
        </button>
      </div>
      <ol className="ex-est-columnas">
        {config.columnas.map((col, i) => {
          const delCol = avisos.filter(a => a.campo.endsWith(col.id))
          const esImg = col.tipo === 'imagen'
          const abierta = Boolean(abiertas[col.id])
          const personalizado = Boolean(conEstilo[col.id]) || [col.tamano, col.interlineado, col.color].some(v => v !== '' && v != null)
          const nombre = col.sinTitulo || !col.titulo.trim() ? '(sin texto)' : col.titulo
          return (
            <li
              key={col.id}
              className={`ex-est-col${abierta ? '' : ' ex-est-col--cerrada'}`}
              onFocus={() => enfocar(i)}
              onBlur={() => enfocar(null)}
              onMouseEnter={() => enfocar(i)}
              onMouseLeave={() => enfocar(null)}
            >
              <div className="ex-est-col__cab ex-est-col__cab--fija">
                <button type="button" className="ex-est-col__toggle" aria-expanded={abierta} aria-controls={`ex-est-col-${col.id}`} onClick={() => alternar(col.id)}>
                  <span className="ex-est-col__num" aria-hidden="true">{i + 1}</span>
                  <span className="ex-est-col__titulos">
                    <span className="ex-est-col__etq">Editando la columna {i + 1}</span>
                    <span className="ex-est-col__nombre">{nombre}</span>
                  </span>
                  <ChevronDown className="ex-icono ex-est-panel__chevron" aria-hidden="true" />
                </button>
                <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={() => alIrAlEncabezado(i)}>Cambiar nombre</button>
              </div>
              <div id={`ex-est-col-${col.id}`} className="ex-est-col__cuerpo" hidden={!abierta}>
                <div className="ex-est-rejilla ex-est-rejilla--col">
                  <Campo className="ex-est-span-2" etiqueta="Ancho" ayuda={`Equivale a ${anchoColumnaPx(config, col)} px del ancho total de la tabla (${T} px).`}>{id => <Numero id={id} valor={col.ancho} min={5} max={100} sufijo="%" onChange={v => cambiarColumna(i, { ancho: v })} />}</Campo>
                  <Campo className="ex-est-span-2" etiqueta="Relleno" ayuda="Espacio interno entre el contenido y los bordes de la columna.">{id => <Numero id={id} valor={col.padding} min={0} max={60} sufijo="px" onChange={v => cambiarColumna(i, { padding: v })} />}</Campo>
                  <Campo className="ex-est-span-2" etiqueta="Fondo de la columna">{id => <Color id={id} valor={col.fondo} opcional onChange={v => cambiarColumna(i, { fondo: v })} ariaLabel={`Fondo de la columna ${i + 1}`} />}</Campo>
                  <Campo className="ex-est-span-3" etiqueta="Alineación">{() => <Segmentado opciones={ALINEACIONES} valor={col.alineacion} onChange={v => cambiarColumna(i, { alineacion: v })} ariaLabel={`Alineación de la columna ${i + 1}`} />}</Campo>
                  <Campo className="ex-est-span-3" etiqueta="Contenido">{() => <Segmentado opciones={TIPOS} valor={col.tipo} onChange={v => cambiarTipo(i, v)} ariaLabel={`Tipo de la columna ${i + 1}`} />}</Campo>
                </div>
                {!esImg && (
                  <div className="ex-est-texto-col">
                    <div className="ex-est-fila-controles">
                      <Interruptor marcado={Boolean(col.negrita)} onChange={v => cambiarColumna(i, { negrita: v })}>Negrita</Interruptor>
                      <Interruptor
                        marcado={personalizado}
                        onChange={v => {
                          setConEstilo(m => ({ ...m, [col.id]: v }))
                          if (!v) cambiarColumna(i, { tamano: '', interlineado: '', color: '' })
                        }}
                      >
                        Personalizar tamaño, interlineado y color del texto
                      </Interruptor>
                    </div>
                    {personalizado && (
                      <div className="ex-est-rejilla ex-est-rejilla--col">
                        <Campo className="ex-est-span-2" etiqueta="Tamaño de letra">{id => <Numero id={id} valor={col.tamano} min={8} max={40} sufijo="px" placeholder={String(config.cuerpo.tamano)} onChange={v => cambiarColumna(i, { tamano: v })} />}</Campo>
                        <Campo className="ex-est-span-2" etiqueta="Interlineado">{id => <Numero id={id} valor={col.interlineado} min={8} max={60} sufijo="px" placeholder={String(config.cuerpo.interlineado)} onChange={v => cambiarColumna(i, { interlineado: v })} />}</Campo>
                        <Campo className="ex-est-span-2" etiqueta="Color del texto">{id => <Color id={id} valor={col.color} opcional placeholder={config.cuerpo.color} onChange={v => cambiarColumna(i, { color: v })} ariaLabel={`Color del texto de la columna ${i + 1}`} />}</Campo>
                      </div>
                    )}
                  </div>
                )}
                {esImg && (
                  <div className="ex-est-imagen">
                    <div className="ex-est-rejilla">
                      <Campo etiqueta="Ancho de la imagen" ayuda={`Ancho máximo disponible en esta columna: ${maxAnchoImagen(config, col)} px.`}>
                        {id => <Numero id={id} valor={col.imagen?.ancho ?? ''} min={1} max={600} sufijo="px" onChange={v => cambiarColumna(i, { imagen: { ...col.imagen, ancho: v } })} />}
                      </Campo>
                      <Campo etiqueta="Texto alternativo (ALT)" ayuda={`Texto que se muestra si la imagen no carga. Si lo dejás vacío, se utilizará el nombre de la columna${col.sinTitulo || !col.titulo.trim() ? '' : ` («${col.titulo.trim()}»)`}.`}>
                        {id => <input id={id} className="ex-est-input" type="text" value={col.imagen?.alt ?? ''} placeholder={col.sinTitulo ? '' : col.titulo.trim()} onChange={e => cambiarColumna(i, { imagen: { ...col.imagen, alt: e.target.value } })} />}
                      </Campo>
                    </div>
                  </div>
                )}
                {delCol.length > 0 && <Avisos items={delCol} />}
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}
