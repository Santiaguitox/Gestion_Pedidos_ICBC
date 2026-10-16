// Comentarios "protegidos" del editor de la plataforma (CKEditor).
//
// El editor guarda como comentario, con el contenido codificado como URL, los
// bloques que no quiere tocar: <!--{cke_protected}{C}%3C!%2D%2D...-->. Al
// exportar tendría que devolverlos como estaban, pero en algunas piezas salen
// así al HTML final. El efecto es serio: el CSS de la pieza y los comentarios
// condicionales de Outlook (<!--[if mso]>...<![endif]-->) quedan adentro de un
// comentario inerte y ningún cliente los aplica.
//
// Reponerlos es decodificar el texto: es lo mismo que hace el editor al
// guardar. Todo es trabajo sobre strings (nada de DOM), igual que el resto.

const PROTEGIDO = /<!--\{cke_protected\}\{[A-Za-z]\}([\s\S]*?)-->/g

function decodificar(codificado) {
  try {
    return decodeURIComponent(codificado)
  } catch {
    return null // secuencia % inválida: no se toca
  }
}

// Dentro de lo repuesto (sobre todo los comentarios condicionales de Outlook)
// aparece el mismo accidente de comillas que rompe los style del resto de la
// pieza: style='font-family: 'Ubuntu', sans-serif;...' (comillas simples
// envolviendo el atributo y también el nombre de la tipografía). Un cliente
// que parsee eso corta el style en la primera comilla interna. Es seguro
// repararlo: el valor termina en la última comilla simple que cierra el tag o
// va seguida de otro atributo, y se re-envuelve en comillas dobles. Solo se
// toca si el valor trae comillas simples adentro; los style sanos no cambian.
const STYLE_COMILLA_SIMPLE = /(\sstyle=)'([^"<>]*?)'(?=\s*(?:\/?>|[a-zA-Z-]+\s*=))/g

// Además de re-envolver, el nombre de la tipografía queda SIN comillas
// (font-family: 'Ubuntu', sans-serif -> font-family: Ubuntu, sans-serif): la
// regla de la herramienta es que ninguna tipografía lleva comillas en el style.
function sinComillasEnTipografias(valor) {
  return valor.replace(/(font-family:\s*)([^;]*)/gi, (_, prefijo, lista) => prefijo + lista.replace(/'/g, ''))
}

function repararComillasDeStyle(texto) {
  return texto.replace(STYLE_COMILLA_SIMPLE, (completo, prefijo, valor) =>
    valor.includes("'") ? `${prefijo}"${sinComillasEnTipografias(valor)}"` : completo)
}

// Devuelve { html, cantidad } con todos los comentarios protegidos repuestos.
export function decodificarProtegidos(html) {
  const texto = String(html ?? '')
  let cantidad = 0
  const salida = texto.replace(PROTEGIDO, (completo, codificado) => {
    const original = decodificar(codificado)
    if (original === null) return completo
    cantidad++
    return repararComillasDeStyle(original)
  })
  return { html: salida, cantidad }
}

// Resumen para el informe: cuántos hay y de qué son.
export function resumirProtegidos(html) {
  const texto = String(html ?? '')
  let total = 0
  let css = 0
  let outlook = 0
  for (const m of texto.matchAll(PROTEGIDO)) {
    const original = decodificar(m[1])
    if (original === null) continue
    total++
    if (/<!--\s*\[if\b/i.test(original)) outlook++
    else if (/\{[^{}]*:[^{}]*\}/.test(original)) css++
  }
  return { total, css, outlook }
}
