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

    const textoPareceTelefono = /^[\d\s\+\-\(\)]+$/.test(texto) && texto.replace(/\D/g, '').length >= 7
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

function DetectarTagsMalCerrados(htmlString) {
  const problemas = []
  
  // Eliminar bloques condicionales de Outlook antes de contar tags
  const htmlSinOutlook = htmlString
  .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '')
  .replace(/<\*[^*]*\*>/g, 'VARIABLE_PERSONALIZACION')

  const tags = ['table', 'tbody', 'tr', 'td', 'th', 'div', 'p', 'span', 'a', 'strong', 'em', 'b', 'i']

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

export function ValidarEstructuraHTML(doc, htmlString) {
  const problemas = []

  // Agregar al inicio
  const tagsMalCerrados = DetectarTagsMalCerrados(htmlString)
  problemas.push(...tagsMalCerrados)

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


