// Compatibilidad con los headers del diseño ANTERIOR al rediseño de
// marca 2026 — para el importador del Editor de Piezas.
//
// Los headers viejos eran un .html por combinación (CG_Banda_Roja_Header_
// Empresas, EB_Banda_Negra_Header, ...) y llevaban íconos de redes
// sociales. Ya no existen como bloques: cuando una pieza importada trae
// uno, se reemplaza por su equivalente nuevo (misma marca y segmento).
// La única excepción es Malba, que no tuvo rediseño y conserva sus dos
// headers anteriores (con los colores nuevos).
//
// Módulo puro, sin imports de Vite: recibe la búsqueda de los headers
// "legacy" por parámetro (viven en bloques.js, que sí usa import.meta.glob).

import { CATALOGO_MARCAS, buscarMarca, buscarSegmento, combinacionValida, crearBandaHeader, parsearSlugHeader, MARCA_DEFAULT, SEGMENTO_DEFAULT } from './headers.js'

// Headers Malba: no se rediseñaron, siguen siendo HTML estático.
export const SLUGS_MALBA = {
  CG: 'CG_Banda_Roja_Header_Malba',
  EB: 'EB_Banda_Negra_Header_Malba',
}
const LOGO_MALBA = 'firma_socio_malba_2.png'

// Slug del header anterior → equivalente nuevo. Para piezas exportadas
// por el editor viejo (llevan el marcador <!--HEADER:slug-->) y para
// borradores guardados en el navegador / en la base.
export const HEADERS_ANTERIORES = [
  { slug: 'CG_Banda_Roja_Header', marcaId: 'Base', segmentoId: 'CG' },
  { slug: 'CG_Banda_Roja_Header_Comex', marcaId: 'Comex', segmentoId: 'CG' },
  { slug: 'CG_Banda_Roja_Header_Empresas', marcaId: 'Empresas', segmentoId: 'CG' },
  { slug: 'CG_Banda_Roja_Header_Inversiones', marcaId: 'Inversiones', segmentoId: 'CG' },
  { slug: 'CG_Banda_Roja_Header_Mall', marcaId: 'Mall', segmentoId: 'CG' },
  { slug: 'CG_Banda_Roja_Header_Multipay', marcaId: 'Multipay', segmentoId: 'CG' },
  { slug: 'EB_Banda_Negra_Header', marcaId: 'Base', segmentoId: 'EB' },
  { slug: 'EB_Banda_Negra_Header_Exclusive', marcaId: 'Exclusive', segmentoId: 'EB' },
  { slug: 'EB_Banda_Header_Inversiones', marcaId: 'Inversiones', segmentoId: 'EB' },
  { slug: 'EB_Banda_Negra_Header_Multipay', marcaId: 'Multipay', segmentoId: 'EB' },
  { slug: 'Pay_Banda_Header_Jubilaciones', marcaId: 'Jubilaciones', segmentoId: 'PAY' },
  { slug: 'Pay_Banda_Header_Sueldos', marcaId: 'Sueldos', segmentoId: 'PAY' },
]

// Logo distintivo de cada header anterior (nombre de archivo, sin
// dominio: las piezas viejas pueden tenerlo en otro CDN). `segmentos`
// son los segmentos donde existía ese logo; si hay más de uno
// (Multipay estaba en CG y en EB con el mismo archivo) se desempata por
// el color de fondo de la banda.
const LOGOS_ANTERIORES = [
  { archivo: 'firma_comercio_exterior_b.png', marcaId: 'Comex', segmentos: ['CG'] },
  { archivo: 'firma_icbc_empresas_blanco.png', marcaId: 'Empresas', segmentos: ['CG'] },
  { archivo: 'ICBC-Inversiones-Horiz-Blanco.png', marcaId: 'Inversiones', segmentos: ['CG'] },
  { archivo: 'ICBC-Inversiones-HOR-BLANCO.png', marcaId: 'Inversiones', segmentos: ['EB'] },
  { archivo: 'Logo_ICBC_Mall_240x60.png', marcaId: 'Mall', segmentos: ['CG'] },
  { archivo: 'firma_icbc_multipay.png', marcaId: 'Multipay', segmentos: ['CG', 'EB'] },
  { archivo: 'firma_icbc_exclusive.png', marcaId: 'Exclusive', segmentos: ['EB'] },
  { archivo: 'ICBC-Jubilaciones-blanco.png', marcaId: 'Jubilaciones', segmentos: ['PAY'] },
  { archivo: 'firma_sueldos_blanco.png', marcaId: 'Sueldos', segmentos: ['PAY'] },
]
// Headers "básicos" (solo el isologo ICBC, sin marca): no tienen logo
// distintivo, se reconocen por la variante del isologo.
const LOGOS_BASE_ANTERIORES = [
  { archivo: 'logo_ICBC_full_bco.png', segmentoId: 'CG' },
  { archivo: 'logo_ICBC_b.png', segmentoId: 'EB' },
]

// Colores de fondo de cada segmento: los nuevos y los del diseño
// anterior (una pieza vieja trae #c4161c / #000000).
const COLORES_POR_SEGMENTO = {
  CG: ['#c7000b', '#c4161c'],
  EB: ['#0d131a', '#000000'],
  PAY: ['#635843'],
}

function nombreArchivo(src) {
  return String(src).split('?')[0].split('/').pop().toLowerCase()
}
function expandirHex(hex) {
  const h = hex.toLowerCase()
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h
}

// Segmento por el color de fondo que aparece en la zona del header
// (background-color / bgcolor). null si no hay ninguno o si hay de más
// de un segmento a la vez (ambiguo).
export function segmentoPorColorDeFondo(html) {
  const hex = new Set()
  for (const m of (html || '').matchAll(/(?:background-color\s*:\s*|bgcolor\s*=\s*["'])\s*(#[0-9a-fA-F]{3,6})\b/gi)) hex.add(expandirHex(m[1]))
  const hits = Object.entries(COLORES_POR_SEGMENTO).filter(([, lista]) => lista.some(c => hex.has(c))).map(([id]) => id)
  return hits.length === 1 ? hits[0] : null
}

// ─── Detección sobre el HTML de una pieza ───────────────────────────────────
// `html` = todo lo que hay antes del contenido (header + imagen principal).
// Devuelve { tipo, marcaId, segmentoId, nombreAnterior? }:
//   tipo 'nuevo'    → usa los logos del diseño actual
//   tipo 'anterior' → usa un header del diseño anterior con equivalente
//   tipo 'malba'    → header Malba (se conserva)
//   tipo null       → no se pudo reconocer (segmentoId puede venir por color)
export function detectarHeaderEnHtml(html) {
  const imgs = [...(html || '').matchAll(/<img\b[^>]*\ssrc="([^"]*)"/gi)].map(m => nombreArchivo(m[1]))
  const segPorColor = segmentoPorColorDeFondo(html)

  // 1) Logos del diseño nuevo: Logo_Header_<Marca>_Blanco[_Coin_Rojo].png
  for (const img of imgs) {
    const m = /^logo_header_(.+?)_blanco(_coin_rojo)?\.png$/.exec(img)
    if (!m) continue
    const marca = buscarMarca(m[1])
    if (!marca) continue
    // _Coin_Rojo solo se aplica sobre EB; _Blanco sobre CG o Pay (el
    // color de fondo dice cuál de los dos).
    let segmentoId = m[2] ? 'EB' : (segPorColor && segPorColor !== 'EB' ? segPorColor : null)
    if (segmentoId && !combinacionValida(marca.id, segmentoId)) segmentoId = null
    return { tipo: 'nuevo', marcaId: marca.id, segmentoId, origen: 'html' }
  }

  // 2) Malba (no rediseñado)
  if (imgs.includes(LOGO_MALBA)) {
    const segmentoId = segPorColor === 'CG' || segPorColor === 'EB' ? segPorColor : null
    return { tipo: 'malba', marcaId: null, segmentoId, origen: 'html' }
  }

  // 3) Logos distintivos del diseño anterior
  for (const img of imgs) {
    const logo = LOGOS_ANTERIORES.find(l => l.archivo.toLowerCase() === img)
    if (!logo) continue
    const segmentoId = logo.segmentos.length === 1 ? logo.segmentos[0] : (logo.segmentos.includes(segPorColor) ? segPorColor : null)
    return { tipo: 'anterior', marcaId: logo.marcaId, segmentoId, origen: 'html' }
  }

  // 4) Header básico anterior (solo isologo ICBC)
  for (const img of imgs) {
    const logo = LOGOS_BASE_ANTERIORES.find(l => l.archivo.toLowerCase() === img)
    if (logo) return { tipo: 'anterior', marcaId: MARCA_DEFAULT, segmentoId: logo.segmentoId, origen: 'html' }
  }

  // 5) Último recurso: el logo se identifica por su POSICIÓN (la primera
  // imagen de la banda que no es una red social ni una imagen ancha tipo
  // principal/banner) y la marca por el nombre de ese archivo
  // (icbc-Pymes-HOR.png, logo_ICBC_Pyme.png, Logo_ICBC_Mall_240x60.png).
  // Los headers viejos traen las redes ANTES del logo, por eso se saltean.
  const logo = imagenesDeLaPieza(html).find(i => !esIconoRedSocial(i.nombre) && !(i.ancho >= ANCHO_IMAGEN_ANCHA))
  const porNombre = marcaPorNombreDeLogo(logo?.nombre)
  if (porNombre) {
    const segmentoId = segPorColor && combinacionValida(porNombre.id, segPorColor) ? segPorColor : null
    return { tipo: 'anterior', marcaId: porNombre.id, segmentoId, origen: 'html' }
  }

  return { tipo: null, marcaId: null, segmentoId: segPorColor, origen: 'html' }
}

// Una imagen de 500px de ancho o más no es un logo de header: es la
// imagen principal o un banner (el logo más ancho mide 265px).
const ANCHO_IMAGEN_ANCHA = 500

// Imágenes del HTML en orden de aparición: { nombre de archivo, ancho }.
function imagenesDeLaPieza(html) {
  return [...(html || '').matchAll(/<img\b[^>]*>/gi)].map(m => {
    const src = /\ssrc="([^"]*)"/i.exec(m[0])?.[1]
    const ancho = parseInt(/\swidth="(\d+)"/i.exec(m[0])?.[1] ?? '', 10)
    return { nombre: src ? nombreArchivo(src) : '', ancho: Number.isNaN(ancho) ? null : ancho }
  }).filter(i => i.nombre)
}

// Íconos de redes de los headers viejos: logo-Tw_B_56x56.png, logo-Fb_…,
// logo-Ig_…, logo-In_… (dos letras de la red + variante + tamaño).
export function esIconoRedSocial(nombreArchivoImg) {
  return /^logo-[a-z]{2}_[a-z]_\d+x\d+\./i.test(String(nombreArchivoImg || ''))
}

// Marca del catálogo cuyo nombre aparece en el nombre de un archivo de
// logo. Tolera singular/plural (pyme ↔ Pymes, inversion ↔ Inversiones).
// "Base" no se busca por nombre: es demasiado genérico. Quién es el logo
// lo decide detectarHeaderEnHtml por posición, no esta función.
export function marcaPorNombreDeLogo(nombreArchivoLogo) {
  const n = String(nombreArchivoLogo || '').toLowerCase()
  if (!n) return null
  return CATALOGO_MARCAS.find(m => {
    if (m.id === MARCA_DEFAULT) return false
    const id = m.id.toLowerCase()
    // El nombre de la marca tiene que aparecer como palabra (no pegado a
    // otras letras: "small" no es "Mall"); tolera singular y plural.
    return [id, id.replace(/es$/, ''), id.replace(/s$/, '')].some(c => c.length >= 4 && new RegExp(`(?<![a-z])${c}(?![a-z])`).test(n))
  }) ?? null
}

// Cuando una pieza trae marcador <!--HEADER:slug--> Y logo reconocible y
// los dos no coinciden, manda el logo: el marcador queda desactualizado
// si alguien cambió el logo a mano en el HTML. Devuelve la detección a
// resolver y, si hubo discrepancia, un texto de aviso.
export function reconciliarHeader(porSlug, porHtml) {
  const clave = d => d.tipo === 'malba' ? 'Malba' : d.marcaId
  if (!porSlug || porSlug.tipo === null || !porHtml || porHtml.tipo === null || !clave(porHtml)) return { deteccion: porSlug }
  if (clave(porSlug) === clave(porHtml)) return { deteccion: porSlug }
  const nombre = d => d.tipo === 'malba' ? 'Malba' : buscarMarca(d.marcaId).nombre
  return {
    deteccion: { ...porHtml, segmentoId: porHtml.segmentoId ?? porSlug.segmentoId },
    aviso: `El marcador del header decía "${nombre(porSlug)}" pero el logo de la pieza es de ${nombre(porHtml)}: se usó el logo.`,
  }
}

// ─── Detección por slug (marcador <!--HEADER:slug-->, borradores) ───────────
export function detectarHeaderPorSlug(slug) {
  if (!slug) return { tipo: null, marcaId: null, segmentoId: null, origen: 'slug' }
  const nuevo = parsearSlugHeader(slug)
  if (nuevo) return { tipo: 'nuevo', ...nuevo, origen: 'slug' }
  const malbaSeg = Object.entries(SLUGS_MALBA).find(([, s]) => s === slug)?.[0]
  if (malbaSeg) return { tipo: 'malba', marcaId: null, segmentoId: malbaSeg, origen: 'slug' }
  const anterior = HEADERS_ANTERIORES.find(h => h.slug === slug)
  if (anterior) return { tipo: 'anterior', marcaId: anterior.marcaId, segmentoId: anterior.segmentoId, nombreAnterior: slug.replace(/_/g, ' '), origen: 'slug' }
  return { tipo: null, marcaId: null, segmentoId: null, origen: 'slug' }
}

// ─── Resolución: de la detección al header que se carga ─────────────────────
// `buscarMalba(segmentoId)` devuelve el header Malba legacy del segmento
// (lo provee bloques.js). Devuelve:
//   bandaHeader      el header a cargar (siempre uno, nunca null)
//   headerPendiente  null si quedó resuelto; { marcaId, segmentoId } con
//                    lo que sí se pudo deducir si el usuario tiene que
//                    elegir marca/segmento antes de importar
//   avisos           para mostrar en el resumen de importación
export function resolverHeaderImportado(deteccion, buscarMalba) {
  const avisos = []
  const aviso = texto => avisos.push({ texto, tipo: 'general', canvasIdx: null })
  const { tipo, marcaId, segmentoId } = deteccion

  if (tipo === 'malba') {
    const malba = segmentoId ? buscarMalba(segmentoId) : null
    if (malba) {
      // Con marcador (slug) el usuario ya sabe que es Malba: el aviso
      // solo aporta cuando se lo reconoció por el logo de una pieza externa.
      if (deteccion.origen === 'html') aviso(`Header Malba detectado (diseño anterior, sin rediseño): se cargó "${malba.nombreCompleto ?? malba.nombre}" con los colores nuevos de la banda.`)
      return { bandaHeader: malba, headerPendiente: null, avisos }
    }
    aviso('Header Malba detectado, pero no se pudo saber si es CG o EB. Elegí el header que corresponde.')
    return { bandaHeader: crearBandaHeader(MARCA_DEFAULT, SEGMENTO_DEFAULT), headerPendiente: { marcaId: null, segmentoId: null }, avisos }
  }

  if ((tipo === 'nuevo' || tipo === 'anterior') && marcaId && segmentoId && combinacionValida(marcaId, segmentoId)) {
    const banda = crearBandaHeader(marcaId, segmentoId)
    if (tipo === 'anterior') {
      const origen = deteccion.nombreAnterior ? `"${deteccion.nombreAnterior}"` : `de ${buscarMarca(marcaId).nombre} (${buscarSegmento(segmentoId).nombre})`
      aviso(`Esta pieza usa un header del diseño anterior ${origen}. Se reemplazó por el header nuevo "${banda.nombreCompleto}". Los íconos de redes sociales ya no existen en el header: revisá el resultado a mano si hace falta.`)
    }
    return { bandaHeader: banda, headerPendiente: null, avisos }
  }

  // Marca reconocida pero segmento dudoso (o combinación inválida), o
  // directamente irreconocible: se carga una opción razonable y se le
  // pide al usuario que confirme antes de importar.
  const marcaOk = marcaId && buscarMarca(marcaId) ? buscarMarca(marcaId).id : null
  const segOk = segmentoId && buscarSegmento(segmentoId) ? buscarSegmento(segmentoId).id : null
  const base = (marcaOk && crearBandaHeader(marcaOk, segOk ?? SEGMENTO_DEFAULT))
    || crearBandaHeader(marcaOk ?? MARCA_DEFAULT, segOk ?? SEGMENTO_DEFAULT)
    || crearBandaHeader(MARCA_DEFAULT, SEGMENTO_DEFAULT)
  aviso(marcaOk
    ? `Se reconoció la marca "${buscarMarca(marcaOk).nombre}" pero no su segmento: elegí marca y segmento del header.`
    : 'No se pudo identificar el header de la pieza original: elegí por cuál reemplazarlo (por defecto se carga "Base · CG").')
  return { bandaHeader: base, headerPendiente: { marcaId: marcaOk, segmentoId: segOk }, avisos }
}

