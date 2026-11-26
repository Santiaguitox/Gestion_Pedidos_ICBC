// Lectura del TEXTO DEL PEDIDO por código, sin IA: secciones ("Header:",
// "Copy:", "Legal:"...), corte del legal y detección de "link pendiente".
//
// Lo mecánico no se le pide a la IA: el legal es un texto largo que tiene que
// pasar LITERAL (cualquier retoque es un riesgo) y además es el grueso de los
// tokens del pedido. Por eso el legal se corta acá y se carga tal cual; a la IA
// solo le viaja el resto del pedido (ver pedidoSinLegal).

import { LEGAL_FIJO_HTML } from '../constantes.js'

// Frase con la que arranca el legal fijo del editor. Todo lo que viene desde
// acá en el pedido es el legal estándar; lo anterior es el legal específico.
export const ANCLA_LEGAL_FIJO = 'El titular de los datos personales'

// "CTA recuadro" va antes que "CTA" para que la alternancia no lo corte.
const RE_CABECERA = /^[ \t]*(referencia|refe|header|copy|fecha|hora|cta[ \t]+recuadro|cta|link|legal)[ \t]*:[ \t]*(.*)$/i

// Espacios y saltos de línea colapsados a un solo espacio.
export function colapsar(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim()
}

// Texto plano de un HTML (tags fuera, entidades comunes resueltas).
export function textoPlano(html) {
  return colapsar(
    String(html ?? '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&amp;/gi, '&'),
  )
}

// { referencia, refe, header, copy, fecha, hora, cta, cta_recuadro, link,
//   legal } → texto de cada sección (las repetidas se concatenan). Un pedido
// sin ninguna cabecera conocida devuelve {}.
export function leerSecciones(pedido) {
  const secciones = {}
  let actual = null
  for (const linea of String(pedido ?? '').split(/\r?\n/)) {
    const m = linea.match(RE_CABECERA)
    if (m) {
      actual = m[1].toLowerCase().replace(/\s+/g, '_')
      secciones[actual] = secciones[actual] ?? ''
      if (m[2].trim()) secciones[actual] += (secciones[actual] ? '\n' : '') + m[2].trim()
      continue
    }
    if (actual && linea.trim()) secciones[actual] += (secciones[actual] ? '\n' : '') + linea.trim()
  }
  for (const k of Object.keys(secciones)) secciones[k] = secciones[k].trim()
  return secciones
}

// Legal del pedido, separado en específico (lo que hay que cargar como legal
// adicional) y el tramo que coincide con el legal fijo del editor.
//  - Sin sección "Legal:" → null.
//  - Sin la frase ancla → todo el legal es específico.
export function extraerLegal(pedido) {
  const bruto = leerSecciones(pedido).legal
  if (!bruto) return null
  const texto = colapsar(bruto)
  if (!texto) return null
  const i = texto.indexOf(ANCLA_LEGAL_FIJO)
  if (i === -1) return { especifico: texto, tramoFijo: null }
  const especifico = texto.slice(0, i).trim()
  return { especifico: especifico || null, tramoFijo: texto.slice(i).trim() }
}

// Oraciones de un texto (corte en punto + mayúscula/paréntesis siguiente).
// Se aplica igual a los dos lados de la comparación, así los cortes en
// abreviaturas ("Av. Pte.") son consistentes.
function oraciones(texto) {
  return colapsar(texto).split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ(])/).map(o => o.trim()).filter(Boolean)
}

// Compara el tramo "fijo" del pedido con el legal fijo del editor (que está
// bloqueado y no se puede editar). Devuelve null si coincide, o las oraciones
// del pedido que NO están en el legal fijo.
export function compararConLegalFijo(tramoFijo) {
  if (!tramoFijo) return null
  const fijo = new Set(oraciones(textoPlano(LEGAL_FIJO_HTML)))
  const distintas = oraciones(tramoFijo).filter(o => !fijo.has(o))
  return distintas.length > 0 ? { frases: distintas } : null
}

// ¿El pedido dice que el link está pendiente / no lo da?
export function linkPendiente(pedido) {
  const link = leerSecciones(pedido).link
  if (!link) return false
  return /pendiente|a confirmar|a definir|por definir|tbd|falta|todav[ií]a|sin link|no hay/i.test(link)
}

// Pedido para la IA: igual al original pero sin el texto del legal (se carga
// por código). Si no hay sección Legal, queda tal cual.
export function pedidoSinLegal(pedido) {
  const lineas = String(pedido ?? '').split(/\r?\n/)
  const salida = []
  let enLegal = false
  let quitados = 0
  for (const linea of lineas) {
    const m = linea.match(RE_CABECERA)
    if (m) {
      enLegal = m[1].toLowerCase() === 'legal'
      if (enLegal) {
        quitados += m[2].length
        salida.push('Legal:')
        continue
      }
    } else if (enLegal) {
      quitados += linea.length
      continue
    }
    salida.push(linea)
  }
  if (quitados > 0) {
    const i = salida.lastIndexOf('Legal:')
    salida.splice(i + 1, 0, `(texto legal de ${quitados} caracteres: no se envía, la app lo carga tal cual)`)
  }
  return salida.join('\n').trim()
}
