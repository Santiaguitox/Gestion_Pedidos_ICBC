// Reconstrucción de atributos HTML rotos por un style="..."/style='...'
// que perdió su wrapper — ver el diagnóstico completo en
// DetectarAtributosConDosPuntos (generales.js). Módulo separado a
// propósito: la DETECCIÓN (¿hay un atributo sospechoso?) y la
// RECONSTRUCCIÓN (¿puedo armar una sugerencia confiable de cómo era
// el style original?) son dos preguntas independientes — un tag puede
// tener un atributo con ':' que no venga de este patrón puntual (nada
// que reconstruir), y por eso viven en archivos separados.
//
// Mecanismo real (confirmado reproduciendo el parseo con un parser
// HTML real, no es una hipótesis): cuando el HTML de origen escribe
// style con comillas SIMPLES envolviendo todo el atributo, y comillas
// SIMPLES de nuevo alrededor de una tipografía no-sistema adentro
// (ej. font-family: 'Fuente Custom', Arial), cualquier parser HTML
// real (cualquier navegador, cualquier herramienta que haga un DOM
// round-trip) interpreta la primera comilla simple interna como el
// CIERRE del atributo style completo. Todo lo que sigue se re-tokeniza
// como una cadena de atributos sueltos con valor vacío ("nombre=\"\""),
// cada uno con el nombre pasado a minúscula (así serializa cualquier
// atributo booleano cualquier motor de HTML). El contenido casi no se
// pierde — solo queda mal segmentado y sin mayúsculas.
//
// El mismo patrón también aparece SIN que sobreviva ningún fragmento
// de style="..." en absoluto (caso real reportado por Santi,
// 2026-07-19/20: `display:="" block="" color:="" c4161c=""` sin
// ningún style= previo) — probablemente el HTML de origen nunca tuvo
// el wrapper style="..." puesto, y el CSS quedó pegado directo donde
// irían los atributos. Es igual de reconstruible: un nombre de
// atributo terminado en ':' (ej. "display:", "color:") sigue siendo
// la misma señal inequívoca de que es CSS perdido, con o sin ancla
// previa — ver buscarCorridaFantasma.
//
// TODO el trabajo de este archivo es sobre STRINGS — nunca DOMParser,
// mismo criterio que el resto de src/lib/editor (ver el comentario de
// cabecera en htmlUtils.js). Esto es intencional: usar DOM para
// "arreglar" HTML ya roto arriesga enmascarar el problema real detrás
// de un re-serializado que además reordena/normaliza cosas que no
// tienen nada que ver (mismo motivo por el que ni Editor de Piezas ni
// este módulo reserializan vía outerHTML).

// Atributos HTML reales que pueden aparecer legítimamente pegados
// justo después (o alrededor) de un style roto (ej. width="100"
// height="100" alt="") — cualquiera de estos SIEMPRE corta la corrida
// de "atributos fantasma", incluso si por casualidad tiene valor
// vacío (alt="" es el caso real más común: casi toda imagen lo trae).
// Lista deliberadamente amplia y fácil de extender — sumar un
// atributo acá nunca puede generar una reconstrucción de MENOS
// calidad, en el peor caso corta la corrida un poco antes de lo
// necesario y la validación de forma (analizarDeclaraciones)
// descarta el resultado si queda incompleto.
export const ATRIBUTOS_HTML_CONOCIDOS = new Set([
  'src', 'href', 'alt', 'title', 'id', 'class', 'style',
  'width', 'height', 'align', 'valign', 'border', 'cellpadding', 'cellspacing',
  'bgcolor', 'background', 'colspan', 'rowspan', 'target', 'rel',
  'type', 'name', 'value', 'placeholder', 'role', 'lang', 'dir',
  'data-legal-fijo', 'data-indicador-sigla', 'data-indicador-valor',
])

// Un nombre "data-*" SIEMPRE es un atributo HTML legítimo (es el
// espacio de nombres reservado por el spec para atributos custom), y
// ninguna propiedad CSS real empieza con "data-" — así que corta la
// corrida de fantasmas igual que los de la lista fija, sin tener que
// enumerar cada data- del proyecto uno por uno (la lista de arriba
// tenía 3 sueltos y le faltaban data-legal-especifico, data-legal-idx,
// data-firma-fila1-izq/der... — cualquiera de esos, pegado a un style
// roto, se hubiera tragado dentro de la corrida).
function esAtributoHtmlConocido(nombre) {
  const n = nombre.toLowerCase()
  return ATRIBUTOS_HTML_CONOCIDOS.has(n) || n.startsWith('data-')
}

// Tokeniza los atributos de UN tag `<...>` completo, en orden, sin
// DOM — igual espíritu que extraerTdsConBalance/formaDeTags en
// htmlUtils.js (parseo manual sobre el string). Devuelve
// { nombre, valor, inicio, fin } por atributo, con inicio/fin como
// offsets DENTRO del tagHtml recibido (para poder recortar/reemplazar
// un rango exacto más adelante sin tocar el resto del tag).
export function tokenizarAtributosDeTag(tagHtml) {
  const matchNombreTag = /^<[a-zA-Z][a-zA-Z0-9-]*/.exec(tagHtml)
  if (!matchNombreTag) return []
  const inicioAtributos = matchNombreTag[0].length

  const atributos = []
  // nombre: cualquier corrida sin espacio ni '=' (cubre "display:",
  // "c4161c", "data-foo", etc). valor: opcional — entre comillas
  // simples o dobles, o SIN comillas (border=0, width=100 — legal en
  // HTML y común en piezas viejas). Sin la alternativa sin comillas,
  // `width=100` se tokenizaba como DOS atributos ("width" y un "100"
  // fantasma): el "100" huérfano quedaba como atributo desconocido y
  // cortaba/ensuciaba la corrida de fantasmas en el lugar equivocado
  // — la reconstrucción devolvía la mitad del CSS con confiable=true
  // (fix a medias que encima marcaba el aviso como resuelto). Un
  // atributo sin '=' (booleano real) sigue quedando con valor ''.
  const regex = /([^\s=/>]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>"'`]+)))?/g
  regex.lastIndex = inicioAtributos
  let m
  while ((m = regex.exec(tagHtml)) !== null) {
    // Frenar en el cierre del tag ('>' o '/>') — el regex global
    // puede seguir "matcheando" basura si tagHtml trae contenido
    // después del '>' (no debería pasar si el caller recorta bien el
    // tag, pero es una defensa barata).
    if (tagHtml[m.index] === '>' || (tagHtml[m.index] === '/' && tagHtml[m.index + 1] === '>')) break
    atributos.push({
      nombre: m[1],
      valor: m[2] ?? m[3] ?? m[4] ?? '',
      inicio: m.index,
      fin: m.index + m[0].length,
    })
  }
  return atributos
}

// Comillas sueltas: cuando el style original usaba comillas SIMPLES
// como wrapper completo Y ADEMÁS una tipografía no-sistema con
// comillas simples propias adentro (ej. 'Museo Sans'), lo único que
// sobrevive de esas comillas son caracteres sueltos desperdigados en
// el texto reconstruido — no necesariamente al final: la comilla de
// CIERRE del nombre de la fuente cae en el medio (ej. "museo sans',
// arial..."), y la del wrapper completo sí suele quedar pegada al
// final (ej. "...c4161c;'"). Ya se decidió no re-envolver el nombre
// de la tipografía en comillas — siendo así, CUALQUIER comilla que
// aparezca en el texto reconstruido es siempre un resto huérfano,
// nunca algo que haya que conservar, así que se sacan todas por
// igual en vez de perseguir casos puntuales (al final, en el medio,
// etc.) uno por uno.
function sacarComillasSueltas(valor) {
  return valor.replace(/['"]/g, '')
}

// Palabras clave CSS reservadas/exclusivas de UNA única propiedad —
// sirven para etiquetar una declaración que perdió su nombre de
// propiedad sin inventar nada: si el valor contiene una de estas
// palabras, no hay otra lectura posible en CSS real. Deliberadamente
// CHICO, evaluado propiedad por propiedad contra el spec de CSS (no
// "si parece texto, es esto"):
//   - font-family: los generic families (sans-serif, serif,
//     monospace, cursive, fantasy, system-ui) son un TIPO de valor
//     reservado por el spec — no aparecen en ninguna otra propiedad.
//   - text-decoration: underline/overline/line-through son igual de
//     exclusivos (a diferencia de "none", que sí es ambiguo —
//     aparece en decoration, border, list-style... y por eso NO
//     entra en esta lista).
// Deliberadamente NO incluye (revisado y descartado, no olvidado):
// display (block/inline/none — "none" es ambiguo, y "block"/"inline"
// no están garantizados por el spec como exclusivos de display),
// text-align/vertical-align (left/right/center/top/bottom se repiten
// en float, background-position, clear...), font-weight (normal/bold
// — "normal" es de los valores más reusados de todo CSS), color con
// nombre como red/blue (ambiguo entre color, background-color,
// border-color...). Si aparece evidencia real de alguno de estos
// casos, se suma con la misma vara: ¿esta palabra puede significar
// SOLO una propiedad en CSS real, sin ninguna excepción?
const PROPIEDADES_POR_PALABRA_CLAVE_UNICA = [
  { propiedad: 'font-family', patron: /\b(sans-serif|serif|monospace|cursive|fantasy|system-ui)\b/i },
  { propiedad: 'text-decoration', patron: /\b(underline|overline|line-through)\b/i },
]

// Etiqueta una declaración que perdió su nombre de propiedad (no
// empieza con "algo:") si su valor contiene alguna de las palabras
// clave de arriba. Devuelve null si no aplica ninguna — el caller
// deja la declaración sin propiedad, lo que la va a marcar como
// inválida más adelante en analizarDeclaraciones.
function propiedadPerdidaPorPalabraClave(valorTexto) {
  const match = PROPIEDADES_POR_PALABRA_CLAVE_UNICA.find(p => p.patron.test(valorTexto))
  return match?.propiedad ?? null
}

// Propiedades CSS cuyo valor es, por definición del spec, una lista
// separada por COMAS (no espacios) — font-family es la que aparece
// en la práctica acá, pero la regla es general del lenguaje, no un
// dato de este proyecto en particular (transition-property,
// grid-template-columns, background con varias capas, etc. también
// lo son, aunque no se hayan visto en ninguna pieza real todavía).
// Cuando los tokens fantasma de una de estas propiedades se
// reconstruyen, se unen con ', ' en vez de ' ' — la comilla/coma
// propia que cada token pueda traer pegada (ej. "sans'," o "arial,")
// se limpia antes de unir, para no terminar con comas dobles.
//
// Límite real que esto NO resuelve (y no hay forma honesta de
// resolver): un nombre de tipografía de dos palabras (ej. "Open
// Sans") queda indistinguible de dos tipografías de una palabra cada
// una ("Open" y "Sans") — el espacio que las separaba en el original
// es exactamente el mismo carácter que separa palabras DENTRO de un
// nombre. Partirlo en dos entradas separadas por coma no rompe nada
// en la práctica (un navegador simplemente no encuentra fuentes
// llamadas "Open" ni "Sans" sueltas y sigue a la próxima de la
// lista), pero no es 100% fiel al texto original — se prefiere esto
// a dejar la lista entera unida con espacios, que es CSS inválido
// para esta propiedad (un solo nombre larguísimo que tampoco existe).
const PROPIEDADES_LISTA_POR_COMAS = new Set(['font-family'])

function limpiarTokenDeValor(token) {
  return sacarComillasSueltas(token).replace(/[,;]+$/, '').trim()
}

// Cierra una declaración CSS a partir de su propiedad (puede venir
// null, si no se pudo determinar) y sus tokens de valor crudos (sin
// unir todavía). Decide el separador correcto según el spec de CSS
// para esa propiedad (ver PROPIEDADES_LISTA_POR_COMAS), intenta
// recuperar la propiedad por palabra clave si vino null (ver
// propiedadPerdidaPorPalabraClave), garantiza que termine en ';', y
// agrega el '#' si es un color hex que lo perdió en el camino (ver
// agregarNumeralColorFaltante).
function cerrarDeclaracion(propiedadConocida, tokensDeValor) {
  const valorPlano = tokensDeValor.map(limpiarTokenDeValor).join(' ').trim()
  const propiedad = propiedadConocida ?? propiedadPerdidaPorPalabraClave(valorPlano)

  if (!propiedad) {
    // Sin propiedad (ni dada ni recuperable por palabra clave) — se
    // deja el valor tal cual, sin inventar nada; analizarDeclaraciones
    // lo va a marcar inválido más adelante.
    return /;$/.test(valorPlano) ? valorPlano : `${valorPlano};`
  }

  const valor = PROPIEDADES_LISTA_POR_COMAS.has(propiedad.toLowerCase())
    ? tokensDeValor.map(limpiarTokenDeValor).filter(Boolean).join(', ')
    : valorPlano

  const declaracion = `${propiedad}: ${valor}`
  const conPuntoYComa = /;$/.test(declaracion) ? declaracion : `${declaracion};`
  return agregarNumeralColorFaltante(conPuntoYComa)
}

// Un valor de color hex (ej. #c4161c) puede perder el '#' en el mismo
// accidente de tokenización que rompe el resto del atributo — visto
// en un caso real (Santi, 2026-07-20): "color:" y "c4161c" quedaron
// como dos atributos fantasma separados, sin el '#' en ningún lado.
// Reponerlo es seguro: un valor de EXACTAMENTE 3, 4, 6 u 8 caracteres
// hexadecimales (los únicos largos válidos de un color hex en CSS —
// #RGB, #RGBA, #RRGGBB, #RRGGBBAA) inmediatamente después de una
// propiedad de color, sin ningún '#' puesto ya, no tiene otra
// interpretación razonable en ese lugar — ninguna palabra clave CSS
// real tiene esa forma. Exige que la declaración sea EXACTAMENTE
// "propiedad: valorhex;" (nada más alrededor) para no arriesgarse con
// casos más raros.
const COLOR_HEX_SIN_NUMERAL = /^([a-zA-Z-]*color[a-zA-Z-]*)\s*:\s*([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8});$/i

function agregarNumeralColorFaltante(declaracion) {
  const m = COLOR_HEX_SIN_NUMERAL.exec(declaracion)
  if (!m) return declaracion
  const [, propiedad, hex] = m
  return `${propiedad}: #${hex};`
}

// Reconstruye una lista de declaraciones CSS a partir de los nombres
// de los atributos fantasma (en orden), reconstruyendo los ';' entre
// declaraciones por LÍMITE REAL en vez de asumir que sobrevivieron en
// el texto — un nombre que termina en ':' (ej. "color:") es siempre
// el arranque de una declaración nueva, sin importar si el fragmento
// original tenía o no un ';' antes (a veces sobrevive pegado al token
// anterior, como "block;", a veces no queda ninguno, como en el bug
// real de Santi sin ancla — "display: block color: c4161c", sin
// ningún ';' en ningún token). Cada vez que aparece ese arranque, se
// cierra la declaración que se venía acumulando y arranca una nueva
// — así el resultado siempre queda bien separado, tenga o no el
// original algún ';' sobreviviente.
//
// Los tokens de VALOR de cada declaración se acumulan en un array (no
// un string ya unido) hasta el momento de cerrarla — es lo que le
// permite a cerrarDeclaracion elegir el separador correcto según la
// propiedad (comas para font-family, espacios para el resto) en vez
// de asumir espacios siempre y tratar de arreglarlo después.
//
// prefijo es el valor de un style YA EXISTENTE y truncado que
// precede a la corrida (ej. "font-family: "), o '' si no hay ninguno
// — ver buscarCorridaFantasma sobre cuándo hay uno. El prefijo puede
// traer VARIAS declaraciones completas antes de la truncada (caso más
// común en la vida real: style='font-size: 17px; color: #333333;
// font-family: 'X'...' — el corte cae recién en la tipografía, todo
// lo anterior sobrevivió intacto). Las declaraciones COMPLETAS
// (todo hasta el último ';') pasan tal cual, byte a byte — son CSS
// original sano, no hay nada que reconstruir ahí. Solo la COLA sin
// cerrar (lo que queda después del último ';', ej. "font-family: ")
// es la declaración truncada por el accidente: su propiedad es la de
// la primera declaración a reconstruir. Parsear el prefijo entero
// con un regex de UNA propiedad (como se hacía antes) rompía
// exactamente este caso: capturaba la PRIMERA propiedad del prefijo
// (ej. font-size) como la "activa", metía el resto como un token de
// valor, y la regla de comas de font-family nunca se enteraba de que
// la declaración final era suya — el resultado unía la lista de
// tipografías con espacios (CSS inválido) y encima validaba como
// confiable.
function reconstruirDeclaraciones(prefijo, nombresFantasma) {
  const declaraciones = []
  const prefijoTrim = prefijo.trim()
  const idxUltimoPuntoYComa = prefijoTrim.lastIndexOf(';')
  const declaracionesCompletas = idxUltimoPuntoYComa === -1 ? '' : prefijoTrim.slice(0, idxUltimoPuntoYComa + 1).trim()
  const colaTruncada = prefijoTrim.slice(idxUltimoPuntoYComa + 1).trim()
  if (declaracionesCompletas) declaraciones.push(declaracionesCompletas)

  const matchCola = /^([a-zA-Z-]+):\s*(.*)$/.exec(colaTruncada)
  let propiedadActual = matchCola ? matchCola[1] : null
  let tokensActual = matchCola
    ? (matchCola[2] ? [matchCola[2]] : [])
    : (colaTruncada ? [colaTruncada] : [])

  nombresFantasma.forEach(nombre => {
    if (/:$/.test(nombre)) {
      // Arranca una declaración nueva — cierra la que se venía
      // acumulando, si tenía propiedad o contenido.
      if (propiedadActual || tokensActual.length > 0) {
        declaraciones.push(cerrarDeclaracion(propiedadActual, tokensActual))
      }
      propiedadActual = nombre.slice(0, -1)
      tokensActual = []
    } else {
      tokensActual.push(nombre)
    }
  })
  if (propiedadActual || tokensActual.length > 0) {
    declaraciones.push(cerrarDeclaracion(propiedadActual, tokensActual))
  }
  return declaraciones.join(' ').trim()
}

// Analiza si el texto reconstruido tiene forma de lista de
// declaraciones CSS razonable ("propiedad: valor;" repetido).
// Devuelve { confiable, declaracionesInvalidas } en vez de un simple
// boolean — cuando no es confiable, declaracionesInvalidas trae el
// texto de la o las declaraciones puntuales que no matchean, para
// poder explicar en el aviso QUÉ parte no se pudo reconstruir en vez
// de un mensaje genérico (ver caso real: 5 de 6 declaraciones
// reconstruyen perfecto, solo la primera — un valor de tipografía sin
// que "font-family:" haya sobrevivido en ningún lado — no tiene forma
// válida; el mensaje ahora dice exactamente eso en vez de descartar
// todo en silencio).
//
// Validación de SALIDA en vez de tratar de anticipar por nombre cada
// propiedad CSS que pueda tener caracteres raros adentro (url(),
// filter:progid:..., etc.) — enumerar casos conflictivos por nombre
// de propiedad siempre queda corto: esto los cubre todos de una sola
// vez, evaluando el resultado en vez de la propiedad.
function analizarDeclaraciones(valor) {
  const limpio = valor.trim().replace(/;$/, '')
  if (!limpio) return { confiable: false, declaracionesInvalidas: [] }
  // Paréntesis desbalanceados = casi siempre una función CSS
  // (gradient(...), url(...), progid:...) que quedó cortada a mitad
  // de camino por el mismo accidente de tokenización que rompió el
  // resto del tag — señal estructural de "no confiar en esto", sin
  // necesidad de conocer de antemano cada función CSS problemática
  // por nombre. Acá no hay una declaración puntual que señalar (el
  // problema es global, de paréntesis), así que no se reportan
  // declaracionesInvalidas en este caso.
  const abiertos = (limpio.match(/\(/g) || []).length
  const cerrados = (limpio.match(/\)/g) || []).length
  if (abiertos !== cerrados) return { confiable: false, declaracionesInvalidas: [] }

  const declaraciones = limpio.split(';').map(d => d.trim()).filter(Boolean)
  const declaracionesInvalidas = declaraciones.filter(d => !/^[a-zA-Z-]+\s*:\s*\S.*$/.test(d))
  // Una comilla doble en el resultado haría estallar la interpolación
  // final (tagReconstruido lo envuelve en style="...") — el atributo
  // se cortaría justo ahí y el "fix" dejaría el tag MÁS roto que
  // antes. Los tokens fantasma ya vienen sin comillas (ver
  // sacarComillasSueltas), así que esto solo puede venir del prefijo
  // del ancla (las declaraciones completas originales, que pasan byte
  // a byte — ej. un url("...") legítimo, o restos de entidades raras).
  // Declinar es la salida segura y consistente con el diseño: nunca
  // ofrecer aplicar algo que no se puede garantizar sano.
  if (limpio.includes('"')) return { confiable: false, declaracionesInvalidas }
  return { confiable: declaracionesInvalidas.length === 0, declaracionesInvalidas }
}

// Busca la corrida de atributos fantasma a reconstruir, con o sin un
// style truncado como ancla. Devuelve null si no hay nada que
// reconstruir, o { prefijo, fantasmas, inicioOffset } donde fantasmas
// es el array de atributos (con sus offsets) a reemplazar.
//
// Caso A — CON ancla: hay un 'style' cuyo valor termina en una
// propiedad CSS sin cerrar (ej. "font-family: ") inmediatamente
// seguido de atributos desconocidos.
//
// Caso B — SIN ancla: no hace falta que haya sobrevivido NINGÚN
// fragmento de style para reconstruir — si aparece una corrida de
// atributos desconocidos en cualquier parte del tag, y al menos uno
// de esos nombres termina en ':' (la señal de que es CSS, no un
// atributo custom cualquiera), es tan reconstruible como el caso A.
// Es el caso real reportado por Santi: display:="" block=""
// color:="" c4161c="" sin ningún style= previo en absoluto — un
// "display:"/"color:" suelto solo puede venir de un style que perdió
// el wrapper directamente, no hace falta ver ningún pedacito de
// ancla sobreviviente para confiar en eso.
function buscarCorridaFantasma(atributos) {
  // El ancla acepta DOS terminaciones del valor de style:
  //   "propiedad:"   — el corte clásico por comilla interna (caso A
  //                    original).
  //   "propiedad:="  — la variante del patrón de corrupción con `="`
  //                    insertado después de cada `:` (caso real de
  //                    Santi, 2026-07-20: style="padding-left:=" " 20px;"
  //                    ...). El parser deja el `=` colgado DENTRO del
  //                    valor de style — sin reconocerlo acá, el nombre
  //                    de la propiedad (que SÍ sobrevivió, ahí mismo)
  //                    se daba por perdido y su valor ("20px") quedaba
  //                    huérfano e irreconstruible sin necesidad real.
  //                    Un style legítimo nunca termina en "propiedad:="
  //                    (no es CSS válido en ninguna forma), así que no
  //                    hay riesgo de falso positivo. El `=` se recorta
  //                    del prefijo antes de reconstruir.
  const idxStyle = atributos.findIndex(a => a.nombre.toLowerCase() === 'style' && /[a-zA-Z-]+:\s*=?\s*$/.test(a.valor))
  if (idxStyle !== -1) {
    const fantasmas = []
    let idx = idxStyle + 1
    while (idx < atributos.length && !esAtributoHtmlConocido(atributos[idx].nombre)) {
      fantasmas.push(atributos[idx])
      idx++
    }
    if (fantasmas.length > 0) {
      return { prefijo: atributos[idxStyle].valor.replace(/=\s*$/, ''), fantasmas, inicioOffset: atributos[idxStyle].inicio }
    }
    // Ancla sin nada detrás — sigue al caso B por las dudas (no
    // debería pasar en la práctica, pero no cuesta nada cubrirlo).
  }

  let i = 0
  while (i < atributos.length) {
    const nombreLower = atributos[i].nombre.toLowerCase()
    if (esAtributoHtmlConocido(nombreLower) || nombreLower === 'style') { i++; continue }
    const inicioCorrida = i
    while (i < atributos.length && !esAtributoHtmlConocido(atributos[i].nombre)) i++
    const corrida = atributos.slice(inicioCorrida, i)
    const tieneSenalCss = corrida.some(a => /:$/.test(a.nombre))
    if (tieneSenalCss) {
      return { prefijo: '', fantasmas: corrida, inicioOffset: corrida[0].inicio }
    }
    // Corrida sin ningún ':' — probablemente un atributo custom
    // legítimo (ej. data-algo), no CSS perdido; seguir buscando otra
    // corrida más adelante en el mismo tag por las dudas.
  }
  return null
}

// Núcleo: dado UN tag `<...>` completo, intenta reconstruir un style
// roto — con o sin ancla previa (ver buscarCorridaFantasma). Devuelve
// null si no encuentra el patrón (nada que reconstruir — el caller
// sigue mostrando el aviso genérico sin sugerencia), o
// { styleTruncado, styleReconstruido, confiable, fragmentoRoto,
// tagOriginal, tagReconstruido }.
//
// confiable=false significa "encontré el patrón pero el resultado no
// tiene forma de CSS válido, no lo ofrezcas para aplicar" (ver
// analizarDeclaraciones) — el caller igual puede mostrar el
// texto reconstruido a título informativo, pero sin botón de acción.
export function reconstruirStyleRoto(tagHtml) {
  const atributos = tokenizarAtributosDeTag(tagHtml)
  const corrida = buscarCorridaFantasma(atributos)
  if (!corrida) return null

  const { prefijo, fantasmas, inicioOffset } = corrida
  const styleReconstruido = reconstruirDeclaraciones(prefijo, fantasmas.map(f => f.nombre))
  const analisis = analizarDeclaraciones(styleReconstruido)
  const finReemplazo = fantasmas[fantasmas.length - 1].fin

  // Defensa contra el "fix a medias": si FUERA del rango que se va a
  // reemplazar queda algún otro atributo con señal de CSS perdido
  // (nombre terminado en ':'), aplicar la reconstrucción arreglaría
  // solo una parte del tag y dejaría el resto roto en silencio — con
  // el aviso encima marcado como resuelto. En una corrupción real
  // esto no debería pasar (todo el CSS viene de UN style, la corrida
  // es contigua), así que encontrarlo es señal de algo más raro de lo
  // que este módulo sabe reconstruir: se muestra la reconstrucción a
  // título informativo pero sin botón de aplicar, mismo criterio que
  // el resto de los casos no confiables.
  const quedaFantasmaFuera = atributos.some(a =>
    (a.fin <= inicioOffset || a.inicio >= finReemplazo) &&
    !esAtributoHtmlConocido(a.nombre) && /:$/.test(a.nombre)
  )
  const confiable = analisis.confiable && !quedaFantasmaFuera
  const declaracionesInvalidas = analisis.declaracionesInvalidas

  // Rango exacto a reemplazar en el tag original: desde el inicio del
  // atributo 'style' (si había ancla) o del primer atributo fantasma
  // (si no) hasta el fin del último atributo fantasma (finReemplazo,
  // calculado arriba) — TODO lo demás del tag (src, width, height,
  // alt, espaciado, cierre) queda byte a byte igual, nunca se
  // re-serializa.
  // Fragmento roto AISLADO (sin el resto del tag alrededor — src,
  // width, height, alt no cambian y no aportan nada al diff) — pensado
  // para mostrar un "antes" corto y legible en la UI, en vez de volcar
  // el tag entero. tagOriginal/tagReconstruido siguen siendo el tag
  // completo, porque ESOS sí hacen falta enteros para poder aplicar el
  // reemplazo con str_replace sobre el HTML real del bloque.
  const fragmentoRoto = tagHtml.slice(inicioOffset, finReemplazo)
  const tagReconstruido = confiable
    ? tagHtml.slice(0, inicioOffset) + `style="${styleReconstruido}"` + tagHtml.slice(finReemplazo)
    : null

  return {
    styleTruncado: prefijo,
    styleReconstruido,
    confiable,
    declaracionesInvalidas,
    fragmentoRoto,
    tagOriginal: tagHtml,
    tagReconstruido,
  }
}
