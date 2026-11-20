// ============================================================================
// Detección de GIF animado.
//
// Al modelo se le manda una sola imagen, y de un GIF animado es el primer
// cuadro. Si el texto aparece en cuadros posteriores, el modelo no lo ve y
// marcaría el alt como incorrecto sin que lo sea. Por eso los GIF animados no
// se mandan a la IA: se avisan como dudosos para revisar a ojo.
//
// Cómo se detecta: un GIF es una secuencia de bloques; cada cuadro es un
// bloque 0x2C (image descriptor). Más de uno = animado. Se recorre la
// estructura de bloques (no se buscan bytes sueltos, porque 0x2C también
// aparece dentro de los datos comprimidos). Sin librerías.
// ============================================================================

const MAX_BYTES_GIF = 5_000_000
const TIMEOUT_DESCARGA_MS = 8_000

export function esUrlGif(src: string): boolean {
  try {
    return new URL(src).pathname.toLowerCase().endsWith('.gif')
  } catch {
    return false
  }
}

async function descargar(src: string): Promise<Uint8Array | null> {
  const res = await fetch(src, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_DESCARGA_MS) })
  if (!res.ok || !res.body) return null
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES_GIF) {
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
    if (total > MAX_BYTES_GIF) {
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

// Cantidad de cuadros, cortando en cuanto se ve el segundo. null si no es un GIF válido.
export function contarCuadrosGif(b: Uint8Array): number | null {
  if (b.length < 13) return null
  const firma = String.fromCharCode(b[0], b[1], b[2], b[3], b[4], b[5])
  if (firma !== 'GIF87a' && firma !== 'GIF89a') return null
  let pos = 13
  if (b[10] & 0x80) pos += 3 * (1 << ((b[10] & 7) + 1)) // tabla de colores global

  // Salta los sub-bloques de datos (cada uno: largo + datos, hasta largo 0).
  const saltarSubBloques = (): boolean => {
    while (pos < b.length) {
      const largo = b[pos++]
      if (largo === 0) return true
      pos += largo
    }
    return false
  }

  let cuadros = 0
  while (pos < b.length) {
    const tipo = b[pos++]
    if (tipo === 0x3b) break // fin del GIF
    if (tipo === 0x21) { // extensión: etiqueta + sub-bloques
      pos++
      if (!saltarSubBloques()) return cuadros || null
    } else if (tipo === 0x2c) { // cuadro
      cuadros++
      if (cuadros > 1) return cuadros
      if (pos + 9 > b.length) return null
      const flags = b[pos + 8]
      pos += 9
      if (flags & 0x80) pos += 3 * (1 << ((flags & 7) + 1)) // tabla de colores local
      pos++ // tamaño mínimo del código LZW
      if (!saltarSubBloques()) return cuadros
    } else {
      return cuadros || null // bloque desconocido: estructura inválida
    }
  }
  return cuadros || null
}

// true = animado, false = estático, null = no se pudo determinar
export async function esGifAnimado(src: string): Promise<boolean | null> {
  const bytes = await descargar(src)
  if (!bytes) return null
  const cuadros = contarCuadrosGif(bytes)
  return cuadros === null ? null : cuadros > 1
}
