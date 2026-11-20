import { esImagenEstructural } from '@/lib/imagenesEstructurales'
import { REVISION_CONFIG } from '@/lib/revision/config'

// Validador "el alt corresponde a lo que muestra la imagen" — SOLO de la
// revisión interna (el análisis externo de /analisis no lo usa, y no debe:
// ver src/lib/externo/__tests__/aislamiento.test.js).
//
// Este módulo es PURO: no conoce Supabase ni hace red. Recibe la función
// `verificar(items)` que llama a la Edge Function verificar-alt-imagenes
// (ver altIAClient.js), así se puede testear con un reemplazo.
//
// Qué evalúa la IA (ver la Edge Function): si la imagen tiene texto, el alt
// debe reproducirlo literal; si no (foto, captura, ilustración), el alt debe
// ser una descripción coherente.
//
// Severidad:
//   no coincide  → ERROR (la prueba falla)
//   dudoso       → "Detalle menor" en amarillo (la prueba sigue ok)
//   no verificable → un único aviso resumen; nunca error. Si NINGUNA imagen
//     se pudo verificar (sin crédito, tope diario, IA caída) el bloque
//     vuelve marcado `omitido`: se muestra el motivo pero NO cuenta en el
//     puntaje, para que una caída de la IA no mueva el resultado de la pieza.
//
// El resultado NO es una prueba aparte: se anida dentro de "Alt de imágenes"
// (ver combinarAltConIA), que sigue siendo UNA sola prueba del resumen.

export const MAX_IMAGENES_IA = 25
export const MAX_LARGO_ALT_IA = 500

const TIPO = 'Alt coincide con la imagen'

const MOTIVOS_NO_VERIFICABLE = {
  dominio: 'imagen fuera del dominio aprobado',
  tope_diario: 'se alcanzó el tope diario de verificaciones con IA',
  ia_no_disponible: 'la IA no respondió',
  sin_configurar: 'la verificación con IA no está configurada o su clave no es válida',
  sin_credito: 'la cuenta de IA no tiene crédito',
  imagen_no_legible: 'la IA no pudo leer la imagen',
  respuesta_invalida: 'la IA devolvió una respuesta que no se pudo interpretar',
  cupo: `solo se verifican las primeras ${MAX_IMAGENES_IA} imágenes de la pieza`,
  largo: `alt demasiado largo para verificar (más de ${MAX_LARGO_ALT_IA} caracteres)`,
}

function nombreDe(src) {
  return src.split('?')[0].split('/').pop() || src
}

function corto(texto, max = 80) {
  return texto.length > max ? `${texto.slice(0, max)}…` : texto
}

// Junta las imágenes que hay que verificar: con src del CDN aprobado y alt
// con contenido (alt ausente o vacío ya lo marca ValidarAltImagenes), sin
// separadores estructurales, sin repetir pares (src, alt).
export function recolectarImagenesParaIA(doc) {
  const items = []
  const sinVerificar = []
  const vistos = new Set()

  for (const img of [...doc.querySelectorAll('img')]) {
    const src = (img.getAttribute('src') || '').trim()
    const alt = (img.getAttribute('alt') || '').trim()
    if (!src || !alt) continue
    if (!src.startsWith(REVISION_CONFIG.DOMINIO_IMAGENES_APROBADO)) continue
    if (esImagenEstructural(src)) continue

    const clave = `${src}\u0000${alt}`
    if (vistos.has(clave)) continue
    vistos.add(clave)

    if (alt.length > MAX_LARGO_ALT_IA) {
      sinVerificar.push({ src, razon: 'largo' })
      continue
    }
    if (items.length >= MAX_IMAGENES_IA) {
      sinVerificar.push({ src, razon: 'cupo' })
      continue
    }
    items.push({ src, alt })
  }

  return { items, sinVerificar }
}

function bloqueOmitido(razon) {
  return {
    ok: false,
    advertencia: true,
    omitido: true,
    tipo: TIPO,
    detalle: `No se pudo verificar: ${MOTIVOS_NO_VERIFICABLE[razon] ?? MOTIVOS_NO_VERIFICABLE.ia_no_disponible}`,
    checks: [],
    advertencias: [],
  }
}

function resumenNoVerificables(lista) {
  const porRazon = {}
  for (const { razon } of lista) porRazon[razon] = (porRazon[razon] ?? 0) + 1
  return Object.entries(porRazon)
    .map(([razon, n]) => `${n} sin verificar: ${MOTIVOS_NO_VERIFICABLE[razon] ?? MOTIVOS_NO_VERIFICABLE.ia_no_disponible}`)
    .join(' · ')
}

// Devuelve el bloque de resultado, o null si no hay nada que verificar.
// Nunca lanza: cualquier falla de la IA se traduce en un bloque omitido.
export async function ValidarAltCoincideImagen(doc, verificar) {
  const { items, sinVerificar } = recolectarImagenesParaIA(doc)
  if (items.length === 0) return null

  let respuesta
  try {
    respuesta = await verificar(items)
  } catch {
    return bloqueOmitido('ia_no_disponible')
  }
  if (!Array.isArray(respuesta)) return bloqueOmitido('ia_no_disponible')

  const errores = []
  const dudosos = []
  const noVerificables = [...sinVerificar]
  let coinciden = 0

  for (const r of respuesta) {
    if (!r || typeof r.src !== 'string') continue
    const nombre = nombreDe(r.src)
    const alt = typeof r.alt === 'string' ? corto(r.alt) : ''
    const motivo = typeof r.motivo === 'string' && r.motivo ? ` — ${r.motivo}` : ''

    if (r.estado === 'coincide') {
      coinciden++
    } else if (r.estado === 'no_coincide') {
      errores.push({ ok: false, detalle: `${nombre}: el alt "${alt}" no coincide con la imagen${motivo}`, ref: { tipo: 'img', src: r.src } })
    } else if (r.estado === 'dudoso') {
      dudosos.push({ detalle: `${nombre}: no se pudo confirmar que el alt "${alt}" coincida con la imagen${motivo}`, ref: { tipo: 'img', src: r.src } })
    } else {
      noVerificables.push({ src: r.src, razon: r.razon ?? 'ia_no_disponible' })
    }
  }

  // Ninguna imagen llegó a verificarse: la prueba no se puede dar por
  // buena ni por mala.
  if (errores.length + dudosos.length + coinciden === 0) {
    return bloqueOmitido(noVerificables[0]?.razon ?? 'ia_no_disponible')
  }

  const advertencias = [...dudosos]
  if (noVerificables.length > 0) advertencias.push({ detalle: resumenNoVerificables(noVerificables) })

  if (errores.length > 0) {
    return {
      ok: false,
      tipo: TIPO,
      detalle: `${errores.length} imagen${errores.length > 1 ? 'es' : ''} con un alt que no coincide con lo que muestra`,
      checks: errores,
      advertencias,
    }
  }

  return {
    ok: true,
    tipo: TIPO,
    detalle: `Los alts verificados (${coinciden}) coinciden con sus imágenes`,
    checks: [],
    advertencias,
  }
}

// Anida el resultado de la IA dentro del bloque "Alt de imágenes", que sigue
// siendo UNA prueba (el total del resumen no cambia). La prueba falla si
// falla cualquiera de las dos partes. Si la IA no estuvo disponible
// (`ia.omitido`) o no había nada que verificar (`ia` null), el resultado
// de la prueba es el de siempre; el aviso se muestra adentro, sin moverlo.
export function combinarAltConIA(alt, ia) {
  if (!alt || !ia) return alt
  const cuenta = !ia.omitido
  const ok = alt.ok && (!cuenta || ia.ok)
  let detalle = alt.detalle
  if (cuenta) detalle = alt.ok && !ia.ok ? ia.detalle : `${alt.detalle} · ${ia.detalle}`
  return { ...alt, ok, detalle, ia }
}
