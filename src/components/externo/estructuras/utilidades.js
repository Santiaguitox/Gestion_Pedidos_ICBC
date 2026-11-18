// Copiar y descargar texto desde el navegador.

import { contenidoDeArchivo } from '../../../lib/externo/estructuras/archivo.js'

/** Copia al portapapeles. Primero la API moderna; si el navegador la bloquea, prueba con un textarea. Devuelve true si pudo. */
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = texto
      area.setAttribute('readonly', '')
      area.className = 'ex-portapapeles-oculto'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** Descarga un texto como archivo (ver contenidoDeArchivo para las opciones de saltos de línea y BOM). */
export function descargarTexto(nombre, texto, tipo = 'text/plain', opciones = {}) {
  const blob = new Blob([contenidoDeArchivo(texto, opciones)], { type: `${tipo};charset=utf-8` })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
