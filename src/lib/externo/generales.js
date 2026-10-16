// ============================================================================
// COPIA de src/lib/revision/generales.js (TeamWorkHub), hecha el 2026-10-14.
//
// Es la lógica de validación que ya corre en "Revisión de emails", copiada
// acá para que las páginas externas (/analisis) sean independientes: un
// cambio en la app NO afecta a esta herramienta, ni al revés. Un arreglo
// que se haga allá hay que pasarlo acá a mano (y viceversa).
//
// Qué se copió: Clases, Links, Alt, Estructura HTML y Peso del HTML (con
// todos sus detectores auxiliares). Qué NO se copió, a propósito, por ser
// específico de ICBC o del editor: Dominio de imágenes aprobado, Legal,
// Estructuras obsoletas y DetectarFragmentoHtmlCrudoEnTexto.
//
// Diferencias respecto del original (todas marcadas con "EXTERNO:"):
//   - ValidarClasesDefinidas ignora las clases que genera la plataforma.
//   - Los nombres de imagen salen de nombreImagen() (sin ?query ni data:).
//   - ValidarPesoHTML devuelve además kb y los límites, para la UI.
// ============================================================================
import { resumirProtegidos, decodificarProtegidos } from './protegidos.js'
import { resumirExtensiones } from './extensiones.js'
import { reconstruirStyleRoto } from './reconstruirAtributos.js'
import { CLASES_DE_PLATAFORMA } from './config.js'
import { nombreImagen } from './helpers.js'


export function ValidarClasesDefinidas(doc) {
  // Extraer clases definidas en el <style>
  // EXTERNO: se juntan TODOS los <style> (con o sin media=, envueltos en
  // <!-- -->) y también los que viven dentro de comentarios condicionales de
  // Outlook (<!--[if mso]><style>…</style><![endif]-->), que en el DOM son
  // comentarios y querySelectorAll no los ve. Una clase alcanza con estar
  // definida en UNO de ellos.
  const bloques = [...doc.querySelectorAll('style')].map(s => s.textContent)
  const recorrido = doc.createNodeIterator(doc, 128 /* NodeFilter.SHOW_COMMENT */)
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    if (/<style\b/i.test(n.data)) bloques.push(n.data)
  }
  const estilos = bloques.join(' ')

  const clasesDefinidas = new Set()
  const regex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)\s*[{,:\s]/g
  let match
  while ((match = regex.exec(estilos)) !== null) {
    clasesDefinidas.add(match[1])
  }

  // Extraer clases usadas en elementos
  const clasesUsadas = new Set()
  doc.querySelectorAll('[class]').forEach(el => {
    el.classList.forEach(clase => clasesUsadas.add(clase))
  })

  // Buscar clases usadas que no están definidas.
  // EXTERNO: las piezas armadas con el editor de icomm traen clases que
  // genera la propia plataforma (ej: class='wrap') y que no están en el
  // <style> de la pieza. El autor no las puede corregir, así que no cuentan
  // como error (lista en config.js, fácil de ampliar).
  const clasesHuerfanas = [...clasesUsadas].filter(c => !clasesDefinidas.has(c) && !CLASES_DE_PLATAFORMA.has(c))

  if (clasesHuerfanas.length > 0) {
    // EXTERNO: advertencia, no error (la pieza se ve igual; es un orden pendiente)
    return {
      ok: false,
      advertencia: true,
      tipo: 'Clases sin incluir en la hoja de estilos',
      detalle: `${clasesHuerfanas.length} clase${clasesHuerfanas.length > 1 ? 's' : ''} usada${clasesHuerfanas.length > 1 ? 's' : ''} sin definir en el style: ${clasesHuerfanas.join(', ')}`,
    }
  }

  return {
    ok: true,
    tipo: 'Clases utilizadas en el HTML',
    detalle: 'Todas las clases usadas están definidas en la hoja de estilos',
  }
}

export function ValidarLinks(doc) {
  const links = [...doc.querySelectorAll('a')]
  const problemas = []
  let linksRevisados = 0

  links.forEach(link => {
    const href = (link.getAttribute('href') || '').trim()
    const texto = link.textContent.trim()
    const soloImagen = link.querySelectorAll('img').length > 0 && texto === ''



    linksRevisados++

    // EXTERNO: nombre con el que se muestra el link: su texto o, si es solo una
    // imagen, el alt de la imagen (antes decía "sin texto" aunque tuviera alt).
    const altImagen = soloImagen ? (link.querySelector('img')?.getAttribute('alt') || '').trim() : ''
    const label = soloImagen
      ? (altImagen ? `Link de imagen "${altImagen}"` : 'Link de imagen')
      : `Link "${texto || 'sin texto'}"`

    // 1. href vacío — aplica a todos
    if (!href) {
      problemas.push({ detalle: `${label} tiene el href vacío` })
      return
    }

    // EXTERNO: href que es solo "#" (destino de relleno que nunca se completó).
    // Estaba en Estructura HTML; es un problema del link, va acá. Un ancla real
    // (#seccion) no entra: solo el "#" pelado.
    if (href === '#') {
      problemas.push({ detalle: `${label} apunta solo a "#": falta el destino` })
      return
    }

    // Si solo tiene imagen, solo validamos que tenga href — ya lo chequeamos arriba
    if (soloImagen) return

    // Verificar target="_blank" en todos los links
    if (link.getAttribute('target') !== '_blank') {
      problemas.push({ detalle: `${label} no tiene target="_blank"`, advertencia: true })
    }

    // 2. Validaciones para links con texto
    const esTel = href.startsWith('tel:')
    const esMailto = href.startsWith('mailto:')
    const esWhatsapp = href.includes('wa.me') || href.includes('api.whatsapp.com')
    const esWeb = href.startsWith('https://') || href.startsWith('http://')

    const textoPareceTelefono = /^[\d\s+\-()]+$/.test(texto) && texto.replace(/\D/g, '').length >= 7
    const textoPareceEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)
    const textoPareceWeb = /^https?:\/\//.test(texto) || /^www\./.test(texto)

    if (textoPareceTelefono) {
      if (!esTel && !esWhatsapp) {
        problemas.push({ detalle: `Link "${texto}" parece un teléfono pero el href no usa tel: ni whatsapp (href: ${href})` })
        return
      }
      const numeroTexto = texto.replace(/\D/g, '')
      const numeroHref = href.replace(/\D/g, '')
      if (!numeroHref.endsWith(numeroTexto) && !numeroTexto.endsWith(numeroHref)) {
        problemas.push({ detalle: `Teléfono "${texto}" no concuerda con el href "${href}"` })
      }
    } else if (textoPareceEmail) {
      if (!esMailto) {
        problemas.push({ detalle: `Link "${texto}" parece un email pero el href no usa mailto: (href: ${href})` })
        return
      }
      const mailHref = href.replace('mailto:', '').split('?')[0].trim()
      if (mailHref.toLowerCase() !== texto.toLowerCase()) {
        problemas.push({ detalle: `Email "${texto}" no concuerda con el href "${mailHref}"` })
      }
    } else if (textoPareceWeb) {
      if (!esWeb) {
        problemas.push({ detalle: `Link "${texto}" parece una URL pero no usa https:// (href: ${href})` })
        return
      }
      const urlTexto = decodeURIComponent(texto.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase())
      const urlHref = decodeURIComponent(href.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase())
      if (!urlHref.startsWith(urlTexto) && !urlTexto.startsWith(urlHref)) {
        problemas.push({ detalle: `URL "${texto}" no concuerda con el href "${href}"` })
      }
    }
  })

  // 3. Buscar textos sueltos que parezcan emails o URLs sin link
  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => {
        if (node.parentElement.closest('a')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    }
  )

  let nodo
  while ((nodo = walker.nextNode())) {
    const texto = nodo.textContent.trim()
    if (!texto) continue

    const matchEmail = texto.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)
    if (matchEmail) {
      problemas.push({ detalle: `Posible email sin link: "${matchEmail[0]}"`, advertencia: true })
    }

    const matchWeb = texto.match(/(?:https?:\/\/|www\.)[^\s]+/)
    if (matchWeb) {
      problemas.push({ detalle: `Posible URL sin link: "${matchWeb[0]}"`, advertencia: true })
    }
  }

  const errores = problemas.filter(p => !p.advertencia)
  const advertencias = problemas.filter(p => p.advertencia)

  return {
    ok: errores.length === 0,
    tipo: 'Links',
    detalle: `${linksRevisados} links revisados`,
    correctos: linksRevisados - errores.length,
    totalRevisados: linksRevisados,
    checks: errores.map(p => ({ ok: false, detalle: p.detalle })),
    advertencias: advertencias.map(p => ({ detalle: p.detalle })),
  }
}


export function ValidarAltImagenes(doc) {
  const imagenes = [...doc.querySelectorAll('img')]
  const sinAlt = []
  const altVacio = []

  imagenes.forEach(img => {
    const src = img.getAttribute('src') || ''
    const nombre = nombreImagen(src) || 'imagen sin src' // EXTERNO: sin ?query ni data:

    if (!img.hasAttribute('alt')) {
      sinAlt.push(nombre)
    } else if (img.getAttribute('alt').trim() === '') {
      altVacio.push(nombre)
    }
  })

  const checks = []
  sinAlt.forEach(nombre => checks.push({ ok: false, detalle: `Sin atributo alt: ${nombre}` }))
  altVacio.forEach(nombre => checks.push({ ok: false, detalle: `Alt vacío: ${nombre}` }))

  if (checks.length > 0) {
    // EXTERNO: advertencia, no error (conviene tenerlo, pero no es obligatorio)
    return {
      ok: false,
      advertencia: true,
      tipo: 'Alt de imágenes',
      detalle: `${checks.length} imagen${checks.length > 1 ? 'es' : ''} con problemas de alt`,
      checks,
    }
  }

  return {
    ok: true,
    tipo: 'Alt de imágenes',
    detalle: `Todas las imágenes (${imagenes.length}) tienen alt correcto`,
    checks: [],
  }
}

function DetectarAtributosMalCerrados(htmlString) {
  const problemas = []

  // Limpiar variables de personalización antes de analizar
  const htmlLimpio = htmlString.replace(/<\*[^*]*\*>/g, 'VARIABLE_PERSONALIZACION')

  // Detectar atributos con comilla sin cerrar
  const regex = /<[a-z][^>]*?(?:class|style|src|href|alt|id|width|height)="[^"]*(?=<)/gi
  const matches = htmlLimpio.match(regex)
  
  if (matches) {
    matches.forEach(() => {
      problemas.push({ detalle: 'Atributo con comilla sin cerrar detectado' })
    })
  }

  // Detectar tags con comillas desbalanceadas respetando contenido entre comillas
  const tagRegex = /<[a-zA-Z][^]*?(?:"[^"]*"[^]*?)*>/g
  let tag
  while ((tag = tagRegex.exec(htmlLimpio)) !== null) {
    const contenido = tag[0]
    const comillas = (contenido.match(/"/g) || []).length
    if (comillas % 2 !== 0) {
      problemas.push({ detalle: `Tag con comillas desbalanceadas: ${contenido.substring(0, 150)}...` })
    }
  }

  problemas.push(...DetectarAtributosConDosPuntos(htmlLimpio))

  return problemas
}

// Bug real reportado por Santi (2026-07-19): un <img> traía
// `display:="" block="" color:="" c4161c="" width="100px"...` — un
// style que en algún punto de la cadena de origen perdió su wrapper
// (comillas simples envolviendo TODO el style, con una tipografía
// no-sistema también entre comillas simples adentro — ver el detalle
// completo y la reproducción contra un parser HTML real en el chat
// del 2026-07-19) y quedó partido en atributos sueltos.
// DetectarAtributosMalCerrados (arriba) no lo agarra porque cada
// `nombre=""` está perfectamente bien formado — comillas balanceadas
// y cerradas — el HTML es 100% válido para cualquier parser (browser
// o DOMParser), solo que semánticamente es basura.
//
// Heurística de DETECCIÓN: un nombre de atributo HTML real NUNCA
// contiene ':' (salvo namespaces XML tipo xlink:href, que no
// aparecen en piezas de mail) — así que un atributo cuyo nombre
// termina en ':' es, en la enorme mayoría de los casos reales, una
// propiedad CSS que se quedó sin su wrapper style=. Se busca sobre el
// string crudo (no el DOM ya parseado) porque el DOM ya aceptó el
// atributo como válido y no deja rastro de que el nombre es
// sospechoso.
//
// Además de detectar, intenta RECONSTRUIR una sugerencia del style
// original (ver reconstruirAtributos.js). Esto funciona como una
// SEGUNDA señal de detección, independiente de la heurística de
// arriba — no solo un enriquecimiento posterior: una corrupción de
// una sola declaración CSS corta (ej. "color: rojo" partido en
// style="color: " + rojo="") puede no dejar NINGÚN nombre de
// atributo con ':' expuesto (el ':' sobreviviente queda adentro del
// valor ya anclado del style, no como nombre de atributo suelto) —
// sin esta segunda señal, ese caso pasaría inadvertido pese a ser
// perfectamente reconstruible.
//
// Se itera tag por tag (no con un solo regex global) y se deduplica
// por el TEXTO COMPLETO del tag, no por nombre de atributo — dos
// <img> distintos con el mismo atributo roto (ej. "display:") pero
// contenido distinto son dos problemas independientes, cada uno con
// su propia reconstrucción posible.
// EXTERNO: nombres de las tipografías que la pieza carga (Google Fonts en un
// <link> o un @import: "family=Barlow:wght@400;800", "family=Open+Sans"). Sirven
// para devolverle las mayúsculas a la tipografía en la reconstrucción de un
// style roto, que las pierde ("barlow" -> "Barlow").
export function tipografiasCargadas(htmlString) {
  const nombres = new Set()
  const urls = htmlString.match(/fonts\.googleapis\.com\/css2?\?[^'"\s>)]*/gi) || []
  for (const url of urls) {
    for (const m of url.replace(/&amp;/g, '&').matchAll(/[?&]family=([^&]+)/g)) {
      // css (v1) junta varias con "|": "Roboto:400|Open+Sans"
      for (const parte of m[1].split('|')) {
        try { nombres.add(decodeURIComponent(parte.split(':')[0].replace(/\+/g, ' ')).trim()) } catch { /* se ignora */ }
      }
    }
  }
  return [...nombres].filter(Boolean)
}

// Nombres que NO cuentan como "tipografía que hay que cargar": las de sistema
// y las genéricas. Sirve para elegir qué tipografía real mostrar en el ejemplo.
const TIPOGRAFIAS_DE_SISTEMA = new Set([
  'arial', 'helvetica', 'helvetica neue', 'verdana', 'tahoma', 'trebuchet ms', 'times new roman', 'times',
  'georgia', 'courier new', 'courier', 'segoe ui', 'calibri', 'cambria', 'impact', 'lucida sans',
  'lucida grande', 'palatino', 'garamond', 'comic sans ms', 'sans-serif', 'serif', 'monospace', 'cursive',
  'fantasy', 'system-ui', 'inherit', 'initial',
])

const aTitulo = nombre => nombre.replace(/(^|\s)(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase())

// Primera tipografía que no es de sistema entre los style partidos de la pieza
// (para el ejemplo del consejo). Si no hay ninguna, la primera que carga la
// pieza por <link>/@import; y si tampoco, "Open Sans".
export function tipografiaDeEjemplo(estilos, familias = []) {
  for (const style of estilos) {
    for (const m of String(style || '').matchAll(/font-family:\s*([^;]*)/gi)) {
      for (const parte of m[1].split(',')) {
        const nombre = parte.replace(/["']/g, '').trim()
        if (!nombre || TIPOGRAFIAS_DE_SISTEMA.has(nombre.toLowerCase())) continue
        return familias.find(f => f.toLowerCase() === nombre.toLowerCase()) ?? aTitulo(nombre)
      }
    }
  }
  return familias[0] ?? 'Open Sans'
}

export function conTipografiasCargadas(style, familias) {
  if (!familias.length) return style
  return style.replace(/(font-family:\s*)([^;]*)/gi, (_, prefijo, lista) => {
    const corregida = lista.split(',').map(t => {
      const limpio = t.trim()
      const f = familias.find(n => n.toLowerCase() === limpio.toLowerCase())
      if (!f) return limpio
      // EXTERNO: el nombre va SIN comillas (ni simples ni dobles), también las
      // de varias palabras: "Open Sans" es válido en CSS sin ellas.
      return f
    }).join(', ')
    return prefijo + corregida
  })
}

// "<p class='title' style=...>" -> '<p class="title">' (para listarla en el informe)
function nombreCortoDeTag(tag) {
  const nombre = /^<([a-zA-Z][\w-]*)/.exec(tag)?.[1]?.toLowerCase() ?? 'etiqueta'
  const clase = /\sclass\s*=\s*['"]([^'"]*)['"]/i.exec(tag)?.[1]?.trim().split(/\s+/)[0]
  return clase ? `<${nombre} class="${clase}">` : `<${nombre}>`
}

export function DetectarAtributosConDosPuntos(htmlString) {
  const problemas = []
  const familias = tipografiasCargadas(htmlString)
  const tagRegex = /<[a-zA-Z][^>]*>/g
  const atributoConDosPuntos = /\s([a-zA-Z-]+:)=["'][^"']*["']/
  const vistos = new Set()
  let m
  while ((m = tagRegex.exec(htmlString)) !== null) {
    const tagCompleto = m[0]
    if (vistos.has(tagCompleto)) continue

    const matchAtributo = atributoConDosPuntos.exec(tagCompleto)
    const reconstruccion = reconstruirStyleRoto(tagCompleto)
    if (!matchAtributo && !reconstruccion) continue
    vistos.add(tagCompleto)

    // Nombre a mostrar en el aviso: el atributo con ':' expuesto si
    // lo hay, o si no, la propiedad CSS que quedó truncada en el
    // style ancla (ej. style="color: " → "color:"). En la práctica
    // casi siempre hay una de las dos (llegar hasta acá ya exige al
    // menos una señal), pero el fallback a 'style' cubre el caso
    // borde de que ninguna calce exactamente (ej. ancla vacía en el
    // caso B sin ancla) sin arriesgar una excepción.
    const anclaConDosPuntos = reconstruccion && /([a-zA-Z-]+):\s*$/.exec(reconstruccion.styleTruncado)
    const nombreDetectado = matchAtributo?.[1] ?? (anclaConDosPuntos ? `${anclaConDosPuntos[1]}:` : 'style')
    const detalleBase = `Atributo "${nombreDetectado}" — probablemente un style="..." que perdió su wrapper y quedó partido en atributos sueltos (revisar la etiqueta completa)`

    let detalle = detalleBase
    let sugerido = null
    if (reconstruccion?.confiable) {
      sugerido = conTipografiasCargadas(reconstruccion.styleFinal, familias)
      detalle = `${detalleBase}. Reconstrucción sugerida: style="${sugerido}"`
    } else if (reconstruccion?.declaracionesInvalidas?.length > 0) {
      // Reconstrucción PARCIAL: parte de las declaraciones sí se
      // pudieron armar bien, pero al menos una no tiene forma válida
      // — casi siempre porque el nombre de esa propiedad puntual no
      // sobrevivió en ningún lado (solo quedaron sus valores sueltos,
      // ej. una tipografía sin "font-family:" en ningún atributo).
      // Se explica esto en vez de descartar todo en silencio con el
      // mensaje genérico — no se ofrece aplicar (nunca se inventa a
      // qué propiedad pertenecía), pero al menos queda claro qué
      // parte falta completar a mano.
      const listado = reconstruccion.declaracionesInvalidas.map(d => `"${d}"`).join(', ')
      const sinValor = reconstruccion.declaracionesInvalidas.every(d => /^[a-zA-Z-]+\s*:\s*$/.test(d))
      detalle = sinValor
        ? `${detalleBase}. No se pudo reconstruir del todo: ${listado} quedó sin valor — el valor suele quedar como un atributo suelto al principio de la etiqueta y no se puede asignar con seguridad (por ejemplo, un número sin unidad). El resto sí reconstruye bien, pero no se corrige automático mientras falte esa parte: completarlo a mano.`
        : `${detalleBase}. No se pudo reconstruir del todo: ${listado} no tiene forma de "propiedad: valor" — probablemente perdió el nombre de la propiedad y solo sobrevivió el valor. El resto sí reconstruye bien, pero no se ofrece aplicar automático mientras falte esa parte.`
    }

    problemas.push({
      detalle,
      tagCompleto,
      reconstruccion,
      sugerido,
      etiqueta: nombreCortoDeTag(tagCompleto),
    })
  }
  return problemas
}

// Cuenta aperturas/cierres de cada tag en `tags`, ignorando el
// contenido de bloques condicionales de Outlook (adentro se abren y
// cierran tags a propósito de forma asimétrica por bloque — ver
// DetectarEstructurasOutlook) y las variables de personalización
// <*Campo*> (no son tags reales). Extraída de DetectarTagsMalCerrados
// para poder reusarla tal cual desde otros lugares que necesitan este
// mismo chequeo con su propia lista de tags — antes de esto,
// descargarPiezas.js (Piezas entregables) tenía su propia copia de
// este conteo SIN el descarte de bloques Outlook, dando falsos
// positivos en piezas con el patrón de conditional comments partido
// en dos (abre en un comentario, cierra en otro más abajo).
export function DetectarBalanceTags(htmlString, tags) {
  const problemas = []

  const htmlSinOutlook = htmlString
    .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<\*[^*]*\*>/g, 'VARIABLE_PERSONALIZACION')

  tags.forEach(tag => {
    const abiertos = (htmlSinOutlook.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length
    const cerrados = (htmlSinOutlook.match(new RegExp(`<\\/${tag}>`, 'gi')) || []).length

    if (abiertos !== cerrados) {
      const diferencia = abiertos - cerrados
      if (diferencia > 0) {
        problemas.push({ detalle: `<${tag}> tiene ${diferencia} etiqueta${diferencia > 1 ? 's' : ''} sin cerrar` })
      } else {
        problemas.push({ detalle: `<${tag}> tiene ${Math.abs(diferencia)} cierre${Math.abs(diferencia) > 1 ? 's' : ''} de más` })
      }
    }
  })

  return problemas
}

function DetectarTagsMalCerrados(htmlString) {
  const problemas = []

  const tags = ['table', 'tbody', 'tr', 'td', 'th', 'div', 'p', 'span', 'a', 'strong', 'em', 'b', 'i']
  problemas.push(...DetectarBalanceTags(htmlString, tags))

  // Sumar validación de atributos
  problemas.push(...DetectarAtributosMalCerrados(htmlString))

  // Sumar validación de estructuras Outlook
  problemas.push(...DetectarEstructurasOutlook(htmlString))

  return problemas
}

export function DetectarEstructurasOutlook(htmlString) {
  const problemas = []

  const aperturas = (htmlString.match(/<!--\[if[^\]]*\]>/gi) || []).length
  const cierres = (htmlString.match(/<!\[endif\]-->/gi) || []).length

  if (aperturas === 0) {
    // EXTERNO: si los condicionales están codificados por el editor, existen
    // (se reponen al descargar) y ya se avisan como tales: no decir que faltan.
    if (resumirProtegidos(htmlString).outlook > 0) return problemas
    // EXTERNO: es una advertencia, no un error. Las estructuras para Outlook
    // no son una regla general (dependen del cliente), solo suman si están.
    problemas.push({ detalle: 'No se encontraron estructuras condicionales de Outlook. La pieza estaría más completa si las incluyera.', advertencia: true })
    return problemas
  }

  if (aperturas !== cierres) {
    const diferencia = aperturas - cierres
    problemas.push({ detalle: diferencia > 0
      ? `${diferencia} bloque${diferencia > 1 ? 's' : ''} condicional${diferencia > 1 ? 'es' : ''} de Outlook sin cerrar`
      : `${Math.abs(diferencia)} cierre${Math.abs(diferencia) > 1 ? 's' : ''} de Outlook de más`
    })
    return problemas
  }

  // Extraer todo el contenido dentro de bloques de Outlook
  const bloques = [...htmlString.matchAll(/<!--\[if[^\]]*\]>([\s\S]*?)<!\[endif\]-->/gi)]
  const contenidoTotal = bloques.map(b => b[1]).join('\n')

  // Contar tags que abren y cierran dentro de los bloques
  const tags = ['table', 'tr', 'td', 'th', 'tbody']
  tags.forEach(tag => {
    const abiertos = (contenidoTotal.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length
    const cerrados = (contenidoTotal.match(new RegExp(`<\\/${tag}>`, 'gi')) || []).length

    if (abiertos !== cerrados) {
      const diff = abiertos - cerrados
      if (diff > 0) {
        problemas.push({ detalle: `Bloques Outlook: <${tag}> tiene ${diff} apertura${diff > 1 ? 's' : ''} sin cierre correspondiente` })
      } else {
        problemas.push({ detalle: `Bloques Outlook: <${tag}> tiene ${Math.abs(diff)} cierre${Math.abs(diff) > 1 ? 's' : ''} de más` })
      }
    }
  })

  return problemas
}

// Detecta tags de formato/línea (strong, em, b, i, u, span, a) cuyo
// contenido arranca o termina pegado al borde de un bloque
// condicional de Outlook (<!--[if ...]> ... <![endif]-->) — típico
// accidente de edición: alguien aplicó negrita/cursiva/link justo al
// lado de donde empieza o termina un comentario MSO, sin darse
// cuenta de que lo estaba envolviendo.
//
// Por qué es grave y no cosmético: en Outlook (motor de Word), ese
// bloque se "revela" como HTML real — una <table>/<tr>/<td> real,
// quedando ANIDADA dentro de un tag en línea. Ese anidamiento es
// inválido y Outlook lo renderiza de forma impredecible (puede romper
// el ancho fijo que ese mismo bloque condicional existe para
// garantizar). En cualquier OTRO cliente — y en el propio parser de
// este validador — el bloque entero es un comentario inerte: nunca
// hay una <table> real ahí, por eso el chequeo de "tabla anidada en
// tag en línea" de más abajo (basado en el DOM, vía doc.querySelector)
// nunca lo detecta — jamás hay un elemento <table> en el árbol para
// que ese chequeo encuentre. Este chequeo trabaja sobre el STRING
// crudo, mirando específicamente adentro del comentario, por eso sí
// lo puede ver.
export function DetectarInlineEnvolviendoOutlook(htmlString) {
  const problemas = []
  const tagsInline = ['strong', 'em', 'b', 'i', 'u', 'span', 'a']

  tagsInline.forEach(tag => {
    const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi')
    let m
    while ((m = regex.exec(htmlString)) !== null) {
      const contenido = m[1]
      const tocaApertura = /^\s*<!--\[if/i.test(contenido)
      const tocaCierre = /<!\[endif\]-->\s*$/i.test(contenido)
      if (tocaApertura || tocaCierre) {
        problemas.push({
          detalle: `<${tag}> envuelve el borde de un bloque condicional de Outlook — probablemente quedó ahí por error de edición; en Outlook puede anidar una tabla dentro de un tag en línea y romper la estructura`,
        })
      }
    }
  })

  return problemas
}

// Detecta señales de que el HTML de la pieza tiene CONTENIDO
// DUPLICADO — el caso típico: se pegó el envío completo dos veces en
// el mismo documento por error al armarla (copiar/pegar de más, un
// merge que salió mal, etc.). El balance de tags no agarra este caso:
// si todo el bloque se duplica simétrico, cada <table> sigue teniendo
// su </table>, la cuenta global sigue "cerrando" perfecto aunque el
// documento esté objetivamente roto — hace falta mirar señales de
// contenido, no de anidamiento.
//
// Dos señales, cada una específica de una pieza de email real:
//
// 1. El "preheader" (el texto oculto que se ve como preview en la
//    bandeja de entrada — técnica estándar: display:none + font-size
//    de 1px + opacity:0 en el mismo <div>) aparece más de una vez.
//    Una pieza tiene un solo snippet de preview; verlo dos veces es
//    huella directa de contenido duplicado.
// 2. Más de un <style> en el documento — el <head> de una pieza trae
//    uno solo con todos los estilos de Outlook/responsive; un segundo
//    <style> casi siempre significa que se pegó el <head> completo
//    una segunda vez.
//
// Ninguna de las dos señales depende de la otra — se reportan por
// separado porque cada una ya alcanza sola para sospechar, y juntas
// dejan bastante claro qué pasó.
//
// OJO con la señal 2 en modo URL: la plataforma que hostea las piezas
// inyecta SU PROPIO <style> fijo (el de soporte VML: `v\:* {behavior:
// url(#default#VML); ...}`, necesario para formas/óvalos vectoriales
// de Outlook) ADEMÁS del que trae la pieza — está en TODAS las piezas
// reales, no es señal de nada. Analizado por URL (traerHtmlDeUrl trae
// el HTML de la plataforma tal cual, sin sacar nada — ver
// RevisionEnvios.jsx / ejecutarRevision.js / descargarPiezas.js) una
// pieza sana ya arranca en 2 <style> por esto solo. Se descarta ese
// bloque puntual antes de contar, si no CUALQUIER pieza sana analizada
// por URL daría falso positivo acá.
const STYLE_VML_PLATAFORMA = /<style[^>]*>\s*v\\:\*\s*\{[^{}]*behavior:\s*url\(#default#VML\)[^{}]*\}\s*<\/style>/gi

export function DetectarContenidoDuplicado(htmlString) {
  const problemas = []
  const sinStyleDePlataforma = htmlString.replace(STYLE_VML_PLATAFORMA, '')

  const divsConStyle = [...sinStyleDePlataforma.matchAll(/<div[^>]*style=["']([^"']*)["'][^>]*>/gi)].map(m => m[1])
  const preheaders = divsConStyle.filter(style =>
    /display:\s*none/i.test(style) &&
    /font-size:\s*1px/i.test(style) &&
    /opacity:\s*0\b/i.test(style)
  ).length
  if (preheaders > 1) {
    problemas.push({
      detalle: `El texto oculto de preview (preheader) aparece ${preheaders} veces — señal típica de que el contenido de la pieza quedó pegado por duplicado`,
    })
  }

  // EXTERNO: el <style> de un comentario condicional de Outlook
  // (<!--[if gte mso 9]><style>…</style><![endif]-->) es otro destinatario,
  // no un <head> pegado dos veces: no se cuenta.
  const sinCondicionales = sinStyleDePlataforma.replace(/<!--\[if\b[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '')
  const cantidadStyle = (sinCondicionales.match(/<style/gi) || []).length
  if (cantidadStyle > 1) {
    // Dos bloques con el MISMO contenido es la señal real de un <head> pegado
    // dos veces. Si son distintos (por ejemplo, el de la plataforma + el CSS
    // propio de la pieza) es válido: se avisa, pero como detalle menor.
    const contenidos = [...decodificarProtegidos(sinCondicionales).html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
      .map(m => m[1].replace(/<!--|-->/g, '').replace(/\s+/g, ' ').trim())
    const repetido = new Set(contenidos).size < contenidos.length
    problemas.push(repetido
      ? {
        detalle: `El documento tiene ${cantidadStyle} bloques <style> propios de la pieza (sin contar el de VML de la plataforma) con el mismo contenido — señal de que el <head> de la pieza quedó pegado más de una vez`,
      }
      : {
        advertencia: true,
        detalle: `El documento tiene ${cantidadStyle} bloques <style> propios de la pieza (sin contar el de VML de la plataforma). Es válido si cada uno tiene su propio CSS; solo sería un problema si el <head> quedó pegado dos veces`,
      })
  }

  return problemas
}

export function ValidarEstructuraHTML(doc, htmlString) {
  const problemas = []

  // Agregar al inicio
  const tagsMalCerrados = DetectarTagsMalCerrados(htmlString)
  problemas.push(...tagsMalCerrados)

  // Ver comentario de la función — este caso puntual (inline
  // envolviendo el borde de un bloque MSO) no lo cubre ni el chequeo
  // de arriba (que borra el bloque Outlook entero antes de contar) ni
  // el de "tabla anidada en tag inline" de más abajo (basado en el
  // DOM, ciego a lo que hay dentro de un comentario).
  problemas.push(...DetectarInlineEnvolviendoOutlook(htmlString))

  // Contenido duplicado (ver comentario de la función) — un caso que
  // el balance de tags no puede ver porque el documento sigue
  // "balanceado" aunque esté objetivamente duplicado.
  problemas.push(...DetectarContenidoDuplicado(htmlString))

  // EXTERNO: comentarios {cke_protected} del editor (ver protegidos.js).
  const protegidos = resumirProtegidos(htmlString)
  if (protegidos.total > 0) {
    const partes = []
    if (protegidos.css > 0) partes.push('el CSS de la pieza')
    if (protegidos.outlook > 0) partes.push('los bloques condicionales de Outlook')
    problemas.push({
      detalle: `${protegidos.total} comentario${protegidos.total > 1 ? 's' : ''} codificado${protegidos.total > 1 ? 's' : ''} por el editor (cke_protected)${partes.length ? `. Lo que había adentro (${partes.join(' y ')}) quedó como comentario y no se aplica` : ''}`,
      corrige: { tipo: 'protegidos', total: protegidos.total, corregidas: protegidos.total },
    })
  }

  // EXTERNO: elementos que inyectó una extensión del navegador (ver extensiones.js).
  const extensiones = resumirExtensiones(htmlString)
  if (extensiones.cantidad > 0) {
    const kb = `${(extensiones.bytes / 1024).toFixed(1).replace('.', ',')} kb`
    const quien = extensiones.extensiones.length ? ` (${extensiones.extensiones.join(' y ')})` : ''
    problemas.push({
      advertencia: true,
      detalle: `${extensiones.cantidad} bloque${extensiones.cantidad > 1 ? 's' : ''} inyectado${extensiones.cantidad > 1 ? 's' : ''} por una extensión del navegador${quien} al editar la pieza: no se ve${extensiones.cantidad > 1 ? 'n' : ''} ni aporta${extensiones.cantidad > 1 ? 'n' : ''} nada en el mail, pero suma${extensiones.cantidad > 1 ? 'n' : ''} ${kb} al código`,
      corrige: { tipo: 'extensiones', total: extensiones.cantidad, corregidas: extensiones.cantidad },
    })
  }

  // Verificar tags mal anidados en tablas — crítico para emails
  const tablas = [...doc.querySelectorAll('table')]
  tablas.forEach(tabla => {
    const hijosDirectos = [...tabla.childNodes].filter(n => n.nodeType === 1)
    hijosDirectos.forEach(hijo => {
      if (hijo.tagName !== 'TBODY' && hijo.tagName !== 'THEAD' && hijo.tagName !== 'TFOOT' && hijo.tagName !== 'TR') {
        problemas.push({ detalle: `Elemento <${hijo.tagName.toLowerCase()}> directamente dentro de <table> sin <tbody>` })
      }
    })
  })

  // Verificar que los tr solo tengan td o th como hijos directos
  const filas = [...doc.querySelectorAll('tr')]
  filas.forEach(fila => {
    const hijosDirectos = [...fila.childNodes].filter(n => n.nodeType === 1)
    hijosDirectos.forEach(hijo => {
      if (hijo.tagName !== 'TD' && hijo.tagName !== 'TH') {
        problemas.push({ detalle: `Elemento <${hijo.tagName.toLowerCase()}> directamente dentro de <tr>, se esperaba <td> o <th>` })
      }
    })
  })

  // Verificar que no haya tablas dentro de elementos inline
  const inlineTags = ['span', 'a', 'strong', 'em', 'b', 'i']
  inlineTags.forEach(tag => {
    const elementos = [...doc.querySelectorAll(tag)]
    elementos.forEach(el => {
      if (el.querySelector('table')) {
        problemas.push({ detalle: `<table> anidada dentro de <${tag}> — anidamiento inválido` })
      }
    })
  })

  // Verificar imágenes sin src
  const imagenes = [...doc.querySelectorAll('img')]
  imagenes.forEach(img => {
    if (!img.getAttribute('src') || img.getAttribute('src').trim() === '') {
      problemas.push({ detalle: 'Imagen sin atributo src' })
    }
  })

  // EXTERNO: los links con href vacío o solo "#" se validan en Links (ValidarLinks).

  // EXTERNO: lo que viene marcado como advertencia no cuenta como error.
  const errores = problemas.filter(p => !p.advertencia)
  const avisos = problemas.filter(p => p.advertencia)

  // EXTERNO: los style partidos por comillas se agrupan en UN solo error (la
  // causa es la misma en todos); el detalle por etiqueta va en un plegable.
  const esPartido = p => p.reconstruccion !== undefined || /perdió su wrapper/.test(p.detalle)
  const partidos = errores.filter(esPartido)
  const otros = errores.filter(p => !esPartido(p))
  const checksError = otros.map(p => ({ ok: false, detalle: p.detalle, ...(p.corrige && { corrige: p.corrige }) }))
  let consejos
  if (partidos.length > 0) {
    checksError.unshift({
      ok: false,
      detalle: `${partidos.length} etiqueta${partidos.length > 1 ? 's' : ''} con el style partido por comillas: el CSS quedó como atributos sueltos y el cliente de correo lo ignora`,
      estilosPartidos: {
        total: partidos.length,
        corregidas: partidos.filter(p => p.sugerido).length,
        etiquetas: partidos.map(p => ({
          etiqueta: p.etiqueta,
          sugerido: p.sugerido,
          nota: p.sugerido ? null : p.detalle.replace(/^Atributo "[^"]*" — /, ''),
          corte: p.reconstruccion?.corte ?? null,
        })),
      },
    })
    consejos = [{
      titulo: 'Cómo se arregla',
      texto: `Cuando un atributo \`style\` contiene comillas que interfieren con su interpretación, parte del CSS puede quedar fuera del atributo y dejar de aplicarse correctamente. Una causa frecuente es copiar nombres de tipografías con comillas simples o dobles, como suele ocurrir al utilizar Google Fonts. Para evitar este problema, revisá que los valores CSS no incluyan comillas innecesarias y escribí los nombres de las tipografías sin ellas. Ejemplo correcto: \`style="font-family: ${tipografiaDeEjemplo(partidos.map(p => p.sugerido ?? p.reconstruccion?.styleFinal), tipografiasCargadas(htmlString))}, Arial, sans-serif;"\`. La columna “Dónde se corta” indica el punto donde se interrumpe el estilo.`,
    }]
  }

  if (checksError.length > 0) {
    return {
      ok: false,
      tipo: 'Estructura HTML',
      detalle: `${checksError.length} problema${checksError.length > 1 ? 's' : ''} de estructura encontrado${checksError.length > 1 ? 's' : ''}`,
      checks: checksError,
      advertencias: avisos.map(p => ({ detalle: p.detalle, ...(p.corrige && { corrige: p.corrige }) })),
      ...(consejos && { consejos }),
    }
  }

  if (avisos.length > 0) {
    return {
      ok: false,
      advertencia: true,
      tipo: 'Estructura HTML',
      detalle: `${avisos.length} aviso${avisos.length > 1 ? 's' : ''} de estructura`,
      checks: avisos.map(p => ({ ok: false, detalle: p.detalle, ...(p.corrige && { corrige: p.corrige }) })),
    }
  }

  return {
    ok: true,
    tipo: 'Estructura HTML',
    detalle: 'La estructura del HTML es correcta',
    checks: [],
  }
}

export function ValidarPesoHTML(htmlString) {
  const bytes = new Blob([htmlString]).size
  const kb = bytes / 1024
  const kbRedondeado = Math.round(kb * 10) / 10

  // Límite recomendado para emails: 102kb
  const LIMITE_WARNING = 80
  const LIMITE_ERROR = 102
  // EXTERNO: kb y los límites viajan en el resultado para que la UI dibuje
  // el medidor sin volver a calcular nada ni repetir los números.
  const numeros = { kb: kbRedondeado, limiteWarning: LIMITE_WARNING, limiteError: LIMITE_ERROR }

  if (kb > LIMITE_ERROR) {
    return {
      ok: false,
      tipo: 'Peso del HTML',
      detalle: `El HTML pesa ${kbRedondeado}kb — supera el límite recomendado de 102kb. Algunos clientes de email pueden bloquearlo o recortarlo.`,
      ...numeros,
    }
  }

  if (kb > LIMITE_WARNING) {
    return {
      ok: false,
      tipo: 'Peso del HTML',
      detalle: `El HTML pesa ${kbRedondeado}kb — está cerca del límite de 102kb. Revisá si hay código innecesario.`,
      advertencia: true,
      ...numeros,
    }
  }

  return {
    ok: true,
    tipo: 'Peso del HTML',
    detalle: `El HTML pesa ${kbRedondeado}kb — dentro del límite recomendado`,
    ...numeros,
  }
}
