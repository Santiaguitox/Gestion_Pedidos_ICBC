// "Armar un pedido": contactos con sus filas, variables extra y la base CSV.
//
// Formato de la base (separador ";"):
//   email;variable1;variable2;NOMBRE_DEL_CAMPO
// El campo tipo tabla va SIEMPRE último: su contenido (celdas con "||" entre
// columnas y "##" al final de cada fila) puede traer ";" (por ejemplo dentro de
// un <img style='...;...'>) y tiene que ser lo último de la línea para no
// confundirse con otro campo.

import {
  CAMPO_POR_DEFECTO,
  MAX_COLUMNAS,
  MAX_CONTACTOS,
  MAX_FILAS,
  MAX_VARIABLES,
  SEP_COLUMNA,
  SEP_FILA,
} from './constantes.js'
import { columnaNueva, repartirAnchos } from './bloque.js'
import { esColorValido, normalizarColor } from './color.js'
import { altDeColumna, construirImg, extraerUrlImagen, validarUrlImagen } from './imagen.js'
import { normalizarNombre, validarNombre } from './nombre.js'

const vacio = n => Array.from({ length: n }, () => '')
const hayDatos = fila => fila.some(c => String(c ?? '').trim() !== '')

export function contactoVacio(nColumnas, nVariables = 0) {
  return { email: '', vars: vacio(nVariables), filas: [vacio(nColumnas)] }
}

export function pedidoVacio(config) {
  return { variables: [], contactos: [contactoVacio(config.columnas.length)] }
}

/** Un contacto de ejemplo con dos filas. */
export function pedidoInicial(config) {
  const n = config.columnas.length
  const filas = [1, 2].map(r => config.columnas.map((c, i) => (c.tipo === 'imagen' ? urlPlaceholder(c.imagen?.ancho, `Imagen 1.${r}`) : `C1 dato ${r}.${i + 1}`)))
  return {
    variables: [],
    contactos: [{ email: 'contacto1@ejemplo.com', vars: [], filas: filas.map(f => f.slice(0, n)) }],
  }
}

/** Filas y variables de un contacto copiadas sobre otro; el email del destino no se toca. */
export function copiarDatos(origen, destino) {
  return { ...destino, vars: [...(origen.vars ?? [])], filas: origen.filas.map(f => [...f]) }
}

export const COLORES_PLACEHOLDER = { fondo: '#e1f8fb', color: '#0e316e' }

const sinGato = c => String(c || '').replace('#', '').toLowerCase()

/** URL de una imagen de relleno (placehold.co) del doble del ancho pedido, con el fondo y el texto elegidos. */
export function urlPlaceholder(ancho, texto, { fondo = COLORES_PLACEHOLDER.fondo, color = COLORES_PLACEHOLDER.color } = {}) {
  const w = Math.min(600, Math.max(20, Math.round(Number(ancho) || 90) * 2))
  const t = encodeURIComponent(String(texto || 'Imagen').trim()).replace(/%20/g, '+')
  const f = esColorValido(fondo) ? sinGato(normalizarColor(fondo)) : sinGato(COLORES_PLACEHOLDER.fondo)
  const c = esColorValido(color) ? sinGato(normalizarColor(color)) : sinGato(COLORES_PLACEHOLDER.color)
  return `https://placehold.co/${w}x${w}/${f}/${c}.png?text=${t}`
}

const ES_PLACEHOLDER = /^https:\/\/placehold\.co\//

/** El texto (text=) de una URL de placehold.co, o '' si no es una. */
export function textoDePlaceholder(url) {
  if (!ES_PLACEHOLDER.test(String(url ?? '').trim())) return ''
  const m = /[?&]text=([^&]*)/.exec(String(url))
  if (!m) return ''
  try { return decodeURIComponent(m[1].replace(/\+/g, ' ')) } catch { return m[1] }
}

/**
 * Completa con imágenes de relleno las celdas vacías de una columna de imagen (no pisa las que ya
 * tienen URL). `texto` es lo que dice cada imagen; con `numerar` se le suma contacto.fila (1.1, 1.2…).
 */
export function rellenarImagenes(pedido, config, indice, { texto = '', numerar = true, fondo, color } = {}) {
  const col = config.columnas[indice]
  if (!col || col.tipo !== 'imagen') return pedido
  const base = String(texto).trim() || col.titulo?.trim() || 'Imagen'
  return {
    ...pedido,
    contactos: pedido.contactos.map((c, ci) => ({
      ...c,
      filas: c.filas.map((f, ri) => (String(f[indice] ?? '').trim()
        ? f
        : f.map((v, k) => (k === indice ? urlPlaceholder(col.imagen?.ancho, numerar ? `${base} ${ci + 1}.${ri + 1}` : base, { fondo, color }) : v)))),
    })),
  }
}

/**
 * Rehace las imágenes de relleno YA generadas de una columna (solo las URL de placehold.co) con el
 * tamaño y los colores actuales, conservando el texto de cada una. No toca las URL reales.
 */
export function regenerarImagenes(pedido, config, indice, { fondo, color } = {}) {
  const col = config.columnas[indice]
  if (!col || col.tipo !== 'imagen') return pedido
  return {
    ...pedido,
    contactos: pedido.contactos.map(c => ({
      ...c,
      filas: c.filas.map(f => f.map((v, k) => (k === indice && ES_PLACEHOLDER.test(String(v).trim())
        ? urlPlaceholder(col.imagen?.ancho, textoDePlaceholder(v), { fondo, color })
        : v))),
    })),
  }
}

/** ¿Hay algo cargado en esa columna en alguno de los contactos? */
export function columnaTieneDatos(pedido, indice) {
  return pedido.contactos.some(c => c.filas.some(f => String(f[indice] ?? '').trim() !== ''))
}

/** Al borrar un contacto del ejemplo, los datos de ejemplo se renumeran para no quedar desfasados. */
export function renumerarEjemplo(pedido) {
  return {
    ...pedido,
    contactos: pedido.contactos.map((c, i) => ({
      ...c,
      email: /^contacto\d+@ejemplo\.com$/.test(c.email) ? `contacto${i + 1}@ejemplo.com` : c.email,
      filas: c.filas.map(f => f.map(v => {
        const m = /^C\d+( dato .*)$/.exec(v)
        if (m) return `C${i + 1}${m[1]}`
        const u = /^(https:\/\/placehold\.co\/[^?]*\?text=Imagen\+)\d+(\..*)$/.exec(v)
        return u ? `${u[1]}${i + 1}${u[2]}` : v
      })),
    })),
  }
}

/** Ajusta variables y filas a la cantidad actual de columnas / variables (por si el diseño cambió). */
export function normalizarPedido(pedido, nColumnas) {
  const nv = pedido.variables.length
  return {
    variables: pedido.variables,
    contactos: pedido.contactos.map(c => ({
      email: c.email ?? '',
      vars: Array.from({ length: nv }, (_, i) => c.vars?.[i] ?? ''),
      filas: (c.filas?.length ? c.filas : [[]]).map(f => Array.from({ length: nColumnas }, (_, i) => f[i] ?? '')),
    })),
  }
}

/** Valor que va a la base para una celda: el texto tal cual o, en columnas de imagen, el <img> armado. */
export function valorDeCelda(columna, valor) {
  const t = String(valor ?? '').trim()
  if (columna.tipo !== 'imagen') return t
  if (!t) return ''
  return construirImg({ url: extraerUrlImagen(t) || t, ancho: columna.imagen?.ancho, alt: altDeColumna(columna), alineacion: columna.alineacion })
}

export function campoTabla(config, contacto) {
  return contacto.filas
    .filter(hayDatos)
    .map(f => config.columnas.map((c, i) => valorDeCelda(c, f[i])).join(SEP_COLUMNA) + SEP_FILA)
    .join('')
}

export function generarCsv(config, pedido) {
  const nombre = config.nombreCampo || CAMPO_POR_DEFECTO
  const encabezado = ['email', ...pedido.variables.map(v => String(v).trim()), nombre].join(';')
  const lineas = pedido.contactos.map(c =>
    [String(c.email ?? '').trim(), ...pedido.variables.map((_, i) => String(c.vars?.[i] ?? '').trim()), campoTabla(config, c)].join(';')
  )
  return [encabezado, ...lineas].join('\n')
}

/** Las filas del contacto como las ve el template (con valores ya armados), para la vista previa. */
export function filasParaVista(config, contacto) {
  return contacto.filas.map(f => config.columnas.map((c, i) => {
    const v = String(f[i] ?? '').trim()
    if (c.tipo === 'imagen') return v ? (extraerUrlImagen(v) || v) : ''
    return v
  }))
}

// ---------------- Cargar una base existente ----------------

/** Lee el texto de una base CSV (separada por ";"). Devuelve { error } o { contactos, ... }. */
export function parsearBase(texto, nombreCampoActual = CAMPO_POR_DEFECTO) {
  const lineas = String(texto ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '')
  if (lineas.length < 2) return { error: 'Hace falta el encabezado (por ejemplo email;datos_tabla) y al menos una fila.' }
  const original = lineas[0].split(';').map(x => x.trim())
  const claves = original.map(x => x.toLowerCase())
  const iEmail = claves.indexOf('email')
  if (iEmail < 0) return { error: 'No encuentro la columna "email" en la primera línea.' }

  let iTabla = claves.indexOf(String(nombreCampoActual).toLowerCase())
  if (iTabla < 0) iTabla = claves.indexOf(CAMPO_POR_DEFECTO)
  if (iTabla < 0) iTabla = original.length - 1
  if (iTabla === iEmail) return { error: 'No encuentro la columna del campo tipo tabla.' }

  const idxVars = original.map((_, i) => i).filter(i => i !== iEmail && i !== iTabla)
  const variables = idxVars.map((i, k) => normalizarNombre(original[i]) || `variable${k + 1}`)
  const ultima = iTabla === original.length - 1

  let maxColumnas = 0
  const contactos = lineas.slice(1).map(linea => {
    let partes = linea.split(';')
    if (ultima) partes = [...partes.slice(0, original.length - 1), partes.slice(original.length - 1).join(';')]
    const filas = (partes[iTabla] ?? '').split(SEP_FILA).filter(r => r.trim() !== '').map(r => r.split(SEP_COLUMNA))
    filas.forEach(f => { maxColumnas = Math.max(maxColumnas, f.length) })
    return { email: (partes[iEmail] ?? '').trim(), vars: idxVars.map(i => (partes[i] ?? '').trim()), filas }
  })
  return {
    contactos,
    variables,
    maxColumnas,
    campo: normalizarNombre(original[iTabla]) || nombreCampoActual,
    tablaNoEstabaAlFinal: !ultima && idxVars.some(i => i > iTabla),
  }
}

/** Aplica una base leída al diseño actual (el pedido se reemplaza por completo). Devuelve { error } o { config, pedido, avisos }. */
export function cargarBase(texto, config) {
  const r = parsearBase(texto, config.nombreCampo)
  if (r.error) return { error: r.error }
  if (r.maxColumnas < 1) return { error: 'No encontré filas dentro del campo tipo tabla.' }
  if (r.maxColumnas > MAX_COLUMNAS) return { error: `La base tiene ${r.maxColumnas} columnas y la herramienta admite hasta ${MAX_COLUMNAS}.` }

  const avisos = []
  const n = r.maxColumnas
  let columnas = config.columnas
  if (columnas.length !== n) {
    const anchos = repartirAnchos(n)
    columnas = Array.from({ length: n }, (_, i) => ({
      ...(columnas[i] ?? columnaNueva(i + 1)),
      ancho: anchos[i],
    }))
    avisos.push(`El diseño tenía ${config.columnas.length} columnas y la base trae ${n}: se ajustó el diseño y los anchos se repartieron parejo.`)
  }
  const sinEncabezados = config.columnas.length !== n
  if (sinEncabezados) avisos.push('Los encabezados no vienen en la base: completalos en el diseño.')

  let contactos = r.contactos
  if (contactos.length > MAX_CONTACTOS) {
    avisos.push(`Se cargaron los primeros ${MAX_CONTACTOS} contactos de ${contactos.length}.`)
    contactos = contactos.slice(0, MAX_CONTACTOS)
  }
  let variables = r.variables
  if (variables.length > MAX_VARIABLES) {
    avisos.push(`La herramienta admite hasta ${MAX_VARIABLES} variables extra: se ignoraron ${variables.slice(MAX_VARIABLES).join(', ')}.`)
    variables = variables.slice(0, MAX_VARIABLES)
  }
  if (variables.length) avisos.push(`Variables cargadas: ${variables.join(', ')}.`)
  if (r.tablaNoEstabaAlFinal) avisos.push('El campo tipo tabla no estaba al final: en la base generada va último.')

  let campo = config.nombreCampo
  if (r.campo && r.campo !== config.nombreCampo && validarNombre(r.campo).ok) {
    campo = r.campo
    avisos.push(`El campo tipo tabla se llama "${r.campo}" en la base: el diseño pasó a usar ese nombre.`)
  }

  const nuevoConfig = { ...config, nombreCampo: campo, columnas }
  const nuevoPedido = {
    variables,
    contactos: contactos.map(c => ({
      email: c.email,
      vars: variables.map((_, i) => c.vars[i] ?? ''),
      filas: (c.filas.length ? c.filas : [vacio(n)]).map(f => Array.from({ length: n }, (_, i) => {
        const v = f[i] ?? ''
        return columnas[i].tipo === 'imagen' ? (extraerUrlImagen(v) || v) : v
      })).slice(0, MAX_FILAS),
    })),
  }
  return { config: nuevoConfig, pedido: nuevoPedido, avisos }
}

// ---------------- Validación ----------------

const EMAIL = /^[^\s@;]+@[^\s@;]+\.[^\s@;]+$/

/** Avisos del pedido: { nivel: 'error' | 'aviso' | 'info', mensaje }. */
export function validarPedido(config, pedido) {
  const res = []
  const add = (nivel, mensaje) => res.push({ nivel, mensaje })

  // Los encabezados no viajan en la base (los pone el template): uno vacío no afecta al CSV.

  const vistas = new Set()
  pedido.variables.forEach((v, i) => {
    const n = String(v).trim()
    const campo = String(config.nombreCampo).toLowerCase()
    if (!n) add('error', `La variable ${i + 1} no tiene nombre.`)
    else if (n.toLowerCase() === campo) add('error', `"${n}" ya lo usa el campo tipo tabla: elegí otro nombre para la variable ${i + 1}.`)
    else {
      const val = validarNombre(n)
      if (!val.ok) add('error', `Variable ${i + 1}: ${val.error}`)
      if (vistas.has(n.toLowerCase())) add('error', `La variable "${n}" está repetida.`)
      vistas.add(n.toLowerCase())
    }
  })

  const emails = new Map()
  pedido.contactos.forEach((c, ci) => {
    const k = ci + 1
    const e = String(c.email ?? '').trim()
    pedido.variables.forEach((v, i) => {
      if (String(c.vars?.[i] ?? '').includes(';')) add('error', `Contacto ${k}: el valor de "${v || 'variable'}" tiene un ;, que parte la base en otro campo.`)
    })
    if (!e) add('error', `Contacto ${k}: falta el email.`)
    else if (!EMAIL.test(e)) add('aviso', `Contacto ${k}: el email no parece válido.`)
    if (e) {
      const key = e.toLowerCase()
      if (emails.has(key)) add('error', `El email ${e} está repetido (contactos ${emails.get(key)} y ${k}).`)
      else emails.set(key, k)
    }
    let vacias = 0
    let marcado = false
    c.filas.forEach((f, ri) => {
      if (!hayDatos(f)) { vacias += 1; return }
      f.forEach((v, i) => {
        const t = String(v ?? '')
        if (!marcado && (t.includes(SEP_COLUMNA) || t.includes(SEP_FILA))) {
          marcado = true
          add('error', `Contacto ${k}, fila ${ri + 1}: una celda tiene || o ##, que rompen la estructura de la base.`)
        }
        const col = config.columnas[i]
        if (col?.tipo === 'imagen' && t.trim()) {
          const u = validarUrlImagen(extraerUrlImagen(t) || t)
          if (!u.ok) add('error', `Contacto ${k}, fila ${ri + 1}, columna "${col.titulo}": ${u.error}`)
        }
      })
    })
    if (vacias === c.filas.length) add('aviso', `Contacto ${k}: no tiene filas con datos, su tabla va a salir vacía.`)
    else if (vacias) add('info', `Contacto ${k}: ${vacias} fila(s) vacía(s) no se incluyen en la base.`)
  })
  return res
}
