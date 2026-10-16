// Reglas de seguridad del proxy de /analisis (api/externo/proxy.js).
//
// Este endpoint es público y pide URLs que manda el cliente, así que sin
// estas reglas sería un SSRF: alguien podría hacer que ESTE servidor consulte
// redes internas o el endpoint de metadata de la nube (169.254.169.254).
//
// Las reglas viven acá, sin red ni dependencias, para poder testearlas solas.
// La IP se valida en el momento de CONECTAR (ver lookupSeguro en _cliente.js),
// no antes: así un DNS que contesta una IP pública al chequeo y una privada
// al conectar (DNS rebinding) no puede esquivarlas.

import net from 'node:net'

export const DOMINIO_PIEZAS = 'icommarketing.com'

export class ErrorProxy extends Error {
  constructor(codigo) {
    super(codigo)
    this.name = 'ErrorProxy'
    this.codigo = codigo
  }
}

// ── IPs ────────────────────────────────────────────────────────────────

function ipv4ABytes(texto) {
  const partes = texto.split('.')
  if (partes.length !== 4) return null
  const bytes = partes.map(p => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  return bytes.every(n => n >= 0 && n <= 255) ? bytes : null
}

function ipv6ABytes(texto) {
  let t = texto.split('%')[0].toLowerCase()
  // Cola IPv4 embebida (::ffff:1.2.3.4): se pasa a dos grupos hexa
  const m = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(t)
  if (m) {
    const v4 = ipv4ABytes(m[1])
    if (!v4) return null
    t = t.slice(0, m.index) + ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16)
  }
  const dobles = t.split('::')
  if (dobles.length > 2) return null
  const aGrupos = s => (s === '' ? [] : s.split(':'))
  const izq = aGrupos(dobles[0])
  const der = dobles.length === 2 ? aGrupos(dobles[1]) : []
  if (dobles.length === 1 && izq.length !== 8) return null
  const faltan = 8 - izq.length - der.length
  if (faltan < 0 || (dobles.length === 2 && faltan < 1)) return null
  const grupos = [...izq, ...Array(dobles.length === 2 ? faltan : 0).fill('0'), ...der]
  if (grupos.length !== 8) return null
  const bytes = []
  for (const g of grupos) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    const n = parseInt(g, 16)
    bytes.push(n >> 8, n & 0xff)
  }
  return bytes
}

function v4Publica([a, b, c]) {
  if (a === 0 || a === 10 || a === 127) return false
  if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
  if (a === 169 && b === 254) return false // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false
  if (a === 192 && b === 88 && c === 99) return false
  if (a === 192 && b === 168) return false
  if (a === 198 && (b === 18 || b === 19)) return false // benchmarking
  if (a === 198 && b === 51 && c === 100) return false
  if (a === 203 && b === 0 && c === 113) return false
  if (a >= 224) return false // multicast, reservado y broadcast
  return true
}

function v6Publica(b) {
  const ceros = n => b.slice(0, n).every(x => x === 0)
  // IPv4 mapeada (::ffff:a.b.c.d): vale lo que valga la IPv4
  if (ceros(10) && b[10] === 0xff && b[11] === 0xff) return v4Publica(b.slice(12))
  // ::/96 (incluye :: y ::1 y las IPv4-compatibles)
  if (ceros(12)) return false
  // NAT64 (64:ff9b::/96): vale la IPv4 embebida. El de uso local (64:ff9b:1::/48) no.
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) {
    if (b.slice(4, 12).every(x => x === 0)) return v4Publica(b.slice(12))
    return false
  }
  // Solo unicast global (2000::/3); el resto (fc00::/7, fe80::/10, ff00::/8...) afuera
  if ((b[0] & 0xe0) !== 0x20) return false
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) return false // Teredo
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return false // documentación
  if (b[0] === 0x20 && b[1] === 0x02) return v4Publica(b.slice(2, 6)) // 6to4: IPv4 embebida
  return true
}

export function esIpPublica(ip) {
  const tipo = net.isIP(ip)
  if (tipo === 4) {
    const bytes = ipv4ABytes(ip)
    return bytes ? v4Publica(bytes) : false
  }
  if (tipo === 6) {
    const bytes = ipv6ABytes(ip)
    return bytes ? v6Publica(bytes) : false
  }
  return false
}

// ── URLs ───────────────────────────────────────────────────────────────

export function esHostDePiezas(host) {
  const h = String(host).toLowerCase()
  return h === DOMINIO_PIEZAS || h.endsWith('.' + DOMINIO_PIEZAS)
}

// Devuelve la URL ya parseada o lanza ErrorProxy. `soloPiezas` limita el host
// a icommarketing.com y sus subdominios (modo HTML).
export function validarDestino(texto, { soloPiezas = false, validarIp = esIpPublica, cualquierPuerto = false } = {}) {
  let u
  try {
    u = new URL(String(texto))
  } catch {
    throw new ErrorProxy('url_invalida')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ErrorProxy('url_invalida')
  if (u.username || u.password) throw new ErrorProxy('url_invalida')
  if (!cualquierPuerto && u.port && u.port !== '80' && u.port !== '443') throw new ErrorProxy('url_invalida')

  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host) throw new ErrorProxy('url_invalida')

  if (net.isIP(host)) {
    // Una IP literal no pasa por la resolución de DNS, así que se valida acá.
    if (soloPiezas) throw new ErrorProxy('dominio_no_permitido')
    if (!validarIp(host)) throw new ErrorProxy('dominio_no_permitido')
  } else if (soloPiezas && !esHostDePiezas(host)) {
    throw new ErrorProxy('dominio_no_permitido')
  }
  return u
}
