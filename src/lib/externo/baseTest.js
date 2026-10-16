// Base de test para la pieza analizada: una columna Email + una por cada
// variable <*Campo*> de la pieza, una fila por cada email de prueba. Mismo
// formato que "Generar base de test" de la app (separador ";"), pero es una
// copia propia: esta página no importa nada del resto del proyecto.

import { encontrarVariables } from './variables.js'

const PALABRAS_LINK = ['link', 'url', 'href']
const PALABRAS_IMAGEN = ['imagen', 'img', 'foto', 'icono', 'banner', 'logo', 'picture']

export const URL_LINK_DEFAULT = 'https://www.icommarketing.com'
export const URL_IMAGEN_DEFAULT = 'https://d343t93odde9ul.cloudfront.net/minisites/ICBC/iconos100/ico-info-100px-r.png'

const sinAcentos = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

// El nombre de la variable casi siempre delata qué espera (LinkBoton,
// ImagenHeader...). Sirve para arrancar con un valor que funcione en un href
// o en un src y no rompa la pieza en el envío de test.
export function tipoCampo(nombre) {
  const n = sinAcentos(nombre.toLowerCase())
  if (PALABRAS_IMAGEN.some(p => n.includes(p))) return 'imagen'
  if (PALABRAS_LINK.some(p => n.includes(p))) return 'link'
  return 'texto'
}

export function valorPorDefecto(nombre) {
  const tipo = tipoCampo(nombre)
  if (tipo === 'link') return URL_LINK_DEFAULT
  if (tipo === 'imagen') return URL_IMAGEN_DEFAULT
  return `${nombre} Test`
}

// Variables únicas de la pieza, en orden de aparición. <*Email*> no se pide:
// se completa sola con el email de cada fila.
export function camposDeBase(html) {
  const vistos = new Set()
  const campos = []
  let tieneEmail = false
  for (const { nombre } of encontrarVariables(html)) {
    const clave = nombre.toLowerCase()
    if (vistos.has(clave)) continue
    vistos.add(clave)
    if (clave === 'email') tieneEmail = true
    else campos.push(nombre)
  }
  return { campos, tieneEmail }
}

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

// Un email por línea (también acepta comas o ";"). Devuelve los válidos sin
// repetir y los que tienen mala forma.
export function parsearEmails(texto) {
  const validos = []
  const invalidos = []
  for (const crudo of String(texto ?? '').split(/[\s,;]+/)) {
    const e = crudo.trim()
    if (!e) continue
    if (!emailValido(e)) invalidos.push(e)
    else if (!validos.some(v => v.toLowerCase() === e.toLowerCase())) validos.push(e)
  }
  return { validos, invalidos }
}

// RFC 4180: si el valor trae el separador, comillas o saltos de línea se
// envuelve en comillas dobles (duplicando las internas). Sin esto, un valor
// como "Av. Corrientes; CABA" correría las columnas de todas las filas.
export function escaparValorCsv(valor, sep) {
  const str = String(valor ?? '')
  const necesita = str.includes(sep) || str.includes('"') || str.includes('\n') || str.includes('\r')
  return necesita ? `"${str.replace(/"/g, '""')}"` : str
}

export function generarCsvBaseTest(campos, valores, emails, sep = ';') {
  const fila = celdas => celdas.map(c => escaparValorCsv(c, sep)).join(sep)
  const filas = emails.map(email => fila([email, ...campos.map(c => valores[c] ?? '')]))
  return [fila(['Email', ...campos]), ...filas].join('\n')
}

// sony-ar_pieza_21012855.html -> sony-ar_base_test_21012855.csv
export function nombreBaseTest(nombreArchivo, extension) {
  const base = String(nombreArchivo || 'pieza.html').replace(/\.html?$/i, '')
  const nombre = /_pieza/.test(base) ? base.replace('_pieza', '_base_test') : `${base}_base_test`
  return `${nombre}.${extension}`
}
