import { useState, useRef, useEffect, forwardRef } from 'react'
import { GripVertical, Trash2, Eye, Download, X, Code, Lock, Image, FileText, Layout, ChevronDown, Check, Type, Underline, RotateCcw, Plus, Loader2, Copy, ClipboardCheck, AlertCircle } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import '@/styles/EditorPiezas.css'

// ─── Temas de template — ICBC (fondo blanco), Avisos (fondo beige,
// comunicaciones especiales tipo regulaciones bancarias), Mall (fondo
// negro, ofertas de ICBC Mall). La ESTRUCTURA del email es la misma
// en los 3 — header, imagen principal, contenido por bloques, footer
// con legales — lo que cambia, confirmado contra HTML reales de
// Avisos y Mall:
//  - bgContenido: el fondo del bloque de contenido (antes siempre
//    #ffffff fijo).
//  - colorTexto: el color base del texto dentro de cada bloque de
//    contenido (cada bloque trae #333333 hardcodeado en su propio
//    HTML, no heredado — por eso aplicarColorTexto lo reemplaza al
//    vuelo al exportar, no al cargar el bloque).
//  - conBorde: si la tabla principal de 600px lleva el borde rojo de
//    1px — ICBC y Mall sí, Avisos NO (confirmado: el HTML real de
//    Avisos no tiene ningún border en esa tabla).
// El fondo de la página detrás del email (#ffffff exterior) y el
// fondo del bloque de footer/legales (#ffffff) NO cambian en ningún
// tema — en los 2 ejemplos reales (Avisos y Mall) ambos siguen siendo
// blancos siempre, solo el contenido del medio cambia.
const TEMAS = {
  icbc:   { label: 'ICBC',   bgContenido: '#ffffff', colorTexto: '#333333', conBorde: true },
  avisos: { label: 'Avisos', bgContenido: '#dcd2c9', colorTexto: '#333333', conBorde: false },
  mall:   { label: 'Mall',   bgContenido: '#2e2f31', colorTexto: '#ffffff', conBorde: true },
}
const TEMA_DEFAULT = 'icbc'

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

// Firma institucional (ICBC Investments / Sociedad Gerente-Depositaria)
// — sección fija opcional, vista en piezas de Fondos Comunes de
// Inversión (FCI): dos filas de 2 columnas cada una (izquierda/
// derecha, mismo <td class="Texto_Legales"> que el resto de legales
// pero CADA texto en su propia celda corta, no en un párrafo largo
// corrido). Antes de este fix, el importador heurístico/con marcador
// no distinguía estos <td> de los legales adicionales reales —
// terminaba creando 4 "legales adicionales" sueltos y activando el
// modo "separados" por error (ver comentario junto a
// FIRMA_INSTITUCIONAL_REGEX). Valores por defecto = los textos reales
// vistos en la pieza que motivó este fix; el usuario puede editarlos
// si el texto institucional cambia en el futuro, pero la estructura
// (2 filas fijas, 2 columnas cada una) no es editable por diseño —no
// es una lista abierta como Legales adicionales o Indicadores.
const FIRMA_INSTITUCIONAL_DEFAULT = {
  fila1Izq: 'ICBC Investments SAU SGFCI',
  fila1Der: 'Industrial and Commercial Bank of China (Argentina) SAU',
  fila2Izq: 'Sociedad Gerente',
  fila2Der: 'Sociedad Depositaria',
}

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
// Extrae el contenido de cada <td> "hoja" del HTML (cualquiera que no
// contenga su PROPIA <table> directamente adentro — si la tiene, es un
// contenedor, no una celda de dato real), recorriendo TODOS los
// niveles de anidamiento con balance real de profundidad. A
// diferencia de un regex no-greedy simple (/<td...>...<\/td>/), que NO
// respeta anidamiento y se "come" contenido de niveles internos de
// forma errática, esto recorta cada celda exactamente bien sin
// importar cuántas tablas anidadas haya alrededor.
//
// Devuelve DOS numeraciones distintas por celda, cada una pensada
// para un momento distinto del ciclo de vida de un campo de texto:
//
// - posicionOrden: posición entre TODAS las celdas-hoja, SIN filtrar
//   por contenido — 0, 1, 2... en orden de aparición puro. Es la que
//   se guarda como identidad ESTABLE de cada campo (lo que viaja como
//   posicionReal en el objeto de campo): vaciar el contenido de una
//   celda no la elimina del documento, así que este número sigue
//   apuntando a la MISMA celda física durante toda la sesión de
//   edición, sin importar cuántas veces se vacíe y se vuelva a
//   escribir. Usar acá el filtro de contenido (como antes) rompía
//   esto: si el usuario vaciaba el primer bullet de dos, el segundo
//   "heredaba" el número 0 al recalcularse, y la próxima escritura
//   terminaba en la celda equivocada.
//
// - posicionContenido: posición SOLO entre las celdas que tienen
//   contenido real (texto > 2 caracteres o una <img>) — las celdas
//   vacías o decorativas (espaciadores de altura fija con &nbsp;, <td>
//   de margen lateral) nunca consumen un número acá. Se usa
//   ÚNICAMENTE una vez, al construir camposOriginales en PanelEditor,
//   para emparejar bien el template (bloque.html) contra el HTML real
//   importado (bloque.htmlEditado): ambos pueden tener distinta
//   cantidad de celdas decorativas alrededor (ej. Borde_Izq_Rojo_Texto
//   trae 2 espaciadores extra que una pieza real puede no tener), así
//   que numerar por posición CRUDA desalinea el texto real entre uno y
//   otro — el panel terminaba mostrando el texto de EJEMPLO del
//   template en vez del texto REAL importado. Filtrando las celdas
//   vacías antes de numerar, la única celda con contenido real cae en
//   la misma posición (0) en ambos lados, sin que la decoración
//   alrededor importe. NUNCA se usa este número para escribir de
//   vuelta en el HTML — solo para leer/emparejar una vez al abrir el
//   panel.
function extraerTdsConBalance(html) {
  const tagRegex = /<td\b[^>]*>|<\/td>/gi
  const celdasCrudas = []
  let profundidad = 0
  const pilaInicio = []
  let m
  while ((m = tagRegex.exec(html)) !== null) {
    const tag = m[0].toLowerCase()
    if (tag.startsWith('<td')) {
      pilaInicio.push({ aperturaIdx: m.index, contenidoInicio: m.index + m[0].length })
      profundidad++
    } else {
      profundidad--
      const ultimo = pilaInicio.pop()
      if (ultimo) celdasCrudas.push({ index: ultimo.aperturaIdx, contenido: html.slice(ultimo.contenidoInicio, m.index) })
    }
  }
  const celdasHoja = celdasCrudas.filter(c => !/<table\b/i.test(c.contenido))

  let posicionContenido = 0
  return celdasHoja.map((c, posicionOrden) => {
    const textoLimpio = c.contenido.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()
    const tieneContenidoReal = textoLimpio.length > 2 || /<img\b/i.test(c.contenido)
    const posicionRealContenido = tieneContenidoReal ? posicionContenido++ : null
    return { index: c.index, contenido: c.contenido, posicionOrden, posicionContenido: posicionRealContenido, tieneContenidoReal }
  })
}

function detectarCampos(html) {
  const campos = []
  const SOCIALES = ['twitter.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'icbcargentina', 'icbc.argentina']

  // Textos en <td>: extraer innerHTML de cada td-hoja con contenido
  // real. posicionReal = posicionContenido — la posición SOLO entre
  // celdas que YA tenían contenido real en este mismo html, ignorando
  // las vacías/decorativas (ver comentario grande junto a
  // extraerTdsConBalance). Esto resuelve el bug original: el template
  // puede traer más o menos celdas decorativas que el HTML real
  // importado (ej. Borde_Izq_Rojo_Texto trae 2 espaciadores extra
  // dentro de su sub-tabla que una pieza real puede no tener) —
  // numerando con posicionOrden (todas las celdas, sin filtrar), la
  // posición del texto real quedaba CORRIDA de forma distinta entre
  // uno y otro, y el panel mostraba el texto de EJEMPLO del template
  // en vez del texto REAL importado.
  //
  // Bug real reportado (uso normal, sin necesidad de importar nada —
  // pasa igual con un bloque recién arrastrado): vaciar el ÚNICO
  // campo de texto de un bloque y después intentar escribir algo
  // nuevo no aplicaba el cambio — quedaba vacío para siempre. Causa
  // raíz: posicionContenido es estable SOLO mientras se calcula una
  // vez y no se vuelve a recalcular contra el HTML ya mutado —
  // actualizarCampoEnHtml y valorActualDeTexto (más abajo, en
  // PanelEditor) SÍ recalculaban extraerTdsConBalance(html) en cada
  // llamada, contra el HTML actual — si la celda ya estaba vacía
  // (porque el usuario la vació en una edición previa, ya confirmada
  // en htmlLocal), esa celda deja de contar como "con contenido" en
  // ESE recálculo, su posicionContenido pasa a ser null, y buscar
  // "la celda con posicionContenido === idx" ya no encuentra nada —
  // el cambio se pierde en silencio. Fix: además de posicionReal
  // (posicionContenido, calculado UNA SOLA VEZ al detectar los campos
  // — sigue resolviendo el problema original de templates con distinta
  // cantidad de celdas decorativas), cada campo guarda también
  // posicionOrden — la posición física entre TODAS las celdas-hoja,
  // sin filtrar por contenido. posicionOrden de una celda dada NUNCA
  // cambia, esté vacía o no — es una propiedad de su posición en el
  // árbol, no de su contenido. actualizarCampoEnHtml y
  // valorActualDeTexto ahora anclan por posicionOrden, no por
  // posicionContenido, así que vaciar y reescribir el mismo campo
  // cualquier cantidad de veces en la misma sesión sigue encontrando
  // la celda correcta siempre.
  //
  // rangosDeTextoEditable guarda el rango [inicio, fin] de cada <td>
  // que SÍ quedó como campo de texto — se usa más abajo para excluir
  // del listado de "Link" cualquier <a> que ya viva DENTRO de uno de
  // esos rangos (ver comentario completo junto al loop de links).
  let textoIdx = 0
  const tds = extraerTdsConBalance(html)
  const rangosDeTextoEditable = []
  for (const { index: tdIndex, contenido: inner, posicionOrden, posicionContenido, tieneContenidoReal } of tds) {
    if (!tieneContenidoReal) continue
    // Una celda con contenido real puede ser SOLO una imagen (sin
    // texto) — eso ya se filtra acá por longitud de texto, y se
    // detecta por separado más abajo como campo de imagen.
    const textoLimpio = inner.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()
    if (textoLimpio.length > 2) {
      campos.push({ tipo: 'texto', label: `Texto ${textoIdx + 1}`, idx: textoIdx, posicionReal: posicionContenido, posicionOrden, contenido: inner })
      textoIdx++
      rangosDeTextoEditable.push([tdIndex, tdIndex + inner.length])
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

  // Links no sociales — bug real reportado: el campo "Link" edita el
  // <a> por su POSICIÓN en el HTML, totalmente independiente de que
  // ese mismo <a> también viva dentro de un <td> que ya se expone como
  // campo de "Texto" de al lado — son dos entradas separadas tocando
  // el mismo HTML. Si el usuario edita el texto y borra (o reescribe)
  // el link desde ahí, el campo de "Link" queda apuntando a un <a> que
  // ya no existe en esa posición, sin ningún indicio de que el cambio
  // no tiene ningún destino real al aplicarlo. La solución: cuando el
  // <a> ya está DENTRO del rango de un <td> que quedó como campo de
  // texto editable, no se lo lista como campo de "Link" aparte — el
  // usuario lo edita directamente desde el texto (RichEditor ya tiene
  // su propio botón 🔗 para seleccionar texto y asignarle/cambiarle el
  // link). Solo queda como campo de "Link" independiente un <a> que
  // vive FUERA de cualquier <td> de texto editable (ej. un botón con
  // imagen y link, sin texto al lado).
  let linkIdx = 0
  const linkRegex = /<a([^>]*)>/gi
  let linkMatch
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const hrefMatch = linkMatch[1].match(/href=["']([^"']*)["']/i)
    if (!hrefMatch) continue
    const href = hrefMatch[1]
    if (SOCIALES.some(s => href.includes(s))) continue
    const dentroDeTextoEditable = rangosDeTextoEditable.some(([inicio, fin]) => linkMatch.index >= inicio && linkMatch.index < fin)
    if (dentroDeTextoEditable) continue
    campos.push({ tipo: 'link', label: `Link ${linkIdx + 1}`, idx: linkIdx, valor: href })
    linkIdx++
  }

  return campos
}

// Actualizar un campo específico en el HTML como string puro
function actualizarCampoEnHtml(html, tipo, idx, cambios) {
  if (tipo === 'texto') {
    // idx acá es posicionOrden (ver detectarCampos / extraerTdsConBalance)
    // — la posición física entre TODAS las celdas-hoja, sin filtrar
    // por contenido. A diferencia de posicionContenido (la posición
    // SOLO entre celdas con contenido real en el momento del cálculo),
    // posicionOrden de una celda dada nunca cambia, esté vacía o no —
    // es una propiedad de su posición en el árbol, no de su estado.
    //
    // Bug real reportado (uso normal — pasa con cualquier bloque, no
    // solo importados): antes esto buscaba por posicionContenido,
    // recalculado en cada llamada contra el `html` actual. Si el
    // usuario ya había vaciado esa celda en una edición previa
    // (confirmada en htmlLocal), la celda dejaba de contar como "con
    // contenido" en ESTE recálculo — su posicionContenido pasaba a
    // ser null, "la celda con posicionContenido === idx" ya no
    // encontraba nada, y el texto nuevo que el usuario quería escribir
    // se perdía en silencio, el campo quedaba vacío para siempre. Con
    // posicionOrden esto no puede pasar: la celda sigue teniendo el
    // mismo posicionOrden esté vacía, llena, o se vacíe y rellene
    // cualquier cantidad de veces en la misma sesión.
    const celdas = extraerTdsConBalance(html)
    const celda = celdas.find(c => c.posicionOrden === idx)
    if (!celda) return html
    const aperturaCompleta = html.slice(celda.index).match(/^<td\b[^>]*>/)[0]
    return html.slice(0, celda.index) + aperturaCompleta + cambios.contenido + '</td>' + html.slice(celda.index + aperturaCompleta.length + celda.contenido.length + '</td>'.length)
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
// El color "de marca" de una banda de Header depende del PREFIJO del
// nombre de archivo, no de un valor fijo — confirmado por la
// convención real: CG_* (Comercial Generalista) es rojo de marca,
// EB_* (Exclusive Banking) es negro, PAY_* (Payroll/Sueldos) es el
// marrón institucional de esa línea (#635843). Si en el futuro se
// suma un prefijo nuevo, cae al rojo de marca por default en vez de
// romper o quedar sin color. Se usa tanto para el thumb de la
// biblioteca (generarThumbSVG) como para el borde de la pieza en el
// export (generarExport, ver conBorde) — una sola fuente de verdad,
// para que cambiar el color de un prefijo no requiera tocar dos
// lugares por separado y arriesgar que se desincronicen.
function colorPorPrefijoHeader(slug) {
  const slugUpper = (slug || '').toUpperCase()
  if (slugUpper.startsWith('EB_')) return '#000000'
  if (slugUpper.startsWith('PAY_')) return '#635843'
  return '#c4161c' // CG_* y cualquier otro prefijo no reconocido
}

function generarThumbSVG(bloque) {
  const colores = {
    Header: { bg: colorPorPrefijoHeader(bloque.slug), fg: '#ffffff', accent: '#ffffff' },
    Contenido: { bg: '#f5f5f5', fg: '#333333', accent: '#c4161c' },
    Botones: { bg: '#f5f5f5', fg: '#333333', accent: '#c4161c' },
  }
  const { bg, fg, accent } = colores[bloque.categoria] || colores.Contenido

  const esBoton = /btn|boton|button/i.test(bloque.nombre)
  const esBullet = /bullet/i.test(bloque.nombre)
  const esEspaciador = /espaciador|space/i.test(bloque.nombre)
  const esIcono = /icono|icon/i.test(bloque.nombre)

  let contenido = ''

  // Cualquier banda de Header usa el MISMO thumb (4 círculos blancos
  // simulando los íconos de redes + 2 líneas simulando el logo/firma)
  // — antes solo CG_Banda_Roja_Header lo tenía, y los demás headers
  // (Mall, Comex, y los nuevos Pay/EB) caían al genérico de 4 barras
  // grises sin sentido, ya que las 3 (ahora 5) bandas de header
  // comparten exactamente la misma estructura visual, solo cambia el
  // color de fondo (ya resuelto arriba con bgHeaderPorPrefijo).
  if (bloque.categoria === 'Header') {
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
  } else if (bloque.slug === 'CG_Modulo_Simple_Editable_PF') {
    // 2 cajas con BORDE rojo y fondo rojo (no imágenes sólidas como
    // Modulo_Doble_Clasico) — distingue visualmente el patrón de
    // "tasa/dato numérico destacado en caja", separadas por un punto
    // vertical, igual al bloque real (tasa nominal anual + porcentaje).
    contenido = `
      <rect x="15" y="8" width="75" height="64" rx="2" fill="none" stroke="#c4161c" stroke-width="3"/>
      <rect x="22" y="30" width="61" height="6" rx="2" fill="#ffffff" opacity="0.9"/>
      <circle cx="100" cy="40" r="2" fill="${accent}" opacity="0.6"/>
      <rect x="110" y="8" width="75" height="64" rx="2" fill="none" stroke="#c4161c" stroke-width="3"/>
      <text x="147" y="48" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="bold" font-family="Arial">%</text>`
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
  } else if (bloque.slug === 'Imagen_Libre') {
    // Marco con ícono de "foto" clásico (montaña + sol) — distingue
    // visualmente este bloque del genérico de "líneas de texto", ya
    // que es un bloque de SOLO imagen, sin ningún campo de texto.
    contenido = `
      <rect x="20" y="12" width="160" height="56" rx="3" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5"/>
      <circle cx="60" cy="32" r="7" fill="${accent}" opacity="0.4"/>
      <path d="M30 60 L70 35 L95 50 L130 25 L170 60 Z" fill="${accent}" opacity="0.25"/>`
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
// invisibles, mismo estilo que ya tenía el HTML original
// (<!--HEADER: Redes -->) — no son visibles en ningún cliente de
// correo, y permiten que una futura función de "leer HTML por link"
// pueda reconocer e identificar cada sección (bloque de contenido,
// header, imagen principal/footer, legal específico, indicadores) sin
// tener que adivinar por estructura de tags. La funcionalidad de
// lectura en sí no se construye ahora, esto es solo dejar el export ya
// preparado para cuando se construya. Documentación completa del
// formato de cada marcador: ver README.md, sección "Marcadores del
// Editor de Piezas".
//
// BLOQUE lleva slug + idx como atributos del propio comentario
// (<!--BLOQUE slug="x" idx="0"-->), no como un único valor separado
// por ":" — un bloque puede repetirse varias veces en la misma pieza
// (dos "Bloque_Texto_Base", por ejemplo), así que el slug solo no
// alcanza para distinguir instancias. idx es la posición en el array
// canvas, no un contador por slug, así dos bloques de slugs distintos
// en posiciones 0 y 1 son igual de identificables que dos iguales. El
// formato con atributos con comillas (en vez de "slug:idx") evita
// cualquier ambigüedad de dónde corta un split si el slug llegara a
// tener caracteres raros.
function generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalesAdicionales = [], legalesSeparados = false, firmaInstitucional = null, indicadores, tema = TEMA_DEFAULT, redesOrden = null }) {
  const { bgContenido, colorTexto, conBorde } = TEMAS[tema] || TEMAS[TEMA_DEFAULT]
  // El color del borde (y el fondo de esa misma tabla cuando el tema
  // no lleva borde, ej. Avisos) sigue al HEADER elegido, no al tema:
  // CG_* -> rojo, EB_* -> negro, PAY_* -> marrón Payroll. Antes
  // quedaba fijo en el rojo de marca sin importar qué header se
  // hubiera elegido.
  const colorMarca = colorPorPrefijoHeader(bandaHeader?.slug)
  const contenidoRows = canvas.map((b, idx) => {
    const slug = b.slug || b.id || 'bloque'
    const html = aplicarColorTexto(limpiarHtmlExport(b.htmlEditado || b.html), colorTexto)
    // Atributo opcional, solo presente en bloques de código
    // personalizado que vinieron de contenido detectado fuera del
    // área de contenido esperada (ver comentario grande junto a
    // encontrarTablaContenido) — permite que
    // marcarBloquesNoReconocidosParaPreview los resalte con un color
    // distinto al de "no reconocido" genérico, sin afectar el resto
    // del parsing del marcador (que solo lee slug e idx).
    const origenAttr = b.instanceId?.includes('fuera-de-rango') ? ' origen="fuera-de-rango"' : ''
    return `<!--BLOQUE slug="${slug}" idx="${idx}"${origenAttr}-->\n${html}\n<!--/BLOQUE-->`
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

  // Dos modos de concatenar los legales adicionales (el legal FIJO
  // siempre va al final, en los dos modos):
  //  - "corrido" (DEFAULT): todos pegados como texto seguido, un punto
  //    y seguido tras otro, en la MISMA celda — es el comportamiento
  //    normal/de siempre, no cambia nada para el caso común (un legal
  //    o ninguno).
  //  - "separado": cada legal en su PROPIA fila/celda, separados por
  //    un espaciador de 14px — solo tiene sentido activarlo cuando se
  //    van a sumar varios legales largos, para evitar que algunos
  //    proveedores de correo detecten el bloque de texto corrido como
  //    sospechoso y lo bloqueen (confirmado contra el HTML real de
  //    Mall). Es una opción explícita, no el default, porque la
  //    mayoría de las piezas tienen un legal corto o ninguno y no
  //    necesitan esto.
  const ESPACIADOR_14 = `<tr>\n<td colspan="3" style="height: 14px; font-size: 0px;" height="14">&nbsp;</td>\n</tr>`
  // idx es un atributo SEPARADO (data-legal-idx), no el valor de
  // dataAttr — data-legal-especifico/data-legal-fijo funcionan como
  // flag de TIPO ("qué es este span") y conviene que sigan siendo
  // siempre "true", sin mezclar ahí la POSICIÓN. Si el índice viajara
  // como valor de ese mismo atributo, cualquier chequeo que solo
  // necesite el tipo (el.dataset.legalEspecifico) se rompería en
  // cuanto el valor deja de ser literalmente "true". El legal fijo no
  // lleva idx (es único, no se repite), por eso el parámetro es
  // opcional.
  function filaLegal(html, dataAttr, idx) {
    const idxAttr = idx != null ? ` data-legal-idx="${idx}"` : ''
    return `<tr>\n<td width="35"></td>\n<td class="Texto_Legales" style="font-family: Arial, Helvetica, Open Sans, sans-serif; font-size: 14px; font-weight: bold; line-height: 16px; color: #333333; text-align: justify; word-break: break-word; overflow-wrap: anywhere; word-wrap: break-word;" align="center"><span ${dataAttr}="true"${idxAttr}>${html}</span></td>\n<td width="35"></td>\n</tr>`
  }
  const legalesConTexto = legalesAdicionales.filter(l => l.texto.trim())

  let legalesHtml
  if (legalesSeparados) {
    const filasLegalesAdicionales = legalesConTexto.map((l, idx) => filaLegal(legalHtmlExport(l.texto), 'data-legal-especifico', idx))
    const todasLasFilasLegal = [...filasLegalesAdicionales, filaLegal(LEGAL_FIJO_HTML, 'data-legal-fijo')]
    legalesHtml = todasLasFilasLegal.join(`\n${ESPACIADOR_14}\n`)
  } else {
    // Texto corrido — mismo formato que el comportamiento original:
    // todos los legales adicionales (cada uno como su propio <span>,
    // por los marcadores invisibles que preparan la futura lectura
    // por link) seguidos por un espacio, y el legal fijo al final,
    // todo en una sola fila/celda.
    const especificosHtml = legalesConTexto
      .map((l, idx) => `<span data-legal-especifico="true" data-legal-idx="${idx}">${legalHtmlExport(l.texto)}</span> `)
      .join('')
    legalesHtml = `<tr>\n<td width="35"></td>\n<td class="Texto_Legales" style="font-family: Arial, Helvetica, Open Sans, sans-serif; font-size: 14px; font-weight: bold; line-height: 16px; color: #333333; text-align: justify; word-break: break-word; overflow-wrap: anywhere; word-wrap: break-word;" align="center">${especificosHtml}<span data-legal-fijo="true">${LEGAL_FIJO_HTML}</span></td>\n<td width="35"></td>\n</tr>`
  }

  // Firma institucional (ICBC Investments / Sociedad Gerente-
  // Depositaria) — sección fija opcional, ver comentario junto a
  // FIRMA_INSTITUCIONAL_DEFAULT. Envuelta en marcador propio
  // <!--FIRMA_INSTITUCIONAL--> (mismo criterio que <!--INDICADORES-->)
  // para que el importador la reconozca como bloque propio y NUNCA la
  // confunda con legales adicionales sueltos — bug real que motivó
  // este fix: el importador heurístico veía cada uno de estos 4 <td
  // class="Texto_Legales"> como un "legal adicional" independiente (la
  // detección de legales no distinguía por estructura, solo por la
  // clase CSS), y como había más de una fila con esa clase, activaba
  // por error el modo "legales separados" — el resultado visual era
  // texto corrido apilado con espaciadores, en vez de la firma de 2
  // columnas real. Estructura fija de 2 filas x 2 columnas (no es una
  // lista abierta, a diferencia de Legales adicionales/Indicadores):
  // se usa una sub-tabla de 2 <td> dentro del <td> de contenido
  // (35px/contenido/35px), igual formato que pidió el usuario, para
  // que aplique bien sobre el wrapper base que ya usa el resto de
  // legales.
  function filaFirmaInstitucional(izq, der, dataAttr) {
    return `<tr>\n<td width="35"></td>\n<td>\n<table style="width: 100%;" cellspacing="0" cellpadding="0" border="0">\n<tbody>\n<tr>\n<td class="Texto_Legales" style="font-family: Arial, Helvetica, Open Sans, sans-serif; font-size: 14px; font-weight: bold; line-height: 16px; color: #333333; text-align: left; word-break: break-word; overflow-wrap: anywhere; word-wrap: break-word;" align="center"><span ${dataAttr}-izq="true">${izq}</span></td>\n<td class="Texto_Legales" style="font-family: Arial, Helvetica, Open Sans, sans-serif; font-size: 14px; font-weight: bold; line-height: 16px; color: #333333; text-align: right; word-break: break-word; overflow-wrap: anywhere; word-wrap: break-word;" align="center"><span ${dataAttr}-der="true">${der}</span></td>\n</tr>\n</tbody>\n</table>\n</td>\n<td width="35"></td>\n</tr>`
  }
  const firmaInstitucionalHtml = firmaInstitucional?.activo
    ? `<!--FIRMA_INSTITUCIONAL-->\n` +
      filaFirmaInstitucional(firmaInstitucional.fila1Izq, firmaInstitucional.fila1Der, 'data-firma-fila1') + '\n' +
      filaFirmaInstitucional(firmaInstitucional.fila2Izq, firmaInstitucional.fila2Der, 'data-firma-fila2') +
      `\n<!--/FIRMA_INSTITUCIONAL-->`
    : ''

  // Bug real encontrado en revisión a fondo previa al primer push: la
  // reimportación (importarDesdeHtml, ver más abajo) separaba sigla y
  // valor por POSICIÓN DE PALABRA (la primera palabra después del
  // </sup> es la sigla, el resto es el valor) — funciona bien para el
  // caso típico de una sola palabra ("CFTNA"), pero el campo de sigla
  // en el panel es un input de texto libre sin ninguna restricción: si
  // el usuario escribe una sigla de más de una palabra (ej. "TNA
  // Adelantada", "Tasa Efectiva"), la reimportación corta mal — solo
  // la primera palabra queda como sigla, el resto se cuela dentro del
  // valor. Se marca cada parte con su propio <span data-indicador-
  // sigla/valor="true">, mismo criterio que ya se usa para la firma
  // institucional — la reimportación ya no necesita adivinar dónde
  // termina la sigla y empieza el valor, lo lee directo de cada span.
  const indicadoresHtml = indicadores.length > 0
    ? `<!--INDICADORES-->\n` + indicadores.map(ind =>
        `<tr>\n<td width="35"></td>\n<td style="font-family: Arial, Helvetica, sans-serif; font-size: 85px; text-align: right; color: #333333; font-weight: bold;"><sup style="font-size: 85px;">${ind.ref}</sup> <span data-indicador-sigla="true">${ind.sigla}</span> <span data-indicador-valor="true">${ind.valor}</span></td>\n<td width="35"></td>\n</tr>`
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
<table style="max-width: 600px; ${conBorde ? `background-color: #ffffff; border: solid 1px ${colorMarca};` : `background-color: ${colorMarca};`}" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${conBorde ? '#ffffff' : colorMarca}" align="center"><!--HEADER:${bandaHeader?.slug || 'ninguno'}-->
<tbody>
<tr>
<td width="100%" valign="top" bgcolor="${colorMarca}" align="center"><!--[if (gte mso 9)|(IE)]><table align='center' border='0' cellspacing='0' cellpadding='0' width='600'><tr><td align='center' valign='top' width='600'><![endif]-->
${reordenarRedesSociales(bandaHeader?.html || '', redesOrden)}
<!--/HEADER--><!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td>
</tr>
${imgPrincipalHtml}
<tr>
<td style="background-color: ${bgContenido};" width="100%" valign="top" bgcolor="${bgContenido}" align="center">
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
${legalesHtml}
<tr>
<td colspan="3" style="height: 28px; font-size: 0px;" height="28">&nbsp;</td>
</tr>
${firmaInstitucionalHtml}${firmaInstitucionalHtml ? `\n<tr>\n<td colspan="3" style="height: 28px; font-size: 0px;" height="28">&nbsp;</td>\n</tr>\n` : ''}${indicadoresHtml}
</tbody>
</table>
<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></td>
</tr>
</tbody>
</table>`
}

// ─── Importador de marcadores (Fase 1 — solo piezas exportadas por
// ESTE editor, ya con marcadores) ───────────────────────────────────
// Contraparte de generarExport: lee un HTML ya exportado y reconstruye
// el objeto de estado equivalente al que recibe generarExport. Formato
// completo de cada marcador documentado en README.md, sección
// "Marcadores del Editor de Piezas" — no duplicar esa explicación
// acá, solo el código.
//
// Devuelve { resultado, avisos } en vez de tirar excepción ante cada
// problema parcial: un solo bloque con slug desconocido (template
// borrado desde que se exportó esa pieza) no debe tirar abajo la
// importación completa de los otros 10 bloques que sí matchean bien —
// ese bloque entra igual, con su contenido HTML intacto, pero como
// "Código personalizado" en vez de un bloque con campos detectados
// (mismo tipo que ya existe en la biblioteca para HTML escrito a
// mano). avisos junta esos casos para mostrarlos en la UI ("3 de 12
// bloques no se reconocieron, revisalos") — fail soft, no fail hard.
// Solo se tira null en el caso de que el HTML ni siquiera tenga UN
// marcador de BLOQUE — ahí no es una pieza de este editor, no una
// pieza con algunos bloques desactualizados, y corresponde el mensaje
// de "no se pudo leer" en vez de devolver un canvas vacío en silencio.
function importarDesdeHtml(html) {
  const avisos = []

  // ── Tema ───────────────────────────────────────────────────────────
  // Se detecta ANTES que los bloques de contenido, a propósito: el
  // colorTexto de este tema es necesario para revertir el color que
  // generarExport "quemó" en cada bloque al exportar (ver
  // revertirColorTexto más abajo) — sin esto, los bloques quedarían
  // con el color del tema pegado en su htmlEditado, en vez del valor
  // base #333333 que el resto del editor espera encontrar ahí.
  //
  // Sin marcador propio — se infiere por igualdad EXACTA contra
  // bgContenido de cada TEMAS conocido. Importante: NO basta buscar
  // "background-color: X;" suelto en cualquier parte del HTML — ese
  // mismo patrón también aparece en el <td> de la banda de HEADER
  // (con el color del header, no del tema) y puede coincidir por pura
  // casualidad con uno de los 3 colores de TEMAS (ej. un header negro
  // comparte el mismo "#2e2f31" que el tema Mall). El ancla tiene que
  // ser el <td> específico que generarExport realmente usa para
  // bgContenido: `style="background-color: X;" width="100%" valign="top" bgcolor="X"`
  // (línea exacta de la zona de contenido, ver generarExport) — ese
  // combo de atributos en ese orden es el que la función realmente
  // escribe, y no se repite en ningún otro <td> de la plantilla.
  let tema = TEMA_DEFAULT
  for (const [key, def] of Object.entries(TEMAS)) {
    const anclaContenido = `style="background-color: ${def.bgContenido};" width="100%" valign="top" bgcolor="${def.bgContenido}"`
    if (html.includes(anclaContenido)) { tema = key; break }
  }
  const colorTextoDetectado = TEMAS[tema].colorTexto

  // ── Bloques de contenido ──────────────────────────────────────────
  // idx en el marcador es la posición real en el array canvas (puesta
  // por generarExport al exportar), no un contador propio del parser
  // — se usa directo para ordenar, no se re-cuenta acá. Si por algún
  // motivo dos bloques compartieran el mismo idx (HTML corrupto/editado
  // a mano), se ordena por idx numérico y listo: el último en aparecer
  // con ese idx pisa al anterior en el sort, no se intenta adivinar
  // cuál de los dos es el "correcto".
  const bloqueRegex = /<!--BLOQUE\s+slug="([^"]+)"\s+idx="(\d+)"(?:\s+\w+="[^"]*")*\s*-->([\s\S]*?)<!--\/BLOQUE-->/g
  const bloquesEncontrados = []
  let bloqueMatch
  while ((bloqueMatch = bloqueRegex.exec(html)) !== null) {
    const [, slug, idxStr, contenido] = bloqueMatch
    bloquesEncontrados.push({ slug, idx: Number(idxStr), contenido: contenido.trim() })
  }

  if (bloquesEncontrados.length === 0) {
    // Ni un solo <!--BLOQUE--> en todo el HTML — no es una pieza
    // exportada por este editor (o es una versión tan vieja que no
    // tenía marcadores todavía). No es el caso de "bloques
    // desactualizados", es "no hay nada reconocible" — se devuelve
    // null para que el llamador muestre el error correspondiente, en
    // vez de un canvas vacío que parecería una pieza en blanco válida.
    return { resultado: null, avisos: [{ texto: 'No se encontró ningún marcador de bloque en el HTML — no parece ser una pieza exportada por este editor.', tipo: 'general', canvasIdx: null }] }
  }

  bloquesEncontrados.sort((a, b) => a.idx - b.idx)
  const canvas = bloquesEncontrados.map(({ slug, contenido }, posicionFinal) => {
    // Revertir el color del tema al neutro #333333 ANTES de guardar
    // como htmlEditado — ver comentario completo junto a
    // revertirColorTexto(). Se aplica siempre, incluso para bloques
    // sin template conocido (Código personalizado), porque el mismo
    // problema de recoloreo futuro aplica igual a esos bloques.
    const contenidoNeutro = revertirColorTexto(contenido, colorTextoDetectado)
    const original = BLOQUES.find(b => b.slug === slug)
    if (!original) {
      // Slug que ya no existe en BLOQUES (template renombrado o
      // borrado desde que se exportó esta pieza) — el contenido real
      // sigue estando completo entre los marcadores, así que no se
      // pierde nada: entra como bloque de tipo "Código personalizado"
      // (el mismo que ya existe para HTML escrito a mano), conservando
      // su posición y contenido exactos, solo sin los campos
      // detectados de un template que ya no está.
      avisos.push({ texto: `El bloque "${slug}" no coincide con ningún template actual — se importó como código personalizado.`, tipo: 'no-reconocido', canvasIdx: posicionFinal })
      return { id: 'codigo', instanceId: `codigo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: contenidoNeutro, htmlEditado: contenidoNeutro, tipo: 'codigo', slug: 'codigo' }
    }
    // htmlEditado = el contenido real tal cual quedó en la pieza
    // exportada (ya revertido al color neutro) — puede diferir del
    // html original del template si el usuario editó campos. html =
    // el original, igual que crearInstancia, para que "Reiniciar
    // campo" siga teniendo a qué volver. Para Imagen_Libre se
    // normaliza además el <img> para garantizar los estilos base.
    const slugFinal = corregirSlugIcono(slug, contenidoNeutro)
    const originalFinal = slugFinal !== slug ? (BLOQUES.find(b => b.slug === slugFinal) || original) : original
    const htmlEditadoFinal = slugFinal === 'Imagen_Libre'
      ? normalizarImagenLibre(contenidoNeutro)
      : contenidoNeutro
    return { ...originalFinal, instanceId: `${originalFinal.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, htmlEditado: htmlEditadoFinal }
  })

  // ── Header ─────────────────────────────────────────────────────────
  // Único marcador sin idx — solo hay una banda de header por pieza.
  const headerMatch = html.match(/<!--HEADER:([^-]+)-->/)
  const headerSlug = headerMatch ? headerMatch[1] : null
  let bandaHeader = headerSlug ? BLOQUES_HEADER.find(b => b.slug === headerSlug) ?? null : null
  if (headerSlug && !bandaHeader) avisos.push({ texto: `El header "${headerSlug}" no coincide con ningún header actual — se mantuvo el header por defecto.`, tipo: 'general', canvasIdx: null })
  if (!bandaHeader) bandaHeader = BLOQUES_HEADER[0] ?? null

  // redesOrden: mismo criterio que importarHeuristico — generarExport
  // ya escribe el HTML real de la banda CON las redes ya filtradas por
  // redesOrden (ver reordenarRedesSociales(bandaHeader?.html, redesOrden)
  // justo después del marcador <!--HEADER:slug-->), así que detectar
  // las redes sobre ESE html real (no sobre bandaHeader.html, el
  // template completo) reconstruye el estado real de la pieza
  // exportada — si el usuario había desactivado alguna red al armarla,
  // la importación debe respetar eso, no volver a activarlas todas.
  const idxHeaderMarker = headerMatch ? headerMatch.index + headerMatch[0].length : 0
  const htmlZonaHeader = html.slice(idxHeaderMarker, idxHeaderMarker + 3000)
  const redesOrdenDetectado = detectarRedesSociales(htmlZonaHeader, true)

  // ── Imagen principal / footer ───────────────────────────────────────
  // Marcadores únicos que solo aparecen si la pieza los tenía activos
  // — si no están, imgPrincipal/imgFooter quedan en su default inactivo,
  // mismo shape que usa el estado inicial del editor.
  const imgPrincipalBloque = html.match(/<!--IMG_PRINCIPAL-->([\s\S]*?)<!--\/IMG_PRINCIPAL-->/)?.[1] ?? ''
  const imgPrincipalSrc = imgPrincipalBloque.match(/<img[^>]*\ssrc="([^"]*)"/)?.[1] ?? ''
  const imgPrincipal = imgPrincipalSrc
    ? {
        activo: true,
        src: imgPrincipalSrc,
        alt: imgPrincipalBloque.match(/\salt="([^"]*)"/)?.[1] ?? '',
        title: imgPrincipalBloque.match(/\stitle="([^"]*)"/)?.[1] ?? '',
        link: imgPrincipalBloque.match(/<a\s+href="([^"]*)"/)?.[1] ?? '',
      }
    : { activo: false, src: '', alt: '', title: '', link: '' }

  const imgFooterBloque = html.match(/<!--IMG_FOOTER-->([\s\S]*?)<!--\/IMG_FOOTER-->/)?.[1] ?? ''
  const imgFooterSrc = imgFooterBloque.match(/<img[^>]*\ssrc="([^"]*)"/)?.[1] ?? ''
  const imgFooter = imgFooterSrc
    ? {
        activo: true,
        src: imgFooterSrc,
        alt: imgFooterBloque.match(/\salt="([^"]*)"/)?.[1] ?? '',
        link: imgFooterBloque.match(/<a\s+href="([^"]*)"/)?.[1] ?? '',
      }
    : { activo: false, src: '', alt: '', link: '' }

  // ── Legales adicionales ──────────────────────────────────────────────
  // data-legal-idx ordena el array reconstruido — mismo criterio que
  // idx en BLOQUE, no se re-cuenta, se usa el valor tal cual viaja en
  // el HTML. legalHtmlExport ya convierte el texto a HTML al exportar
  // (saltos de línea, etc.) — acá se deja el contenido tal cual está,
  // sin intentar revertir esa transformación a texto plano, porque el
  // campo de edición de legales ya acepta y muestra HTML simple.
  const legalRegex = /<span data-legal-especifico="true" data-legal-idx="(\d+)">([\s\S]*?)<\/span>/g
  const legalesEncontrados = []
  let legalMatch
  while ((legalMatch = legalRegex.exec(html)) !== null) {
    legalesEncontrados.push({ idx: Number(legalMatch[1]), texto: legalMatch[2].trim() })
  }
  legalesEncontrados.sort((a, b) => a.idx - b.idx)
  const legalesAdicionales = legalesEncontrados.map(l => ({ id: Date.now() + l.idx, texto: l.texto }))

  // legalesSeparados no tiene marcador propio — se infiere de cuántas
  // filas <tr> hay entre el primer y el último legal: en modo separado
  // cada legal vive en su propia fila con un espaciador de 14px entre
  // medio (ver ESPACIADOR_14 en generarExport); en modo corrido todos
  // los <span> conviven en la misma fila/celda. Contar cuántas filas
  // <tr> distintas contienen un data-legal-especifico es más simple y
  // más confiable que intentar parsear el espaciador en sí.
  const filasConLegal = new Set()
  const trRegex = /<tr>([\s\S]*?)<\/tr>/g
  let trMatch
  while ((trMatch = trRegex.exec(html)) !== null) {
    if (trMatch[1].includes('data-legal-especifico') || trMatch[1].includes('data-legal-fijo')) filasConLegal.add(trMatch[0])
  }
  const legalesSeparados = filasConLegal.size > 1

  // ── Firma institucional ─────────────────────────────────────────────
  // Mismo criterio que Indicadores: marcador propio que envuelve el
  // bloque entero, y dentro se buscan los 4 textos por sus propios
  // atributos data-firma-fila1-izq/der, data-firma-fila2-izq/der (ver
  // generarExport). Si el marcador no aparece, firmaInstitucional
  // queda null -> el toggle nace apagado, igual que cualquier pieza
  // sin esta sección.
  const firmaInstitucionalBloque = html.match(/<!--FIRMA_INSTITUCIONAL-->([\s\S]*?)<!--\/FIRMA_INSTITUCIONAL-->/)?.[1] ?? null
  const firmaInstitucional = firmaInstitucionalBloque ? {
    activo: true,
    fila1Izq: firmaInstitucionalBloque.match(/<span data-firma-fila1-izq="true">([\s\S]*?)<\/span>/)?.[1]?.trim() ?? FIRMA_INSTITUCIONAL_DEFAULT.fila1Izq,
    fila1Der: firmaInstitucionalBloque.match(/<span data-firma-fila1-der="true">([\s\S]*?)<\/span>/)?.[1]?.trim() ?? FIRMA_INSTITUCIONAL_DEFAULT.fila1Der,
    fila2Izq: firmaInstitucionalBloque.match(/<span data-firma-fila2-izq="true">([\s\S]*?)<\/span>/)?.[1]?.trim() ?? FIRMA_INSTITUCIONAL_DEFAULT.fila2Izq,
    fila2Der: firmaInstitucionalBloque.match(/<span data-firma-fila2-der="true">([\s\S]*?)<\/span>/)?.[1]?.trim() ?? FIRMA_INSTITUCIONAL_DEFAULT.fila2Der,
  } : null

  // ── Indicadores ───────────────────────────────────────────────────────
  // INDICADORES envuelve el grupo entero, no cada fila — se parsean las
  // filas internas por estructura (son todas idénticas entre sí: un
  // <sup> con la referencia, seguido de sigla y valor), no por
  // marcador individual, ver nota en README.
  //
  // Bug real encontrado en revisión a fondo previa al primer push: el
  // método anterior separaba sigla/valor por POSICIÓN DE PALABRA (la
  // primera palabra es la sigla, el resto es el valor) — se rompía si
  // el usuario escribía una sigla de más de una palabra (ej. "TNA
  // Adelantada"), ya que el campo es texto libre sin restricción. Fix:
  // generarExport ahora marca cada parte con su propio
  // <span data-indicador-sigla/valor="true">. Se intenta esa vía
  // primero (100% confiable, sin ambigüedad posible); si una pieza fue
  // exportada ANTES de este fix (sin los spans) se cae al método viejo
  // como fallback, para no perder la capacidad de reimportar piezas ya
  // generadas con la versión anterior del editor.
  const indicadoresBloque = html.match(/<!--INDICADORES-->([\s\S]*?)<!--\/INDICADORES-->/)?.[1] ?? ''
  const indicadores = []
  const filaIndicadorRegex = /<sup[^>]*>([\s\S]*?)<\/sup>([\s\S]*?)<\/td>/g
  let indMatch
  while ((indMatch = filaIndicadorRegex.exec(indicadoresBloque)) !== null) {
    const ref = indMatch[1].trim()
    const restoFila = indMatch[2]
    const siglaSpan = restoFila.match(/<span data-indicador-sigla="true">([\s\S]*?)<\/span>/)
    const valorSpan = restoFila.match(/<span data-indicador-valor="true">([\s\S]*?)<\/span>/)
    let sigla, valor
    if (siglaSpan && valorSpan) {
      sigla = siglaSpan[1].trim()
      valor = valorSpan[1].trim()
    } else {
      // Fallback: pieza vieja, sin spans — método anterior por
      // posición de palabra (limitado a sigla de una sola palabra).
      const resto = restoFila.replace(/<[^>]+>/g, '').trim().split(/\s+/)
      sigla = resto[0] ?? ''
      valor = resto.slice(1).join(' ')
    }
    indicadores.push({ id: Date.now() + indicadores.length, ref, sigla, valor })
  }

  return {
    resultado: { bandaHeader, redesOrden: redesOrdenDetectado, tema, canvas, imgPrincipal, imgFooter, legalesAdicionales, legalesSeparados, firmaInstitucional, indicadores },
    avisos,
  }
}

// Resalta visualmente, dentro del preview del modal de importar, los
// bloques que cayeron como "Código personalizado" (no reconocidos por
// ningún template, o detectados fuera del área de contenido esperada)
// — para que el usuario vea de un vistazo QUÉ partes de la pieza
// importada necesitan revisión, en vez de tener que adivinar leyendo
// el aviso de texto y comparando contra el preview. Cada bloque
// marcado lleva un id="preview-bloque-N" (N = idx real en canvas) para
// que el modal pueda hacer scrollIntoView() directo desde el listado
// de avisos clickeable. Solo se usa en este preview de importación,
// nunca en generarExport() real — el HTML final exportado/copiado
// nunca debe llevar este overlay.
//
// Funciona en dos pasos sobre el HTML YA generado por generarExport():
// 1) Ubica cada marcador <!--BLOQUE slug="codigo" idx="N"-->...
//    <!--/BLOQUE--> (slug="codigo" es exactamente lo que
//    importarHeuristico/importarDesdeHtml asignan a un bloque sin
//    match), con su atributo opcional origen="fuera-de-rango" (ver
//    generarExport) para elegir el color correcto.
// 2) Envuelve ese contenido en un wrapper con outline punteado y una
//    etiqueta flotante — todo dentro del DOCUMENTO del iframe, no
//    como un <div> de React superpuesto desde afuera (el iframe es un
//    documento aislado, React no tiene acceso a las coordenadas
//    internas de lo que renderiza ahí).
function marcarBloquesNoReconocidosParaPreview(html) {
  return html.replace(
    /<!--BLOQUE slug="codigo" idx="(\d+)"(?:\s+origen="([^"]*)")?-->([\s\S]*?)<!--\/BLOQUE-->/g,
    (_match, idx, origen, contenidoBloque) => {
      const esFueraDeRango = origen === 'fuera-de-rango'
      const color = esFueraDeRango ? '#DC2626' : '#F59E0B'
      const colorFondo = esFueraDeRango ? 'rgba(220, 38, 38, 0.08)' : 'rgba(245, 158, 11, 0.08)'
      const etiqueta = esFueraDeRango ? 'Fuera de lugar' : 'No reconocido'
      return `
      <tr><td id="preview-bloque-${idx}" style="padding: 0; position: relative;">
        <div style="position: relative; outline: 2px dashed ${color}; outline-offset: -2px; background: ${colorFondo};">
          <span style="position: absolute; top: 2px; left: 2px; z-index: 1; background: ${color}; color: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 3px; line-height: 1;">${etiqueta}</span>
          <table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>${contenidoBloque}</tbody></table>
        </div>
      </td></tr>`
    }
  )
}

// ─── Heurística sin marcadores (Fase 2 — piezas EXTERNAS, sin
// marcadores de este editor) ─────────────────────────────────────────
// Validado contra 10 piezas reales de la plataforma (no contra un
// solo supuesto) — confirmó DOS familias estructurales reales, no
// una sola con variaciones menores:
//
//  Familia A (la mayoría): newsletters con banda de redes sociales en
//  el header. El contenedor de contenido es
//  <td style="width: 530px; ...padding: 35px;"> con
//  <table id="Show" style="max-width: 530px;"> adentro — id="Show"
//  SIEMPRE presente en esta familia.
//
//  Familia B (comunicaciones de Inversiones/Empresas, sin banda de
//  redes): el contenedor exterior es
//  <td style="max-width: 600px; padding: 35px;"> (max-width 600, NO
//  width 530) y la tabla de contenido interna NO tiene id="Show".
//
// El único rasgo común a ambas, confirmado en las 10 piezas sin
// excepción: la tabla de CONTENIDO real siempre es la única <table>
// de la pieza con max-width o width igual a 530 que NO está anidada
// dentro de un bloque individual (los bloques internos usan otros
// anchos — 265px en módulos dobles, 100px/86px en iconos — nunca
// 530). Por eso esta función prioriza id="Show" cuando existe (100%
// confiable, Familia A) y cae a buscar la tabla de ~530px como
// respaldo (cubre Familia B) — nunca al revés, y nunca confía en
// comentarios HTML del diseñador (<!-- INICIO CAJA -->, etc.) como
// ancla de bloques: son anotaciones personales, no marcadores
// estructurales, y varían pieza a pieza.
//
// También confirmado: puede haber wrappers externos variables que
// esta misma plataforma no siempre genera igual (ej. un
// <table id="Table_01"> envolviendo TODA la pieza en un caso real) —
// por eso esta función nunca ancla el INICIO del parseo a comentarios
// como <!-- INICIO CONTENEDOR -->, va directo a buscar la tabla de
// contenido sin importar qué la envuelve por fuera.
//
// A diferencia de importarDesdeHtml (marcadores, 100% determinístico),
// esto es heurística de mejor esfuerzo — la firma incluye `confianza`
// para que la UI pueda avisar "no se pudo reconocer con seguridad,
// preferible armar la pieza a mano" en vez de mostrar un resultado
// parcial como si fuera confiable.

// Encuentra el rango [inicioContenido, finContenido] de la tabla de
// contenido real, con balance de profundidad genuino — nunca con un
// regex simple de "primera ocurrencia hasta el próximo </table>",
// porque esa tabla tiene MUCHAS tablas anidadas adentro (cada bloque
// trae las suyas) y un regex naive cortaría en el primer </table>
// interno, no en el real.
function encontrarTablaContenido(html) {
  // Prioridad 1: id="Show" — exclusivo de la tabla de contenido en
  // Familia A, nunca aparece en ningún otro lugar de la plantilla.
  const showMatch = html.match(/<table[^>]*\bid="Show"[^>]*>/)
  let inicioTag = showMatch ? showMatch.index : null
  let viaShow = !!showMatch

  // Prioridad 2 (Familia B, sin id="Show"): la única <table> con
  // max-width o width = 530 — se valida cada candidata por balance
  // real para descartar coincidencias dentro de un bloque (ningún
  // bloque conocido usa 530px, pero la validación es defensiva ante
  // piezas que esta muestra no cubrió).
  if (inicioTag == null) {
    const candidatas = [...html.matchAll(/<table[^>]*style="[^"]*(?:max-)?width:\s*530px[^"]*"[^>]*>/g)]
    if (candidatas.length > 0) {
      // La primera candidata en aparecer es la tabla de contenido real
      // en las 10 piezas analizadas — si en el futuro apareciera más
      // de una candidata legítima, tomar la primera es la opción más
      // segura (la de contenido siempre precede a cualquier otra cosa
      // que pudiera compartir ese ancho por casualidad, como un footer
      // raro), nunca la última.
      inicioTag = candidatas[0].index
    }
  }

  // Prioridad 3 (piezas viejas, sin 530px en absoluto): confirmado
  // contra una pieza real de 2019 — en versiones viejas del template
  // la tabla de contenido no declara ningún ancho propio menor a
  // 600px, confía en el padding del <td> padre para angostarse
  // visualmente. Ese <td> sí tiene un ancla estable: `padding: 35px`
  // combinado con el `background-color` de alguno de los 3 temas
  // conocidos (el mismo combo que ya usa la detección de tema, ver
  // más abajo) — el orden de esos dos estilos dentro del atributo
  // varía entre piezas (visto: padding antes que background-color,
  // al revés de cómo lo escribe generarExport), así que se buscan
  // por separado dentro del mismo atributo style, no como substring
  // literal concatenado. La tabla de contenido es la primera <table>
  // que aparece después de ese <td>.
  if (inicioTag == null) {
    const colores = Object.values(TEMAS).map(t => t.bgContenido)
    const tdRegex = /<td[^>]*\sstyle="([^"]*)"[^>]*>/gi
    let tdMatch
    while ((tdMatch = tdRegex.exec(html)) !== null) {
      const style = tdMatch[1]
      const tienePadding35 = /padding:\s*35px/.test(style)
      const tieneColorTema = colores.some(c => style.includes(`background-color: ${c}`))
      if (tienePadding35 && tieneColorTema) {
        const siguienteTable = html.slice(tdMatch.index).match(/<table\b[^>]*>/)
        if (siguienteTable) inicioTag = tdMatch.index + siguienteTable.index
        break
      }
    }
  }

  if (inicioTag == null) return null

  // Balance real de <table>/</table> a partir de esa apertura, para
  // encontrar el cierre genuino de ESTA tabla (no el primer </table>
  // que aparezca, que casi siempre es de una tabla anidada de un
  // bloque interno).
  function balanceDeTabla(desde) {
    const tablaRegex = /<table\b|<\/table>/gi
    tablaRegex.lastIndex = desde
    let profundidad = 0
    let m
    while ((m = tablaRegex.exec(html)) !== null) {
      if (m[0].toLowerCase().startsWith('<table')) profundidad++
      else profundidad--
      if (profundidad === 0) return m.index + m[0].length
    }
    return null // HTML roto/truncado — no balancea
  }

  const finTag = balanceDeTabla(inicioTag)
  if (finTag == null) return null

  // Bug real encontrado con una pieza real (Jubilados): el programador
  // de la pieza armó DOS contenedores de contenido completos y
  // separados (dos <table id="Show"> distintos, cada uno con sus
  // propios bloques reales — no un fragmento corto de HTML roto), con
  // una imagen suelta de "marcas auspiciantes" entre medio. El
  // mecanismo de "fuera de rango" de más abajo está pensado para
  // rescatar un tramo CHICO de contenido mal ubicado (ventana fija de
  // 4000 caracteres, busca un cierre de tabla "pronto") — con un
  // segundo contenedor completo, esa ventana corta el tramo mucho
  // antes de llegar a él (encuentra el cierre de la tabla wrapper
  // intermedia que envuelve la imagen de marcas) y el segundo
  // contenedor entero se pierde en silencio, sin aviso ni rastro en el
  // canvas. La distinción real: un id="Show" (o una tabla de 530px de
  // Familia B) que aparece DESPUÉS del primer contenedor es, con
  // altísima probabilidad, un contenedor de contenido real — esa
  // estructura nunca aparece en la zona de legales/footer de ninguna
  // pieza vista hasta ahora — así que se buscan TODAS las ocurrencias
  // adicionales (no solo la primera) y se procesan igual que el
  // contenedor principal, en vez de tratarlas como ruido.
  const contenedoresAdicionales = []
  {
    const showRegex = /<table[^>]*\bid="Show"[^>]*>/g
    const tablas530Regex = /<table[^>]*style="[^"]*(?:max-)?width:\s*530px[^"]*"[^>]*>/g
    const regexAdicional = viaShow ? showRegex : tablas530Regex
    let cursor = finTag
    let proximoMatch
    regexAdicional.lastIndex = cursor
    while ((proximoMatch = regexAdicional.exec(html)) !== null) {
      const inicioAdicional = proximoMatch.index
      const finAdicional = balanceDeTabla(inicioAdicional)
      if (finAdicional == null) break // HTML roto a partir de acá, no seguir buscando más
      contenedoresAdicionales.push({ inicioTag: inicioAdicional, finTag: finAdicional })
      regexAdicional.lastIndex = finAdicional
    }
  }

  // Bug real encontrado con una pieza real (China/Feria de Cantón):
  // a veces hay contenido real (ej. una imagen de cierre) ubicado
  // FUERA de esta tabla pero todavía dentro del mismo <td> padre o de
  // una tabla envolvente cercana — un patrón de HTML genuinamente
  // irregular del lado del diseñador (la pieza tenía además un
  // comentario condicional MSO movido de lugar, ver historial de
  // commits). Se evaluaron varios intentos de "rescatar" ese
  // contenido calculando rangos adicionales por balance de tags, pero
  // resultó frágil y proclive a errores de cálculo en cascada para un
  // caso que, en el fondo, es simplemente HTML mal armado del lado de
  // la pieza original — no algo que el importador deba adivinar cómo
  // reparar. La decisión correcta es detectar la anomalía y avisar
  // con claridad para que se revise/corrija a mano, no tratar de
  // reconstruirla automáticamente. Se busca contenido real (más allá
  // de espacios en blanco o comentarios) en una ventana corta después
  // de finTag, dentro de lo que sería razonable considerar "todavía
  // parte del mismo bloque de contenido" (antes del próximo </td> o
  // </table> de cierre visible) — si lo hay, se expone tanto como
  // aviso de texto como el HTML crudo del tramo (htmlFueraDeRango),
  // para que importarHeuristico pueda agregarlo al canvas como
  // bloque(s) de "código personalizado" — el usuario lo ve resaltado
  // en el preview de importación (mismo overlay que cualquier otro
  // bloque no reconocido) en vez de tener que adivinar a partir de
  // solo un aviso de texto qué falta y dónde.
  //
  // IMPORTANTE: esta búsqueda ahora arranca DESPUÉS del último
  // contenedor adicional encontrado (no después del primero) — si no,
  // el tramo entre el primer contenedor y el segundo (la imagen de
  // marcas, en el caso real que motivó el fix de arriba) se detectaría
  // por error como "fuera de rango" además de procesarse ya
  // correctamente como contenedor adicional.
  const finReal = contenedoresAdicionales.length > 0
    ? contenedoresAdicionales[contenedoresAdicionales.length - 1].finTag
    : finTag
  let avisoContenidoFueraDeRango = null
  let htmlFueraDeRango = null
  const ventanaPosterior = html.slice(finReal, finReal + 4000)
  const cierrePronto = ventanaPosterior.search(/<\/td>\s*<\/tr>\s*<\/tbody>\s*<\/table>/i)
  let tramoAVerificar = cierrePronto !== -1 ? ventanaPosterior.slice(0, cierrePronto) : ''
  // El tramo recortado suele empezar con el cierre huérfano de tags
  // que ya pertenecían al contenedor anterior (ej. el </td></tr> que
  // cierra la fila de la tabla 530px) — separarFilasDeNivelSuperior
  // necesita arrancar en una APERTURA real de <tr>, no en un cierre,
  // o nunca encuentra ningún par balanceado. Se recorta hasta el
  // primer <tr de apertura genuino dentro del tramo.
  const idxPrimerTr = tramoAVerificar.search(/<tr\b/i)
  if (idxPrimerTr !== -1) tramoAVerificar = tramoAVerificar.slice(idxPrimerTr)
  const sinTagsVacios = tramoAVerificar.replace(/<\/?(?:tr|td|tbody)\b[^>]*>|&nbsp;|\s/gi, '')
  if (sinTagsVacios.length > 0) {
    avisoContenidoFueraDeRango = 'Se detectó contenido fuera del área de contenido esperada (posible HTML mal armado en la pieza original) — se agregó al final, marcado para revisión manual.'
    htmlFueraDeRango = tramoAVerificar
  }

  return { inicioTag, finTag, viaShow, avisoContenidoFueraDeRango, htmlFueraDeRango, contenedoresAdicionales }
}

// Separa el CONTENIDO interno de la tabla (ya sin el <table ...> de
// apertura ni el </table> de cierre) en bloques candidatos — cada
// <tr> de nivel superior es un candidato completo, con balance real
// de profundidad (no regex naive), igual criterio que
// encontrarTablaContenido: los bloques reales de esta plantilla
// confirman que cada bloque completo = exactamente 1 <tr> de nivel
// superior, sin excepción, sin importar cuántos <tr> anidados tenga
// adentro (confirmado contra los 9 templates de Contenido del editor,
// desde 1 hasta 8 <tr> internos).
function separarFilasDeNivelSuperior(htmlInterno) {
  const filas = []
  const filaRegex = /<tr\b[^>]*>|<\/tr>/gi
  let profundidad = 0
  let inicioFila = null
  let m
  while ((m = filaRegex.exec(htmlInterno)) !== null) {
    const esApertura = m[0].toLowerCase().startsWith('<tr')
    if (esApertura) {
      if (profundidad === 0) inicioFila = m.index
      profundidad++
    } else {
      profundidad--
      if (profundidad === 0 && inicioFila != null) {
        filas.push(htmlInterno.slice(inicioFila, m.index + m[0].length))
        inicioFila = null
      }
    }
  }
  return filas
}

// Normaliza <strong>...</strong> a <span style="font-weight: bold;">
// ...</span> — equivalente visual exacto, pero algunos diseñadores
// externos usan <strong> para negrita mientras que los templates de
// este editor usan <span style="font-weight:bold;"> (confirmado en
// Bloque_Texto_Base y Destacado_Topes_Promo). Sin esta normalización,
// dos bloques con la MISMA estructura visual pero distinto tag de
// negrita contaban como formas distintas en formaDeTags (uno suma a
// la columna de `strong`, el otro a la de `span`) — bug real
// encontrado con una pieza real (Charla Inversiones): un párrafo con
// 2 <strong> no llegó al umbral de similitud contra Bloque_Texto_Base
// por esa sola diferencia de tag, quedando como "Código
// personalizado" cuando un humano lo reconocería como el mismo tipo
// de bloque. Se aplica tanto a la comparación de forma (para que
// cuenten como equivalentes) como al HTML final que se guarda como
// htmlEditado, para que el resultado sea coherente con lo que el
// template real produciría — un bloque que matchea contra
// Bloque_Texto_Base pero conserva <strong> internamente sería
// inconsistente con cómo ese mismo bloque se vería si se hubiera
// armado nativamente en el editor.
function normalizarNegritas(html) {
  return html.replace(/<strong>/gi, '<span style="font-weight: bold;">').replace(/<\/strong>/gi, '</span>')
}

// Garantiza que el <img> de un bloque Imagen_Libre importado tenga
// los estilos base que siempre lleva en el template original:
// display:block, font-family, font-size, color. Si vienen de una
// pieza externa pueden faltar. El style se reescribe completo para
// asegurar consistencia — solo se preservan max-width y width del
// HTML original (el ancho real de la imagen), el resto se normaliza.
// La clase también se garantiza: si no tiene ninguna, se agrega
// img-max como default.
// Si el matching asignó uno de los dos slugs de icono, corrige por
// el HTML real — el borde es la única señal estructural inequívoca.
function corregirSlugIcono(slug, html) {
  if (slug !== 'Icono_Separador_Rojo_Texto' && slug !== 'Icono_Grande_Separador_Rojo_Texto') return slug
  return /border-left:\s*solid\s*5px/i.test(html)
    ? 'Icono_Grande_Separador_Rojo_Texto'
    : 'Icono_Separador_Rojo_Texto'
}

function normalizarImagenLibre(html) {
  return html.replace(/<img([^>]*)>/i, (match, attrs) => {
    // Extraer width real (atributo o max-width del style)
    const widthAttr = (attrs.match(/\bwidth=["'](\d+)["']/i) || [])[1]
    const maxWidthStyle = (attrs.match(/max-width:\s*(\d+)px/i) || [])[1]
    const anchoReal = widthAttr || maxWidthStyle || '530'

    // Preservar src, alt, title, class y href si hubiera link
    const src = (attrs.match(/\bsrc=["']([^"']*)["']/i) || ['', ''])[1]
    const alt = (attrs.match(/\balt=["']([^"']*)["']/i) || ['', 'Imagen'])[1]
    const title = (attrs.match(/\btitle=["']([^"']*)["']/i) || ['', ''])[1]
    const claseMatch = attrs.match(/\bclass=["']([^"']*)["']/i)
    const clase = claseMatch ? claseMatch[1] : null
    const claseAttr = clase ? ` class="${clase}"` : ''

    const titleAttr = title ? ` title="${title}"` : ''
    const styleBase = `display: block; font-family: Arial,Helvetica,Open Sans,sans-serif; font-size: 22px; color: #c4161c; max-width: ${anchoReal}px;`

    return `<img src="${src}" alt="${alt}"${titleAttr}${claseAttr} style="${styleBase}" width="${anchoReal}" />`
  })
}

// Compara la FORMA de un fragmento de bloque contra un template
// conocido — cantidad y orden de tags abiertos, MÁS dos dimensiones
// de contexto que los tags solos no capturan:
//
// 1) "Cuánto texto visible tiene" — un espaciador (<tr><td>&nbsp;
// </td></tr>) y un párrafo simple de una sola línea
// (<tr><td>texto</td></tr>) tienen EXACTAMENTE la misma forma de tags
// — un <tr> y un <td>, nada más — y sin esta dimensión la comparación
// los confunde sistemáticamente (bug real: un párrafo de texto real
// matcheaba con similitud 1.0 contra Espaciador, ganándole al match
// correcto contra Bloque_Texto_Base). Se agrupa en buckets gruesos (0
// / corto / largo), no como número exacto, porque dos piezas con el
// mismo template casi nunca tienen la misma cantidad de caracteres.
//
// 2) "Tiene margen lateral" — distingue dos variantes reales del
// mismo Bullet que un programador puede armar de dos formas
// distintas: con un <td> chico dedicado solo a dar espacio (ej.
// <td width="20"></td> antes del <td> de texto) o con padding-left/
// right directo en el ÚNICO <td> de texto (sin <td> de espacio
// aparte). Ambas formas son visualmente equivalentes pero
// estructuralmente attr distinto — sin esta dimensión, la variante con
// padding queda indistinguible en forma de tags de la variante SIN
// margen (Bullet_Bull_Rojo), porque el padding es un atributo de
// estilo, no un tag, y el conteo de tags por sí solo no lo ve. El
// umbral de 15px es a propósito generoso (cubre el typ-20px real)
// pero descarta paddings chicos de espaciado normal que no
// representan un "margen de bullet" (no se ve ningún padding-left así
// en el resto de los templates actuales).
function formaDeTags(html) {
  // esIconoBulletCaracter se calcula sobre el html CRUDO, antes de
  // normalizarNegritas — bug real encontrado: normalizarNegritas
  // convierte <strong> a <span style="font-weight:bold;"> para que
  // ambos estilos de negrita cuenten igual en el conteo genérico de
  // `span` (ver más abajo), pero ESO mezclaba dos conceptos
  // completamente distintos: un <span> de NEGRITA DE TEXTO normal
  // (cualquier oración con una palabra en negrita) y el <span> que
  // representa el ÍCONO de un Bullet_Bull_Rojo (un carácter &bull; •
  // dentro de un <span> de color rojo, en vez de una <img> real). Al
  // no distinguirlos, un fragmento real con una <img> de bullet Y
  // texto en negrita (que debería matchear Bullet_Titular_Negro)
  // terminaba pareciéndose más a Bullet_Bull_Rojo, porque ambos tenían
  // "un span" — aunque ese span significara cosas totalmente distintas
  // en cada caso. Por eso esta dimensión se calcula ANTES de la
  // normalización, buscando específicamente el patrón exacto del
  // ícono-carácter (<span...>&bull;</span>), no cualquier <span>.
  // Bug real encontrado con una pieza real (bloque de contacto, "•
  // Email: <link>"): el regex exigía que &bull; estuviera PEGADO al
  // </span> de cierre, sin nada en el medio — pero el diseñador puede
  // poner el espacio separador DENTRO del span en vez de afuera
  // (<span>&bull; </span>Texto, visualmente idéntico a
  // <span>&bull;</span> Texto, que sí matcheaba). Se tolera un único
  // espacio o &nbsp; opcional entre el bullet y el cierre — sin volverse
  // laxo: si hubiera texto real ahí dentro (ej. el diseñador metió todo
  // el texto del bloque dentro del mismo span de color por error), el
  // regex sigue sin matchear, porque exige que después del espacio
  // opcional venga directo el cierre, no cualquier contenido.
  // Bug real encontrado con una pieza real, accedida vía el editor
  // "limpio" de la plataforma (sin el bug de comillas simples del
  // acceso por link, ver normalización en el modal de importar): el
  // texto venía con el carácter Unicode literal • (U+2022) en vez de
  // la entidad HTML &bull; — visualmente IDÉNTICOS en cualquier
  // navegador o cliente de correo, pero el regex solo reconocía la
  // entidad. Se acepta cualquiera de los dos formatos.
  const esIconoBulletCaracter = /<span\b[^>]*>(?:&bull;|•)(?:\s|&nbsp;)?<\/span>/i.test(html) ? 1 : 0
  const normalizado = normalizarNegritas(html)
  const tags = ['tr', 'td', 'table', 'img', 'a', 'span', 'strong', 'sup']
  const conteoTags = tags.map(t => (normalizado.match(new RegExp(`<${t}\\b`, 'gi')) || []).length)
  const textoVisible = normalizado.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()
  const bucketTexto = textoVisible.length === 0 ? 0 : (textoVisible.length < 40 ? 1 : 2)
  // Bug real encontrado: el regex anterior para tieneTdDeMargen usaba
  // [\s\S]*? (cualquier carácter, no-greedy) ENTRE la apertura de <td
  // y la búsqueda de width="N" — eso permitía "saltar" por encima de
  // tablas anidadas COMPLETAS con contenido real buscando cualquier
  // <td width="N"> que apareciera después, sin verificar que fuera la
  // MISMA celda la que se cerraba vacía. Resultado: un bloque real con
  // dos imágenes lado a lado (Modulo_Doble_Clasico, cada mitad con un
  // <td width="50%"> que contiene una imagen completa) daba
  // tieneMargen=1 por error — el regex "encontraba" el primer
  // <td width="265"> de la imagen interna y lo emparejaba con el
  // primer </td> que apareciera después, sin que hubiera ningún <td>
  // vacío real en el medio. Esto hacía que la regla de prioridad de
  // margen (más abajo en importarHeuristico) descartara el match
  // correcto (Modulo_Doble_Clasico, mejor puntaje real) a favor de uno
  // peor que coincidiera por casualidad en este valor mal calculado
  // (Btn). El regex correcto exige que los atributos de apertura (sin
  // ningún ">" en el medio, o sea sin poder saltar a otro tag) incluyan
  // width="N" Y que el cierre sea INMEDIATO (vacío o solo &nbsp;), no
  // que aparezca cualquier </td> más adelante en el documento.
  //
  // Segundo bug real encontrado, con OTRA pieza real (mismo
  // Modulo_Doble_Clasico, ahora en su variante "responsive" con un
  // <td class="mobile-hide" width="2"> vacío de separación entre las
  // dos columnas, para colapsarlas en mobile): ese <td> SÍ cierra
  // inmediato (vacío o &nbsp;), así que el regex de arriba ya no tenía
  // el bug de anidamiento — pero un separador técnico de 2px no es lo
  // mismo, conceptualmente, que el margen-de-bullet real que esta
  // dimensión intenta capturar (ver comentario grande junto a
  // formaDeTags: la diferencia entre un Bullet con <td> de espacio
  // dedicado vs. uno con padding). El margen mínimo real visto en los
  // templates actuales con esta dimensión en 1 es 5px (Icono_Separador
  // _Rojo_Texto, Modulo_Canal_Feriado) — exigir width >= 5px excluye
  // separadores técnicos chicos (2px, vistos en patrones
  // "mobile-hide") sin afectar a NINGÚN template real existente
  // (verificado: los 16 templates de Contenido dan el mismo valor de
  // tieneMargen con o sin este piso). El bloque real
  // (Modulo_Doble_Clasico con separador mobile-hide de 2px) caía con
  // tieneMargen=1 por error y la regla de margen-igual lo hacía perder
  // contra Borde_Izq_Rojo_Texto (que sí tiene margen real de 10px) a
  // pesar de que el puntaje puro ya elegía bien a Modulo_Doble_Clasico
  // — mismo patrón de bug que el comentario de arriba ya documentó
  // para este mismo template, pero por una causa distinta.
  const tieneTdDeMargen = /<td\b[^>]*\swidth="(\d+)"[^>]*>(?:&nbsp;|\s)*<\/td>/i.exec(normalizado)
  const tieneTdDeMargenReal = tieneTdDeMargen && Number(tieneTdDeMargen[1]) >= 5
  const tienePaddingLateral = /padding-(left|right):\s*(\d+)px/i.exec(normalizado)
  const tieneMargen = tieneTdDeMargenReal || (tienePaddingLateral && Number(tienePaddingLateral[2]) >= 15) ? 1 : 0
  return [...conteoTags, bucketTexto, tieneMargen, esIconoBulletCaracter]
}
// Sin pesos diferenciados por dimensión — promedio simple sobre todas.
// Un intento anterior de resolver el caso de Bullet con ícono-imagen
// vs. ícono-carácter dándole más peso genérico a `img`/`span` no
// funcionó bien: ESE mismo peso amplificaba el ruido de
// normalizarNegritas (que convierte <strong> de texto normal en
// <span>), haciendo que cualquier fragmento con negrita de texto se
// pareciera más a Bullet_Bull_Rojo por casualidad. La solución
// correcta no era pesar más una dimensión genérica, sino agregar la
// dimensión esIconoBulletCaracter (ver formaDeTags), específica y sin
// ambigüedad — con eso, el promedio simple ya alcanza.
function similitudDeForma(formaA, formaB) {
  const max = formaA.map((v, i) => Math.max(v, formaB[i], 1))
  const diffs = formaA.map((v, i) => Math.abs(v - formaB[i]) / max[i])
  return 1 - diffs.reduce((a, b) => a + b, 0) / diffs.length
}
// 0.7 probado contra los 9 templates reales de BLOQUES_CONTENIDO: un
// bloque con forma genuinamente distinta (ej. una tabla ancha de
// muchas columnas, sin relación con ningún template) cae claramente
// por debajo; un bloque con forma moderadamente distinta puede
// quedar cerca del límite, porque con solo 9 templates de referencia
// — varios de ellos compartiendo estructura parecida entre sí — la
// similitud por diferencia normalizada es más generosa de lo que
// sería con un set de referencia más grande. Si en el futuro se suman
// muchos más templates a BLOQUES_CONTENIDO, conviene volver a
// calibrar este número contra casos reales, no asumir que sigue
// sirviendo igual.
const UMBRAL_SIMILITUD_BLOQUE = 0.7

// Clasificación previa por estructura — se ejecuta ANTES de comparar
// formas contra BLOQUES_CONTENIDO, para los casos donde el vector de
// 9 dimensiones de formaDeTags es demasiado pobre para distinguir
// bien. Bug real encontrado con piezas reales: un <tr><td> con UNA
// sola imagen y nada de texto (ej. un titular gráfico, un logo
// suelto) tiene la MISMA forma de tags que Bullet_Titular_Negro
// (tr:1, td:1, img:1) — la única diferencia real es que el Bullet
// tiene texto junto al ícono y la imagen suelta no, pero esa
// diferencia vive en el CONTENIDO del bucket de texto, no en algo que
// formaDeTags pueda distinguir con suficiente peso. Mismo problema al
// revés: un <tr><td>texto simple</td></tr> SIN imagen (ej. una
// dirección, un texto suelto) compartía casi la misma forma
// (tr:1,td:1) y por puro margen de similitud le ganaba a
// Bloque_Texto_Base el match contra Bullet_Titular_Negro, que
// curiosamente también es tr:1,td:1 pero con un <img> que en la
// comparación normalizada pesa poco.
//
// La regla es estructural y directa, sin necesidad de calibrar
// umbrales: si la fila es <tr> con EXACTAMENTE un <td>, y ese <td> NO
// tiene ninguna <table> anidada (no es un bloque compuesto):
//   - imagen sí, texto visible no (más allá del alt/title) -> Imagen_Libre
//   - texto visible sí, imagen no -> Bloque_Texto_Base
//   - ambos (imagen Y texto) -> NO se clasifica acá, sigue a la
//     comparación de forma genérica más abajo, porque ahí sí
//     corresponde diferenciar Bullet vs Destacado vs otros según la
//     forma real (esto es lo que distingue un Bullet genuino —
//     ícono+texto juntos — de una imagen sola o un texto solo).
function clasificarPorEstructuraDirecta(filaHtml) {
  const trMatch = filaHtml.match(/^<tr[^>]*>([\s\S]*)<\/tr>$/i)
  if (!trMatch) return null
  const interior = trMatch[1]

  // Bug real encontrado (motivado por el caso de "Datos registrados",
  // ver más abajo): el regex naive <td...>(...)</td> no respeta
  // anidamiento — si hay una <table> dentro de un <td>, sus propios
  // <td> internos se confundían con <td> de NIVEL SUPERIOR de esta
  // fila (ej. una fila con 1 solo <td> exterior, pero con una tabla
  // de 3 filas x 2 columnas adentro, se contaba como "9 tds de nivel
  // superior" en vez de 1). Balance real: solo cuenta un <td> como
  // "de nivel superior" si no hay ninguna <table> sin cerrar entre el
  // <tr> de esta fila y ese <td> — cualquier <td> que viva dentro de
  // una <table> anidada (sin importar cuántos niveles) no cuenta acá.
  const tds = []
  {
    const tagRegex = /<table\b[^>]*>|<\/table>|<td\b[^>]*>|<\/td>/gi
    let profundidadTabla = 0
    let inicioTdActual = null
    let m
    while ((m = tagRegex.exec(interior)) !== null) {
      const tag = m[0].toLowerCase()
      if (tag.startsWith('<table')) profundidadTabla++
      else if (tag === '</table>') profundidadTabla--
      else if (tag.startsWith('<td') && profundidadTabla === 0) {
        inicioTdActual = m.index + m[0].length
      } else if (tag === '</td>' && profundidadTabla === 0 && inicioTdActual != null) {
        tds.push([null, interior.slice(inicioTdActual, m.index)])
        inicioTdActual = null
      }
    }
  }

  // Caso real encontrado al agregar Modulo_Canal_Feriado (ícono
  // cuadrado + separador + borde rojo lateral de 2px + texto con
  // título-bullet): por conteo de tags (formaDeTags) este bloque
  // queda casi empatado (~0.75, contra umbral 0.7) con
  // Destacado_Icono_Texto e Icono_Separador_Rojo_Texto — ambos
  // comparten la misma "forma" general (ícono + sub-tabla de texto
  // anidada en varios niveles). Si el HTML real varía apenas (ej. sin
  // el link "click aquí" del texto, algo muy plausible en una pieza
  // real), la similitud contra Icono_Separador_Rojo_Texto sube por
  // encima del umbral y gana un match incorrecto — confirmado
  // numéricamente probando esa variante antes de este fix. La marca
  // que sí distingue con seguridad a este bloque de los otros dos:
  // Icono_Separador_Rojo_Texto nunca usa el ícono bullet-super-rojo-
  // der.png como título (solo usa imágenes-separador horizontales,
  // sin bullet), y Destacado_Icono_Texto no tiene borde lateral en
  // absoluto. La combinación borde-lateral-2px + bullet-de-título es
  // exclusiva de Modulo_Canal_Feriado entre los templates actuales —
  // se resuelve acá, antes de la comparación de forma, en vez de
  // subirle peso a esa dimensión dentro de formaDeTags (eso afectaría
  // a TODOS los pares de templates por igual, no solo a este caso —
  // probado y descartado: rompía la distancia ya válida entre
  // Icono_Separador_Rojo_Texto y Borde_Izq_Rojo_Texto).
  //
  // Bug real encontrado en revisión a fondo previa al primer push (no
  // por una pieza real reportada, sino armando una pieza de estrés con
  // varios bloques juntos en un mismo documento): la propia plantilla
  // Modulo_Canal_Feriado.html SIEMPRE tiene 1 <td align="center">
  // exterior envolviendo la sub-tabla de 5 celdas (ícono+espaciador+
  // borde+espaciador+texto) — exactamente la misma forma que
  // Icono_Separador_Rojo_Texto / Icono_Grande_Separador_Rojo_Texto, NO
  // la de "5 <td> directos en el <tr>" que se manejaba más abajo (esa
  // rama es para un caso que el template real nunca produce). El
  // código de acá excluía explícitamente "si tiene bullet de título,
  // no resolver en esta rama — ya lo cubre la rama de tds.length===5"
  // pero esa rama NUNCA se alcanzaba para este template, porque
  // tds.length siempre daba 1, no 5. Resultado: Modulo_Canal_Feriado
  // nunca matcheaba directo en la práctica, solo por similitud — y en
  // un documento con Icono_Separador_Rojo_Texto compitiendo (que SÍ
  // matcheaba directo primero), el cálculo de similitud para
  // Modulo_Canal_Feriado podía perder. Fix: la detección de
  // Modulo_Canal_Feriado se resuelve ACÁ, en la rama real donde vive
  // su estructura, antes de excluirlo por tener bullet-título.
  if (tds.length === 1) {
    const tieneSubTabla = /<table\b/i.test(tds[0][1])
    if (tieneSubTabla) {
      const tieneBorde2px = /border-left:\s*solid\s*2px/i.test(interior)
      const tieneBorde5px = /border-left:\s*solid\s*5px/i.test(interior)
      const tieneIconoChico = /<img\b[^>]*width=["']60["']/i.test(interior)
      const tieneIconoGrande = /<img\b[^>]*width=["'](?:75|80)["']/i.test(interior)
      const tieneBulletTitulo = /<img\b[^>]*src="[^"]*bullets\/bullet-super-rojo-der\.png"[^>]*>/i.test(interior)
      if (tieneBulletTitulo) {
        if (tieneBorde2px) return 'Modulo_Canal_Feriado'
        // Bullet de título sin borde lateral -> no es ninguno de los
        // templates de ícono+borde conocidos, sigue al flujo normal.
      } else {
        if (tieneBorde5px && tieneIconoGrande) return 'Icono_Grande_Separador_Rojo_Texto'
        if (tieneBorde2px && tieneIconoChico) return 'Icono_Separador_Rojo_Texto'
      }
    }
  }

  // Caso hipotético, no visto en ningún template real hasta ahora: los
  // 5 <td> (ícono+espaciador+borde+espaciador+texto) directamente en
  // el <tr>, sin el <td align="center"> envolvente que SÍ usan todos
  // los templates reales de esta familia. Se deja como red de
  // contención por si alguna pieza real llegara a tener esta variante
  // — no se puede confirmar ni descartar sin un caso real, así que no
  // se elimina, pero la detección real para Modulo_Canal_Feriado/
  // Icono_Grande/Icono_Separador vive en la rama de arriba, no acá.
  if (tds.length === 5) {
    const tieneBordeLateral5px = tds.some(([, c]) => /border-left:\s*solid\s*5px/i.test(c))
    const tieneIconoGrande = /<img\b[^>]*width=["']7[0-9]["']/i.test(interior)
    if (tieneBordeLateral5px && tieneIconoGrande) return 'Icono_Grande_Separador_Rojo_Texto'

    const tieneBordeLateral2px = tds.some(([, c]) => /border-left:\s*solid\s*2px/i.test(c))
    const tieneBulletDeTitulo = /<img\b[^>]*src="[^"]*bullets\/bullet-super-rojo-der\.png"[^>]*>/i.test(interior)
    if (tieneBordeLateral2px && tieneBulletDeTitulo) return 'Modulo_Canal_Feriado'
  }

  // Bug real encontrado con una pieza real (ICBC Mobile Banking,
  // bloque "Datos registrados" — caja con varias filas y columnas de
  // valores, con bgcolor y bordes propios, ej. "Fecha: X" / "Dispositivo:
  // Y"). La biblioteca de templates no tiene NINGÚN bloque de tabla de
  // datos real — al no haber un candidato genuino, el flujo normal de
  // comparación de forma termina forzando un match contra "lo menos
  // malo" (visto: Bloque_Texto_Base o Borde_Izq_Rojo_Texto, ninguno de
  // los dos remotamente parecido), lo cual rompe la edición real del
  // bloque (el panel de campos se construye con la estructura del
  // template equivocado). Es más sano para el proyecto reconocer que
  // este tipo de bloque simplemente no tiene equivalente todavía y
  // forzarlo a Código personalizado de entrada — conserva el HTML
  // intacto sin arriesgar romper nada, en vez de adivinar.
  //
  // Señal estructural: una <table> anidada con MÁS DE UNA fila interna
  // Y al menos una de esas filas con más de un <td> — eso distingue
  // una tabla de DATOS real (filas y columnas con contenido distinto
  // en cada celda) de una tabla anidada trivial usada solo como
  // wrapper técnico de una sola celda (ej. Destacado_Icono_Texto, que
  // tiene <table><tr><td>ícono</td><td>texto</td></tr></table> — eso
  // SÍ tiene más de un <td> en una fila, pero solo 1 fila interna, así
  // que no cae en esta regla; sigue al flujo normal donde matchea bien
  // contra su template real).
  //
  // Bug real encontrado (y corregido ANTES de llegar a producción,
  // detectado en el propio testeo de este fix): igual que el cálculo
  // de tds más arriba, contar <tr> con un matchAll simple sobre el
  // contenido del <td> exterior NO respeta anidamiento — si esa
  // primera tabla tiene, en alguna de sus celdas, OTRA tabla anidada
  // de nivel 2 (caso real: Destacado_Icono_Texto, cuyo <td> de texto
  // contiene una sub-tabla propia con 3 filas para el espaciado
  // vertical), esas filas de nivel 2 se contaban como si fueran filas
  // de la tabla de nivel 1 — disparando esta regla por error en un
  // bloque que en realidad matcheaba perfecto contra su template real.
  // Mismo criterio de balance que ya se usó para tds: solo contar <tr>
  // que pertenezcan a la PRIMERA <table> encontrada (nivel 1
  // inmediato), deteniéndose ahí — cualquier <tr> dentro de una
  // segunda <table> anidada (nivel 2+) queda afuera del conteo.
  if (tds.length === 1) {
    const primeraTablaMatch = tds[0][1].match(/<table\b[^>]*>([\s\S]*)<\/table>/i)
    if (primeraTablaMatch) {
      const contenidoPrimeraTabla = primeraTablaMatch[1]
      const filasInternas = []
      const filaRegex = /<tr\b[^>]*>|<\/tr>|<table\b[^>]*>|<\/table>/gi
      let profundidadSubTabla = 0
      let inicioFila = null
      let m2
      while ((m2 = filaRegex.exec(contenidoPrimeraTabla)) !== null) {
        const tag2 = m2[0].toLowerCase()
        if (tag2.startsWith('<table')) profundidadSubTabla++
        else if (tag2 === '</table>') profundidadSubTabla--
        else if (tag2.startsWith('<tr') && profundidadSubTabla === 0) {
          inicioFila = m2.index + m2[0].length
        } else if (tag2 === '</tr>' && profundidadSubTabla === 0 && inicioFila != null) {
          filasInternas.push(contenidoPrimeraTabla.slice(inicioFila, m2.index))
          inicioFila = null
        }
      }
      const algunaFilaConVariasColumnas = filasInternas.some(f => (f.match(/<td\b/gi) || []).length > 1)
      if (filasInternas.length > 1 && algunaFilaConVariasColumnas) return 'codigo'
    }
    // Tabla de datos con filas/columnas y bgcolor por celda (ej. resultados
    // de licitación), anidada hasta 3 niveles de wrappers. La señal que la
    // distingue de tablas de layout como Destacado_Topes_Promo: tiene >1 fila,
    // >1 columna Y celdas con bgcolor explícito distinto al blanco — un patrón
    // exclusivo de tablas de datos visuales (clave/valor con colores de fondo).
    function esTablaDatosConBgcolor(contenidoTd, nivel) {
      if (nivel > 3) return false
      const tablaM = contenidoTd.match(/<table\b[^>]*>([\s\S]*)<\/table>/i)
      if (!tablaM) return false
      const filasT = []
      const tagReT = /<tr\b[^>]*>|<\/tr>|<table\b[^>]*>|<\/table>/gi
      let profT = 0, inicioT = null, mT
      while ((mT = tagReT.exec(tablaM[1])) !== null) {
        const t = mT[0].toLowerCase()
        if (t.startsWith('<table')) profT++
        else if (t === '</table>') profT--
        else if (t.startsWith('<tr') && profT === 0) inicioT = mT.index + mT[0].length
        else if (t === '</tr>' && profT === 0 && inicioT != null) { filasT.push(tablaM[1].slice(inicioT, mT.index)); inicioT = null }
      }
      const multiCol = filasT.some(f => (f.match(/<td\b/gi) || []).length > 1)
      const tieneBgcolor = /<td[^>]*bgcolor=["'](?!#fff(?:fff)?|white)[^"']+["']/i.test(tablaM[1])
      if (filasT.length > 1 && multiCol && tieneBgcolor) return true
      // Bajar nivel si 1 fila con 1 td (wrapper puro)
      if (filasT.length === 1) {
        const tdsDeEstaFila = []
        const tagRe2 = /<table\b[^>]*>|<\/table>|<td\b[^>]*>|<\/td>/gi
        let prof2 = 0, ini2 = null, m3
        while ((m3 = tagRe2.exec(filasT[0])) !== null) {
          const t2 = m3[0].toLowerCase()
          if (t2.startsWith('<table')) prof2++
          else if (t2 === '</table>') prof2--
          else if (t2.startsWith('<td') && prof2 === 0) ini2 = m3.index + m3[0].length
          else if (t2 === '</td>' && prof2 === 0 && ini2 != null) { tdsDeEstaFila.push(filasT[0].slice(ini2, m3.index)); ini2 = null }
        }
        if (tdsDeEstaFila.length === 1) return esTablaDatosConBgcolor(tdsDeEstaFila[0], nivel + 1)
      }
      return false
    }
    if (esTablaDatosConBgcolor(tds[0][1], 0)) return 'codigo'
  }

  if (tds.length !== 1) return null // más de un <td> -> es una fila con columnas reales, no este caso simple
  const contenidoTd = tds[0][1]

  // Caso real encontrado con una pieza real (evento MALBA, bloque
  // "CTA Invitaciones"): Destacado_Icono_Texto envuelve su ícono+texto
  // en una sub-tabla propia (con su propio borde de 2px) — a
  // diferencia de Bullet_Titular_Negro, que los tiene directo en el
  // mismo <td> sin tabla intermedia. Por eso caía en la guarda de
  // "bloque compuesto" de más abajo (que descarta CUALQUIER <td> con
  // tabla anidada) sin llegar nunca a evaluarse acá, y terminaba en el
  // flujo de formaDeTags — donde, si el texto real no tiene ningún
  // link (el template de referencia sí tiene uno, de ejemplo), empata
  // EXACTO en puntaje contra Borde_Izq_Rojo_Texto (única diferencia de
  // vector: la dimensión de cantidad de <a>) y pierde por orden
  // alfabético. La señal estructural real, igual de inequívoca que la
  // de Bullet_Titular_Negro pero para el caso "compuesto": dentro de
  // esa única sub-tabla, su primera fila tiene EXACTAMENTE 2 <td> de
  // nivel superior (respecto a ESA sub-tabla) — uno con una imagen
  // GRANDE (>30px, a diferencia del ícono-bullet chico de
  // Bullet_Titular_Negro) sin su propia sub-tabla, y otro con texto
  // (que sí puede tener su propia sub-tabla de espaciado, eso no
  // afecta la clasificación). Borde_Izq_Rojo_Texto nunca tiene ninguna
  // imagen en absoluto, así que esta señal no lo confunde.
  if (/<table\b/i.test(contenidoTd)) {
    const subTablaMatch = contenidoTd.match(/<table\b[^>]*>([\s\S]*)<\/table>/i)
    if (subTablaMatch) {
      const tdsSubTabla = []
      const tagRegexSub = /<table\b[^>]*>|<\/table>|<td\b[^>]*>|<\/td>/gi
      let profundidadSub = 0, inicioTdSub = null, mSub
      while ((mSub = tagRegexSub.exec(subTablaMatch[1])) !== null) {
        const tagSub = mSub[0].toLowerCase()
        if (tagSub.startsWith('<table')) profundidadSub++
        else if (tagSub === '</table>') profundidadSub--
        else if (tagSub.startsWith('<td') && profundidadSub === 0) inicioTdSub = mSub.index + mSub[0].length
        else if (tagSub === '</td>' && profundidadSub === 0 && inicioTdSub != null) {
          tdsSubTabla.push(subTablaMatch[1].slice(inicioTdSub, mSub.index))
          inicioTdSub = null
        }
      }
      if (tdsSubTabla.length === 2) {
        const tieneIconoGrandeSinSubTabla = tdsSubTabla.some(td => {
          if (/<table\b/i.test(td)) return false
          const wm = td.match(/<img\b[^>]*\swidth="(\d+)"/i)
          return wm && Number(wm[1]) > 30
        })
        if (tieneIconoGrandeSinSubTabla) return 'Destacado_Icono_Texto'
      }
    }
    return null // bloque compuesto que no matchea el patrón anterior -> no es este caso simple
  }

  // Caso real encontrado: un Bullet puede usar el carácter &bull; (•)
  // dentro de un <span> de color, en vez de una <img> real, como
  // "ícono". Esa celda SÍ tiene texto visible y NO tiene <img> — caía
  // por error en la regla de "texto sin imagen -> Bloque_Texto_Base"
  // de más abajo, cuando en realidad es un Bullet genuino (con
  // ícono-de-texto en vez de ícono-imagen).
  //
  // Bug real encontrado con una pieza real (bloque "• Email: <link>",
  // con padding-left en vez de <td> de margen dedicado): el espacio
  // separador entre el bullet y el texto puede vivir DENTRO del span
  // (<span>&bull; </span>Email:) en vez de afuera — visualmente
  // idéntico pero el regex anterior exigía el cierre pegado al
  // carácter, sin tolerar nada en el medio. Mismo ajuste que en
  // esIconoBulletCaracter (formaDeTags) — los dos regex deben
  // mantenerse en sincro, son la misma señal evaluada en dos lugares
  // distintos del flujo de matching.
  //
  // Tercer bug real encontrado (sesión de auditoría de comillas en el
  // modal de importar): la pieza venía con el carácter Unicode literal
  // • (U+2022) en vez de la entidad &bull; — mismo fix que en
  // esIconoBulletCaracter, se acepta cualquiera de los dos.
  const esBulletDeCaracter = /<span\b[^>]*>(?:&bull;|•)(?:\s|&nbsp;)?<\/span>/i.test(contenidoTd)
  if (esBulletDeCaracter) {
    // Solo hay DOS templates con bullet de carácter en toda la
    // biblioteca (Bullet_Bull_Rojo y Bullet_Bull_Rojo_Margen) y la
    // única diferencia real entre ambos es el margen — antes esto se
    // dejaba "seguir al flujo normal" de formaDeTags/similitud para
    // que decidiera cuál de los dos, pero ahí aparece un problema
    // distinto: la VARIANTE CON margen vía padding-left (sin <td> de
    // margen dedicado, sin sub-tabla) tiene una forma de tags
    // (tr:1,td:1,table:0) muy distinta a la del template
    // Bullet_Bull_Rojo_Margen guardado (tr:2,td:3,table:1, porque ESE
    // usa sub-tabla con <td width="20"> vacío) — la similitud pura le
    // daba el match al Bullet SIN margen (0.73) en vez de CON margen
    // (0.62), y la regla de "margen igual" (pensada justo para
    // desempatar este tipo de caso) no alcanzaba a salvarlo porque
    // exige que el candidato ganador por margen supere el umbral 0.7
    // por su cuenta — una guarda correcta en general (evita que un
    // candidato genuinamente ajeno gane solo por coincidir en una
    // dimensión), pero qua acá descartaba al candidato que en los
    // hechos SÍ es el correcto. Como solo hay dos posibles resultados
    // y la distinción real es 100% determinística (tiene margen o no
    // — sea por padding-left>=15px o por <td> vacío dedicado, mismo
    // criterio que ya usa tieneMargen en formaDeTags), se resuelve
    // acá directo, sin pasar por similitud en absoluto.
    // OJO: contenidoTd es lo que está DESPUÉS del cierre del <td...>
    // de apertura (ver más arriba: tds.push de interior.slice(m.index
    // + m[0].length, ...)) — NO incluye los propios atributos de ese
    // <td>. El padding-left vive en el style del <td> mismo, así que
    // hay que buscarlo en `interior` (el <tr> completo, que sí incluye
    // el tag de apertura), no en contenidoTd. Bug real encontrado en
    // el propio testeo de este fix: buscarlo en contenidoTd nunca
    // matcheaba nada, y el bloque siempre caía en 'sin margen' aunque
    // el HTML real tuviera padding-left: 24px.
    const tienePaddingDeMargen = /padding-left:\s*(\d+)px/i.exec(interior)
    const tieneMargenViaPadding = tienePaddingDeMargen && Number(tienePaddingDeMargen[1]) >= 15
    const tieneTdDeMargenDedicado = /<td\b[^>]*\swidth="(\d+)"[^>]*>(?:&nbsp;|\s)*<\/td>/i.exec(contenidoTd)
    const tieneMargenViaTd = tieneTdDeMargenDedicado && Number(tieneTdDeMargenDedicado[1]) >= 5
    return (tieneMargenViaPadding || tieneMargenViaTd) ? 'Bullet_Bull_Rojo_Margen' : 'Bullet_Bull_Rojo'
  }

  const tieneImagen = /<img\b/i.test(contenidoTd)
  const textoVisible = contenidoTd.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()
  const tieneTexto = textoVisible.length > 2

  if (tieneImagen && !tieneTexto) return 'Imagen_Libre'
  if (tieneTexto && !tieneImagen) return 'Bloque_Texto_Base'

  // Caso real encontrado: imagen Y texto juntos en la misma celda —
  // un Bullet con ícono real (no de carácter). Antes esto seguía al
  // flujo normal de comparación de forma, donde formaDeTags compara
  // contra TODOS los templates por igual — el bug es que el bucket de
  // longitud de texto de cada template (calculado sobre su texto de
  // EJEMPLO guardado en el archivo, no sobre la pieza real) puede
  // empatar por casualidad con Bloque_Texto_Base y hacer que ese gane
  // por orden alfabético, aun cuando el fragmento real tiene una <img>
  // real al inicio (que Bloque_Texto_Base nunca tiene). En vez de
  // seguir agregando dimensiones o reglas de prioridad al vector
  // genérico para parchar cada caso encontrado, la distinción correcta
  // es directa y sin ambigüedad.
  //
  // Acotado a imágenes genuinamente CHICAS (ícono, ≤30px de ancho —
  // el bullet real es 20x20) para no capturar cualquier imagen de
  // contenido con texto al lado (ej. una foto de producto de 265px
  // junto a una descripción, que NO es un Bullet). Solo cuando la
  // imagen es chica tipo-ícono se puede asumir con seguridad que es un
  // Bullet con ícono real — Bullet_Titular_Negro, el único template
  // real con ese patrón exacto (img chica + texto, sin span de
  // bullet-carácter).
  const widthImg = contenidoTd.match(/<img\b[^>]*\swidth="(\d+)"/i)
  const esIconoChico = widthImg && Number(widthImg[1]) <= 30
  if (tieneImagen && tieneTexto && esIconoChico) return 'Bullet_Titular_Negro'

  return null // ninguno (celda vacía/espaciador), o imagen+texto sin ícono chico -> sigue al flujo normal
}

// Punto de entrada de la Fase 2 — se usa solo cuando importarDesdeHtml
// devolvió resultado: null (ningún marcador <!--BLOQUE--> encontrado).
// Mismo shape de retorno { resultado, avisos } que importarDesdeHtml,
// más confianza ('alta' | 'media' | 'baja') para que la UI decida
// cuánto advertir. confianza 'baja' o resultado null deben mostrarse
// como "no se pudo reconocer con seguridad — preferible armar la
// pieza a mano", nunca como un resultado parcial silencioso.
function importarHeuristico(html) {
  const avisos = []

  // Bug real encontrado con una pieza real (China/Feria de Cantón):
  // un comentario condicional MSO (<!--[if (gte mso 9)|(IE)]>...
  // <![endif]-->) puede estar MAL UBICADO en el HTML de origen — no
  // por culpa del importador, sino porque el diseñador original lo
  // dejó envolviendo de más, "tragándose" contenido real que no le
  // correspondía (en este caso, una fila con una imagen de cierre que
  // terminaba fuera del rango que el resto del pipeline analizaba).
  // Los comentarios MSO siempre son ruido de compatibilidad con
  // Outlook — ningún navegador real los renderiza — así que se
  // limpian de TODO el documento antes de cualquier otro cálculo
  // (encontrarTablaContenido, separación de filas, clasificación).
  // Esto resuelve el problema de raíz para cualquier pieza con
  // comentarios MSO mal ubicados, no solo para este caso puntual.
  html = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
  // Después de limpiar los comentarios MSO, pueden quedar <strong></strong>
  // vacíos (o con solo espacios) que los envolvían — los sacamos para
  // no corromper el balance de tags al separar filas.
  html = html.replace(/<strong>\s*<\/strong>/gi, '')

  const tabla = encontrarTablaContenido(html)
  if (!tabla) {
    return { resultado: null, avisos: [{ texto: 'No se pudo identificar la estructura de contenido — esta pieza no coincide con ningún formato reconocido. Es preferible armarla a mano.', tipo: 'general', canvasIdx: null }], confianza: 'baja' }
  }

  // Contenido interno de la tabla de contenido, ya sin su propio
  // <table> de apertura/cierre — buscar el primer ">" tras la
  // apertura para saltear los atributos del tag, igual criterio que
  // el resto del archivo usa con otros tags.
  const aperturaCompleta = html.slice(tabla.inicioTag).match(/^<table\b[^>]*>/)[0]
  const htmlInterno = html.slice(tabla.inicioTag + aperturaCompleta.length, tabla.finTag - '</table>'.length)

  let filas = separarFilasDeNivelSuperior(htmlInterno)
  if (filas.length === 0) {
    return { resultado: null, avisos: [{ texto: 'Se encontró la tabla de contenido pero no se pudieron separar los bloques — preferible armar la pieza a mano.', tipo: 'general', canvasIdx: null }], confianza: 'baja' }
  }

  // Bug real encontrado con una pieza real (Jubilados): la pieza traía
  // DOS contenedores de contenido completos y separados (dos
  // <table id="Show"> distintos, con una imagen de "marcas
  // auspiciantes" entre medio) — ver comentario grande en
  // encontrarTablaContenido. Cada contenedor adicional se procesa
  // exactamente igual que el principal (separar filas, clasificar) y
  // sus bloques se insertan en el canvas en su posición real (después
  // del contenedor principal, en el orden en que aparecen en el HTML),
  // no al final como código personalizado — son bloques reales y
  // reconocibles, no HTML roto.
  for (const adicional of tabla.contenedoresAdicionales) {
    const aperturaAdicional = html.slice(adicional.inicioTag).match(/^<table\b[^>]*>/)[0]
    const htmlInternoAdicional = html.slice(adicional.inicioTag + aperturaAdicional.length, adicional.finTag - '</table>'.length)
    filas = filas.concat(separarFilasDeNivelSuperior(htmlInternoAdicional))
  }
  if (tabla.contenedoresAdicionales.length > 0) {
    avisos.push({ texto: `Se detectaron ${tabla.contenedoresAdicionales.length} ${tabla.contenedoresAdicionales.length === 1 ? 'sección adicional de contenido' : 'secciones adicionales de contenido'} además de la principal — sus bloques se agregaron en orden, revisá que el resultado sea el esperado.`, tipo: 'general', canvasIdx: null })
  }

  // Bug real encontrado con una pieza real (China/Feria de Cantón):
  // HTML genuinamente irregular del lado de la pieza original (un
  // comentario condicional MSO movido de lugar dejaba una imagen de
  // cierre fuera del área de contenido esperada). En vez de intentar
  // reconstruir su posición original con cálculos de balance cada vez
  // más frágiles, se detecta la anomalía (ver encontrarTablaContenido)
  // y el contenido se agrega DIRECTO como código personalizado al
  // final del canvas — así el usuario lo ve resaltado en el preview
  // (mismo overlay "No reconocido" que cualquier otro bloque sin
  // match) y puede moverlo/editarlo a mano a su posición real, en vez
  // de perderlo silenciosamente o de que el sistema adivine mal dónde
  // insertarlo.
  const filasFueraDeRango = tabla.htmlFueraDeRango ? separarFilasDeNivelSuperior(tabla.htmlFueraDeRango) : []

  let coincidencias = 0
  const canvas = filas.map((filaHtml, idx) => {
    // Clasificación estructural directa primero — cubre los casos
    // donde formaDeTags es demasiado pobre para distinguir bien (ver
    // comentario completo junto a clasificarPorEstructuraDirecta). Si
    // no aplica (null), sigue al flujo normal de comparación de forma
    // contra todos los templates. 'codigo' es una señal distinta de
    // null: significa "es estructuralmente inequívoco que esto NO
    // puede ser ningún template real" (ver comentario grande dentro
    // de clasificarPorEstructuraDirecta) — se fuerza directo a Código
    // personalizado, sin pasar por la comparación de puntajes, para
    // no terminar forzando un match "menos malo" contra un template
    // que en los hechos no tiene nada que ver.
    const slugDirecto = clasificarPorEstructuraDirecta(filaHtml)
    if (slugDirecto === 'codigo') {
      avisos.push({ texto: `El bloque ${idx + 1} tiene una estructura de tabla de datos sin template equivalente — se importó como código personalizado.`, tipo: 'no-reconocido', canvasIdx: idx })
      return { id: 'codigo', instanceId: `codigo-${Date.now()}-${idx}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: filaHtml.trim(), htmlEditado: filaHtml.trim(), tipo: 'codigo', slug: 'codigo' }
    }
    if (slugDirecto) {
      const slugFinal = corregirSlugIcono(slugDirecto, filaHtml)
      const match = BLOQUES_CONTENIDO.find(b => b.slug === slugFinal)
      if (match) {
        coincidencias++
        const htmlNormalizado = slugFinal === 'Imagen_Libre'
          ? normalizarImagenLibre(normalizarNegritas(filaHtml.trim()))
          : normalizarNegritas(filaHtml.trim())
        return { ...match, instanceId: `${match.id}-${Date.now()}-${idx}`, htmlEditado: htmlNormalizado }
      }
    }

    let mejorMatch = null
    let mejorPuntaje = 0
    const formaFila = formaDeTags(filaHtml)
    // La última posición del vector es "tiene margen lateral" (ver
    // formaDeTags) — entre candidatos casi empatados en puntaje
    // general, ese detalle puntual puede ser justo lo que distingue
    // dos variantes reales del mismo bloque (ej. un Bullet con <td>
    // de margen dedicado vs. el mismo Bullet con padding-left, sin
    // tabla anidada para el margen). Bug real encontrado: la similitud
    // por conteo de tags le daba más peso a "tiene tabla anidada o
    // no" (una diferencia estructural grande) que a "coincide en
    // margen" (una sola dimensión de diez) — el resultado era que la
    // variante con padding matcheaba contra el Bullet SIN margen
    // (0.900) en vez del Bullet CON margen (0.783), aun cuando ambos
    // tienen margen real, solo que uno lo hace con tabla y el otro con
    // padding. Por eso la selección no es solo "el de mayor puntaje" a
    // secas: entre los candidatos dentro de un margen chico (0.15) del
    // mejor puntaje encontrado, se prioriza el que coincide
    // exactamente en esta dimensión puntual.
    //
    // idxMargen apunta al PENÚLTIMO elemento del vector, no al último
    // — formaDeTags devuelve [...conteoTags, bucketTexto, tieneMargen,
    // esIconoBulletCaracter], en ese orden exacto. Si en el futuro se
    // agrega o reordena alguna dimensión en formaDeTags, este índice
    // hay que revisarlo a mano (no hay una forma más robusta sin
    // nombrar las dimensiones del vector, que se dejó como array
    // posicional simple a propósito).
    const idxMargen = formaFila.length - 2
    let mejorPuntajeConMargenIgual = -1
    let mejorMatchConMargenIgual = null
    for (const candidato of BLOQUES_CONTENIDO) {
      const formaCandidato = formaDeTags(candidato.html)
      const puntaje = similitudDeForma(formaFila, formaCandidato)
      if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejorMatch = candidato }
      if (formaCandidato[idxMargen] === formaFila[idxMargen] && puntaje > mejorPuntajeConMargenIgual) {
        mejorPuntajeConMargenIgual = puntaje
        mejorMatchConMargenIgual = candidato
      }
    }
    // Bug real encontrado con una pieza real: un bloque "Destacado
    // Icono Texto" (caja con ícono 100x100 + texto, puntaje 0.818)
    // perdía el match contra "Btn" (un botón completamente distinto,
    // puntaje 0.679) solo porque Btn coincidía en la dimensión binaria
    // "tiene margen" y la diferencia de puntaje (0.139) caía dentro
    // del margen de tolerancia de 0.15 — la regla de abajo,
    // pensada para distinguir entre DOS VARIANTES CERCANAS de un mismo
    // tipo de bloque (ver comentario grande más arriba, caso real:
    // Bullet con margen por tabla vs. por padding, ambos con puntaje
    // alto), no estaba protegida contra el caso en que el candidato de
    // "margen igual" sea de una familia totalmente distinta y mediocre
    // (0.679 ni siquiera llega al umbral por sí solo). El resultado
    // era peor que no aplicar la regla en absoluto: pasaba de un match
    // correcto y por encima del umbral a "Código personalizado".
    // Fix: la regla de margen solo puede GANARLE al mejor puntaje puro
    // si ese candidato de margen-igual también supera el umbral por su
    // cuenta — si no, no tiene sentido preferirlo a costa de perder un
    // match que ya era válido.
    if (
      mejorMatchConMargenIgual &&
      mejorPuntajeConMargenIgual >= UMBRAL_SIMILITUD_BLOQUE &&
      mejorPuntaje - mejorPuntajeConMargenIgual <= 0.15
    ) {
      mejorMatch = mejorMatchConMargenIgual
      mejorPuntaje = mejorPuntajeConMargenIgual
    }
    if (mejorMatch && mejorPuntaje >= UMBRAL_SIMILITUD_BLOQUE) {
      coincidencias++
      // Normalizar <strong> a <span style="font-weight:bold;"> solo
      // en este caso (matcheó contra un template real) — el HTML
      // guardado tiene que ser coherente con cómo ese template
      // representa la negrita, igual que si el bloque se hubiera
      // armado nativamente en el editor. En el caso de "Código
      // personalizado" (más abajo) NO se normaliza — ahí no hay
      // ningún template de referencia con el que ser coherente, así
      // que el HTML se conserva tal cual vino de la pieza original.
      const slugFinal = corregirSlugIcono(mejorMatch.slug, filaHtml)
      const matchFinal = slugFinal !== mejorMatch.slug ? BLOQUES_CONTENIDO.find(b => b.slug === slugFinal) || mejorMatch : mejorMatch
      return { ...matchFinal, instanceId: `${matchFinal.id}-${Date.now()}-${idx}`, htmlEditado: matchFinal.slug === 'Imagen_Libre' ? normalizarImagenLibre(normalizarNegritas(filaHtml.trim())) : normalizarNegritas(filaHtml.trim()) }
    }
    // Por debajo del umbral — entra como Código personalizado en vez
    // de forzar un match incorrecto o descartar el bloque (mismo
    // criterio fail-soft que importarDesdeHtml con slugs desconocidos).
    avisos.push({ texto: `El bloque ${idx + 1} no coincide con ningún template — se importó como código personalizado.`, tipo: 'no-reconocido', canvasIdx: idx })
    return { id: 'codigo', instanceId: `codigo-${Date.now()}-${idx}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: filaHtml.trim(), htmlEditado: filaHtml.trim(), tipo: 'codigo', slug: 'codigo' }
  })

  const proporcionReconocida = coincidencias / filas.length
  if (proporcionReconocida < 0.5) {
    avisos.push({ texto: `Solo ${coincidencias} de ${filas.length} bloques se reconocieron con confianza — revisá el resultado antes de seguir editando, puede ser preferible rearmar la pieza a mano.`, tipo: 'general', canvasIdx: null })
  }

  // Tema: a diferencia de importarDesdeHtml (donde el HTML siempre
  // viene de generarExport con un orden de atributos fijo y conocido),
  // acá la pieza puede ser de cualquier época — confirmado contra una
  // pieza real de 2019 donde el <td> de contenido tenía el orden
  // `align="center" style="padding: 35px; background-color: X;"
  // bgcolor="X"`, sin `width="100%" valign="top"` y con padding ANTES
  // de background-color dentro del mismo style.
  //
  // CRÍTICO: buscar el color en TODO el html sin ningún criterio de
  // cercanía da falso positivo casi siempre — el <td> EXTERIOR que
  // envuelve la pieza completa también tiene
  // background-color:#ffffff;bgcolor="#ffffff" (fondo blanco general
  // de la plantilla, no del tema), y aparece ANTES que el verdadero
  // <td> de contenido en cualquier pieza.
  //
  // Intento anterior (ventana de N caracteres hacia atrás desde
  // tabla.inicioTag) resultó FRÁGIL ante comentarios condicionales MSO
  // largos — confirmado con una pieza Mall real: el comentario
  // <!--[if (gte mso 9)|(IE)]>...<![endif]--> que antecede a la tabla
  // de contenido puede medir varios cientos de caracteres por sí
  // solo, y eso empuja al <td> de color real fuera de cualquier
  // ventana de tamaño fijo razonable — el resultado era detectar
  // erróneamente ICBC en una pieza que sí era Mall.
  //
  // Solución robusta, inmune a cuánto HTML haya en el medio: en vez de
  // una ventana de caracteres, se buscan TODOS los <td> de color de
  // tema en el documento ENTERO (sin límite), y de esos candidatos se
  // toma el que tenga la posición más cercana a tabla.inicioTag pero
  // ANTERIOR a ella — no hay límite de distancia, así que ningún
  // comentario MSO por largo que sea puede sacar al <td> real de la
  // jugada. El <td> exterior de fondo blanco genérico, aunque también
  // matchea como candidato de tema ICBC, queda descartado porque
  // siempre hay como mínimo otro candidato (el del tema real, si lo
  // hay) más cerca de tabla.inicioTag que él.
  // Bug real encontrado con una pieza de Avisos: el código original
  // solo buscaba el color de tema en <td>, asumiendo que
  // background-color y bgcolor siempre viven en el MISMO <td> que
  // envuelve el contenido (cierto en piezas ICBC/Mall analizadas
  // hasta ahora). Pero en esta pieza de Avisos el color vive en la
  // <table> exterior (`<table style="...background-color: #dcd2c9;"
  // ... bgcolor="#dcd2c9">`), mientras que el <td> de adentro
  // (`padding: 35px`) no tiene ningún color propio — la tabla de
  // Avisos completa quedaba sin detectar, cayendo siempre al tema
  // ICBC por default. La solución es buscar el color de tema en
  // CUALQUIERA de los dos tags (<td> o <table>), no solo en <td> —
  // el resto del criterio (candidato más cercano y ANTERIOR a la
  // tabla de contenido) sigue igual, así que el <td>/<table> exterior
  // de fondo blanco genérico de toda la plantilla sigue descartado
  // por el mismo motivo que antes: siempre hay un candidato real más
  // cerca, si existe.
  // Segundo bug real encontrado, con otra pieza de Avisos: el <td>
  // SÍ tenía background-color (CSS, dentro de style="...") y bgcolor
  // (atributo HTML suelto) en el mismo tag — pero el bgcolor venía
  // con un error de tipeo del diseñador original: bgcolor="#dcd2c9;"
  // (con un ; de sobra DENTRO de las comillas, válido para el
  // navegador — que ignora basura así al parsear un color — pero no
  // para una comparación de string exacto contra
  // `bgcolor="${def.bgContenido}"`). Un único carácter de diferencia
  // hacía que nunca matcheara. Mismo problema podría darse con
  // mayúsculas (BGCOLOR, #DCD2C9) o espacios extra alrededor del =.
  // Solución: extraer el color real de cada uno de los dos atributos
  // por separado (la propiedad CSS dentro de style necesita una
  // regex distinta a la del atributo HTML suelto — no son el mismo
  // formato) y comparar los VALORES ya limpios (normalizados a
  // minúsculas, recortando cualquier caracter que no sea parte de un
  // hex válido), en vez de buscar el string crudo completo.
  function colorDeAtributo(tag, attr, esCss) {
    const re = esCss
      ? new RegExp(`${attr}\\s*:\\s*(#[0-9a-fA-F;\\s]*)`, 'i') // CSS dentro de style="...prop: valor;..."
      : new RegExp(`${attr}\\s*=\\s*["']\\s*(#[0-9a-fA-F;\\s]*)["']`, 'i') // atributo HTML suelto, attr="valor"
    const m = tag.match(re)
    if (!m) return null
    const limpio = m[1].match(/#[0-9a-fA-F]{3,6}/)
    return limpio ? limpio[0].toLowerCase() : null
  }
  let tema = TEMA_DEFAULT
  let mejorDistancia = Infinity
  const todosLosTdOTable = [...html.matchAll(/<(?:td|table)\b[^>]*>/gi)]
  for (const tdMatch of todosLosTdOTable) {
    if (tdMatch.index >= tabla.inicioTag) continue // solo candidatos ANTERIORES a la tabla de contenido
    const tag = tdMatch[0]
    const colorStyle = colorDeAtributo(tag, 'background-color', true)
    const colorBgcolor = colorDeAtributo(tag, 'bgcolor', false)
    if (!colorStyle || !colorBgcolor || colorStyle !== colorBgcolor) continue
    for (const [key, def] of Object.entries(TEMAS)) {
      if (colorStyle === def.bgContenido.toLowerCase()) {
        const distancia = tabla.inicioTag - tdMatch.index
        if (distancia < mejorDistancia) { mejorDistancia = distancia; tema = key }
        break
      }
    }
  }
  // Las filas detectadas fuera del área de contenido esperada (ver
  // comentario grande más arriba) se agregan SIEMPRE como código
  // personalizado, al final del canvas — no tiene sentido intentar
  // matchearlas contra templates: ya sabemos que su posición en el
  // HTML es anómala, lo único que corresponde es que el usuario las
  // vea resaltadas y las mueva/edite a mano a donde correspondan. El
  // aviso lleva el canvasIdx real (la posición que el bloque termina
  // ocupando en canvas, AHORA que ya se empujó) para que el modal
  // pueda hacer scroll/resaltado directo a ese bloque en el preview,
  // en vez de que el usuario tenga que buscarlo a ojo.
  filasFueraDeRango.forEach((filaHtml, idx) => {
    canvas.push({ id: 'codigo', instanceId: `codigo-fuera-de-rango-${Date.now()}-${idx}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: filaHtml.trim(), htmlEditado: filaHtml.trim(), tipo: 'codigo', slug: 'codigo' })
    avisos.push({ texto: 'Se detectó contenido fuera del área de contenido esperada (posible HTML mal armado en la pieza original) — se agregó al final, marcado para revisión manual.', tipo: 'fuera-de-rango', canvasIdx: canvas.length - 1 })
  })

  const colorTextoDetectado = TEMAS[tema].colorTexto
  const canvasConColorRevertido = canvas.map(b => ({ ...b, htmlEditado: revertirColorTexto(b.htmlEditado, colorTextoDetectado) }))

  // Imagen principal: sin marcador <!--IMG_PRINCIPAL--> en piezas
  // externas — los comentarios de diseñador que la envuelven varían
  // entre piezas (<!-- HEADER -->, <!-- INICIO HEADER IMAGEN -->,
  // otros vistos directamente sin comentario alguno), así que no son
  // ancla confiable. El rasgo estructural que SÍ se repite, confirmado
  // en varias piezas reales de distintas familias y épocas: es la
  // primera <img> con width="600" height="425" (el tamaño fijo de la
  // imagen de cabecera en todas las piezas vistas) que aparece ANTES
  // del inicio de la tabla de contenido — acotar a "antes de la tabla
  // de contenido" evita confundirla con una imagen de igual tamaño
  // que por casualidad apareciera dentro de un bloque más adelante.
  const htmlAntesDeContenido = html.slice(0, tabla.inicioTag)
  const imgPrincipalMatch = htmlAntesDeContenido.match(/<img\b[^>]*\bwidth="600"[^>]*\bheight="425"[^>]*>|<img\b[^>]*\bheight="425"[^>]*\bwidth="600"[^>]*>/)
  let imgPrincipal = { activo: false, src: '', alt: '', title: '', link: '' }
  if (imgPrincipalMatch) {
    const tag = imgPrincipalMatch[0]
    const src = tag.match(/\ssrc="([^"]*)"/)?.[1] ?? ''
    if (src) {
      // Si la imagen está envuelta en un <a>, ese link se considera
      // el link de la imagen — mismo criterio que generarExport.
      const idx = imgPrincipalMatch.index
      const ventanaPrevia = htmlAntesDeContenido.slice(Math.max(0, idx - 300), idx)
      const linkMatch = ventanaPrevia.match(/<a\b[^>]*\shref="([^"]*)"[^>]*>(?:(?!<\/a>)[\s\S])*$/)
      imgPrincipal = {
        activo: true,
        src,
        alt: tag.match(/\salt="([^"]*)"/)?.[1] ?? '',
        title: tag.match(/\stitle="([^"]*)"/)?.[1] ?? '',
        link: linkMatch?.[1] ?? '',
      }
    } else {
      avisos.push({ texto: 'Se detectó una imagen principal pero no se pudo leer su URL — revisala manualmente.', tipo: 'general', canvasIdx: null })
    }
  } else {
    avisos.push({ texto: 'No se pudo identificar automáticamente la imagen principal — revisá si corresponde agregarla manualmente.', tipo: 'general', canvasIdx: null })
  }

  // Imagen de footer: mismo problema de comentarios variables. El
  // rasgo estructural que se repite en las piezas que sí tienen
  // footer (confirmado en varias piezas reales): un <td colspan="3">
  // con un <img class="img-max"> adentro, en la tabla que viene
  // DESPUÉS de la tabla de contenido (zona de legales/footer) — se
  // busca a partir de tabla.finTag, nunca antes, para no confundirla
  // con ninguna imagen del contenido. No todas las piezas tienen
  // footer (varias de las analizadas no lo traen), así que no
  // encontrar nada acá no genera aviso — queda inactivo en silencio,
  // igual que una pieza nueva sin footer agregado.
  const htmlDespuesDeContenido = html.slice(tabla.finTag)
  const imgFooterMatch = htmlDespuesDeContenido.match(/<td[^>]*\scolspan="3"[^>]*>(?:(?!<\/td>)[\s\S])*?<img\b[^>]*class="img-max"[^>]*>/)
  let imgFooter = { activo: false, src: '', alt: '', link: '' }
  if (imgFooterMatch) {
    const imgTag = imgFooterMatch[0].match(/<img\b[^>]*>/)?.[0] ?? ''
    const src = imgTag.match(/\ssrc="([^"]*)"/)?.[1] ?? ''
    if (src) {
      const linkMatch = imgFooterMatch[0].match(/<a\b[^>]*\shref="([^"]*)"/)
      imgFooter = {
        activo: true,
        src,
        alt: imgTag.match(/\salt="([^"]*)"/)?.[1] ?? '',
        link: linkMatch?.[1] ?? '',
      }
    }
  }

  // Legales adicionales / legal fijo: sin marcador data-legal-* en
  // piezas externas. El ancla disponible es el texto del legal fijo
  // en sí (LEGAL_FIJO_HTML) — es siempre el mismo texto institucional
  // en toda la app.
  //
  // CRÍTICO: en modo SEPARADO (Mall, cada legal en su propio
  // <tbody>), el legal fijo vive solo, en su propio <td> — ahí basta
  // con descartar el <td> que ENTERO sea el legal fijo. Pero en modo
  // CORRIDO (la mayoría de las piezas: todos los legales y el legal
  // fijo en una sola celda, ver generarExport →
  // `${especificosHtml}<span data-legal-fijo="true">${LEGAL_FIJO_HTML}
  // </span>`), el legal fijo no está SOLO en su <td>, está PEGADO al
  // final del texto del último legal adicional, en el mismo bloque.
  // Bug real encontrado: comparar si el <td> completo EMPIEZA con el
  // legal fijo solo cubre el caso separado — en modo corrido el <td>
  // empieza con el legal adicional, así que nunca matcheaba ese
  // `startsWith`, y el bloque entero (adicional + fijo concatenados)
  // se guardaba como "legal adicional", duplicando el habeas data en
  // el editor (que ya lo agrega aparte, siempre).
  //
  // Fix: buscar DÓNDE aparece el texto del legal fijo DENTRO de cada
  // <td> (no solo si el <td> entero empieza así) y cortar el bloque
  // ahí — todo lo que esté ANTES de ese punto es el legal adicional
  // real (puede ser texto vacío, si el <td> es 100% el legal fijo sin
  // nada más, y en ese caso no se guarda nada).
  //
  // Segundo bug real encontrado, con una pieza real de Fondos Comunes
  // de Inversión (FCI): esa pieza trae, DESPUÉS del legal fijo, una
  // firma institucional de 2 filas — cada fila con DOS <td
  // class="Texto_Legales"> propios (uno alineado a la izquierda, otro
  // a la derecha; ej. "ICBC Investments SAU SGFCI" / "Industrial and
  // Commercial Bank..."), sin relación con el legal largo de texto
  // corrido. El regex de abajo, al buscar CUALQUIER
  // <td class="Texto_Legales">, encontraba estas 4 celdas sueltas y
  // las trataba como 4 "legales adicionales" independientes — y como
  // terminaba habiendo más de una fila con esa clase, activaba por
  // error el modo "legales separados" (texto apilado con espaciador),
  // en vez de reconocer la firma de 2 columnas real. La señal
  // estructural que distingue una fila de firma institucional de una
  // fila de legal real: tiene EXACTAMENTE 2 <td class="Texto_Legales">
  // en la misma fila, sin colspan, uno con text-align:left y el otro
  // con text-align:right — un legal real nunca tiene 2 celdas así (va
  // solo, con colspan, o con text-align:justify). Esas filas se
  // separan ANTES de buscar legales sueltos, para que el regex
  // genérico de abajo nunca llegue a verlas.
  const filaFirmaRegex = /<tr>([\s\S]*?)<\/tr>/g
  const tdsTextoLegalesRegex = /<td(?![^>]*\scolspan=)[^>]*\sclass="Texto_Legales"[^>]*\stext-align:\s*(left|right)[^>]*>([\s\S]*?)<\/td>/g
  let filaFirmaMatch
  const rangosFirmaInstitucional = [] // [inicio, fin] de cada <tr> que es fila de firma, para excluirlos del html antes de buscar legales sueltos
  const filasFirmaEncontradas = []
  // Si el HTML ya viene de un export previo de ESTE editor (ej. el
  // usuario reimporta una pieza propia pegándola de nuevo, sin que el
  // sistema use la vía con marcador <!--FIRMA_INSTITUCIONAL-->), cada
  // celda trae su texto envuelto en <span data-firma-filaN-izq/der=
  // "true">...</span> — hay que despojar ese wrapper antes de guardar
  // el texto, o el usuario vería el span crudo en el panel de edición.
  const limpiarSpanFirma = t => t.replace(/^<span\s+data-firma-fila\d-(?:izq|der)="true">([\s\S]*)<\/span>$/, '$1').trim()
  while ((filaFirmaMatch = filaFirmaRegex.exec(html)) !== null) {
    const filaCompleta = filaFirmaMatch[0]
    const celdas = [...filaCompleta.matchAll(tdsTextoLegalesRegex)]
    if (celdas.length === 2 && celdas[0][1].toLowerCase() === 'left' && celdas[1][1].toLowerCase() === 'right') {
      filasFirmaEncontradas.push({ izq: limpiarSpanFirma(celdas[0][2].trim()), der: limpiarSpanFirma(celdas[1][2].trim()) })
      rangosFirmaInstitucional.push([filaFirmaMatch.index, filaFirmaMatch.index + filaCompleta.length])
    }
  }
  // Si la pieza real solo trae UNA fila con este patrón (no las 2
  // habituales), la segunda queda vacía en vez de completarse con el
  // texto default — forzar "Sociedad Gerente"/"Sociedad Depositaria"
  // cuando el HTML real no los trajo sería inventar contenido que el
  // usuario no escribió. Los valores default solo se usan como
  // placeholder al crear la sección DESDE CERO (toggle "+Agregar" en
  // el panel), no al importar.
  const firmaInstitucional = filasFirmaEncontradas.length >= 1 ? {
    activo: true,
    fila1Izq: filasFirmaEncontradas[0]?.izq ?? '',
    fila1Der: filasFirmaEncontradas[0]?.der ?? '',
    fila2Izq: filasFirmaEncontradas[1]?.izq ?? '',
    fila2Der: filasFirmaEncontradas[1]?.der ?? '',
  } : null
  if (firmaInstitucional) avisos.push({ texto: 'Se detectó una firma institucional (ICBC Investments / Sociedad Gerente-Depositaria) — revisá que el texto importado sea correcto.', tipo: 'general', canvasIdx: null })
  // html sin las filas de firma institucional, para que el regex de
  // legales sueltos de abajo no las vuelva a contar.
  let htmlSinFirmaInstitucional = html
  for (let i = rangosFirmaInstitucional.length - 1; i >= 0; i--) {
    const [inicio, fin] = rangosFirmaInstitucional[i]
    htmlSinFirmaInstitucional = htmlSinFirmaInstitucional.slice(0, inicio) + htmlSinFirmaInstitucional.slice(fin)
  }

  const inicioLegalFijo = LEGAL_FIJO_HTML.slice(0, 60)
  const legalesTdRegex = /<td[^>]*\sclass="Texto_Legales"[^>]*>([\s\S]*?)<\/td>/g
  const legalesEncontrados = []
  let legalMatch
  while ((legalMatch = legalesTdRegex.exec(htmlSinFirmaInstitucional)) !== null) {
    let texto = legalMatch[1].trim()
    const idxLegalFijo = texto.indexOf(inicioLegalFijo)
    if (idxLegalFijo !== -1) texto = texto.slice(0, idxLegalFijo).trim()
    if (texto) legalesEncontrados.push(texto)
  }
  const legalesAdicionales = legalesEncontrados.map((texto, idx) => ({ id: Date.now() + idx, texto }))

  const filasConLegalHeur = new Set()
  const trRegexHeur = /<tr>([\s\S]*?)<\/tr>/g
  let trMatchHeur
  while ((trMatchHeur = trRegexHeur.exec(htmlSinFirmaInstitucional)) !== null) {
    if (trMatchHeur[1].includes('class="Texto_Legales"')) filasConLegalHeur.add(trMatchHeur[0])
  }
  const legalesSeparados = filasConLegalHeur.size > 1

  // Indicadores: mismo patrón que importarDesdeHtml (un <sup> con la
  // referencia, seguido de sigla y valor), pero sin el marcador
  // <!--INDICADORES--> que acota dónde buscar — se busca en toda la
  // zona DESPUÉS de la tabla de contenido (misma zona que imgFooter),
  // que es donde viven los indicadores en todas las piezas vistas.
  // Se excluye explícitamente cualquier <sup> que ya forme parte de
  // un legal adicional (las referencias "(1)", "(2)" dentro del texto
  // de los legales también usan <sup>, y no son indicadores).
  const indicadorRegexHeur = /<sup[^>]*>([\s\S]*?)<\/sup>\s*([^<]+)/g
  const indicadores = []
  let indMatchHeur
  while ((indMatchHeur = indicadorRegexHeur.exec(htmlDespuesDeContenido)) !== null) {
    const resto = indMatchHeur[2].trim()
    // Un indicador real tiene contenido sustancial después del <sup>
    // (ej. "CFTNA 0,00%") — las referencias de legales casi siempre
    // van seguidas de texto largo de párrafo, no de una sigla corta,
    // así que se descarta cualquier match cuyo "resto" sea
    // sospechosamente largo (más de 60 caracteres no es una sigla de
    // indicador, es el inicio de un párrafo de legal).
    if (resto.length > 0 && resto.length <= 60) {
      const partes = resto.split(/\s+/)
      indicadores.push({ id: Date.now() + indicadores.length, ref: indMatchHeur[1].trim(), sigla: partes[0] ?? '', valor: partes.slice(1).join(' ') })
    }
  }

  // Header: sin marcador <!--HEADER:slug--> en piezas externas. ANTES
  // esto se resolvía con BLOQUES_HEADER[0] (el primero alfabético) sin
  // ningún intento real de detección — bug real reportado: una pieza
  // EB terminaba reemplazada por un header CG, cambiando el segmento
  // de marca de la pieza sin que el aviso genérico lo dejara
  // suficientemente claro. El color de banda NO alcanza para
  // distinguir (CG_Banda_Roja_Header y CG_Banda_Roja_Header_Mall
  // comparten el mismo #c4161c, EB y otros pueden compartir negro),
  // pero cada header SÍ tiene un logo institucional propio y único
  // que no se repite entre headers — los íconos de redes sociales
  // (Tw/Fb/Ig/In) son genéricos y aparecen en casi todos, así que se
  // descartan antes de comparar. El logo distintivo de cada header
  // conocido se deriva de su propio HTML (no de una lista aparte que
  // se pueda desincronizar si se agrega un header nuevo).
  //
  // Bug real encontrado al agregar CG_Banda_Roja_Header_Malba: el
  // logo ICBC INSTITUCIONAL genérico (sin ninguna marca de socio o
  // segmento — el isologo simple del banco, usado como remate del
  // header en casi cualquier pieza) tiene varias variantes de archivo
  // según el fondo (logo_ICBC_full_bco.png para CG_Banda_Roja_Header,
  // logo_ICBC_full_b.png para CG_Banda_Roja_Header_Malba,
  // logo_ICBC_b.png para EB_Banda_Negra_Header_Malba) — ninguna de
  // estas variantes identifica un header puntual, igual que pasa con
  // los íconos de redes. Una pieza real (notificación de límite de
  // tarjeta, SIN nada de Malba) que solo trae el logo ICBC genérico
  // matcheaba por error contra CG_Banda_Roja_Header_Malba porque esa
  // pieza usa la MISMA variante de archivo (logo_ICBC_full_b.png) que
  // el header Malba — un logo que en los hechos no tiene nada que ver
  // con Malba, solo coincide la variante de color de fondo. Se
  // excluye explícitamente cualquier variante del isologo genérico
  // (anclado al nombre de archivo exacto, NO a "contiene ICBC" — eso
  // sí seguiría capturando por error logos realmente distintivos como
  // Logo_ICBC_Mall_240x60.png, que identifica al header Mall y debe
  // seguir contando como distintivo).
  const ESDistintivoGenerico = /logo-(Tw|Fb|Ig|In)_B_\d+x\d+\.png|logo[-_]ICBC(?:_full)?_b(?:co)?\.png$/i
  function logosDistintivos(htmlHeader) {
    return [...htmlHeader.matchAll(/<img\b[^>]*\ssrc="([^"]*)"/gi)]
      .map(m => m[1])
      .filter(src => !ESDistintivoGenerico.test(src))
  }
  // Bug real encontrado con una pieza real (evento MALBA): el mismo
  // socio institucional puede tener banda de header en MÁS DE UN
  // segmento (EB_Banda_Negra_Header_Malba con fondo negro,
  // CG_Banda_Roja_Header_Malba con fondo rojo) — comparten el logo
  // "firma_socio_malba_2.png" porque es el mismo logo de marca, pero
  // pertenecen a segmentos distintos. El comentario de arriba ("el
  // color NO alcanza para distinguir") seguía siendo válido para el
  // caso que motivó el fix original (headers con logos YA distintos
  // entre sí, donde el color por sí solo es ambiguo), pero no cubre
  // este caso nuevo, inverso: dos headers con el MISMO logo
  // distintivo, que sólo se diferencian por el color de fondo de la
  // banda. Antes de este fix, el primer candidato que matcheara el
  // logo compartido ganaba por orden de array (alfabético) — funcionó
  // por casualidad mientras CG_Banda_Roja_Header_Malba no existía
  // (era el único match) y seguía funcionando por casualidad de
  // alfabeto al agregarlo (CG < EB alfabéticamente), pero es el mismo
  // patrón frágil ya visto con otros bugs de esta sesión: no hay que
  // confiar en que el orden del array vaya a seguir siendo favorable.
  // Solución: cuando el logo distintivo de un candidato aparece
  // también en OTRO candidato (logo compartido entre headers de
  // distinto segmento), no alcanza con el logo solo — hay que
  // confirmar además que el color de fondo de la banda coincida.
  function colorDeFondoHeader(htmlHeader) {
    const aperturaTabla = htmlHeader.match(/^<table\b[^>]*>/i)
    if (!aperturaTabla) return null
    const m = aperturaTabla[0].match(/(?:background-color|bgcolor)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,6})/i)
    return m ? m[1].toLowerCase() : null
  }
  let bandaHeader = null
  for (let i = 0; i < BLOQUES_HEADER.length; i++) {
    const candidato = BLOQUES_HEADER[i]
    const distintivosCandidato = logosDistintivos(candidato.html)
    const logoEncontrado = distintivosCandidato.some(src => htmlAntesDeContenido.includes(src))
    if (!logoEncontrado) continue
    // ¿Algún OTRO candidato comparte alguno de estos mismos logos
    // distintivos? Si no, el match por logo solo ya es inequívoco —
    // mismo comportamiento que antes para todos los headers actuales
    // que no comparten logo con ningún otro.
    const logoCompartido = BLOQUES_HEADER.some((otro, j) => j !== i && logosDistintivos(otro.html).some(src => distintivosCandidato.includes(src)))
    if (!logoCompartido) { bandaHeader = candidato; break }
    // Logo compartido entre varios headers: desempatar por color de
    // fondo real de la banda en el HTML importado, comparado contra
    // el color de fondo propio de cada candidato que compartía el
    // logo. Buscamos el color en TODO htmlAntesDeContenido (no solo
    // en la apertura del primer tag) porque la banda de header puede
    // venir envuelta en comentarios condicionales MSO antes del
    // <table> real, igual criterio que ya se usa para el color de
    // tema general.
    const colorCandidato = colorDeFondoHeader(candidato.html)
    if (colorCandidato && htmlAntesDeContenido.includes(`#${colorCandidato.slice(1)}`)) {
      const coincideStyle = new RegExp(`background-color\\s*:\\s*${colorCandidato}`, 'i').test(htmlAntesDeContenido)
      const coincideBgcolor = new RegExp(`bgcolor\\s*=\\s*["']${colorCandidato}["']`, 'i').test(htmlAntesDeContenido)
      if (coincideStyle || coincideBgcolor) { bandaHeader = candidato; break }
    }
  }
  if (bandaHeader) {
    avisos.push({ texto: `Header detectado: "${bandaHeader.nombre}".`, tipo: 'general', canvasIdx: null })
  } else {
    // Bug real encontrado al agregar el EB básico real (hasta ahora,
    // el archivo EB_Banda_Negra_Header.html guardado era en realidad
    // el de EB Exclusive — mal nombrado desde el origen, el usuario lo
    // corrigió): un header "básico puro" (solo redes + el isologo
    // genérico ICBC, sin ningún logo de marca propio) nunca puede
    // matchear por logo — el genérico está excluido a propósito (ver
    // ESDistintivoGenerico). Hasta ahora esto no era un problema
    // porque el ÚNICO header así era CG_Banda_Roja_Header, que
    // resultaba ser, por casualidad de orden alfabético, el propio
    // default global (BLOQUES_HEADER[0]) — funcionaba bien sin que el
    // código lo garantizara a propósito. Con un segundo header básico
    // puro (EB, fondo negro) ese mismo camino feliz ya no alcanza: una
    // pieza EB básica real terminaría cayendo al default CG (rojo),
    // cambiando el segmento de marca — el mismo tipo de bug ya visto
    // con Malba, pero por ausencia total de logo en vez de logo
    // compartido. Antes de caer al default global sin distinguir
    // nada, se intenta un segundo desempate: entre los headers que NO
    // tienen NINGÚN logo no-genérico (los "básicos puros" — hoy son
    // exactamente dos: CG y EB), ¿el color de fondo de la pieza
    // coincide con alguno de ellos? Si coincide con exactamente uno,
    // se usa ese — sigue siendo más confiable que el default ciego,
    // aunque no haya ningún logo de marca que lo confirme. Si no
    // coincide con ninguno (pieza realmente irreconocible) o coincide
    // con más de uno (no debería pasar mientras cada básico puro tenga
    // un color de fondo distinto, pero por si acaso), se cae al
    // default de siempre.
    const basicosPuros = BLOQUES_HEADER.filter(b => logosDistintivos(b.html).length === 0)
    const basicosPorColor = basicosPuros.filter(b => {
      const color = colorDeFondoHeader(b.html)
      if (!color || !htmlAntesDeContenido.includes(`#${color.slice(1)}`)) return false
      const coincideStyle = new RegExp(`background-color\\s*:\\s*${color}`, 'i').test(htmlAntesDeContenido)
      const coincideBgcolor = new RegExp(`bgcolor\\s*=\\s*["']${color}["']`, 'i').test(htmlAntesDeContenido)
      return coincideStyle || coincideBgcolor
    })
    if (basicosPorColor.length === 1) {
      bandaHeader = basicosPorColor[0]
      avisos.push({ texto: `Header detectado: "${bandaHeader.nombre}" (por color de fondo, sin logo de marca propio para confirmar — revisalo si no es el esperado).`, tipo: 'general', canvasIdx: null })
    } else {
      bandaHeader = BLOQUES_HEADER[0] ?? null
      avisos.push({ texto: 'El header de la pieza original no se pudo identificar automáticamente — se dejó uno por defecto, revisalo y volvé a seleccionarlo si corresponde (puede no coincidir con el segmento real de la pieza).', tipo: 'general', canvasIdx: null })
    }
  }

  // redesOrden: bug real reportado — el header elegido es el TEMPLATE
  // conocido más parecido, pero el template puede traer más (o
  // distintas) redes sociales que las que la pieza real tenía. Si se
  // deja redesOrden en null, el editor lo rellena automáticamente
  // detectando las redes DEL TEMPLATE (ver el useEffect que llama
  // detectarRedesSociales(bandaHeader.html) — eso es correcto para una
  // pieza nueva armada desde cero, pero está mal para una importación,
  // donde hay que respetar lo que la pieza ORIGINAL realmente tenía
  // (ej. una pieza sin ningún ícono de red social no debe terminar con
  // las 4 redes del template agregadas de la nada). Por eso acá se
  // detectan las redes reales sobre htmlAntesDeContenido (la pieza
  // importada), no sobre bandaHeader.html (el template) — si la pieza
  // no tenía ninguna, redesOrden queda en un array vacío (no null), así
  // el useEffect de relleno automático no se dispara para sobreescribirlo.
  const redesDeLaPiezaOriginal = detectarRedesSociales(htmlAntesDeContenido)
  const redesOrdenDetectado = redesDeLaPiezaOriginal.map(key => ({ key, activa: true }))
  if (bandaHeader && redesDeLaPiezaOriginal.length !== detectarRedesSociales(bandaHeader.html).length) {
    avisos.push({ texto: 'La cantidad de redes sociales de la pieza original no coincide exactamente con las del header detectado — revisá el panel de redes del header.', tipo: 'general', canvasIdx: null })
  }

  const confianza = (proporcionReconocida >= 0.85 && tabla.viaShow) ? 'alta' : (proporcionReconocida >= 0.5 ? 'media' : 'baja')

  return {
    resultado: {
      bandaHeader,
      redesOrden: redesOrdenDetectado,
      tema,
      canvas: canvasConColorRevertido,
      imgPrincipal,
      imgFooter,
      legalesAdicionales,
      legalesSeparados,
      firmaInstitucional,
      indicadores,
    },
    avisos,
    confianza,
  }
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

// Reemplaza el color BASE de texto (#333333) por el del tema activo —
// se aplica recién al exportar/previsualizar, nunca al guardar el
// htmlEditado del bloque en sí. Esto es deliberado: si se aplicara al
// cargar el bloque al canvas, el HTML guardado quedaría "teñido" con
// el color de ESE momento, y cambiar de tema después no actualizaría
// nada sin re-aplicar el reemplazo a mano. Aplicándolo siempre como
// el último paso antes de generar el HTML final, cambiar de tema
// (ICBC/Avisos/Mall) en cualquier momento refleja el color correcto
// de inmediato, sin tocar el contenido real editado por el usuario.
// Nunca toca #c4161c (el rojo de marca/acento) — ese es intencional
// en los 3 temas, no es "texto base".
function aplicarColorTexto(html, colorTexto) {
  if (colorTexto === '#333333') return html // tema ICBC, color original, nada que cambiar
  return html.replace(/color:\s*#333333/gi, `color: ${colorTexto}`)
}

// Inversa de aplicarColorTexto — usada al IMPORTAR, no al exportar.
// El HTML que se está importando ya viene teñido con el color del
// tema detectado (si no es ICBC), porque generarExport lo aplicó antes
// de que el usuario lo descargara/copiara. Pero htmlEditado en memoria
// tiene que quedar con el color BASE neutro (#333333), igual que
// cualquier bloque armado nativamente en el editor — si no se revierte
// acá, el bloque importado queda con el color del tema "quemado", y
// cambiar de tema más adelante en el mismo editor ya no podría
// recolorearlo (aplicarColorTexto no tiene nada que reemplazar si el
// string ya no contiene #333333). Mismo patrón de regex que la ida,
// en sentido inverso, para no afectar ningún otro uso de colorTexto
// que no sea esta propiedad CSS puntual.
function revertirColorTexto(html, colorTexto) {
  if (colorTexto === '#333333') return html // tema ICBC, no hubo reemplazo que revertir
  const escapado = colorTexto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(new RegExp(`color:\\s*${escapado}`, 'gi'), 'color: #333333')
}

// ─── Redes sociales en bandas de Header ────────────────────────────────────
// Cualquier banda de header (ICBC, Mall, Comex, las que se sumen a
// futuro) puede traer hasta 4 íconos de redes — algunas comunicaciones
// puntuales no las usan (ver CG_Banda_Roja_Header_Comex.html, que ya
// viene con los <td class="IconoRedes"> vacíos). En vez de modelar 2
// versiones de cada header (con/sin redes), se detectan las redes
// presentes por el dominio del <a href> dentro de cada
// <td class="IconoRedes">, y se reordenan/desactivan al vuelo al
// exportar/previsualizar — mismo criterio que aplicarColorTexto: la
// transformación se aplica recién al generar el HTML final, nunca se
// "quema" en el bandaHeader guardado. El ORDEN del array de abajo es
// el orden real en el que aparecen hoy en los headers existentes —
// no tiene ningún significado especial más que ser el default antes
// de que el usuario reordene.
// Íconos de redes sociales como SVG propios — lucide-react eliminó
// todos los íconos de marca registrada (Twitter/X, Facebook,
// Instagram, GitHub, etc.) en su versión 1.0 por motivos legales y de
// mantenimiento, recomendando reemplazarlos por un SVG propio o el
// paquete aparte Simple Icons. Como son solo 4 íconos chicos y fijos,
// se escriben acá inline en vez de sumar una dependencia nueva al
// proyecto solo para esto. Mismo patrón de props (size, currentColor
// vía CSS) que los íconos de lucide-react que ya se usan en el resto
// del archivo, para que el resto del código no tenga que tratarlos
// distinto.
function IconoTwitter({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.9 1.9h3.7l-8.1 9.3 9.5 12.6h-7.5l-5.9-7.7-6.7 7.7H.2l8.7-9.9L0 1.9h7.6l5.3 7.1zM17 22h2L7.1 3.6H5z" />
    </svg>
  )
}
function IconoFacebook({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.5 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94z" />
    </svg>
  )
}
function IconoInstagram({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
function IconoLinkedin({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.34 18.34V9.75H5.67v8.59zM7 8.6a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1zm11.34 9.74v-4.7c0-2.52-1.35-3.69-3.15-3.69a2.72 2.72 0 0 0-2.46 1.35h-.04V9.75H10v8.59h2.67v-4.27c0-1.13.21-2.22 1.61-2.22 1.38 0 1.4 1.29 1.4 2.29v4.2z" />
    </svg>
  )
}

const REDES_SOCIALES = [
  { key: 'twitter',   dominio: 'twitter.com',   label: 'Twitter',   Icono: IconoTwitter },
  { key: 'facebook',  dominio: 'facebook.com',  label: 'Facebook',  Icono: IconoFacebook },
  { key: 'instagram', dominio: 'instagram.com', label: 'Instagram', Icono: IconoInstagram },
  { key: 'linkedin',  dominio: 'linkedin.com',  label: 'LinkedIn',  Icono: IconoLinkedin },
]

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
function detectarRedesSociales(html, conEstado = false) {
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
function reordenarRedesSociales(html, ordenActivo) {
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

// ─── Panel de edición de la banda Header (redes sociales) ──────────────────
// Una sola lista de pills (uno por red detectada en el header actual),
// cada pill con el ícono de la red en gris neutro (sin colores de
// marca — desentonaban del resto del diseño del editor, que usa un
// único acento violeta para todo estado activo/hover) — click para
// tachar/activar (igual idea visual que ya usa el resto del editor
// para "incluida/no incluida"), arrastrable para reordenar. El orden
// del array ES el orden final en el export — no hay una zona separada
// de "disponibles" vs "activas", todo vive en una sola lista, más
// simple de entender de un vistazo.
function PanelEditorHeader({ bandaHeader, redesOrden, onToggle, onReordenar }) {
  const [dragKey, setDragKey] = useState(null)
  const redes = redesOrden ?? []

  if (redes.length === 0) {
    return (
      <div className="ep-editor-empty">
        <Layout size={28} style={{ color: 'var(--border)' }} />
        <span>Esta banda de header no tiene redes sociales para editar.</span>
      </div>
    )
  }

  return (
    <div className="ep-editor-body">
      <div className="ep-campo">
        <label className="ep-campo-label">Redes sociales</label>
        <p className="ep-header-redes-hint">
          Click para mostrar/ocultar — arrastrá para reordenar.
        </p>
        <div className="ep-header-redes-pills">
          {redes.map(r => {
            const red = REDES_SOCIALES.find(s => s.key === r.key)
            if (!red) return null
            const Icono = red.Icono
            return (
              <div
                key={r.key}
                className={`ep-header-red-pill ${!r.activa ? 'inactiva' : ''} ${dragKey === r.key ? 'dragging' : ''}`}
                draggable
                onDragStart={() => setDragKey(r.key)}
                onDragEnd={() => setDragKey(null)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  if (dragKey && dragKey !== r.key) onReordenar(dragKey, redes.findIndex(x => x.key === r.key))
                  setDragKey(null)
                }}
                onClick={() => onToggle(r.key)}
                title={r.activa ? `Ocultar ${red.label}` : `Mostrar ${red.label}`}
              >
                <GripVertical size={12} className="ep-header-red-grip" />
                <Icono size={14} />
                <span>{red.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PanelEditor({ bloque, onActualizar, onSwap }) {
  const [htmlLocal, setHtmlLocal] = useState(bloque.htmlEditado || bloque.html)
  const [saving, setSaving] = useState(false)

  // Estados para el panel de Imagen Libre — declarados siempre al
  // nivel del componente (reglas de hooks). Se inicializan leyendo
  // directo del HTML real del bloque (htmlEditado si existe, sino html
  // del template) para evitar el bug de import donde el panel mostraba
  // la imagen de ejemplo del template en vez de la importada.
  const _ilHtml = bloque.htmlEditado || bloque.html
  const _ilImgAttrs = (() => { const m = _ilHtml.match(/<img([^>]*)>/i); return m ? m[1] : '' })()
  const _ilGetAttr = (name) => { const m = _ilImgAttrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i')); return m ? m[1] : '' }
  const _ilGetStyleProp = (prop) => { const m = _ilImgAttrs.match(new RegExp(`${prop}:\\s*([\\d.]+)px`, 'i')); return m ? m[1] : '' }
  const _ilGetClass = () => { const m = _ilImgAttrs.match(/class=["']([^"']*)["']/i); return m ? m[1] : '' }
  const _ilLinkMatch = _ilHtml.match(/<a\s[^>]*href=["']([^"']*)["'][^>]*>\s*<img/i)
  const [ilSrc, setIlSrc] = useState(_ilGetAttr('src'))
  const [ilAlt, setIlAlt] = useState(_ilGetAttr('alt'))
  const [ilTitle, setIlTitle] = useState(_ilGetAttr('title'))
  const [ilWidth, setIlWidth] = useState(_ilGetAttr('width') || _ilGetStyleProp('max-width') || _ilGetStyleProp('width'))
  const [ilHeight, setIlHeight] = useState(_ilGetAttr('height'))
  const [ilClase, setIlClase] = useState(_ilGetClass())
  const [ilLink, setIlLink] = useState(_ilLinkMatch ? _ilLinkMatch[1] : '')
  // Por defecto, SIEMPRE contra bloque.html (el HTML original del
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
  //
  // EXCEPCIÓN real encontrada con bloques IMPORTADOS: la heurística de
  // importación puede matchear un bloque real contra un template cuya
  // forma es parecida pero con MENOS repeticiones internas que el
  // contenido real (ej. un template de "un solo bullet" matcheando
  // contra una pieza real con DOS bullets anidados dentro del mismo
  // <td> padre — la similitud de forma los considera "el mismo tipo de
  // bloque" a propósito, ver formaDeTags). En ese caso, contar campos
  // sobre bloque.html (el template, con 1 bullet) deja afuera el
  // segundo bullet real, que sí existe en bloque.htmlEditado — el
  // usuario podía editar el primero pero no tenía forma de llegar al
  // segundo.
  //
  // El criterio de "cuál usar como base" NO puede ser "cuál detecta
  // más CAMPOS" (detectarCampos filtra por contenido — un <td> vacío
  // no cuenta como campo) — eso reintroduce el mismo bug que esto
  // pretende arreglar: si el usuario vacía el PRIMER bullet de los dos
  // y guarda, al reabrir el panel detectarCampos(htmlEditado) vuelve a
  // dar 1 campo (el vaciado ya no cuenta), empata con el original (1),
  // y el SEGUNDO bullet (con contenido real) queda inaccesible de
  // nuevo — el bug que se quería resolver, pero ahora persistente
  // entre sesiones. Por eso la comparación es ESTRUCTURAL: cantidad
  // TOTAL de <td> (sin filtrar por contenido, count crudo) — un <td>
  // vacío sigue siendo un <td>, así que este número es estable sin
  // importar qué tan vacíos estén los campos. Si htmlEditado tiene más
  // <td> totales que el original, hay repeticiones reales que el
  // template no contempla, y se usa ese como base — en el caso normal
  // (sin importación, o importación sin repeticiones extra) ambos
  // tienen la misma cantidad de <td>, así que el comportamiento de
  // siempre queda intacto.
  const camposOriginales = useRef(null)
  if (!camposOriginales.current) {
    const contarTds = (h) => (h.match(/<td\b/gi) || []).length
    const tdsOriginal = contarTds(bloque.html)
    const tdsEditado = bloque.htmlEditado ? contarTds(bloque.htmlEditado) : 0
    const baseHtml = tdsEditado > tdsOriginal ? bloque.htmlEditado : bloque.html
    camposOriginales.current = detectarCampos(baseHtml)
  }
  const esCodigo = bloque.tipo === 'codigo'
  const esEspaciador = bloque.slug === 'Espaciador'
  const esImagenLibre = bloque.slug === 'Imagen_Libre'
  const sinCampos = !esCodigo && !esEspaciador && !esImagenLibre && camposOriginales.current.length === 0

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

  // ── Panel dedicado para Imagen Libre ────────────────────────────────
  // A diferencia de los bloques genéricos (donde CampoImagen solo
  // muestra dimensiones cuando hay desproporción), acá SIEMPRE se
  // muestran todos los campos: src, alt, title, width, height, link y
  // clase mobile. Se lee directo de htmlLocal (que viene de
  // bloque.htmlEditado ?? bloque.html) para evitar el bug de import
  // donde CampoImagen inicializaba con la imagen de ejemplo del
  // template en vez de la imagen real importada.
  if (esImagenLibre) {
    // Helpers para leer valores actuales del htmlLocal — se usan
    // solo dentro de commitImagenLibre. Los estados controlled de
    // cada input (ilSrc, ilAlt, etc.) están declarados al nivel del
    // componente para respetar las reglas de hooks.
    const imgMatch = htmlLocal.match(/<img([^>]*)>/i)
    const imgAttrs = imgMatch ? imgMatch[1] : ''
    const getAttr = (name) => {
      const m = imgAttrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))
      return m ? m[1] : ''
    }
    const getStyleProp = (prop) => {
      const m = imgAttrs.match(new RegExp(`${prop}:\\s*([\\d.]+)px`, 'i'))
      return m ? m[1] : ''
    }
    const getClass = () => {
      const m = imgAttrs.match(/class=["']([^"']*)["']/i)
      return m ? m[1] : ''
    }
    // Link: detecta si la imagen está envuelta en un <a href="...">
    const linkMatch = htmlLocal.match(/<a\s[^>]*href=["']([^"']*)["'][^>]*>\s*<img/i)
    const linkActual = linkMatch ? linkMatch[1] : ''

    // Aplica un cambio puntual sobre htmlLocal y lo propaga al editor
    // inmediatamente (auto-save en blur) — el botón "Aplicar" llama
    // a aplicar() que hace el mismo onActualizar con feedback visual.
    function commitImagenLibre(cambios) {
      setHtmlLocal(prev => {
        let h = prev
        // src
        if (cambios.src !== undefined)
          h = h.replace(/(<img[^>]*)\bsrc=["'][^"']*["']/i, `$1src="${cambios.src}"`)
        // alt
        if (cambios.alt !== undefined)
          h = h.replace(/(<img[^>]*)\balt=["'][^"']*["']/i, `$1alt="${cambios.alt}"`)
        // title — agregar si no existe
        if (cambios.title !== undefined) {
          if (/\btitle=["'][^"']*["']/i.test(h))
            h = h.replace(/(<img[^>]*)\btitle=["'][^"']*["']/i, `$1title="${cambios.title}"`)
          else
            h = h.replace(/(<img[^>]*)>/i, `$1 title="${cambios.title}">`)
        }
        // width: atributo + propiedad CSS en style si existe
        if (cambios.width !== undefined) {
          h = h.replace(/(<img[^>]*)\bwidth=["']\d*["']/i, `$1width="${cambios.width}"`)
          if (/max-width:\s*\d+px/i.test(h))
            h = h.replace(/(style="[^"]*)\bmax-width:\s*\d+px/i, `$1max-width: ${cambios.width}px`)
        }
        // height: atributo
        if (cambios.height !== undefined)
          h = h.replace(/(<img[^>]*)\bheight=["']\d*["']/i, `$1height="${cambios.height}"`)
        // clase mobile — tres casos: reemplazar existente, agregar si
        // no había, o quitar el atributo si se dejó vacío
        if (cambios.clase !== undefined) {
          if (/\bclass=["'][^"']*["']/i.test(h)) {
            if (cambios.clase.trim() === '') {
              // Quitar el atributo class completo
              h = h.replace(/\s*\bclass=["'][^"']*["']/i, '')
            } else {
              h = h.replace(/\bclass=["'][^"']*["']/i, `class="${cambios.clase}"`)
            }
          } else if (cambios.clase.trim() !== '') {
            // Agregar class antes del style o del cierre del tag
            h = h.replace(/(<img[^>]*?)(\s+style=|\/?>)/i, `$1 class="${cambios.clase}"$2`)
          }
        }
        // link: envolver o actualizar el <a> que rodea la imagen
        if (cambios.link !== undefined) {
          const tieneLink = /<a\s[^>]*href=/i.test(h)
          if (cambios.link.trim() === '') {
            // Quitar el <a> si existía
            h = h.replace(/<a\s[^>]*>\s*(<img[^>]*>)\s*<\/a>/i, '$1')
          } else if (tieneLink) {
            h = h.replace(/(<a\s[^>]*)\bhref=["'][^"']*["']/i, `$1href="${cambios.link}"`)
          } else {
            // Envolver la imagen en un <a> nuevo
            h = h.replace(/(<img[^>]*>)/i, `<a href="${cambios.link}" target="_blank">$1</a>`)
          }
        }
        return h
      })
    }

    // Estados locales por campo — declarados al nivel del componente,
    // ver inicio de PanelEditor.

    return (
      <>
        <div className="ep-editor-body">
          <div className="ep-campo">
            <label className="ep-campo-label">URL de la imagen</label>
            <input className="ep-campo-input" autoComplete="off" value={ilSrc}
              onChange={e => setIlSrc(e.target.value)}
              onBlur={e => commitImagenLibre({ src: e.target.value })}
              placeholder="https://cdn.ejemplo.com/imagen.png" />
          </div>
          <div className="ep-campo">
            <label className="ep-campo-label">Alt</label>
            <input className="ep-campo-input" autoComplete="off" value={ilAlt}
              onChange={e => setIlAlt(e.target.value)}
              onBlur={e => commitImagenLibre({ alt: e.target.value })}
              placeholder="Texto alternativo" />
          </div>
          <div className="ep-campo">
            <label className="ep-campo-label">Title</label>
            <input className="ep-campo-input" autoComplete="off" value={ilTitle}
              onChange={e => setIlTitle(e.target.value)}
              onBlur={e => commitImagenLibre({ title: e.target.value })}
              placeholder="Título de la imagen" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div className="ep-campo" style={{ flex: 1 }}>
              <label className="ep-campo-label">Ancho (px)</label>
              <input className="ep-campo-input" autoComplete="off" value={ilWidth}
                onChange={e => setIlWidth(e.target.value)}
                onBlur={e => commitImagenLibre({ width: e.target.value })}
                placeholder="530" />
            </div>
            <div className="ep-campo" style={{ flex: 1 }}>
              <label className="ep-campo-label">Alto (px)</label>
              <input className="ep-campo-input" autoComplete="off" value={ilHeight}
                onChange={e => setIlHeight(e.target.value)}
                onBlur={e => commitImagenLibre({ height: e.target.value })}
                placeholder="auto" />
            </div>
          </div>
          <div className="ep-campo">
            <label className="ep-campo-label">Link (opcional)</label>
            <input className="ep-campo-input" autoComplete="off" value={ilLink}
              onChange={e => setIlLink(e.target.value)}
              onBlur={e => commitImagenLibre({ link: e.target.value })}
              placeholder="https://..." />
          </div>
          <div className="ep-campo">
            <label className="ep-campo-label">Clase mobile</label>
            <input className="ep-campo-input" autoComplete="off" value={ilClase}
              onChange={e => setIlClase(e.target.value)}
              onBlur={e => commitImagenLibre({ clase: e.target.value })}
              placeholder="img-max, img-max-product, img-max-Logo…" />
            <span className="ep-campo-hint">Define cómo se adapta la imagen en pantallas chicas. Clases disponibles: <code>img-max</code> (100%), <code>img-max-product</code> (50%), <code>img-max-Logo</code> (85%)</span>
          </div>
        </div>
        <div className="ep-editor-footer">
          <button className="ep-btn ep-btn-primary ep-btn-aplicar" onClick={aplicar} disabled={saving}>
            {saving ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
            {saving ? 'Aplicando…' : 'Aplicar cambios'}
          </button>
          <button className="ep-btn ep-btn-ghost ep-btn-aplicar" onClick={resetBloque} style={{ marginTop: 4 }}>
            <RotateCcw size={13} /> Restaurar original
          </button>
        </div>
      </>
    )
  }
  // Valor actual de cada <td>-hoja, indexado por posicionOrden (ver
  // comentario grande junto a extraerTdsConBalance) — usa balance real
  // de profundidad, a diferencia del regex no-greedy simple que se
  // usaba antes (no respeta anidamiento: con doble nivel de tablas,
  // como Borde_Izq_Rojo_Texto, terminaba devolviendo el contenido de
  // la celda equivocada). SIN filtrar por contenido, porque acá lo que
  // importa es poder indexar por posicionOrden de forma estable. Si en
  // cambio se llamara a detectarCampos(htmlLocal) de nuevo, un campo
  // vaciado dejaría de aparecer en esa lista y correría los índices de
  // los campos siguientes — el mismo bug que ya se corrigió en
  // detectarCampos / actualizarCampoEnHtml, pero del lado de la
  // lectura en vez de la escritura.
  //
  // Bug real reportado, ya resuelto (uso normal, sin necesidad de
  // importar nada — pasaba con cualquier bloque, recién arrastrado o
  // importado): este código YA decía en el comentario que indexaba
  // por posicionOrden, pero efectivamente buscaba por
  // campo.posicionReal (= posicionContenido, ver detectarCampos) —
  // una discrepancia real entre lo documentado y lo implementado.
  // posicionContenido de una celda vacía pasa a ser null en cuanto esa
  // celda deja de tener contenido real, así que después de vaciar el
  // ÚNICO campo de texto de un bloque, buscar por posicionContenido ya
  // no encontraba nada — ni para LEER el valor actual (esta función)
  // ni para ESCRIBIR uno nuevo (actualizarCampoEnHtml, ver ese
  // comentario para el detalle completo), el campo quedaba vacío para
  // siempre sin importar cuánto se reintentara escribir. Fix: tanto
  // esta función como actualizarCampoEnHtml ahora anclan por
  // posicionOrden (propiedad fija de la posición física de la celda,
  // nunca cambia esté vacía o no) — detectarCampos ahora expone
  // posicionOrden en cada campo de texto además de posicionReal.
  const todosLosTdActuales = extraerTdsConBalance(htmlLocal)
  function valorActualDeTexto(campo) {
    const celda = todosLosTdActuales.find(c => c.posicionOrden === campo.posicionOrden)
    return celda ? celda.contenido : campo.contenido
  }

  // Mismo problema que el de arriba, pero del lado de imagen: campo.src
  // (y alt/title/width/height) quedan FIJOS desde el detectarCampos
  // original (corrido una sola vez, contra bloque.html o
  // bloque.htmlEditado — ver comentario grande más arriba), y
  // CampoImagen los usa para inicializar su propio useState. Bug real
  // reportado: en un bloque importado por heurística que matchea
  // contra un template (ej. Imagen_Libre) con la MISMA cantidad de
  // <td> que el HTML real importado, baseHtml termina siendo
  // bloque.html (el template) — y el <img src> que se muestra en el
  // panel es el de la imagen de EJEMPLO hardcodeada en ese archivo de
  // template, no la imagen real de la pieza que se importó (que sí
  // está bien en htmlLocal/bloque.htmlEditado, solo que nadie la
  // vuelve a leer de ahí). Mismo criterio de fix que valorActualDeTexto:
  // releer el <img> real por posicionReal contra htmlLocal en cada
  // render, en vez de confiar en el valor capturado una sola vez.
  const todosLosImgActuales = [...htmlLocal.matchAll(/<img([^>]*)>/gi)].map(m => m[1])
  function valorActualDeImagen(campo) {
    const attrs = todosLosImgActuales[campo.posicionReal]
    if (attrs === undefined) return campo
    const getAttr = (name) => {
      const m = attrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))
      return m ? m[1] : ''
    }
    const getStyleProp = (prop) => {
      const m = attrs.match(new RegExp(`${prop}:\\s*([\\d.]+)px`, 'i'))
      return m ? m[1] : ''
    }
    return {
      ...campo,
      src: getAttr('src'),
      alt: getAttr('alt'),
      title: getAttr('title'),
      width: getAttr('width') || getStyleProp('width'),
      height: getAttr('height') || getStyleProp('height'),
    }
  }

  const campos = camposOriginales.current

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
                onChange={v => actualizarCampo('texto', campo.posicionOrden, { contenido: v })} />
            </div>
          )
          if (campo.tipo === 'imagen') {
            const campoActual = valorActualDeImagen(campo)
            return (
              <CampoImagen key={`${i}-${campoActual.src}`} campo={campoActual}
                onActualizar={c => actualizarCampo('imagen', campo.posicionReal, c)}
                onReset={() => { setHtmlLocal(bloque.html); onActualizar(bloque.instanceId, null) }} />
            )
          }
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
          {(bloque.slug === 'Icono_Separador_Rojo_Texto' || bloque.slug === 'Icono_Grande_Separador_Rojo_Texto') && (() => {
            // Detectar versión real por el HTML actual (no por slug) —
            // un bloque importado puede tener slug "chico" pero HTML
            // con borde 5px si la heurística lo clasificó mal.
            const htmlReal = bloque.htmlEditado || bloque.html
            const esGrandeReal = /border-left:\s*solid\s*5px/i.test(htmlReal)
            const slugDestino = esGrandeReal ? 'Icono_Separador_Rojo_Texto' : 'Icono_Grande_Separador_Rojo_Texto'
            return (
              <button className="ep-btn ep-btn-ghost ep-btn-aplicar" style={{ marginTop: 4 }}
                onClick={() => onSwap(bloque.instanceId, slugDestino)}>
                {esGrandeReal ? '↕ Cambiar a versión chica' : '↕ Cambiar a versión grande'}
              </button>
            )
          })()}
          <button className="ep-btn ep-btn-ghost ep-btn-aplicar" onClick={resetBloque} style={{ marginTop: 4 }}>
            <RotateCcw size={13} /> Restaurar original
          </button>
        </div>
      )}
    </>
  )
}

// ─── Iframe auto-alto ───────────────────────────────────────────────────────
const AutoIframe = forwardRef(function AutoIframe({ srcDoc, title, className, height }, refExterna) {
  const refInterna = useRef(null)
  // Permite que el padre (modal de importar, para hacer scroll a un
  // bloque marcado) acceda al mismo nodo <iframe> que este componente
  // ya usa internamente para medir su alto — sin esto, cada quien
  // tendría su propia referencia desincronizada.
  const ref = (node) => { refInterna.current = node; if (typeof refExterna === 'function') refExterna(node); else if (refExterna) refExterna.current = node }

  function ajustarAlto() {
    if (height) return
    try {
      const doc = refInterna.current?.contentDocument
      if (!doc?.body) return
      const h = doc.body.scrollHeight || doc.documentElement?.scrollHeight || 40
      refInterna.current.style.height = `${Math.max(h, 40)}px`
    } catch { if (refInterna.current) refInterna.current.style.height = '80px' }
  }

  // Reajustar alto cada vez que cambia el srcDoc
  useEffect(() => {
    const iframe = refInterna.current
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
})

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
// Reconstruye el objeto bandaHeader completo a partir del slug guardado
// — localStorage solo guarda el slug (string liviano), no el HTML
// completo del template (que ya vive en BLOQUES y no tiene sentido
// duplicar en storage).
function headerDesdeSlag(slug) {
  return BLOQUES_HEADER.find(b => b.slug === slug) ?? BLOQUES_HEADER[0] ?? null
}

export default function EditorPiezas() {
  const [busqueda, setBusqueda] = useState('')

  // ── Borrador persistido en localStorage ────────────────────────────
  // useLocalStorage encapsula lectura lazy + try/catch de escritura.
  // El borrador es un objeto compuesto (nombre, tema, canvas, etc.) —
  // se lee UNA vez al montar para inicializar cada estado individual,
  // y se escribe en el useEffect de guardado automático vía setBorrador.
  const [borrador, setBorrador] = useLocalStorage('ep_borrador', null)
  const [nombre, setNombre] = useState(() => borrador?.nombre ?? 'Nueva pieza')
  // ICBC / Avisos / Mall — cambiable en cualquier momento (no solo al
  // crear la pieza), ya que afecta solo colores en el momento de
  // exportar/previsualizar, nunca el contenido editado por el usuario.
  const [tema, setTema] = useState(() => borrador?.tema ?? TEMA_DEFAULT)
  const [bandaHeader, setBandaHeader] = useState(() => borrador?.bandaHeaderSlug ? headerDesdeSlag(borrador.bandaHeaderSlug) : (BLOQUES_HEADER[0] ?? null))
  // Array de { key, activa } en el ORDEN elegido por el usuario
  // (arrastrando los pills en el panel de edición del header) — null
  // hasta que se inicializa por primera vez con las redes reales que
  // trae el header actual (ver inicializarRedesOrdenSiHaceFalta), así
  // se resetea automáticamente al cambiar a un header distinto.
  const [redesOrden, setRedesOrden] = useState(() => borrador?.redesOrden ?? null)
  function toggleRedActiva(key) {
    setRedesOrden(prev => (prev ?? []).map(r => r.key === key ? { ...r, activa: !r.activa } : r))
  }
  function reordenarPillRed(fromKey, toIndex) {
    setRedesOrden(prev => {
      const arr = [...(prev ?? [])]
      const fromIdx = arr.findIndex(r => r.key === fromKey)
      if (fromIdx === -1) return prev
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIndex, 0, item)
      return arr
    })
  }
  const [canvas, setCanvas] = useState(() => {
    const guardado = borrador?.canvas
    if (!guardado) return []
    // Reconstruir el html original de cada bloque desde BLOQUES —
    // no se guarda en localStorage (solo htmlEditado y metadata),
    // así que hay que cruzarlo de vuelta con la fuente real.
    return guardado.map(b => {
      const original = BLOQUES.find(x => x.id === b.id)
      return original ? { ...b, html: original.html } : b
    }).filter(b => b.html != null) // descartar bloques cuyo template ya no existe
  })
  const [selectedId, setSelectedId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  // Desktop (600px, ancho real del email) / Mobile (375px) — angostar
  // el propio iframe con width fijo es lo que dispara los media
  // queries reales del HTML (@media max-width: 600px en CANVAS_STYLES,
  // que ya trae todo el responsive real: Ocultar_Desktop, tamaños de
  // imagen, paddings). Un simple CSS de "achicar visualmente" el
  // iframe no alcanza — el viewport interno que ve el contenido sigue
  // siendo el mismo si no se cambia el width real del elemento.
  const [previewModo, setPreviewModo] = useState('desktop')
  const [draggingBibliotecaId, setDraggingBibliotecaId] = useState(null)
  const [draggingCanvasId, setDraggingCanvasId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null) // { id, posicion: 'arriba'|'abajo' }
  const [dragOverZona, setDragOverZona] = useState(false)
  const [dragOverHeader, setDragOverHeader] = useState(false)
  const [imgPrincipal, setImgPrincipal] = useState(() => borrador?.imgPrincipal ?? { activo: false, src: '', alt: '', title: '', link: '' })
  const [imgFooter, setImgFooter] = useState(() => borrador?.imgFooter ?? { activo: false, src: '', alt: '', link: '' })
  // Array de legales adicionales — mismo patrón que indicadores (cada
  // uno con su id, botón Agregar, eliminar individual). Disponible en
  // los 3 templates, no es exclusivo de Mall.
  const [legalesAdicionales, setLegalesAdicionales] = useState(() => borrador?.legalesAdicionales ?? [])
  function agregarLegalAdicional() { setLegalesAdicionales(p => [...p, { id: Date.now(), texto: '' }]) }
  function actualizarLegalAdicional(id, texto) { setLegalesAdicionales(p => p.map(l => l.id === id ? { ...l, texto } : l)) }
  function eliminarLegalAdicional(id) { setLegalesAdicionales(p => p.filter(l => l.id !== id)) }
  // DEFAULT false = texto corrido, un punto y seguido tras otro, igual
  // que el comportamiento de siempre — es lo normal para la mayoría de
  // las piezas (un legal corto o ninguno). true = cada legal en su
  // propia fila/celda separada por un espaciador de 14px — opción
  // explícita, solo tiene sentido cuando se van a sumar varios legales
  // largos, para evitar que algunos proveedores de correo detecten el
  // bloque de texto corrido como sospechoso y lo bloqueen (confirmado
  // contra el HTML real de Mall, donde el legal completo viene
  // partido así).
  const [legalesSeparados, setLegalesSeparados] = useState(() => borrador?.legalesSeparados ?? false)
  // Firma institucional (ICBC Investments / Sociedad Gerente-
  // Depositaria) — null = sección apagada (no aparece en el export).
  // A diferencia de legalesAdicionales/indicadores (listas abiertas,
  // se agregan de a uno), esta es una sección de estructura FIJA: 2
  // filas, 2 columnas cada una, solo se activa/desactiva entera y se
  // editan sus 4 textos — ver FIRMA_INSTITUCIONAL_DEFAULT.
  const [firmaInstitucional, setFirmaInstitucional] = useState(() => borrador?.firmaInstitucional ?? null)
  function toggleFirmaInstitucional() {
    setFirmaInstitucional(p => p ? null : { activo: true, ...FIRMA_INSTITUCIONAL_DEFAULT })
  }
  function actualizarFirmaInstitucional(campo, valor) {
    setFirmaInstitucional(p => p ? { ...p, [campo]: valor } : p)
  }
  const [indicadores, setIndicadores] = useState(() => borrador?.indicadores ?? [])
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

  // ── Guardado automático en localStorage ────────────────────────────
  // setBorrador viene de useLocalStorage — ya tiene el try/catch
  // encapsulado, no hace falta repetirlo acá. Debounce de 500ms para
  // no escribir en cada keystroke sino cuando el usuario para un momento.
  // El html original de cada bloque no se guarda — se reconstruye
  // desde BLOQUES al cargar (ver inicialización de canvas más arriba).
  useEffect(() => {
    const t = setTimeout(() => {
      setBorrador({
        nombre,
        tema,
        bandaHeaderSlug: bandaHeader?.slug ?? null,
        redesOrden,
        canvas: canvas.map(b => ({ ...b, html: undefined })),
        imgPrincipal,
        imgFooter,
        legalesAdicionales,
        legalesSeparados,
        firmaInstitucional,
        indicadores,
      })
    }, 500)
    return () => clearTimeout(t)
  }, [nombre, tema, bandaHeader, redesOrden, canvas, imgPrincipal, imgFooter, legalesAdicionales, legalesSeparados, firmaInstitucional, indicadores])

  // ── Nueva pieza — resetea todo el estado al default ────────────────
  // También borra el borrador del localStorage para que al recargar
  // no vuelva a aparecer la pieza anterior.
  function nuevaPieza() {
    setNombre('Nueva pieza')
    setTema(TEMA_DEFAULT)
    setBandaHeader(BLOQUES_HEADER[0] ?? null)
    setRedesOrden(null)
    setCanvas([])
    setSelectedId(null)
    setImgPrincipal({ activo: false, src: '', alt: '', title: '', link: '' })
    setImgFooter({ activo: false, src: '', alt: '', link: '' })
    setLegalesAdicionales([])
    setLegalesSeparados(false)
    setFirmaInstitucional(null)
    setIndicadores([])
    setBorrador(null)
  }

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

  // Reemplaza un bloque en el canvas por otro template, preservando
  // el instanceId — usado por el intercambio Icono/IcónoGrande.
  function swapBloque(instanceId, nuevoSlug) {
    // Los únicos valores que cambian entre chico y grande son conocidos
    // y fijos — se reemplazan directamente sobre el HTML actual.
    // El src del ícono y el texto se preservan sin tocarlos.
    const CHICO_A_GRANDE = [
      // td contenedor del ícono
      ['width="60" height="60" valign="middle"', 'width="80" height="80" valign="middle"'],
      // img del ícono
      ['width="60" height="60" />',              'width="75" height="75" />'],
      // td espaciador izquierdo (antes del borde)
      ['style="width: 10px;" width="10"',        'style="width: 5px;" width="5"'],
      // borde separador
      ['border-left: solid 2px #c4161c;',        'border-left: solid 5px #c4161c;'],
    ]
    const GRANDE_A_CHICO = CHICO_A_GRANDE.map(([a, b]) => [b, a])
    const esGrandeActual = /border-left:\s*solid\s*5px/i.test(
      canvas.find(b => b.instanceId === instanceId)?.htmlEditado ||
      canvas.find(b => b.instanceId === instanceId)?.html || ''
    )
    const reemplazos = esGrandeActual ? GRANDE_A_CHICO : CHICO_A_GRANDE
    setCanvas(prev => prev.map(b => {
      if (b.instanceId !== instanceId) return b
      const nuevo = BLOQUES_CONTENIDO.find(bl => bl.slug === nuevoSlug)
      if (!nuevo) return b
      let html = b.htmlEditado || b.html
      for (const [de, a] of reemplazos) html = html.split(de).join(a)
      return { ...nuevo, instanceId, htmlEditado: html }
    }))
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
    if (bloque?.categoria === 'Header') { setBandaHeader(bloque); setRedesOrden(null) }
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
    const html = generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalesAdicionales, legalesSeparados, firmaInstitucional, indicadores, tema, redesOrden })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const slug = nombre.replace(/[ñÑ]/g, m => m === 'ñ' ? 'n' : 'N').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'pieza'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${slug}.html`; a.click()
    URL.revokeObjectURL(url)
  }

  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    const html = generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalesAdicionales, legalesSeparados, firmaInstitucional, indicadores, tema, redesOrden })
    await navigator.clipboard.writeText(html)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const [showConfirmReinicio, setShowConfirmReinicio] = useState(false)

  // ── Importar pieza (desde HTML pegado o link) ──────────────────────
  // Flujo en 3 pasos dentro del mismo modal, sin un ConfirmModal
  // aparte: 1) el usuario pega HTML o pone un link y confirma, 2)
  // loading mientras se analiza (importarDesdeHtml primero, fallback a
  // importarHeuristico si no encontró marcadores), 3) resumen + preview
  // renderizado del resultado, con un único botón final que sirve a la
  // vez de "confirmo la importación" y "confirmo que esto reemplaza lo
  // que tenía armado" — no hace falta una segunda confirmación
  // separada, decisión explícita para no duplicar el mismo gesto.
  const [showImportar, setShowImportar] = useState(false)
  const [importarModo, setImportarModo] = useState('html') // 'html' | 'url'
  const [importarHtmlInput, setImportarHtmlInput] = useState('')
  const [importarUrlInput, setImportarUrlInput] = useState('')
  const [importarCargando, setImportarCargando] = useState(false)
  const [importarError, setImportarError] = useState('')
  // null mientras no se analizó nada todavía — una vez que hay un
  // resultado (aunque sea de baja confianza), pasamos a la pantalla de
  // resumen/preview dentro del mismo modal.
  const [importarResultado, setImportarResultado] = useState(null)
  // Referencia al <iframe> del preview de importación — el srcDoc lo
  // hace same-origin (contenido inline, no una URL externa), así que
  // se puede acceder directo a contentDocument sin restricciones de
  // iframe cross-origin. Se usa para hacer scroll/resaltado al bloque
  // marcado cuando el usuario hace click en su aviso correspondiente
  // (ver irABloqueEnPreview).
  const previewIframeRef = useRef(null)

  // Lleva la vista del preview directo al bloque marcado que
  // corresponde a un aviso clickeado — busca el id="preview-bloque-N"
  // que marcarBloquesNoReconocidosParaPreview ya dejó en el HTML del
  // iframe (N = canvasIdx del aviso). Hace scroll suave y agrega un
  // pulso de resaltado breve (clase con animación, se quita sola) para
  // que el ojo lo encuentre aunque el bloque ya estuviera a la vista
  // (scrollIntoView solo mueve algo si hace falta — sin el pulso, un
  // click sobre un bloque ya visible no daría ningún feedback).
  function irABloqueEnPreview(canvasIdx) {
    if (canvasIdx == null) return
    const doc = previewIframeRef.current?.contentDocument
    const el = doc?.getElementById(`preview-bloque-${canvasIdx}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.style.animation = 'none'
    // Forzar reflow antes de reasignar la animación, para que se
    // reinicie aunque el usuario haga click dos veces seguidas sobre
    // el mismo aviso (sin esto, la segunda vez no reproduciría nada
    // porque el navegador ve el mismo valor de animation que ya tenía).
    void el.offsetWidth
    el.style.animation = 'ep-preview-pulso 1100ms ease-out 2'
  }
  // Switch Desktop/Mobile del preview del resultado — mismo patrón
  // que showPreview/previewModo del modal de Vista previa, pero
  // independiente (este modal puede abrirse sin que el otro esté
  // abierto, y viceversa).
  const [importarModoPreview, setImportarModoPreview] = useState('desktop') // 'desktop' | 'mobile'

  function cerrarModalImportar() {
    setShowImportar(false)
    setImportarModo('html')
    setImportarHtmlInput('')
    setImportarUrlInput('')
    setImportarError('')
    setImportarResultado(null)
    setImportarModoPreview('desktop')
  }

  async function analizarImportacion() {
    setImportarError('')
    const entrada = importarModo === 'html' ? importarHtmlInput.trim() : importarUrlInput.trim()
    if (!entrada) { setImportarError(importarModo === 'html' ? 'Pegá el HTML de la pieza.' : 'Ingresá el link de la pieza.'); return }

    setImportarCargando(true)
    try {
      // Modo URL pasa por el mismo proxy que ya usan Revisión de
      // emails y Revisión de envíos — valida SSRF en capas (allowlist
      // de dominio, resolución de IP, redirects controlados), no
      // necesita ningún cambio acá. Solo corre en el deploy de Vercel
      // (ver nota en README, "Correr localmente") — en local, probar
      // con el modo HTML.
      const html = importarModo === 'html'
        ? entrada
        : await fetch(`/api/proxy?url=${encodeURIComponent(entrada)}`).then(r => {
            if (!r.ok) throw new Error('No se pudo obtener el HTML de ese link.')
            return r.text()
          })

      // Bug real encontrado con una pieza real, accedida por LINK (no
      // pegando el HTML directo desde el editor de la plataforma): el
      // HTML resultante traía 166 atributos con comillas SIMPLES
      // ('...') en vez de dobles ("...") — confirmado comparando ese
      // mismo HTML "limpio" pegado a mano (comillas dobles, se
      // importa bien) contra el obtenido por URL (comillas simples,
      // no se importa nada). Todo el resto de la estructura era
      // idéntico entre ambos — la causa concreta de por qué la
      // plataforma reescribe a comillas simples específicamente en el
      // camino de acceso por URL no se pudo confirmar (puede ser un
      // paso de minificación o sanitización propio de esa vía), pero
      // no hace falta entenderla para resolver el síntoma: TODOS los
      // regex de importarDesdeHtml/importarHeuristico (524 ocurrencias
      // de ="..." en el archivo) asumen comillas dobles literales —
      // reescribir cada uno para tolerar ambas sería un cambio enorme
      // y arriesgado. Normalizar una sola vez, acá, antes de que el
      // HTML llegue a cualquiera de las dos funciones, es la solución
      // estándar para HTML con comillas simples en atributos (válido
      // en el estándar HTML desde siempre, cualquier navegador real lo
      // acepta sin distinción) — no es un parche del síntoma puntual,
      // es tolerancia genérica que cualquier importador de HTML
      // debería tener. El regex exige que la comilla de apertura venga
      // pegada a `nombre-de-atributo=`, con un espacio antes del
      // nombre — así nunca toca un apóstrofe de texto visible (ej.
      // "Spider-Man's web" queda intacto, confirmado con pruebas).
      //
      // Segundo bug real encontrado AL CORREGIR el de arriba (estaba
      // tapado por él, nunca se veía mientras toda la pieza fallaba
      // entera): un <img alt='>'> con el carácter > SIN ESCAPAR como
      // valor literal del atributo (el diseñador tipeó '>' directo en
      // vez de la entidad &gt; — los templates propios de este editor
      // siempre usan &gt;, confirmado, así que es un error puntual de
      // esta pieza, no un patrón de la plataforma). El problema es
      // INDEPENDIENTE de las comillas: cualquier regex genérico de tag
      // (ej. /<img\b[^>]*>/, hay muchos en el archivo) usa [^>]* para
      // "todo hasta el cierre del tag" — no entiende de comillas, así
      // que un > suelto DENTRO de un atributo corta el match ahí
      // mismo, mucho antes del cierre real, dejando el resto del tag
      // (style, width, height, el >) como texto suelto en el bloque
      // siguiente. Se escapan > y < a sus entidades SOLO cuando viven
      // dentro de un valor de atributo completo (con su comilla de
      // apertura Y cierre, cualquiera de los dos tipos) — nunca se
      // tocan los > y < reales que delimitan tags, que viven afuera de
      // cualquier comilla. Tiene que aplicarse ANTES de normalizar
      // comillas simples a dobles (no cambia el resultado si se aplica
      // antes o después, pero mantiene cada fix enfocado en una sola
      // cosa).
      const htmlSinMayorQueSuelto = html.replace(/([a-zA-Z-]+)=(['"])([^'"]*)\2/g, (_m, attr, q, val) => {
        const valEscapado = val.replace(/>/g, '&gt;').replace(/</g, '&lt;')
        return `${attr}=${q}${valEscapado}${q}`
      })
      const htmlNormalizado = htmlSinMayorQueSuelto.replace(/(\s[a-zA-Z-]+)='([^']*)'/g, (_m, attr, val) => `${attr}="${val}"`)

      // importarDesdeHtml primero (100% determinístico si la pieza
      // tiene marcadores de este editor) — solo si devuelve resultado
      // null (ningún <!--BLOQUE--> encontrado) se cae a la heurística
      // sin marcadores, mucho más trabajosa y de menor certeza.
      const porMarcadores = importarDesdeHtml(htmlNormalizado)
      if (porMarcadores.resultado) {
        setImportarResultado({ ...porMarcadores, confianza: 'alta', viaMarcadores: true })
      } else {
        const porHeuristica = importarHeuristico(htmlNormalizado)
        setImportarResultado({ ...porHeuristica, viaMarcadores: false })
      }
    } catch (err) {
      setImportarError(err.message || 'No se pudo procesar la pieza.')
    } finally {
      setImportarCargando(false)
    }
  }

  // Aplica el resultado ya analizado al estado real del editor —
  // pisa todo lo que hubiera armado antes, sin pedir una segunda
  // confirmación (el botón que llama a esta función ya es esa
  // confirmación). Mismo criterio de reseteo que nuevaPieza() para
  // los campos que el resultado importado no trae (legalesSeparados,
  // etc. sí vienen siempre en el resultado, pero por si alguna rama
  // futura dejara algo afuera, no queremos arrastrar datos viejos).
  function confirmarImportacion() {
    if (!importarResultado?.resultado) return
    const r = importarResultado.resultado
    setNombre('Pieza importada')
    setTema(r.tema)
    setBandaHeader(r.bandaHeader)
    // redesOrden viene calculado desde el HTML REAL de la pieza
    // importada (ver comentario en importarHeuristico/importarDesdeHtml)
    // — usar null acá dispararía el useEffect que rellena automático
    // desde el TEMPLATE del header, reintroduciendo redes que la pieza
    // original no tenía (bug real reportado: una pieza sin ningún
    // ícono de red social terminaba con las 4 redes del header
    // agregadas de la nada).
    setRedesOrden(r.redesOrden ?? [])
    setCanvas(r.canvas)
    setSelectedId(null)
    setImgPrincipal(r.imgPrincipal)
    setImgFooter(r.imgFooter)
    setLegalesAdicionales(r.legalesAdicionales)
    setLegalesSeparados(r.legalesSeparados)
    setFirmaInstitucional(r.firmaInstitucional ?? null)
    setIndicadores(r.indicadores)
    cerrarModalImportar()
  }

  const selectedBloque = canvas.find(b => b.instanceId === selectedId)
  const redesDetectadas = bandaHeader ? detectarRedesSociales(bandaHeader.html) : []

  // Inicializa redesOrden la primera vez que se carga un header con
  // redes reales — todas activas, en el orden en que aparecen en el
  // HTML original. Se vuelve a disparar cada vez que redesOrden se
  // resetea a null (cambio de header), no en cada render.
  useEffect(() => {
    if (redesOrden == null && redesDetectadas.length > 0) {
      setRedesOrden(redesDetectadas.map(key => ({ key, activa: true })))
    }
  }, [redesOrden, bandaHeader])

  const previewSrcdoc = showPreview
    ? `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#c8c8d0;border-radius:99px}</style></head><body style="margin:0;padding:0;">${generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalesAdicionales, legalesSeparados, firmaInstitucional, indicadores, tema, redesOrden })}</body></html>`
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
                    <button className="ep-bloque-add" onClick={() => { setBandaHeader(bloque); setRedesOrden(null) }}>
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
            <button className="ep-btn ep-btn-ghost" onClick={() => setShowImportar(true)} title="Importar pieza desde HTML o link">🔗 Importar</button>
            <button className="ep-btn ep-btn-ghost" onClick={() => setShowPreview(true)}><Eye size={14} /> Vista previa</button>
            <button className="ep-btn ep-btn-ghost" onClick={copiar}>{copiado ? <ClipboardCheck size={14} /> : <Copy size={14} />}{copiado ? 'Copiado' : 'Copiar HTML'}</button>
            <button className="ep-btn ep-btn-primary" onClick={exportar}><Download size={14} /> Exportar HTML</button>
            <div className="ep-canvas-actions-sep" />
            <button className="ep-btn ep-btn-ghost ep-btn-reiniciar" onClick={() => setShowConfirmReinicio(true)}><RotateCcw size={14} /> Reiniciar</button>
          </div>
        </div>
        <div className="ep-canvas-header ep-canvas-header-tema">
          <span className="ep-tema-label">Template</span>
          <div className="re-tabs">
            {Object.entries(TEMAS).map(([key, t]) => (
              <button key={key} className={tema === key ? 'active' : ''} onClick={() => setTema(key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ep-canvas-body">

          {/* Banda Header — seleccionable igual que cualquier bloque del
              canvas (click abre su edición en el panel derecho, mismo
              patrón que PanelEditor para bloques normales). 'HEADER' es
              un id reservado: bandaHeader no vive en el array canvas,
              así que no puede compartir instanceId con nada real ahí. */}
          <div className={`ep-zona-fija ${dragOverHeader ? 'drag-over-header' : ''} ${selectedId === 'HEADER' ? 'selected' : ''}`}
            onClick={() => bandaHeader && setSelectedId('HEADER')}
            onDragOver={e => { e.preventDefault(); const b = BLOQUES.find(x => x.id === draggingBibliotecaId); if (b?.categoria === 'Header') setDragOverHeader(true) }}
            onDragLeave={() => setDragOverHeader(false)} onDrop={onDropHeader}>
            <div className="ep-zona-fija-header">
              <span className="ep-zona-fija-label"><Layout size={12} /> Banda Header</span>
              <span className="ep-zona-fija-badge">{bandaHeader?.nombre || 'Sin seleccionar'}</span>
            </div>
            {bandaHeader
              ? (
                <div className="ep-zona-fija-preview-wrap">
                  <AutoIframe className="ep-zona-fija-preview" srcDoc={wrapPreview(reordenarRedesSociales(bandaHeader.html, redesOrden), true)} title="Banda header" />
                  {/* Overlay transparente — un <iframe> tiene su propio
                      documento interno, y los eventos dragover/drop del
                      navegador se entregan a ESE documento cuando el
                      mouse está encima, no al documento padre de React.
                      Sin esta capa, soltar un bloque de Header sobre el
                      preview ya cargado no funcionaba (solo se podía
                      soltar sobre ep-zona-fija-header, que es texto
                      plano sin iframe de por medio). El overlay
                      reenvía los mismos handlers que ya tiene el
                      contenedor padre, así el comportamiento es
                      idéntico en toda la zona; también es la capa que
                      recibe el click de selección, ya que el iframe
                      tampoco entrega clicks normales al padre. */}
                  <div className="ep-zona-fija-preview-overlay"
                    onClick={() => setSelectedId('HEADER')}
                    onDragOver={e => { e.preventDefault(); const b = BLOQUES.find(x => x.id === draggingBibliotecaId); if (b?.categoria === 'Header') setDragOverHeader(true) }}
                    onDragLeave={() => setDragOverHeader(false)} onDrop={onDropHeader} />
                </div>
              )
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

          {/* Legales adicionales */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label"><FileText size={12} /> Legales adicionales</span>
              <button className={`ep-toggle-btn ${legalesAdicionales.length > 0 ? 'activo' : ''}`} onClick={agregarLegalAdicional}>+ Agregar</button>
            </div>
            {legalesAdicionales.length > 0 && (
              <div className="ep-zona-toggle-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Default: texto corrido (igual que siempre). Activar
                    esto solo tiene sentido si se van a sumar varios
                    legales largos — separa cada uno en su propia
                    sección con un espacio entre cada una, para que
                    algunos proveedores de correo no detecten un bloque
                    de texto muy largo como sospechoso. */}
                <label className="ep-legales-separar-toggle">
                  <input type="checkbox" checked={legalesSeparados} onChange={e => setLegalesSeparados(e.target.checked)} />
                  <span>Separar cada legal en su propia sección</span>
                </label>
                <p className="ep-legales-hint">
                  {legalesSeparados
                    ? 'Cada legal va en su propia sección, separado por un espacio — recomendado solo si los textos son largos.'
                    : 'Los legales se concatenan seguidos, como texto corrido (comportamiento normal).'}
                </p>
                {legalesAdicionales.map((legal, i) => (
                  <div key={legal.id} className="ep-legal-adicional-item">
                    <div className="ep-legal-adicional-header">
                      <span className="ep-legal-adicional-label">Legal {i + 1}</span>
                      <button onClick={() => eliminarLegalAdicional(legal.id)} className="ep-legal-adicional-eliminar" title="Eliminar este legal">
                        <X size={14} />
                      </button>
                    </div>
                    <RichEditor key={`legal-${legal.id}`} value={legal.texto} onChange={v => actualizarLegalAdicional(legal.id, v)} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('legal')} disabled={confirmando.legal}>
                    {confirmando.legal ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.legal ? 'Confirmando…' : 'Confirmar legales'}
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

          {/* Firma institucional (ICBC Investments / Sociedad Gerente-
              Depositaria) — estructura FIJA de 2 filas x 2 columnas,
              a diferencia de Legales adicionales/Indicadores (listas
              abiertas). Se activa/desactiva entera con un solo toggle;
              una vez activa, los 4 textos quedan editables por si el
              texto institucional cambia, pero no se pueden agregar o
              quitar filas/columnas — eso es intencional, ver
              FIRMA_INSTITUCIONAL_DEFAULT. Va siempre después del legal
              fijo y antes de los indicadores financieros. */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label"><FileText size={12} /> Firma institucional</span>
              <button className={`ep-toggle-btn ${firmaInstitucional ? 'activo' : ''}`} onClick={toggleFirmaInstitucional}>
                {firmaInstitucional ? 'Quitar' : '+ Agregar'}
              </button>
            </div>
            {firmaInstitucional && (
              <div className="ep-zona-toggle-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p className="ep-legales-hint">ICBC Investments / Sociedad Gerente-Depositaria — 2 filas fijas, izquierda y derecha.</p>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={firmaInstitucional.fila1Izq}
                    placeholder="ICBC Investments SAU SGFCI" onChange={e => actualizarFirmaInstitucional('fila1Izq', e.target.value)} />
                  <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={firmaInstitucional.fila1Der}
                    placeholder="Industrial and Commercial Bank of China (Argentina) SAU" onChange={e => actualizarFirmaInstitucional('fila1Der', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={firmaInstitucional.fila2Izq}
                    placeholder="Sociedad Gerente" onChange={e => actualizarFirmaInstitucional('fila2Izq', e.target.value)} />
                  <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={firmaInstitucional.fila2Der}
                    placeholder="Sociedad Depositaria" onChange={e => actualizarFirmaInstitucional('fila2Der', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('firmaInstitucional')} disabled={confirmando.firmaInstitucional}>
                    {confirmando.firmaInstitucional ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.firmaInstitucional ? 'Confirmando…' : 'Confirmar firma'}
                  </button>
                </div>
              </div>
            )}
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
          {selectedId === 'HEADER' && <span className="ep-editor-bloque-nombre">Banda Header</span>}
          {selectedBloque && <span className="ep-editor-bloque-nombre">{selectedBloque.nombre}</span>}
        </div>
        {selectedId === 'HEADER'
          ? <PanelEditorHeader bandaHeader={bandaHeader} redesOrden={redesOrden} onToggle={toggleRedActiva} onReordenar={reordenarPillRed} />
          : !selectedBloque
            ? <div className="ep-editor-empty"><FileText size={28} style={{ color: 'var(--border)' }} /><span>Seleccioná un bloque del canvas para editar su contenido</span></div>
            : <PanelEditor key={`${selectedBloque.instanceId}-${selectedBloque.slug}`} bloque={selectedBloque} onActualizar={actualizarBloque} onSwap={swapBloque} />}
      </aside>

      {/* ── Modal preview ── */}
      {showPreview && (
        <div className="ep-preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="ep-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="ep-preview-header">
              <div className="ep-preview-titulo-wrap">
                <span className="ep-preview-titulo">Vista previa</span>
                <span className="ep-preview-subtitulo">{nombre}</span>
              </div>
              <div className="re-tabs ep-preview-modo-tabs">
                <button className={previewModo === 'desktop' ? 'active' : ''} onClick={() => setPreviewModo('desktop')}>Desktop</button>
                <button className={previewModo === 'mobile' ? 'active' : ''} onClick={() => setPreviewModo('mobile')}>Mobile</button>
              </div>
              <button className="ep-preview-close" onClick={() => setShowPreview(false)}><X size={16} /></button>
            </div>
            <div className={`ep-preview-iframe-wrap ${previewModo === 'mobile' ? 'modo-mobile' : ''}`}>
              {previewModo === 'desktop'
                ? <AutoIframe className="ep-preview-iframe" srcDoc={previewSrcdoc} title="Vista previa completa" />
                : <iframe className="ep-preview-iframe" srcDoc={previewSrcdoc} title="Vista previa completa" style={{ width: '375px' }} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal importar ── */}
      {showImportar && (
        <div className="ep-preview-overlay" onClick={cerrarModalImportar}>
          <div className="ep-importar-modal" onClick={e => e.stopPropagation()}>
            <div className="ep-preview-header">
              <div className="ep-preview-titulo-wrap">
                <span className="ep-preview-titulo">Importar pieza</span>
                <span className="ep-preview-subtitulo">
                  {!importarResultado ? 'Pegá el HTML o ingresá el link de la pieza' : 'Revisá el resultado antes de cargarlo'}
                </span>
              </div>
              {/* Switch Desktop/Mobile — mismo patrón que el modal de
                  Vista previa, pero con clases propias del modal de
                  importar. Solo tiene sentido mostrarlo una vez que
                  hay algo renderizado para previsualizar (resultado
                  con datos reales), no durante el paso de entrada ni
                  cuando resultado es null. */}
              {importarResultado?.resultado && (
                <div className="ep-importar-tabs ep-importar-modo-tabs">
                  <button className={importarModoPreview === 'desktop' ? 'active' : ''} onClick={() => setImportarModoPreview('desktop')}>Desktop</button>
                  <button className={importarModoPreview === 'mobile' ? 'active' : ''} onClick={() => setImportarModoPreview('mobile')}>Mobile</button>
                </div>
              )}
              <button className="ep-preview-close" onClick={cerrarModalImportar}><X size={16} /></button>
            </div>

            {/* Paso 1: entrada — tabs HTML/URL, mismo patrón que
                Revisión de envíos. Se reemplaza por el resumen en
                cuanto hay un resultado analizado. */}
            {!importarResultado && (
              <div className="ep-importar-body">
                <div className="ep-importar-tabs">
                  <button className={importarModo === 'html' ? 'active' : ''} onClick={() => { setImportarModo('html'); setImportarError('') }}>HTML</button>
                  <button className={importarModo === 'url' ? 'active' : ''} onClick={() => { setImportarModo('url'); setImportarError('') }}>URL</button>
                </div>

                {importarModo === 'html' ? (
                  <textarea
                    className="ep-importar-input"
                    autoComplete="off"
                    placeholder="Pegá acá el HTML completo de la pieza…"
                    rows={10}
                    value={importarHtmlInput}
                    onChange={e => setImportarHtmlInput(e.target.value)}
                  />
                ) : (
                  <input
                    className="ep-importar-input ep-importar-input-url"
                    autoComplete="off"
                    placeholder="https://icbc-info.icommarketing.com/…"
                    value={importarUrlInput}
                    onChange={e => setImportarUrlInput(e.target.value)}
                  />
                )}

                {importarError && <div className="ep-importar-error">{importarError}</div>}

                <div className="ep-importar-footer">
                  <button className="ep-btn ep-btn-ghost" onClick={cerrarModalImportar}>Cancelar</button>
                  <button className="ep-btn ep-btn-primary" onClick={analizarImportacion} disabled={importarCargando}>
                    {importarCargando ? <Loader2 size={14} className="ep-spin" /> : null}
                    {importarCargando ? 'Analizando…' : 'Analizar'}
                  </button>
                </div>
              </div>
            )}

            {/* Paso 2/3: resumen + preview del resultado ya analizado.
                confianza 'baja' o resultado null nunca se muestran
                como un resultado parcial silencioso — el aviso queda
                arriba de todo, bien visible, y el botón final cambia
                de texto para dejar explícito que cargar igual no es
                lo recomendado. */}
            {importarResultado && (
              <div className="ep-importar-body">
                {!importarResultado.resultado ? (
                  <div className="ep-importar-aviso ep-importar-aviso-baja">
                    <AlertCircle size={16} />
                    <span>{importarResultado.avisos?.[0]?.texto || 'No se pudo reconocer la estructura de esta pieza.'}</span>
                  </div>
                ) : (
                  <>
                    <div className={`ep-importar-resumen ep-importar-confianza-${importarResultado.confianza}`}>
                      <span className="ep-importar-resumen-titulo">
                        {importarResultado.viaMarcadores
                          ? '✓ Pieza reconocida — exportada por este mismo editor'
                          : importarResultado.confianza === 'alta'
                            ? '✓ Pieza reconocida con buena confianza'
                            : importarResultado.confianza === 'media'
                              ? '⚠ Pieza reconocida parcialmente — revisá el resultado'
                              : '⚠ No se pudo reconocer con seguridad — preferible armar la pieza a mano'}
                      </span>
                      <span className="ep-importar-resumen-detalle">{importarResultado.resultado.canvas.length} bloques detectados</span>
                    </div>

                    {importarResultado.avisos?.length > 0 && (
                      <>
                        <span className="ep-importar-avisos-titulo">Resultado del escaneo de la pieza</span>
                        <ul className="ep-importar-avisos-lista">
                          {importarResultado.avisos.map((a, i) => (
                            <li
                              key={i}
                              data-tipo={a.canvasIdx != null ? a.tipo : undefined}
                              onClick={a.canvasIdx != null ? () => irABloqueEnPreview(a.canvasIdx) : undefined}
                              title={a.canvasIdx != null ? 'Ver en el preview' : undefined}
                            >
                              {a.texto}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {(() => {
                      // El overlay (outline punteado + etiqueta "No
                      // reconocido") solo se inyecta en ESTE preview de
                      // importación, nunca en el HTML real que termina
                      // en el canvas — generarExport en sí queda
                      // intacto, marcarBloquesNoReconocidosParaPreview
                      // es un post-proceso aparte sobre el resultado.
                      //
                      // redesOrden: bug real reportado — este preview
                      // usaba `redesOrden: null` a propósito (forzado),
                      // lo cual hacía que reordenarRedesSociales usara
                      // el header TAL CUAL viene (con todas sus redes
                      // del template) — pero el canvas real, al
                      // confirmar la importación, sí usa el
                      // redesOrden REAL detectado de la pieza
                      // (puede ser []). Resultado: el preview mostraba
                      // redes que después desaparecían al confirmar,
                      // muy confuso. Ahora el preview usa el mismo
                      // redesOrden real que se va a aplicar de verdad.
                      const srcDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@keyframes ep-preview-pulso { 0%, 100% { box-shadow: none; } 50% { box-shadow: inset 0 0 0 9999px rgba(0,0,0,0.06); } }</style></head><body style="margin:0;padding:0;">${marcarBloquesNoReconocidosParaPreview(generarExport({ ...importarResultado.resultado, redesOrden: importarResultado.resultado.redesOrden ?? [] }))}</body></html>`
                      return (
                        <div className={`ep-importar-preview-wrap ${importarModoPreview === 'mobile' ? 'modo-mobile' : ''}`}>
                          {importarModoPreview === 'desktop'
                            ? <AutoIframe ref={previewIframeRef} className="ep-importar-preview-iframe" title="Preview de la pieza importada" srcDoc={srcDoc} />
                            : <iframe ref={previewIframeRef} className="ep-importar-preview-iframe" title="Preview de la pieza importada" srcDoc={srcDoc} style={{ width: '375px' }} />}
                        </div>
                      )
                    })()}
                  </>
                )}

                {importarError && <div className="ep-importar-error">{importarError}</div>}

                <div className="ep-importar-footer">
                  <button className="ep-btn ep-btn-ghost" onClick={() => setImportarResultado(null)}>Volver</button>
                  <button
                    className={`ep-btn ${importarResultado.confianza === 'baja' || !importarResultado.resultado ? 'ep-btn-ghost' : 'ep-btn-primary'}`}
                    onClick={confirmarImportacion}
                    disabled={!importarResultado.resultado}
                  >
                    {importarResultado.confianza === 'baja' ? 'Cargar igual (no recomendado)' : 'Cargar en el editor'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={showConfirmReinicio}
        variant="warning"
        title="¿Reiniciar la pieza?"
        message="Se van a eliminar todos los bloques, imágenes, legales e indicadores que cargaste. El borrador guardado también se va a borrar. Esta acción no se puede deshacer."
        confirmLabel="Sí, reiniciar"
        cancelLabel="Cancelar"
        onConfirm={() => { nuevaPieza(); setShowConfirmReinicio(false) }}
        onCancel={() => setShowConfirmReinicio(false)}
      />
    </div>
  )
}
