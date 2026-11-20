// Extrae el texto que una persona lee en una pieza de email: texto visible,
// atributos alt de las imágenes y atributos title. Lo usan la revisión de
// ortografía (IA) y la detección de términos obsoletos (sin IA).
//
// Recorre el árbol con childNodes/nodeType/nodeName/getAttribute, sin
// TreeWalker ni selectores, para poder probarse con un DOM falso (los tests
// corren en entorno node).

export const MAX_CARACTERES_ITEM = 1800
export const MAX_CARACTERES_IA = 15000
export const MAX_ITEMS_IA = 150

const SALTAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE'])
const BLOQUES = new Set([
  'BODY', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TD', 'TH', 'DIV', 'P',
  'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE',
  'CENTER', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'HR',
])

// Espacios, nbsp y caracteres invisibles que los emails usan de relleno
// (preheaders con &zwnj;&nbsp;, etc.).
const INVISIBLES = new RegExp(`(?:\\s|${[0xa0, 0x34f, 0x2060, 0xfeff].map(c => String.fromCharCode(c)).join('|')}|[${String.fromCharCode(0x200b)}-${String.fromCharCode(0x200f)}])+`, 'g')
const TIENE_LETRAS = /\p{L}/u
// Marca de nota al pie: un superíndice con solo números o asteriscos, como
// (1) o *. No es texto para revisar, y pegado a la palabra ("exclusiva(1)")
// confunde a la IA. Otros superíndices (1er, N°) se conservan.
const MARCA_DE_NOTA = /^[\s([]*[\d*]+[)\]\s]*$/
// Marcas de nota al pie escritas como texto dentro de un alt o title, por
// ejemplo "...ICBC.(1) | Hasta..." o "MODO.(2)". Se sacan: pegadas a la
// palabra son ruido para la revisión, igual que los <sup> del cuerpo.
const MARCA_DE_NOTA_EN_LINEA = /\(\s*[\d*]+\s*\)/g
const ESTILO_NEGRITA = /font-weight\s*:\s*(?:bold|[6-9]00)\b/i

function esNegrita(etiqueta, nodo) {
  return etiqueta === 'STRONG' || etiqueta === 'B' || ESTILO_NEGRITA.test(nodo.getAttribute?.('style') ?? '')
}

function limpiar(texto) {
  return (texto ?? '').replace(INVISIBLES, ' ').trim()
}

// Devuelve [{ lugar: 'texto' | 'alt' | 'title', contenido, enlaces }].
// `enlaces` (solo en 'texto') lista el texto de los <a> que hay dentro del
// bloque; sirve para saber si un término está en un hipervínculo.
// Sin partir en trozos ni recortar: eso lo hace prepararParaIA.
export function extraerTextosPieza(doc) {
  const raiz = doc?.body
  if (!raiz) return []

  const items = []
  const indice = new Map()

  function agregar(lugar, contenido, enlaces = []) {
    const sinMarcas = lugar === 'texto' ? contenido : (contenido ?? '').replace(MARCA_DE_NOTA_EN_LINEA, '')
    const texto = limpiar(sinMarcas)
    if (!texto || !TIENE_LETRAS.test(texto)) return
    const clave = `${lugar}\u0000${texto}`
    const previo = indice.get(clave)
    if (previo) {
      for (const e of enlaces) if (!previo.enlaces.includes(e)) previo.enlaces.push(e)
      return
    }
    const item = { lugar, contenido: texto, enlaces: [...enlaces] }
    indice.set(clave, item)
    items.push(item)
  }

  let partes = []
  let enlaces = []
  // true mientras todo el texto acumulado desde el último corte esté en negrita
  let soloNegrita = true
  function cerrarBloque() {
    agregar('texto', partes.join(''), enlaces)
    partes = []
    enlaces = []
    soloNegrita = true
  }

  function recorrer(nodo, negrita = false) {
    for (const hijo of nodo.childNodes ?? []) {
      if (hijo.nodeType === 3) {
        const t = hijo.textContent ?? ''
        if (!negrita && limpiar(t)) soloNegrita = false
        partes.push(t)
        continue
      }
      if (hijo.nodeType !== 1) continue

      const etiqueta = (hijo.nodeName ?? '').toUpperCase()
      if (SALTAR.has(etiqueta)) continue

      if (etiqueta === 'SUP' && MARCA_DE_NOTA.test(hijo.textContent ?? '')) continue

      const title = hijo.getAttribute?.('title')
      if (title) agregar('title', title)
      if (etiqueta === 'IMG') {
        const alt = hijo.getAttribute?.('alt')
        if (alt) agregar('alt', alt)
        continue
      }
      if (etiqueta === 'BR') {
        // Un <br> después de un título en negrita separa título y bajada:
        // son dos textos. En cualquier otro caso es solo un salto de renglón.
        if (soloNegrita && TIENE_LETRAS.test(partes.join(''))) cerrarBloque()
        else partes.push(' ')
        continue
      }
      if (etiqueta === 'A') {
        const textoLink = limpiar(hijo.textContent)
        if (textoLink) enlaces.push(textoLink)
      }

      if (BLOQUES.has(etiqueta)) {
        cerrarBloque()
        recorrer(hijo, esNegrita(etiqueta, hijo))
        cerrarBloque()
      } else {
        recorrer(hijo, negrita || esNegrita(etiqueta, hijo))
      }
    }
  }

  recorrer(raiz)
  cerrarBloque()
  return items
}

// Parte un texto largo en trozos de hasta `max` caracteres, cortando en el
// último espacio para no romper palabras.
function partir(texto, max) {
  const trozos = []
  let resto = texto
  while (resto.length > max) {
    let corte = resto.lastIndexOf(' ', max)
    if (corte < max / 2) corte = max
    trozos.push(resto.slice(0, corte).trim())
    resto = resto.slice(corte).trim()
  }
  if (resto) trozos.push(resto)
  return trozos
}

// Arma lo que se envía a la IA: trozos de tamaño acotado y un tope de
// caracteres/items por pieza. Los alt y title van primero (son cortos y es
// donde más se cuelan errores); el resto sigue el orden del documento.
// `truncado` avisa que quedó texto sin revisar.
export function prepararParaIA(items) {
  const cortos = items.filter(i => i.lugar !== 'texto')
  const cuerpo = items.filter(i => i.lugar === 'texto')
  const trozos = [...cortos, ...cuerpo].flatMap(i =>
    partir(i.contenido, MAX_CARACTERES_ITEM).map(contenido => ({ lugar: i.lugar, contenido })),
  )

  const enviados = []
  let total = 0
  let truncado = false
  for (const t of trozos) {
    if (enviados.length >= MAX_ITEMS_IA || total + t.contenido.length > MAX_CARACTERES_IA) {
      truncado = true
      break
    }
    enviados.push(t)
    total += t.contenido.length
  }
  return { textos: enviados, truncado }
}
