import { extraerImagenes } from '@/lib/revision/helpers.js'
import { REVISION_CONFIG } from '@/lib/revision/config.js'
const DOMINIO_APROBADO = REVISION_CONFIG.DOMINIO_IMAGENES_APROBADO

export function ValidarDominioImagenes(doc) {
  const todasLasImagenes = extraerImagenes(doc)
  const imagenesErroneas = todasLasImagenes.filter(src => !src.startsWith(DOMINIO_APROBADO))

  if (imagenesErroneas.length > 0) {
    return {
      ok: false,
      tipo: 'Dominio de imágenes',
      detalle: `${imagenesErroneas.length} de ${todasLasImagenes.length} imágenes usan un dominio no aprobado`,
      checks: imagenesErroneas.map(src => ({ ok: false, detalle: src.split('/').pop() })),
    }
  }

  return {
    ok: true,
    tipo: 'Dominio de imágenes',
    detalle: `Todas las imágenes (${todasLasImagenes.length}) usan el dominio correcto`,
    checks: [],
  }
}


export function ValidarClasesDefinidas(doc) {
  // Extraer clases definidas en el <style>
  const estilos = [...doc.querySelectorAll('style')]
    .map(s => s.textContent)
    .join(' ')

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

  // Buscar clases usadas que no están definidas
  const clasesHuerfanas = [...clasesUsadas].filter(c => !clasesDefinidas.has(c))

  if (clasesHuerfanas.length > 0) {
    return {
      ok: false,
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

//Validaciones apuntadas al Legal
export function ValidarLegal(doc) {
  const TEXTO_IDENTIFICADOR = 'El titular de los datos personales tiene la facultad de ejercer'
  const CLASE_LEGAL = 'Texto_Legales'
  const STYLES_REQUERIDOS = {
    'font-family': 'Arial, Helvetica, Open Sans, sans-serif',
    'font-size': '14px',
    'font-weight': 'bold',
    'line-height': '16px',
    'color': '#333333',
    'text-align': 'justify',
    'word-break': 'break-word',
    'overflow-wrap': 'anywhere',
    'word-wrap': 'break-word',
  }

  // 1. Verificar que existe el legal por texto
  const todosLosTd = [...doc.querySelectorAll('td')]
  const tdConTexto = todosLosTd
    .filter(td => td.textContent.replace(/\s+/g, ' ').trim().includes(TEXTO_IDENTIFICADOR))
    .sort((a, b) => a.textContent.length - b.textContent.length)[0]

  if (!tdConTexto) {
    return {
      ok: false,
      tipo: 'Legal',
      detalle: 'No se encontró la sección de legales en el email',
      checks: [],
    }
  }

  const checks = []

  // 2. Verificar clase — busca entre todos los td con la clase si alguno tiene el texto
  const tdConClaseYTexto = [...doc.querySelectorAll(`.${CLASE_LEGAL}`)]
    .find(td => td.textContent.replace(/\s+/g, ' ').trim().includes(TEXTO_IDENTIFICADOR))

  const tieneClase = !!tdConClaseYTexto

  if (!tieneClase) {
    checks.push({ ok: false, detalle: `El contenedor del legal no tiene la clase "${CLASE_LEGAL}"` })
  } else {
    checks.push({ ok: true, detalle: `Clase "${CLASE_LEGAL}" presente` })
  }

  // 3. Verificar style inline
  const elementoARevisar = tdConClaseYTexto || tdConTexto
  const styleInline = elementoARevisar.getAttribute('style') || ''
  const stylesFaltantes = []

  Object.entries(STYLES_REQUERIDOS).forEach(([prop, valor]) => {
    const regex = new RegExp(`${prop}\\s*:\\s*${valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    if (!regex.test(styleInline)) {
      stylesFaltantes.push(`${prop}: ${valor}`)
    }
  })

  if (stylesFaltantes.length > 0) {
    checks.push({ ok: false, detalle: `Style inline incompleto, faltan: ${stylesFaltantes.join(' | ')}` })
  } else {
    checks.push({ ok: true, detalle: 'Style inline correcto' })
  }

  // 4. Verificar clase mobile en el style
  const estilos = [...doc.querySelectorAll('style')].map(s => s.textContent).join(' ')
  const regexMedia = /@media[^{]*max-width\s*:\s*(\d+)px[^{]*\{([^@]*)\}/g
  let mediaContent = ''
  let m
  while ((m = regexMedia.exec(estilos)) !== null) {
    if (parseInt(m[1]) <= 600) {
      mediaContent += m[2]
    }
  }

  const tieneFs = /\.Texto_Legales[^{]*\{[^}]*font-size\s*:\s*18px\s*!important/i.test(mediaContent)
  const tieneLh = /\.Texto_Legales[^{]*\{[^}]*line-height\s*:\s*22px\s*!important/i.test(mediaContent)

  if (!tieneFs || !tieneLh) {
    const faltanMobile = []
    if (!tieneFs) faltanMobile.push('font-size: 18px !important')
    if (!tieneLh) faltanMobile.push('line-height: 22px !important')
    checks.push({ ok: false, detalle: `Clase mobile incorrecta, faltan: ${faltanMobile.join(' | ')}` })
  } else {
    checks.push({ ok: true, detalle: 'Clase mobile correcta' })
  }

  const todosOk = checks.every(c => c.ok)

  return {
    ok: todosOk,
    tipo: 'Legal',
    detalle: todosOk ? 'Sección de legales correcta' : 'La sección de legales tiene problemas',
    checks,
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

    // 1. href vacío — aplica a todos
    if (!href) {
      const label = soloImagen ? 'Link de imagen' : `Link "${texto}"`
      problemas.push({ detalle: `${label} tiene el href vacío` })
      return
    }

    // Si solo tiene imagen, solo validamos que tenga href — ya lo chequeamos arriba
    if (soloImagen) return

    // Verificar target="_blank" en todos los links
    if (link.getAttribute('target') !== '_blank') {
      const label = soloImagen ? 'Link de imagen' : `Link "${texto}"`
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
    const nombre = src.split('/').pop() || 'imagen sin src'
    
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
    return {
      ok: false,
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

function DetectarEstructurasOutlook(htmlString) {
  const problemas = []

  const aperturas = (htmlString.match(/<!--\[if[^\]]*\]>/gi) || []).length
  const cierres = (htmlString.match(/<!\[endif\]-->/gi) || []).length

  if (aperturas === 0) {
    problemas.push({ detalle: 'No se encontraron estructuras condicionales de Outlook' })
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

  const cantidadStyle = (sinStyleDePlataforma.match(/<style/gi) || []).length
  if (cantidadStyle > 1) {
    problemas.push({
      detalle: `El documento tiene ${cantidadStyle} bloques <style> propios de la pieza (sin contar el de VML de la plataforma) — lo normal es uno solo; puede indicar que el <head> de la pieza quedó pegado más de una vez`,
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

  // Verificar links con href vacío o solo #
  const links = [...doc.querySelectorAll('a')]
  links.forEach(link => {
    const href = (link.getAttribute('href') || '').trim()
    if (href === '#' || href === '') {
      const texto = link.textContent.trim() || 'sin texto'
      problemas.push({ detalle: `Link "${texto}" tiene href vacío o solo "#"` })
    }
  })

  if (problemas.length > 0) {
    return {
      ok: false,
      tipo: 'Estructura HTML',
      detalle: `${problemas.length} problema${problemas.length > 1 ? 's' : ''} de estructura encontrado${problemas.length > 1 ? 's' : ''}`,
      checks: problemas.map(p => ({ ok: false, detalle: p.detalle })),
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

  if (kb > LIMITE_ERROR) {
    return {
      ok: false,
      tipo: 'Peso del HTML',
      detalle: `El HTML pesa ${kbRedondeado}kb — supera el límite recomendado de 102kb. Algunos clientes de email pueden bloquearlo o recortarlo.`,
    }
  }

  if (kb > LIMITE_WARNING) {
    return {
      ok: false,
      tipo: 'Peso del HTML',
      detalle: `El HTML pesa ${kbRedondeado}kb — está cerca del límite de 102kb. Revisá si hay código innecesario.`,
      advertencia: true,
    }
  }

  return {
    ok: true,
    tipo: 'Peso del HTML',
    detalle: `El HTML pesa ${kbRedondeado}kb — dentro del límite recomendado`,
  }
}

// Detecta fragmentos de HTML "roto" pegados como TEXTO VISIBLE en un
// campo editable (legal, bullet, texto de bloque, etc.) — típico
// accidente: alguien copia el outerHTML de un <a> desde el inspector
// del navegador (o de otra fuente) y lo pega en un campo de texto en
// vez de en el código fuente de un bloque. El RichEditor SIEMPRE
// inserta lo pegado como texto plano (nunca lo interpreta como HTML
// real — ver onPaste en EditorPiezas.jsx), así que el < / > literal
// que traía ese fragmento queda escapado a &lt; / &gt; al serializar
// — la pieza exportada NO se rompe estructuralmente por esto
// (confirmado: tablas balanceadas, se puede reimportar sin problema),
// pero el destinatario del mail ve ese fragmento crudo como texto
// ilegible en pantalla.
//
// Señal usada: un &lt;/&gt; ESCAPADO (evidencia de que alguien tipeó o
// pegó un < / > literal como texto — algo que casi nunca ocurre en
// legales/textos reales, salvo alguna comparación numérica suelta
// tipo "tasa > 5%") que aparece cerca de al menos un par
// atributo="valor" (href=, style=, target=, src=, class=, data-*,
// alt=, title=, width=, height=).
//
// Bug real encontrado (pieza real de ICBC/UCEMA, agosto 2026): un
// <img alt="&gt;"> legítimo — el diseñador describe en el alt el
// carácter ">" de un ícono de bullet tipo flecha, algo perfectamente
// válido — disparaba un falso positivo, porque los OTROS atributos
// Detecta fragmentos de HTML "roto" pegados como TEXTO VISIBLE en un
// campo editable (legal, bullet, texto de bloque, etc.) — típico
// accidente: alguien copia el outerHTML de un <a> desde el inspector
// del navegador (o de otra fuente) y lo pega en un campo de texto en
// vez de en el código fuente de un bloque. El RichEditor SIEMPRE
// inserta lo pegado como texto plano (nunca lo interpreta como HTML
// real — ver onPaste en EditorPiezas.jsx), así que si el fragmento
// pegado incluía el `>` de cierre del tag, ese carácter queda escapado
// a &gt; al serializar — la pieza exportada NO se rompe
// estructuralmente por esto (confirmado: tablas balanceadas, se puede
// reimportar sin problema), pero el destinatario del mail ve ese
// fragmento crudo como texto ilegible en pantalla.
//
// Dos señales independientes (cualquiera de las dos alcanza):
//
// SEÑAL A — un &lt;/&gt; ESCAPADO (evidencia de que alguien tipeó o
// pegó un < / > literal como texto) cerca de al menos un par
// atributo="valor". Cubre el caso donde el fragmento SÍ incluye el
// cierre del tag.
//
// SEÑAL B — 2 o más pares atributo="valor" (href=, style=, target=,
// data-*, etc.) en el MISMO segmento de texto visible, sin necesidad
// de ningún < / > cerca. Bug real reportado: un fragmento cortado
// ANTES del cierre del tag (ej. "...target=\"_blank\"" sin el `>`
// final) nunca genera ninguna entidad escapada — no hay ningún < / >
// de por medio para que el navegador escape — así que la Señal A sola
// no alcanza. En contenido visible real (legales, bullets, textos de
// marketing) nadie escribe dos o más pares "atributo=\"valor\""
// seguidos como prosa — es indicio sólido de un tag real cortado, con
// o sin su `>` final.
//
// Ambas señales corren SOLO sobre segmentos de TEXTO (el contenido
// que hay ENTRE tags reales), nunca dentro de un segmento de TAG
// (adentro de un <...> real, con sus atributos) — separar esto es lo
// que evita el falso positivo real ya encontrado: un <img alt="&gt;">
// legítimo (describe el carácter ">" de un ícono de flecha) tiene esa
// entidad DENTRO del atributo de un tag real, rodeada de los OTROS
// atributos de ESE MISMO tag (src=, style=, width=...) — sin esta
// separación, cualquiera de las dos señales dispararía ahí también,
// aunque nunca hubo texto pegado de por medio.
export function DetectarFragmentoHtmlCrudoEnTexto(htmlString) {
  const problemas = []
  const REGEX_ATRIBUTO = /\b(?:href|style|target|src|class|alt|title|width|height|data-[\w-]+)\s*=\s*"[^"]*"/i
  const REGEX_ATRIBUTO_GLOBAL = /\b(?:href|style|target|src|class|alt|title|width|height|data-[\w-]+)\s*=\s*"[^"]*"/gi
  const regexEntidad = /&(?:lt|gt);/gi
  const clavesYaReportadas = new Set()

  function agregar(posicionAbsoluta, ventana) {
    // Agrupar hallazgos cercanos (ej. un mismo tag con < y > ambos
    // escapados, o la Señal A y B disparando sobre el mismo
    // fragmento) en un solo aviso, en vez de uno por cada match.
    const clave = Math.floor(posicionAbsoluta / 200)
    if (clavesYaReportadas.has(clave)) return
    clavesYaReportadas.add(clave)
    // snippet aparte del detalle: lo usa la UI (aviso en vivo del
    // RichEditor y el modal previo a exportar/copiar) para mostrar
    // EXACTAMENTE el fragmento sospechoso, y así sea fácil de
    // ubicar en el campo real en vez de tener que adivinar cuál es.
    const snippet = ventana.replace(/\s+/g, ' ').trim().slice(-260)
    problemas.push({
      detalle: `Posible fragmento de HTML pegado como texto visible (no como código): "…${snippet}"`,
      snippet,
    })
  }

  const regexTag = /<[^>]*>/g
  const segmentosDeTexto = []
  let ultimoFin = 0
  let mTag
  while ((mTag = regexTag.exec(htmlString)) !== null) {
    segmentosDeTexto.push({ texto: htmlString.slice(ultimoFin, mTag.index), offset: ultimoFin })
    ultimoFin = mTag.index + mTag[0].length
  }
  segmentosDeTexto.push({ texto: htmlString.slice(ultimoFin), offset: ultimoFin })

  segmentosDeTexto.forEach(({ texto, offset }) => {
    // Señal A
    const regexEntidadLocal = new RegExp(regexEntidad.source, regexEntidad.flags)
    let m
    while ((m = regexEntidadLocal.exec(texto)) !== null) {
      const inicioVentana = Math.max(0, m.index - 220)
      const finVentana = Math.min(texto.length, m.index + 80)
      const ventana = texto.slice(inicioVentana, finVentana)
      if (REGEX_ATRIBUTO.test(ventana)) agregar(offset + m.index, ventana)
    }

    // Señal B
    const matchesAtributo = [...texto.matchAll(REGEX_ATRIBUTO_GLOBAL)]
    if (matchesAtributo.length >= 2) {
      const primero = matchesAtributo[0]
      const ultimo = matchesAtributo[matchesAtributo.length - 1]
      const inicioVentana = Math.max(0, primero.index - 40)
      const finVentana = Math.min(texto.length, ultimo.index + ultimo[0].length + 40)
      const ventana = texto.slice(inicioVentana, finVentana)
      agregar(offset + primero.index, ventana)
    }
  })

  return problemas
}

export function ValidarEstructurasObsoletas(doc) {
  // Detecta el patrón de layout de dos columnas con <div inline-block>
  // que era la técnica vieja antes de la estructura class="top"/"bottom"
  // actual. El indicador inequívoco: un <div> con display:inline-block
  // en el área de contenido (no en <style>). Los templates modernos
  // usan display:inline-block solo en <img>, nunca en <div>.
  const divsInlineBlock = [...doc.querySelectorAll('div')].filter(div => {
    const style = div.getAttribute('style') || ''
    return /display\s*:\s*inline-block/i.test(style)
  })

  if (divsInlineBlock.length === 0) {
    return {
      ok: true,
      tipo: 'Estructuras obsoletas',
      detalle: 'No se encontraron estructuras de layout obsoletas',
      checks: [],
    }
  }

  return {
    ok: false,
    tipo: 'Estructuras obsoletas',
    detalle: `Se encontró${divsInlineBlock.length > 1 ? 'ron' : ''} ${divsInlineBlock.length} bloque${divsInlineBlock.length > 1 ? 's' : ''} con layout obsoleto (<div inline-block>) — reemplazalos por la estructura actual con class="top"/"bottom"`,
    checks: divsInlineBlock.map(div => {
      const img = div.querySelector('img')
      const nombre = img ? (img.getAttribute('src') || '').split('/').pop() : 'bloque sin imagen'
      return { ok: false, detalle: `Bloque obsoleto con: ${nombre}` }
    }),
  }
}


