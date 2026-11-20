// Términos y links de canales dados de baja. Detección por texto, SIN IA:
// no gasta créditos y funciona aunque la IA esté caída.
//
// Se reporta como "detalle menor" (amarillo), nunca como error: una pieza
// puede mencionar el término a propósito, por ejemplo para avisar que ese
// canal ya no existe.
//
// Para sumar otro canal dado de baja, agregar una entrada a TERMINOS_OBSOLETOS
// (y a DOMINIOS_OBSOLETOS si tenía sitio propio).

const ESP = '[\\s\\u00a0]'

export const TERMINOS_OBSOLETOS = [
  {
    id: 'icbc-access-banking',
    nombre: 'ICBC Access Banking',
    // "ICBC Access Banking", "Access Banking", "AccessBanking" y "ICBC Access".
    patron: new RegExp(`\\b(?:icbc${ESP}+)?access${ESP}*banking\\b|\\bicbc${ESP}+access\\b`, 'i'),
    // Regla del banco: cómo debe nombrarse ahora.
    regla: 'ICBC Online Banking (si va solo), ICBC Online y Mobile Banking (si va con MBR) o ICBC Online Banking (si lleva hipervínculo)',
    reglaHipervinculo: 'ICBC Online Banking',
  },
]

export const DOMINIOS_OBSOLETOS = [
  { id: 'access-banking-web', dominio: 'accessbanking.com.ar', nombre: 'ICBC Access Banking', reemplazo: 'ICBC Online Banking' },
]

const ETIQUETA_LUGAR = {
  texto: 'en el texto',
  alt: 'en el alt de una imagen',
  title: 'en un atributo title',
}

function fragmentoAlrededor(texto, indice, largo) {
  const desde = Math.max(0, indice - 25)
  const hasta = Math.min(texto.length, indice + largo + 25)
  return `${desde > 0 ? '…' : ''}${texto.slice(desde, hasta)}${hasta < texto.length ? '…' : ''}`
}

// Busca términos obsoletos en los textos extraídos (extraerTextosPieza).
// Devuelve [{ detalle }] sin repetir.
export function buscarTerminosObsoletos(items) {
  const hallazgos = []
  const vistos = new Set()

  for (const item of items) {
    for (const t of TERMINOS_OBSOLETOS) {
      const global = new RegExp(t.patron.source, 'gi')
      for (const m of item.contenido.matchAll(global)) {
        const enHipervinculo = item.lugar === 'texto' && (item.enlaces ?? []).some(e => t.patron.test(e))
        const clave = `${t.id}|${item.lugar}|${enHipervinculo}|${m[0].toLowerCase()}|${item.contenido.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25)}`
        if (vistos.has(clave)) continue
        vistos.add(clave)

        const donde = enHipervinculo ? 'en un texto con hipervínculo' : ETIQUETA_LUGAR[item.lugar] ?? 'en el texto'
        const regla = enHipervinculo ? t.reglaHipervinculo : t.regla
        const contexto = fragmentoAlrededor(item.contenido, m.index, m[0].length)
        hallazgos.push({
          ref: item.lugar === 'texto' ? { tipo: 'texto', fragmento: m[0] } : { tipo: 'atributo', atributo: item.lugar, fragmento: m[0] },
          detalle: `Se menciona "${m[0]}" ${donde} (${contexto}). El banco pidió reemplazarlo por: ${regla}`,
        })
      }
    }
  }
  return hallazgos
}

function hrefMencionaDominio(href, dominio) {
  let decodificado = href
  try {
    decodificado = decodeURIComponent(href)
  } catch { /* href con % mal formado: se usa tal cual */ }
  return decodificado.toLowerCase().includes(dominio)
}

// Busca links a sitios dados de baja. También detecta el dominio dentro de
// un link de redirección o de tracking. Devuelve [{ detalle }] sin repetir.
export function buscarLinksObsoletos(doc) {
  const hallazgos = []
  const vistos = new Set()

  for (const a of [...doc.querySelectorAll('a')]) {
    const href = (a.getAttribute('href') || '').trim()
    if (!href) continue
    for (const d of DOMINIOS_OBSOLETOS) {
      if (!hrefMencionaDominio(href, d.dominio)) continue
      if (vistos.has(href)) continue
      vistos.add(href)
      hallazgos.push({
        ref: { tipo: 'link', href, texto: a.textContent.trim() },
        detalle: `Link a ${d.dominio} (${href.length > 80 ? `${href.slice(0, 80)}…` : href}): el canal ${d.nombre} ya no es válido. Ahora es ${d.reemplazo}`,
      })
    }
  }
  return hallazgos
}

// Suma los links obsoletos como "detalle menor" del bloque Links existente.
// No cambia si la prueba pasa o falla ni el total del resumen.
export function combinarLinksConObsoletos(links, obsoletos) {
  if (!links || !obsoletos?.length) return links
  return { ...links, advertencias: [...(links.advertencias ?? []), ...obsoletos] }
}
