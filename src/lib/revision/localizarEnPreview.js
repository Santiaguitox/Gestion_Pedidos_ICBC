// Click en un hallazgo de la revisión INTERNA → llevar al elemento de la
// pieza renderizada. Cada hallazgo trae un `ref` (ver los validadores):
//   { tipo: 'img',      src }
//   { tipo: 'link',     href, texto? }
//   { tipo: 'texto',    fragmento }
//   { tipo: 'atributo', atributo: 'alt' | 'title', fragmento }
// localizarElemento() lo busca en el documento del preview; irAElemento()
// además hace scroll y lo resalta un rato. Los hallazgos sin `ref`
// (estructura, CSS, legales…) no son clickeables.
// Módulo sin dependencias del navegador salvo en irAElemento().

const BLOQUES = new Set(['TD', 'TH', 'TR', 'TABLE', 'P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BR', 'CENTER', 'SECTION'])
// SUP: las marcas de nota (1), (*) no entran en el texto que se le mandó a la IA.
const IGNORADOS = new Set(['STYLE', 'SCRIPT', 'TITLE', 'HEAD', 'SUP'])
// Espacio de no separación armado por código (evita un carácter invisible en el fuente).
const NBSP = String.fromCharCode(160)
const ESPACIOS_G = new RegExp(`[\\s${NBSP}]+`, 'g')
const ESPACIO_1 = new RegExp(`[\\s${NBSP}]`)
const OCULTO = /display\s*:\s*none/i

function normalizar(s) {
  return (s ?? '').replace(ESPACIOS_G, ' ').trim().toLowerCase()
}

function recorrer(nodo, fn) {
  for (const h of nodo.childNodes ?? []) {
    if (h.nodeType === 1) {
      fn(h)
      recorrer(h, fn)
    }
  }
}

function porAtributo(doc, etiqueta, predicado) {
  return [...doc.querySelectorAll(etiqueta)].find(predicado) ?? null
}

// Texto visible normalizado + a qué elemento pertenece cada carácter.
function mapaDeTexto(doc) {
  let texto = ''
  const dueños = []
  const empujar = (c, dueño) => {
    if (c === ' ' && (texto === '' || texto.endsWith(' '))) return
    texto += c
    dueños.push(dueño)
  }
  const visitar = (nodo, padre) => {
    for (const h of nodo.childNodes ?? []) {
      if (h.nodeType === 3) {
        for (const ch of (h.textContent ?? '')) {
          empujar(ESPACIO_1.test(ch) ? ' ' : ch.toLowerCase(), padre)
        }
      } else if (h.nodeType === 1) {
        if (IGNORADOS.has(h.nodeName)) continue
        if (OCULTO.test(h.getAttribute?.('style') ?? '')) continue
        const bloque = BLOQUES.has(h.nodeName)
        if (bloque) empujar(' ', padre)
        visitar(h, h)
        if (bloque) empujar(' ', padre)
      }
    }
  }
  visitar(doc.body, doc.body)
  return { texto, dueños }
}

function buscarTexto(doc, fragmento) {
  const buscado = normalizar((fragmento ?? '').replace(/\(\s*[\d*]+\s*\)/g, ''))
  if (!buscado) return null
  const { texto, dueños } = mapaDeTexto(doc)
  // Intentos de más a menos exactos: el fragmento que devuelve la IA puede
  // no coincidir letra por letra (notas al pie, saltos de línea, etc.).
  const palabras = buscado.split(' ').filter(p => p.length >= 4).sort((a, b) => b.length - a.length)
  const intentos = [buscado, buscado.slice(0, 25).trim(), palabras[0]].filter(Boolean)
  for (const intento of intentos) {
    const i = texto.indexOf(intento)
    if (i >= 0) return dueños[i]
  }
  return null
}

export function localizarElemento(doc, ref) {
  if (!doc?.body || !ref || typeof ref !== 'object') return null
  switch (ref.tipo) {
    case 'img':
      if (!ref.src) return null
      return porAtributo(doc, 'img', i => (i.getAttribute('src') || '').trim() === ref.src.trim())
    case 'link': {
      const href = (ref.href ?? '').trim()
      const mismos = [...doc.querySelectorAll('a')].filter(a => (a.getAttribute('href') || '').trim() === href)
      if (mismos.length <= 1 || !ref.texto) return mismos[0] ?? null
      return mismos.find(a => a.textContent.trim() === ref.texto) ?? mismos[0]
    }
    case 'atributo': {
      const buscado = normalizar(ref.fragmento)
      if (!buscado || !['alt', 'title'].includes(ref.atributo)) return null
      let hallado = null
      recorrer(doc.body, n => {
        if (!hallado && normalizar(n.getAttribute(ref.atributo)).includes(buscado)) hallado = n
      })
      return hallado
    }
    case 'texto':
      return buscarTexto(doc, ref.fragmento)
    default:
      return null
  }
}

const ID_ESTILO = 're-resalte-estilo'
const CLASE = 're-resaltado'
const CSS = `
@keyframes re-resalte-pulso { 0%,100% { outline-color: #f59e0b; } 50% { outline-color: transparent; } }
.${CLASE} { outline: 3px solid #f59e0b !important; outline-offset: 2px !important; animation: re-resalte-pulso 0.9s ease-in-out 3 !important; }
`
let temporizador = null
let anterior = null

// Devuelve true si encontró el elemento. Solo toca el DOM del preview.
export function irAElemento(doc, ref) {
  const el = localizarElemento(doc, ref)
  if (!el) return false
  if (!doc.getElementById(ID_ESTILO)) {
    const estilo = doc.createElement('style')
    estilo.id = ID_ESTILO
    estilo.textContent = CSS
    doc.head.appendChild(estilo)
  }
  if (anterior) anterior.classList.remove(CLASE)
  clearTimeout(temporizador)
  // Reiniciar la animación si se vuelve a hacer click sobre el mismo elemento.
  el.classList.remove(CLASE)
  void el.offsetWidth
  el.classList.add(CLASE)
  anterior = el
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  temporizador = setTimeout(() => { el.classList.remove(CLASE); anterior = null }, 3500)
  return true
}
