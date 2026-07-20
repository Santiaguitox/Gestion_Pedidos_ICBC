// Importación de piezas: por marcadores (importarDesdeHtml, piezas
// exportadas por este editor) y heurística (importarHeuristico,
// piezas externas de la plataforma). Contraparte de exportar.js.

import { FIRMA_INSTITUCIONAL_DEFAULT, LEGAL_FIJO_HTML, TEMAS, TEMA_DEFAULT } from './constantes.js'
import { BLOQUES, BLOQUES_CONTENIDO, BLOQUES_HEADER } from './bloques.js'
import { formaDeTags, normalizarNegritas, similitudDeForma } from './htmlUtils.js'
import { detectarRedesSociales } from './redesSociales.js'
import { revertirColorTexto } from './exportar.js'
import { DetectarAtributosConDosPuntos } from '@/lib/revision/generales.js'

// ─── Título/detalle visual de un aviso de importación ──────────────────────
// Cada aviso real solo trae un campo `texto` (una oración completa,
// redactada a mano en ~30 lugares distintos del archivo) — el rediseño
// del modal de importación pide mostrar título corto + detalle separados,
// como hace cualquier lista de notificaciones. En vez de reescribir cada
// uno de esos ~30 mensajes (cambio enorme y arriesgado para algo que ya
// funciona bien como oración única), se separa visualmente el texto
// existente: la mayoría sigue el patrón "lo que pasó — qué se hizo al
// respecto", separado por guion largo, que da un punto de corte natural.
// Si un mensaje no tiene guion largo (caso real: "Header detectado: X"),
// se usa el texto completo como título, sin detalle.
//
// Mayúscula inicial del detalle: en el texto original, la parte después
// del guion sigue en minúscula porque gramaticalmente es la continuación
// de la misma oración ("X — y se hizo Y"). Mostrada como línea propia
// (no como continuación visual del título) necesita su propia mayúscula
// inicial — se aplica acá, sin tocar ninguno de los textos originales.
export function mayusculaInicial(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
export function tituloYDetalleDeAviso(aviso) {
  const partes = aviso.texto.split(/\s+—\s+/)
  if (partes.length >= 2) return { titulo: partes[0], detalle: mayusculaInicial(partes.slice(1).join(' — ')) }
  return { titulo: aviso.texto, detalle: null }
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
export function importarDesdeHtml(html) {
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
  // La zona del header se recorta EXACTA entre <!--HEADER:slug--> y su
  // cierre <!--/HEADER--> (generarExport siempre escribe ambos). Bug
  // real encontrado por el test de roundtrip al armar la suite: antes
  // se usaba una ventana FIJA de 3000 caracteres desde el marcador de
  // apertura — la 4ta celda de redes arranca alrededor del offset
  // ~2913 en los headers reales (CG y EB por igual, no un caso raro),
  // así que su <td>...</td> quedaba cortado por la mitad, el regex de
  // detectarRedesSociales no podía completar ese match, y la última
  // red desaparecía de redesOrden EN SILENCIO al reimportar cualquier
  // pieza — la misma clase de pérdida-sin-rastro que ya se había
  // arreglado con data-red, reintroducida por otra vía. El fallback de
  // 3000 se conserva solo para HTML editado a mano al que le falte el
  // marcador de cierre.
  const idxHeaderMarker = headerMatch ? headerMatch.index + headerMatch[0].length : 0
  const finHeaderMarker = html.indexOf('<!--/HEADER-->', idxHeaderMarker)
  const htmlZonaHeader = finHeaderMarker !== -1
    ? html.slice(idxHeaderMarker, finHeaderMarker)
    : html.slice(idxHeaderMarker, idxHeaderMarker + 3000)
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
        // Alto real de la imagen tal como quedó exportado (ver
        // generarExport/alturaImgPrincipal) — sin esto, reimportar una
        // pieza con Imagen principal en una proporción distinta a
        // 425px la hacía volver a 425 y perdía el alto real medido.
        // Fallback a 425 por si el HTML viene de una versión vieja
        // del editor sin el atributo height explícito.
        alto: parseInt(imgPrincipalBloque.match(/<img[^>]*\sheight="(\d+)"/)?.[1] ?? '425', 10),
      }
    : { activo: false, src: '', alt: '', title: '', link: '', alto: 425 }

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
// el aviso de texto y comparando contra el preview.
//
// TODO bloque (sea cual sea su slug) recibe un id="preview-bloque-N"
// (N = idx real en canvas) para que el modal pueda hacer
// scrollIntoView() directo desde el listado de avisos clickeable — no
// solo los "código personalizado". Antes de este fix, un aviso de
// atributo roto sobre un bloque que clasificó normal (ej.
// Bloque_Texto_Base, ver el fix de 2026-07-20 que dejó de forzar
// código personalizado para cualquier atributo roto) no tenía id
// puesto en ningún lado — el click no encontraba nada. El marco
// punteado + etiqueta se aplica a slug="codigo" ("No reconocido"/
// "Fuera de lugar") Y TAMBIÉN a cualquier bloque cuyo idx venga en
// idxsAtributosRotos ("Atributos rotos", en ámbar) — ver el comentario
// dentro de la función. Para el resto, el id se agrega sin ningún
// cambio visual (mismo <tr> tal cual generarExport lo armó, solo con
// el id puesto).
//
// Solo se usa en este preview de importación, nunca en
// generarExport() real — el HTML final exportado/copiado nunca debe
// llevar ningún id ni overlay de estos.
//
// Funciona en dos pasos sobre el HTML YA generado por generarExport():
// 1) Ubica cada marcador <!--BLOQUE slug="X" idx="N"-->...
//    <!--/BLOQUE-->, con su atributo opcional origen="fuera-de-rango"
//    (ver generarExport) para elegir el color correcto cuando
//    corresponda.
// 2) Si slug es "codigo", envuelve el contenido en el wrapper con
//    outline punteado y etiqueta flotante de siempre. Para cualquier
//    otro slug, envuelve en un wrapper equivalente pero sin ningún
//    estilo visual — mismo <table><tbody> transparente que ya usa el
//    caso "codigo" para poder anidar un <tr> dentro de un <td> sin
//    romper la estructura de tabla, pero sin outline/fondo/etiqueta.
//
// El <div> del marco declara su propio font-size (14px) a propósito —
// bug real encontrado con una pieza de Santi (2026-07-20), verificado
// después contra el DOM real generado por el pipeline completo: hay
// DOS fuentes de font-size: 0 que un bloque roto puede heredar. La
// dominante es el propio export: generarExport SIEMPRE envuelve el
// área de contenido en <td style="width: 530px; font-size: 0;
// padding: 35px;"> (truco de email para matar el espacio entre
// imágenes) — TODOS los bloques viven adentro de ese td. La otra es
// la regla div { font-size: 0px; } de la hoja base del canvas (mismo
// truco, para el preheader), que aplica al marco mismo por ser <div>.
// Normalmente ninguna se nota porque el contenido de cada bloque trae
// su PROPIO font-size en el style de sus <td> (más específico, gana),
// pero un tag cuyo style quedó tan roto que no parsea NINGUNA
// propiedad (ver reconstruirAtributos.js) se queda sin nada que le
// gane a ese 0 heredado — el texto colapsa a alto cero, visible en el
// DOM pero invisible en pantalla. El 14px del marco se interpone en
// la cadena de herencia y lo hace visible SOLO en este preview.
export function marcarBloquesNoReconocidosParaPreview(html, idxsAtributosRotos = []) {
  return html.replace(
    /<!--BLOQUE slug="([^"]*)" idx="(\d+)"(?:\s+origen="([^"]*)")?-->([\s\S]*?)<!--\/BLOQUE-->/g,
    (_match, slug, idx, origen, contenidoBloque) => {
      // Un bloque con atributos rotos recibe el marco visual aunque su
      // slug NO sea "codigo" — desde el fix de 2026-07-20 que dejó de
      // forzar código personalizado para cualquier atributo roto, una
      // fila rota puede clasificar Bloque_Texto_Base y venir por acá.
      // Sin el marco (que declara font-size: 14px propio, ver
      // comentario de arriba), su <td> roto — sin ninguna propiedad
      // CSS válida que le gane — hereda el font-size: 0 del <td>
      // contenedor del área de contenido que generarExport SIEMPRE
      // emite (style="width: 530px; font-size: 0; padding: 35px;"),
      // y el texto colapsa a alto cero: en el DOM pero invisible.
      // Ese wrapper del export no se puede tocar (es el email real);
      // este marco de preview es el lugar correcto para interceptar
      // la herencia, igual que ya se hacía para slug="codigo".
      const tieneAtributoRoto = idxsAtributosRotos.includes(Number(idx))
      if (slug !== 'codigo' && !tieneAtributoRoto) {
        return `
      <tr><td id="preview-bloque-${idx}" style="padding: 0;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>${contenidoBloque}</tbody></table>
      </td></tr>`
      }
      const esFueraDeRango = origen === 'fuera-de-rango'
      const esSoloAtributoRoto = slug !== 'codigo'
      const color = esFueraDeRango ? '#DC2626' : esSoloAtributoRoto ? '#CA8A04' : '#F97316'
      const colorFondo = esFueraDeRango ? 'rgba(220, 38, 38, 0.08)' : esSoloAtributoRoto ? 'rgba(202, 138, 4, 0.08)' : 'rgba(249, 115, 22, 0.08)'
      const etiqueta = esFueraDeRango ? 'Fuera de lugar' : esSoloAtributoRoto ? 'Atributos rotos' : 'No reconocido'
      return `
      <tr><td id="preview-bloque-${idx}" style="padding: 0; position: relative;">
        <div style="position: relative; outline: 2px dashed ${color}; outline-offset: -2px; background: ${colorFondo}; font-size: 14px;">
          <span style="position: absolute; top: 2px; left: 2px; z-index: 1; background: ${color}; color: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 3px; line-height: 1;">${etiqueta}</span>
          <table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>${contenidoBloque}</tbody></table>
        </div>
      </td></tr>`
    }
  )
}


// Análogo a marcarBloquesNoReconocidosParaPreview pero para el patrón
// de layout obsoleto (<div style="display:inline-block">). Usa balance
// de tags para encontrar los <td> de nivel 0 (sin tablas anidadas
// entre ellos y el <tr> padre) que contienen divs inline-block — el
// regex simple sobre el string falla por el anidamiento profundo de
// <tr> dentro de las tablas de los propios divs. Cada <td> que
// contiene al menos un div inline-block es una estructura obsoleta,
// independientemente de cuántos divs tenga (1 columna o 2 columnas).
// Solo se usa en el preview de importación, nunca en el export real.
export function encontrarTdsConDivInlineBlock(html) {
  // Usa un stack de <td> para rastrear cada td a cualquier nivel de
  // anidamiento. Para cada td, extrae solo el texto entre el cierre
  // de su tag de apertura y la primera <table> anidada — ahí es donde
  // viven los <div inline-block> del patrón obsoleto. Acepta comillas
  // simples o dobles en los atributos del div (el HTML original puede
  // no haber pasado por la normalización de comillas todavía).
  const tagRegex = /<\/?(td|table)\b[^>]*>/gi
  const resultado = []
  let profTabla = 0
  const pilaTd = []
  let m
  tagRegex.lastIndex = 0
  while ((m = tagRegex.exec(html)) !== null) {
    const tag = m[0]
    const nombre = m[1].toLowerCase()
    const esApertura = !tag.startsWith('</')
    if (nombre === 'table') {
      if (esApertura) profTabla++
      else profTabla--
    } else if (nombre === 'td') {
      if (esApertura) {
        pilaTd.push({ inicio: m.index, finApertura: m.index + tag.length, profTablaAlAbrir: profTabla })
      } else if (pilaTd.length > 0) {
        const { inicio, finApertura } = pilaTd.pop()
        const fin = m.index + tag.length
        // Solo el contenido entre la apertura del td y su primera sub-tabla
        const contenidoTd = html.slice(finApertura, m.index)
        const primerSubTabla = contenidoTd.search(/<table\b/i)
        const antes = primerSubTabla >= 0 ? contenidoTd.slice(0, primerSubTabla) : contenidoTd
        if (/<div\b[^>]*style=["'][^"']*display\s*:\s*inline-block/i.test(antes)) {
          resultado.push({ inicio, fin, contenido: html.slice(inicio, fin) })
        }
      }
    }
  }
  return resultado
}


// ─── Conversión de estructuras obsoletas al formato actual ─────────────
// Convierte el patrón de columnas con <div inline-block> (piezas
// históricas) a la estructura actual con <td class="top"/"bottom">
// — la misma mecánica del bloque aprobado Modulo_Doble_Clasico. Las
// reglas NO son inventadas: salen 1:1 de la adaptación de referencia
// armada y aprobada por el equipo sobre una pieza real (Seguro
// Protección en Cajeros, marzo 2021):
//   1. Se reemplaza el <tr> COMPLETO que envuelve a la estructura (las
//      capas intermedias de tables/tds wrapper se colapsan), no solo
//      el <td> que contiene los divs.
//   2. El % del max-width de cada div pasa al width del <td> nuevo
//      (ej. 40%/60%). Sin % declarado no se convierte.
//   3. valign="top" en todas las columnas (el del template aprobado) —
//      el vertical-align original de los divs NO se preserva, decisión
//      explícita de la referencia aprobada.
//   4. La tabla interna de cada div se re-tagea con el tag canónico
//      (pierde su max-width y su class img-max — el ancho ahora lo
//      maneja el td, y el apilado mobile lo manejan .top/.bottom) y
//      su contenido interno queda VERBATIM.
// Además del patrón de 2 columnas (class="top" + class="bottom"), se
// admite el mismo patrón con UN SOLO div — un único módulo armado como
// <div inline-block> en vez de dos. Mismo mecanismo exacto (regla 1-4
// de arriba), pero produce solo el <td class="top">, sin un "bottom"
// inventado ni un segundo td vacío: caso real aportado sobre una pieza
// con un único ícono, sin la capa extra de wrapper table+role
// "presentation" que sí lleva la variante de 2 columnas (esa capa
// existe ahí para alinear ambas columnas entre sí; con una sola
// columna no cumple ningún propósito y se omite).
// Todo caso que no calce exactamente (3+ divs, sin % en algún div, más
// de una tabla por div, contenido suelto junto a los divs, contenido
// real en las capas wrapper) se deja SIN convertir — queda marcado
// como obsoleto igual que antes, preferimos consultar con el ejemplo
// en la mano antes que forzar una conversión dudosa.

// Rangos de TODOS los <tr> del documento (a cualquier profundidad),
// con balance de tags — para poder elegir el ancestro correcto de un
// <td> obsoleto. Tolera cierres desbalanceados descartando el tag.
function encontrarRangosDeTr(html) {
  const tagRegex = /<\/?tr\b[^>]*>/gi
  const pila = []
  const rangos = []
  let m
  while ((m = tagRegex.exec(html)) !== null) {
    if (!m[0].startsWith('</')) {
      pila.push(m.index)
    } else if (pila.length > 0) {
      rangos.push({ inicio: pila.pop(), fin: m.index + m[0].length })
    }
  }
  return rangos
}

// Divs de primer nivel (no anidados en otro div) de un fragmento, con
// balance de tags de <div>. Devuelve null si el fragmento tiene divs
// desbalanceados — señal de HTML roto, mejor no convertir.
function extraerDivsDePrimerNivel(fragmento) {
  const divRegex = /<\/?div\b[^>]*>/gi
  const divs = []
  let profundidad = 0
  let inicio = -1
  let finApertura = -1
  let m
  while ((m = divRegex.exec(fragmento)) !== null) {
    if (!m[0].startsWith('</')) {
      if (profundidad === 0) { inicio = m.index; finApertura = m.index + m[0].length }
      profundidad++
    } else {
      profundidad--
      if (profundidad < 0) return null
      if (profundidad === 0 && inicio >= 0) {
        divs.push({
          inicio,
          fin: m.index + m[0].length,
          finApertura,
          finInterior: m.index,
          tagApertura: fragmento.slice(inicio, finApertura),
          interior: fragmento.slice(finApertura, m.index),
        })
        inicio = -1
      }
    }
  }
  return profundidad === 0 ? divs : null
}

// ¿El fragmento tiene contenido que se VE? Comentarios (incluidos los
// condicionales MSO) y tags no cuentan; una imagen o texto real sí.
// Es el criterio para decidir si una capa wrapper se puede colapsar
// sin perder nada.
function tieneContenidoVisible(fragmento) {
  const sinComentarios = fragmento.replace(/<!--[\s\S]*?-->/g, '')
  if (/<(img|video|iframe)\b/i.test(sinComentarios)) return true
  const soloTexto = sinComentarios.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ')
  return soloTexto.trim() !== ''
}

// Del interior de un div, ubica su ÚNICA tabla de primer nivel y
// devuelve los índices RELATIVOS { desde, hasta } de su contenido
// interno (el <tbody>...</tbody> con las filas reales) — índices, no
// el string, para que quien llama pueda cortar del html real aunque
// esta función haya trabajado sobre la máscara sin comentarios. También
// devuelve colorFondo: el bgcolor/background-color declarado en el tag
// de apertura de ESA tabla (la que se descarta al re-tagear, ver regla
// 4 de convertirEstructurasObsoletas) — se propaga a la tabla nueva
// para no perder el fondo que le daba a toda la columna. Caso real: un
// módulo de ícono con fondo negro pierde ese fondo en la conversión
// porque la tabla que lo llevaba es justamente la que se reemplaza por
// el tag canónico; el resto de sus atributos (max-width, class
// img-max) se sigue descartando a propósito, pero el color no.
// Devuelve null si no hay tabla, hay más de una, o hay contenido
// visible suelto fuera de ella.
function colorDeTabla(aperturaTag) {
  const style = aperturaTag.match(/background-color\s*:\s*(#[0-9a-fA-F]{3,6}|[a-zA-Z]+)/i)
  if (style) return style[1]
  const attr = aperturaTag.match(/\bbgcolor\s*=\s*["']?(#[0-9a-fA-F]{3,6}|[a-zA-Z]+)["']?/i)
  return attr ? attr[1] : null
}
function interiorDeTablaUnica(interiorDiv) {
  const apertura = interiorDiv.match(/<table\b[^>]*>/i)
  if (!apertura) return null
  const inicioTabla = interiorDiv.indexOf(apertura[0])
  const tagRegex = /<\/?table\b[^>]*>/gi
  tagRegex.lastIndex = inicioTabla
  let profundidad = 0
  let m
  while ((m = tagRegex.exec(interiorDiv)) !== null) {
    if (!m[0].startsWith('</')) profundidad++
    else {
      profundidad--
      if (profundidad === 0) {
        const finContenido = m.index
        const finTabla = m.index + m[0].length
        const fuera = interiorDiv.slice(0, inicioTabla) + interiorDiv.slice(finTabla)
        // Otra <table> hermana o contenido suelto → no es el patrón
        if (/<table\b/i.test(fuera) || tieneContenidoVisible(fuera)) return null
        return { desde: inicioTabla + apertura[0].length, hasta: finContenido, colorFondo: colorDeTabla(apertura[0]) }
      }
    }
  }

  return null
}

// Esqueleto de la fila moderna — copiado VERBATIM de la adaptación de
// referencia aprobada (que a su vez es el esqueleto del template
// Modulo_Doble_Clasico con los width parametrizados). Lo único que
// varía por conversión: los dos width (% de los divs originales) y el
// contenido interno de cada tabla.
// Atributos de color a inyectar en la tabla nueva cuando la tabla
// descartada traía uno propio — ver comentario en interiorDeTablaUnica.
function atributosColor(colorFondo) {
  return colorFondo ? ` bgcolor="${colorFondo}" style="background-color:${colorFondo};"` : ''
}

function filaModernaTopBottom(col1, col2) {
  return `<tr>
    <td style="font-size: 0; padding: 0; margin: 0;" valign="top" align="center">
        <table align="center" cellpadding="0" cellspacing="0" border="0" role="presentation">
            <tbody>
                <tr>
                    <td class="top" align="center" valign="top" width="${col1.width}">
                        <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center"${atributosColor(col1.colorFondo)}>${col1.interior}</table>
                    </td>
                    <td class="bottom" align="center" valign="top" width="${col2.width}">
                        <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center"${atributosColor(col2.colorFondo)}>${col2.interior}</table>
                    </td>
                </tr>
            </tbody>
        </table>
    </td>
</tr>`
}

// Variante de una sola columna — mismo mecanismo, sin la capa extra
// de wrapper table (esa capa solo existe para alinear dos columnas
// entre sí; con una sola no cumple ningún propósito). El <td
// class="top"> queda directo bajo el <tr>, igual al ejemplo real
// aportado para este caso.
function filaModernaSoloTop(col1) {
  return `<tr>
    <td class="top" align="center" valign="top" width="${col1.width}">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center"${atributosColor(col1.colorFondo)}>${col1.interior}</table>
    </td>
</tr>`
}

export function convertirEstructurasObsoletas(html) {
  // Los comentarios HTML (incluidos los condicionales MSO del patrón
  // viejo, que traen tags de <table>/<tr>/<td> ADENTRO) se enmascaran
  // con espacios del MISMO largo: todos los índices calculados sobre
  // la máscara valen 1:1 sobre el html real, pero los tags fantasma de
  // los comentarios ya no confunden ni al detector ni al balance de
  // tr/td/table (bug real: el detector encontraba los <td> de los
  // condicionales MSO como si fueran los obsoletos). El contenido que
  // se CONSERVA se corta siempre del html real, nunca de la máscara —
  // por si una pieza trajera comentarios significativos dentro de las
  // columnas (ej. <!--[if !mso]><!--> con contenido alternativo).
  const mascara = html.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))

  const tdsObsoletos = encontrarTdsConDivInlineBlock(mascara)
  if (tdsObsoletos.length === 0) return { html, convertidas: 0 }

  const rangosTr = encontrarRangosDeTr(mascara)
  const reemplazos = []

  for (const td of tdsObsoletos) {
    const tdMask = mascara.slice(td.inicio, td.fin)
    const aperturaTd = tdMask.match(/^<td\b[^>]*>/i)
    const cierreTd = tdMask.match(/<\/td\s*>$/i)
    if (!aperturaTd || !cierreTd) continue
    // Offset absoluto donde arranca el contenido del td — para mapear
    // los índices relativos de los helpers al html real.
    const baseContenido = td.inicio + aperturaTd[0].length
    const contenidoMask = mascara.slice(baseContenido, td.fin - cierreTd[0].length)

    // ── Regla: 1 o 2 divs, y nada visible fuera de ellos ──
    // 1 div = mismo patrón con una sola columna (ver filaModernaSoloTop);
    // 2 divs = el patrón clásico top/bottom. 3+ no matchea ninguno.
    const divs = extraerDivsDePrimerNivel(contenidoMask)
    if (!divs || (divs.length !== 1 && divs.length !== 2)) continue
    const fueraDeDivs = divs.length === 2
      ? contenidoMask.slice(0, divs[0].inicio)
        + contenidoMask.slice(divs[0].fin, divs[1].inicio)
        + contenidoMask.slice(divs[1].fin)
      : contenidoMask.slice(0, divs[0].inicio) + contenidoMask.slice(divs[0].fin)
    if (tieneContenidoVisible(fueraDeDivs)) continue

    // ── Regla: cada div aporta su % de max-width y su única tabla ──
    const columnas = []
    for (const div of divs) {
      const pct = div.tagApertura.match(/max-width\s*:\s*([\d.]+%)/i)
      const rango = interiorDeTablaUnica(div.interior)
      if (!pct || rango === null) { columnas.length = 0; break }
      // Corte del html REAL: base del contenido + inicio del interior
      // del div + rango relativo de la tabla.
      const desdeReal = baseContenido + div.finApertura + rango.desde
      const hastaReal = baseContenido + div.finApertura + rango.hasta
      columnas.push({ width: pct[1], interior: html.slice(desdeReal, hastaReal), colorFondo: rango.colorFondo })
    }
    if (columnas.length !== divs.length) continue

    // ── Elegir el <tr> a reemplazar: el ancestro MÁS EXTERNO cuyo
    // contenido, sacando el td obsoleto, es puro wrapper (sin nada
    // visible). Subir de más está protegido por el chequeo de
    // contenido: el tr que además trae otro módulo, el header o los
    // legales nunca califica. ──
    const ancestros = rangosTr
      .filter(r => r.inicio < td.inicio && r.fin > td.fin)
      .sort((a, b) => a.inicio - b.inicio)
    let trElegido = null
    for (const tr of ancestros) {
      const fuera = mascara.slice(tr.inicio, td.inicio) + mascara.slice(td.fin, tr.fin)
      if (!tieneContenidoVisible(fuera)) { trElegido = tr; break }
    }
    if (!trElegido) continue

    reemplazos.push({
      inicio: trElegido.inicio,
      fin: trElegido.fin,
      nuevo: columnas.length === 2
        ? filaModernaTopBottom(columnas[0], columnas[1])
        : filaModernaSoloTop(columnas[0]),
    })
  }

  // Aplicar de atrás para adelante para no invalidar índices; el
  // control de solapamiento es defensivo (dos tds obsoletos nunca
  // deberían resolver al mismo tr, pero mejor saltear que duplicar).
  reemplazos.sort((a, b) => b.inicio - a.inicio)
  let resultado = html
  let convertidas = 0
  let inicioAnterior = Infinity
  for (const r of reemplazos) {
    if (r.fin > inicioAnterior) continue
    resultado = resultado.slice(0, r.inicio) + r.nuevo + resultado.slice(r.fin)
    inicioAnterior = r.inicio
    convertidas++
  }
  return { html: resultado, convertidas }
}

// Aplica convertirEstructurasObsoletas SOBRE EL CANVAS YA CLASIFICADO
// (no sobre el HTML crudo de la pieza) — a propósito, para no tocar
// el flujo de detección/preview de importarHeuristico: la pieza se
// analiza y se avisa igual que siempre (marcarEstructurasObsoletasParaPreview
// sigue marcando en rojo lo que encuentra), y recién cuando se
// confirma la importación (se decide efectivamente cargarla en el
// editor) se convierte lo que la pieza terminó trayendo a cada bloque
// del canvas. Cada bloque de un patrón obsoleto de 2 columnas entra
// como "Código personalizado" (no matchea contra ningún template real,
// ver importarHeuristico) con su htmlEditado = la fila obsoleta
// verbatim — convertirEstructurasObsoletas ya sabe operar sobre un
// fragmento de un solo <tr> (es como está probado en el test dorado),
// así que alcanza con corrérselo a cada bloque de forma independiente.
export function convertirEstructurasObsoletasEnCanvas(canvas) {
  let convertidas = 0
  const nuevoCanvas = canvas.map(bloque => {
    const htmlOriginal = bloque.htmlEditado ?? bloque.html
    if (!htmlOriginal) return bloque
    const conversion = convertirEstructurasObsoletas(htmlOriginal)
    if (conversion.convertidas === 0) return bloque
    convertidas += conversion.convertidas
    return { ...bloque, htmlEditado: conversion.html }
  })
  return { canvas: nuevoCanvas, convertidas }
}


export function marcarEstructurasObsoletasParaPreview(html) {
  const tds = encontrarTdsConDivInlineBlock(html)
  if (tds.length === 0) return html
  // El marcado se aplica DIRECTAMENTE sobre el tag de apertura del <td>
  // original — no se envuelve en un <div> extra porque <div> dentro de
  // <tr> es HTML inválido y rompe el layout. Se agrega id, outline y
  // background al propio <td>, y la etiqueta "Estructura obsoleta" se
  // inyecta como primer hijo del contenido del td.
  // Se reemplaza de atrás para adelante para no invalidar los índices.
  let resultado = html
  for (let i = tds.length - 1; i >= 0; i--) {
    const { inicio, fin } = tds[i]
    const tdHtml = html.slice(inicio, fin)
    // Reemplazar el tag de apertura del <td> agregando id + estilos de marcado
    const tdMarcado = tdHtml.replace(
      /^<td\b([^>]*)>/i,
      (m, attrs) => {
        const nuevoStyle = 'outline:2px solid #DC2626;outline-offset:-2px;background:rgba(220,38,38,0.07);position:relative;'
        // Si ya tiene style, mergear — no agregar un segundo atributo style
        const conStyle = /\bstyle=["'][^"']*["']/i.test(attrs)
          ? attrs.replace(/\bstyle=(["'])([^"']*)\1/i, (_m, q, val) => `style="${nuevoStyle}${val}"`)
          : attrs + ` style="${nuevoStyle}"`
        return `<td id="preview-obsoleto-${i}"${conStyle}>`
      }
    ).replace(
      // Inyectar la etiqueta flotante como primer hijo, justo después del tag de apertura
      /^(<td\b[^>]*>)/i,
      `$1<span style="position:absolute;top:2px;left:2px;z-index:1;background:#DC2626;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:3px;line-height:1;">Estructura obsoleta</span>`
    )
    resultado = resultado.slice(0, inicio) + tdMarcado + resultado.slice(fin)
  }
  return resultado
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
export function encontrarTablaContenido(html) {
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
export function separarFilasDeNivelSuperior(htmlInterno) {
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
export function corregirSlugIcono(slug, html) {
  if (slug !== 'Icono_Separador_Rojo_Texto' && slug !== 'Icono_Grande_Separador_Rojo_Texto') return slug
  return /border-left:\s*solid\s*5px/i.test(html)
    ? 'Icono_Grande_Separador_Rojo_Texto'
    : 'Icono_Separador_Rojo_Texto'
}


export function normalizarImagenLibre(html) {
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
export const UMBRAL_SIMILITUD_BLOQUE = 0.7


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
export function clasificarPorEstructuraDirecta(filaHtml) {
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

        // Modulo_Doble_Clasico / Modulo_Doble_Con_Imagen_Punteada:
        // ambos tienen exactamente 2 <td> de nivel superior (class="top" y
        // class="bottom"), cada uno con su propia sub-tabla y una imagen
        // principal de 265px, sin texto visible. El discriminador entre los
        // dos es la presencia de puntos-128-blanco.png (ver clasificarModuloDoble).
        // La señal de confirmación de que estamos ante un Modulo_Doble real
        // (y no Destacado_GiftCard_BigBox, que también usa class="top/bottom"
        // pero tiene texto visible): class="top" o "bottom" presentes Y sin
        // texto visible en el bloque completo (los Modulo_Doble son 100% imagen).
        const tieneClasesTopBottom = /class=["'](?:top|bottom)["']/i.test(subTablaMatch[1])
        const textoVisibleModulo = interior.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()
        const esModuloDoble = tieneClasesTopBottom && textoVisibleModulo.length === 0
        if (esModuloDoble) return clasificarModuloDoble(interior)
      }
    }
    // Caso real encontrado: una imagen de ancho completo (530px o similar,
    // class="img-max") envuelta en una tabla de layout con class="top" — no
    // tiene segunda columna (tdsSubTabla.length === 1), no tiene texto visible
    // y la imagen es claramente de contenido (ancho >= 400px o class img-max),
    // no un botón (que siempre es angosto, ≤ 250px). Sin esta regla cae al
    // flujo de similitud donde Btn puede ganar por forma coincidente
    // (imagen + link, sin texto) a pesar de ser un template completamente
    // distinto. Señal inequívoca: imagen ≥ 400px O con class img-max, sin
    // texto visible, en un bloque de 1 solo td con sub-tabla de 1 columna.
    const textoVisibleWrapper = interior.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()
    const imgGrande = /<img\b[^>]*(?:width="(\d+)"|class="[^"]*img-max[^"]*")[^>]*>/i.exec(interior)
    if (!textoVisibleWrapper && imgGrande) {
      const wAttr = interior.match(/<img\b[^>]*\swidth="(\d+)"/i)
      const anchoImg = wAttr ? Number(wAttr[1]) : 0
      const tieneImgMax = /class="[^"]*img-max[^"]*"/i.test(interior)
      if (tieneImgMax || anchoImg >= 400) return 'Imagen_Libre'
    }
    // Caso real encontrado: grilla de logos o múltiples imágenes chicas en
    // línea dentro de un solo <td> (ej. logos de shoppings, 19 imágenes de
    // 100px en un mismo <td>). Ningún template de la biblioteca tiene más de
    // 2 imágenes en un solo td — con 3 o más, es siempre código personalizado.
    // Sin esta regla, similitudDeForma le da ~0.78 contra Btn porque la
    // diferencia en cantidad de imgs (1 vs 19) queda diluida al normalizar
    // por max(19,1)=19, y el promedio de las otras dimensiones similares
    // arrastra el puntaje por encima del umbral.
    const cantidadImgs = (interior.match(/<img\b/gi) || []).length
    if (!textoVisibleWrapper && cantidadImgs >= 3) return 'codigo'
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


// Discriminador directo para el par Modulo_Doble_Clasico /
// Modulo_Doble_Con_Imagen_Punteada — llamado desde clasificarPorEstructuraDirecta
// una vez que se verificó que la estructura es un bloque de dos columnas (top/bottom).
// La señal inequívoca: Punteada siempre lleva MediaLineaPunteada530x4.png (la línea
// divisoria visible solo en mobile) — el Clásico nunca la tiene. El bgcolor de las
// celdas NO se usa como señal porque varía por segmento (rojo CG, negro EB, etc.).
export function clasificarModuloDoble(interior) {
  // MediaLineaPunteada530x4.png NO sirve como señal acá porque vive dentro de un
  // comentario condicional <!--[if !mso]><!--> ... <!--<![endif]--> que
  // importarHeuristico limpia ANTES de clasificar. puntos-128-blanco.png (el
  // separador vertical de 2px entre las dos imágenes, exclusivo de la Punteada)
  // sí sobrevive esa limpieza — es el discriminador correcto.
  return /puntos-128-blanco/i.test(interior)
    ? 'Modulo_Doble_Con_Imagen_Punteada'
    : 'Modulo_Doble_Clasico'
}


// Punto de entrada de la Fase 2 — se usa solo cuando importarDesdeHtml
// devolvió resultado: null (ningún marcador <!--BLOQUE--> encontrado).
// Mismo shape de retorno { resultado, avisos } que importarDesdeHtml,
// más confianza ('alta' | 'media' | 'baja') para que la UI decida
// cuánto advertir. confianza 'baja' o resultado null deben mostrarse
// como "no se pudo reconocer con seguridad — preferible armar la
// pieza a mano", nunca como un resultado parcial silencioso.
export function importarHeuristico(html) {
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
  // Normalizar dominio viejo de imágenes al CDN actual — piezas
  // históricas pueden tener recursos en icommktrepo.s3.amazonaws.com
  // en vez de d343t93odde9ul.cloudfront.net. Normalizar acá garantiza
  // que tanto la detección de logos de header como el htmlEditado
  // guardado usen siempre el dominio correcto.
  html = html.replace(/https?:\/\/icommktrepo\.s3\.amazonaws\.com\//gi, 'https://d343t93odde9ul.cloudfront.net/')

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
    // Atributos rotos por style con comillas anidadas — SIEMPRE se
    // detectan y avisan acá, sin importar en qué termine
    // clasificándose la fila (ver DetectarAtributosConDosPuntos,
    // generales.js). Solo se fuerza código personalizado más abajo
    // cuando la clasificación final es Imagen_Libre — el único
    // template cuya normalización (normalizarImagenLibre) reescribe
    // el <img> en silencio. El resto de los templates solo pasan por
    // normalizarNegritas, que jamás toca atributos de ningún otro tag
    // — el HTML roto sobrevive intacto igual sea Bloque_Texto_Base,
    // Bullet, etc., así que clasificarlos normal ahí no tiene ningún
    // riesgo. Forzar código de más (como hacía la versión anterior de
    // este fix) le quitaba la edición linda a bloques de texto
    // simples sin necesidad real — bug real reportado por Santi
    // (2026-07-20): un párrafo de texto simple con un atributo roto
    // se importaba como código personalizado en vez de Bloque_Texto_Base.
    const problemasAtributos = DetectarAtributosConDosPuntos(filaHtml)
    if (problemasAtributos.length > 0) {
      problemasAtributos.forEach(p => {
        avisos.push({
          texto: p.detalle,
          tipo: 'atributo-roto',
          canvasIdx: idx,
          tagOriginal: p.tagCompleto,
          tagReconstruido: p.reconstruccion?.confiable ? p.reconstruccion.tagReconstruido : null,
          fragmentoRoto: p.reconstruccion?.confiable ? p.reconstruccion.fragmentoRoto : null,
          styleReconstruido: p.reconstruccion?.confiable ? p.reconstruccion.styleReconstruido : null,
        })
      })
    }

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
      // Único punto de riesgo real: Imagen_Libre reescribe el <img>
      // entero vía normalizarImagenLibre (ver comentario grande más
      // arriba) — con un atributo roto en el medio, esa reescritura
      // lo pisaría en silencio antes de que el aviso pueda ofrecer
      // nada. Se fuerza código personalizado ACÁ, puntual, en vez de
      // para cualquier clasificación como antes.
      if (slugFinal === 'Imagen_Libre' && problemasAtributos.length > 0) {
        return { id: 'codigo', instanceId: `codigo-${Date.now()}-${idx}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: filaHtml.trim(), htmlEditado: filaHtml.trim(), tipo: 'codigo', slug: 'codigo' }
      }
      const match = BLOQUES_CONTENIDO.find(b => b.slug === slugFinal)
      if (match) {
        coincidencias++
        // Modulo_Doble_Con_Imagen_Punteada: el htmlEditado NO puede venir
        // de filaHtml porque importarHeuristico limpia todos los comentarios
        // MSO al inicio — el bloque <!--[if !mso]><!--> que contiene la
        // línea punteada (MediaLineaPunteada530x4.png) ya no está en filaHtml.
        // Si se usara filaHtml como base, el export final quedaría sin esa
        // sección y la pieza se vería mal en mobile (sin separador entre
        // las dos imágenes al apilar en 1 columna). Solución: usar el
        // match.html (template original con el bloque MSO intacto) como
        // base del htmlEditado, trasplantando las URLs reales (src, alt,
        // title) de las imágenes editables desde filaHtml. Las imágenes
        // estructurales (puntos-128-blanco.png, MediaLineaPunteada) nunca
        // se editan y no se trasplantan — quedan del template, que es lo
        // correcto. bgcolor y otras propiedades de layout tampoco cambian
        // entre segmentos en esta estructura; si en el futuro cambiaran,
        // este criterio habría que extenderlo.
        let htmlEditadoFinal
        if (slugFinal === 'Modulo_Doble_Con_Imagen_Punteada') {
          // Extraer src/alt/title de las imágenes EDITABLES de filaHtml
          // (las dos imágenes principales, NO puntos-128-blanco ni MediaLinea)
          const imgsEditables = [...filaHtml.matchAll(/<img([^>]*)>/gi)]
            .map(m => m[1])
            .filter(attrs => !/puntos-128-blanco|MediaLineaPunteada/i.test(attrs))
          // Extraer el color de segmento desde filaHtml — todas las celdas
          // que rodean imágenes en este bloque comparten el mismo bgcolor
          // (CG: #c4161c, EB: #000000, Pay: #635843, Start: #f58220).
          // Se toma el primer bgcolor no-blanco encontrado en las celdas
          // que sobrevivieron la limpieza MSO.
          const bgcolorSegmento = filaHtml.match(/bgcolor="(#(?!fff(?:fff)?)[^"]+)"/i)?.[1] ?? null
          // Trasplantar imágenes editables por posición, bgcolor en todas
          // las celdas que el template tiene con su color base (#c4161c).
          // Las imgs estructurales y el bloque <!--[if !mso]--> quedan
          // intactos desde el template.
          let editableIdx = 0
          let htmlBase = match.html.replace(/<img([^>]*)>/gi, (m, attrs) => {
            if (/puntos-128-blanco|MediaLineaPunteada/i.test(attrs)) return m
            if (editableIdx >= imgsEditables.length) return m
            return `<img${imgsEditables[editableIdx++]}>`
          })
          if (bgcolorSegmento) {
            htmlBase = htmlBase.replace(/bgcolor="#c4161c"/gi, `bgcolor="${bgcolorSegmento}"`)
          }
          htmlEditadoFinal = htmlBase
        } else {
          htmlEditadoFinal = slugFinal === 'Imagen_Libre'
            ? normalizarImagenLibre(normalizarNegritas(filaHtml.trim()))
            : normalizarNegritas(filaHtml.trim())
        }
        return { ...match, instanceId: `${match.id}-${Date.now()}-${idx}`, htmlEditado: htmlEditadoFinal }
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
      // Mismo criterio puntual que en la clasificación directa (ver
      // comentario grande más arriba) — solo Imagen_Libre reescribe
      // el <img> en silencio.
      if (slugFinal === 'Imagen_Libre' && problemasAtributos.length > 0) {
        return { id: 'codigo', instanceId: `codigo-${Date.now()}-${idx}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: filaHtml.trim(), htmlEditado: filaHtml.trim(), tipo: 'codigo', slug: 'codigo' }
      }
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
  let imgPrincipal = { activo: false, src: '', alt: '', title: '', link: '', alto: 425 }
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
        // El regex de arriba SOLO matchea height="425" a propósito —
        // es la convención fija de la plataforma externa que se está
        // heurísticamente reconociendo acá, no tiene relación con el
        // alto real medido que ahora calcula el editor propio (ver
        // onImgPrincipalSrcBlur/alturaImgPrincipal en
        // EditorPiezas.jsx/exportar.js). Por eso queda fijo en 425,
        // igual que siempre.
        alto: 425,
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
  // Extraer solo el nombre de archivo de una URL de imagen (la parte
  // después del último "/"). Se usa para comparar logos distintivos
  // entre el template y la pieza importada sin depender del dominio —
  // piezas viejas pueden tener el logo en icommktrepo.s3.amazonaws.com
  // en vez del CDN actual (d343t93odde9ul.cloudfront.net), y el nombre
  // del archivo es suficientemente específico para identificar el logo.
  function nombreArchivo(src) {
    return src.split('/').pop()
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
    const nombresDistintivos = distintivosCandidato.map(nombreArchivo)
    const logosEnPieza = [...htmlAntesDeContenido.matchAll(/<img\b[^>]*\ssrc="([^"]*)"/gi)].map(m => nombreArchivo(m[1]))
    const logoEncontrado = nombresDistintivos.some(n => logosEnPieza.includes(n))
    if (!logoEncontrado) continue
    // ¿Algún OTRO candidato comparte alguno de estos mismos logos
    // distintivos? Si no, el match por logo solo ya es inequívoco —
    // mismo comportamiento que antes para todos los headers actuales
    // que no comparten logo con ningún otro.
    const logoCompartido = BLOQUES_HEADER.some((otro, j) => j !== i && logosDistintivos(otro.html).map(nombreArchivo).some(n => nombresDistintivos.includes(n)))
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
      avisos.push({ texto: `Header detectado: "${bandaHeader.nombre}" (por color de fondo, sin logo de marca propio para confirmar) — revisalo si no es el esperado.`, tipo: 'general', canvasIdx: null })
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

  // Detectar estructuras obsoletas (<div style="display:inline-block">)
  // usando balance de tags para encontrar los <td> de nivel 0 que
  // contienen divs inline-block. Cada <td> con al menos un div
  // inline-block = una estructura obsoleta (puede tener 1 o 2 divs).
  const filasConObsoletos = encontrarTdsConDivInlineBlock(html).length
  if (filasConObsoletos > 0) {
    avisos.push({
      texto: `Esta pieza usa ${filasConObsoletos === 1 ? 'una estructura de layout obsoleta' : `${filasConObsoletos} estructuras de layout obsoletas`} — hacé click para verla${filasConObsoletos > 1 ? 's' : ''} en el preview (estructura <div inline-block>). Reemplazalas por la estructura actual (class="top"/"bottom") antes de usar esta pieza.`,
      tipo: 'obsoleto',
      canvasIdx: null,
    })
  }

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
