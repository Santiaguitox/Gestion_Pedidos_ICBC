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
