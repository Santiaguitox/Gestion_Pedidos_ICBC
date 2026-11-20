import { extraerTextosPieza, prepararParaIA } from '@/lib/revision/textoPieza'
import { buscarTerminosObsoletos } from '@/lib/revision/terminosObsoletos'
import { TERMINOS_PERMITIDOS } from '@/lib/revision/terminosPermitidos'

// Tarjeta "Ortografía y redacción" de la revisión INTERNA (el análisis
// externo de /analisis no la usa: ver src/lib/externo/__tests__/aislamiento.test.js).
//
// Reúne dos controles independientes:
//   1. Términos desactualizados (ICBC Access Banking, etc.): búsqueda de
//      texto, sin IA. Siempre corre.
//   2. Errores objetivos de escritura (ortografía, tildes, conjugación,
//      concordancia, palabras repetidas, signos ¿¡) con IA barata, sobre el
//      texto visible, los alt y los title. Si la IA no está disponible el
//      punto 1 sigue funcionando y la tarjeta lo avisa.
//
// Severidad: SIEMPRE advertencia (amarillo), nunca error. Esta tarjeta no
// entra en el "X de 10 pruebas" ni en lo que se guarda en la pieza; ver
// ejecutarRevision.js para cómo promoverla a prueba cuando se quiera.
//
// Módulo puro: no conoce Supabase. Recibe `revisar({ textos, glosario })`
// (ver ortografiaClient.js), así se puede testear con un reemplazo.

const TIPO = 'Ortografía y redacción'

const MOTIVOS_NO_REVISADO = {
  tope_diario: 'se alcanzó el tope diario de revisiones con IA',
  ia_no_disponible: 'la IA no respondió',
  sin_configurar: 'la revisión con IA no está configurada o su clave no es válida',
  sin_credito: 'la cuenta de IA no tiene crédito',
  respuesta_invalida: 'la IA devolvió una respuesta que no se pudo interpretar',
}

const ETIQUETA_LUGAR = { texto: 'En el texto', alt: 'En un alt', title: 'En un title' }
const ETIQUETA_TIPO = {
  ortografia: 'ortografía',
  tilde: 'tilde',
  conjugacion: 'conjugación',
  concordancia: 'concordancia',
  repeticion: 'palabra repetida',
  puntuacion: 'puntuación',
}

function describirHallazgo(h) {
  const lugar = ETIQUETA_LUGAR[h.lugar] ?? ETIQUETA_LUGAR.texto
  const motivo = h.motivo || ETIQUETA_TIPO[h.tipo] || ''
  const sugerencia = h.sugerencia ? ` → "${h.sugerencia}"` : ''
  return `${lugar}: "${h.fragmento}"${sugerencia}${motivo ? ` (${motivo})` : ''}`
}

function plural(n, singular, pluralTexto) {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

// Devuelve el bloque de la tarjeta, o null si la pieza no tiene texto.
// Nunca lanza: una falla de la IA se traduce en aviso dentro del bloque.
// Motivos con los que la IA admite que no hay error (se descartan igual que en el servidor).
const MOTIVO_DESCARTE = /sin (hallazgos|errores)|est[aá] (bien|correcto)|correcto\b|no corresponde|no (es|hay|hubo) (un )?(error|falta)|no se (debe|debería|debe[ií]a) (reportar|marcar)|no se reporta|(revisi[oó]n|correcci[oó]n|cambio) innecesari[ao]|no aplica/i
const SUGERENCIA_DESCARTE = /^\s*(sin (error|cambios?)|no requiere|no hay (error|cambios?))/i

export async function ValidarOrtografiaYRedaccion(doc, revisar) {
  const items = extraerTextosPieza(doc)
  if (items.length === 0) return null

  const obsoletos = buscarTerminosObsoletos(items)
  const { textos, truncado } = prepararParaIA(items)

  let hallazgos = []
  let motivoNoRevisado = null

  try {
    const r = await revisar({ textos, glosario: TERMINOS_PERMITIDOS })
    if (!r || typeof r !== 'object') {
      motivoNoRevisado = 'ia_no_disponible'
    } else if (r.estado === 'ok' && Array.isArray(r.hallazgos)) {
      hallazgos = r.hallazgos
        // Un hallazgo real siempre trae la corrección (la función ya lo
        // exige; esto cubre resultados viejos de la caché).
        .filter(h => h && typeof h.fragmento === 'string' && h.fragmento && h.sugerencia && !h.nota && !SUGERENCIA_DESCARTE.test(h.sugerencia) && !MOTIVO_DESCARTE.test(h.motivo || ''))
        .map(h => ({
          detalle: describirHallazgo(h),
          ref: h.lugar === 'alt' || h.lugar === 'title'
            ? { tipo: 'atributo', atributo: h.lugar, fragmento: h.fragmento }
            : { tipo: 'texto', fragmento: h.fragmento },
        }))
    } else {
      motivoNoRevisado = r.razon ?? 'ia_no_disponible'
    }
  } catch {
    motivoNoRevisado = 'ia_no_disponible'
  }

  const avisoIA = motivoNoRevisado
    ? `No se pudo revisar la ortografía: ${MOTIVOS_NO_REVISADO[motivoNoRevisado] ?? MOTIVOS_NO_REVISADO.ia_no_disponible}`
    : null
  const avisoTruncado = !motivoNoRevisado && truncado
    ? 'La pieza tiene mucho texto: se revisó solo una parte'
    : null

  const ok = hallazgos.length === 0 && obsoletos.length === 0 && !avisoIA && !avisoTruncado

  // El detalle de la tarjeta cuenta lo encontrado y, si corresponde, dice
  // que la IA no pudo revisar. El aviso de "revisión parcial" va en la lista
  // si hay otros hallazgos, y en el detalle si es lo único.
  const partes = []
  if (hallazgos.length > 0) partes.push(plural(hallazgos.length, 'posible error de ortografía o redacción', 'posibles errores de ortografía o redacción'))
  if (obsoletos.length > 0) partes.push(plural(obsoletos.length, 'término desactualizado', 'términos desactualizados'))
  const hayHallazgos = partes.length > 0
  if (avisoIA) partes.push(avisoIA)
  if (avisoTruncado && !hayHallazgos) partes.push(avisoTruncado)
  if (partes.length === 0) partes.push('No se detectaron errores de ortografía ni términos desactualizados')

  return {
    ok,
    advertencia: !ok,
    tipo: TIPO,
    detalle: partes.join(' · '),
    hallazgos,
    obsoletos,
    avisos: avisoTruncado && hayHallazgos ? [{ detalle: avisoTruncado }] : [],
  }
}
