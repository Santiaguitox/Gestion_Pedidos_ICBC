// Lógica pura, portada tal cual del Mail Checker original (HTML/JS
// standalone) — sin cambios de comportamiento, solo el lenguaje de
// implementación. Separada de React a propósito, para poder probarla
// de forma aislada.

// Mismo diccionario de caracteres especiales que el original — explica
// en español qué carácter es cada uno, para que el mensaje de error
// tenga sentido para alguien sin conocimientos técnicos de encoding.
export const SPECIAL_CHAR_MAP = {
  'á': 'a con tilde', 'é': 'e con tilde', 'í': 'i con tilde', 'ó': 'o con tilde', 'ú': 'u con tilde',
  'Á': 'A con tilde', 'É': 'E con tilde', 'Í': 'I con tilde', 'Ó': 'O con tilde', 'Ú': 'U con tilde',
  'ü': 'u con diéresis', 'Ü': 'U con diéresis',
  'ñ': 'ñ', 'Ñ': 'Ñ',
  ' ': 'espacio',
  '-': 'guión medio (usar _ en su lugar)',
  '.': 'punto',
  ',': 'coma',
  '(': 'paréntesis abierto', ')': 'paréntesis cerrado',
  '/': 'barra', '\\': 'barra invertida',
  '@': 'arroba', '#': 'numeral', '$': 'signo pesos',
  '%': 'porcentaje', '&': 'ampersand', '*': 'asterisco',
  '+': 'signo más', '=': 'igual', '?': 'signo pregunta',
  '!': 'signo exclamación', '^': 'circunflejo', '~': 'virgulilla',
  '[': 'corchete abierto', ']': 'corchete cerrado',
  '{': 'llave abierta', '}': 'llave cerrada',
  '<': 'menor que', '>': 'mayor que', '|': 'pipe', '`': 'backtick',
  "'": 'comilla simple', '"': 'comilla doble',
}

// Detecta cuál de los 4 separadores candidatos aparece más veces en la
// línea — el que más se repite es, casi siempre, el separador real del
// archivo. Con una sola columna (sin separador real) cae al primero del
// objeto por empate en 0, lo cual da igual: split() sobre una línea sin
// ese carácter devuelve la línea entera como único elemento.
export function detectSep(line) {
  const counts = { ';': 0, ',': 0, '\t': 0, '|': 0 }
  for (const c of line) if (c in counts) counts[c]++
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

export function parseHeaders(raw) {
  const line = raw.trim().split('\n')[0]
  const sep = detectSep(line)
  return line.split(sep).map(h => h.trim()).filter(Boolean)
}

// Extrae los campos de personalización del HTML, formato <*CAMPO*>.
// Antes de buscar, "desescapa" el caso en que el código fuente ya venga
// con esos símbolos convertidos a entidades HTML (&lt; y &gt;) — pasa
// seguido al copiar código fuente con Ctrl+U desde algunos navegadores.
export function extractFields(html) {
  const decoded = html
    .replace(/&lt;\*/gi, '<*')
    .replace(/\*&gt;/gi, '*>')
  const re = /<\*([^*>]+)\*>/g
  const found = new Set()
  let m
  while ((m = re.exec(decoded)) !== null) found.add(m[1].trim())
  return found
}

// Valida el encabezado de la base: caracteres inválidos en nombres de
// columna, presencia obligatoria de un campo "Email" (exacto, sin
// variantes), y columnas duplicadas (case-insensitive). Devuelve una
// lista de avisos ya armados, cada uno con su severidad ('error' o
// 'warning') para que la UI decida el color sin tener que repetir la
// lógica de cuál es cuál.
export function validateCsvHeaders(raw) {
  const avisos = []
  if (!raw.trim()) return avisos

  const line = raw.trim().split('\n')[0]
  const sep = detectSep(line)
  const headers = line.split(sep).map(h => h.trim()).filter(Boolean)

  // Caracteres inválidos por columna — solo a-z A-Z 0-9 _ se consideran
  // seguros para un merge de campos real.
  headers.forEach(h => {
    const found = {}
    for (const ch of h) {
      if (!/^[a-zA-Z0-9_]$/.test(ch)) {
        const label = SPECIAL_CHAR_MAP[ch] || `carácter desconocido (U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`
        if (!found[ch]) found[ch] = { label, count: 0 }
        found[ch].count++
      }
    }
    if (Object.keys(found).length) {
      avisos.push({ tipo: 'caracteres_invalidos', severidad: 'warning', campo: h, chars: found })
    }
  })

  // Campo Email obligatorio, exacto (case-insensitive pero sin
  // variantes de nombre) — es el dato sin el cual el envío no puede
  // funcionar en absoluto, por eso es error, no advertencia.
  const hasEmail = headers.some(h => h.toLowerCase() === 'email')
  if (!hasEmail) {
    const suspects = headers.filter(h => /mail/i.test(h) && h.toLowerCase() !== 'email')
    avisos.push({ tipo: 'falta_email', severidad: 'error', suspects })
  }

  // Columnas duplicadas (case-insensitive) — typeo o copy-paste con
  // columnas repetidas, rompería cualquier lógica que use el nombre
  // para buscar el valor correspondiente.
  const seenLower = {}
  headers.forEach(h => {
    const key = h.toLowerCase()
    if (!seenLower[key]) seenLower[key] = []
    seenLower[key].push(h)
  })
  Object.values(seenLower).forEach(group => {
    if (group.length > 1) avisos.push({ tipo: 'duplicado', severidad: 'error', campos: group })
  })

  return avisos
}

// Compara los campos del HTML contra las columnas del header — el
// corazón de la herramienta. ok = coincide en ambos lados, miss = está
// en el HTML pero no en la base (el envío fallaría, quedaría el
// placeholder sin reemplazar), unused = está en la base pero el HTML no
// lo usa (no es un error, solo informativo).
export function compararCampos(headersRaw, htmlRaw) {
  const headers = parseHeaders(headersRaw)
  const htmlFields = extractFields(htmlRaw)

  const headersMap = {}
  headers.forEach(h => { headersMap[h.toLowerCase()] = h })
  const htmlFieldsLower = new Set([...htmlFields].map(f => f.toLowerCase()))

  const ok = [...htmlFields].filter(f => Object.hasOwn(headersMap, f.toLowerCase()))
  const miss = [...htmlFields].filter(f => !Object.hasOwn(headersMap, f.toLowerCase()))
  const unused = headers.filter(h => !htmlFieldsLower.has(h.toLowerCase()))

  return { headers, htmlFields, headersMap, ok, miss, unused }
}

// ─── Lectura liviana del header de un archivo de base ───────────────────
// IMPORTANTE de seguridad/privacidad: esto NUNCA lee el archivo
// completo — solo los primeros bytes (más que suficiente para cualquier
// encabezado real, incluso con decenas de columnas), suficiente para
// extraer la primera línea y descartar el resto inmediatamente. El
// archivo de contactos (con emails reales) jamás se carga a memoria más
// allá de ese pedacito inicial, y nunca se envía a ningún servidor —
// todo corre en el navegador.
//
// Excepción: .xlsx — el formato ZIP interno de Excel no permite leer
// solo los primeros bytes de forma confiable (los metadatos de columnas
// están en una posición variable dentro del ZIP). Se lee el archivo
// completo en memoria pero se extrae SOLO la primera fila y se descarta
// todo lo demás inmediatamente. El comportamiento de privacidad es
// idéntico al de csv/txt: nunca se persiste ni se envía nada.
const HEADER_SAMPLE_BYTES = 8192

// Lee la primera fila de un .xlsx sin librerías externas.
// Un xlsx es un ZIP que contiene XMLs — la hoja activa se referencia
// en xl/workbook.xml y sus datos están en xl/worksheets/sheet1.xml
// (o el número que corresponda). Solo se parsea la primera fila (<row>)
// y se descarta todo lo demás. Los valores de texto en xlsx van en una
// tabla compartida (xl/sharedStrings.xml) referenciada por índice,
// así que hay que leer ambos archivos para resolver los strings.
async function leerHeaderXlsx(file) {
  // Descomprime el ZIP usando DecompressionStream nativa del browser
  async function extraerArchivo(zipBuffer, nombreBuscado) {
    const view = new DataView(zipBuffer)
    let offset = 0
    while (offset < zipBuffer.byteLength - 4) {
      const sig = view.getUint32(offset, true)
      if (sig !== 0x04034b50) break // Local file header signature
      // (offset + 6 son los flags del header — no se usan acá)
      const compressed = view.getUint16(offset + 8, true)
      const compSize   = view.getUint32(offset + 18, true)
      const uncompSize = view.getUint32(offset + 22, true)
      const nameLen    = view.getUint16(offset + 26, true)
      const extraLen   = view.getUint16(offset + 28, true)
      const nameBytes  = new Uint8Array(zipBuffer, offset + 30, nameLen)
      const nombre     = new TextDecoder().decode(nameBytes)
      const dataOffset = offset + 30 + nameLen + extraLen

      if (nombre === nombreBuscado) {
        const compData = new Uint8Array(zipBuffer, dataOffset, compSize)
        if (compressed === 8) {
          // Deflate — usar DecompressionStream nativa
          const ds = new DecompressionStream('deflate-raw')
          const writer = ds.writable.getWriter()
          writer.write(compData)
          writer.close()
          const chunks = []
          const reader = ds.readable.getReader()
          let done = false
          while (!done) {
            const { value, done: d } = await reader.read()
            if (value) chunks.push(value)
            done = d
          }
          const total = chunks.reduce((s, c) => s + c.length, 0)
          const out = new Uint8Array(total)
          let pos = 0
          for (const c of chunks) { out.set(c, pos); pos += c.length }
          return new TextDecoder('utf-8').decode(out)
        } else {
          // Sin compresión
          return new TextDecoder('utf-8').decode(new Uint8Array(zipBuffer, dataOffset, uncompSize))
        }
      }
      offset = dataOffset + compSize
    }
    return null
  }

  const buffer = await file.arrayBuffer()

  // 1. Leer workbook.xml para encontrar qué archivo corresponde a sheet1
  const workbookXml = await extraerArchivo(buffer, 'xl/workbook.xml')
  if (!workbookXml) throw new Error('Archivo xlsx inválido o corrupto.')

  // Buscar el nombre del archivo de la primera hoja en xl/worksheets/
  const wbDoc = new DOMParser().parseFromString(workbookXml, 'text/xml')
  const sheetEl = wbDoc.querySelector('sheet')
  const sheetId = sheetEl?.getAttribute('sheetId') ?? '1'
  const sheetFile = `xl/worksheets/sheet${sheetId}.xml`

  // 2. Leer sharedStrings (puede no existir si todos los valores son numéricos)
  const ssXml = await extraerArchivo(buffer, 'xl/sharedStrings.xml')
  const sharedStrings = []
  if (ssXml) {
    const ssDoc = new DOMParser().parseFromString(ssXml, 'text/xml')
    ssDoc.querySelectorAll('si').forEach(si => {
      // Concatenar todos los <t> dentro del <si> (puede haber varios en texto enriquecido)
      const texto = Array.from(si.querySelectorAll('t')).map(t => t.textContent).join('')
      sharedStrings.push(texto)
    })
  }

  // 3. Leer la hoja y extraer solo la primera fila
  const sheetXml = await extraerArchivo(buffer, sheetFile)
  if (!sheetXml) throw new Error('No se encontró la hoja de datos en el archivo.')

  const sheetDoc = new DOMParser().parseFromString(sheetXml, 'text/xml')
  const primeraFila = sheetDoc.querySelector('row')
  if (!primeraFila) throw new Error('El archivo no tiene datos en la primera fila.')

  const headers = []
  primeraFila.querySelectorAll('c').forEach(cell => {
    const tipo = cell.getAttribute('t')
    const vEl  = cell.querySelector('v')
    if (!vEl) return
    let valor
    if (tipo === 's') {
      // Shared string — resolver por índice
      valor = sharedStrings[parseInt(vEl.textContent, 10)] ?? ''
    } else if (tipo === 'str' || tipo === 'inlineStr') {
      valor = cell.querySelector('t')?.textContent ?? vEl.textContent
    } else {
      valor = vEl.textContent
    }
    if (valor.trim()) headers.push(valor.trim())
  })

  if (!headers.length) throw new Error('No se encontraron columnas en la primera fila.')
  return { headerLine: headers.join(';'), headers, filas: [] }
}

function decodeLatin1(uint8array) {
  let str = ''
  for (let i = 0; i < uint8array.length; i++) str += String.fromCharCode(uint8array[i])
  return str
}

function detectEncoding(bytes) {
  const testUtf8 = new TextDecoder('utf-8').decode(bytes)
  return testUtf8.includes('\uFFFD') ? 'latin1' : 'utf8'
}

function decodeChunk(bytes, encoding) {
  return encoding === 'utf8' ? new TextDecoder('utf-8').decode(bytes) : decodeLatin1(bytes)
}

// Cuántas filas de DATOS se muestran como muestra (sin contar el
// encabezado) — alcanza para ver el patrón de cada columna sin
// necesitar más. Nunca se guarda ni se manda a ningún lado, vive solo
// en el estado de React mientras dure la sesión en el navegador.
const FILAS_MUESTRA = 3

// Lee solo el inicio del archivo (ver HEADER_SAMPLE_BYTES más arriba)
// y devuelve el encabezado + hasta FILAS_MUESTRA filas de datos reales,
// ya separadas por columna según el separador detectado — útil para
// revisar de un vistazo si el contenido de cada columna tiene sentido
// con su nombre (ej: que "Teléfono" no tenga en realidad un nombre de
// empresa adentro, error común de mapeo del lado de quien manda la
// base). El resto del archivo (más allá de esas pocas líneas) nunca se
// lee ni se carga a memoria en ningún momento.
export async function leerMuestraDeArchivo(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'xlsx') return leerHeaderXlsx(file)
  const slice = file.slice(0, HEADER_SAMPLE_BYTES)
  const buffer = await slice.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const encoding = detectEncoding(bytes)
  const texto = decodeChunk(bytes, encoding)
  const lineas = texto.split('\n').map(l => l.replace(/\r$/, ''))

  const headerLine = (lineas[0] ?? '').trim()
  const sep = detectSep(headerLine)
  const headers = headerLine.split(sep).map(h => h.trim()).filter(Boolean)

  // Pedimos una línea de más (FILAS_MUESTRA + 1) a propósito: si
  // conseguimos esa extra, es la prueba de que la línea anterior cerró
  // bien con un salto de línea real (no quedó cortada por el límite de
  // bytes leídos) — en ese caso usamos las primeras FILAS_MUESTRA con
  // confianza. Si el archivo es más corto que eso, usamos todo menos
  // la última (que sí podría estar incompleta), sin dejar el array en
  // negativo si hay muy pocas líneas.
  const lineasDisponibles = lineas.slice(1, 1 + FILAS_MUESTRA + 1).filter(l => l.trim())
  const lineasSeguras = lineasDisponibles.length > FILAS_MUESTRA
    ? lineasDisponibles.slice(0, FILAS_MUESTRA)
    : lineasDisponibles.slice(0, Math.max(0, lineasDisponibles.length - 1))
  const filas = lineasSeguras.map(linea => linea.split(sep).map(v => v.trim()))

  return { headerLine, headers, filas }
}
