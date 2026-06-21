import { REVISION_CONFIG } from '@/lib/revision/config'
import { templates } from '@/data/Templates/index'
import { CompararConTemplates } from '@/lib/revision/templates'
import { ValidarDominioImagenes, ValidarClasesDefinidas, ValidarLegal, ValidarLinks, ValidarAltImagenes, ValidarEstructuraHTML, ValidarPesoHTML } from '@/lib/revision/generales'
import { ValidarDimensionesImagenes, ValidarPesoImagenes } from '@/lib/revision/imagenes'

// Lógica de revisión extraída de RevisionEmail.jsx (la herramienta de
// "Revisión de emails") para poder reusarla también desde
// EntregablesSection.jsx, donde se dispara automáticamente al
// cargar/editar el link de una pieza. onProgreso es opcional — quien
// llama decide qué hacer con el texto de progreso (mostrarlo, ignorarlo).
//
// Trae el HTML desde una URL (vía el proxy, con las mismas defensas de
// SSRF) o lo recibe directo si modo === 'html', corre los 9 validadores
// principales, y devuelve el mismo objeto 'resultados' que ya consume
// ResultadoPanel.jsx — sin cambiar su forma, para no romper esa pantalla.
export async function correrRevisionCompleta({ modo, url, html, onProgreso }) {
  let htmlAAnalizar = ''

  if (modo === 'html') {
    htmlAAnalizar = html
  } else {
    const response = await fetch(`${REVISION_CONFIG.PROXY_URL}?url=${encodeURIComponent(url)}`)
    if (!response.ok) throw new Error('No se pudo obtener el HTML')
    htmlAAnalizar = await response.text()
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlAAnalizar, 'text/html')
  onProgreso?.('Analizando estructura y links...')

  const imagenes = [...doc.querySelectorAll('img')]
  const srcList = [...new Set(imagenes.map(img => img.getAttribute('src')).filter(Boolean))]
  const cacheDatos = {}

  for (let idx = 0; idx < srcList.length; idx++) {
    onProgreso?.(`Verificando imagen ${idx + 1} de ${srcList.length}...`)
    const src = srcList[idx]
    try {
      const response = await fetch(`${REVISION_CONFIG.PROXY_URL}?modo=imagen&url=${encodeURIComponent(src)}`)
      if (response.ok) cacheDatos[src] = await response.json()
    } catch {}
  }

  const [dominioImagenes, clasesCSS, legal, links, altImagenes, dimensiones, pesoImagenes, estructuraHTML, resumenTemplates] = await Promise.all([
    Promise.resolve(ValidarDominioImagenes(doc)),
    Promise.resolve(ValidarClasesDefinidas(doc)),
    Promise.resolve(ValidarLegal(doc)),
    Promise.resolve(ValidarLinks(doc)),
    Promise.resolve(ValidarAltImagenes(doc)),
    ValidarDimensionesImagenes(doc, cacheDatos),
    ValidarPesoImagenes(doc, cacheDatos),
    Promise.resolve(ValidarEstructuraHTML(doc, htmlAAnalizar)),
    Promise.resolve(CompararConTemplates(doc, templates)),
  ])

  onProgreso?.('')

  return {
    htmlAnalizado: htmlAAnalizar,
    resultados: {
      pesoHTML: ValidarPesoHTML(htmlAAnalizar), pesoImagenes, estructuraHTML,
      dominioImagenes, clasesCSS, legal, links, altImagenes, dimensiones, resumenTemplates,
    },
  }
}

// Los 9 bloques principales que determinan el resumen (X de 9 pruebas) —
// 'resumenTemplates' no entra en este conteo porque no es un bloque
// pasa/no-pasa como los demás (es una lista de estructuras obsoletas
// detectadas, puede tener 0 o más elementos, no un único .ok booleano).
const BLOQUES_RESUMEN = [
  'estructuraHTML', 'clasesCSS', 'legal', 'links',
  'dominioImagenes', 'altImagenes', 'dimensiones', 'pesoImagenes', 'pesoHTML',
]

// Resume el objeto 'resultados' completo a los 3 valores livianos que
// se guardan en la base (ver migración 20260621000000): cuántos
// bloques pasaron, el total, y la severidad agregada (el estado más
// grave de cualquiera de los bloques).
export function resumirResultados(resultados) {
  const bloques = BLOQUES_RESUMEN.map(key => resultados[key]).filter(Boolean)
  const ok = bloques.filter(b => b.ok).length
  const total = bloques.length
  const hayError = bloques.some(b => !b.ok && !b.advertencia)
  const hayAdvertencia = bloques.some(b => !b.ok && b.advertencia)
  const severidad = hayError ? 'error' : hayAdvertencia ? 'advertencia' : 'ok'
  return { ok, total, severidad }
}
