import JSZip from 'jszip'
import { REVISION_CONFIG } from '@/lib/revision/config'

// Trae el HTML de una pieza via el mismo proxy que usa RevisionEnvios
async function fetchHtml(url) {
  const res = await fetch(`${REVISION_CONFIG.PROXY_URL}?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`Error ${res.status} al obtener ${url}`)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) throw new Error('El proxy no está disponible en este entorno')
  return res.text()
}

// Limpia el HTML descargado para quedarse solo con:
// 1. Los <style> que contienen @media (hoja de estilos relevante)
// 2. Todo el contenido del body desde el preheader en adelante
// (el div con display:none que contiene el texto oculto en inbox)
function limpiarHtml(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // 1. Estilos con @media
  const estilosRelevantes = Array.from(doc.querySelectorAll('style'))
    .filter(s => s.textContent.includes('@media'))
    .map(s => s.outerHTML)
    .join('\n')

  // 2. Contenido del body desde el preheader en adelante
  // El preheader es el primer div con display:none (texto oculto en inbox)
  const body = doc.body
  let contenido = ''
  if (body) {
    const nodos = Array.from(body.childNodes)
    // Buscar el índice del primer elemento con display:none (preheader)
    // puede estar anidado en una tabla, así que buscamos en el innerHTML
    // directamente usando el patrón conocido
    const bodyHtml = body.innerHTML
    const preheaderIdx = bodyHtml.indexOf('display: none')
    if (preheaderIdx !== -1) {
      // Retroceder hasta el < más cercano antes del match
      const inicio = bodyHtml.lastIndexOf('<', preheaderIdx)
      contenido = bodyHtml.slice(inicio)
    } else {
      // Si no hay preheader, tomar todo el body
      contenido = bodyHtml
    }
  }

  return `${estilosRelevantes}\n${contenido}`.trim()
}
function nombreArchivo(pieza) {
  const base = (pieza.nombre_pieza || pieza.link_online || 'pieza')
    .replace(/https?:\/\/[^/]+\/?/, '') // sacar dominio si es un link
    .replace(/[^a-zA-Z0-9_\-]/g, '_')   // caracteres inválidos → _
    .replace(/_+/g, '_')                  // múltiples _ → uno solo
    .replace(/^_|_$/g, '')               // trim _
    .slice(0, 80)                         // máximo 80 chars
  return `${base || 'pieza'}.html`
}

// Descarga una sola pieza como ZIP con el archivo .html adentro
export async function descargarPiezaIndividual(pieza, onError) {
  if (!pieza.link_online) { onError?.('La pieza no tiene link cargado'); return }
  try {
    const html = limpiarHtml(await fetchHtml(pieza.link_online))
    const zip = new JSZip()
    zip.file(nombreArchivo(pieza), html)
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo(pieza).replace('.html', '.zip')
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    onError?.(e.message || 'No se pudo descargar el HTML')
  }
}

// Descarga todas las piezas con link como un único ZIP
export async function descargarTodasLasPiezas(entregables, nombrePedido, onError) {
  const conLink = entregables.filter(e => e.link_online)
  if (!conLink.length) { onError?.('Ninguna pieza tiene link cargado'); return }

  const zip = new JSZip()
  const usados = new Set()

  await Promise.all(conLink.map(async pieza => {
    try {
    const html = limpiarHtml(await fetchHtml(pieza.link_online))
      // Evitar nombres de archivo duplicados dentro del ZIP
      let nombre = nombreArchivo(pieza)
      if (usados.has(nombre)) {
        const ext = '.html'
        const base = nombre.replace(ext, '')
        let i = 2
        while (usados.has(`${base}_${i}${ext}`)) i++
        nombre = `${base}_${i}${ext}`
      }
      usados.add(nombre)
      zip.file(nombre, html)
    } catch {
      // Si una pieza falla, seguir con las demás — no abortar todo
    }
  }))

  if (Object.keys(zip.files).length === 0) {
    onError?.('No se pudo obtener el HTML de ninguna pieza')
    return
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const nombreZip = (nombrePedido || 'piezas')
    .replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60)
  a.download = `${nombreZip}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
