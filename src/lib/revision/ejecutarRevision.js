import { REVISION_CONFIG } from '@/lib/revision/config'
import { templates } from '@/data/Templates/index'
import { CompararConTemplates } from '@/lib/revision/templates'
import { ValidarDominioImagenes, ValidarClasesDefinidas, ValidarLegal, ValidarLinks, ValidarAltImagenes, ValidarEstructuraHTML, ValidarPesoHTML } from '@/lib/revision/generales'
import { ValidarDimensionesImagenes, ValidarPesoImagenes } from '@/lib/revision/imagenes'

// El dominio/subdominio de icommarketing.com puede variar entre quien
// carga el link (icbc-info.icommarketing.com vs
// icbc-info-ai.icommarketing.com, por ejemplo) aunque apunten a la
// MISMA pieza real — lo que identifica de forma única a la pieza es el
// query string (todo después del '?'), que trae cliente/campaña/pieza
// codificados en Base64. Comparar el string completo de la URL daría
// "links distintos" para la misma pieza real si cambia el dominio
// visible, dejando pasar duplicados o disparando revisiones de más.
// Usada tanto para validar duplicados (EntregablesSection.jsx) como
// para detectar si una pieza cambió de link (mismo archivo y
// RevisionEmail.jsx, al actualizar el resultado guardado).
export function identificadorPieza(url) {
  if (!url) return ''
  try {
    return new URL(url).search
  } catch {
    // Si la URL no es válida (caso raro, pero posible con datos
    // viejos o pegados a mano), usar el string crudo como fallback —
    // sigue sirviendo para comparar duplicados, aunque sea menos
    // preciso que comparar por query string.
    return url.trim()
  }
}

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
  // Segundo argumento (porcentaje 0-100) opcional — RevisionEmail.jsx
  // solo usa el texto, EntregablesSection.jsx lo usa además para la
  // barra de progreso por pieza.
  onProgreso?.('Analizando estructura y links...', 5)

  const imagenes = [...doc.querySelectorAll('img')]
  const srcList = [...new Set(imagenes.map(img => img.getAttribute('src')).filter(Boolean))]
  const cacheDatos = {}

  for (let idx = 0; idx < srcList.length; idx++) {
    // El análisis de imágenes ocupa del 10% al 90% del progreso total —
    // se deja margen al principio (parseo/estructura) y al final
    // (validadores finales) para que la barra no salte de 0 a 100 de
    // golpe en piezas con pocas imágenes.
    const porcentaje = srcList.length > 0 ? 10 + Math.round(((idx + 1) / srcList.length) * 80) : 50
    onProgreso?.(`Verificando imagen ${idx + 1} de ${srcList.length}...`, porcentaje)
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

  onProgreso?.('', 100)

  return {
    htmlAnalizado: htmlAAnalizar,
    resultados: {
      pesoHTML: ValidarPesoHTML(htmlAAnalizar), pesoImagenes, estructuraHTML,
      dominioImagenes, clasesCSS, legal, links, altImagenes, dimensiones, resumenTemplates,
    },
  }
}

// Los 10 bloques que determinan el resumen (X de 10 pruebas).
// 'resumenTemplates' es distinto a los otros 9: devuelve un ARRAY de
// estructuras obsoletas detectadas (0 o más), no un objeto único con
// .ok — se normaliza acá mismo ({ ok: encontró 0 obsoletas }) para que
// pueda sumarse al mismo conteo sin necesitar un caso especial en
// resumirResultados. Es una prueba importante: detecta HTML viejo de
// versiones anteriores de piezas que ya no debería usarse.
const BLOQUES_RESUMEN = [
  'estructuraHTML', 'clasesCSS', 'legal', 'links',
  'dominioImagenes', 'altImagenes', 'dimensiones', 'pesoImagenes', 'pesoHTML',
]

// Resume el objeto 'resultados' completo a los 3 valores livianos que
// se guardan en la base (ver migración 20260621000000): cuántos
// bloques pasaron, el total, y la severidad agregada (el estado más
// grave de cualquiera de los bloques).
export function resumirResultados(resultados) {
  const bloqueTemplates = { ok: (resultados.resumenTemplates?.length ?? 0) === 0 }
  const bloques = [...BLOQUES_RESUMEN.map(key => resultados[key]).filter(Boolean), bloqueTemplates]
  const ok = bloques.filter(b => b.ok).length
  const total = bloques.length
  const hayError = bloques.some(b => !b.ok && !b.advertencia)
  const hayAdvertencia = bloques.some(b => !b.ok && b.advertencia)
  const severidad = hayError ? 'error' : hayAdvertencia ? 'advertencia' : 'ok'
  return { ok, total, severidad }
}
