// Detección y reordenamiento de las redes sociales de una banda de
// header (celdas <td class="IconoRedes">), como string puro.

import { REDES_SOCIALES } from './constantes.js'

// Qué redes están REALMENTE presentes en el HTML de este header en
// particular (algunos headers, como Comex, ya vienen sin ninguna) —
// no tiene sentido mostrar un pill para una red que el header ni
// trae, así que el panel solo lista las que detectarRedesSociales
// encuentra de verdad.
//
// conEstado=true devuelve { key, activa } por celda en vez de solo la
// key — usado al reimportar (ver importarDesdeHtml/importarHeuristico)
// para reconstruir el estado real de actividad, no solo cuáles redes
// existen. Sin esto (bug real encontrado en revisión a fondo previa al
// primer push), una red desactivada por el usuario quedaba con su <td>
// vacío sin ningún rastro de cuál era — al reimportar esa pieza, esa
// red desaparecía del panel por completo en vez de aparecer como
// "presente pero apagada". Ahora cada celda puede llevar data-red="key"
// (ver reordenarRedesSociales) que identifica la red aunque esté
// vacía — se prioriza esa marca sobre la detección por dominio, que
// sigue funcionando igual que antes para el HTML CRUDO de un template
// (nunca tiene data-red, siempre tiene el dominio real porque ahí
// todas las redes están activas por definición).
export function detectarRedesSociales(html, conEstado = false) {
  if (!html) return []
  const tdRegex = /<td class="IconoRedes"([^>]*)>([\s\S]*?)<\/td>/gi
  const presentes = []
  let m
  while ((m = tdRegex.exec(html)) !== null) {
    const keyMarcada = m[1].match(/data-red="(\w+)"/)?.[1] ?? null
    const social = keyMarcada ? REDES_SOCIALES.find(s => s.key === keyMarcada) : REDES_SOCIALES.find(s => m[2].includes(s.dominio))
    if (!social) continue
    if (conEstado) {
      const activa = keyMarcada ? /<a\b|<img\b/i.test(m[2]) : true
      presentes.push({ key: social.key, activa })
    } else {
      presentes.push(social.key)
    }
  }
  return presentes
}


// Reconstruye el bloque de <td class="IconoRedes"> según el orden y
// actividad elegidos por el usuario: las ACTIVAS primero (en el orden
// que el usuario armó arrastrando los pills), las inactivas después
// pero vacías — así nunca cambia la CANTIDAD de celdas (no se rompe
// el ancho reservado para el grupo de redes en la tabla), pero las
// visibles quedan agrupadas sin huecos en el medio si, por ejemplo,
// solo se activan Twitter y LinkedIn.
// ordenActivo: array de { key, activa }, en el orden elegido por el
// usuario (drag and drop en el panel de edición del header).
//
// Bug real encontrado en revisión a fondo previa al primer push: una
// red INACTIVA queda con su <td> vacío (inner = ''), y
// detectarRedesSociales identifica cada red por el DOMINIO dentro del
// inner — una celda vacía no tiene dominio, así que al reimportar esa
// pieza (ej. el usuario la revisa y la vuelve a abrir) esa red
// desaparece SIN DEJAR RASTRO de que estaba ahí, solo desactivada. El
// efecto en el panel: como redesOrden reimportado ya no es null (sigue
// teniendo las activas), el useEffect que inicializa "todas presentes,
// activas" nunca se vuelve a disparar — el usuario pierde el pill de
// esa red por completo, no puede reactivarla sin reconstruir el header
// desde cero. Fix: cada <td>, activo o no, lleva un atributo
// data-red="key" propio — la identidad de la celda ya no depende de
// que su contenido visual esté presente.
export function reordenarRedesSociales(html, ordenActivo) {
  if (!html || !ordenActivo) return html
  const tdRegex = /<td class="IconoRedes"([^>]*)>([\s\S]*?)<\/td>/gi
  const celdas = []
  let m
  while ((m = tdRegex.exec(html)) !== null) {
    // data-red tiene prioridad sobre la detección por dominio — si la
    // celda ya viene marcada (pieza reimportada de un export previo de
    // este editor), no hace falta que tenga contenido visual para
    // identificarla.
    const keyMarcada = m[1].match(/data-red="(\w+)"/)?.[1] ?? null
    const social = keyMarcada ? REDES_SOCIALES.find(s => s.key === keyMarcada) : REDES_SOCIALES.find(s => m[2].includes(s.dominio))
    celdas.push({ attrs: m[1], inner: m[2], key: social?.key ?? null })
  }
  // Si ninguna celda tiene una red real detectada (ej. Comex, que ya
  // viene con las 4 celdas vacías), no hay nada que reordenar.
  if (!celdas.some(c => c.key)) return html

  // IMPORTANTE: el padding-left de cada celda es una propiedad de la
  // POSICIÓN en la fila, no de la red en sí — la primera celda nunca
  // tiene padding (no hay nada antes), las que siguen sí (separación
  // del ícono anterior). Confirmado contra el HTML real: solo el
  // primer <td class="IconoRedes"> no tiene style="padding-left:
  // 10px", los otros 3 sí. Por eso se reconstruye usando el attrs de
  // la POSICIÓN de destino (celdas[i].attrs, por índice), nunca el
  // attrs original de la red que se mueve ahí — si no, mover una red
  // con padding a la primera posición dejaría un hueco antes del
  // ícono donde no debería haber ninguno, o viceversa. data-red de la
  // celda original tampoco viaja con la posición — se vuelve a escribir
  // explícito con la key de destino, después de limpiar cualquier
  // data-red previo de esos attrs (si la pieza ya traía uno de un
  // export anterior, no duplicarlo).
  const innerPorKey = {}
  celdas.forEach(c => { if (c.key) innerPorKey[c.key] = c.inner })
  const activasKeys = ordenActivo.filter(r => r.activa).map(r => r.key)
  const inactivasKeys = ordenActivo.filter(r => !r.activa).map(r => r.key)
  const ordenFinal = [...activasKeys, ...inactivasKeys]

  const nuevasCeldas = ordenFinal.map((key, posicion) => {
    const celdaPosicion = celdas[posicion]
    if (!celdaPosicion) return null
    const activa = activasKeys.includes(key)
    const inner = activa ? (innerPorKey[key] ?? '') : ''
    const attrsSinDataRed = celdaPosicion.attrs.replace(/\s*data-red="\w+"/, '')
    return `<td class="IconoRedes"${attrsSinDataRed} data-red="${key}">${inner}</td>`
  }).filter(Boolean)

  let idx = 0
  return html.replace(tdRegex, () => nuevasCeldas[idx++] ?? '')
}
