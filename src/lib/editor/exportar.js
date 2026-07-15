// Generación del HTML final de una pieza (generarExport) y helpers
// de estilo/preview. Contraparte de importar.js — el formato de los
// marcadores está documentado en README.md, sección "Marcadores del
// Editor de Piezas".

import { LEGAL_FIJO_HTML, TEMAS, TEMA_DEFAULT, colorPorPrefijoHeader } from './constantes.js'
import { limpiarHtmlExport, quitarWrapperSiEnvuelveTodo } from './htmlUtils.js'
import { reordenarRedesSociales } from './redesSociales.js'

// Sanea un valor antes de interpolarlo DENTRO de un atributo HTML con
// comillas dobles — mismo criterio que linkSeguro en
// PanelEditor/commitImagenLibre (EditorPiezas.jsx): una comilla doble
// literal en el valor (alt, title, link, o los campos de texto libre
// de indicadores/firma) corta el atributo ahí mismo y deforma el HTML
// exportado. Bug real: un Alt como 'Promo "Hot Sale" 50%' generaba
// alt="Promo "Hot Sale" 50%" — el navegador/cliente de correo ve tres
// atributos rotos en vez de uno. Esta función centraliza el mismo
// reemplazo para los puntos de generarExport que interpolan directo
// en vez de pasar por commitImagenLibre (que ya lo hacía bien, solo
// para Imagen Libre). No toca el resto del HTML, solo el valor puntual
// antes de que quede envuelto en comillas.
export function escaparAtributo(valor) {
  return (valor ?? '').replaceAll('"', '&quot;')
}

// ─── Estilos del email — EXACTOS al canvas entregado ───────────────────────
// Función en vez de string fijo: permite sumar estilos custom de los
// bloques de "código personalizado" del canvas (ver
// actualizarEstilosBloque / generarExport) sin duplicar todo el bloque
// de estilos base. estilosDesktop se inserta antes del primer @media
// (aplica siempre); estilosMobile se inserta DENTRO del @media
// max-width:600px existente (aplica solo en mobile) — el usuario solo
// escribe las reglas CSS, sin el selector de media query.
// wrapPreview (preview de un bloque individual, sin contexto del
// resto del canvas) sigue llamando esta función sin argumentos —
// mismo resultado que el string fijo de antes.
export function construirCanvasStyles(estilosDesktop = '', estilosMobile = '') {
  return `<style type="text/css"><!--
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
${estilosDesktop ? `${estilosDesktop}\n` : ''}@media screen and (max-width: 600px) {
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
${estilosMobile ? `  ${estilosMobile}\n` : ''}}
@media screen and (max-width: 480px) { .IconoRedes { max-width: 14px !important; width: 14px !important; } }
div[style*='margin: 16px 0;'] { margin: 0 !important; }
--></style>`
}


// ─── Preview wrap ───────────────────────────────────────────────────────────
export const PREVIEW_OVERRIDE = `<style>table{table-layout:auto!important;}</style>`


export function wrapPreview(html, esHeader = false) {
  const body = esHeader
    ? html
    : `<table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;"><tbody>${html}</tbody></table>`
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${construirCanvasStyles()}${PREVIEW_OVERRIDE}</head><body style="margin:0;padding:0;background:#fff;">${body}</body></html>`
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
export function generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalesAdicionales = [], legalesSeparados = false, firmaInstitucional = null, indicadores, tema = TEMA_DEFAULT, redesOrden = null }) {
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

  // Estilos custom de TODOS los bloques de código del canvas, sumados
  // en una sola hoja — cada bloque de "código personalizado" puede
  // traer los suyos (ver actualizarEstilosBloque/PanelEditor), no
  // solo el bloque seleccionado en este momento. Los bloques sin
  // estilos custom (la mayoría) simplemente no aportan nada acá.
  const estilosDesktopCombinados = canvas
    .filter(b => b.tipo === 'codigo' && b.estilosDesktop)
    .map(b => b.estilosDesktop)
    .join('\n')
  const estilosMobileCombinados = canvas
    .filter(b => b.tipo === 'codigo' && b.estilosMobile)
    .map(b => b.estilosMobile)
    .join('\n')

  // Alto real de Imagen principal — antes estaba fijo en 425px sin
  // importar la proporción de la imagen pegada, deformándola si no
  // era exactamente 600×425. imgPrincipal.alto se calcula al cambiar
  // la URL (ver onImgPrincipalSrcBlur en EditorPiezas.jsx) manteniendo
  // el ancho de 600px fijo (ese sí no cambia, es el ancho real del
  // cuerpo del email) y recalculando el alto según la proporción real
  // de la imagen. El fallback a 425 es por compatibilidad: piezas
  // guardadas o importadas de ANTES de este cambio no traen el campo
  // `alto`, y 425 es exactamente el valor que siempre se usó, así que
  // el comportamiento para esas piezas viejas no cambia.
  const alturaImgPrincipal = imgPrincipal.alto || 425
  const imgPrincipalContenido = imgPrincipal.activo && imgPrincipal.src
    ? `<img src="${escaparAtributo(imgPrincipal.src)}" alt="${escaparAtributo(imgPrincipal.alt)}"${imgPrincipal.title ? ` title="${escaparAtributo(imgPrincipal.title)}"` : ''} class="img-max" style="width: 600px; height: ${alturaImgPrincipal}px; display: block; font-family: Arial,Helvetica,Open Sans,sans-serif; font-size: 22px; color: #c4161c;" width="600" height="${alturaImgPrincipal}" />`
    : null
  const imgPrincipalHtml = imgPrincipalContenido
    ? `<!--IMG_PRINCIPAL-->\n<tr>\n<td style="font-size: 0; padding: 0; margin: 0;" valign="top" align="center">${imgPrincipal.link ? `<a href="${escaparAtributo(imgPrincipal.link)}" target="_blank" style="border-style: none !important;">${imgPrincipalContenido}</a>` : imgPrincipalContenido}</td>\n</tr>\n<!--/IMG_PRINCIPAL-->`
    : ''

  const imgFooterHtml = imgFooter.activo && imgFooter.src
    ? `<!--IMG_FOOTER-->\n<tr>\n<td colspan="3" style="font-size: 0;" valign="middle" align="center">${imgFooter.link ? `<a href="${escaparAtributo(imgFooter.link)}" target="_blank">` : ''}<img src="${escaparAtributo(imgFooter.src)}" alt="${escaparAtributo(imgFooter.alt)}"${imgFooter.title ? ` title="${escaparAtributo(imgFooter.title)}"` : ''} class="img-max" width="600" border="0" />${imgFooter.link ? '</a>' : ''}</td>\n</tr>\n<!--/IMG_FOOTER-->`
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

  return `${construirCanvasStyles(estilosDesktopCombinados, estilosMobileCombinados)}
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


// Limpia el HTML del legal específico para el export: quita wrappers externos
export function legalHtmlExport(html) {
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
export function aplicarColorTexto(html, colorTexto) {
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
export function revertirColorTexto(html, colorTexto) {
  if (colorTexto === '#333333') return html // tema ICBC, no hubo reemplazo que revertir
  const escapado = colorTexto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(new RegExp(`color:\\s*${escapado}`, 'gi'), 'color: #333333')
}
