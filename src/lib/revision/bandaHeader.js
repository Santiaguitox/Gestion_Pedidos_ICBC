import { ALTO_BANDA } from '@/lib/editor/headers'

// Prueba de la banda de header: el rediseño 2026 fija su alto en ALTO_BANDA
// (70 px) sin importar la marca; el logo ocupa su alto y los dos espaciadores
// se reparten lo que sobra (ver lib/editor/headers.js). Acá se lee esa
// estructura de la pieza: <table> de 3 filas = espaciador, logo, espaciador.
//
// Se muestra como una entrada más de "Estructuras obsoletas" (tarjeta 10):
// una banda que no mide 70 es diseño viejo. Todas las piezas del banco llevan
// banda, así que si no se la puede identificar también se marca.
//
// Devuelve [] si está bien, o [entrada] con la misma forma que
// CompararConTemplates (ver ResultadoPanel, tarjeta 10).

// Espacios y no separación (armado por código: evita un carácter invisible en el fuente).
const SIN_ESPACIOS = new RegExp(`[\\s${String.fromCharCode(160)}]`, 'g')

const nombreDe = (n) => (n?.nodeName ?? '').toUpperCase()
// NodeList del navegador no tiene filter/some: siempre se pasa por Array.from.
const hijos = (n) => Array.from(n?.childNodes ?? [])
const celdas = (tr) => hijos(tr).filter(c => c.nodeType === 1 && ['TD', 'TH'].includes(nombreDe(c)))

function filasDe(tabla) {
  const filas = []
  for (const h of hijos(tabla)) {
    if (h.nodeType !== 1) continue
    const n = nombreDe(h)
    if (n === 'TR') filas.push(h)
    else if (['TBODY', 'THEAD', 'TFOOT'].includes(n)) {
      for (const tr of hijos(h)) if (tr.nodeType === 1 && nombreDe(tr) === 'TR') filas.push(tr)
    }
  }
  return filas
}

// Alto declarado en px: el del style gana sobre el atributo (es lo que
// respetan los clientes de mail). `height` anclado para no tomar line-height
// ni max-height.
function altoDeclarado(el) {
  const m = /(?:^|;)\s*height\s*:\s*([\d.]+)px/i.exec(el.getAttribute('style') || '')
  if (m) return parseFloat(m[1])
  const a = /^\s*([\d.]+)\s*(?:px)?\s*$/i.exec(el.getAttribute('height') || '')
  return a ? parseFloat(a[1]) : null
}

function esEspaciador(tr) {
  const cs = celdas(tr)
  if (cs.length !== 1) return null
  const celda = cs[0]
  const hayImagen = (function buscar(n) {
    return hijos(n).some(h => h.nodeType === 1 && (nombreDe(h) === 'IMG' || buscar(h)))
  })(celda)
  if (hayImagen) return null
  if ((celda.textContent ?? '').replace(SIN_ESPACIOS, '').length > 0) return null
  return altoDeclarado(celda)
}

function contiene(nodo, buscado) {
  for (let n = buscado; n; n = n.parentNode) if (n === nodo) return true
  return false
}

// Mide una tabla candidata (3 filas: espaciador, contenido, espaciador).
// `contenido` es el alto de lo que lleva la fila del medio: el logo, o la
// banda interna ya medida (los headers viejos anidan una tabla de 3 filas
// dentro de otra). null si la tabla no tiene esa estructura.
function medirBanda(filas, img, contenido) {
  if (filas.length !== 3 || !contiene(filas[1], img)) return null
  const arriba = esEspaciador(filas[0])
  const abajo = esEspaciador(filas[2])
  if (arriba == null || abajo == null) return null
  return { arriba, logo: contenido, abajo, total: arriba + contenido + abajo }
}

// Sube desde el logo por las tablas que lo envuelven. Las de 1 fila son
// simples contenedores y se saltan; las de 3 filas con la estructura de banda
// se miden (la más externa es la banda completa); cualquier otra tabla corta.
function medirDesdeLogo(img) {
  let contenido = altoDeclarado(img)
  if (contenido == null) return null
  let medida = null
  for (let n = img.parentNode; n; n = n.parentNode) {
    // La celda (o fila) que envuelve al logo puede declarar un alto mayor que
    // el de la imagen (td height: 43px con un logo de 28): la fila mide lo
    // más alto de los dos.
    if (['TD', 'TH', 'TR'].includes(nombreDe(n))) {
      const alto = altoDeclarado(n)
      if (alto != null) contenido = Math.max(contenido, alto)
      continue
    }
    if (nombreDe(n) !== 'TABLE') continue
    const filas = filasDe(n)
    if (filas.length === 1) continue
    const m = medirBanda(filas, img, contenido)
    if (!m) break
    medida = m
    contenido = m.total
  }
  return medida
}

// Primera imagen "de verdad" (se salta los píxeles de seguimiento de 1x1).
function primeraImagen(doc) {
  return [...doc.querySelectorAll('img')].find(img => {
    const w = parseFloat(img.getAttribute('width'))
    const h = parseFloat(img.getAttribute('height'))
    return !(w <= 2 && h <= 2)
  }) ?? null
}

export function ValidarBandaHeader(doc) {
  const img = primeraImagen(doc)
  const medida = img ? medirDesdeLogo(img) : null

  let detalle = null
  if (!medida) {
    detalle = `No se pudo identificar la banda de header (espaciador, logo, espaciador): el diseño actual exige que mida ${ALTO_BANDA}px`
  } else if (medida.total !== ALTO_BANDA) {
    detalle = `La banda de header mide ${medida.total}px (arriba ${medida.arriba} + logo ${medida.logo} + abajo ${medida.abajo}): el diseño actual exige ${ALTO_BANDA}px`
  }
  if (!detalle) return []

  const src = img?.getAttribute('src') || ''
  return [{
    nombre: 'Banda de header',
    banda: true,
    deprecado: true,
    ok: false,
    encontrado: true,
    errores: [{
      tipo: 'Estructura obsoleta',
      detalle,
      ...(src && { ref: { tipo: 'img', src } }),
    }],
  }]
}
