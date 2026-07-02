// Utilidades genéricas de manipulación de HTML como STRING PURO —
// ver la regla de oro en el README (nunca DOMParser). Todo acá es
// función pura string → string/estructura, sin estado ni React.

// Limpia el HTML del RichEditor: quita divs basura, normaliza spans
export function limpiarHtmlEditor(html) {
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
export function limpiarHtmlExport(html) {
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
export function extraerTdsConBalance(html) {
  const tagRegex = /<td\b[^>]*>|<\/td>/gi
  const celdasCrudas = []
  const pilaInicio = []
  let m
  while ((m = tagRegex.exec(html)) !== null) {
    const tag = m[0].toLowerCase()
    if (tag.startsWith('<td')) {
      pilaInicio.push({ aperturaIdx: m.index, contenidoInicio: m.index + m[0].length })
    } else {
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
export function normalizarNegritas(html) {
  return html.replace(/<strong>/gi, '<span style="font-weight: bold;">').replace(/<\/strong>/gi, '</span>')
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
export function formaDeTags(html) {
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
export function similitudDeForma(formaA, formaB) {
  const max = formaA.map((v, i) => Math.max(v, formaB[i], 1))
  const diffs = formaA.map((v, i) => Math.abs(v - formaB[i]) / max[i])
  return 1 - diffs.reduce((a, b) => a + b, 0) / diffs.length
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
export function quitarWrapperSiEnvuelveTodo(html) {
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


export function validarUrl(url) {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  if (/^mailto:/i.test(url)) return url
  return `https://${url}`
}
