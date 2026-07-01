import { decodeLatin1, detectEncoding, parseCSVLine } from '@/workers/worker-utils'

const CHUNK_SIZE = 2 * 1024 * 1024  // mismo que validator.worker.js
const BLOB_BATCH = 10000             // cada cuántas líneas filtradas se
                                     // vuelca a un Blob parcial para
                                     // no acumular un array enorme en RAM

let storedHeaderLine = ''

self.onmessage = async (e) => {
  if (e.data.type === 'segment') await handleSegment(e.data)
}

function detectSep(firstLine) {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  for (const c of firstLine) if (c in counts) counts[c]++
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function evaluarCondicion(celda, operador, valor) {
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

function pasaFiltro(vals, colIndex, condiciones, esAnd) {
  if (!condiciones.length) return true
  const resultados = condiciones.map(c => {
    const idx = colIndex[c.columna]
    if (idx === undefined) return false
    return evaluarCondicion(vals[idx], c.operador, c.valor)
  })
  return esAnd ? resultados.every(Boolean) : resultados.some(Boolean)
}

async function handleSegment({ file, condiciones, operadorGlobal }) {
  storedHeaderLine = ''

  const esAnd = operadorGlobal !== 'OR'
  let headers = null
  let colIndex = {}
  let sep = ','
  let leftover = ''
  let isFirstChunk = true
  let encoding = null
  let offset = 0
  const fileSize = file.size
  let totalRows = 0
  let matchedRows = 0

  // En vez de acumular todas las líneas filtradas en un array
  // (que para millones de filas agota RAM), las vamos volcando en
  // Blobs parciales de BLOB_BATCH líneas cada uno.
  // Al final concatenamos los Blobs parciales con
  // new Blob([...blobParciales]) — el browser une los buffers sin
  // necesidad de tener el string completo en RAM de una sola vez.
  const blobParciales = []
  let pendientes = [] // líneas crudas aún no volcadas a Blob
  let previewLines = [] // primeras 200 líneas para la tabla de preview

  function volcarPendientes() {
    if (!pendientes.length) return
    const txt = pendientes.join('\n') + '\n'
    blobParciales.push(new Blob([txt], { type: 'text/plain' }))
    pendientes = []
  }

  try {
    // Primer Blob parcial: solo el header
    blobParciales.push(new Blob([storedHeaderLine], { type: 'text/plain' }))

    while (offset < fileSize) {
      const slice = file.slice(offset, offset + CHUNK_SIZE)
      const buffer = await slice.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      offset += bytes.length

      if (encoding === null) encoding = detectEncoding(bytes)
      const chunk = encoding === 'utf8'
        ? new TextDecoder('utf-8').decode(bytes)
        : decodeLatin1(bytes)

      const texto = leftover + chunk
      const lineas = texto.split('\n')
      leftover = lineas.pop() ?? ''

      for (const rawLine of lineas) {
        const line = rawLine.replace(/\r$/, '')
        if (!line.trim()) continue

        if (isFirstChunk && headers === null) {
          sep = detectSep(line)
          headers = parseCSVLine(line, sep).map(h => h.trim())
          headers.forEach((h, i) => { colIndex[h] = i })
          storedHeaderLine = line
          // Reemplazamos el primer Blob parcial (estaba vacío, aún no
          // sabíamos el separador) ahora que ya tenemos el header real.
          blobParciales[0] = new Blob([storedHeaderLine + '\n'], { type: 'text/plain' })
          isFirstChunk = false
          continue
        }

        if (!headers) continue

        totalRows++
        const vals = parseCSVLine(line, sep)

        if (pasaFiltro(vals, colIndex, condiciones, esAnd)) {
          pendientes.push(line)
          matchedRows++
          if (previewLines.length < 200) {
            const row = {}
            headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
            previewLines.push(row)
          }
          if (pendientes.length >= BLOB_BATCH) volcarPendientes()
        }
      }

      self.postMessage({ type: 'progress', progress: Math.round((offset / fileSize) * 100), totalRows, matchedRows })
    }

    // Leftover final
    if (leftover.trim() && headers) {
      const line = leftover.replace(/\r$/, '')
      totalRows++
      const vals = parseCSVLine(line, sep)
      if (pasaFiltro(vals, colIndex, condiciones, esAnd)) {
        pendientes.push(line)
        matchedRows++
        if (previewLines.length < 200) {
          const row = {}
          headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
          previewLines.push(row)
        }
      }
    }

    // Volcar lo que quedó pendiente
    volcarPendientes()

    // Concatenar todos los Blobs parciales en uno solo — el browser
    // hace esto sin necesidad de materializar el string completo en RAM.
    const csvBlob = new Blob(blobParciales, { type: 'text/csv;charset=utf-8;' })

    self.postMessage({
      type: 'done',
      headers: headers ?? [],
      previewRows: previewLines,
      totalRows,
      matchedRows,
      csvBlob,
    })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message ?? 'Error al procesar el archivo.' })
  }
}
