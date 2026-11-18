// Utilidades de HTML para armar y mostrar el bloque.

export function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Limpia el HTML de una celda para mostrarlo en la vista previa (por ejemplo un
 * <img> que viene en la base): saca etiquetas peligrosas, atributos on* y
 * URLs javascript:. Solo se usa para mostrar; nunca para lo que se exporta.
 */
export function limpiarHtmlCelda(valor) {
  let t = String(valor ?? '')
  t = t.replace(/<\s*(script|style|iframe|object|embed|link|meta|form|base)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
  t = t.replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|form|base)\b[^>]*>/gi, '')
  t = t.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  t = t.replace(/\s(src|href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '')
  t = t.replace(/\s(src|href)\s*=\s*javascript:[^\s>]*/gi, '')
  return t
}
