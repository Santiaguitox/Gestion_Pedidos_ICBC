// Detección de variables de personalización de icomm: <*Nombre*>.
//
// Pueden venir de dos formas en el HTML de una pieza:
//   - literal:   <*Info4*>
//   - escapadas: &lt;*Info4*&gt;  (también con entidades numéricas, &#60; /
//                &#x3C;, el asterisco como &ast; y hasta con doble escape,
//                &amp;lt;). Pasa cuando el HTML se reconstruyó con un parser
//                (por ejemplo al descargar y volver a subir una pieza).
//
// El escaneo trabaja sobre el TEXTO CRUDO, sin DOMParser: un parser trata
// <*...*> como texto y escapa los < >, así que perdería la diferencia y
// además no sirve para HTML roto. En su lugar se recorre el HTML con un
// tokenizador simple (comentarios, <style>/<script>, tags con sus
// atributos y texto) y cada variable se clasifica según DÓNDE aparece:
//
//   texto    → dentro del contenido (incluido el texto de un <a>)
//   links    → en el href de un <a> / <area>
//   imagenes → en src / background / srcset / poster, o en el alt de un <img>
//   otros    → cualquier otro atributo, estilos, scripts y comentarios

const ABRE = '(?:<|&(?:amp;)*(?:lt|#0*60|#x0*3c);)'
const CIERRA = '(?:>|&(?:amp;)*(?:gt|#0*62|#x0*3e);)'
const ASTERISCO = '(?:\\*|&(?:amp;)*(?:ast|#0*42|#x0*2a);)'
const FUENTE_VARIABLE = `${ABRE}${ASTERISCO}([^*<>]{1,100}?)${ASTERISCO}${CIERRA}`

// Comentarios | <style>/<script> completos | tags con atributos (respetando
// comillas, así un ">" dentro de un valor no corta el tag).
const TOKEN = /<!--[\s\S]*?-->|<(style|script)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/\1\s*>|<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/gi
const ATRIBUTO = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

export const GRUPOS_VARIABLES = ['texto', 'links', 'imagenes', 'otros']

function formaDe(coincidencia) {
  const abreLiteral = coincidencia.startsWith('<')
  const cierraLiteral = coincidencia.endsWith('>')
  if (abreLiteral && cierraLiteral) return 'literal'
  if (!abreLiteral && !cierraLiteral) return 'escapada'
  return 'mixta'
}

function categoriaDeAtributo(tag, atributo) {
  if ((tag === 'a' || tag === 'area') && atributo === 'href') return 'links'
  if (atributo === 'src' || atributo === 'background' || atributo === 'srcset' || atributo === 'poster') return 'imagenes'
  if (tag === 'img' && atributo === 'alt') return 'imagenes'
  return 'otros'
}

// Devuelve [{ nombre, forma, grupo }] — una entrada por aparición, en orden.
export function encontrarVariables(html) {
  const ocurrencias = []
  const texto = String(html ?? '')

  function buscarEn(fragmento, grupo) {
    const re = new RegExp(FUENTE_VARIABLE, 'gi')
    let m
    while ((m = re.exec(fragmento)) !== null) {
      ocurrencias.push({ nombre: m[1].trim(), forma: formaDe(m[0]), grupo })
    }
  }

  const re = new RegExp(TOKEN.source, 'gi')
  let ultimo = 0
  let m
  while ((m = re.exec(texto)) !== null) {
    buscarEn(texto.slice(ultimo, m.index), 'texto')
    if (m[0].startsWith('<!--') || m[1]) {
      // comentario o bloque <style>/<script>
      buscarEn(m[0], 'otros')
    } else {
      const tag = m[2].toLowerCase()
      const atributos = new RegExp(ATRIBUTO.source, 'g')
      let a
      while ((a = atributos.exec(m[3])) !== null) {
        const valor = a[2] ?? a[3] ?? a[4]
        if (valor) buscarEn(valor, categoriaDeAtributo(tag, a[1].toLowerCase()))
      }
    }
    ultimo = m.index + m[0].length
  }
  buscarEn(texto.slice(ultimo), 'texto')
  return ocurrencias
}

// Resumen listo para la UI: grupos con las variables únicas y cuántas veces
// aparece cada una. Se muestran siempre en su forma normal (<*Nombre*>),
// estén escapadas o no.
export function detectarVariables(html) {
  const ocurrencias = encontrarVariables(html)
  const grupos = Object.fromEntries(GRUPOS_VARIABLES.map(g => [g, []]))

  for (const o of ocurrencias) {
    const visible = `<*${o.nombre}*>`
    const existente = grupos[o.grupo].find(v => v.variable === visible)
    if (existente) existente.cantidad += 1
    else grupos[o.grupo].push({ variable: visible, cantidad: 1 })
  }

  const unicas = new Set(ocurrencias.map(o => o.nombre))
  return {
    total: ocurrencias.length,
    unicas: unicas.size,
    grupos,
    escapadas: ocurrencias.filter(o => o.forma !== 'literal').length,
  }
}
