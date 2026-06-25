import { useState, useRef, useEffect } from 'react'
import { GripVertical, Trash2, Eye, Download, X, Code, Lock, Image, FileText, Layout, ChevronDown, Check, Type, Underline, RotateCcw, Plus, Loader2 } from 'lucide-react'
import '@/styles/EditorPiezas.css'

// ─── Estilos del email — EXACTOS al canvas entregado ───────────────────────
const CANVAS_STYLES = `<style type="text/css"><!--
body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
table { table-layout: fixed; margin: 0 auto; border: none; }
table table { table-layout: auto; margin: 0 auto; border: none; }
img { -ms-interpolation-mode: bicubic; }
img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
table { border-collapse: collapse !important; }
body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
div { font-size: 0px; }
a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
.IconoRedes { max-width: 28px !important; width: 28px !important; }
.m-show { display: none; max-height: none; overflow: hidden; }
.Ocultar_Desktop { display: none; visibility: hidden; max-height: 0; height: 0; overflow: hidden; line-height: 0; mso-hide: all; }
.PosicionFoot { padding-left: 0px !important; padding-right: 0px !important; }
@media screen and (max-width: 600px) {
  .max-w { max-width: 400px !important; }
  .IconoRedes { max-width: 20px !important; width: 20px !important; }
  .mobile-hide { display: none !important; }
  .mobile-height { height: 140px !important; }
  .img-max { width: 100% !important; max-width: 100% !important; height: auto !important; }
  .img-max-product { width: 50% !important; max-width: 50% !important; height: auto !important; }
  .img-max-Logo { width: 85% !important; max-width: 85% !important; height: auto !important; }
  .max-width { max-width: 100% !important; }
  .mobile-wrapper { width: 85% !important; max-width: 85% !important; }
  .mobile-wrapper-caja_02 { width: 65% !important; max-width: 65% !important; }
  .mobile-padding { padding-left: 5% !important; padding-right: 5% !important; }
  .MaxWidthLineaProd { max-width: 265px; }
  .m-show { display: block !important; max-height: none !important; overflow: visible !important; }
  .Ocultar_Desktop { display: block !important; visibility: visible !important; max-height: none !important; height: auto !important; line-height: normal !important; overflow: visible !important; }
  .PosicionFoot { padding-left: 35px !important; padding-right: 35px !important; }
  .top { display: table-header-group !important; width: 100% !important; }
  .bottom { display: table-footer-group !important; width: 100% !important; }
  .Texto_Legales { font-size: 18px !important; line-height: 22px !important; }
  .ahorroCenter { width: 265px !important; }
}
@media screen and (max-width: 480px) { .IconoRedes { max-width: 14px !important; width: 14px !important; } }
div[style*='margin: 16px 0;'] { margin: 0 !important; }
--></style>`

const LEGAL_FIJO_HTML = `El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a 6 meses, salvo que acredite un interés legítimo al efecto conforme lo establecido en el art. 14 inc. 3 de la ley 25.326. La agencia de acceso a la información pública, en su carácter de órgano de control de la ley 25.326 tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales. Para contactar a la misma: Av. Pte. Gral. Julio A. Roca 710, piso 2 - C1067ABP – CABA / Tel.: +54 (11) 3988-3968 <a style="color: #333333; text-decoration: underline;" target="_blank" href="https://www.argentina.gob.ar/aaip/datospersonales">https://www.argentina.gob.ar/aaip/datospersonales</a> - <a style="color: #333333; text-decoration: underline;" target="_blank" href="mailto:datospersonales@aaip.gob.ar">datospersonales@aaip.gob.ar</a>. Nuestra política de envío de correo electrónico no incluye la solicitud de ningún tipo de información por este medio de comunicación, es por tal motivo que, ante la llegada de una comunicación que le parezca no habitual, le recomendamos no responder ni ingresar en el mismo datos personales y/o claves de acceso y/o información de sus productos, por favor, háganos llegar la misma a la siguiente dirección de correo: <a style="color: #333333; text-decoration: underline;" target="_blank" href="mailto:seguridadinternet@icbc.com.ar">seguridadinternet@icbc.com.ar</a> o contáctenos al 0810-555-9200 de lunes a viernes de 8 a 20 horas o, sábados, domingos y feriados de 10 a 18 horas, o bien desde el exterior, al (54-11) 4820-9200. Los links adjuntos en esta pieza remiten únicamente a páginas de publicidad. Industrial and Commercial Bank of China (Argentina) S.A.U. es una Sociedad Anónima Unipersonal bajo la Ley Argentina. Su accionista limita su responsabilidad al capital aportado. Florida 99, CABA, CUIT 30709447846.`

// ─── Bloques ────────────────────────────────────────────────────────────────
// IMPORTANTE: { as: 'raw' } es la sintaxis VIEJA de import.meta.glob,
// removida en Vite 5+. Este proyecto usa Vite 8 (ver package.json) —
// con la sintaxis vieja, Vite cae al comportamiento default del glob
// (importar el módulo completo, no el string crudo), y cada entrada de
// BLOQUES_RAW termina siendo un objeto Module en vez de un string. Eso
// explica el bug real visto en producción: el HTML del bloque se
// mostraba como el texto literal "[object Module]" en vez de su
// contenido — pasaba solo en Vercel (que reinstala node_modules según
// package.json, trayendo Vite 8 real) y no en local, donde
// probablemente había quedado una instalación vieja de Vite que sí
// soportaba la sintaxis deprecada sin avisar con un error.
const BLOQUES_RAW = import.meta.glob(
  '/src/data/Templates/ICBC/{Header,Contenido,Botones}/*.html',
  { query: '?raw', import: 'default', eager: true }
)
const BLOQUES = Object.entries(BLOQUES_RAW).map(([path, html]) => {
  const partes = path.split('/')
  const categoria = partes[partes.length - 2]
  const slug = partes[partes.length - 1].replace('.html', '')
  const nombre = slug.replace(/_/g, ' ')
  return { id: path, categoria, nombre, slug, html }
}).sort((a, b) => a.nombre.localeCompare(b.nombre))

const BLOQUES_HEADER = BLOQUES.filter(b => b.categoria === 'Header')
const BLOQUES_CONTENIDO = BLOQUES.filter(b => b.categoria !== 'Header')
const BLOQUE_ESPACIADOR = BLOQUES.find(b => b.slug === 'Espaciador')

// ─── Manipulación de HTML como STRING PURO ─────────────────────────────────
// NUNCA se usa DOMParser para serializar — contamina el HTML con estilos
// computados del browser. Solo se manipula como string.

// Limpia el HTML del RichEditor: quita divs basura, normaliza spans
function limpiarHtmlEditor(html) {
  return html
    // Reemplazar <div><br></div> y variantes por <br>
    .replace(/<div[^>]*>\s*<br\s*\/?>\s*<\/div>/gi, '<br>')
    // Reemplazar <div> por <br> (contenteditable genera divs en enter)
    .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1<br>')
    // Limpiar <br> al final
    .replace(/<br\s*\/?>$/i, '')
    // Quitar spans vacíos
    .replace(/<span[^>]*>\s*<\/span>/gi, '')
    // Normalizar colores RGB a hex
    .replace(/rgb\(51,\s*51,\s*51\)/gi, '#333333')
    .replace(/rgb\(196,\s*22,\s*28\)/gi, '#c4161c')
    .replace(/rgb\(255,\s*255,\s*255\)/gi, '#ffffff')
    // Sacar comillas de tipografías
    .replace(/["']Open Sans["']/g, 'Open Sans')
    .replace(/["']Arial["']/g, 'Arial')
    .replace(/["']Helvetica["']/g, 'Helvetica')
    .replace(/["']Times New Roman["']/g, 'Times New Roman')
    // Sacar background-color de spans que vienen de paste
    .replace(/background-color:\s*#ffffff;?\s*/gi, '')
    .replace(/background-color:\s*rgb\(255,\s*255,\s*255\);?\s*/gi, '')
    // font-weight: 700 → font-weight: bold
    .replace(/font-weight:\s*700/gi, 'font-weight: bold')
    // Eliminar text-align de spans (hereda del td)
    .replace(/text-align:\s*[^;]+;?\s*/gi, '')
    // Eliminar font-family de spans (hereda del td)
    .replace(/font-family:[^;]+;?\s*/gi, '')
    // Eliminar font-size de spans (hereda del td, salvo sup)
    // .replace(/font-size:\s*\d+px;?\s*/gi, '')  // no tocar, puede estar bien
    // Eliminar color de spans que sea el mismo que el td
    .trim()
}

// Limpiar el HTML exportado final: normalizar tipografías y colores
function limpiarHtmlExport(html) {
  return html
    .replace(/["']Open Sans["']/g, 'Open Sans')
    .replace(/rgb\(51,\s*51,\s*51\)/gi, '#333333')
    .replace(/rgb\(196,\s*22,\s*28\)/gi, '#c4161c')
    .replace(/rgb\(255,\s*255,\s*255\)/gi, '#ffffff')
}

// Detección de campos usando regex sobre el string HTML — sin DOMParser
function detectarCampos(html) {
  const campos = []
  const SOCIALES = ['twitter.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'icbcargentina', 'icbc.argentina']

  // Textos en <td>: extraer innerHTML de cada td que tenga texto visible.
  // posicionReal = posición entre TODOS los <td> del HTML (sin filtrar
  // por contenido) — a diferencia de idx (que solo cuenta los <td> que
  // pasan el filtro de "tiene texto real"), posicionReal es estable
  // incluso si el usuario vacía el campo por completo después. Se usa
  // para volver a encontrar la celda correcta en actualizarCampoEnHtml
  // y para extraer el valor actual al re-renderizar el panel, sin
  // depender de cuánto texto tiene en este momento.
  let textoIdx = 0
  let posicionTd = 0
  const tdRegex = /<td([^>]*)>([\s\S]*?)<\/td>/gi
  let tdMatch
  while ((tdMatch = tdRegex.exec(html)) !== null) {
    const inner = tdMatch[2]
    const posicionReal = posicionTd++
    // Ignorar tds que solo tienen &nbsp; o una tabla anidada (textoLimpio
    // ya excluye automáticamente las celdas que son SOLO una imagen,
    // porque el alt/title son atributos dentro del tag, no contenido de
    // texto, así que quedan fuera del replace de tags). Antes había
    // también un !inner.trim().startsWith('<img') que excluía cualquier
    // celda que EMPEZARA con una imagen — bug real: los bloques de
    // "Bullet" (ícono + texto en la misma celda, ej. Bullet_Titular_Rojo)
    // empiezan con <img> seguido de texto real, y ese chequeo extra los
    // dejaba afuera por completo, mostrando "Sin campos editables"
    // cuando en realidad sí tenían texto para editar.
    const textoLimpio = inner.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()
    if (textoLimpio.length > 2 && !inner.trim().startsWith('<table')) {
      campos.push({ tipo: 'texto', label: `Texto ${textoIdx + 1}`, idx: textoIdx, posicionReal, contenido: inner })
      textoIdx++
    }
  }

  // Imágenes: extraer src, alt, title, width, height. Se excluyen las
  // puramente estructurales (separadores transparentes, líneas
  // punteadas decorativas — mismo patrón que ya se excluye de la
  // validación de proporciones en CampoImagen) porque no son contenido
  // real para editar, son parte fija de la estructura del template.
  // posicionReal = posición entre TODOS los <img> sin filtrar — mismo
  // motivo que en texto: actualizarCampoEnHtml cuenta TODOS los <img>
  // sin excluir nada, así que si acá se filtrara sin avisar el idx
  // quedaría desalineado con la posición real en el HTML.
  let imgIdx = 0
  let posicionImg = 0
  const imgRegex = /<img([^>]*)>/gi
  let imgMatch
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const attrs = imgMatch[1]
    const posicionReal = posicionImg++
    const getAttr = (name) => {
      const m = attrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))
      return m ? m[1] : ''
    }
    const getStyleProp = (prop) => {
      const m = attrs.match(new RegExp(`${prop}:\\s*([\\d.]+)px`, 'i'))
      return m ? m[1] : ''
    }
    const src = getAttr('src')
    if (/img[_-]?separador|lineapunteada/i.test(src)) continue
    campos.push({
      tipo: 'imagen', label: `Imagen ${imgIdx + 1}`, idx: imgIdx, posicionReal,
      src, alt: getAttr('alt'), title: getAttr('title'),
      width: getAttr('width') || getStyleProp('width'),
      height: getAttr('height') || getStyleProp('height'),
    })
    imgIdx++
  }

  // Links no sociales
  let linkIdx = 0
  const linkRegex = /<a([^>]*)>/gi
  let linkMatch
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const hrefMatch = linkMatch[1].match(/href=["']([^"']*)["']/i)
    if (!hrefMatch) continue
    const href = hrefMatch[1]
    if (!SOCIALES.some(s => href.includes(s))) {
      campos.push({ tipo: 'link', label: `Link ${linkIdx + 1}`, idx: linkIdx, valor: href })
      linkIdx++
    }
  }

  return campos
}

// Actualizar un campo específico en el HTML como string puro
function actualizarCampoEnHtml(html, tipo, idx, cambios) {
  if (tipo === 'texto') {
    // idx acá es en realidad la posicionReal (ver detectarCampos) — un
    // contador simple de TODOS los <td> en orden, sin filtrar por
    // contenido. Esto es necesario para que la celda correcta se siga
    // encontrando incluso después de vaciarla por completo: si en vez
    // de esto se filtrara por "tiene texto real" como antes, vaciar un
    // campo de texto cuando hay más de uno en el mismo bloque corría
    // los índices de los campos siguientes, terminando por editar la
    // celda equivocada.
    let count = 0
    return html.replace(/<td([^>]*)>([\s\S]*?)<\/td>/gi, (match, attrs, inner) => {
      if (count++ === idx) return `<td${attrs}>${cambios.contenido}</td>`
      return match
    })
  }
  if (tipo === 'imagen') {
    // Igual que en texto: cuenta TODOS los <img> sin filtrar — quien
    // llama a esta función debe pasar posicionReal (la posición entre
    // TODOS los <img>, sin excluir los estructurales), no el idx
    // filtrado que devuelve detectarCampos.
    let count = 0
    return html.replace(/<img([^>]*)>/gi, (match, attrs) => {
      if (count++ !== idx) return match
      let newAttrs = attrs
      if (cambios.src !== undefined) newAttrs = newAttrs.replace(/src=["'][^"']*["']/i, `src="${cambios.src}"`)
      if (cambios.alt !== undefined) newAttrs = newAttrs.replace(/alt=["'][^"']*["']/i, `alt="${cambios.alt}"`)
      if (cambios.title !== undefined) {
        if (/title=["'][^"']*["']/i.test(newAttrs)) {
          newAttrs = newAttrs.replace(/title=["'][^"']*["']/i, `title="${cambios.title}"`)
        } else {
          newAttrs = newAttrs + ` title="${cambios.title}"`
        }
      }
      if (cambios.width !== undefined) {
        newAttrs = newAttrs.replace(/width=["']\d+["']/i, `width="${cambios.width}"`)
        newAttrs = newAttrs.replace(/(style="[^"]*)(width:\s*\d+px)/i, `$1width: ${cambios.width}px`)
      }
      if (cambios.height !== undefined) {
        newAttrs = newAttrs.replace(/height=["']\d+["']/i, `height="${cambios.height}"`)
        newAttrs = newAttrs.replace(/(style="[^"]*)(height:\s*\d+px)/i, `$1height: ${cambios.height}px`)
      }
      return `<img${newAttrs}>`
    })
  }
  if (tipo === 'link') {
    const SOCIALES = ['twitter.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'icbcargentina', 'icbc.argentina']
    let count = 0
    return html.replace(/<a([^>]*)>/gi, (match, attrs) => {
      const hrefMatch = attrs.match(/href=["']([^"']*)["']/i)
      if (!hrefMatch) return match
      const href = hrefMatch[1]
      if (SOCIALES.some(s => href.includes(s))) return match
      if (count++ !== idx) return match
      const newAttrs = attrs.replace(/href=["'][^"']*["']/i, `href="${cambios.valor}"`)
      return `<a${newAttrs}>`
    })
  }
  return html
}

// ─── Preview wrap ───────────────────────────────────────────────────────────
const PREVIEW_OVERRIDE = `<style>table{table-layout:auto!important;}</style>`

function wrapPreview(html, esHeader = false) {
  const body = esHeader
    ? html
    : `<table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;"><tbody>${html}</tbody></table>`
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${CANVAS_STYLES}${PREVIEW_OVERRIDE}</head><body style="margin:0;padding:0;background:#fff;">${body}</body></html>`
}

// ─── Miniatura visual para la biblioteca ───────────────────────────────────
// En lugar de renderizar el HTML complejo (que se ve raro a tamaño miniatura),
// generamos una miniatura SVG descriptiva basada en el nombre y categoría del bloque.
function generarThumbSVG(bloque) {
  const colores = {
    Header: { bg: '#c4161c', fg: '#ffffff', accent: '#ffffff' },
    Contenido: { bg: '#f5f5f5', fg: '#333333', accent: '#c4161c' },
    Botones: { bg: '#f5f5f5', fg: '#333333', accent: '#c4161c' },
  }
  const { bg, fg, accent } = colores[bloque.categoria] || colores.Contenido

  const esBoton = /btn|boton|button/i.test(bloque.nombre)
  const esBullet = /bullet/i.test(bloque.nombre)
  const esEspaciador = /espaciador|space/i.test(bloque.nombre)
  const esIcono = /icono|icon/i.test(bloque.nombre)

  let contenido = ''

  // Thumbs específicos por slug
  if (bloque.slug === 'CG_Banda_Roja_Header') {
    // 4 círculos blancos (redes) + línea de texto simulada
    contenido = `
      <circle cx="30" cy="40" r="9" fill="white" opacity="0.9"/>
      <circle cx="55" cy="40" r="9" fill="white" opacity="0.9"/>
      <circle cx="80" cy="40" r="9" fill="white" opacity="0.9"/>
      <circle cx="105" cy="40" r="9" fill="white" opacity="0.9"/>
      <rect x="140" y="30" width="50" height="8" rx="2" fill="white" opacity="0.7"/>
      <rect x="140" y="44" width="35" height="6" rx="2" fill="white" opacity="0.4"/>`
  } else if (bloque.slug === 'Modulo_Doble_Con_Imagen_Punteada') {
    contenido = `
      <rect x="10" y="10" width="85" height="60" rx="2" fill="${accent}" opacity="0.85"/>
      <rect x="105" y="10" width="85" height="60" rx="2" fill="${accent}" opacity="0.65"/>
      <line x1="100" y1="10" x2="100" y2="70" stroke="#333333" stroke-width="2" stroke-dasharray="4,3"/>`
  } else if (bloque.slug === 'Modulo_Doble_Clasico') {
    // Mismo concepto que el Punteada (2 módulos lado a lado) pero SIN
    // la línea divisoria — el bloque real no tiene ningún separador
    // entre las dos imágenes, son dos <td> al 50% sin más.
    contenido = `
      <rect x="10" y="10" width="85" height="60" rx="2" fill="${accent}" opacity="0.85"/>
      <rect x="105" y="10" width="85" height="60" rx="2" fill="${accent}" opacity="0.85"/>`
  } else if (bloque.slug === 'Destacado_Topes_Promo') {
    contenido = `
      <rect x="10" y="10" width="180" height="60" rx="3" fill="none" stroke="#c4161c" stroke-width="2"/>
      <rect x="20" y="22" width="120" height="8" rx="2" fill="${fg}" opacity="0.5"/>
      <rect x="20" y="36" width="100" height="6" rx="2" fill="${fg}" opacity="0.3"/>
      <rect x="20" y="48" width="80" height="6" rx="2" fill="#c4161c" opacity="0.5"/>`
  } else if (bloque.slug === 'Destacado_GiftCard_BigBox') {
    // Imagen a la izq, texto a la der, todo con borde rojo — invertido al Topes_Promo
    contenido = `
      <rect x="10" y="10" width="180" height="60" rx="3" fill="none" stroke="#c4161c" stroke-width="2"/>
      <rect x="18" y="18" width="55" height="44" rx="2" fill="#c4161c" opacity="0.2"/>
      <rect x="82" y="22" width="100" height="8" rx="2" fill="${fg}" opacity="0.5"/>
      <rect x="82" y="36" width="80" height="6" rx="2" fill="${fg}" opacity="0.3"/>
      <rect x="82" y="48" width="60" height="6" rx="2" fill="#c4161c" opacity="0.5"/>`
  } else if (esEspaciador) {
    contenido = `<line x1="10" y1="40" x2="190" y2="40" stroke="${accent}" stroke-width="2" stroke-dasharray="4,3"/><text x="100" y="55" text-anchor="middle" fill="${fg}" font-size="10" font-family="Arial">ESPACIADOR</text>`
  } else if (esBoton) {
    contenido = `<rect x="50" y="25" width="100" height="28" rx="4" fill="${accent}"/><text x="100" y="44" text-anchor="middle" fill="#fff" font-size="11" font-family="Arial" font-weight="bold">BOTÓN</text>`
  } else if (esBullet) {
    const color = /rojo|red/i.test(bloque.nombre) ? '#c4161c' : '#333333'
    contenido = `
      <circle cx="20" cy="28" r="4" fill="${color}"/>
      <rect x="32" y="24" width="120" height="8" rx="2" fill="${fg}" opacity="0.3"/>
      <circle cx="20" cy="45" r="4" fill="${color}"/>
      <rect x="32" y="41" width="100" height="8" rx="2" fill="${fg}" opacity="0.3"/>
      <circle cx="20" cy="62" r="4" fill="${color}"/>
      <rect x="32" y="58" width="110" height="8" rx="2" fill="${fg}" opacity="0.3"/>`
  } else if (esIcono) {
    contenido = `
      <rect x="10" y="20" width="40" height="40" rx="4" fill="${accent}" opacity="0.2"/>
      <rect x="60" y="25" width="130" height="8" rx="2" fill="${fg}" opacity="0.4"/>
      <rect x="60" y="40" width="100" height="6" rx="2" fill="${fg}" opacity="0.25"/>
      <rect x="60" y="53" width="115" height="6" rx="2" fill="${fg}" opacity="0.25"/>`
  } else {
    contenido = `
      <rect x="10" y="18" width="180" height="8" rx="2" fill="${fg}" opacity="0.4"/>
      <rect x="10" y="32" width="160" height="6" rx="2" fill="${fg}" opacity="0.25"/>
      <rect x="10" y="44" width="170" height="6" rx="2" fill="${fg}" opacity="0.25"/>
      <rect x="10" y="56" width="120" height="6" rx="2" fill="${fg}" opacity="0.25"/>`
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><rect width="200" height="80" fill="${bg}"/>${contenido}</svg>`)}`
}

// ─── Generador de export ────────────────────────────────────────────────────
// Marcadores: cada bloque/zona se envuelve en comentarios HTML
// invisibles (<!--BLOQUE:slug--> ... <!--/BLOQUE-->), mismo estilo que
// ya tenía el HTML original (<!--HEADER: Redes -->) — no son visibles
// en ningún cliente de correo, y permiten que una futura función de
// "leer HTML por link" pueda reconocer e identificar cada sección
// (bloque de contenido, header, imagen principal/footer, legal
// específico, indicadores) sin tener que adivinar por estructura de
// tags. La funcionalidad de lectura en sí no se construye ahora, esto
// es solo dejar el export ya preparado para cuando se construya.
function generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalEspecifico, legalEspecificoActivo, indicadores }) {
  const contenidoRows = canvas.map(b => {
    const slug = b.slug || b.id || 'bloque'
    const html = limpiarHtmlExport(b.htmlEditado || b.html)
    return `<!--BLOQUE:${slug}-->\n${html}\n<!--/BLOQUE-->`
  }).join('\n')

  const imgPrincipalContenido = imgPrincipal.activo && imgPrincipal.src
    ? `<img src="${imgPrincipal.src}" alt="${imgPrincipal.alt || ''}"${imgPrincipal.title ? ` title="${imgPrincipal.title}"` : ''} class="img-max" style="width: 600px; height: 425px; display: block; font-family: Arial,Helvetica,Open Sans,sans-serif; font-size: 22px; color: #c4161c;" width="600" height="425" />`
    : null
  const imgPrincipalHtml = imgPrincipalContenido
    ? `<!--IMG_PRINCIPAL-->\n<tr>\n<td style="font-size: 0; padding: 0; margin: 0;" valign="top" align="center">${imgPrincipal.link ? `<a href="${imgPrincipal.link}" target="_blank" style="border-style: none !important;">${imgPrincipalContenido}</a>` : imgPrincipalContenido}</td>\n</tr>\n<!--/IMG_PRINCIPAL-->`
    : ''

  const imgFooterHtml = imgFooter.activo && imgFooter.src
    ? `<!--IMG_FOOTER-->\n<tr>\n<td colspan="3" style="font-size: 0;" valign="middle" align="center"><a href="${imgFooter.link || '#'}" target="_blank"><img src="${imgFooter.src}" alt="${imgFooter.alt || ''}" class="img-max" width="600" border="0" /></a></td>\n</tr>\n<!--/IMG_FOOTER-->`
    : ''

  // El legal específico se concatena dentro de la MISMA celda que el
  // legal fijo, como texto corrido — un comentario HTML suelto ahí en
  // medio (<!--LEGAL_ESPECIFICO-->texto<!--/LEGAL_ESPECIFICO-->) es
  // distinto a los demás marcadores: esos rodean filas de tabla
  // (<tr>/<td>) ya cerradas, mientras que este quedaría flotando en
  // medio de párrafo. Algunos proveedores de correo sanitizan o
  // reescriben agresivamente el HTML y podrían no tratarlo como
  // comentario en ese contexto, dejándolo visible como texto literal
  // en medio del legal — riesgo real que no corren los otros
  // marcadores. Un <span data-legal-especifico> es estructuralmente
  // inequívoco para cualquier parser (es un tag real, no texto suelto)
  // y no se renderiza como contenido visible adicional.
  const legalEspecificoHtml = legalEspecificoActivo && legalEspecifico.trim()
    ? `<span data-legal-especifico="true">${legalHtmlExport(legalEspecifico)}</span> `
    : ''
  const legalContenido = `${legalEspecificoHtml}<span data-legal-fijo="true">${LEGAL_FIJO_HTML}</span>`

  const indicadoresHtml = indicadores.length > 0
    ? `<!--INDICADORES-->\n` + indicadores.map(ind =>
        `<tr>\n<td width="35"></td>\n<td style="font-family: Arial, Helvetica, sans-serif; font-size: 85px; text-align: right; color: #333333; font-weight: bold;"><sup style="font-size: 85px;">${ind.ref}</sup> ${ind.sigla} ${ind.valor}</td>\n<td width="35"></td>\n</tr>`
      ).join('\n') + `\n<tr>\n<td colspan="3" style="height: 28px; font-size: 0px;" height="28">&nbsp;</td>\n</tr>\n<!--/INDICADORES-->`
    : ''

  return `${CANVAS_STYLES}
<!-- INICIO TEXTO OCULTO EN INBOX -->
<div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: Arial, Helvetica, Open Sans, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">El Futuro nos Inspira.</div>
<!-- FIN TEXTO OCULTO EN INBOX --> <!-- INICIO CONTENEDOR -->
<table width="100%" cellspacing="0" cellpadding="0" border="0">
<tbody>
<tr>
<td style="background-color: #ffffff;" bgcolor="#ffffff" align="center"><!--[if (gte mso 9)|(IE)]><table align='center' border='0' cellspacing='0' cellpadding='0' width='600'><tr><td align='center' valign='top' width='600'><![endif]-->
<table style="max-width: 600px; background-color: #ffffff; border: solid 1px #c4161c;" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#c4161c" align="center"><!--HEADER:${bandaHeader?.slug || 'ninguno'}-->
<tbody>
<tr>
<td width="100%" valign="top" bgcolor="#c4161c" align="center"><!--[if (gte mso 9)|(IE)]><table align='center' border='0' cellspacing='0' cellpadding='0' width='600'><tr><td align='center' valign='top' width='600'><![endif]-->
${bandaHeader?.html || ''}
<!--/HEADER--><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td>
</tr>
${imgPrincipalHtml}
<tr>
<td style="background-color: #ffffff;" width="100%" valign="top" bgcolor="#ffffff" align="center">
<table width="100%" cellspacing="0" cellpadding="0" border="0">
<tbody>
<tr>
<td style="width: 530px; font-size: 0; padding: 35px;" width="530"><!--[if (gte mso 9)|(IE)]><table align='center' border='0' cellspacing='0' cellpadding='0' style='width:530px;' width='530px'><tr><td align='center' valign='top' style='width:530px;' width='530px'><![endif]-->
<table style="max-width: 530px;" width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
<tbody>
${contenidoRows}
</tbody>
</table>
<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td>
</tr>
<tr>
<td width="100%" valign="top" height="100%" bgcolor="#ffffff" align="center"><!--[if (gte mso 9)|(IE)]><table align='center' border='0' cellspacing='0' cellpadding='0' width='600'><tr><td align='center' valign='top' width='600'><![endif]-->
<table style="max-width: 600px;" width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
<tbody>
${imgFooterHtml}
<tr>
<td colspan="3" style="height: 28px; font-size: 0px;" height="28">&nbsp;</td>
</tr>
<tr>
<td width="35"></td>
<td class="Texto_Legales" style="font-family: Arial, Helvetica, Open Sans, sans-serif; font-size: 14px; font-weight: bold; line-height: 16px; color: #333333; text-align: justify; word-break: break-word; overflow-wrap: anywhere; word-wrap: break-word;" align="center">${legalContenido}</td>
<td width="35"></td>
</tr>
<tr>
<td colspan="3" style="height: 28px; font-size: 0px;" height="28">&nbsp;</td>
</tr>
${indicadoresHtml}
</tbody>
</table>
<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td>
</tr>
</tbody>
</table>`
}

// Quita el tag que envuelve TODO el contenido — pero solo si
// genuinamente lo envuelve de punta a punta, no cualquier tag que por
// casualidad coincida en nombre al principio y al final. Bug real que
// esto corrige: si el RichEditor aplicó un estilo a todo el texto
// (ej. negrita a todo el párrafo) queda <span>...todo...</span> y ese
// wrapper sí hay que sacarlo (lo pone el contenedor real al exportar).
// Pero la regex vieja (/^<tag>|<\/tag>$/g) no distinguía eso de un
// texto que simplemente TERMINA con un link — ej. "Visitá nuestro
// sitio <a href=...>acá</a>" — y le comía el </a> de cierre pensando
// que era un wrapper externo, dejando el <a> sin cerrar. El </span>
// del contenedor real terminaba cerrando ese <a> huérfano también,
// haciendo que el link "se comiera" más texto del que debía.
// Se valida con balance real de profundidad: el wrapper es válido
// solo si el cierre que vuelve la profundidad de ESE tag a 0 cae
// exactamente en el último carácter del string (no antes, no con más
// texto después).
function quitarWrapperSiEnvuelveTodo(html) {
  const trimmed = html.trim()
  const aperturaMatch = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/)
  if (!aperturaMatch) return trimmed
  const tag = aperturaMatch[1].toLowerCase()
  const reTag = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  let profundidad = 0
  let finDelWrapper = -1
  let m
  while ((m = reTag.exec(trimmed)) !== null) {
    if (m[1] === '/') {
      profundidad--
      if (profundidad === 0) { finDelWrapper = m.index + m[0].length; break }
    } else {
      profundidad++
    }
  }
  if (finDelWrapper === -1 || finDelWrapper !== trimmed.length) return trimmed
  return trimmed.slice(aperturaMatch[0].length, trimmed.length - (tag.length + 3))
}

// Limpia el HTML del legal específico para el export: quita wrappers externos
function legalHtmlExport(html) {
  return quitarWrapperSiEnvuelveTodo(limpiarHtmlExport(html)).trim()
}

// ─── Mini editor rich text ──────────────────────────────────────────────────
function validarUrl(url) {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  if (/^mailto:/i.test(url)) return url
  return `https://${url}`
}

function RichEditor({ value, onChange }) {
  const ref = useRef(null)
  const [showLink, setShowLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkColor, setLinkColor] = useState('#c4161c')
  const savedRange = useRef(null)
  const isInternalChange = useRef(false)

  useEffect(() => {
    if (ref.current && !isInternalChange.current) {
      ref.current.innerHTML = value || ''
    }
    isInternalChange.current = false
  }, [value])

  function guardarRango() {
    const sel = window.getSelection()
    if (sel?.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange()
  }

  function aplicarEstilo(propiedades) {
    ref.current?.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const container = range.commonAncestorContainer
    const spanExistente = (container.nodeType === Node.TEXT_NODE
      ? container.parentElement : container)?.closest?.('span')
    if (spanExistente && range.toString() === spanExistente.textContent) {
      Object.entries(propiedades).forEach(([k, v]) => { spanExistente.style[k] = v })
    } else {
      const span = document.createElement('span')
      Object.entries(propiedades).forEach(([k, v]) => { span.style[k] = v })
      try { range.surroundContents(span) } catch { return }
    }
    isInternalChange.current = true
    onChange(limpiarHtmlEditor(ref.current.innerHTML))
  }

  function aplicarSup() {
    ref.current?.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const sup = document.createElement('sup')
    sup.style.fontSize = '8px'
    try { range.surroundContents(sup) } catch { return }
    isInternalChange.current = true
    onChange(limpiarHtmlEditor(ref.current.innerHTML))
  }

  function aplicarLink() {
    if (!savedRange.current || !linkUrl) { setShowLink(false); return }
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(savedRange.current)
    if (sel?.isCollapsed) { setShowLink(false); return }
    const range = sel.getRangeAt(0)
    const a = document.createElement('a')
    a.href = validarUrl(linkUrl)
    a.target = '_blank'
    a.style.color = linkColor
    a.style.textDecoration = 'underline'
    try { range.surroundContents(a) } catch { return }
    isInternalChange.current = true
    onChange(limpiarHtmlEditor(ref.current.innerHTML))
    setShowLink(false); setLinkUrl('')
  }

  function limpiarTodo() {
    if (ref.current) ref.current.innerHTML = ''
    isInternalChange.current = true
    onChange('&nbsp;')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      document.execCommand('insertLineBreak')
      isInternalChange.current = true
      onChange(limpiarHtmlEditor(ref.current.innerHTML))
    }
  }

  function onPaste(e) {
    e.preventDefault()
    const texto = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, texto)
    isInternalChange.current = true
    onChange(limpiarHtmlEditor(ref.current.innerHTML))
  }

  function onInput() {
    isInternalChange.current = true
    const limpio = limpiarHtmlEditor(ref.current.innerHTML)
    onChange(limpio || '&nbsp;')
  }

  return (
    <div className="ep-rich-wrap">
      <div className="ep-rich-toolbar">
        <button type="button" className="ep-rich-btn ep-rich-btn-b" title="Negrita"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ fontWeight: 'bold' }) }}>B</button>
        <button type="button" className="ep-rich-btn ep-rich-btn-i" title="Cursiva"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ fontStyle: 'italic' }) }}>I</button>
        <button type="button" className="ep-rich-btn" title="Texto normal"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ fontWeight: 'normal', fontStyle: 'normal' }) }}>
          <Type size={12} />
        </button>
        <button type="button" className="ep-rich-btn" title="Superíndice"
          onMouseDown={e => { e.preventDefault(); aplicarSup() }}>
          x<sup style={{ fontSize: 8 }}>2</sup>
        </button>
        <div className="ep-rich-separator" />
        <button type="button" className="ep-rich-btn" title="Subrayado"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ textDecoration: 'underline' }) }}>
          <Underline size={12} />
        </button>
        <button type="button" className="ep-rich-btn" title="Sin subrayado"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ textDecoration: 'none' }) }}>
          <span style={{ textDecoration: 'line-through', fontSize: 11 }}>U</span>
        </button>
        <div className="ep-rich-separator" />
        <button type="button" className="ep-rich-btn" title="Color rojo #c4161c"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ color: '#c4161c' }) }}>
          <span className="ep-color-dot" style={{ background: '#c4161c' }} />
        </button>
        <button type="button" className="ep-rich-btn" title="Color negro #333333"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ color: '#333333' }) }}>
          <span className="ep-color-dot" style={{ background: '#333333' }} />
        </button>
        <div className="ep-rich-separator" />
        <button type="button" className="ep-rich-btn" title="Link"
          onMouseDown={e => { e.preventDefault(); guardarRango(); setShowLink(v => !v) }}>🔗</button>
        <div className="ep-rich-separator" />
        <button type="button" className="ep-rich-btn" title="Limpiar todo el texto"
          onMouseDown={e => { e.preventDefault(); limpiarTodo() }}>
          <Trash2 size={12} />
        </button>
      </div>
      {showLink && (
        <div className="ep-rich-link-popup">
          <input className="ep-rich-link-input" autoComplete="off" placeholder="https://..." value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && aplicarLink()} autoFocus
            autoComplete="off" />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>Color link:</span>
            <button type="button"
              className={`ep-rich-btn ${linkColor === '#c4161c' ? 'active' : ''}`}
              onClick={() => setLinkColor('#c4161c')} title="Rojo">
              <span className="ep-color-dot" style={{ background: '#c4161c' }} />
            </button>
            <button type="button"
              className={`ep-rich-btn ${linkColor === '#333333' ? 'active' : ''}`}
              onClick={() => setLinkColor('#333333')} title="Negro">
              <span className="ep-color-dot" style={{ background: '#333333' }} />
            </button>
            <button type="button" className="ep-rich-link-ok" onClick={aplicarLink}>OK</button>
          </div>
        </div>
      )}
      <div ref={ref} className="ep-rich-content" contentEditable suppressContentEditableWarning
        onInput={onInput} onKeyDown={onKeyDown} onPaste={onPaste} />
    </div>
  )
}

// ─── Campo de imagen con alerta de dimensiones ──────────────────────────────
function CampoImagen({ campo, onActualizar, onReset }) {
  const [srcLocal, setSrcLocal] = useState(campo.src)
  const [altLocal, setAltLocal] = useState(campo.alt)
  const [titleLocal, setTitleLocal] = useState(campo.title)
  const [widthLocal, setWidthLocal] = useState(campo.width)
  const [heightLocal, setHeightLocal] = useState(campo.height)
  const [dimAlert, setDimAlert] = useState(null)

  const origW = parseInt(campo.width) || 0
  const origH = parseInt(campo.height) || 0
  // Solo mostrar inputs de dimensiones si la alerta está activa
  const mostrarDims = !!dimAlert

  function commit(overrides = {}) {
    onActualizar({ src: srcLocal, alt: altLocal, title: titleLocal, width: widthLocal, height: heightLocal, ...overrides })
  }

  function onSrcBlur(nuevoSrc) {
    setSrcLocal(nuevoSrc)
    // Imágenes puramente estructurales — "separador" (Img_Separador_*)
    // y "línea punteada" (MediaLineaPunteada*, la línea divisoria del
    // Módulo Doble Con Imagen Punteada, visible solo en mobile) son
    // píxeles transparentes usados para forzar espacios o decoración
    // de layout, no contenido real — su aspect ratio no tiene ningún
    // significado visual, así que no tiene sentido alertar por una
    // "desproporción" que en los hechos no se ve. Se detecta por el
    // nombre de archivo en la URL, no por el contenido real de la
    // imagen.
    const esEstructural = /img[_-]?separador|lineapunteada/i.test(nuevoSrc)
    if (!nuevoSrc || !origW || !origH || esEstructural) { commit({ src: nuevoSrc }); return }
    const img = new window.Image()
    img.onload = () => {
      if (img.naturalWidth !== origW || img.naturalHeight !== origH) {
        const sugeridoH = Math.round(origW / (img.naturalWidth / img.naturalHeight))
        setDimAlert({ sugeridoW: origW, sugeridoH, realW: img.naturalWidth, realH: img.naturalHeight, src: nuevoSrc })
      } else {
        commit({ src: nuevoSrc })
      }
    }
    img.onerror = () => commit({ src: nuevoSrc })
    img.src = nuevoSrc
  }

  function aceptarSugerencia() {
    const w = String(dimAlert.sugeridoW), h = String(dimAlert.sugeridoH)
    setWidthLocal(w); setHeightLocal(h); setDimAlert(null)
    onActualizar({ src: dimAlert.src, alt: altLocal, title: titleLocal, width: w, height: h })
  }

  return (
    <div className="ep-campo">
      <label className="ep-campo-label">{campo.label} — URL</label>
      <input className="ep-campo-input" autoComplete="off" value={srcLocal}
        onChange={e => setSrcLocal(e.target.value)} onBlur={e => onSrcBlur(e.target.value)}
        placeholder="https://cdn.ejemplo.com/imagen.png" />
      <label className="ep-campo-label" style={{ marginTop: 6 }}>Alt — {campo.label}</label>
      <input className="ep-campo-input" autoComplete="off" value={altLocal}
        onChange={e => setAltLocal(e.target.value)} onBlur={commit} placeholder="Texto alternativo" />
      <label className="ep-campo-label" style={{ marginTop: 6 }}>Title — {campo.label}</label>
      <input className="ep-campo-input" autoComplete="off" value={titleLocal}
        onChange={e => setTitleLocal(e.target.value)} onBlur={commit} placeholder="Título de la imagen" />

      {dimAlert && (
        <div className="ep-dim-alert">
          <span>La imagen nueva mide <strong>{dimAlert.realW}×{dimAlert.realH}px</strong>. Las medidas esperadas son <strong>{origW}×{origH}px</strong>. Medidas recomendadas manteniendo el ancho: <strong>{dimAlert.sugeridoW}×{dimAlert.sugeridoH}px</strong></span>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="ep-btn ep-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }} onClick={aceptarSugerencia}>Usar recomendado</button>
            <button className="ep-btn ep-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }} onClick={() => { setDimAlert(null); commit({ src: dimAlert.src }) }}>Mantener original</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <div style={{ flex: 1 }}>
              <label className="ep-campo-label">Ancho (px)</label>
              <input className="ep-campo-input" autoComplete="off" value={widthLocal} onChange={e => setWidthLocal(e.target.value)} onBlur={commit} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="ep-campo-label">Alto (px)</label>
              <input className="ep-campo-input" autoComplete="off" value={heightLocal} onChange={e => setHeightLocal(e.target.value)} onBlur={commit} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Panel editor ───────────────────────────────────────────────────────────
function PanelEditor({ bloque, onActualizar }) {
  const [htmlLocal, setHtmlLocal] = useState(bloque.htmlEditado || bloque.html)
  const [saving, setSaving] = useState(false)
  // IMPORTANTE: siempre contra bloque.html (el HTML original del
  // archivo fuente), NUNCA contra bloque.htmlEditado. Bug real que
  // esto corrige: si detectarCampos corriera contra el HTML ya
  // editado, un campo de texto vaciado por completo por el usuario
  // (selección + borrar, o el ícono de limpiar) deja de matchear el
  // filtro de "longitud > 2 caracteres reales" — el campo "desaparece"
  // de la lista, y como esta lista es la única fuente de qué editar,
  // se pierde la posibilidad de volver a escribir algo ahí. Pasaba
  // también en bloques con imagen+texto en la misma celda: vaciar el
  // texto hacía que ESA celda dejara de contarse como campo de texto,
  // aunque la imagen (detectada por separado) siguiera bien. La
  // estructura de campos (cuántos hay, de qué tipo, en qué posición)
  // tiene que ser estable y depender solo del original — el VALOR
  // actual de cada campo (lo que se muestra/edita) sí debe reflejar lo
  // editado, y eso se resuelve por separado más abajo con
  // valorActualDelCampo, no mezclando ambas cosas en una sola pasada.
  const camposOriginales = useRef(null)
  if (!camposOriginales.current) camposOriginales.current = detectarCampos(bloque.html)
  const esCodigo = bloque.tipo === 'codigo'
  const esEspaciador = bloque.slug === 'Espaciador'
  const sinCampos = !esCodigo && !esEspaciador && camposOriginales.current.length === 0

  function actualizarCampo(tipo, idx, cambios) {
    setHtmlLocal(prev => actualizarCampoEnHtml(prev, tipo, idx, cambios))
  }

  function aplicar() {
    setSaving(true)
    setTimeout(() => { onActualizar(bloque.instanceId, htmlLocal); setSaving(false) }, 400)
  }

  function resetBloque() {
    setHtmlLocal(bloque.html)
    onActualizar(bloque.instanceId, null) // null = volver al html original
  }

  if (esCodigo) return (
    <>
      <div className="ep-editor-body">
        <div className="ep-campo">
          <label className="ep-campo-label">Código HTML</label>
          <textarea className="ep-codigo-textarea" value={htmlLocal}
            onChange={e => setHtmlLocal(e.target.value)} placeholder="Pegá el HTML del bloque acá..." />
        </div>
      </div>
      <div className="ep-editor-footer">
        <button className="ep-btn ep-btn-primary ep-btn-aplicar" onClick={aplicar} disabled={saving}>
          {saving ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
          {saving ? 'Aplicando…' : 'Aplicar cambios'}
        </button>
      </div>
    </>
  )

  if (esEspaciador) {
    const altMatch = htmlLocal.match(/height:\s*(\d+)px/)
    const altActual = altMatch ? parseInt(altMatch[1]) : 14
    // El espaciador aplica en vivo al elegir el alto — no tiene sentido
    // pedir un click de "Aplicar cambios" para algo tan inmediato como
    // un chip de 3 opciones fijas (a diferencia de texto/imagen, donde
    // sí puede convenir terminar de escribir antes de aplicar).
    function setAlto(px) {
      const nuevo = htmlLocal
        .replace(/height:\s*\d+px/g, `height: ${px}px`)
        .replace(/line-height:\s*\d+px/g, `line-height: ${px}px`)
        .replace(/mso-line-height-alt:\s*\d+px/g, `mso-line-height-alt: ${px}px`)
        .replace(/height="\d+"/g, `height="${px}"`)
      setHtmlLocal(nuevo)
      onActualizar(bloque.instanceId, nuevo)
    }
    return (
      <>
        <div className="ep-editor-body">
          <div className="ep-campo">
            <label className="ep-campo-label">Alto del espaciador</label>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {[7, 14, 28].map(px => (
                <button key={px} onClick={() => setAlto(px)}
                  className={`ep-espaciador-chip ${altActual === px ? 'activo' : ''}`}>{px}px</button>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  const campos = camposOriginales.current
  // Valor actual de cada <td> en orden — SIN filtrar por contenido (a
  // diferencia de detectarCampos), porque acá lo que importa es poder
  // indexar por posicionReal de forma estable. Si en cambio se llamara
  // a detectarCampos(htmlLocal) de nuevo, un campo vaciado dejaría de
  // aparecer en esa lista y correría los índices de los campos
  // siguientes — el mismo bug que ya se corrigió en detectarCampos /
  // actualizarCampoEnHtml, pero del lado de la lectura en vez de la
  // escritura.
  const todosLosTdActuales = [...htmlLocal.matchAll(/<td(?:[^>]*)>([\s\S]*?)<\/td>/gi)].map(m => m[1])
  function valorActualDeTexto(campo) {
    return todosLosTdActuales[campo.posicionReal] ?? campo.contenido
  }

  return (
    <>
      <div className="ep-editor-body">
        {sinCampos && (
          <div className="ep-sin-campos">
            <div className="ep-sin-campos-icono"><Type size={20} /></div>
            <strong>Sin campos editables</strong>
            <span>Este bloque no tiene textos, imágenes ni links detectados para editar.</span>
          </div>
        )}
        {campos.map((campo, i) => {
          if (campo.tipo === 'texto') return (
            <div key={i} className="ep-campo">
              <label className="ep-campo-label">{campo.label}</label>
              <RichEditor value={valorActualDeTexto(campo)}
                onChange={v => actualizarCampo('texto', campo.posicionReal, { contenido: v })} />
            </div>
          )
          if (campo.tipo === 'imagen') return (
            <CampoImagen key={i} campo={campo}
              onActualizar={c => actualizarCampo('imagen', campo.posicionReal, c)}
              onReset={() => { setHtmlLocal(bloque.html); onActualizar(bloque.instanceId, null) }} />
          )
          if (campo.tipo === 'link') return (
            <div key={i} className="ep-campo">
              <label className="ep-campo-label">{campo.label}</label>
              <input className="ep-campo-input" defaultValue={campo.valor} placeholder="https://..." autoComplete="off"
                onBlur={e => actualizarCampo('link', campo.idx, { valor: e.target.value })} />
            </div>
          )
          return null
        })}
      </div>
      {!sinCampos && (
        <div className="ep-editor-footer">
          <button className="ep-btn ep-btn-primary ep-btn-aplicar" onClick={aplicar} disabled={saving}>
            {saving ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
            {saving ? 'Aplicando…' : 'Aplicar cambios'}
          </button>
          <button className="ep-btn ep-btn-ghost ep-btn-aplicar" onClick={resetBloque} style={{ marginTop: 4 }}>
            <RotateCcw size={13} /> Restaurar original
          </button>
        </div>
      )}
    </>
  )
}

// ─── Iframe auto-alto ───────────────────────────────────────────────────────
function AutoIframe({ srcDoc, title, className, height }) {
  const ref = useRef(null)

  function ajustarAlto() {
    if (height) return
    try {
      const doc = ref.current?.contentDocument
      if (!doc?.body) return
      const h = doc.body.scrollHeight || doc.documentElement?.scrollHeight || 40
      ref.current.style.height = `${Math.max(h, 40)}px`
    } catch { if (ref.current) ref.current.style.height = '80px' }
  }

  // Reajustar alto cada vez que cambia el srcDoc
  useEffect(() => {
    const iframe = ref.current
    if (!iframe) return
    // onLoad puede no dispararse si el iframe ya está montado — forzar via evento
    const handler = () => ajustarAlto()
    iframe.addEventListener('load', handler)
    // Si ya tiene documento cargado, ajustar ahora mismo
    if (iframe.contentDocument?.readyState === 'complete') ajustarAlto()
    return () => iframe.removeEventListener('load', handler)
  }, [srcDoc])

  return <iframe ref={ref} className={className} srcDoc={srcDoc} title={title}
    scrolling="no" style={{ height: height || 40, border: 'none', display: 'block', width: '100%', background: '#fff' }} />
}

// ─── Categoría colapsable ───────────────────────────────────────────────────
function CategoriaColapsable({ titulo, children }) {
  const [abierto, setAbierto] = useState(true)
  return (
    <div>
      <button className="ep-categoria-header" onClick={() => setAbierto(v => !v)}>
        <span className="ep-categoria-titulo">{titulo}</span>
        <ChevronDown size={13} style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>
      {abierto && <div className="ep-categoria-body">{children}</div>}
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function EditorPiezas() {
  const [busqueda, setBusqueda] = useState('')
  const [nombre, setNombre] = useState('Nueva pieza')
  const [bandaHeader, setBandaHeader] = useState(BLOQUES_HEADER[0] ?? null)
  const [canvas, setCanvas] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [draggingBibliotecaId, setDraggingBibliotecaId] = useState(null)
  const [draggingCanvasId, setDraggingCanvasId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null) // { id, posicion: 'arriba'|'abajo' }
  const [dragOverZona, setDragOverZona] = useState(false)
  const [dragOverHeader, setDragOverHeader] = useState(false)
  const [imgPrincipal, setImgPrincipal] = useState({ activo: false, src: '', alt: '' })
  const [imgFooter, setImgFooter] = useState({ activo: false, src: '', alt: '', link: '' })
  const [legalEspecifico, setLegalEspecifico] = useState('')
  const [legalEspecificoActivo, setLegalEspecificoActivo] = useState(false)
  const [indicadores, setIndicadores] = useState([])
  // Estado visual de "guardando" para los botones Confirmar de las
  // secciones especiales (imagen principal/footer, legal específico,
  // indicadores) — mismo criterio que ya usa PanelEditor.aplicar() para
  // el botón "Aplicar cambios": como estos campos ya actualizan el
  // estado en vivo vía onChange, el guardado real es instantáneo, pero
  // sin ningún feedback visual el click se siente "mudo" (¿pasó algo?).
  // Un breve estado de loading (mismo delay que aplicar()) confirma al
  // usuario que la acción se registró.
  const [confirmando, setConfirmando] = useState({})
  function confirmarSeccion(key) {
    setConfirmando(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setConfirmando(prev => ({ ...prev, [key]: false })), 400)
  }
  // Qué alto de espaciador se está arrastrando desde el FAB flotante
  // (7/14/28, o null si no hay ningún drag de spacer en curso) — se
  // setea en el dragStart de cada opción del FAB y se consume en el
  // momento del drop, junto con el mismo flujo de drag and drop que ya
  // usan los bloques de la biblioteca.
  const [spacerPxArrastrando, setSpacerPxArrastrando] = useState(null)
  // Igual concepto que spacerPxArrastrando: "Código personalizado" no
  // tiene un archivo .html real detrás (es un bloque vacío que el
  // usuario llena con su propio HTML), así que no existe en BLOQUES y
  // el onDropZona normal nunca lo encuentra por id. Antes esto hacía
  // que el card no fuera arrastrable en absoluto — solo tenía onClick,
  // siempre se agregaba al final del canvas sin poder elegir posición.
  const [arrastrandoCodigoPersonalizado, setArrastrandoCodigoPersonalizado] = useState(false)

  const bloquesFiltradosHeader = BLOQUES_HEADER.filter(b => b.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const bloquesFiltradosContenido = BLOQUES_CONTENIDO.filter(b =>
    b.slug !== 'Espaciador' && b.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const categoriasContenido = [...new Set(bloquesFiltradosContenido.map(b => b.categoria))]

  function crearInstancia(bloque) {
    return { ...bloque, instanceId: `${bloque.id}-${Date.now()}`, htmlEditado: null }
  }

  function agregarAlCanvas(bloque, antesDeId = null, posicion = 'abajo', htmlOverride = null) {
    const inst = crearInstancia(bloque)
    if (htmlOverride != null) inst.htmlEditado = htmlOverride
    setCanvas(prev => {
      if (antesDeId == null) return [...prev, inst]
      const idx = prev.findIndex(b => b.instanceId === antesDeId)
      if (idx === -1) return [...prev, inst]
      const arr = [...prev]
      arr.splice(posicion === 'arriba' ? idx : idx + 1, 0, inst)
      return arr
    })
    setSelectedId(inst.instanceId)
  }

  // Genera el HTML del espaciador con un alto custom — misma lógica de
  // reemplazo que ya usa el editor del espaciador en el panel lateral
  // (PanelEditor → esEspaciador → setAlto), reusada acá para que el
  // FAB flotante pueda soltar directamente con el alto correcto, sin
  // pasar primero por el HTML default y editarlo después.
  function htmlEspaciadorConAlto(px) {
    if (!BLOQUE_ESPACIADOR) return null
    return BLOQUE_ESPACIADOR.html
      .replace(/height:\s*\d+px/g, `height: ${px}px`)
      .replace(/line-height:\s*\d+px/g, `line-height: ${px}px`)
      .replace(/mso-line-height-alt:\s*\d+px/g, `mso-line-height-alt: ${px}px`)
      .replace(/height="\d+"/g, `height="${px}"`)
  }

  function agregarEspaciadorDespues(instanceId) {
    if (!BLOQUE_ESPACIADOR) return
    const inst = crearInstancia(BLOQUE_ESPACIADOR)
    setCanvas(prev => {
      const idx = prev.findIndex(b => b.instanceId === instanceId)
      const arr = [...prev]
      arr.splice(idx + 1, 0, inst)
      return arr
    })
  }

  function agregarCodigo() {
    const inst = { id: 'codigo', instanceId: `codigo-${Date.now()}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: '', htmlEditado: null, tipo: 'codigo', slug: 'codigo' }
    setCanvas(prev => [...prev, inst])
    setSelectedId(inst.instanceId)
  }

  function eliminarBloque(instanceId) {
    setCanvas(prev => prev.filter(b => b.instanceId !== instanceId))
    if (selectedId === instanceId) setSelectedId(null)
  }

  function actualizarBloque(instanceId, htmlEditado) {
    setCanvas(prev => prev.map(b => b.instanceId === instanceId ? { ...b, htmlEditado } : b))
  }

  function onDragStartBiblioteca(e, bloque) {
    setDraggingBibliotecaId(bloque.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onDropZona(e, targetId = null, pos = 'abajo') {
    e.preventDefault()
    setDragOverZona(false)
    // Caso 1: se soltó una de las 3 opciones del FAB de espaciador —
    // el alto ya viene decidido desde el dragStart, se aplica directo.
    if (spacerPxArrastrando != null) {
      if (BLOQUE_ESPACIADOR) agregarAlCanvas(BLOQUE_ESPACIADOR, targetId, pos, htmlEspaciadorConAlto(spacerPxArrastrando))
      setSpacerPxArrastrando(null)
      setDragOverId(null)
      return
    }
    // Caso 1b: se soltó el card de "Código personalizado" — no existe
    // en BLOQUES (no tiene archivo .html real), así que se construye
    // la instancia a mano con la misma forma que crea agregarCodigo().
    if (arrastrandoCodigoPersonalizado) {
      const inst = { id: 'codigo', instanceId: `codigo-${Date.now()}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: '', htmlEditado: null, tipo: 'codigo', slug: 'codigo' }
      setCanvas(prev => {
        if (targetId == null) return [...prev, inst]
        const idx = prev.findIndex(b => b.instanceId === targetId)
        if (idx === -1) return [...prev, inst]
        const arr = [...prev]
        arr.splice(pos === 'arriba' ? idx : idx + 1, 0, inst)
        return arr
      })
      setSelectedId(inst.instanceId)
      setArrastrandoCodigoPersonalizado(false)
      setDragOverId(null)
      return
    }
    // Caso 2: bloque normal de la biblioteca
    if (!draggingBibliotecaId) return
    const bloque = BLOQUES.find(b => b.id === draggingBibliotecaId)
    if (bloque && bloque.categoria !== 'Header') agregarAlCanvas(bloque, targetId, pos)
    setDraggingBibliotecaId(null)
    setDragOverId(null)
  }

  function onDropHeader(e) {
    e.preventDefault()
    setDragOverHeader(false)
    if (!draggingBibliotecaId) return
    const bloque = BLOQUES.find(b => b.id === draggingBibliotecaId)
    if (bloque?.categoria === 'Header') setBandaHeader(bloque)
    setDraggingBibliotecaId(null)
  }

  function onDragStartCanvas(e, instanceId) {
    setDraggingCanvasId(instanceId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOverBloque(e, instanceId) {
    e.preventDefault()
    if (draggingBibliotecaId || draggingCanvasId || spacerPxArrastrando != null || arrastrandoCodigoPersonalizado) {
      const rect = e.currentTarget.getBoundingClientRect()
      const posicion = e.clientY < rect.top + rect.height / 2 ? 'arriba' : 'abajo'
      setDragOverId({ id: instanceId, posicion })
    }
  }

  function onDropBloque(e, targetInstanceId) {
    e.preventDefault()
    if (draggingBibliotecaId || spacerPxArrastrando != null || arrastrandoCodigoPersonalizado) {
      onDropZona(e, targetInstanceId, dragOverId?.posicion ?? 'abajo')
      return
    }
    if (!draggingCanvasId || draggingCanvasId === targetInstanceId) { setDraggingCanvasId(null); setDragOverId(null); return }
    const posicion = dragOverId?.posicion ?? 'abajo'
    setCanvas(prev => {
      const arr = [...prev]
      const from = arr.findIndex(b => b.instanceId === draggingCanvasId)
      const [item] = arr.splice(from, 1)
      const to = arr.findIndex(b => b.instanceId === targetInstanceId)
      arr.splice(posicion === 'arriba' ? to : to + 1, 0, item)
      return arr
    })
    setDraggingCanvasId(null)
    setDragOverId(null)
  }

  function agregarIndicador() { setIndicadores(p => [...p, { id: Date.now(), ref: '(*)', sigla: 'CFTNA', valor: '0,00%' }]) }
  function actualizarIndicador(id, campo, val) { setIndicadores(p => p.map(i => i.id === id ? { ...i, [campo]: val } : i)) }
  function eliminarIndicador(id) { setIndicadores(p => p.filter(i => i.id !== id)) }

  function exportar() {
    const html = generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalEspecifico, legalEspecificoActivo, indicadores })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const slug = nombre.replace(/[ñÑ]/g, m => m === 'ñ' ? 'n' : 'N').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'pieza'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${slug}.html`; a.click()
    URL.revokeObjectURL(url)
  }

  const selectedBloque = canvas.find(b => b.instanceId === selectedId)
  const previewSrcdoc = showPreview
    ? `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;">${generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalEspecifico, legalEspecificoActivo, indicadores })}</body></html>`
    : ''

  return (
    <div className="ep-root">

      {/* ── Biblioteca ── */}
      <aside className="ep-biblioteca">
        <div className="ep-biblioteca-header">
          <span className="ep-biblioteca-titulo">Bloques disponibles</span>
          <input className="ep-search" autoComplete="off" placeholder="Buscar bloque…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          {/* Spacer — fila fija siempre visible (no dentro de una
              categoría colapsable ni escondido en un botón flotante):
              es de los elementos que más se usan al armar una pieza,
              así que queda a mano sin tener que buscarlo. Las 3
              opciones son arrastrables directo al canvas, mismo
              mecanismo de drag and drop que el resto de los bloques. */}
          {BLOQUE_ESPACIADOR && (
            <div className="ep-spacer-row">
              <span className="ep-spacer-row-label">Espaciador</span>
              <div className="ep-spacer-row-opciones">
                {[7, 14, 28].map(px => (
                  <button key={px} className="ep-spacer-chip-drag" draggable
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; setSpacerPxArrastrando(px) }}
                    onDragEnd={() => setSpacerPxArrastrando(null)}
                    title={`Arrastrá para ubicar un espaciador de ${px}px`}>
                    {px}px
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="ep-biblioteca-lista">

          {bloquesFiltradosHeader.length > 0 && (
            <CategoriaColapsable titulo="Header">
              {bloquesFiltradosHeader.map(bloque => (
                <div key={bloque.id}
                  className={`ep-bloque-card ${draggingBibliotecaId === bloque.id ? 'dragging-source' : ''} ${bandaHeader?.id === bloque.id ? 'en-uso' : ''}`}
                  draggable onDragStart={e => onDragStartBiblioteca(e, bloque)} onDragEnd={() => setDraggingBibliotecaId(null)}>
                  <img src={generarThumbSVG(bloque)} alt={bloque.nombre} className="ep-bloque-thumb" />
                  <div className="ep-bloque-footer">
                    <span className="ep-bloque-nombre">{bloque.nombre}</span>
                    <button className="ep-bloque-add" onClick={() => setBandaHeader(bloque)}>
                      {bandaHeader?.id === bloque.id ? <Check size={12} /> : '+'}
                    </button>
                  </div>
                </div>
              ))}
            </CategoriaColapsable>
          )}

          {categoriasContenido.map(cat => (
            <CategoriaColapsable key={cat} titulo={cat}>
              {bloquesFiltradosContenido.filter(b => b.categoria === cat).map(bloque => (
                <div key={bloque.id}
                  className={`ep-bloque-card ${draggingBibliotecaId === bloque.id ? 'dragging-source' : ''}`}
                  draggable onDragStart={e => onDragStartBiblioteca(e, bloque)} onDragEnd={() => setDraggingBibliotecaId(null)}>
                  <img src={generarThumbSVG(bloque)} alt={bloque.nombre} className="ep-bloque-thumb" />
                  <div className="ep-bloque-footer">
                    <span className="ep-bloque-nombre">{bloque.nombre}</span>
                    <button className="ep-bloque-add" onClick={() => agregarAlCanvas(bloque)}>+</button>
                  </div>
                </div>
              ))}
            </CategoriaColapsable>
          ))}

          <CategoriaColapsable titulo="Personalizado">
            <div
              className={`ep-bloque-card ${arrastrandoCodigoPersonalizado ? 'dragging-source' : ''}`}
              style={{ cursor: 'pointer' }}
              draggable
              onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; setArrastrandoCodigoPersonalizado(true) }}
              onDragEnd={() => setArrastrandoCodigoPersonalizado(false)}
              onClick={agregarCodigo}
            >
              <div className="ep-bloque-thumb-placeholder"><Code size={18} /><span>HTML libre</span></div>
              <div className="ep-bloque-footer">
                <span className="ep-bloque-nombre">Código personalizado</span>
                <button className="ep-bloque-add" onClick={e => { e.stopPropagation(); agregarCodigo() }}>+</button>
              </div>
            </div>
          </CategoriaColapsable>
        </div>
      </aside>

      {/* ── Canvas ── */}
      <main className="ep-canvas-wrap">
        <div className="ep-canvas-header">
          <input className="ep-nombre-pieza" autoComplete="off" value={nombre} onChange={e => setNombre(e.target.value)} title="Nombre de la pieza" />
          <div className="ep-canvas-actions">
            <button className="ep-btn ep-btn-disabled" disabled>🔗 Importar desde link</button>
            <button className="ep-btn ep-btn-ghost" onClick={() => setShowPreview(true)}><Eye size={14} /> Vista previa</button>
            <button className="ep-btn ep-btn-primary" onClick={exportar}><Download size={14} /> Exportar HTML</button>
          </div>
        </div>
        <div className="ep-canvas-body">

          {/* Banda Header */}
          <div className={`ep-zona-fija ${dragOverHeader ? 'drag-over-header' : ''}`}
            onDragOver={e => { e.preventDefault(); const b = BLOQUES.find(x => x.id === draggingBibliotecaId); if (b?.categoria === 'Header') setDragOverHeader(true) }}
            onDragLeave={() => setDragOverHeader(false)} onDrop={onDropHeader}>
            <div className="ep-zona-fija-header">
              <span className="ep-zona-fija-label"><Layout size={12} /> Banda Header</span>
              <span className="ep-zona-fija-badge">{bandaHeader?.nombre || 'Sin seleccionar'}</span>
            </div>
            {bandaHeader
              ? <AutoIframe className="ep-zona-fija-preview" srcDoc={wrapPreview(bandaHeader.html, true)} title="Banda header" />
              : <div className="ep-zona-drop-empty">Arrastrá un bloque de Header acá</div>}
          </div>

          {/* Imagen principal */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label"><Image size={12} /> Imagen principal</span>
              <button className={`ep-toggle-btn ${imgPrincipal.activo ? 'activo' : ''}`}
                onClick={() => setImgPrincipal(p => ({ ...p, activo: !p.activo }))}>
                {imgPrincipal.activo ? 'Incluida' : 'No incluida'}
              </button>
            </div>
            {imgPrincipal.activo && (
              <div className="ep-zona-toggle-body">
                <label className="ep-img-label">URL (600px de ancho)</label>
                <input className="ep-img-input" autoComplete="off" placeholder="https://cdn.ejemplo.com/imagen.png"
                  value={imgPrincipal.src} onChange={e => setImgPrincipal(p => ({ ...p, src: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Alt</label>
                <input className="ep-img-input" autoComplete="off" placeholder="Texto alternativo"
                  value={imgPrincipal.alt} onChange={e => setImgPrincipal(p => ({ ...p, alt: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Title</label>
                <input className="ep-img-input" autoComplete="off" placeholder="Título de la imagen"
                  value={imgPrincipal.title || ''} onChange={e => setImgPrincipal(p => ({ ...p, title: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Link (opcional)</label>
                <input className="ep-img-input" autoComplete="off" placeholder="https://... (dejar vacío si no tiene link)"
                  value={imgPrincipal.link || ''} onChange={e => setImgPrincipal(p => ({ ...p, link: e.target.value }))} />
                {imgPrincipal.src && (
                  <div style={{ marginTop: 8, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={imgPrincipal.src} alt={imgPrincipal.alt || ''} style={{ width: '100%', height: 'auto', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('imgPrincipal')} disabled={confirmando.imgPrincipal}>
                    {confirmando.imgPrincipal ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.imgPrincipal ? 'Confirmando…' : 'Confirmar imagen'}
                  </button>
                  <button className="ep-btn ep-btn-ghost" style={{ flex: 0 }} onClick={() => setImgPrincipal({ activo: true, src: '', alt: '', title: '', link: '' })} title="Reiniciar">
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Zona de contenido */}
          <div className="ep-zona-contenido">
            <div className="ep-zona-contenido-header">
              <span className="ep-zona-contenido-label"><FileText size={12} /> Contenido de la pieza</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{canvas.length} bloque{canvas.length !== 1 ? 's' : ''}</span>
            </div>
            <div className={`ep-zona-drop ${dragOverZona && !dragOverId ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); if (draggingBibliotecaId || spacerPxArrastrando != null || arrastrandoCodigoPersonalizado) setDragOverZona(true) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverZona(false) }}
              onDrop={e => { if (!dragOverId) onDropZona(e) }}>
              {canvas.length === 0 && <div className="ep-zona-drop-empty">Arrastrá bloques desde la biblioteca o usá el botón +</div>}
              {canvas.map(bloque => (
                <div key={bloque.instanceId}
                  className={`ep-canvas-bloque ${selectedId === bloque.instanceId ? 'selected' : ''} ${dragOverId?.id === bloque.instanceId ? `drag-over-bloque drag-over-${dragOverId.posicion}` : ''}`}
                  onClick={() => setSelectedId(bloque.instanceId)}
                  draggable
                  onDragStart={e => onDragStartCanvas(e, bloque.instanceId)}
                  onDragEnd={() => { setDraggingCanvasId(null); setDragOverId(null) }}
                  onDragOver={e => onDragOverBloque(e, bloque.instanceId)}
                  onDrop={e => onDropBloque(e, bloque.instanceId)}>
                  <div className="ep-canvas-bloque-handle"><GripVertical size={14} /></div>
                  <div className="ep-canvas-bloque-body">
                    <div className="ep-canvas-bloque-nombre">{bloque.nombre}</div>
                    <AutoIframe className="ep-canvas-bloque-iframe"
                      srcDoc={wrapPreview(bloque.htmlEditado || bloque.html)} title={bloque.nombre} />
                  </div>
                  <div className="ep-canvas-bloque-actions">
                    {bloque.slug !== 'Espaciador' && (
                      <button className="ep-canvas-bloque-espaciador" title="Agregar espaciador debajo"
                        onClick={e => { e.stopPropagation(); agregarEspaciadorDespues(bloque.instanceId) }}>
                        <Plus size={11} />
                      </button>
                    )}
                    <button className="ep-canvas-bloque-del"
                      onClick={e => { e.stopPropagation(); eliminarBloque(bloque.instanceId) }} title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Imagen footer */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label"><Image size={12} /> Imagen footer</span>
              <button className={`ep-toggle-btn ${imgFooter.activo ? 'activo' : ''}`}
                onClick={() => setImgFooter(p => ({ ...p, activo: !p.activo }))}>
                {imgFooter.activo ? 'Incluida' : 'No incluida'}
              </button>
            </div>
            {imgFooter.activo && (
              <div className="ep-zona-toggle-body">
                <label className="ep-img-label">URL de la imagen</label>
                <input className="ep-img-input" autoComplete="off" placeholder="https://cdn.ejemplo.com/footer.gif"
                  value={imgFooter.src} onChange={e => setImgFooter(p => ({ ...p, src: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Link destino</label>
                <input className="ep-img-input" placeholder="https://..." autoComplete="off"
                  value={imgFooter.link} onChange={e => setImgFooter(p => ({ ...p, link: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Alt</label>
                <input className="ep-img-input" autoComplete="off" placeholder="Texto alternativo"
                  value={imgFooter.alt} onChange={e => setImgFooter(p => ({ ...p, alt: e.target.value }))} />
                {imgFooter.src && (
                  <div style={{ marginTop: 8, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={imgFooter.src} alt={imgFooter.alt || ''} style={{ width: '100%', height: 'auto', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('imgFooter')} disabled={confirmando.imgFooter}>
                    {confirmando.imgFooter ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.imgFooter ? 'Confirmando…' : 'Confirmar imagen'}
                  </button>
                  <button className="ep-btn ep-btn-ghost" style={{ flex: 0 }} onClick={() => setImgFooter({ activo: true, src: '', alt: '', link: '' })} title="Reiniciar">
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Legal específico */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label"><FileText size={12} /> Legal específico</span>
              <button className={`ep-toggle-btn ${legalEspecificoActivo ? 'activo' : ''}`}
                onClick={() => setLegalEspecificoActivo(v => !v)}>
                {legalEspecificoActivo ? 'Incluido' : 'No incluido'}
              </button>
            </div>
            {legalEspecificoActivo && (
              <div className="ep-zona-toggle-body">
                <label className="ep-img-label">Texto legal de la promo — se agrega antes del legal genérico, sin separación</label>
                <RichEditor key="legal-especifico" value={legalEspecifico} onChange={setLegalEspecifico} />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('legal')} disabled={confirmando.legal}>
                    {confirmando.legal ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.legal ? 'Confirmando…' : 'Confirmar texto'}
                  </button>
                  <button className="ep-btn ep-btn-ghost" style={{ flex: 0 }} onClick={() => setLegalEspecifico('')} title="Reiniciar">
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Legal fijo — con estilos reales */}
          <div className="ep-zona-fija">
            <div className="ep-zona-fija-header">
              <span className="ep-zona-fija-label"><Lock size={12} /> Legal genérico</span>
              <span className="ep-zona-fija-badge ep-zona-fija-badge-lock"><Lock size={9} /> Siempre presente</span>
            </div>
            <div style={{
              padding: '0.625rem 0.875rem', background: '#fff',
              fontFamily: 'Arial, Helvetica, Open Sans, sans-serif',
              fontSize: 14, fontWeight: 'bold', lineHeight: '16px',
              color: '#333333', textAlign: 'justify', wordBreak: 'break-word',
              maxHeight: 120, overflowY: 'auto'
            }} dangerouslySetInnerHTML={{ __html: LEGAL_FIJO_HTML }} />
          </div>

          {/* Indicadores financieros */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label">Indicadores financieros</span>
              <button className={`ep-toggle-btn ${indicadores.length > 0 ? 'activo' : ''}`} onClick={agregarIndicador}>+ Agregar</button>
            </div>
            {indicadores.length > 0 && (
              <div className="ep-zona-toggle-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {indicadores.map(ind => (
                  <div key={ind.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input className="ep-img-input" autoComplete="off" style={{ width: 52, flexShrink: 0 }} value={ind.ref} placeholder="(*)"
                      onChange={e => actualizarIndicador(ind.id, 'ref', e.target.value)} title="Referencia" />
                    <input className="ep-img-input" autoComplete="off" style={{ width: 80, flexShrink: 0 }} value={ind.sigla} placeholder="CFTNA"
                      onChange={e => actualizarIndicador(ind.id, 'sigla', e.target.value)} />
                    <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={ind.valor} placeholder="0,00%"
                      onChange={e => actualizarIndicador(ind.id, 'valor', e.target.value)} />
                    <button onClick={() => eliminarIndicador(ind.id)}
                      style={{ flexShrink: 0, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('indicadores')} disabled={confirmando.indicadores}>
                    {confirmando.indicadores ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.indicadores ? 'Confirmando…' : 'Confirmar indicadores'}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── Panel editor ── */}
      <aside className="ep-editor">
        <div className="ep-editor-header">
          <span className="ep-editor-titulo">Panel de edición</span>
          {selectedBloque && <span className="ep-editor-bloque-nombre">{selectedBloque.nombre}</span>}
        </div>
        {!selectedBloque
          ? <div className="ep-editor-empty"><FileText size={28} style={{ color: 'var(--border)' }} /><span>Seleccioná un bloque del canvas para editar su contenido</span></div>
          : <PanelEditor key={selectedBloque.instanceId} bloque={selectedBloque} onActualizar={actualizarBloque} />}
      </aside>

      {/* ── Modal preview ── */}
      {showPreview && (
        <div className="ep-preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="ep-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="ep-preview-header">
              <span className="ep-preview-titulo">Vista previa — {nombre}</span>
              <button className="ep-preview-close" onClick={() => setShowPreview(false)}><X size={16} /></button>
            </div>
            <iframe className="ep-preview-iframe" srcDoc={previewSrcdoc} title="Vista previa completa" />
          </div>
        </div>
      )}
    </div>
  )
}
