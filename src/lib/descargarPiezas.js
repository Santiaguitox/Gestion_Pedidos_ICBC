import JSZip from 'jszip'
import { REVISION_CONFIG } from '@/lib/revision/config'

async function fetchHtml(url) {
  const res = await fetch(`${REVISION_CONFIG.PROXY_URL}?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`Error ${res.status} al obtener ${url}`)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) throw new Error('El proxy no está disponible en este entorno')
  return res.text()
}

// Tags HTML que se validan (los más comunes en emails)
// Se excluyen los void elements que no tienen cierre: img, br, hr, meta, input, link
const TAGS_VALIDAR = ['table', 'tbody', 'tr', 'td', 'div', 'span', 'a', 'p', 'strong', 'em', 'ul', 'ol', 'li']

// Valida que los tags abran y cierren correctamente.
// Devuelve array de strings con los problemas encontrados, o [] si está ok.
function validarEstructura(html) {
  const problemas = []
  for (const tag of TAGS_VALIDAR) {
    // Contar aperturas (excluir self-closing y comentarios)
    const aperturas = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) ?? []).length
    const cierres   = (html.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length
    if (aperturas !== cierres) {
      problemas.push(`<${tag}>: ${aperturas} apertura${aperturas !== 1 ? 's' : ''}, ${cierres} cierre${cierres !== 1 ? 's' : ''}`)
    }
  }
  return problemas
}

// Limpia el HTML: solo estilos con @media + contenido desde el preheader.
// También elimina los cierres sobrantes de los wrappers que se sacan arriba.
function limpiarHtml(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // 1. Estilos con @media
  const estilosRelevantes = Array.from(doc.querySelectorAll('style'))
    .filter(s => s.textContent.includes('@media'))
    .map(s => s.outerHTML)
    .join('\n')

  // 2. Contenido del body desde el preheader en adelante
  const bodyHtml = doc.body?.innerHTML ?? ''
  const preheaderIdx = bodyHtml.indexOf('display: none')
  let contenido = preheaderIdx !== -1
    ? bodyHtml.slice(bodyHtml.lastIndexOf('<', preheaderIdx))
    : bodyHtml

  // 3. Eliminar cierres sobrantes al final que corresponden a los
  // wrappers externos que se cortaron al sacar lo que estaba antes
  // del preheader. Se detectan contando qué tags tienen más cierres
  // que aperturas en el contenido recortado y se eliminan del final.
  const tagsConCierresSobrantes = TAGS_VALIDAR.filter(tag => {
    const aperturas = (contenido.match(new RegExp(`<${tag}[\\s>]`, 'gi')) ?? []).length
    const cierres   = (contenido.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length
    return cierres > aperturas
  })

  for (const tag of tagsConCierresSobrantes) {
    const aperturas = (contenido.match(new RegExp(`<${tag}[\\s>]`, 'gi')) ?? []).length
    const cierres   = (contenido.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length
    let sobrantes = cierres - aperturas
    // Eliminar los cierres sobrantes de atrás para adelante
    contenido = contenido.replace(new RegExp(`(</${tag}>)(?=[^]*$)`, 'gi'), (match, p1, offset, str) => {
      if (sobrantes > 0) {
        // Solo eliminar si está hacia el final del string
        const restante = str.slice(offset)
        const cierresRestantes = (restante.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length
        if (cierresRestantes <= sobrantes) { sobrantes--; return '' }
      }
      return match
    })
  }

  return {
    html: `${estilosRelevantes}\n${contenido}`.trim(),
    problemas: validarEstructura(`${estilosRelevantes}\n${contenido}`)
  }
}

function nombreArchivo(pieza) {
  const base = (pieza.nombre_pieza || pieza.link_online || 'pieza')
    .replace(/https?:\/\/[^/]+\/?/, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
  return `${base || 'pieza'}.html`
}

function triggerDescarga(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

// Descarga una sola pieza como ZIP.
// Devuelve { problemas } para que el llamador muestre el modal si corresponde.
// Si se llama con continuar=true, descarga sin validar.
export async function descargarPiezaIndividual(pieza, { continuar = false } = {}) {
  if (!pieza.link_online) throw new Error('La pieza no tiene link cargado')
  const { html, problemas } = limpiarHtml(await fetchHtml(pieza.link_online))
  if (problemas.length > 0 && !continuar) return { problemas }

  const zip = new JSZip()
  zip.file(nombreArchivo(pieza), html)
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDescarga(blob, nombreArchivo(pieza).replace('.html', '.zip'))
  return { problemas: [] }
}

// Descarga todas las piezas con link como un único ZIP.
// Devuelve { problemas: { [nombre]: string[] } } con los problemas por pieza.
export async function descargarTodasLasPiezas(entregables, nombrePedido, { continuar = false } = {}) {
  const conLink = entregables.filter(e => e.link_online)
  if (!conLink.length) throw new Error('Ninguna pieza tiene link cargado')

  const resultados = await Promise.all(conLink.map(async pieza => {
    try {
      const { html, problemas } = limpiarHtml(await fetchHtml(pieza.link_online))
      return { pieza, html, problemas }
    } catch {
      return { pieza, html: null, problemas: [] }
    }
  }))

  // Si hay problemas y no se forzó continuar, devolver sin descargar
  const conProblemas = resultados.filter(r => r.problemas.length > 0)
  if (conProblemas.length > 0 && !continuar) {
    return {
      problemas: Object.fromEntries(
        conProblemas.map(r => [r.pieza.nombre_pieza || r.pieza.link_online, r.problemas])
      )
    }
  }

  const zip = new JSZip()
  const usados = new Set()
  for (const { pieza, html } of resultados) {
    if (!html) continue
    let nombre = nombreArchivo(pieza)
    if (usados.has(nombre)) {
      const base = nombre.replace('.html', '')
      let i = 2
      while (usados.has(`${base}_${i}.html`)) i++
      nombre = `${base}_${i}.html`
    }
    usados.add(nombre)
    zip.file(nombre, html)
  }

  if (Object.keys(zip.files).length === 0) throw new Error('No se pudo obtener el HTML de ninguna pieza')

  const blob = await zip.generateAsync({ type: 'blob' })
  const nombreZip = (nombrePedido || 'piezas').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60)
  triggerDescarga(blob, `${nombreZip}.zip`)
  return { problemas: {} }
}
