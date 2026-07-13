import dns from 'dns/promises'
import net from 'net'

// ============================================================================
// SEGURIDAD: este endpoint NO requiere autenticación (es una función
// serverless pública de Vercel) y acepta una URL arbitraria del cliente
// para traer su HTML/imágenes — sin las validaciones de abajo, sería un
// SSRF clásico: cualquiera podría usarlo para hacer que ESTE SERVIDOR
// pida URLs internas (localhost, IPs privadas, endpoints de metadata de
// la nube como 169.254.169.254) y devolver esa respuesta, exponiendo
// recursos que normalmente no son alcanzables desde internet.
//
// Defensas aplicadas, en capas (si una falla, las otras igual protegen):
// 1. Allowlist de dominio — ver ALLOWED_HOST_SUFFIXES más abajo.
// 2. Protocolo: solo http/https.
// 3. Resolución de DNS + chequeo de la IP real contra rangos privados —
//    cubre el caso de un dominio público que resuelve a una IP interna.
// 4. Redirects manejados a mano (redirect: 'manual'), re-validando el
//    destino en cada salto — evita que alguien use una URL pública
//    válida que redirija a una IP interna para esquivar el chequeo del
//    paso 3 sobre la URL original.
//
// Riesgo residual conocido (aceptado): entre la resolución DNS del
// paso 3 y el fetch real hay una ventana de tiempo — un atacante que
// CONTROLE el DNS de un dominio permitido podría responder una IP
// pública al chequeo y una privada al fetch (DNS rebinding / TOCTOU).
// Hoy es teórico: la allowlist solo contiene dominios de icomm y el
// CDN propio, cuyos DNS no controla ningún tercero. ⚠️ Si algún día se
// agrega a ALLOWED_HOST_SUFFIXES un dominio operado por un tercero,
// este riesgo pasa a ser real y hay que mitigarlo (p. ej. fetch con
// lookup fijado a la IP ya validada vía un Agent de undici).
// ============================================================================

// Dominio de la plataforma de icomm donde se previsualizan las piezas de
// campañas — todas las URLs reales del proyecto vienen de subdominios de
// este host (ej: icbc-info.icommarketing.com, icbc-avisos-ai.icommarketing.com).
//
// 🔧 SI EN EL FUTURO HACE FALTA OTRO DOMINIO (ej: un nuevo cliente con su
// propia plataforma de preview), agregarlo a este array. No hace falta
// ningún otro cambio en el resto de ESTE archivo — pero sí actualizar
// también la validación equivalente (solo cosmética/UX, no es la defensa
// real) en src/pages/RevisionEmail.jsx, que está duplicada a propósito
// como defensa en profundidad y debe mantenerse sincronizada a mano.
const ALLOWED_HOST_SUFFIXES = ['icommarketing.com']

// Las imágenes de las piezas (logos, banners) se alojan en un CDN de
// CloudFront aparte del dominio de la pieza en sí — modo=imagen del
// proxy las pide desde ahí. A diferencia de icommarketing.com (que
// tiene subdominios variables), este es un distribution ID FIJO y
// conocido (el mismo que valida ValidarDominioImagenes en
// generales.js) — se valida por coincidencia EXACTA, no como sufijo,
// para no abrir la puerta a cualquier distribution de CloudFront de
// cualquier cliente de AWS (cloudfront.net es un dominio compartido
// por millones de sitios, un sufijo genérico ahí sería demasiado
// amplio para una allowlist).
// 🔧 Si se agrega un nuevo CDN de imágenes, agregarlo acá tal cual
// aparece en REVISION_CONFIG.DOMINIO_IMAGENES_APROBADO (src/lib/revision/config.js).
const ALLOWED_HOSTS_EXACTOS = ['d343t93odde9ul.cloudfront.net']

const MAX_REDIRECTS = 3

function hostnameEsPermitido(hostname) {
  if (ALLOWED_HOSTS_EXACTOS.includes(hostname)) return true
  return ALLOWED_HOST_SUFFIXES.some(
    sufijo => hostname === sufijo || hostname.endsWith('.' + sufijo)
  )
}

// Rangos de IP privados/especiales — ver docs de IANA. Cubre loopback,
// redes privadas RFC 1918, y link-local (este último incluye los
// endpoints de metadata de AWS/GCP/Azure en 169.254.169.254).
function ipv4EsPrivada(ip) {
  const partes = ip.split('.').map(Number)
  const [a, b] = partes
  if (a === 127) return true                      // 127.0.0.0/8 loopback
  if (a === 10) return true                        // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true  // 172.16.0.0/12
  if (a === 192 && b === 168) return true           // 192.168.0.0/16
  if (a === 169 && b === 254) return true           // 169.254.0.0/16 (incluye metadata cloud)
  if (a === 0) return true                          // 0.0.0.0/8
  return false
}

function ipv6EsPrivada(ip) {
  const low = ip.toLowerCase()
  if (low === '::1') return true                    // loopback
  if (low.startsWith('fc') || low.startsWith('fd')) return true // fc00::/7 unique local
  if (low.startsWith('fe8') || low.startsWith('fe9') ||
      low.startsWith('fea') || low.startsWith('feb')) return true // fe80::/10 link-local
  return false
}

function ipEsPrivada(ip) {
  return net.isIPv6(ip) ? ipv6EsPrivada(ip) : ipv4EsPrivada(ip)
}

// Valida una URL completa: protocolo, dominio permitido, y que ninguna
// IP a la que resuelve su hostname sea privada/interna. Lanza un Error
// con un mensaje seguro de mostrar si algo no pasa la validación.
async function validarUrlSegura(urlString) {
  let parsed
  try {
    parsed = new URL(urlString)
  } catch {
    throw new Error('URL inválida')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Protocolo no permitido')
  }

  if (!hostnameEsPermitido(parsed.hostname)) {
    throw new Error('Dominio no permitido')
  }

  // Si el hostname ya es una IP literal, se valida directo. Si es un
  // dominio, se resuelve (IPv4 e IPv6) y se valida cada IP resultante —
  // un dominio puede resolver a varias IPs, y todas deben ser seguras.
  if (net.isIP(parsed.hostname)) {
    if (ipEsPrivada(parsed.hostname)) throw new Error('IP no permitida')
  } else {
    const [v4, v6] = await Promise.all([
      dns.resolve4(parsed.hostname).catch(() => []),
      dns.resolve6(parsed.hostname).catch(() => []),
    ])
    const ips = [...v4, ...v6]
    if (ips.length === 0) throw new Error('No se pudo resolver el dominio')
    if (ips.some(ipEsPrivada)) throw new Error('El dominio resuelve a una IP no permitida')
  }

  return parsed
}

// Hace el fetch real, sin seguir redirects automáticamente — si hay un
// redirect, se re-valida el destino completo (las 3 capas de arriba)
// antes de seguirlo, hasta un máximo de saltos.
async function fetchSeguro(urlString, opciones, saltos = 0) {
  if (saltos > MAX_REDIRECTS) throw new Error('Demasiados redirects')

  await validarUrlSegura(urlString)
  const response = await fetch(urlString, { ...opciones, redirect: 'manual' })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location) throw new Error('Redirect sin destino')
    const destino = new URL(location, urlString).toString()
    return fetchSeguro(destino, opciones, saltos + 1)
  }

  return response
}

// ─── Dimensiones de imagen desde los bytes ──────────────────────────
// Parsers mínimos de header por formato. La regla común: leer SOLO
// posiciones que la especificación de cada formato garantiza, jamás
// escanear el archivo buscando patrones de bytes sueltos.

function detectarFormato(bytes) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png'
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif'
  return null
}

// JPEG: caminar los segmentos saltando cada payload por su longitud
// declarada hasta llegar a un SOF. NUNCA escanear linealmente buscando
// FF C0 (la versión anterior de este parser): esa secuencia aparece
// como dato crudo dentro de segmentos EXIF/XMP/ICC/thumbnails de un
// JPEG legítimo — y dentro de cualquier binario que NO sea JPEG — y el
// primer falso positivo se lee como dimensiones basura.
function dimensionesJpeg(bytes) {
  let i = 2 // después del SOI (FF D8)
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xFF) return null // stream corrupto — mejor null que basura
    let marker = bytes[i + 1]
    // Puede haber bytes FF de relleno antes del marker real
    while (marker === 0xFF && i + 2 < bytes.length) { i++; marker = bytes[i + 1] }
    i += 2
    // Markers standalone (sin payload): TEM y RST0-RST7
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue
    // EOI o SOS sin haber visto un SOF: no hay dimensiones que leer
    if (marker === 0xD9 || marker === 0xDA) return null
    if (i + 1 >= bytes.length) return null
    const len = (bytes[i] << 8) | bytes[i + 1]
    if (len < 2) return null
    // SOF0-SOF15, excepto DHT (C4), JPG (C8) y DAC (CC) que comparten
    // el rango C0-CF pero no son Start Of Frame. Cubre baseline (C0),
    // progresivo (C2) y todas las variantes menos comunes.
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      if (i + 6 >= bytes.length) return null
      // Layout del SOF: len(2) precisión(1) alto(2) ancho(2) ...
      return { height: (bytes[i + 3] << 8) | bytes[i + 4], width: (bytes[i + 5] << 8) | bytes[i + 6] }
    }
    i += len // len incluye sus propios 2 bytes
  }
  return null
}

// PNG: la especificación obliga a que IHDR sea el primer chunk después
// de la firma de 8 bytes, así que ancho y alto viven SIEMPRE en los
// offsets 16-23 (big endian). El >>> 0 fuerza unsigned.
function dimensionesPng(bytes) {
  if (bytes.length < 24) return null
  return {
    width: ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0,
    height: ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0,
  }
}

// GIF: ancho y alto del Logical Screen Descriptor, offsets 6-9
// (little endian), fijos para GIF87a y GIF89a.
function dimensionesGif(bytes) {
  if (bytes.length < 10) return null
  return {
    width: bytes[6] | (bytes[7] << 8),
    height: bytes[8] | (bytes[9] << 8),
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { url, modo } = req.query
  if (!url) { res.status(400).json({ error: 'Falta el parámetro url' }); return }

  try {
    if (modo === 'imagen') {
      const response = await fetchSeguro(url, { signal: AbortSignal.timeout(8000) })
      if (!response.ok) { res.status(200).json({ error: 'No se pudo obtener la imagen' }); return }

      const buffer = await response.arrayBuffer()
      const peso = buffer.byteLength
      const bytes = new Uint8Array(buffer)

      // El formato se detecta por la FIRMA del archivo (magic bytes),
      // NUNCA por content-type ni extensión: los servers suelen derivar
      // el content-type de la extensión, y una pieza puede traer (caso
      // real que motivó este fix) un PNG renombrado a .jpg — el
      // content-type mentía "jpeg" y los bytes PNG parseados como JPEG
      // daban dimensiones basura (14521x41510 para una imagen de
      // 1200x850). `formato` viaja en la respuesta para que el
      // validador pueda avisar del mismatch extensión/formato.
      const formato = detectarFormato(bytes)
      let dim = null
      if (formato === 'jpeg') dim = dimensionesJpeg(bytes)
      else if (formato === 'png') dim = dimensionesPng(bytes)
      else if (formato === 'gif') dim = dimensionesGif(bytes)

      res.status(200).json({ peso, width: dim?.width ?? null, height: dim?.height ?? null, formato })
    } else {
      // Modo HTML: obtener el HTML de la URL
      const response = await fetchSeguro(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000)
      })
      if (!response.ok) { res.status(502).json({ error: 'No se pudo obtener el HTML' }); return }
      const html = await response.text()
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.status(200).send(html)
    }
  } catch (err) {
    // Mensaje genérico hacia el cliente — no exponer detalles internos
    // de la validación (qué rango de IP, qué regla falló, etc.), que
    // podrían ayudar a alguien a entender cómo evadirla.
    const mensajesSeguros = ['URL inválida', 'Protocolo no permitido', 'Dominio no permitido', 'IP no permitida', 'No se pudo resolver el dominio', 'El dominio resuelve a una IP no permitida', 'Redirect sin destino', 'Demasiados redirects']
    const mensaje = mensajesSeguros.includes(err.message) ? err.message : 'Error en el proxy'
    res.status(400).json({ error: mensaje })
  }
}
