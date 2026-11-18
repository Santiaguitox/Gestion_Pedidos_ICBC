// Paso 5 de "Implementar": el contenido de prueba (contactos, filas y variables
// extra) y la carga de una base existente. Lo que se escribe acá es lo que se ve en
// la vista previa y lo que sale en la base CSV y en las filas de ejemplo del HTML.

import { useRef, useState } from 'react'
import { Copy, ImagePlus, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Campo, Color, Interruptor, Panel } from './Controles.jsx'
import { MAX_CONTACTOS, MAX_FILAS, MAX_VARIABLES } from '../../../lib/externo/estructuras/constantes.js'
import { normalizarNombre } from '../../../lib/externo/estructuras/nombre.js'
import { proyectoDesdeJson } from '../../../lib/externo/estructuras/proyecto.js'
import { COLORES_PLACEHOLDER, cargarBase, contactoVacio, copiarDatos, regenerarImagenes, renumerarEjemplo, rellenarImagenes } from '../../../lib/externo/estructuras/pedido.js'

const sinDatos = c => c.filas.every(f => f.every(v => String(v ?? '').trim() === '')) && (c.vars ?? []).every(v => String(v ?? '').trim() === '')

/** Una fila del generador: texto y colores de las imágenes de una columna, con dos botones (completar vacías / regenerar las de relleno). */
function FilaImagenes({ columna, alGenerar, alRegenerar }) {
  const [texto, setTexto] = useState('')
  const [numerar, setNumerar] = useState(true)
  const [fondo, setFondo] = useState(COLORES_PLACEHOLDER.fondo)
  const [color, setColor] = useState(COLORES_PLACEHOLDER.color)
  return (
    <div className="ex-est-generador__fila">
      <p className="ex-est-generador__col">Columna «{columna.titulo.trim() || 'sin texto'}»</p>
      <Campo etiqueta="Texto de cada imagen">
        {id => <input id={id} className="ex-est-input" type="text" value={texto} placeholder={columna.titulo.trim() || 'Imagen'} onChange={e => setTexto(e.target.value)} />}
      </Campo>
      <div className="ex-est-generador__colores">
        <Campo etiqueta="Fondo">
          {id => <Color id={id} valor={fondo} onChange={setFondo} ariaLabel="Fondo de la imagen" placeholder={COLORES_PLACEHOLDER.fondo} />}
        </Campo>
        <Campo etiqueta="Color del texto">
          {id => <Color id={id} valor={color} onChange={setColor} ariaLabel="Color del texto de la imagen" placeholder={COLORES_PLACEHOLDER.color} />}
        </Campo>
      </div>
      <Interruptor marcado={numerar} onChange={setNumerar}>Numerar imágenes (contacto.fila, ej. 1.2)</Interruptor>
      <div className="ex-est-generador__botones">
        <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={() => alGenerar({ texto, numerar, fondo, color })}>
          <ImagePlus className="ex-icono" aria-hidden="true" />
          Completar celdas vacías
        </button>
        <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={() => alRegenerar({ fondo, color })}>
          <RefreshCw className="ex-icono" aria-hidden="true" />
          Regenerar las de relleno
        </button>
      </div>
    </div>
  )
}

export default function PasoContenido({ config, pedido, actualizarPedido, sel, setSel, setFoco }) {
  const n = config.columnas.length
  const columnasImagen = config.columnas.map((c, i) => ({ c, i })).filter(x => x.c.tipo === 'imagen')
  const contactos = pedido.contactos

  const editarContacto = (ci, cambios) =>
    actualizarPedido(p => ({ ...p, contactos: p.contactos.map((c, i) => (i === ci ? { ...c, ...cambios } : c)) }))
  const editarCelda = (ci, ri, c, valor) =>
    actualizarPedido(p => ({
      ...p,
      contactos: p.contactos.map((ct, i) => (i !== ci ? ct : { ...ct, filas: ct.filas.map((f, r) => (r !== ri ? f : f.map((v, k) => (k === c ? valor : v)))) })),
    }))
  const agregarFila = ci =>
    actualizarPedido(p => ({ ...p, contactos: p.contactos.map((c, i) => (i === ci && c.filas.length < MAX_FILAS ? { ...c, filas: [...c.filas, Array(n).fill('')] } : c)) }))
  const quitarFila = (ci, ri) =>
    actualizarPedido(p => ({
      ...p,
      contactos: p.contactos.map((c, i) => {
        if (i !== ci) return c
        const filas = c.filas.filter((_, r) => r !== ri)
        return { ...c, filas: filas.length ? filas : [Array(n).fill('')] }
      }),
    }))
  const agregarContacto = () => {
    if (contactos.length >= MAX_CONTACTOS) return
    actualizarPedido(p => ({ ...p, contactos: [...p.contactos, contactoVacio(n, p.variables.length)] }))
    setSel(contactos.length)
    setFoco(null)
  }
  // Copia las filas y variables del contacto anterior (el email de este no se toca)
  const copiarDelAnterior = ci =>
    actualizarPedido(p => ({ ...p, contactos: p.contactos.map((c, i) => (i === ci && ci > 0 ? copiarDatos(p.contactos[ci - 1], c) : c)) }))
  const quitarContacto = ci => {
    if (contactos.length <= 1) return
    actualizarPedido(p => renumerarEjemplo({ ...p, contactos: p.contactos.filter((_, i) => i !== ci) }))
    setSel(s => Math.max(0, Math.min(s, contactos.length - 2)))
    setFoco(null)
  }
  const agregarVariable = (nombre = '') =>
    actualizarPedido(p => (p.variables.length >= MAX_VARIABLES ? p : { variables: [...p.variables, nombre], contactos: p.contactos.map(c => ({ ...c, vars: [...c.vars, ''] })) }))
  const renombrarVariable = (vi, valor) =>
    actualizarPedido(p => ({ ...p, variables: p.variables.map((v, i) => (i === vi ? normalizarNombre(valor, { recortar: false }) : v)) }))
  const quitarVariable = vi =>
    actualizarPedido(p => ({ variables: p.variables.filter((_, i) => i !== vi), contactos: p.contactos.map(c => ({ ...c, vars: c.vars.filter((_, i) => i !== vi) })) }))
  const editarVar = (ci, vi, valor) =>
    actualizarPedido(p => ({ ...p, contactos: p.contactos.map((c, i) => (i === ci ? { ...c, vars: c.vars.map((v, k) => (k === vi ? valor : v)) } : c)) }))

  return (
    <>
      <fieldset className="ex-est-grupo">
        <legend className="ex-est-grupo__titulo">Variables extra</legend>
        <p className="ex-est-campo__ayuda">Si el diseño de tu pieza contiene otras variables personalizadas que deban incluirse en la base de prueba para su correcto funcionamiento, agregalas en este apartado. Hasta {MAX_VARIABLES}.</p>
        <ul className="ex-est-chips">
          {pedido.variables.map((v, i) => (
            <li key={i} className="ex-est-chip ex-est-chip--var">
              <input
                className="ex-est-chip__input"
                type="text"
                value={v}
                placeholder="nombre_variable"
                aria-label={`Nombre de la variable ${i + 1}`}
                spellCheck={false}
                autoComplete="off"
                onChange={e => renombrarVariable(i, e.target.value)}
              />
              <button type="button" className="ex-est-icono-btn" aria-label={`Quitar la variable ${i + 1}`} title="Quitar variable" onClick={() => quitarVariable(i)}>×</button>
            </li>
          ))}
        </ul>
        <div className="ex-est-fila-controles">
          <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" disabled={pedido.variables.length >= MAX_VARIABLES} onClick={() => agregarVariable('')}>
            <Plus className="ex-icono" aria-hidden="true" />
            Agregar variable
          </button>
          {!pedido.variables.includes('nombre') && (
            <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" disabled={pedido.variables.length >= MAX_VARIABLES} onClick={() => agregarVariable('nombre')}>
              + nombre
            </button>
          )}
        </div>
      </fieldset>

      {columnasImagen.length > 0 && (
        <fieldset className="ex-est-grupo">
          <legend className="ex-est-grupo__titulo">Imágenes de ejemplo</legend>
          <p className="ex-est-campo__ayuda">Si configuraste alguna columna con contenido de tipo imagen, en este apartado podés generar imágenes de relleno y personalizar su color de fondo y el texto que muestran. Las URLs que hayas cargado manualmente no se modificarán. Las imágenes de relleno se generan al doble de su ancho configurado para mejorar la nitidez.</p>
          {columnasImagen.map(({ c, i }) => (
            <FilaImagenes key={c.id} columna={c} alGenerar={opciones => actualizarPedido(p => rellenarImagenes(p, config, i, opciones))} alRegenerar={opciones => actualizarPedido(p => regenerarImagenes(p, config, i, opciones))} />
          ))}
        </fieldset>
      )}

      <p className="ex-est-campo__ayuda">
        Podés generar hasta {MAX_CONTACTOS} contactos de muestra y {MAX_FILAS} filas por contacto. Las filas vacías no se incluirán en la base.
        {' '}En las columnas de imagen, ingresá únicamente la URL de la imagen que quieras mostrar. Al exportar la base, la herramienta generará automáticamente el HTML de cada imagen, incluyendo el ancho, los estilos y el texto alternativo (ALT) configurados previamente en el paso 4.
      </p>
      {contactos.map((ct, ci) => (
        <section key={ci} className={`ex-est-contacto${ci === sel ? ' ex-est-contacto--sel' : ''}`} onFocusCapture={() => setSel(ci)}>
          <div className="ex-est-contacto__cab">
            <span className="ex-est-col__num" aria-hidden="true">{ci + 1}</span>
            <input
              className="ex-est-input"
              type="text"
              inputMode="email"
              value={ct.email}
              placeholder="email@del-contacto.com"
              aria-label={`Email del contacto ${ci + 1}`}
              spellCheck={false}
              autoComplete="off"
              onChange={e => editarContacto(ci, { email: e.target.value })}
            />
            {contactos.length > 1 && (
              <button type="button" className="ex-est-icono-btn" aria-label={`Quitar el contacto ${ci + 1}`} title="Quitar contacto" onClick={() => quitarContacto(ci)}>
                <Trash2 className="ex-icono" aria-hidden="true" />
              </button>
            )}
          </div>
          {pedido.variables.length > 0 && (
            <div className="ex-est-vars">
              {pedido.variables.map((v, vi) => (
                <label key={vi} className="ex-est-var">
                  <span>{v || 'variable'}</span>
                  <input className="ex-est-input" type="text" value={ct.vars[vi] ?? ''} spellCheck={false} autoComplete="off" onChange={e => editarVar(ci, vi, e.target.value)} />
                </label>
              ))}
            </div>
          )}
          {ci > 0 && sinDatos(ct) && (
            <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico ex-est-agregar" onClick={() => copiarDelAnterior(ci)}>
              <Copy className="ex-icono" aria-hidden="true" />
              Copiar las filas del contacto {ci}
            </button>
          )}
          <div className="ex-est-filas" data-columnas={n}>
            <div className="ex-est-filas__fila ex-est-filas__fila--cab" aria-hidden="true">
              {config.columnas.map(c => <span key={c.id} className="ex-est-filas__th">{c.sinTitulo ? '—' : (c.titulo || '—')}</span>)}
              <span />
            </div>
            {ct.filas.map((fila, ri) => (
              <div key={ri} className="ex-est-filas__fila">
                {config.columnas.map((c, k) => (
                  <input
                    key={c.id}
                    className="ex-est-input"
                    type="text"
                    value={fila[k] ?? ''}
                    spellCheck={false}
                    placeholder={c.tipo === 'imagen' ? 'https://…' : ''}
                    aria-label={`Contacto ${ci + 1}, fila ${ri + 1}, ${c.titulo || `columna ${k + 1}`}`}
                    onChange={e => editarCelda(ci, ri, k, e.target.value)}
                    onFocus={() => setFoco({ ci, fila: ri, col: k })}
                    onBlur={() => setFoco(null)}
                  />
                ))}
                {ct.filas.length > 1
                  ? <button type="button" className="ex-est-icono-btn" aria-label={`Quitar la fila ${ri + 1} del contacto ${ci + 1}`} title="Quitar fila" onClick={() => quitarFila(ci, ri)}>×</button>
                  : <span />}
              </div>
            ))}
          </div>
          <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico ex-est-agregar" disabled={ct.filas.length >= MAX_FILAS} onClick={() => agregarFila(ci)}>
            <Plus className="ex-icono" aria-hidden="true" />
            Agregar fila
          </button>
        </section>
      ))}
      <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico ex-est-agregar" disabled={contactos.length >= MAX_CONTACTOS} onClick={agregarContacto}>
        <Plus className="ex-icono" aria-hidden="true" />
        Agregar contacto
      </button>
    </>
  )
}

/** Cargar una base existente (pegada o desde un .csv): ajusta las columnas y el contenido. */
export function PanelCargarBase({ config, setEstado, setSel, setFoco, abierto, onAlternar }) {
  const [texto, setTexto] = useState('')
  const [mensaje, setMensaje] = useState(null)
  const [pendiente, setPendiente] = useState(null) // proyecto leído, a la espera de confirmar el reemplazo
  const archivo = useRef(null)

  const resumen = e => {
    const c = e.config.columnas.length
    const n = e.pedido.contactos.length
    return `${c} ${c === 1 ? 'columna' : 'columnas'} y ${n} ${n === 1 ? 'contacto' : 'contactos'}`
  }

  // Se detecta solo qué es: un proyecto guardado empieza con { (JSON); lo demás se lee como base CSV
  const importar = crudo => {
    setPendiente(null)
    if (crudo.trim().startsWith('{')) {
      const r = proyectoDesdeJson(crudo)
      if (r.error) { setMensaje({ nivel: 'error', texto: r.error }); return }
      setMensaje(null)
      setPendiente(r.estado)
      return
    }
    const r = cargarBase(crudo, config)
    if (r.error) { setMensaje({ nivel: 'error', texto: r.error }); return }
    setEstado({ config: r.config, pedido: r.pedido })
    setSel(0)
    setFoco(null)
    setMensaje({ nivel: 'ok', texto: `Base cargada: ${r.pedido.contactos.length} ${r.pedido.contactos.length === 1 ? 'contacto' : 'contactos'}. ${r.avisos.join(' ')}` })
  }
  const confirmarProyecto = () => {
    setEstado(pendiente)
    setSel(0)
    setFoco(null)
    setMensaje({ nivel: 'ok', texto: `Proyecto abierto: ${pendiente.config.columnas.length} columnas, ${pendiente.pedido.contactos.length} contactos.` })
    setPendiente(null)
    setTexto('')
  }
  const alElegirArchivo = e => {
    const f = e.target.files?.[0]
    if (!f) return
    const lector = new FileReader()
    lector.onload = () => { setTexto(String(lector.result)); importar(String(lector.result)) }
    lector.onerror = () => setMensaje({ nivel: 'error', texto: 'No se pudo leer el archivo.' })
    lector.readAsText(f, 'utf-8')
    e.target.value = ''
  }

  return (
    <Panel
      titulo="Importación"
      ayuda="¿Ya tenés algún material armado? Acá podés importar una base CSV o un diseño guardado previamente en JSON."
      plegable
      abierto={abierto}
      onAlternar={onAlternar}
    >
      <p className="ex-est-campo__ayuda">Pegá el contenido o seleccioná un archivo y la herramienta detectará automáticamente el formato.</p>
      <textarea
        className="ex-est-input ex-est-textarea"
        rows={4}
        value={texto}
        spellCheck={false}
        placeholder="Base CSV: email;datos_tabla&#10;persona@ejemplo.com;dato 1||dato 2##&#10;Proyecto JSON: { &quot;formato&quot;: &quot;icomm-estructuras-tabla&quot;, … }"
        aria-label="Contenido a importar"
        onChange={e => { setTexto(e.target.value); setPendiente(null) }}
      />
      <div className="ex-est-fila-controles">
        <button type="button" className="ex-boton ex-boton--primario ex-boton--chico" disabled={!texto.trim()} onClick={() => importar(texto)}>Importar</button>
        <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={() => archivo.current?.click()}>
          <Upload className="ex-icono" aria-hidden="true" />
          Elegir archivo
        </button>
        <input ref={archivo} type="file" accept=".csv,.txt,.json,text/csv,text/plain,application/json" className="ex-solo-lector" tabIndex={-1} aria-hidden="true" onChange={alElegirArchivo} />
      </div>
      {pendiente && (
        <div className="ex-est-aviso ex-est-aviso--aviso ex-est-confirmar" role="alert">
          <p><strong>¿Querés reemplazar el proyecto actual?</strong></p>
          <p>El archivo que estás importando contiene {resumen(pendiente)}. Si continuás, se reemplazarán el diseño y el contenido actuales. Si querés conservarlos, exportalos antes.</p>
          <div className="ex-est-fila-controles">
            <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={() => setPendiente(null)}>Cancelar</button>
            <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico ex-est-peligro" onClick={confirmarProyecto}>Reemplazar</button>
          </div>
        </div>
      )}
      {mensaje && <p className={`ex-est-aviso ex-est-aviso--${mensaje.nivel === 'ok' ? 'ok' : 'error'}`} role="status">{mensaje.texto}</p>}
    </Panel>
  )
}
