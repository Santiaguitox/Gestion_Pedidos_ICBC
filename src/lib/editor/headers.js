// Catálogo y generador de bandas de Header del Editor de Piezas.
//
// Desde el rediseño de marca 2026 la banda de header es siempre la
// misma estructura: UN logo (la marca o submarca de la comunicación) y
// un color de fondo (el segmento). Por eso ya no hay un .html por cada
// combinación: la banda se GENERA a partir de dos datos independientes.
//
//   · MARCAS    → qué logo lleva (Empresas, Mall, Multipay, ...)
//   · SEGMENTOS → de qué color es la banda (CG, EB, Pay)
//
// La banda mide SIEMPRE ALTO_BANDA px de alto: el logo ocupa su alto y
// los dos espaciadores (arriba y abajo) se reparten lo que sobra, así
// que un logo apenas más alto que el resto achica sus espaciadores en
// vez de agrandar la banda.
//
// Módulo puro (sin Vite, sin React, sin imports): lo usan bloques.js
// (catálogo del editor), exportar/importar y los tests.
//
// ── CÓMO SUMAR UNA MARCA NUEVA ──────────────────────────────────────
// 1. Subir a CloudFront (URL_BASE_LOGOS) las dos imágenes:
//      Logo_Header_<id>_Blanco.png             (sobre CG y Pay)
//      Logo_Header_<id>_Blanco_Coin_Rojo.png   (sobre EB)
// 2. Agregar UNA línea a MARCAS con el id y el tamaño REAL del archivo
//    (ancho y alto en px, tal cual lo marca el archivo). Se muestran a
//    la mitad (escala 2) salvo que se indique otra escala.
// Nada más: el selector, el generador y el importador la toman solos.
// Los tests de este módulo (headers.test.js) validan el catálogo.

export const URL_BASE_LOGOS = 'https://d343t93odde9ul.cloudfront.net/minisites/ICBC/2026/Headers/'

// Alto total de la banda de header, en px.
export const ALTO_BANDA = 70
// Escala por defecto de los archivos de logo: se exportan al doble del
// tamaño con el que se muestran (retina).
export const ESCALA_DEFAULT = 2

// Segmentos = color de fondo de la banda + qué variante del logo se
// aplica encima (el sufijo se agrega al nombre base de la imagen).
// `id` es el prefijo del slug del header (CG_Empresas, EB_Mall, ...) y
// lo usa colorPorPrefijoHeader — por eso va en mayúsculas.
export const SEGMENTOS = [
  { id: 'CG', nombre: 'CG', color: '#c7000b', sufijoLogo: '_Blanco' },
  { id: 'EB', nombre: 'EB', color: '#0d131a', sufijoLogo: '_Blanco_Coin_Rojo' },
  { id: 'PAY', nombre: 'Pay', color: '#635843', sufijoLogo: '_Blanco' },
]

// Marcas. Campos:
//   id        parte del nombre de archivo (Logo_Header_<id>_...) y del slug
//   ancho     ancho REAL del archivo, en px
//   alto      alto REAL del archivo, en px
//   nombre    (opcional) cómo se ve en el selector; por defecto el id
//   alt       (opcional) texto alternativo; por defecto "ICBC <nombre>"
//   escala    (opcional) cuántas veces más grande es el archivo que lo
//             que se muestra; por defecto ESCALA_DEFAULT (2)
//   mostrar   (opcional) { ancho, alto } con el que se muestra el logo,
//             cuando el archivo NO es una escala entera de ese tamaño
//             (Base se muestra a 126x44). Si se indica, reemplaza a
//             `escala`. Medidas pares, como siempre.
//   segmentos (opcional) ids de segmento en los que SÍ existe la marca
//             (si falta alguna variante de imagen); por defecto todos
export const MARCAS = [
  { id: 'Base', alt: 'ICBC', ancho: 160, alto: 56, mostrar: { ancho: 126, alto: 44 } },
  { id: 'Comex', alt: 'ICBC Comercio Exterior', ancho: 530, alto: 56 },
  { id: 'Empresas', ancho: 378, alto: 56 },
  { id: 'Exclusive', alt: 'ICBC Exclusive Banking', ancho: 530, alto: 56, segmentos: ['EB'] }, // solo existe la versión _Coin_Rojo
  { id: 'Hipotecarios', ancho: 424, alto: 56 },
  { id: 'Inversiones', ancho: 400, alto: 56 },
  { id: 'Jubilaciones', ancho: 420, alto: 56 },
  { id: 'Mall', ancho: 240, alto: 56 },
  { id: 'Multipay', ancho: 174, alto: 28, escala: 1 }, // archivo exportado en 1x
  { id: 'Pymes', ancho: 300, alto: 56 },
  { id: 'Sueldos', ancho: 350, alto: 56 },
]

// ─── Normalización ──────────────────────────────────────────────────────────
// Completa los defaults de cada marca una sola vez, así el resto del
// código nunca tiene que preguntarse "¿tiene escala? ¿tiene alt?".
function normalizarMarca(m) {
  const nombre = m.nombre ?? m.id
  return {
    ...m,
    nombre,
    alt: m.alt ?? `ICBC ${nombre}`,
    escala: m.escala ?? ESCALA_DEFAULT,
    segmentos: m.segmentos ?? SEGMENTOS.map(s => s.id),
  }
}
export const CATALOGO_MARCAS = MARCAS.map(normalizarMarca)

export function buscarMarca(id) {
  if (!id) return null
  const buscado = String(id).toLowerCase()
  return CATALOGO_MARCAS.find(m => m.id.toLowerCase() === buscado) ?? null
}
export function buscarSegmento(id) {
  if (!id) return null
  const buscado = String(id).toUpperCase()
  return SEGMENTOS.find(s => s.id === buscado) ?? null
}

// ¿Existe esa marca en ese segmento? (Exclusive, por ejemplo, solo en EB.)
export function combinacionValida(marcaId, segmentoId) {
  const marca = buscarMarca(marcaId)
  const segmento = buscarSegmento(segmentoId)
  return !!marca && !!segmento && marca.segmentos.includes(segmento.id)
}

// Tamaño con el que se MUESTRA el logo (el archivo viene al doble).
export function dimensionesLogo(marca) {
  if (marca.mostrar) return { ancho: marca.mostrar.ancho, alto: marca.mostrar.alto }
  return { ancho: marca.ancho / marca.escala, alto: marca.alto / marca.escala }
}

export function urlLogo(marca, segmento) {
  return `${URL_BASE_LOGOS}Logo_Header_${marca.id}${segmento.sufijoLogo}.png`
}

// Espaciador de arriba y de abajo: (ALTO_BANDA - alto del logo) / 2.
// Con alto de logo par (criterio de diseño: medidas pares para que el
// escalado mobile no dé decimales) la división es siempre exacta.
export function espaciadoresBanda(altoLogo) {
  const resto = ALTO_BANDA - altoLogo
  const arriba = Math.floor(resto / 2)
  return { arriba, abajo: resto - arriba }
}

function escaparAtributo(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

// ─── Generador ──────────────────────────────────────────────────────────────
// Devuelve la <table> de la banda (la misma pieza que antes vivía en
// cada .html de Header/). El <tr><td bgcolor> que la envuelve y los
// comentarios condicionales de Outlook los arma generarExport, igual
// que con los headers anteriores.
export function generarHtmlBanda(marca, segmento) {
  const { ancho, alto } = dimensionesLogo(marca)
  const { arriba, abajo } = espaciadoresBanda(alto)
  const color = segmento.color
  const src = urlLogo(marca, segmento)
  const alt = escaparAtributo(marca.alt)
  // `height` también va en el style: el reset del CSS exportado
  // (img { height: auto }) pisa al atributo height y, si el archivo no
  // tiene exactamente la proporción del tamaño mostrado (Base: 160x56
  // mostrado a 126x44), el alto sale de la proporción del archivo
  // (44.1px) y la banda mide 70.1px en vez de 70.
  const celdaLateral = '<td style="width: 35px; min-width: 35px; font-family: Arial; font-size: 1px;" width="35">&nbsp;</td>'
  return `<table style="max-width: 600px; background-color: ${color};" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${color}" align="center">
    <tbody>
        <tr>
            <td colspan="3" style="height: ${arriba}px; font-size: 0px;" height="${arriba}">&nbsp;</td>
        </tr>
        <tr>
            ${celdaLateral}
            <td style="width: 530px;" width="530" valign="middle" align="left">
                <table width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tbody>
                        <tr>
                            <td style="vertical-align: middle; width: ${ancho}px; height: ${alto}px; text-align:left;" width="${ancho}" valign="middle" align="left"><img src="${src}" style="max-width: ${ancho}px !important; height: ${alto}px; display: block; font-family: Arial,Helvetica,Open Sans,sans-serif; font-size: 15px; color: #333333;" alt="${alt}" width="${ancho}" height="${alto}" /></td>
                            <td>&nbsp;</td>
                        </tr>
                    </tbody>
                </table>
            </td>
            ${celdaLateral}
        </tr>
        <tr>
            <td colspan="3" style="height: ${abajo}px; font-size: 0px;" height="${abajo}">&nbsp;</td>
        </tr>
    </tbody>
</table>`
}

// ─── Banda como "bloque" del editor ─────────────────────────────────────────
// El editor trata cada header como un bloque de la biblioteca
// ({ id, categoria, nombre, slug, html }). Los generados llevan además
// marcaId/segmentoId (para el selector) y nombreCompleto (para avisos y
// badges). Slug = <SEGMENTO>_<Marca>, p. ej. CG_Empresas: el prefijo es
// el segmento, así colorPorPrefijoHeader y las pestañas de la
// biblioteca siguen funcionando sin cambios.
export function slugHeader(marcaId, segmentoId) {
  return `${segmentoId}_${marcaId}`
}

// Inversa de slugHeader: null si el slug no es de un header generado
// (por ejemplo los headers Malba anteriores o un slug desconocido).
export function parsearSlugHeader(slug) {
  const m = /^([A-Za-z]+)_([A-Za-z0-9]+)$/.exec(slug || '')
  if (!m) return null
  const segmento = buscarSegmento(m[1])
  const marca = buscarMarca(m[2])
  if (!segmento || !marca || !marca.segmentos.includes(segmento.id)) return null
  return { marcaId: marca.id, segmentoId: segmento.id }
}

export function crearBandaHeader(marcaId, segmentoId) {
  const marca = buscarMarca(marcaId)
  const segmento = buscarSegmento(segmentoId)
  if (!marca || !segmento) return null
  if (!marca.segmentos.includes(segmento.id)) return null
  const slug = slugHeader(marca.id, segmento.id)
  return {
    id: `header-generado/${slug}`,
    categoria: 'Header',
    nombre: marca.nombre,
    nombreCompleto: `${marca.nombre} · ${segmento.nombre}`,
    slug,
    html: generarHtmlBanda(marca, segmento),
    marcaId: marca.id,
    segmentoId: segmento.id,
    generado: true,
  }
}

// Todas las combinaciones válidas, para la biblioteca del editor.
export function generarBloquesHeader() {
  const bloques = []
  for (const segmento of SEGMENTOS) {
    for (const marca of CATALOGO_MARCAS) {
      const b = crearBandaHeader(marca.id, segmento.id)
      if (b) bloques.push(b)
    }
  }
  return bloques
}

// Segmento por defecto del editor (pieza nueva) y marca por defecto.
export const SEGMENTO_DEFAULT = 'CG'
export const MARCA_DEFAULT = 'Base'

// ─── Validación del catálogo (la usan los tests) ────────────────────────────
// Devuelve una lista de errores legibles; vacía = catálogo sano. Así un
// dato mal cargado (ancho impar, alto que no entra en la banda, id
// repetido) falla en el test y no en un mail ya enviado.
export function validarCatalogo(marcas = CATALOGO_MARCAS, segmentos = SEGMENTOS) {
  const errores = []
  const ids = new Set()
  for (const m of marcas) {
    if (!/^[A-Za-z0-9]+$/.test(m.id)) errores.push(`${m.id}: el id solo puede tener letras y números (forma parte del slug y del nombre de archivo)`)
    if (ids.has(m.id.toLowerCase())) errores.push(`${m.id}: id repetido`)
    ids.add(m.id.toLowerCase())
    for (const campo of ['ancho', 'alto']) {
      if (!Number.isInteger(m[campo]) || m[campo] <= 0) errores.push(`${m.id}: ${campo} del archivo inválido (${m[campo]})`)
      else if (m[campo] % 2 !== 0) errores.push(`${m.id}: ${campo} del archivo (${m[campo]}px) es impar — el diseño pide medidas pares`)
    }
    if (m.mostrar) {
      const { ancho, alto } = m.mostrar
      if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho <= 0 || alto <= 0) errores.push(`${m.id}: "mostrar" inválido (${ancho}x${alto})`)
      else {
        if (ancho % 2 !== 0 || alto % 2 !== 0) errores.push(`${m.id}: el tamaño mostrado (${ancho}x${alto}) debe tener medidas pares`)
        if (alto > ALTO_BANDA) errores.push(`${m.id}: el alto mostrado (${alto}px) no entra en la banda de ${ALTO_BANDA}px`)
        if (ancho > 530) errores.push(`${m.id}: el ancho mostrado (${ancho}px) no entra en los 530px útiles de la banda`)
      }
    } else if (!Number.isInteger(m.escala) || m.escala < 1) errores.push(`${m.id}: escala inválida (${m.escala})`)
    else {
      const { ancho, alto } = dimensionesLogo(m)
      if (!Number.isInteger(ancho) || !Number.isInteger(alto)) errores.push(`${m.id}: el tamaño mostrado (${ancho}x${alto}) no es entero — revisá la escala`)
      else if (alto % 2 !== 0) errores.push(`${m.id}: el alto mostrado (${alto}px) es impar — los espaciadores no suman ${ALTO_BANDA}px exactos`)
      else if (alto > ALTO_BANDA) errores.push(`${m.id}: el alto mostrado (${alto}px) no entra en la banda de ${ALTO_BANDA}px`)
      if (Number.isInteger(ancho) && ancho > 530) errores.push(`${m.id}: el ancho mostrado (${ancho}px) no entra en los 530px útiles de la banda`)
    }
    for (const s of m.segmentos) {
      if (!segmentos.some(x => x.id === s)) errores.push(`${m.id}: segmento "${s}" inexistente`)
    }
  }
  for (const s of segmentos) {
    if (!/^#[0-9a-f]{6}$/.test(s.color)) errores.push(`${s.id}: el color debe ser #rrggbb en minúsculas (${s.color})`)
  }
  return errores
}
