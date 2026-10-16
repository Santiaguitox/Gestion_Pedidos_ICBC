// Orquestador del análisis externo: trae la pieza por el proxy, corre los 7
// chequeos y arma todo lo que muestra la pantalla /analisis.
//
// Basado en correrRevisionCompleta (src/lib/revision/ejecutarRevision.js de
// TeamWorkHub), pero independiente de él: los chequeos rápidos (no necesitan
// red) se publican apenas terminan, y los de imágenes (05 y 06) llegan al
// final, cuando el proxy midió cada imagen.

import { PROXY_URL, CONCURRENCIA_IMAGENES } from './config.js'
import {
  ValidarClasesDefinidas, ValidarLinks, ValidarAltImagenes,
  ValidarEstructuraHTML, ValidarPesoHTML, tipografiasCargadas,
} from './generales.js'
import { ValidarDimensionesImagenes, ValidarPesoImagenes } from './imagenes.js'
import { resumirDominios } from './dominios.js'
import { encontrarVariables } from './variables.js'
import { detectarVariables } from './variables.js'
import { inventariarLinks } from './inventarioLinks.js'
import { recortarPieza } from './recorte.js'
import { arreglarPieza } from './arreglos.js'
import { CLAVES_PRUEBAS, calcularPuntaje } from './puntaje.js'
import { validarUrl, nombreDescarga } from './url.js'

export class ErrorAnalisis extends Error {
  constructor(codigo, mensaje) {
    super(mensaje || codigo)
    this.name = 'ErrorAnalisis'
    this.codigo = codigo
  }
}

const MENSAJES = {
  url_invalida: 'La URL ingresada no es válida',
  dominio_no_permitido: 'Solo se pueden analizar piezas de icommarketing.com',
  no_encontrada: 'No se encontró la pieza. Revisá que el link esté bien copiado.',
  timeout: 'La pieza tardó demasiado en responder. Probá de nuevo en unos minutos.',
  muy_grande: 'La pieza es demasiado grande para analizarla.',
  no_es_html: 'El link no devuelve una pieza HTML.',
  demasiadas_redirecciones: 'El link redirige demasiadas veces.',
  error_origen: 'icomm no pudo entregar la pieza. Probá de nuevo en unos minutos.',
  limite: 'Se hicieron demasiadas consultas seguidas. Esperá un momento y probá de nuevo.',
  red: 'No se pudo conectar con el servicio de análisis. Probá de nuevo en unos minutos.',
  red_dev: 'No se pudo conectar con el proxy local. ¿Está corriendo "node scripts/externo-proxy-local.mjs"?',
}

export function mensajeDeError(error, enDesarrollo = false) {
  const codigo = error?.codigo
  if (codigo === 'red' && enDesarrollo) return MENSAJES.red_dev
  return MENSAJES[codigo] || 'No se pudo analizar la pieza. Probá de nuevo.'
}

const HAY_DEV = Boolean(import.meta.env?.DEV)
export const esDesarrollo = HAY_DEV

function cederTurno() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function chequearAborto(signal) {
  if (signal?.aborted) throw new DOMException('Análisis cancelado', 'AbortError')
}

async function traerHtml(url, { signal, fetchFn }) {
  let respuesta
  try {
    respuesta = await fetchFn(`${PROXY_URL}?url=${encodeURIComponent(url)}`, { signal })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw new ErrorAnalisis('red')
  }
  if (!respuesta.ok) {
    let codigo = ''
    try { codigo = (await respuesta.json())?.error || '' } catch { /* sin cuerpo JSON */ }
    if (!codigo) codigo = respuesta.status === 429 ? 'limite' : respuesta.status === 404 ? 'no_encontrada' : 'error_origen'
    throw new ErrorAnalisis(codigo)
  }
  return respuesta.text()
}

async function medirImagenes(srcs, { signal, fetchFn, alAvanzar }) {
  const cache = {}
  let siguiente = 0
  let completadas = 0

  async function medir(src) {
    try {
      const r = await fetchFn(`${PROXY_URL}?modo=imagen&url=${encodeURIComponent(src)}`, { signal })
      if (r.ok) cache[src] = await r.json()
    } catch (e) {
      if (e?.name === 'AbortError') throw e
      // Imagen que no se pudo medir: queda sin datos y los chequeos la
      // reportan como no verificable; no corta el análisis.
    }
    completadas++
    alAvanzar(completadas, srcs.length)
  }

  async function worker() {
    while (siguiente < srcs.length) {
      chequearAborto(signal)
      await medir(srcs[siguiente++])
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA_IMAGENES, srcs.length) }, worker))
  return cache
}

// onActualizar recibe: { texto, porcentaje, estados, resultados }
//   estados[clave] = 'pendiente' | 'verificando' | 'lista'
//   resultados     = los chequeos terminados hasta el momento
export async function ejecutarAnalisis({ url, onActualizar, signal, fetchFn = (...a) => fetch(...a) }) {
  const validacion = validarUrl(url)
  if (!validacion.ok) throw new ErrorAnalisis(/icommarketing/.test(validacion.error) ? 'dominio_no_permitido' : 'url_invalida', validacion.error)
  const urlFinal = validacion.url

  const estados = Object.fromEntries(CLAVES_PRUEBAS.map(k => [k, 'pendiente']))
  const resultados = {}
  const emitir = (texto, porcentaje) => onActualizar?.({
    texto, porcentaje, estados: { ...estados }, resultados: { ...resultados },
  })

  emitir('Descargando la pieza...', 2)
  const html = await traerHtml(urlFinal, { signal, fetchFn })
  chequearAborto(signal)

  emitir('Analizando estructura y links...', 8)
  await cederTurno()
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // El peso se mide sobre lo que se descarga (el recorte de la pieza), así el
  // número del chequeo, el de la franja y el del botón son siempre el mismo.
  // Lo que se muestra, se descarga y se copia ya sale con los style partidos
  // arreglados (los chequeos siguen mirando el HTML original y los reportan).
  const recorteBase = recortarPieza(html)
  const arreglo = arreglarPieza(recorteBase.html, tipografiasCargadas(html))
  const recorte = arreglo.cambios || arreglo.protegidos || arreglo.extensiones
    ? {
      ...recorteBase,
      htmlOriginal: recorteBase.html,
      html: arreglo.html,
      bytes: new TextEncoder().encode(arreglo.html).length,
      arreglos: arreglo.cambios,
      protegidos: arreglo.protegidos,
      extensiones: arreglo.extensiones,
      bytesExtensiones: arreglo.bytesExtensiones,
    }
    : { ...recorteBase, arreglos: 0, protegidos: 0, extensiones: 0, bytesExtensiones: 0 }

  // Chequeos que no necesitan red
  const rapidos = {
    estructuraHTML: () => ValidarEstructuraHTML(doc, html),
    clasesCSS: () => ValidarClasesDefinidas(doc),
    links: () => ValidarLinks(doc),
    altImagenes: () => ValidarAltImagenes(doc),
    pesoHTML: () => ValidarPesoHTML(recorte.html),
  }
  for (const [clave, correr] of Object.entries(rapidos)) {
    resultados[clave] = correr()
    estados[clave] = 'lista'
  }
  // Cuántas etiquetas rotas salen realmente corregidas en lo que se descarga
  // (las que están dentro del recorte), para el aviso del chequeo 01.
  const partido = resultados.estructuraHTML?.checks?.find(c => c.estilosPartidos)?.estilosPartidos
  if (partido) partido.corregidas = Math.min(partido.corregidas, arreglo.cambios)
  // Igual con lo que sale repuesto o sacado: solo cuenta lo que está en el recorte.
  const sinNada = { protegidos: arreglo.protegidos, extensiones: arreglo.extensiones }
  const conSello = [...(resultados.estructuraHTML?.checks || []), ...(resultados.estructuraHTML?.advertencias || [])]
  for (const item of conSello) {
    const c = item.corrige
    if (c?.tipo && c.tipo in sinNada) c.corregidas = Math.min(c.corregidas, sinNada[c.tipo])
  }
  estados.dimensiones = 'verificando'
  estados.pesoImagenes = 'verificando'

  const variables = detectarVariables(html)
  const inventario = inventariarLinks(doc)
  emitir('Verificando imágenes...', 12)
  await cederTurno()

  // Imágenes: solo las URLs absolutas http(s) se pueden medir. Las data:, las
  // relativas y las sin protocolo no tienen un servidor al que preguntarle.
  const todas = [...new Set([...doc.querySelectorAll('img')].map(i => (i.getAttribute('src') || '').trim()).filter(Boolean))]
  const medibles = todas.filter(s => /^https?:\/\//i.test(s) && !encontrarVariables(s).length)
  const cache = await medirImagenes(medibles, {
    signal, fetchFn,
    alAvanzar: (n, total) => emitir(`Verificando imagen ${n} de ${total}...`, 12 + Math.round((n / total) * 80)),
  })
  chequearAborto(signal)

  const [dimensiones, pesoImagenes] = await Promise.all([
    ValidarDimensionesImagenes(doc, cache),
    ValidarPesoImagenes(doc, cache),
  ])
  resultados.dimensiones = dimensiones
  resultados.pesoImagenes = pesoImagenes
  estados.dimensiones = 'lista'
  estados.pesoImagenes = 'lista'

  const dominios = resumirDominios(doc, cache)
  emitir('', 100)

  return {
    url: urlFinal,
    nombreArchivo: nombreDescarga(urlFinal),
    html,
    recorte,
    resultados,
    puntaje: calcularPuntaje(resultados),
    dominios,
    variables,
    inventario,
    resumen: {
      imagenes: doc.querySelectorAll('img').length,
      links: doc.querySelectorAll('a').length,
      pesoHTMLkb: resultados.pesoHTML?.kb ?? 0,
      pesoImagenesBytes: pesoImagenes?.pesoTotalBytes ?? 0,
      tipo: recorte.tipo,
    },
  }
}
