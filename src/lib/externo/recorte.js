// Recorte de la pieza para la vista previa y la descarga.
//
// Una pieza de icomm viene dentro de un documento HTML completo, pero lo que
// importa es el contenedor principal:
//   - id="Table_01"        → pieza armada con HTML custom
//   - id="backgroundTable" → pieza armada con el editor de HTML de icomm
// La descarga es ese contenedor completo (preheader incluido, si lo tiene)
// más los <style> del <head> de la pieza, tenga hoja de estilos o no.
//
// IMPORTANTE: se recorta el TEXTO CRUDO, nunca se re-serializa el DOM. Un
// DOMParser + outerHTML escapa las variables <*Nombre*> y reordena cosas, y
// el archivo descargado ya no sería el de la plataforma.

export const TOKENS = /<!--[\s\S]*?-->|<(style|script)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/gi

// Mismo <style> que la plataforma inyecta para VML (Outlook). No es de la
// pieza, se deja afuera de la descarga.
const STYLE_VML_PLATAFORMA = /<style[^>]*>\s*v\\:\*\s*\{[^{}]*behavior:\s*url\(#default#VML\)[^{}]*\}\s*<\/style>/i

const TIPO_POR_ID = { table_01: 'custom', backgroundtable: 'editor' }

function idDe(atributos) {
  const m = /(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(atributos)
  return m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : ''
}

// Devuelve { inicio, fin, tipo } del contenedor más externo, o null si no hay
// o no cierra bien. Los comentarios (incluidos los condicionales de Outlook,
// que traen <table> adentro) se saltean y no cuentan para el balance.
export function encontrarContenedor(html) {
  const re = new RegExp(TOKENS.source, 'gi')
  let m
  while ((m = re.exec(html)) !== null) {
    if (m[3] === undefined || m[2]) continue // comentario, style/script o cierre
    const tipo = TIPO_POR_ID[idDe(m[4]).toLowerCase()]
    if (!tipo) continue

    const nombre = m[3].toLowerCase()
    const inicio = m.index
    let profundidad = 1
    let n
    while ((n = re.exec(html)) !== null) {
      if (n[3] === undefined || n[3].toLowerCase() !== nombre) continue
      if (n[2]) {
        profundidad--
        if (profundidad === 0) return { inicio, fin: n.index + n[0].length, tipo }
      } else if (!/\/\s*$/.test(n[4])) {
        profundidad++
      }
    }
    return null // no cierra: mejor no recortar que entregar algo cortado
  }
  return null
}

// <style> propios de la pieza (los del <head>). Un comentario condicional que
// contiene un <style> se conserva entero.
function estilosDe(zona) {
  const re = new RegExp(TOKENS.source, 'gi')
  const bloques = []
  let m
  while ((m = re.exec(zona)) !== null) {
    if (m[0].startsWith('<!--')) {
      if (/<style\b/i.test(m[0])) bloques.push(m[0])
    } else if (m[1] && m[1].toLowerCase() === 'style' && !STYLE_VML_PLATAFORMA.test(m[0])) {
      bloques.push(m[0])
    }
  }
  return bloques
}

function tamanoEnBytes(texto) {
  return new TextEncoder().encode(texto).length
}

// Resultado:
//   html       → lo que se descarga y se muestra en la vista previa
//   recortado  → false si no se encontró ningún contenedor (se devuelve el HTML original)
//   tipo       → 'custom' | 'editor' | null
//   estilos    → cantidad de bloques <style> incluidos
//   bytes      → peso de `html`
export function recortarPieza(htmlOriginal) {
  const original = String(htmlOriginal ?? '')
  const cont = encontrarContenedor(original)
  if (!cont) {
    return { html: original, recortado: false, tipo: null, estilos: 0, bytes: tamanoEnBytes(original) }
  }

  const fragmento = original.slice(cont.inicio, cont.fin)
  const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(original)
  const zona = head ? head[1] : original.slice(0, cont.inicio) + '\n' + original.slice(cont.fin)
  const estilos = estilosDe(zona)

  const html = [...estilos, fragmento].join('\n')
  return { html, recortado: true, tipo: cont.tipo, estilos: estilos.length, bytes: tamanoEnBytes(html) }
}

// Documento mínimo para el iframe de la vista previa. Muestra exactamente lo
// que se va a descargar. Los links abren en una pestaña nueva.
export function documentoVistaPrevia(recorte) {
  const BASE = '<base target="_blank">'
  if (!recorte.recortado) {
    const html = recorte.html
    const FONDO = '<style>html{background:#fff}</style>'
    if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, m => m + BASE + FONDO)
    return BASE + FONDO + html
  }
  return '<!doctype html><html><head><meta charset="utf-8">' + BASE
    + '<style>html{overflow:hidden}html,body{margin:0;padding:0}body>table{margin-left:auto;margin-right:auto;box-shadow:0 2px 14px rgba(13,15,32,.14)}</style>'
    + '</head><body>' + recorte.html + '</body></html>'
}
