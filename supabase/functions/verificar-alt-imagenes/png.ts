// ============================================================================
// Relleno de fondo para PNG con transparencia.
//
// Problema: un logo blanco sobre transparente (típico de headers) le llega al
// modelo con el texto blanco sobre fondo claro, o sea invisible, y el modelo
// "no ve" parte del logo. Con el mismo logo sobre fondo oscuro lo lee bien.
//
// Qué hace: si la imagen es un PNG chico con bastante transparencia, la pinta
// sobre un fondo (oscuro si los píxeles visibles son claros, blanco si son
// oscuros) y la devuelve como PNG opaco en base64. En cualquier otro caso
// devuelve null y la imagen se manda por URL como siempre.
//
// Sin librerías: usa DecompressionStream / CompressionStream, que ya trae el
// runtime. Todo está acotado en tamaño, píxeles y tiempo, porque las Edge
// Functions tienen 256 MB de memoria y 2 s de CPU por pedido.
// ============================================================================

const MAX_BYTES_PNG = 300_000        // más pesado que esto: no se descarga (imágenes principales)
const MAX_PIXELES = 1_500_000
const MAX_BYTES_SALIDA = 4_000_000
const TIMEOUT_DESCARGA_MS = 8_000
const UMBRAL_TRANSPARENCIA = 0.05    // % de píxeles con alpha < 250 para considerarla transparente
const FONDO_OSCURO = 43
const FONDO_CLARO = 255
const LUMINANCIA_CLARA = 0.6

const FIRMA_PNG = [137, 80, 78, 71, 13, 10, 26, 10]

export function esUrlPng(src: string): boolean {
  try {
    return new URL(src).pathname.toLowerCase().endsWith('.png')
  } catch {
    return false
  }
}

// Descarga con tope de tamaño. null si no se puede o pesa demasiado.
async function descargar(src: string): Promise<Uint8Array | null> {
  const res = await fetch(src, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_DESCARGA_MS) })
  if (!res.ok || !res.body) return null
  const declarado = Number(res.headers.get('content-length') ?? 0)
  if (declarado > MAX_BYTES_PNG) {
    await res.body.cancel()
    return null
  }
  const reader = res.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_BYTES_PNG) {
      await reader.cancel()
      return null
    }
    partes.push(value)
  }
  const bytes = new Uint8Array(total)
  let pos = 0
  for (const p of partes) { bytes.set(p, pos); pos += p.length }
  return bytes
}

const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0

interface PngCrudo { ancho: number; alto: number; canales: number; idat: Uint8Array }

// Lee solo lo que se soporta: 8 bits, RGBA (tipo 6) o gris+alpha (tipo 4),
// sin entrelazado. Todo lo demás (paleta, RGB, 16 bits) devuelve null.
function leerPng(b: Uint8Array): PngCrudo | null {
  if (b.length < 33 || FIRMA_PNG.some((v, i) => b[i] !== v)) return null
  let pos = 8
  let ancho = 0, alto = 0, canales = 0
  const idats: Uint8Array[] = []
  while (pos + 8 <= b.length) {
    const largo = u32(b, pos)
    const tipo = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7])
    const ini = pos + 8
    if (ini + largo + 4 > b.length) return null
    if (tipo === 'IHDR') {
      if (largo < 13) return null
      ancho = u32(b, ini)
      alto = u32(b, ini + 4)
      const profundidad = b[ini + 8], color = b[ini + 9], entrelazado = b[ini + 12]
      if (profundidad !== 8 || entrelazado !== 0) return null
      if (color === 6) canales = 4
      else if (color === 4) canales = 2
      else return null
    } else if (tipo === 'IDAT') {
      idats.push(b.subarray(ini, ini + largo))
    } else if (tipo === 'IEND') {
      break
    }
    pos = ini + largo + 4
  }
  if (!ancho || !alto || !canales || ancho * alto > MAX_PIXELES || idats.length === 0) return null
  const total = idats.reduce((n, p) => n + p.length, 0)
  const idat = new Uint8Array(total)
  let o = 0
  for (const p of idats) { idat.set(p, o); o += p.length }
  return { ancho, alto, canales, idat }
}

// Descomprime con tope: si el resultado supera lo esperado se aborta (evita
// que un archivo malicioso se expanda sin límite).
async function inflar(datos: Uint8Array, esperado: number): Promise<Uint8Array | null> {
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  const reader = flujo.getReader()
  const salida = new Uint8Array(esperado)
  let pos = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (pos + value.length > esperado) {
      await reader.cancel()
      return null
    }
    salida.set(value, pos)
    pos += value.length
  }
  return pos === esperado ? salida : null
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

// Deshace los filtros de línea del PNG. null si hay un filtro inválido.
function desfiltrar(crudo: Uint8Array, ancho: number, alto: number, canales: number): Uint8Array | null {
  const stride = ancho * canales
  const out = new Uint8Array(stride * alto)
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (stride + 1)]
    const desde = y * (stride + 1) + 1
    const fila = y * stride
    for (let x = 0; x < stride; x++) {
      const raw = crudo[desde + x]
      const a = x >= canales ? out[fila + x - canales] : 0
      const arriba = y > 0 ? out[fila - stride + x] : 0
      const c = x >= canales && y > 0 ? out[fila - stride + x - canales] : 0
      let v: number
      switch (filtro) {
        case 0: v = raw; break
        case 1: v = raw + a; break
        case 2: v = raw + arriba; break
        case 3: v = raw + ((a + arriba) >> 1); break
        case 4: v = raw + paeth(a, arriba, c); break
        default: return null
      }
      out[fila + x] = v & 255
    }
  }
  return out
}

// Pinta la imagen sobre el fondo elegido. null si no es lo bastante
// transparente como para necesitarlo.
function aplanar(px: Uint8Array, ancho: number, alto: number, canales: number): { rgb: Uint8Array } | null {
  const n = ancho * alto
  let transparentes = 0, visibles = 0, sumaLuminancia = 0
  for (let i = 0; i < n; i++) {
    const o = i * canales
    const alpha = px[o + canales - 1]
    if (alpha < 250) transparentes++
    if (alpha >= 128) {
      const lum = canales === 4
        ? 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]
        : px[o]
      sumaLuminancia += lum / 255
      visibles++
    }
  }
  if (transparentes / n < UMBRAL_TRANSPARENCIA) return null

  const luminanciaMedia = visibles > 0 ? sumaLuminancia / visibles : 0.5
  const fondo = luminanciaMedia > LUMINANCIA_CLARA ? FONDO_OSCURO : FONDO_CLARO

  const rgb = new Uint8Array(n * 3)
  for (let i = 0; i < n; i++) {
    const o = i * canales
    const alpha = px[o + canales - 1]
    const r = px[o]
    const g = canales === 4 ? px[o + 1] : px[o]
    const b = canales === 4 ? px[o + 2] : px[o]
    rgb[i * 3] = Math.round((r * alpha + fondo * (255 - alpha)) / 255)
    rgb[i * 3 + 1] = Math.round((g * alpha + fondo * (255 - alpha)) / 255)
    rgb[i * 3 + 2] = Math.round((b * alpha + fondo * (255 - alpha)) / 255)
  }
  return { rgb }
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo: string, datos: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + datos.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, datos.length)
  for (let i = 0; i < 4; i++) out[4 + i] = tipo.charCodeAt(i)
  out.set(datos, 8)
  dv.setUint32(8 + datos.length, crc32(out.subarray(4, 8 + datos.length)))
  return out
}

async function codificarPngRgb(rgb: Uint8Array, ancho: number, alto: number): Promise<Uint8Array> {
  const stride = ancho * 3
  const filas = new Uint8Array((stride + 1) * alto) // filtro 0 en cada fila
  for (let y = 0; y < alto; y++) filas.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)

  const comprimido = new Uint8Array(await new Response(new Blob([filas]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer())
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, ancho)
  dv.setUint32(4, alto)
  ihdr[8] = 8  // profundidad
  ihdr[9] = 2  // RGB
  const partes = [new Uint8Array(FIRMA_PNG), chunk('IHDR', ihdr), chunk('IDAT', comprimido), chunk('IEND', new Uint8Array(0))]
  const total = partes.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of partes) { out.set(p, pos); pos += p.length }
  return out
}

function aBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

// Punto de entrada. Devuelve el PNG rellenado en base64, o null si la imagen
// no lo necesita (o no se puede procesar): en ese caso se manda por URL.
export async function prepararPngTransparente(src: string): Promise<string | null> {
  if (!esUrlPng(src)) return null
  const bytes = await descargar(src)
  if (!bytes) return null
  const png = leerPng(bytes)
  if (!png) return null
  const crudo = await inflar(png.idat, (png.ancho * png.canales + 1) * png.alto)
  if (!crudo) return null
  const px = desfiltrar(crudo, png.ancho, png.alto, png.canales)
  if (!px) return null
  const plano = aplanar(px, png.ancho, png.alto, png.canales)
  if (!plano) return null
  const salida = await codificarPngRgb(plano.rgb, png.ancho, png.alto)
  if (salida.length > MAX_BYTES_SALIDA) return null
  return aBase64(salida)
}
