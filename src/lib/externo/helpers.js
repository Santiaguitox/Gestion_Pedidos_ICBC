// Auxiliares del motor de análisis externo. Basado en
// src/lib/revision/helpers.js (TeamWorkHub), copia independiente del 2026-10-14.

export function extraerImagenes(doc) {
  const imgs = doc.querySelectorAll('img')
  return [...imgs].map(img => img.getAttribute('src')).filter(Boolean)
}

// Nombre legible de una imagen a partir de su src.
// EXTERNO: el original hacía src.split('/').pop(), que en piezas con
// cache-busting dejaba "NEWS12CSI_01.png?time=1791923448720" en el informe,
// y con imágenes embebidas (data:) mostraba un pedazo de base64.
export function nombreImagen(src) {
  if (!src) return ''
  if (/^data:/i.test(src)) return 'imagen embebida (data:)'
  const sinQuery = src.split('#')[0].split('?')[0]
  return sinQuery.split('/').pop()
}
