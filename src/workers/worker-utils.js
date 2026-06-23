// Utilidades de lectura/parseo de archivos, compartidas entre
// validator.worker.js y compare.worker.js — antes vivían duplicadas
// (copiadas a mano) en cada worker, con el riesgo real de que un
// cambio en una copia no se reflejara en la otra. Ambos workers se
// crean con { type: 'module' }, así que pueden importar este archivo
// con sintaxis ES Modules normal.

export function decodeLatin1(uint8array) {
  let str = ''
  for (let i = 0; i < uint8array.length; i++) str += String.fromCharCode(uint8array[i])
  return str
}

export function detectEncoding(bytes) {
  const sample = bytes.slice(0, 4096)
  const testUtf8 = new TextDecoder('utf-8').decode(sample)
  return testUtf8.includes('\uFFFD') ? 'latin1' : 'utf8'
}

export function decodeChunk(bytes, encoding) {
  return encoding === 'utf8' ? new TextDecoder('utf-8').decode(bytes) : decodeLatin1(bytes)
}

export function parseCSVLine(line, sep) {
  const result = []
  let current = '', inQuotes = false, i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '"' && !inQuotes && current === '') { inQuotes = true }
    else if (ch === '"' && inQuotes) { if (line[i + 1] === '"') { current += '"'; i++ } else inQuotes = false }
    else if (ch === sep && !inQuotes) { result.push(current); current = '' }
    else { current += ch }
    i++
  }
  result.push(current)
  return result
}

export function detectCol(headers, patterns) {
  return headers.find(h => patterns.some(p => p.test(h))) || null
}

export function normalizeEmail(email) {
  return email.normalize('NFC').toLowerCase().trim()
}
