// Validación de la URL ingresada y armado del nombre del archivo descargado.
//
// Las URLs de icomm llevan en el query string un valor en Base64 con los
// datos de la pieza (cliente, campaña, pieza=ID...). La plataforma reemplaza
// el relleno "=" por "2" (ej: "...Mw2"), así que se decodifica con tolerancia.

import { DOMINIO_PIEZAS } from './config.js'

// Es solo UX: la defensa real contra SSRF vive en api/externo/proxy.js.
export function validarUrl(texto) {
  let t = String(texto ?? '').trim()
  if (!t) return { ok: false, error: 'Pegá la URL de una pieza para analizarla' }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = 'https://' + t
  let u
  try {
    u = new URL(t)
  } catch {
    return { ok: false, error: 'La URL ingresada no es válida' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'La URL ingresada no es válida' }
  const host = u.hostname.toLowerCase()
  // Con punto delante: "evilicommarketing.com" no es un subdominio real.
  if (host !== DOMINIO_PIEZAS && !host.endsWith('.' + DOMINIO_PIEZAS)) {
    return { ok: false, error: `Solo se pueden analizar piezas de ${DOMINIO_PIEZAS}` }
  }
  return { ok: true, url: u.href }
}

function decodificarBase64(valor) {
  const limpio = valor.replace(/-/g, '+').replace(/_/g, '/')
  // Primero las variantes donde el "2" final es el relleno "=" reemplazado
  // por la plataforma; después el valor tal cual vino.
  const variantes = []
  if (/2$/.test(limpio)) {
    const base = limpio.slice(0, -1)
    variantes.push(base, base + '=', base + '==')
  }
  variantes.push(limpio)
  const decodificados = []
  for (const v of variantes) {
    const sinRelleno = v.replace(/=+$/, '')
    if (!/^[A-Za-z0-9+/]+$/.test(sinRelleno)) continue
    try {
      const texto = atob(sinRelleno + '='.repeat((4 - (sinRelleno.length % 4)) % 4))
      if (texto && /^[\x20-\x7e]*$/.test(texto)) decodificados.push(texto)
    } catch { /* probar la siguiente variante */ }
  }
  return decodificados.find(t => /(?:^|&)pieza=\d+/i.test(t)) ?? decodificados.find(t => t.includes('=')) ?? decodificados[0] ?? ''
}

// Texto legible del query string de la pieza (decodificado si venía en Base64).
export function decodificarQuery(search) {
  const q = String(search ?? '').replace(/^\?/, '')
  if (!q) return ''
  const candidatos = [q]
  for (const parte of q.split('&')) {
    const valor = parte.includes('=') ? parte.slice(parte.indexOf('=') + 1) : parte
    if (valor) candidatos.push(valor)
  }
  for (const c of candidatos) {
    let plano = c
    try { plano = decodeURIComponent(c) } catch { /* se deja como vino */ }
    if (/(?:^|[&?;])pieza=\d+/i.test(plano)) return plano
    const dec = decodificarBase64(plano)
    if (dec) return dec
  }
  return ''
}

export function idDePieza(url) {
  try {
    const m = /(?:^|[&?;\s])pieza=(\d+)/i.exec(decodificarQuery(new URL(url).search))
    return m ? m[1] : ''
  } catch {
    return ''
  }
}

// {subdominio}_pieza_{id}.html — o {subdominio}_pieza.html si no hay id.
export function nombreDescarga(url) {
  let sub = 'pieza'
  try {
    const host = new URL(url).hostname.toLowerCase()
    const resto = host.endsWith('.' + DOMINIO_PIEZAS) ? host.slice(0, -(DOMINIO_PIEZAS.length + 1)) : ''
    sub = resto.replace(/[^a-z0-9._-]/g, '-').replace(/\./g, '-') || 'pieza'
  } catch { /* queda 'pieza' */ }
  const id = idDePieza(url)
  return id ? `${sub}_pieza_${id}.html` : `${sub}_pieza.html`
}
