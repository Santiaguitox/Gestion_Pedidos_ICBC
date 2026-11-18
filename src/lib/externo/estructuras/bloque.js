// Diseñador de bloque: arma el <tr> del campo tipo tabla a partir de una
// configuración (márgenes, columnas, colores, bordes, fuentes, imágenes).
//
// Todo son funciones puras (string / objeto adentro, string / objeto afuera):
// la pantalla solo las llama y muestra el resultado.

import {
  ALINEACIONES,
  ANCHO_PIEZA,
  ANCHO_TABLA_MIN,
  CAMPO_POR_DEFECTO,
  DOBLE_MIN,
  ESTILOS_BORDE,
  FUENTES,
  MARGEN_MAX,
  MAX_COLUMNAS,
} from './constantes.js'
import { esColorValido, normalizarColor } from './color.js'
import { escaparHtml, limpiarHtmlCelda } from './html.js'
import { altDeColumna, construirImg, validarUrlImagen } from './imagen.js'
import { validarNombre } from './nombre.js'

let contador = 0
export function idColumna() {
  contador += 1
  return `col${contador}`
}

export function columnaNueva(n = 1) {
  return {
    id: idColumna(),
    titulo: `Columna ${n}`,
    ancho: 20,
    alineacion: 'center',
    padding: 8,
    fondo: '',
    negrita: false,
    tipo: 'texto',
    imagen: { ancho: 90, alt: '' },
    // Opcionales: vacío = usa el valor general del encabezado / de las filas
    sinTitulo: false,
    encabezadoFondo: '',
    encabezadoColor: '',
    tamano: '',
    interlineado: '',
    color: '',
  }
}

/** Diseño de partida: una tabla de productos (imagen, descripción, cantidad, precio). */
export function configInicial() {
  return {
    nombreCampo: CAMPO_POR_DEFECTO,
    margen: 30,
    fondoContenedor: '#ffffff',
    fuente: 'tahoma',
    encabezado: {
      fondo: '#e1f8fb',
      color: '#333333',
      tamano: 14,
      interlineado: 16,
      negrita: false,
      // 'columna' = igual que la alineación de cada columna; o 'left' / 'center' / 'right' para todas
      alineacion: 'columna',
      alto: '',
      paddingV: 6,
      bordes: { arriba: false, abajo: false, izquierda: false, derecha: false, divisores: true },
      borde: { ancho: 2, color: '#ffffff', estilo: 'solid' },
    },
    cuerpo: {
      fondo: '',
      color: '#333333',
      tamano: 14,
      interlineado: 16,
      alto: '',
      bordes: { izquierda: false, derecha: false, divisores: false },
      borde: { ancho: 1, color: '#c0c0c0', estilo: 'solid' },
      separacion: { tipo: 'linea', ancho: 1, color: '#c0c0c0', estilo: 'solid' },
    },
    columnas: [
      { ...columnaNueva(1), titulo: 'Producto', ancho: 20, padding: 5, fondo: '#f3f4f6', tipo: 'imagen', imagen: { ancho: 90, alt: 'Producto' } },
      { ...columnaNueva(2), titulo: 'Descripción', ancho: 40, alineacion: 'left', padding: 10 },
      { ...columnaNueva(3), titulo: 'Cantidad', ancho: 15 },
      { ...columnaNueva(4), titulo: 'Precio', ancho: 25, negrita: true },
    ],
  }
}

export function pilaDeFuente(id) {
  return (FUENTES.find(f => f.id === id) ?? FUENTES[0]).pila
}

export function anchoTabla(config) {
  return ANCHO_PIEZA - 2 * (Number(config.margen) || 0)
}

export function anchoColumnaPx(config, columna) {
  return Math.floor((anchoTabla(config) * (Number(columna.ancho) || 0)) / 100)
}

/** Ancho máximo de imagen que entra en la columna (descontando el padding de los dos lados). */
export function maxAnchoImagen(config, columna) {
  return Math.max(0, anchoColumnaPx(config, columna) - 2 * (Number(columna.padding) || 0))
}

/** Reparte 100% entre n columnas; la diferencia se la lleva la primera. */
export function repartirAnchos(n) {
  if (n < 1) return []
  const base = Math.floor(100 / n)
  const resto = 100 - base * n
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + resto : base))
}

/**
 * Escala una lista de anchos (%) para que sumen `objetivo`, respetando las proporciones y
 * un mínimo de 5 por columna. Si no se puede, los reparte parejo.
 */
export function escalarAnchos(anchos, objetivo = 100) {
  const suma = anchos.reduce((t, a) => t + (Number(a) || 0), 0)
  if (!anchos.length) return []
  if (!suma) return repartirAnchos(anchos.length).map(a => Math.round((a * objetivo) / 100))
  const crudo = anchos.map(a => ((Number(a) || 0) * objetivo) / suma)
  const base = crudo.map(Math.floor)
  let resto = objetivo - base.reduce((t, a) => t + a, 0)
  const orden = crudo.map((c, i) => ({ i, f: c - Math.floor(c) })).sort((x, y) => y.f - x.f)
  for (const { i } of orden) {
    if (resto <= 0) break
    base[i] += 1
    resto -= 1
  }
  return base.some(a => a < 5) ? repartirAnchos(anchos.length) : base
}

const num = (v, min, max, resp) => {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return resp
  return Math.min(max, Math.max(min, n))
}

// Valor opcional: vacío => null (se usa el general / no se escribe el atributo)
const opc = (v, min, max) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null
}
const o = (v, general) => (v === '' || v === null || v === undefined ? general : v)

function alin(a) {
  return ALINEACIONES.includes(a) ? a : 'center'
}

function bordeCss(lado, { ancho, color, estilo }) {
  const tipo = ESTILOS_BORDE.some(e => e.valor === estilo) ? estilo : 'solid'
  return `border-${lado}: ${tipo} ${num(ancho, 0, 20, 1)}px ${normalizarColor(color, '#c0c0c0')};`
}

// Bordes de una celda según su posición (columna i de n). "izquierda" y "derecha"
// son los del borde exterior de la tabla; "divisores" son las líneas entre columnas.
function bordesDeCelda(bordes, borde, i, n, extra = []) {
  const css = []
  if (bordes.arriba) css.push(bordeCss('top', borde))
  if (bordes.abajo) css.push(bordeCss('bottom', borde))
  if ((i === 0 && bordes.izquierda) || (i > 0 && bordes.divisores)) css.push(bordeCss('left', borde))
  if (i === n - 1 && bordes.derecha) css.push(bordeCss('right', borde))
  return css.concat(extra)
}

function celdaEncabezado(config, col, i, n, vista, fila0) {
  const e = config.encabezado
  const w = num(col.ancho, 1, 100, 25)
  const a = ALINEACIONES.includes(e.alineacion) ? e.alineacion : alin(col.alineacion)
  const bg = normalizarColor(o(col.encabezadoFondo, e.fondo), '#e1f8fb')
  const colorTexto = normalizarColor(o(col.encabezadoColor, e.color), '#333333')
  const bold = e.negrita ? 'bold' : 'normal'
  const alto = opc(e.alto, 10, 200)
  const vacio = col.sinTitulo || !String(col.titulo ?? '').trim()
  const estilo = [
    'vertical-align: middle;',
    `width: ${w}%;`,
    `text-align: ${a};`,
    `font-family: ${pilaDeFuente(config.fuente)};`,
    `font-size: ${num(e.tamano, 8, 40, 14)}px;`,
    `font-weight: ${bold};`,
    `line-height: ${num(e.interlineado, 8, 60, 16)}px;`,
    `color: ${colorTexto};`,
    `padding: ${num(e.paddingV, 0, 40, 6)}px ${num(col.padding, 0, 60, 8)}px;`,
    `background-color: ${bg};`,
    ...bordesDeCelda(e.bordes, e.borde, i, n),
  ].join(' ')
  const marca = vista ? ` data-f="${fila0}" data-c="${i}"` : ''
  return `<td${marca} style="${estilo}"${alto ? ` height="${alto}"` : ''} width="${w}%" valign="middle" align="${a}" bgcolor="${bg}">${vacio ? '&nbsp;' : escaparHtml(col.titulo)}</td>`
}

function celdaCuerpo(config, col, i, n, contenido, vista, fila) {
  const c = config.cuerpo
  const w = num(col.ancho, 1, 100, 25)
  const a = alin(col.alineacion)
  const bgRaw = col.fondo || c.fondo
  const bg = bgRaw ? normalizarColor(bgRaw, '#ffffff') : ''
  const sep = c.separacion
  const extra = []
  // El espacio entre filas siempre es un borde sólido del color del fondo: es lo único que respetan todos los clientes
  if (sep.tipo === 'linea') extra.push(bordeCss('bottom', { ancho: sep.ancho, color: sep.color, estilo: sep.estilo }))
  if (sep.tipo === 'espacio') extra.push(bordeCss('bottom', { ancho: sep.ancho, color: sep.color, estilo: 'solid' }))
  const estilo = [
    'vertical-align: middle;',
    `width: ${w}%;`,
    `text-align: ${a};`,
    `font-family: ${pilaDeFuente(config.fuente)};`,
    `font-size: ${num(o(col.tamano, c.tamano), 8, 40, 14)}px;`,
    `font-weight: ${col.negrita ? 'bold' : 'normal'};`,
    `line-height: ${num(o(col.interlineado, c.interlineado), 8, 60, 16)}px;`,
    `color: ${normalizarColor(o(col.color, c.color), '#333333')};`,
    `padding: ${num(col.padding, 0, 60, 8)}px;`,
    bg ? `background-color: ${bg};` : '',
    ...bordesDeCelda({ ...c.bordes, arriba: false, abajo: false }, c.borde, i, n, extra),
  ].filter(Boolean).join(' ')
  const marca = vista ? ` data-f="${fila}" data-c="${i}"` : ''
  const bgAttr = bg ? ` bgcolor="${bg}"` : ''
  const alto = opc(c.alto, 10, 300)
  return `<td${marca} style="${estilo}"${alto ? ` height="${alto}"` : ''} width="${w}%" valign="middle" align="${a}"${bgAttr}>${contenido}</td>`
}

function contenidoCelda(config, col, valor, relleno) {
  if (valor === undefined || valor === null || valor === '') return relleno ? '&nbsp;' : ''
  if (col.tipo === 'imagen') {
    const img = construirImg({ url: valor, ancho: col.imagen?.ancho, alt: altDeColumna(col), alineacion: col.alineacion, vista: relleno })
    return img || (relleno ? '&nbsp;' : '')
  }
  // Si la celda trae HTML (p. ej. una base cargada con etiquetas) se muestra interpretado, ya limpio; si no, como texto.
  return /<\/?[a-z][\s\S]*>/i.test(String(valor)) ? limpiarHtmlCelda(valor) : escaparHtml(valor)
}

const I = n => ' '.repeat(n)

/**
 * La tabla interna (encabezado + filas). En modo "plantilla" lleva el encabezado y
 * UNA fila modelo con las celdas vacías (lo que carga la plataforma); en modo
 * "ejemplo" lleva las filas de `filas` completas (se usa en la vista previa).
 */
export function construirTabla(config, { modo = 'plantilla', filas = [], vista = false, relleno = false, sangria = 0 } = {}) {
  const cols = config.columnas
  const n = cols.length
  const T = anchoTabla(config)
  const s = sangria
  const head = cols.map((c, i) => `${I(s + 8)}${celdaEncabezado(config, c, i, n, vista, 0)}`).join('\n')
  const filasHtml = modo === 'ejemplo' && filas.length
    ? filas
    : [cols.map(() => '')]
  const cuerpo = filasHtml.map((fila, r) => {
    const celdas = cols.map((c, i) => `${I(s + 8)}${celdaCuerpo(config, c, i, n, contenidoCelda(config, c, fila[i], relleno), vista, r + 1)}`).join('\n')
    return `${I(s + 6)}<tr>\n${celdas}\n${I(s + 6)}</tr>`
  }).join('\n')
  return [
    `${I(s)}<table style="width: ${T}px;" width="${T}" cellspacing="0" cellpadding="0" border="0">`,
    `${I(s + 2)}<tbody>`,
    `${I(s + 4)}<tr>`,
    head,
    `${I(s + 4)}</tr>`,
    cuerpo,
    `${I(s + 2)}</tbody>`,
    `${I(s)}</table>`,
  ].join('\n')
}

function tdMargen(m) {
  return `<td style="width: ${m}px; font-size: 0;" width="${m}">&nbsp;</td>`
}

/**
 * El bloque completo: un único <tr> con los márgenes laterales, la tabla del
 * campo tipo tabla entre sus marcadores y nada más (el resto de la pieza lo suma
 * quien lo use).
 */
export function generarBloque(config, { modo = 'plantilla', filas = [], vista = false, relleno = false, extraAbajo = '' } = {}) {
  const nombre = config.nombreCampo || CAMPO_POR_DEFECTO
  const m = num(config.margen, 0, MARGEN_MAX, 30)
  const T = anchoTabla({ ...config, margen: m })
  const bg = normalizarColor(config.fondoContenedor, '#ffffff')
  const tabla = construirTabla({ ...config, margen: m }, { modo, filas, vista, relleno, sangria: 40 })
  const lineas = [
    '<tr>',
    `    <td style="font-size: 0px; margin: 0; background-color: ${bg};" valign="top" bgcolor="${bg}" align="center">`,
    '        <table style="width: 100%;" cellspacing="0" cellpadding="0" border="0">',
    '            <tbody>',
    '                <tr>',
    m > 0 ? `                    ${tdMargen(m)}` : '',
    `                    <td style="vertical-align: middle; color: #333333; font-size: 15px; text-align: center; font-family: Verdana, Geneva, sans-serif; font-weight: normal; line-height: 18px; width: ${T}px;" width="${T}" valign="middle">`,
    '                        <table style="width: 100%;" cellspacing="0" cellpadding="0" border="0">',
    '                            <tbody>',
    '                                <tr>',
    '                                    <td style="vertical-align: middle; color: #323232; font-size: 16px; text-align: center; font-family: Arial, Verdana, Geneva, sans-serif; font-weight: normal; line-height: 22px;" valign="middle">',
    // En la vista previa de "resultado" el marcador no se muestra: la plataforma lo reemplaza por la tabla
    `                                        <!--CampoTabla_${nombre}-->${vista && modo === 'ejemplo' ? '' : ` &lt;*${nombre}*&gt;`}`,
    tabla,
    `                                        <!--/CampoTabla_${nombre}-->`,
    '                                    </td>',
    '                                </tr>',
    extraAbajo,
    '                            </tbody>',
    '                        </table>',
    '                    </td>',
    m > 0 ? `                    ${tdMargen(m)}` : '',
    '                </tr>',
    '            </tbody>',
    '        </table>',
    '    </td>',
    '</tr>',
  ]
  return lineas.filter(l => l !== '').join('\n')
}

/** Filas de ejemplo para la vista previa (texto genérico; las columnas de imagen quedan con la imagen de relleno). */
export function filasDeEjemplo(config, cantidad = 3) {
  return Array.from({ length: cantidad }, (_, r) =>
    config.columnas.map((c, i) => (c.tipo === 'imagen' ? '' : `Dato ${r + 1} columna ${i + 1}`))
  )
}

/** Reemplaza el valor de ejemplo de las columnas de imagen vacías para que se vea la imagen de relleno. */
function conImagenesDeRelleno(config, filas) {
  return filas.map(f => config.columnas.map((c, i) => {
    const v = f[i] ?? ''
    return c.tipo === 'imagen' && !String(v).trim() ? 'relleno' : v
  }))
}

/** El <tr> del bloque listo para mostrar en pantalla (marcas de celda, imágenes de relleno). */
export function generarBloqueVista(config, filas, { extraAbajo = '', modo = 'ejemplo' } = {}) {
  const f = conImagenesDeRelleno(config, filas ?? filasDeEjemplo(config))
  return generarBloque(config, { modo, filas: f, vista: true, relleno: true, extraAbajo })
}

/** La pieza de 600px con el bloque y las filas de ejemplo, para mostrar en pantalla. */
export function generarVistaPrevia(config, filas, opciones = {}) {
  const bloque = generarBloqueVista(config, filas, opciones)
  return `<table align="center" border="0" cellpadding="0" cellspacing="0" width="${ANCHO_PIEZA}" style="width: ${ANCHO_PIEZA}px;" bgcolor="${normalizarColor(config.fondoContenedor, '#ffffff')}"><tbody>${bloque}</tbody></table>`
}

/** Avisos y errores del diseño; "error" bloquea la exportación, "aviso" solo informa. */
export function validarConfig(config) {
  const res = []
  // `paso` dice en cuál de los pasos de Implementar se corrige (para marcarlo aunque esté cerrado)
  const err = (campo, mensaje, paso) => res.push({ nivel: 'error', campo, mensaje, paso })
  const avi = (campo, mensaje, paso) => res.push({ nivel: 'aviso', campo, mensaje, paso })

  const nombre = validarNombre(config.nombreCampo)
  if (!nombre.ok) err('nombreCampo', nombre.error, 1)

  const m = Number(config.margen)
  if (!Number.isFinite(m) || m < 0 || m > MARGEN_MAX) err('margen', `El margen debe estar entre 0 y ${MARGEN_MAX} px.`, 1)
  else if (anchoTabla(config) < ANCHO_TABLA_MIN) err('margen', `Con el margen configurado, la tabla queda de ${anchoTabla(config)} px. El ancho mínimo permitido es de ${ANCHO_TABLA_MIN} px.`, 1)

  const cols = config.columnas
  if (!cols.length) err('columnas', 'La tabla debe tener al menos una columna.', 2)
  if (cols.length > MAX_COLUMNAS) err('columnas', `Podés configurar hasta ${MAX_COLUMNAS} columnas.`, 2)

  const suma = cols.reduce((t, c) => t + (Number(c.ancho) || 0), 0)
  if (cols.length && suma !== 100) err('anchos', `Los anchos de las columnas suman ${suma}% y deben sumar 100%.`, 4)

  const vistos = new Map()
  cols.forEach((c, i) => {
    const k = i + 1
    if (!(Number(c.ancho) >= 5)) err(`ancho-${c.id}`, `Columna ${k}: el ancho mínimo permitido es del 5%.`, 4)
    if (!String(c.titulo).trim() && !c.sinTitulo) avi(`titulo-${c.id}`, `Columna ${k}: el encabezado está vacío. Si querés dejarlo así, activá «Dejar encabezado vacío» en el paso 2.`, 2)
    const t = c.sinTitulo ? '' : String(c.titulo).trim().toLowerCase()
    if (t) {
      if (vistos.has(t)) avi(`titulo-${c.id}`, `Las columnas ${vistos.get(t)} y ${k} tienen el mismo encabezado.`, 2)
      else vistos.set(t, k)
    }
    if (c.fondo && !esColorValido(c.fondo)) err(`fondo-${c.id}`, `Columna ${k}: el color de fondo no es válido. Revisá el valor ingresado.`, 4)
    if (c.encabezadoFondo && !esColorValido(c.encabezadoFondo)) err(`encabezado-fondo-${c.id}`, `Columna ${k}: el color de fondo del encabezado no es válido. Revisá el valor ingresado.`, 2)
    if (c.encabezadoColor && !esColorValido(c.encabezadoColor)) err(`encabezado-color-${c.id}`, `Columna ${k}: el color del texto del encabezado no es válido. Revisá el valor ingresado.`, 2)
    if (c.color && !esColorValido(c.color)) err(`color-${c.id}`, `Columna ${k}: el color del texto no es válido. Revisá el valor ingresado.`, 4)
    if (c.tipo === 'imagen') {
      const w = Number(c.imagen?.ancho)
      const max = maxAnchoImagen(config, c)
      if (!Number.isFinite(w) || w < 1) err(`imagen-${c.id}`, `Columna ${k}: configurá el ancho de la imagen.`, 4)
      else if (w > max) err(`imagen-${c.id}`, `Columna ${k}: la imagen tiene un ancho de ${w} px, pero el espacio disponible es de ${max} px. Reducí el ancho de la imagen o aumentá el de la columna.`, 4)
    }
  })

  const colores = [
    ['fondoContenedor', config.fondoContenedor, 'de fondo del bloque', 1],
    ['encabezado', config.encabezado.fondo, 'de fondo del encabezado', 2],
    ['encabezado', config.encabezado.color, 'del texto del encabezado', 2],
    ['cuerpo', config.cuerpo.color, 'del texto de las filas', 3],
    ['borde', config.encabezado.borde.color, 'del borde del encabezado', 2],
    ['borde', config.cuerpo.borde.color, 'del borde de las filas', 3],
    ['separacion', config.cuerpo.separacion.color, 'de la separación entre filas', 3],
  ]
  colores.forEach(([campo, valor, que, paso]) => {
    if (!esColorValido(valor)) err(campo, `El color ${que} no es válido. Revisá el valor ingresado.`, paso)
  })
  if (config.cuerpo.fondo && !esColorValido(config.cuerpo.fondo)) err('cuerpo', 'El color de fondo de las filas no es válido. Revisá el valor ingresado.', 3)

  const e = config.encabezado
  const c = config.cuerpo
  const doble = (donde, paso) => avi('borde-doble', `El borde doble ${donde} necesita un grosor mínimo de ${DOBLE_MIN} px. Con un valor menor se mostrará como una línea común.`, paso)
  if (e.borde.estilo === 'double' && Number(e.borde.ancho) < DOBLE_MIN && Object.values(e.bordes).some(Boolean)) doble('del encabezado', 2)
  if (c.borde.estilo === 'double' && Number(c.borde.ancho) < DOBLE_MIN && Object.values(c.bordes).some(Boolean)) doble('de las filas', 3)
  if (c.separacion.tipo === 'linea' && c.separacion.estilo === 'double' && Number(c.separacion.ancho) < DOBLE_MIN) doble('de la línea entre filas', 3)
  return res
}

export { validarUrlImagen }
