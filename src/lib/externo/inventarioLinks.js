// Inventario de TODOS los links de la pieza (no solo los que tienen problemas).
//
// El chequeo "Links" (generales.js → ValidarLinks) solo lista lo que está
// mal. Esto muestra a dónde apunta cada link, bien o mal armado, para que
// quien revisa pueda verificar a ojo los destinos (algo que un chequeo
// automático no puede juzgar: un botón que apunta a otra landing, pero con
// una URL perfectamente válida).

import { nombreImagen } from './helpers.js'

const VARIABLE_SOLA = /^\s*(?:<|&lt;)\*[^*<>]{1,100}\*(?:>|&gt;)\s*$/i

export const TIPOS_LINK = {
  web: 'Web',
  email: 'Email',
  telefono: 'Teléfono',
  whatsapp: 'WhatsApp',
  ancla: 'Ancla',
  variable: 'Variable',
  vacio: 'Vacío',
  placeholder: 'Solo #',
  otro: 'Otro',
}

export function tipoDeLink(href) {
  const h = (href || '').trim()
  if (!h) return 'vacio'
  if (VARIABLE_SOLA.test(h)) return 'variable'
  if (h === '#') return 'placeholder'
  if (h.startsWith('#')) return 'ancla'
  if (/^mailto:/i.test(h)) return 'email'
  if (/^tel:/i.test(h)) return 'telefono'
  if (/wa\.me|api\.whatsapp\.com/i.test(h)) return 'whatsapp'
  if (/^https?:\/\//i.test(h)) return 'web'
  return 'otro'
}

export function inventariarLinks(doc) {
  return [...doc.querySelectorAll('a')].map(a => {
    const href = (a.getAttribute('href') || '').trim()
    const texto = a.textContent.replace(/\s+/g, ' ').trim()
    const img = a.querySelector('img')
    let etiqueta = texto
    let esImagen = false
    if (!etiqueta && img) {
      esImagen = true
      const alt = (img.getAttribute('alt') || '').replace(/\s+/g, ' ').trim()
      etiqueta = alt || nombreImagen(img.getAttribute('src') || '') || 'Imagen'
    }
    return {
      etiqueta: etiqueta || '(sin texto)',
      esImagen,
      destino: href,
      tipo: tipoDeLink(href),
      target: a.getAttribute('target') || '',
    }
  })
}
