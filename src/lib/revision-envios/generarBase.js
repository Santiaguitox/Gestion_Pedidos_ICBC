// Lógica pura para "Generar base de test" — separada de React para
// poder probarla aislada, mismo criterio que comparar.js. No depende
// de extractFields acá: eso vive en comparar.js y el componente lo
// importa de ahí directamente, no se duplica.

// Detección heurística del "tipo" de un campo a partir de su nombre —
// no hay forma de saberlo con certeza sin mirar el HTML alrededor del
// tag, pero el nombre de la variable casi siempre lo delata (LinkBoton,
// URL_CTA, ImagenHeader, IconoSucursal, etc.). Sirve para dos cosas:
// avisar en el formulario qué tipo de dato espera ese campo, y arrancar
// con un valor de prueba que efectivamente FUNCIONE ahí (una URL real
// en vez de "Campo Test", que en un href o un src de <img> rompe la
// pieza en el envío de test en vez de ayudar a probarla).
// Se compara sin acentos para no depender de cómo se haya tipeado el
// nombre del campo.
const PALABRAS_LINK = ['link', 'url', 'href']
const PALABRAS_IMAGEN = ['imagen', 'img', 'foto', 'icono', 'banner', 'logo', 'picture']

function sinAcentos(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function tipoCampo(campo) {
  const norm = sinAcentos(campo.toLowerCase())
  if (PALABRAS_IMAGEN.some(p => norm.includes(p))) return 'imagen'
  if (PALABRAS_LINK.some(p => norm.includes(p))) return 'link'
  return 'texto'
}

// Valores de ejemplo reales — no inventados al azar, para que la
// pieza se vea (y funcione) bien apenas se genera la base, sin que
// haga falta tocar nada a mano en los campos de link/imagen.
export const URL_LINK_DEFAULT = 'https://www.icbc.com.ar/personas'
export const URL_IMAGEN_DEFAULT = 'https://d343t93odde9ul.cloudfront.net/minisites/ICBC/iconos100/ico-info-100px-r.png'

// Valor por defecto para un campo detectado. Para link/imagen usa el
// ejemplo real de arriba; para el resto sigue siendo "{Campo} Test"
// — legible a simple vista dentro del mail como para distinguir un
// placeholder de prueba de un dato real que se coló.
export function valorPorDefecto(campo) {
  const tipo = tipoCampo(campo)
  if (tipo === 'link') return URL_LINK_DEFAULT
  if (tipo === 'imagen') return URL_IMAGEN_DEFAULT
  return `${campo} Test`
}

export function valoresPorDefecto(campos) {
  const obj = {}
  campos.forEach(c => { obj[c] = valorPorDefecto(c) })
  return obj
}

// Escapa un valor para una celda CSV (RFC 4180): si contiene el
// separador, comillas dobles o un salto de línea, hay que envolverlo
// en comillas dobles y duplicar cualquier comilla interna. Sin esto,
// un valor de prueba como "Av. Corrientes; CABA" (con el separador
// adentro) corre las columnas de todas las filas siguientes sin
// ningún aviso — exactamente lo que esta base de test existe para
// evitar. Aplica tanto a los nombres de columna como a los valores,
// ya que un campo detectado en el HTML también podría traer el
// separador en su nombre.
export function escaparValorCsv(valor, sep) {
  const str = String(valor ?? '')
  const necesitaComillas = str.includes(sep) || str.includes('"') || str.includes('\n') || str.includes('\r')
  if (!necesitaComillas) return str
  return `"${str.replace(/"/g, '""')}"`
}

// Arma el CSV final: Email + un campo por columna, una fila por cada
// email de test cargado. Los valores de los campos son los mismos en
// todas las filas a propósito — la variación entre filas es solo el
// email de destino, para probar el mismo contenido en más de una
// casilla sin tener que repetir la carga de datos por fila.
// Mismo separador (;) que el resto de la herramienta usa como
// convención para bases de contacto.
export function generarCsvBaseTest(campos, valores, emails, sep = ';') {
  const emailsLimpios = emails.map(e => e.trim()).filter(Boolean)
  const header = ['Email', ...campos].map(c => escaparValorCsv(c, sep)).join(sep)
  const filas = emailsLimpios.map(email =>
    [email, ...campos.map(c => valores[c] ?? '')].map(v => escaparValorCsv(v, sep)).join(sep)
  )
  return [header, ...filas].join('\n')
}

// Chequeo mínimo de forma para el email de test — no busca ser una
// validación RFC completa (no hace falta, es solo una base de prueba
// para un envío de test), alcanza con descartar valores claramente
// mal tipeados antes de generar el archivo.
export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// Reemplaza los <*Campo*> del HTML por los valores de prueba actuales
// — usada para la vista previa en vivo. Mismo criterio de "desescapar"
// entidades que extractFields (así reemplaza exactamente los mismos
// campos que se detectaron, incluso si el fuente los trae como &lt;* /
// *&gt;). Un campo sin valor cargado en `valores` se deja tal cual
// (no debería pasar en uso normal, ya que valoresCampos se completa
// apenas se detectan los campos, pero es una defensa barata por si el
// llamador queda desincronizado).
export function reemplazarCampos(html, valores, emailPreview) {
  const decoded = html
    .replace(/&lt;\*/gi, '<*')
    .replace(/\*&gt;/gi, '*>')
  return decoded.replace(/<\*([^*>]+)\*>/g, (match, campoRaw) => {
    const campo = campoRaw.trim()
    if (campo.toLowerCase() === 'email') return emailPreview || match
    return valores[campo] ?? match
  })
}
