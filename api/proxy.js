export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { url, modo } = req.query
  if (!url) { res.status(400).json({ error: 'Falta el parámetro url' }); return }

  try {
    if (modo === 'imagen') {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!response.ok) { res.status(200).json({ error: 'No se pudo obtener la imagen' }); return }

      const buffer = await response.arrayBuffer()
      const peso = buffer.byteLength
      const bytes = new Uint8Array(buffer)

      // Detectar dimensiones desde los bytes del header de la imagen
      let width = null, height = null
      const contentType = response.headers.get('content-type') || ''

      if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        // JPEG: buscar marcador SOF
        for (let i = 0; i < bytes.length - 8; i++) {
          if (bytes[i] === 0xFF && (bytes[i+1] === 0xC0 || bytes[i+1] === 0xC2)) {
            height = (bytes[i+5] << 8) | bytes[i+6]
            width  = (bytes[i+7] << 8) | bytes[i+8]
            break
          }
        }
      } else if (contentType.includes('png')) {
        // PNG: ancho y alto en bytes 16-23
        if (bytes.length > 24) {
          width  = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
          height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
        }
      } else if (contentType.includes('gif')) {
        // GIF: ancho y alto en bytes 6-9 (little endian)
        if (bytes.length > 10) {
          width  = bytes[6] | (bytes[7] << 8)
          height = bytes[8] | (bytes[9] << 8)
        }
      }

      res.status(200).json({ peso, width, height })
    } else {
      // Modo HTML: obtener el HTML de la URL
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000)
      })
      if (!response.ok) { res.status(502).json({ error: 'No se pudo obtener el HTML' }); return }
      const html = await response.text()
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.status(200).send(html)
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error en el proxy' })
  }
}
