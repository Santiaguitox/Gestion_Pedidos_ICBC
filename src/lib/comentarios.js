// Lógica pura de comentarios — sin React ni Supabase, para poder
// testearla con vitest (ver __tests__/comentarios.test.js).
//
// Formato de mención persistido en `contenido`: @[Nombre Apellido](uuid)
//   - el uuid es la verdad (sobrevive a renombres del perfil),
//   - degrada bien: sin parsear se lee igual,
//   - nunca se interpreta como HTML (el render intercala spans de React
//     con texto plano — XSS estructuralmente imposible).

// uuid v4 con guiones — suficiente para tokenizar sin falsos positivos.
const MENCION_REGEX = /@\[([^\]]+)\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g

// ── Detección de URLs pegadas en el texto (imagen o link genérico) ───
//
// No hacemos "unfurl" (no vamos a buscar el <title>/og:image del sitio
// de destino — eso requiere un fetch server-side, con las mismas
// protecciones anti-SSRF que ya tiene api/proxy.js, y queda fuera de
// este alcance). Lo que SÍ hacemos, sin backend nuevo: reconocer que un
// pedazo de texto es una URL y renderizarla como un link prolijo
// (dominio + ícono) en vez de texto muerto, y si además es una imagen
// (termina en una extensión conocida), mostrar la miniatura debajo del
// comentario.
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi
const EXT_IMAGEN_REGEX = /\.(png|jpe?g|gif|webp|avif|svg)(?:[?#].*)?$/i

// Puntuación de cierre de oración pegada al final de la URL ("mirá
// esto: https://x.com/foo.") casi nunca es parte de la URL — se
// recorta para no romper el link ni la miniatura.
function recortarPuntuacionFinal(url) {
  return url.replace(/[.,;:!?]+$/, '')
}

export function esUrlDeImagen(url) {
  return EXT_IMAGEN_REGEX.test(url)
}

// Divide un tramo de texto PLANO (sin menciones — eso ya se resolvió
// en segmentarContenido) en segmentos de texto y de url.
function segmentarUrls(texto) {
  const partes = []
  let ultimo = 0
  for (const m of texto.matchAll(URL_REGEX)) {
    const url = recortarPuntuacionFinal(m[0])
    if (!url) continue
    if (m.index > ultimo) partes.push({ tipo: 'texto', valor: texto.slice(ultimo, m.index) })
    partes.push({ tipo: 'url', valor: url, esImagen: esUrlDeImagen(url) })
    ultimo = m.index + url.length // la puntuación recortada (si la hubo) queda para el próximo segmento de texto
  }
  if (ultimo < texto.length) partes.push({ tipo: 'texto', valor: texto.slice(ultimo) })
  return partes
}

// Extrae las URLs de imagen del contenido, en orden de aparición — es
// lo que arma la fila de miniaturas debajo del comentario (separado
// del link "en línea" que queda dentro del párrafo).
export function extraerUrlsDeImagen(contenido) {
  return segmentarContenido(contenido)
    .filter(s => s.tipo === 'url' && s.esImagen)
    .map(s => s.valor)
}

// ── Mención "amigable" para el composer/edición ──────────────────────
//
// El formato persistido @[Nombre](uuid) es necesario para el storage y
// para segmentarContenido/extraerMenciones, pero mostrárselo crudo al
// usuario MIENTRAS escribe (con el uuid a la vista) es feo y confuso.
// En vez de eso, el textarea de composición muestra solo "@Nombre",
// delimitado por un marcador invisible (U+2060, WORD JOINER — no se
// renderiza, nadie lo tipea por accidente) a cada lado. El uuid NO se
// guarda inline en ese texto: se reconstruye recién al enviar,
// buscando el nombre exacto contra el roster de usuarios actual. Si no
// hay match (alguien escribió "@Nombre" a mano sin elegirlo del popup,
// o el usuario mencionado fue renombrado/eliminado entre que se
// escribió y se envió), degrada a texto plano sin romper nada — nunca
// se manda un token corrupto.
//
// Trade-off aceptado: si dos personas del equipo tuvieran EXACTAMENTE
// el mismo nombre completo, se resuelve a la primera coincidencia del
// roster. Mismo nivel de riesgo que el resto de la app (el selector de
// asignados tampoco desambigua nombres repetidos).
const MARCA = '\u2060'
const MENCION_AMIGABLE_REGEX = new RegExp(MARCA + '@([^' + MARCA + ']+)' + MARCA, 'g')

// Inserta la mención amigable (sin uuid visible) en el texto que el
// usuario está escribiendo. Reemplaza desde `inicio` (el @) hasta el
// cursor, igual que insertarMencion.
export function insertarMencionAmigable(texto, inicio, cursor, usuario) {
  const token = `${MARCA}@${usuario.full_name}${MARCA} `
  const nuevo = texto.slice(0, inicio) + token + texto.slice(cursor)
  return { texto: nuevo, cursor: inicio + token.length }
}

// Convierte el texto amigable (con marcadores) de vuelta al formato
// persistido @[Nombre](uuid), resolviendo contra el roster. Se llama
// justo antes de guardar/enviar — es la única vez que el uuid entra en
// juego para este texto.
export function reconstruirMenciones(textoAmigable, usuarios) {
  return (textoAmigable ?? '').replace(MENCION_AMIGABLE_REGEX, (_match, nombre) => {
    const usuario = usuarios.find(u => u.full_name === nombre)
    return usuario ? `@[${usuario.full_name}](${usuario.id})` : `@${nombre}`
  })
}

// Inversa: dado el contenido YA persistido (con tokens @[Nombre](uuid)),
// arma el texto amigable con marcadores para poder reabrirlo en modo
// edición sin mostrar el uuid crudo.
export function contenidoAFormularioAmigable(contenido) {
  return (contenido ?? '').replace(MENCION_REGEX, (_match, nombre) => `${MARCA}@${nombre}${MARCA}`)
}

// Emojis de reacción rápida — lista curada corta, patrón Slack. La base
// no impone lista cerrada (solo largo), así que ampliar esto NO requiere
// migración; las reacciones viejas con emojis quitados de acá se siguen
// mostrando igual (el render usa el emoji persistido, no esta lista).
export const EMOJIS_REACCION = ['👍', '❤️', '✅', '👀', '🎉', '😂']

// Grid del picker del composer — set chico y laboral, sin categorías ni
// buscador: para eso está el teclado de emojis del sistema operativo.
export const EMOJIS_COMPOSER = [
  '😀', '😂', '😅', '😉', '😍', '🤔', '😬', '😱',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🤝',
  '✅', '❌', '⚠️', '🔥', '🎉', '❤️', '🚀', '☕',
]

// Divide el contenido en segmentos para el render:
//   { tipo: 'texto', valor }
//   { tipo: 'mencion', valor, userId }
//   { tipo: 'url', valor, esImagen }
// donde `valor` de una mención es el nombre tal como se escribió
// (histórico, honesto con el momento del comentario). Las URLs se
// detectan DENTRO de cada tramo de texto plano (nunca dentro de un
// token de mención, que ya se resolvió aparte).
export function segmentarContenido(contenido) {
  const texto = contenido ?? ''
  const segmentos = []
  let ultimo = 0
  for (const m of texto.matchAll(MENCION_REGEX)) {
    if (m.index > ultimo) segmentos.push(...segmentarUrls(texto.slice(ultimo, m.index)))
    segmentos.push({ tipo: 'mencion', valor: m[1], userId: m[2] })
    ultimo = m.index + m[0].length
  }
  if (ultimo < texto.length) segmentos.push(...segmentarUrls(texto.slice(ultimo)))
  return segmentos
}

// Extrae los uuid mencionados, sin duplicados y en orden de aparición.
// Es lo que va a la columna `menciones` — el trigger de notificaciones
// consume el array, no los tokens.
export function extraerMenciones(contenido) {
  const vistos = new Set()
  const ids = []
  for (const m of (contenido ?? '').matchAll(MENCION_REGEX)) {
    if (!vistos.has(m[2])) {
      vistos.add(m[2])
      ids.push(m[2])
    }
  }
  return ids
}

// Normalización para el filtrado del autocomplete: minúsculas y sin
// acentos ("perez" matchea "Pérez").
export function normalizar(s) {
  return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Detecta si el cursor está "adentro" de una mención en curso: busca el
// último '@' antes del cursor que arranque palabra (inicio de texto o
// precedido por espacio/salto) y devuelve { inicio, query } o null.
// La query admite espacios (nombres compuestos) pero se corta ante un
// salto de línea, otro '@', o si se hace demasiado larga (el usuario
// probablemente escribió un '@' suelto y siguió de largo).
export function detectarMencionActiva(texto, cursor) {
  const hasta = (texto ?? '').slice(0, cursor)
  const arroba = hasta.lastIndexOf('@')
  if (arroba === -1) return null
  if (arroba > 0 && !/[\s(]/.test(hasta[arroba - 1])) return null
  const query = hasta.slice(arroba + 1)
  if (query.length > 30) return null
  if (/[\n@\][()]/.test(query)) return null
  return { inicio: arroba, query }
}

// Filtra usuarios para el popup: matchea por prefijo de cualquier
// palabra del nombre ("per" -> "Juan Pérez"), insensible a acentos.
// Query vacía (recién tipeado el '@') muestra la lista completa.
export function filtrarUsuarios(usuarios, query) {
  const q = normalizar(query)
  if (!q) return usuarios
  return usuarios.filter(u =>
    normalizar(u.full_name).split(/\s+/).some(palabra => palabra.startsWith(q))
  )
}

// Construye el token e inserta la mención en el texto, reemplazando
// desde el '@' hasta el cursor. Devuelve { texto, cursor } con la
// posición final del cursor (después del token + un espacio).
export function insertarMencion(texto, inicio, cursor, usuario) {
  const token = `@[${usuario.full_name}](${usuario.id}) `
  const nuevo = texto.slice(0, inicio) + token + texto.slice(cursor)
  return { texto: nuevo, cursor: inicio + token.length }
}

// Agrupa las reacciones de UN comentario para el render:
//   [{ emoji, count, mia, nombres: [...] }]
// en orden de primera aparición (estable: la primera reacción "ancla"
// la posición del emoji, como en Slack). `mia` marca si el usuario
// actual ya reaccionó con ese emoji — es el toggle del click.
export function agruparReacciones(reacciones, myUserId) {
  const porEmoji = new Map()
  for (const r of reacciones ?? []) {
    if (!porEmoji.has(r.emoji)) {
      porEmoji.set(r.emoji, { emoji: r.emoji, count: 0, mia: false, nombres: [] })
    }
    const g = porEmoji.get(r.emoji)
    g.count++
    if (r.user_id === myUserId) g.mia = true
    const nombre = r.profiles?.full_name
    if (nombre) g.nombres.push(nombre)
  }
  return [...porEmoji.values()]
}
