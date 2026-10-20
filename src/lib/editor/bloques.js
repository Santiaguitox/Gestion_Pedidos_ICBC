// Catálogo de bloques del Editor de Piezas, cargado con
// import.meta.glob de Vite sobre los templates HTML reales.
// Módulo aparte a propósito: es el ÚNICO de lib/editor que depende
// de Vite (import.meta.glob no existe en Node puro) — mantenerlo
// aislado permite que el resto de las libs sean funciones puras
// testeables, y que un test pueda proveer su propio catálogo si
// hiciera falta.

import { CATALOGO_MARCAS, SEGMENTOS, buscarSegmento, generarBloquesHeader, slugHeader, MARCA_DEFAULT, SEGMENTO_DEFAULT } from './headers.js'
import { SLUGS_MALBA, detectarHeaderPorSlug, resolverHeaderImportado } from './headersCompat.js'

// ─── Bloques ────────────────────────────────────────────────────────────────
// IMPORTANTE: { as: 'raw' } es la sintaxis VIEJA de import.meta.glob,
// removida en Vite 5+. Este proyecto usa Vite 8 (ver package.json) —
// con la sintaxis vieja, Vite cae al comportamiento default del glob
// (importar el módulo completo, no el string crudo), y cada entrada de
// BLOQUES_RAW termina siendo un objeto Module en vez de un string. Eso
// explica el bug real visto en producción: el HTML del bloque se
// mostraba como el texto literal "[object Module]" en vez de su
// contenido — pasaba solo en Vercel (que reinstala node_modules según
// package.json, trayendo Vite 8 real) y no en local, donde
// probablemente había quedado una instalación vieja de Vite que sí
// soportaba la sintaxis deprecada sin avisar con un error.
export const BLOQUES_RAW = import.meta.glob(
  '/src/data/Templates/ICBC/{Header,Contenido,Botones}/*.html',
  { query: '?raw', import: 'default', eager: true }
)
// Los .html de la carpeta Header/ ya NO son los headers del editor: desde
// el rediseño de marca 2026 la banda se genera a partir del catálogo de
// marcas y segmentos (ver headers.js). En esa carpeta solo quedan los dos
// headers de Malba, que no tuvieron rediseño y siguen siendo HTML estático
// (el prefijo del slug, CG_ o EB_, es su segmento).
// Solo se toman los slugs de Malba (SLUGS_MALBA): si en la carpeta quedaron
// .html de los headers anteriores sin borrar, se ignoran en vez de
// aparecer como si fueran Malba.
const BLOQUES_DESDE_ARCHIVOS = Object.entries(BLOQUES_RAW).filter(([path]) => {
  const partes = path.split('/')
  return partes[partes.length - 2] !== 'Header' || Object.values(SLUGS_MALBA).includes(partes[partes.length - 1].replace('.html', ''))
}).map(([path, html]) => {
  const partes = path.split('/')
  const categoria = partes[partes.length - 2]
  const slug = partes[partes.length - 1].replace('.html', '')
  if (categoria === 'Header') {
    const segmento = buscarSegmento(slug.split('_')[0])
    return {
      id: path, categoria, slug, html,
      nombre: 'Malba',
      nombreCompleto: `Malba · ${segmento?.nombre ?? ''}`.trim(),
      segmentoId: segmento?.id ?? null,
      anterior: true,
    }
  }
  return { id: path, categoria, nombre: slug.replace(/_/g, ' '), slug, html }
})

export const BLOQUES = [...BLOQUES_DESDE_ARCHIVOS, ...generarBloquesHeader()]
  .sort((a, b) => a.nombre.localeCompare(b.nombre))

export const BLOQUES_HEADER = BLOQUES.filter(b => b.categoria === 'Header')
export const BLOQUES_CONTENIDO = BLOQUES.filter(b => b.categoria !== 'Header')
export const BLOQUE_ESPACIADOR = BLOQUES.find(b => b.slug === 'Espaciador')

// Header Malba (diseño anterior) de un segmento, o null.
export function buscarMalba(segmentoId) {
  return BLOQUES_HEADER.find(b => b.anterior && b.segmentoId === segmentoId) ?? null
}

// Header por defecto del editor (pieza nueva): Base · CG.
export function headerPorDefecto() {
  return BLOQUES_HEADER.find(b => b.slug === slugHeader(MARCA_DEFAULT, SEGMENTO_DEFAULT)) ?? BLOQUES_HEADER[0] ?? null
}

// Opciones del selector de header (marca + segmento): las marcas del
// catálogo más Malba (diseño anterior). `segmentos` son los segmentos en
// los que existe cada una, así el selector nunca ofrece una combinación
// que no existe (Exclusive en CG, por ejemplo).
export const OPCIONES_MARCA_HEADER = [
  ...CATALOGO_MARCAS.map(m => ({ id: m.id, nombre: m.nombre, segmentos: m.segmentos })),
  { id: 'Malba', nombre: 'Malba (diseño anterior)', segmentos: BLOQUES_HEADER.filter(b => b.anterior).map(b => b.segmentoId) },
]

// Headers que muestra la biblioteca: UNO por segmento (CG, EB, Pay) de la
// marca elegida en ese momento. La marca se cambia desde el selector;
// los segmentos donde la marca no existe (Exclusive en CG, Malba en Pay)
// no se listan.
export function bandasHeaderBiblioteca(marcaId) {
  return SEGMENTOS.map(seg => bandaHeaderDeSeleccion(marcaId, seg.id)).filter(Boolean)
}
// Nombre con el que la biblioteca rotula una banda: su segmento.
export function etiquetaHeaderBiblioteca(banda) {
  return buscarSegmento(banda?.segmentoId)?.nombre ?? banda?.nombre ?? ''
}

// Header (bloque de la biblioteca) para una marca y un segmento, o null.
export function bandaHeaderDeSeleccion(marcaId, segmentoId) {
  if (marcaId === 'Malba') return buscarMalba(segmentoId)
  return BLOQUES_HEADER.find(b => b.marcaId === marcaId && b.segmentoId === segmentoId) ?? null
}

// Inversa: marca y segmento con los que se ve un header en el selector.
export function seleccionDeBandaHeader(banda) {
  if (!banda) return { marcaId: null, segmentoId: null }
  return { marcaId: banda.anterior ? 'Malba' : banda.marcaId, segmentoId: banda.segmentoId }
}

// Header guardado por su slug — borradores del navegador, piezas
// guardadas, marcador <!--HEADER:slug--> de piezas exportadas. Si el slug
// es de un header del diseño anterior se lo reemplaza por su equivalente
// nuevo y se devuelve el aviso correspondiente.
export function resolverHeaderPorSlug(slug) {
  return resolverHeaderImportado(detectarHeaderPorSlug(slug), buscarMalba)
}

// ─── Manipulación de HTML como STRING PURO ─────────────────────────────────
// NUNCA se usa DOMParser para serializar — contamina el HTML con estilos
// computados del browser. Solo se manipula como string.
