// Colores en formato #rrggbb (lo que entienden todos los clientes de mail).

/** Devuelve el color como #rrggbb en minúsculas, o `respaldo` si no es válido. */
export function normalizarColor(valor, respaldo = '#000000') {
  const t = String(valor ?? '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(t)) return t
  if (/^#[0-9a-f]{3}$/.test(t)) return '#' + t.slice(1).split('').map(c => c + c).join('')
  if (/^[0-9a-f]{6}$/.test(t)) return '#' + t
  return respaldo
}

export function esColorValido(valor) {
  const t = String(valor ?? '').trim()
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)
}

/** De #rrggbb a { h: 0-360, s: 0-100, v: 0-100 } (para el selector de color). */
export function hexAHsv(hex) {
  const t = normalizarColor(hex, '#ffffff').slice(1)
  const r = parseInt(t.slice(0, 2), 16) / 255
  const g = parseInt(t.slice(2, 4), 16) / 255
  const b = parseInt(t.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }
  return { h, s: Math.round(max ? (d / max) * 100 : 0), v: Math.round(max * 100) }
}

/** De { h, s, v } a #rrggbb. */
export function hsvAHex({ h, s, v }) {
  const S = Math.min(100, Math.max(0, s)) / 100
  const V = Math.min(100, Math.max(0, v)) / 100
  const H = (((h % 360) + 360) % 360) / 60
  const c = V * S
  const x = c * (1 - Math.abs((H % 2) - 1))
  const m = V - c
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(H) % 6]
  const hex = n => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}
