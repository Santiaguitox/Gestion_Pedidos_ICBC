// Columnas de tipo imagen: la persona solo pone la URL; el <img> completo
// (con ancho, estilos seguros para Outlook y alt) lo arma la herramienta.

import { escaparHtml } from './html.js'

/** La URL tiene que ser http(s) y no traer comillas, espacios ni < >, que romperían el atributo. */
export function validarUrlImagen(valor) {
  const url = String(valor ?? '').trim()
  if (!url) return { ok: false, url: '', error: 'Falta la URL de la imagen.' }
  if (!/^https?:\/\//i.test(url)) return { ok: false, url, error: 'La URL tiene que empezar con http:// o https://.' }
  if (/[\s'"<>]/.test(url)) return { ok: false, url, error: 'La URL no puede tener espacios ni comillas.' }
  return { ok: true, url, error: '' }
}

function margenes(alineacion) {
  if (alineacion === 'left') return 'margin-right:auto;'
  if (alineacion === 'right') return 'margin-left:auto;'
  return 'margin-left:auto; margin-right:auto;'
}

/** Imagen de relleno para la vista previa cuando todavía no hay una URL válida (no sale en el HTML exportado). */
export function imagenDeRelleno(ancho) {
  const w = Math.max(1, Math.round(Number(ancho) || 90))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 ${w} ${w}"><rect width="${w}" height="${w}" fill="#e6e8f2"/><path d="M${w * 0.28} ${w * 0.68}l${w * 0.16}-${w * 0.2} ${w * 0.12} ${w * 0.14} ${w * 0.08}-${w * 0.09} ${w * 0.1} ${w * 0.15}z" fill="#9ea3be"/><circle cx="${w * 0.36}" cy="${w * 0.36}" r="${w * 0.06}" fill="#9ea3be"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * Arma el <img>. Lleva width como atributo (Outlook ignora el style) y max-width en el style, y devuelve ''
 * si la URL no es válida, salvo en la vista previa, donde pone una imagen de relleno.
 */
export function construirImg({ url, ancho = 90, alt = '', alineacion = 'center', vista = false }) {
  const w = Math.max(1, Math.round(Number(ancho) || 90))
  const v = validarUrlImagen(url)
  if (!v.ok && !vista) return ''
  const src = v.ok ? v.url : imagenDeRelleno(w)
  const altSeguro = escaparHtml(alt).replace(/'/g, '&#39;')
  return `<img src='${src}' style='width: ${w}px; max-width: ${w}px; display: block; border: solid 0px; ${margenes(alineacion)}' width='${w}' border='0' alt='${altSeguro}' />`
}

/** Si la celda ya trae un <img> (base cargada), devuelve su URL; si es una URL suelta, la devuelve tal cual. */
export function extraerUrlImagen(valor) {
  const t = String(valor ?? '').trim()
  const m = /<img\b[^>]*?\bsrc\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+))/i.exec(t)
  if (m) return (m[1] ?? m[2] ?? m[3] ?? '').trim()
  return /^https?:\/\//i.test(t) ? t : ''
}

/** Texto alternativo de una columna de imagen: el que se escribió o, si no hay, el nombre de la columna. */
export function altDeColumna(columna) {
  const propio = String(columna.imagen?.alt ?? '').trim()
  if (propio) return propio
  return columna.sinTitulo ? '' : String(columna.titulo ?? '').trim()
}
