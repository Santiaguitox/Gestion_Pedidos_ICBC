// Formato y medidas de una imagen a partir de los primeros bytes del archivo.
//
// El formato se detecta por la FIRMA del archivo, nunca por content-type ni
// extensión (un PNG renombrado a .jpg es un caso real). Cada parser lee solo
// posiciones que la especificación del formato garantiza.

export function detectarFormato(b) {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  return null
}

// JPEG: se caminan los segmentos saltando cada payload por su longitud hasta
// un SOF. Buscar "FF C0" a ciegas da falsos positivos dentro de EXIF/ICC.
function dimensionesJpeg(b) {
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null
    let marker = b[i + 1]
    while (marker === 0xff && i + 2 < b.length) { i++; marker = b[i + 1] }
    i += 2
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (marker === 0xd9 || marker === 0xda) return null
    if (i + 1 >= b.length) return null
    const len = (b[i] << 8) | b[i + 1]
    if (len < 2) return null
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 6 >= b.length) return null
      return { height: (b[i + 3] << 8) | b[i + 4], width: (b[i + 5] << 8) | b[i + 6] }
    }
    i += len
  }
  return null
}

function dimensionesPng(b) {
  if (b.length < 24) return null
  return {
    width: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0,
    height: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0,
  }
}

function dimensionesGif(b) {
  if (b.length < 10) return null
  return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) }
}

// WebP: según el sub-formato del primer chunk (VP8 / VP8L / VP8X).
function dimensionesWebp(b) {
  if (b.length < 30) return null
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15])
  if (chunk === 'VP8X') {
    return {
      width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
      height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
    }
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff }
  }
  return null
}

export function medirImagen(bytes) {
  const formato = detectarFormato(bytes)
  let dim = null
  if (formato === 'jpeg') dim = dimensionesJpeg(bytes)
  else if (formato === 'png') dim = dimensionesPng(bytes)
  else if (formato === 'gif') dim = dimensionesGif(bytes)
  else if (formato === 'webp') dim = dimensionesWebp(bytes)
  return { formato, width: dim?.width ?? null, height: dim?.height ?? null }
}
