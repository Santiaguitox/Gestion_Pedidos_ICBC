// Botón "copiar" de los resultados: arma el texto que conviene pegar en el
// Ctrl+F del HTML para llegar directo a lo que hay que corregir.
//
// El `ref` de cada hallazgo (ver localizarEnPreview.js) trae el texto ya
// DECODIFICADO (con tildes, sin tags), pero el HTML fuente puede tenerlo
// escrito distinto: &aacute;, &nbsp;, &amp;, tags en el medio, saltos de
// línea… Por eso no se asume nada: se prueba contra el HTML real de la pieza y
// se copia lo primero que efectivamente aparece ahí.

const NBSP = String.fromCharCode(160)

const ENTIDADES = {
  'á': '&aacute;', 'é': '&eacute;', 'í': '&iacute;', 'ó': '&oacute;', 'ú': '&uacute;',
  'Á': '&Aacute;', 'É': '&Eacute;', 'Í': '&Iacute;', 'Ó': '&Oacute;', 'Ú': '&Uacute;',
  'ñ': '&ntilde;', 'Ñ': '&Ntilde;', 'ü': '&uuml;', 'Ü': '&Uuml;',
  '¿': '&iquest;', '¡': '&iexcl;', '&': '&amp;', '<': '&lt;', '>': '&gt;',
  [NBSP]: '&nbsp;',
}

const conEntidadesNombradas = (s) => [...s].map(c => ENTIDADES[c] ?? c).join('')
const conEntidadesNumericas = (s) => [...s].map(c => (c.charCodeAt(0) > 126 || c === '&' ? `&#${c.charCodeAt(0)};` : c)).join('')
const limpiar = (s) => (s ?? '').replace(/\s+/g, ' ').trim()

// Tramos del fragmento sin caracteres que el HTML pueda escribir distinto,
// del más largo al más corto.
function tramos(fragmento) {
  const porCaracter = fragmento.split(/[^\x20-\x7e]|[&<>"]/)
  const porPalabra = fragmento.split(/[^A-Za-z0-9]+/)
  const base = [...porCaracter.map(limpiar), ...porPalabra]
  // La puntuación pegada a un tag también cambia ("proyectos</span>!"), así
  // que se prueba cada tramo con y sin puntuación en las puntas.
  const sinPuntas = base.map(t => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
  return [...base, ...sinPuntas]
    .filter(t => t.length >= 4)
    .sort((a, b) => b.length - a.length)
}

function elegirTexto(fragmento, html) {
  const original = limpiar(fragmento)
  if (!original) return ''
  if (!html) return original
  // `crudo` conserva los espacios no separables (limpiar() los vuelve espacios
  // comunes), para poder encontrarlos como &nbsp;.
  const crudo = fragmento.trim()
  const candidatos = [
    crudo, conEntidadesNombradas(crudo), conEntidadesNumericas(crudo),
    original, conEntidadesNombradas(original), conEntidadesNumericas(original),
    ...tramos(original),
  ]
  return candidatos.find(c => c && html.includes(c)) ?? original
}

export function textoParaBuscar(ref, html) {
  if (!ref || typeof ref !== 'object') return ''
  switch (ref.tipo) {
    case 'img': {
      const src = ref.src ?? ''
      const archivo = src.split('?')[0].split('/').pop() || src
      if (!html) return archivo
      return [archivo, src].find(c => c && html.includes(c)) ?? archivo
    }
    case 'link': {
      const href = ref.href ?? ''
      if (!href) return limpiar(ref.texto)
      if (!html) return href
      const conAmp = href.replace(/&/g, '&amp;')
      const antesDelAmp = href.split('&')[0]
      return [href, conAmp, antesDelAmp].find(c => c && html.includes(c)) ?? href
    }
    case 'texto':
    case 'atributo':
      return elegirTexto(ref.fragmento ?? '', html)
    default:
      return ''
  }
}
