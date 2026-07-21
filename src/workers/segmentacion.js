// Lógica de filtrado del segmentador de bases, extraída de
// segmentar.worker.js para poder testearla (el worker define
// self.onmessage al importarse). Mismo criterio que worker-utils.js
// y validacion.js: el worker queda como cáscara de mensajería + IO
// por chunks, la lógica pura vive acá.

export function detectSep(firstLine) {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  for (const c of firstLine) if (c in counts) counts[c]++
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

export function evaluarCondicion(celda, operador, valor) {
  const c = String(celda ?? '').toLowerCase()
  const v = String(valor ?? '').toLowerCase()
  switch (operador) {
    case 'eq':        return c === v
    case 'neq':       return c !== v
    case 'contains':  return c.includes(v)
    case 'ncontains': return !c.includes(v)
    case 'starts':    return c.startsWith(v)
    case 'empty':     return c.trim() === ''
    case 'nempty':    return c.trim() !== ''
    default:          return true
  }
}

export function pasaFiltro(vals, colIndex, condiciones, esAnd) {
  if (!condiciones.length) return true
  const resultados = condiciones.map(c => {
    const idx = colIndex[c.columna]
    if (idx === undefined) return false
    return evaluarCondicion(vals[idx], c.operador, c.valor)
  })
  return esAnd ? resultados.every(Boolean) : resultados.some(Boolean)
}
