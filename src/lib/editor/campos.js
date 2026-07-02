// Detección y edición de campos (texto/imagen/link) sobre el HTML
// de un bloque, como string puro. El contrato de posicionOrden vs
// posicionContenido está documentado junto a extraerTdsConBalance
// (htmlUtils.js) y en los comentarios de cada función.

import { extraerTdsConBalance } from './htmlUtils.js'

export function detectarCampos(html) {
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
  // su propio botón de link (ícono SVG) para seleccionar texto y
  // asignarle/cambiarle el link). Solo queda como campo de "Link"
  // independiente un <a> que vive FUERA de cualquier <td> de texto
  // editable (ej. un botón con imagen y link, sin texto al lado).
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
export function actualizarCampoEnHtml(html, tipo, idx, cambios, idxFallback) {
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
    //
    // idxFallback (= posicionReal/posicionContenido del campo): mismo
    // fix que en valorActualDeTexto del lado de la lectura — si
    // posicionOrden no encuentra celda (caso real: pieza importada con
    // MENOS estructura decorativa que el template elegido como
    // baseHtml, ej. Borde_Izq_Rojo_Texto sin su sub-tabla de
    // espaciadores), se intenta de nuevo por posicionContenido antes
    // de rendirse. Sin esto, escribir en un campo de texto detectado
    // así de nunca se guardaba — el botón "Aplicar cambios" no daba
    // ningún error, pero el texto nunca cambiaba en el HTML real.
    const celdas = extraerTdsConBalance(html)
    let celda = celdas.find(c => c.posicionOrden === idx)
    if (!celda && idxFallback != null) celda = celdas.find(c => c.posicionContenido === idxFallback)
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
