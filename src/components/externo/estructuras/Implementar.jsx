// Pestaña "Implementar": un solo flujo para diseñar el bloque de la tabla y armar
// la base de prueba. Seis pasos plegables a la izquierda y la vista previa en vivo
// a la derecha:
//   1 Campo y márgenes · 2 Encabezado · 3 Filas · 4 Columnas · 5 Contenido · 6 Exportar

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { AccionesArchivo, Avisos, Interruptor, Panel, Segmentado, TextoConSeparadores } from './Controles.jsx'
import { PasoCampo, PasoColumnas, PasoEncabezado, PasoFilas } from './PasosDiseno.jsx'
import PasoContenido, { PanelCargarBase } from './PasoContenido.jsx'
import VistaBandeja from './VistaBandeja.jsx'
import { anchoTabla, filasDeEjemplo, generarBloque, generarVistaPrevia, validarConfig } from '../../../lib/externo/estructuras/bloque.js'
import { cambiarTipoColumna, limpiarContenido } from '../../../lib/externo/estructuras/estado.js'
import { filasParaVista, generarCsv, validarPedido } from '../../../lib/externo/estructuras/pedido.js'
import { nombreArchivoProyecto, proyectoAJson } from '../../../lib/externo/estructuras/proyecto.js'
import { htmlDeEmailCompleto, vistaDeEmail } from '../../../lib/externo/estructuras/pieza.js'

const poner = (obj, ruta, valor) => {
  const [k, ...resto] = ruta
  return { ...obj, [k]: resto.length ? poner(obj[k], resto, valor) : valor }
}
const hayDatos = fila => fila.some(c => String(c ?? '').trim() !== '')

const PASOS = [
  { id: 1, titulo: 'Parámetros generales', ayuda: 'Definí el nombre del campo tipo tabla que se utilizará en la base, los márgenes del contenedor, el color de fondo y la tipografía.' },
  { id: 2, titulo: 'Encabezado de la tabla', ayuda: 'Definí la cantidad de columnas, su contenido y el diseño.' },
  { id: 3, titulo: 'Filas de la tabla', ayuda: 'Configurá el diseño de las filas, incluyendo colores, espaciados y bordes.' },
  { id: 4, titulo: 'Columnas de la tabla', ayuda: 'Configurá el tipo de contenido, el ancho, la alineación y el diseño de cada columna de forma individual.' },
  { id: 5, titulo: 'Contenido de muestra', ayuda: 'Generá la cantidad de contactos que quieras utilizar en la prueba y completá los datos de cada columna para ver cómo se visualiza la tabla con distintos contenidos.' },
  { id: 6, titulo: 'Exportación', ayuda: 'Una vez completados los pasos anteriores y definido el diseño, podés descargar el HTML y su correspondiente base de datos, listos para cargar en la plataforma y configurar los envíos de prueba.' },
]
const TODOS_CERRADOS = Object.fromEntries(PASOS.map(p => [p.id, false]))

export default function Implementar({ estado, actualizarConfig, actualizarPedido, setEstado, empezarDeCero }) {
  const { config, pedido } = estado
  const [abiertos, setAbiertos] = useState({ ...TODOS_CERRADOS, 1: true })
  const [baseAbierta, setBaseAbierta] = useState(false)
  const [vista, setVista] = useState('datos')
  const [contexto, setContexto] = useState('email')
  const [sel, setSel] = useState(0)
  const [foco, setFoco] = useState(null)
  const [columnaEnfocada, setColumnaEnfocada] = useState(null)
  const [conEjemplo, setConEjemplo] = useState(false)
  const [formato, setFormato] = useState('email')
  const [nombreAjustado, setNombreAjustado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmandoContenido, setConfirmandoContenido] = useState(false)
  const temporizador = useRef(null)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const contactos = pedido.contactos
  const seleccionado = Math.min(sel, contactos.length - 1)
  const contacto = contactos[seleccionado]

  const avisosConfig = useMemo(() => validarConfig(config), [config])
  const avisosPedido = useMemo(() => validarPedido(config, pedido), [config, pedido])
  const erroresConfig = avisosConfig.filter(a => a.nivel === 'error')
  const hayErroresPedido = avisosPedido.some(a => a.nivel === 'error')
  const T = anchoTabla(config)

  const cambiar = (ruta, valor) => actualizarConfig(c => poner(c, ruta, valor))
  const cambiarColumna = (i, cambios) =>
    actualizarConfig(c => ({ ...c, columnas: c.columnas.map((x, j) => (j === i ? { ...x, ...cambios } : x)) }))

  // ---------- pasos plegables ----------
  const alternar = id => setAbiertos(a => ({ ...a, [id]: !a[id] }))
  const abrirYMostrar = id => {
    setAbiertos(a => ({ ...a, [id]: true }))
    requestAnimationFrame(() => document.getElementById(`ex-est-paso-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  const todosAbiertos = PASOS.every(p => abiertos[p.id])
  const alternarTodos = () => setAbiertos(Object.fromEntries(PASOS.map(p => [p.id, !todosAbiertos])))

  // ---------- vista previa ----------
  const { filasVisibles, posiciones } = useMemo(() => {
    const filas = filasParaVista(config, contacto)
    const visibles = filas.map((f, i) => ({ f, i })).filter(x => hayDatos(x.f))
    return { filasVisibles: visibles.map(x => x.f), posiciones: visibles.map(x => x.i) }
  }, [config, contacto])

  const previa = useMemo(() => {
    const plantilla = vista === 'plantilla'
    const filas = plantilla ? filasDeEjemplo(config) : filasVisibles
    const modo = plantilla ? 'plantilla' : 'ejemplo'
    return contexto === 'email' ? vistaDeEmail(config, filas, { modo }) : generarVistaPrevia(config, filas, { modo })
  }, [config, vista, contexto, filasVisibles])

  const resaltado = useMemo(() => {
    if (columnaEnfocada != null) return { fila: 0, col: columnaEnfocada }
    if (vista !== 'datos' || !foco || foco.ci !== seleccionado) return null
    if (foco.fila === 'cab') return { fila: 0, col: foco.col }
    const pos = posiciones.indexOf(foco.fila)
    return pos >= 0 ? { fila: pos + 1, col: foco.col } : null
  }, [columnaEnfocada, foco, seleccionado, posiciones, vista])

  const hayImagenes = config.columnas.some(c => c.tipo === 'imagen')
  const pie = `${config.margen > 0 ? `Contenedor de 600 px: ${config.margen} px de margen a cada lado y una tabla de ${T} px de ancho.` : 'Contenedor de 600 px sin márgenes: la tabla ocupa los 600 px de ancho.'}${hayImagenes ? ' En la vista previa, las celdas de imagen sin URL se ven con un recuadro gris de referencia; ese recuadro no se exporta. Las imágenes de relleno que generás en el paso 5 son URLs reales y sí salen en la base.' : ''}`

  // ---------- exportación ----------
  const html = useMemo(
    () => generarBloque(config, conEjemplo && filasVisibles.length ? { modo: 'ejemplo', filas: filasVisibles } : {}),
    [config, conEjemplo, filasVisibles]
  )
  const htmlExportado = formato === 'email' ? htmlDeEmailCompleto(html) : html
  const csv = useMemo(() => generarCsv(config, pedido), [config, pedido])
  const proyecto = useMemo(() => proyectoAJson(estado), [estado])
  const avisosTodos = [...avisosConfig, ...avisosPedido]
  const bloqueado = erroresConfig.length > 0 || hayErroresPedido
  // Con filas de ejemplo, el HTML lleva las celdas de la base: una URL inválida saldría vacía sin avisar, así que también se bloquea
  const htmlBloqueado = erroresConfig.length > 0 || (conEjemplo && hayErroresPedido)

  const pedirEmpezarDeCero = () => {
    clearTimeout(temporizador.current)
    if (!confirmando) {
      setConfirmando(true)
      temporizador.current = setTimeout(() => setConfirmando(false), 3500)
      return
    }
    setConfirmando(false)
    empezarDeCero()
    setSel(0)
    setFoco(null)
  }

  const pedirLimpiarContenido = () => {
    clearTimeout(temporizador.current)
    if (!confirmandoContenido) {
      setConfirmandoContenido(true)
      temporizador.current = setTimeout(() => setConfirmandoContenido(false), 3500)
      return
    }
    setConfirmandoContenido(false)
    setEstado(limpiarContenido)
    setSel(0)
    setFoco(null)
  }

  const irAlEncabezado = i => {
    abrirYMostrar(2)
    requestAnimationFrame(() => document.querySelector(`#ex-est-paso-2 .ex-est-nombre:nth-child(${i + 1}) input`)?.focus({ preventScroll: true }))
  }

  // Pills de los pasos cerrados: cuántos errores (o, si no hay, avisos) tiene cada paso
  const insignias = {}
  for (const id of [1, 2, 3, 4, 5]) {
    const lista = id === 5 ? avisosPedido : avisosConfig.filter(a => a.paso === id)
    const errores = lista.filter(a => a.nivel === 'error').length
    const avisos = lista.filter(a => a.nivel === 'aviso').length
    if (errores) insignias[id] = { nivel: 'error', cantidad: errores }
    else if (avisos) insignias[id] = { nivel: 'aviso', cantidad: avisos }
  }

  const paso = id => {
    const p = PASOS.find(x => x.id === id)
    return { paso: p.id, titulo: p.titulo, ayuda: p.ayuda, id: `ex-est-paso-${p.id}`, plegable: true, abierto: abiertos[id], onAlternar: () => alternar(id), insignia: insignias[id] }
  }

  return (
    <div className="ex-est-cuerpo">
      <div className="ex-est-columna">
        <div className="ex-est-barra-pedido">
          <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={alternarTodos}>
            {todosAbiertos ? <ChevronsDownUp className="ex-icono" aria-hidden="true" /> : <ChevronsUpDown className="ex-icono" aria-hidden="true" />}
            {todosAbiertos ? 'Cerrar todos los pasos' : 'Abrir todos los pasos'}
          </button>
          <button type="button" className={`ex-boton ex-boton--secundario ex-boton--chico${confirmando ? ' ex-est-peligro' : ''}`} title="Restablece el diseño y elimina todo el contenido cargado." onClick={pedirEmpezarDeCero}>
            {confirmando ? '¿Seguro? Hacé clic de nuevo' : 'Empezar de cero'}
          </button>
          <button type="button" className={`ex-boton ex-boton--secundario ex-boton--chico${confirmandoContenido ? ' ex-est-peligro' : ''}`} title="Elimina contactos, filas y variables sin modificar el diseño de la tabla." onClick={pedirLimpiarContenido}>
            {confirmandoContenido ? '¿Seguro? Hacé clic de nuevo' : 'Limpiar solo el contenido'}
          </button>
        </div>

        <PanelCargarBase config={config} setEstado={setEstado} setSel={setSel} setFoco={setFoco} abierto={baseAbierta} onAlternar={() => setBaseAbierta(a => !a)} />

        <Panel {...paso(1)}>
          <PasoCampo config={config} cambiar={cambiar} avisos={avisosConfig} ancho={T} nombreAjustado={nombreAjustado} setNombreAjustado={setNombreAjustado} />
        </Panel>

        <Panel {...paso(2)}>
          <PasoEncabezado config={config} pedido={pedido} cambiar={cambiar} cambiarColumna={cambiarColumna} setEstado={setEstado} enfocar={setColumnaEnfocada} />
        </Panel>

        <Panel {...paso(3)}>
          <PasoFilas config={config} cambiar={cambiar} />
        </Panel>

        <Panel {...paso(4)}>
          <PasoColumnas
            config={config}
            avisos={avisosConfig}
            cambiarColumna={cambiarColumna}
            cambiarTipo={(i, tipo) => setEstado(e => cambiarTipoColumna(e, i, tipo))}
            actualizarConfig={actualizarConfig}
            enfocar={setColumnaEnfocada}
            alIrAlEncabezado={irAlEncabezado}
          />
        </Panel>

        <Panel {...paso(5)}>
          <PasoContenido config={config} pedido={pedido} actualizarPedido={actualizarPedido} sel={seleccionado} setSel={setSel} setFoco={setFoco} />
        </Panel>

        <Panel {...paso(6)}>
          <p className="ex-est-campo__ayuda">También podés guardar tu proyecto en formato JSON para continuar editándolo más adelante o utilizarlo como punto de partida para adaptarlo a los lineamientos de otro cliente. Este archivo se puede volver a cargar en la herramienta desde el apartado «Importación».</p>
          <Avisos items={avisosTodos} vacio="Todo en orden: el diseño y la base están listos para exportar." />
          {bloqueado && <p className="ex-est-campo__error">Corregí los errores marcados para poder copiar o descargar los archivos.</p>}

          <div className="ex-est-kit">
            <div className="ex-est-kit__cab">
              <div>
                <h3 className="ex-est-kit__titulo">HTML</h3>
                <p className="ex-est-kit__ayuda">
                  {formato === 'email'
                    ? 'Copiá o descargá un HTML de ejemplo que incluye encabezado, textos, la tabla que diseñaste y un pie. Está listo para cargar en la plataforma y realizar un envío de prueba.'
                    : 'Copiá o descargá únicamente el bloque HTML de la tabla, listo para incorporar al template del cliente. Incluye el encabezado y una fila modelo vacía.'}
                </p>
              </div>
              <AccionesArchivo texto={htmlExportado} nombreArchivo={formato === 'email' ? 'email_prueba_tabla.html' : 'bloque_tipo_tabla.html'} tipo="text/html" deshabilitado={htmlBloqueado} />
            </div>
            <Segmentado
              ariaLabel="Qué copiar"
              valor={formato}
              onChange={setFormato}
              opciones={[{ valor: 'email', etiqueta: 'Email completo para testear' }, { valor: 'bloque', etiqueta: 'Solo el bloque (<tr>)' }]}
            />
            <Interruptor marcado={conEjemplo} onChange={setConEjemplo}>Incluir como filas de ejemplo las del contacto {seleccionado + 1}</Interruptor>
            {conEjemplo && hayErroresPedido && <p className="ex-est-campo__error">Para exportar el HTML con filas de ejemplo, corregí antes los errores de la base (paso 5).</p>}
            <pre className="ex-est-codigo"><code>{htmlExportado}</code></pre>
          </div>

          <div className="ex-est-kit">
            <div className="ex-est-kit__cab">
              <div>
                <h3 className="ex-est-kit__titulo">Base de prueba</h3>
                <p className="ex-est-kit__ayuda">Archivo CSV con los datos de {contactos.length} {contactos.length === 1 ? 'contacto' : 'contactos'} de muestra, listo para importar en icomm. Los campos están separados por <code>;</code>.</p>
              </div>
              <AccionesArchivo texto={csv} nombreArchivo="base_prueba_tabla.csv" tipo="text/csv" saltosCrlf deshabilitado={bloqueado} />
            </div>
            <pre className="ex-est-codigo"><code><TextoConSeparadores texto={csv} /></code></pre>
          </div>

          <div className="ex-est-kit">
            <div className="ex-est-kit__cab">
              <div>
                <h3 className="ex-est-kit__titulo">Proyecto</h3>
                <p className="ex-est-kit__ayuda">Descargá un archivo JSON que guarda el diseño y los datos de muestra para continuar editándolos más adelante o reutilizarlos con otro cliente. Podés volver a cargarlo desde el apartado «Importación».</p>
              </div>
              <AccionesArchivo texto={proyecto} nombreArchivo={nombreArchivoProyecto(config)} tipo="application/json" etiquetaDescarga="Descargar .json" />
            </div>
          </div>
        </Panel>
      </div>

      <aside className="ex-est-lateral" aria-label="Vista previa en vivo">
        <div className="ex-est-lateral__controles">
          <Segmentado
            ariaLabel="Qué mostrar"
            valor={vista}
            onChange={setVista}
            opciones={[{ valor: 'datos', etiqueta: 'Con datos' }, { valor: 'plantilla', etiqueta: 'Plantilla (fila modelo)' }]}
          />
          <Segmentado
            ariaLabel="Cómo mostrarlo"
            valor={contexto}
            onChange={setContexto}
            opciones={[{ valor: 'email', etiqueta: 'En un email' }, { valor: 'tabla', etiqueta: 'Solo la tabla' }]}
          />
        </div>
        {vista === 'datos' && contactos.length > 1 && (
          <div className="ex-est-segmentado ex-est-segmentado--ancho" role="group" aria-label="Contacto a mostrar">
            {contactos.map((_, i) => (
              <button key={i} type="button" className="ex-est-segmentado__op" aria-pressed={i === seleccionado} onClick={() => { setSel(i); setFoco(null) }}>
                Contacto {i + 1}
              </button>
            ))}
          </div>
        )}
        <VistaBandeja
          html={previa}
          resaltado={resaltado}
          etiqueta={vista === 'datos' ? `Para: ${contacto?.email?.trim() || '(sin email)'}` : 'Así se incorpora al template: la plataforma completa las filas con los datos de cada contacto al realizar el envío.'}
          pie={pie}
        />
      </aside>
    </div>
  )
}
