// Arreglo del HTML que se descarga o se copia: los style partidos por comillas
// (ver DetectarAtributosConDosPuntos) se reemplazan por la reconstrucción
// sugerida, SOLO cuando la reconstrucción es confiable. El resto de la pieza
// no se toca: se reemplaza el texto exacto de cada etiqueta rota, sin
// re-serializar nada (así las variables <*Nombre*> quedan como están).
// También saca lo que inyectan las extensiones del navegador y repone los comentarios {cke_protected} del editor (CSS y bloques de
// Outlook que quedaron como comentarios inertes).

import { reconstruirStyleRoto } from './reconstruirAtributos.js'
import { conTipografiasCargadas } from './generales.js'
import { decodificarProtegidos } from './protegidos.js'
import { quitarElementosDeExtensiones } from './extensiones.js'

// familias: tipografías que la pieza carga arriba (tipografiasCargadas), para
// devolverle las mayúsculas al nombre ("barlow" -> "Barlow").
export function arreglarPieza(html, familias = []) {
  // Primero lo que inyectan las extensiones del navegador (ver extensiones.js).
  const sinExtensiones = quitarElementosDeExtensiones(html)
  const texto = sinExtensiones.html
  const reemplazos = new Map()
  for (const m of texto.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const tag = m[0]
    if (reemplazos.has(tag)) continue
    const r = reconstruirStyleRoto(tag)
    if (!r?.confiable || !r.tagReconstruido) continue
    const style = conTipografiasCargadas(r.styleFinal, familias)
    reemplazos.set(tag, r.tagReconstruido.replace(`style="${r.styleFinal}"`, `style="${style}"`))
  }
  let salida = texto
  let cambios = 0
  for (const [original, nuevo] of reemplazos) {
    salida = salida.split(original).join(nuevo)
    cambios += 1 // se cuentan etiquetas distintas, igual que el informe
  }
  // Al final, para que los style partidos se arreglen sobre el HTML tal cual
  // llegó (los chequeos cuentan sobre eso) y recién después se repongan los
  // comentarios protegidos del editor (ver protegidos.js).
  const repuestos = decodificarProtegidos(salida)
  return {
    html: repuestos.html,
    cambios,
    protegidos: repuestos.cantidad,
    extensiones: sinExtensiones.cantidad,
    bytesExtensiones: sinExtensiones.bytes,
  }
}
