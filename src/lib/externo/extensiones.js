// Elementos que inyectan las extensiones del navegador dentro del HTML cuando
// alguien edita la pieza en el editor de la plataforma con la extensión activa
// (el editor guarda el DOM tal cual): LanguageTool agrega <lt-highlighter>,
// <lt-div>..., Grammarly agrega <grammarly-extension>... Van con display:none,
// no se ven ni hacen nada en el mail, pero suman peso y son etiquetas que no
// existen en HTML. Se detectan y se sacan al descargar o copiar.
//
// Trabajo sobre strings (nada de DOM), igual que el resto de la herramienta.

const APERTURA = /<((?:lt|grammarly)-[a-z0-9-]*)\b[^>]*>/gi

const EXTENSION_POR_PREFIJO = { lt: 'LanguageTool', grammarly: 'Grammarly' }

// Rangos [inicio, fin) de los elementos de extensión de más afuera.
function encontrarRangos(texto) {
  const rangos = []
  let hasta = 0
  APERTURA.lastIndex = 0
  let m
  while ((m = APERTURA.exec(texto)) !== null) {
    if (m.index < hasta) continue // adentro de uno que ya se va a sacar
    const nombre = m[1]
    const patron = new RegExp(`<${nombre}\\b[^>]*>|</${nombre}\\s*>`, 'gi')
    patron.lastIndex = m.index + m[0].length
    let profundidad = 1
    let fin = -1
    let t
    while ((t = patron.exec(texto)) !== null) {
      if (t[0].startsWith('</')) profundidad--
      else if (!t[0].endsWith('/>')) profundidad++
      if (profundidad === 0) { fin = t.index + t[0].length; break }
    }
    if (fin === -1) continue // sin cierre: no se toca
    rangos.push({ inicio: m.index, fin, nombre: nombre.toLowerCase() })
    hasta = fin
    APERTURA.lastIndex = fin
  }
  return rangos
}

// { html, cantidad, bytes } con los elementos de extensión sacados.
export function quitarElementosDeExtensiones(html) {
  const texto = String(html ?? '')
  const rangos = encontrarRangos(texto)
  if (rangos.length === 0) return { html: texto, cantidad: 0, bytes: 0 }
  let salida = ''
  let desde = 0
  let bytes = 0
  for (const r of rangos) {
    salida += texto.slice(desde, r.inicio)
    bytes += new TextEncoder().encode(texto.slice(r.inicio, r.fin)).length
    desde = r.fin
  }
  salida += texto.slice(desde)
  return { html: salida, cantidad: rangos.length, bytes }
}

// Resumen para el informe: { cantidad, bytes, extensiones: ['LanguageTool'] }.
export function resumirExtensiones(html) {
  const texto = String(html ?? '')
  const rangos = encontrarRangos(texto)
  const extensiones = [...new Set(rangos.map(r => EXTENSION_POR_PREFIJO[r.nombre.split('-')[0]]))]
  const bytes = rangos.reduce((suma, r) => suma + new TextEncoder().encode(texto.slice(r.inicio, r.fin)).length, 0)
  return { cantidad: rangos.length, bytes, extensiones }
}
