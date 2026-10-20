// Colores de acento del Editor de Piezas.
//
// Rediseño de marca 2026: el rojo de acento (bullets, bordes, títulos y
// botones de texto, segmento CG del Módulo Doble) pasó de #c4161c a
// #c7000b, igual que la banda del header CG, y el negro del segmento EB
// de #000000 a #0d131a. Este módulo es la fuente única de esos valores
// y migra HTML con los colores anteriores: piezas viejas que se
// importan, borradores guardados en el navegador y piezas guardadas.
//
// Módulo puro (sin Vite, sin React).

export const ROJO_ACENTO = '#c7000b'
export const ROJO_ACENTO_ANTERIOR = '#c4161c'
export const NEGRO_EB = '#0d131a'
export const NEGRO_EB_ANTERIOR = '#000000'

// Reemplaza el rojo anterior (hex o rgb(196, 22, 28)) por el nuevo.
// Devuelve el HTML migrado y cuántos reemplazos hizo, para poder avisar.
export function migrarRojoAnterior(html) {
  let cantidad = 0
  const migrado = String(html ?? '')
    .replace(/#c4161c(?![0-9a-f])/gi, () => { cantidad++; return ROJO_ACENTO })
    .replace(/rgb\(\s*196\s*,\s*22\s*,\s*28\s*\)/gi, () => { cantidad++; return ROJO_ACENTO })
  return { html: migrado, cantidad }
}

// Solo para el Módulo Doble con imagen punteada: el bgcolor de sus celdas
// ES el color del segmento, así que el negro de EB pasa al nuevo. No se
// aplica a otros bloques, donde #000000 puede ser simplemente texto negro.
export function migrarColoresSegmentoModuloDoble(html) {
  return String(html ?? '').replace(/bgcolor="#000000"/gi, `bgcolor="${NEGRO_EB}"`)
}

// htmlEditado guardado de un bloque (borrador local o pieza guardada) →
// el mismo con los colores nuevos. Devuelve el mismo string si no cambia.
export function migrarHtmlEditadoGuardado(slug, htmlEditado) {
  if (typeof htmlEditado !== 'string') return htmlEditado
  let html = migrarRojoAnterior(htmlEditado).html
  if (slug === 'Modulo_Doble_Con_Imagen_Punteada') html = migrarColoresSegmentoModuloDoble(html)
  return html
}

// Aviso para el resumen de importación, o null si no hubo nada que migrar.
export function avisoMigracionRojo(cantidad) {
  if (!cantidad) return null
  return {
    texto: `Se actualizó el rojo del diseño anterior (${ROJO_ACENTO_ANTERIOR}) al nuevo (${ROJO_ACENTO}) en ${cantidad} ${cantidad === 1 ? 'lugar' : 'lugares'} de la pieza.`,
    tipo: 'general',
    canvasIdx: null,
  }
}
