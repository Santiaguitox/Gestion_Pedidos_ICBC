// Guardar y abrir un proyecto completo (diseño + contenido de prueba) como archivo
// .json. Sirve para retomar un trabajo en otra máquina, pasárselo a alguien o
// tener una versión por cliente. Al abrirlo se sanea todo: un archivo viejo, editado
// a mano o ajeno no puede romper la herramienta.

import { MAX_COLUMNAS, MAX_CONTACTOS, MAX_FILAS, MAX_VARIABLES } from './constantes.js'
import { estadoDesdeGuardado } from './estado.js'

export const FORMATO_PROYECTO = 'icomm-estructuras-tabla'
export const VERSION_PROYECTO = 1
/** Tamaño máximo aceptado al abrir (en caracteres): un proyecto real pesa unos pocos KB. */
export const MAX_PROYECTO = 2_000_000

/** El proyecto como texto JSON legible (con sangría, para poder revisarlo o versionarlo). */
export function proyectoAJson(estado) {
  return JSON.stringify({ formato: FORMATO_PROYECTO, version: VERSION_PROYECTO, config: estado.config, pedido: estado.pedido }, null, 2)
}

/** Nombre sugerido para el archivo, según el nombre del campo (que ya es solo letras, números y _). */
export function nombreArchivoProyecto(config) {
  const base = String(config?.nombreCampo ?? '').replace(/[^A-Za-z0-9_]/g, '')
  return `${base || 'tabla'}.proyecto.json`
}

const texto = v => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** Fuerza la forma del pedido y recorta a los máximos de la herramienta. */
function pedidoSaneado(pedido) {
  const variables = (Array.isArray(pedido?.variables) ? pedido.variables : []).slice(0, MAX_VARIABLES).map(texto)
  const contactos = (Array.isArray(pedido?.contactos) ? pedido.contactos : []).slice(0, MAX_CONTACTOS).map(c => ({
    email: texto(c?.email),
    vars: (Array.isArray(c?.vars) ? c.vars : []).map(texto),
    filas: (Array.isArray(c?.filas) ? c.filas : []).slice(0, MAX_FILAS).map(f => (Array.isArray(f) ? f : []).map(texto)),
  }))
  return { variables, contactos }
}

/**
 * Lee el texto de un proyecto. Devuelve { estado } o { error } con un mensaje
 * pensado para mostrarse tal cual.
 */
export function proyectoDesdeJson(crudo) {
  const t = String(crudo ?? '').trim()
  if (!t) return { error: 'No hay contenido para importar. Pegá una base o proyecto, o seleccioná un archivo CSV o JSON.' }
  if (t.length > MAX_PROYECTO) return { error: 'El archivo supera el tamaño permitido para importar un proyecto.' }
  let v
  try {
    v = JSON.parse(t)
  } catch {
    return { error: 'El archivo JSON no es válido. Probá con un proyecto descargado desde esta herramienta.' }
  }
  if (v?.formato !== FORMATO_PROYECTO) {
    return { error: 'El archivo no corresponde a un proyecto de esta herramienta. Importá un JSON generado desde «Descargar .json».' }
  }
  if (Number(v.version) > VERSION_PROYECTO) {
    return { error: 'Este proyecto fue guardado con una versión más reciente de la herramienta y no se puede abrir.' }
  }
  if (!Array.isArray(v.config?.columnas) || !v.config.columnas.length) return { error: 'El proyecto no contiene columnas. Revisá que el archivo esté completo.' }
  const estado = estadoDesdeGuardado({ config: v.config, pedido: pedidoSaneado(v.pedido) })
  if (!estado) return { error: `No se pudo importar el proyecto: está incompleto o supera el límite de ${MAX_COLUMNAS} columnas.` }
  return { estado }
}
