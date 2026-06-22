// ════════════════════════════════════════════════════════════════════════
// ARQUITECTURA: este worker compara dos bases de contactos potencialmente
// enormes (cientos de miles a millones de filas, archivos de cientos de
// MB cada uno) sin necesitar tener ninguna de las dos completas en RAM al
// mismo tiempo. La clave es usar IndexedDB (almacenamiento en disco, no
// en memoria) como estructura intermedia:
//
// 1. INDEXAR cada archivo: se lee una vez completo, y por cada fila se
//    guarda en IndexedDB un registro liviano { email, offset, length } —
//    NO la fila completa, solo "dónde vive" esa línea dentro del archivo
//    original. Esto es chico (decenas de bytes por contacto) sin importar
//    cuántas columnas tenga la base.
// 2. COMPARAR usando un cursor ordenado por email en ambos índices a la
//    vez (técnica de "merge de dos punteros", como mezclar dos mazos de
//    cartas ya ordenados) — en todo momento solo se tiene EN MEMORIA el
//    registro actual de cada lado, nunca la base completa. Cuando los
//    emails coinciden, ahí sí se van a buscar las dos líneas reales al
//    archivo (usando el offset guardado) para comparar campo a campo, se
//    comparan, y se descartan inmediatamente.
// 3. Los resultados (solo contactos con cambios reales) se guardan
//    también en IndexedDB, no en un array de RAM — la paginación y el
//    filtro por campo consultan ahí.
//
// Esto mantiene el uso de RAM aproximadamente CONSTANTE sin importar si
// la base tiene mil o diez millones de filas — lo único que crece con el
// tamaño de la base es el tiempo de procesamiento, no la memoria.
// ════════════════════════════════════════════════════════════════════════

function decodeLatin1(uint8array) {
  let str = '';
  for (let i = 0; i < uint8array.length; i++) str += String.fromCharCode(uint8array[i]);
  return str;
}

function detectEncoding(bytes) {
  const sample = bytes.slice(0, 4096);
  const testUtf8 = new TextDecoder('utf-8').decode(sample);
  return testUtf8.includes('\uFFFD') ? 'latin1' : 'utf8';
}

function decodeChunk(bytes, encoding) {
  return encoding === 'utf8' ? new TextDecoder('utf-8').decode(bytes) : decodeLatin1(bytes);
}

function parseCSVLine(line, sep) {
  const result = [];
  let current = '', inQuotes = false, i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"' && !inQuotes && current === '') { inQuotes = true; }
    else if (ch === '"' && inQuotes) { if (line[i + 1] === '"') { current += '"'; i++; } else inQuotes = false; }
    else if (ch === sep && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
    i++;
  }
  result.push(current);
  return result;
}

function detectCol(headers, patterns) {
  return headers.find(h => patterns.some(p => p.test(h))) || null;
}

function normalizeEmail(email) {
  return email.normalize('NFC').toLowerCase().trim();
}

const CHUNK_SIZE = 2 * 1024 * 1024;

// ─── IndexedDB: helpers básicos ──────────────────────────────────────────

function openDb(dbName) {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('rows')) {
        db.createObjectStore('rows', { keyPath: 'email' });
      }
      if (!db.objectStoreNames.contains('diffs')) {
        const diffStore = db.createObjectStore('diffs', { keyPath: 'email' });
        diffStore.createIndex('byField', 'fields', { multiEntry: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteDb(dbName) {
  return new Promise((resolve) => {
    const req = self.indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve(); // no bloquear el flujo por esto
    req.onblocked = () => resolve();
  });
}

// Cursor "manual" que se puede avanzar de a un registro por vez desde un
// bucle externo (necesario para el merge de dos punteros entre A y B).
//
// IMPORTANTE: las transacciones de IndexedDB se cierran automáticamente
// en cuanto el código vuelve al event loop sin operaciones IDB
// pendientes — si entre dos avances del cursor se hace un await a algo
// que NO es IndexedDB (como leer una porción del archivo), la
// transacción ya se cerró y el próximo cursor.continue() falla con
// TransactionInactiveError. Por eso NO se puede simplemente "esperar"
// con awaits intercalados entre operaciones de archivo — hay que leer en
// LOTES con getAll()/getAllKeys() (transacciones cortas y completas en
// un solo tick), guardar el lote en un array chico en memoria, y recién
// ahí — con la transacción ya cerrada — hacer las operaciones de
// archivo que hagan falta.
function makeBatchedReader(db, storeName, batchSize) {
  let buffer = [];
  let bufferIdx = 0;
  let lastKey = null; // última key leída, para pedir "lo que sigue"
  let exhausted = false;

  async function fetchNextBatch() {
    if (exhausted) return;
    const range = lastKey === null ? null : self.IDBKeyRange.lowerBound(lastKey, true);
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll(range, batchSize);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    buffer = items;
    bufferIdx = 0;
    if (items.length > 0) lastKey = items[items.length - 1].email;
    if (items.length < batchSize) exhausted = true;
  }

  return {
    // Carga el primer lote — debe llamarse antes de usar peek/advance.
    async init() { await fetchNextBatch(); },
    peek() { return bufferIdx < buffer.length ? buffer[bufferIdx] : null; },
    isDone() { return bufferIdx >= buffer.length && exhausted; },
    async advance() {
      bufferIdx++;
      if (bufferIdx >= buffer.length && !exhausted) await fetchNextBatch();
    },
  };
}

function idbPutBatch(db, storeName, items) {
  if (!items.length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Indexado: lee un archivo completo, guarda { email, offset, length } por fila ──

async function indexFile(file, dbName, progressType) {
  await deleteDb(dbName); // por si quedó una sesión anterior con el mismo nombre
  const db = await openDb(dbName);
  const encoder = new TextEncoder();

  let headers = null, headerLine = '', emailCol = null, sep = ';';
  let leftover = '', leftoverOffset = 0, isFirstChunk = true, encoding = null;
  const fileSize = file.size;
  let offset = 0;
  let totalRows = 0;
  let uniqueCount = 0;
  // Set de emails en memoria — esto SÍ es liviano (solo strings de
  // email, ~30-60MB incluso con 1M+ contactos), nada que ver con el
  // problema de memoria original (que era guardar objetos con TODAS las
  // columnas de cada fila). Se usa para los botones de descarga
  // (nuevos/madre/perdidos), que ya funcionaban bien así antes y no
  // tenían ningún problema de memoria — no hace falta complicarlos con
  // IndexedDB, solo el cálculo de diffs campo a campo lo necesitaba.
  const emailSet = new Set();

  // Agrupa escrituras en lotes — pagar una transacción IndexedDB por
  // cada fila individual sería muy lento con millones de filas.
  let writeBuffer = [];
  const FLUSH_EVERY = 2000;
  async function flush() {
    if (!writeBuffer.length) return;
    const batch = writeBuffer;
    writeBuffer = [];
    await idbPutBatch(db, 'rows', batch);
  }

  while (offset < fileSize) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    offset += bytes.length;
    if (encoding === null) encoding = detectEncoding(bytes);

    const progress = Math.round((offset / fileSize) * 100);
    const chunkText = decodeChunk(bytes, encoding);
    const text = leftover + chunkText;
    const lines = text.split('\n');
    leftover = lines.pop();

    // cursor: posición absoluta (en bytes del archivo) de la línea que
    // se está procesando — se recalcula por longitud en bytes real
    // (no por cantidad de caracteres JS) para que coincida exacto con
    // los offsets que vamos a usar después con file.slice().
    let cursor = leftoverOffset;

    for (const rawLine of lines) {
      const lineByteLen = encoder.encode(rawLine).length + 1; // +1 por el '\n'
      const lineStart = cursor;
      cursor += lineByteLen;

      const line = rawLine.replace(/\r$/, '');
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (isFirstChunk && !headers) {
        sep = trimmed.includes(';') ? ';' : ',';
        headers = parseCSVLine(trimmed, sep).map(c => c.trim());
        headerLine = line;
        emailCol = detectCol(headers, [/email/i, /correo/i, /^e-mail$/i, /^mail$/i]);
        isFirstChunk = false;
        continue;
      }
      if (!headers) continue;
      totalRows++;

      const idx = emailCol ? headers.indexOf(emailCol) : -1;
      if (idx < 0) continue;
      const cols = parseCSVLine(trimmed, sep);
      const emailVal = normalizeEmail(cols[idx] ?? '');
      if (!emailVal) continue;

      const byteLenInThisLine = encoder.encode(line).length; // sin \r\n
      writeBuffer.push({ email: emailVal, offset: lineStart, length: byteLenInThisLine });
      emailSet.add(emailVal);
      uniqueCount++;
      if (writeBuffer.length >= FLUSH_EVERY) await flush();
    }

    leftoverOffset = cursor; // la línea cortada (leftover) arranca acá
    self.postMessage({ type: progressType, progress });
  }

  // Última línea, si el archivo no termina con salto de línea
  if (leftover.trim() && headers) {
    const line = leftover.replace(/\r$/, '');
    const trimmed = line.trim();
    const idx = emailCol ? headers.indexOf(emailCol) : -1;
    if (idx >= 0) {
      const cols = parseCSVLine(trimmed, sep);
      const emailVal = normalizeEmail(cols[idx] ?? '');
      if (emailVal) {
        const byteLen = encoder.encode(line).length;
        writeBuffer.push({ email: emailVal, offset: leftoverOffset, length: byteLen });
        emailSet.add(emailVal);
        uniqueCount++;
        totalRows++;
      }
    }
  }
  await flush();

  return { db, dbName, headerLine, headers, emailCol, sep, totalRows, uniqueCount, file, encoding, emailSet };
}

// Lee una línea puntual del archivo original dado su offset+length
// (guardado al indexar), y la devuelve ya parseada como { columna: valor }.
async function readRowAt(meta, offset, length) {
  const slice = meta.file.slice(offset, offset + length);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = decodeChunk(bytes, meta.encoding).replace(/\r$/, '');
  const cols = parseCSVLine(text, meta.sep);
  const row = {};
  meta.headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
  return row;
}

// ─── Comparación con merge de dos punteros sobre los índices ordenados ──
// (IndexedDB devuelve las claves en orden ascendente natural por
// defecto, así que ambos cursores avanzan ordenados por email — esto es
// lo que hace posible el merge sin tener que cargar nada completo.)

// Stats generales (nuevos/madre/perdidos) — se calculan directo sobre
// los Sets de emails en memoria (igual que en la versión original, sin
// problema de memoria con esto), sin necesidad de pasar por IndexedDB.
function computeStats(metaA, metaB) {
  const emailsA = metaA.emailSet;
  const emailsB = metaB.emailSet;
  let nuevosCount = 0, madreCount = 0, perdidosCount = 0;
  for (const email of emailsB) { if (emailsA.has(email)) madreCount++; else nuevosCount++; }
  for (const email of emailsA) { if (!emailsB.has(email)) perdidosCount++; }
  return {
    uniqueA: metaA.uniqueCount, uniqueB: metaB.uniqueCount,
    totalA: metaA.totalRows, totalB: metaB.totalRows,
    nuevosCount, madreCount, perdidosCount,
  };
}

async function computeDiffsIndexed(metaA, metaB, resultDb, onProgress) {
  const commonCols = metaA.headers.filter(h => metaB.headers.includes(h) && h !== metaA.emailCol);
  const BATCH = 5000;

  const curA = makeBatchedReader(metaA.db, 'rows', BATCH);
  const curB = makeBatchedReader(metaB.db, 'rows', BATCH);
  await curA.init();
  await curB.init();

  // No tenemos un total exacto de pares sin un recorrido extra — se
  // estima el progreso contra la suma de ambas bases (suficiente para
  // una barra de progreso, no necesita ser perfecto).
  const totalEstimado = Math.max(1, metaA.uniqueCount + metaB.uniqueCount);
  let pasos = 0;
  let totalChanged = 0;
  const colChangeSummary = {};
  let writeBuffer = [];
  const FLUSH_EVERY = 500;

  async function flushDiffs() {
    if (!writeBuffer.length) return;
    const batch = writeBuffer;
    writeBuffer = [];
    await idbPutBatch(resultDb, 'diffs', batch);
  }

  function reportProgress() {
    pasos++;
    if (pasos % 500 === 0) {
      onProgress(Math.min(99, Math.round((pasos / totalEstimado) * 100)));
    }
  }

  while (!curA.isDone() || !curB.isDone()) {
    if (curA.isDone()) { reportProgress(); await curB.advance(); continue; }
    if (curB.isDone()) { reportProgress(); await curA.advance(); continue; }

    const a = curA.peek(), b = curB.peek();

    if (a.email === b.email) {
      reportProgress();
      // En este punto NO hay ninguna transacción IndexedDB abierta (el
      // lote ya se leyó completo antes), así que es seguro hacer
      // operaciones async de archivo acá sin riesgo de
      // TransactionInactiveError.
      const [rowA, rowB] = await Promise.all([
        readRowAt(metaA, a.offset, a.length),
        readRowAt(metaB, b.offset, b.length),
      ]);

      const fieldDiffs = [];
      for (const col of commonCols) {
        const valA = (rowA[col] ?? '').trim();
        const valB = (rowB[col] ?? '').trim();
        if (valA !== valB) fieldDiffs.push({ col, valA, valB });
      }
      if (fieldDiffs.length > 0) {
        totalChanged++;
        writeBuffer.push({
          email: a.email,
          diffs: fieldDiffs,
          fields: fieldDiffs.map(d => d.col), // para el índice multiEntry 'byField'
        });
        fieldDiffs.forEach(d => { colChangeSummary[d.col] = (colChangeSummary[d.col] || 0) + 1; });
        if (writeBuffer.length >= FLUSH_EVERY) await flushDiffs();
      }

      await curA.advance();
      await curB.advance();
    } else if (a.email < b.email) {
      reportProgress();
      await curA.advance();
    } else {
      reportProgress();
      await curB.advance();
    }
  }

  await flushDiffs();
  onProgress(100);

  const colChangeSorted = Object.entries(colChangeSummary).sort((x, y) => y[1] - x[1]).slice(0, 20);
  return { totalChanged, colChangeSorted };
}

// Pagina (y opcionalmente filtra por campo) sobre los diffs ya guardados
// en IndexedDB — nunca carga todos los diffs en RAM, solo la página
// pedida.
function getDiffsPage(resultDb, page, pageSize, fieldFilter) {
  return new Promise((resolve, reject) => {
    const tx = resultDb.transaction('diffs', 'readonly');
    const store = tx.objectStore('diffs');
    const source = fieldFilter ? store.index('byField') : store;
    const range = fieldFilter ? self.IDBKeyRange.only(fieldFilter) : null;

    const countReq = source.count(range);
    countReq.onsuccess = () => {
      const totalFiltered = countReq.result;
      const rows = [];
      let skipped = 0;
      const toSkip = page * pageSize;

      const cursorReq = source.openCursor(range);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve({ rows, page, totalFiltered, fieldFilter: fieldFilter || null });
          return;
        }
        if (skipped < toSkip) {
          skipped++;
          cursor.continue();
          return;
        }
        if (rows.length < pageSize) {
          rows.push(cursor.value);
          cursor.continue();
        } else {
          resolve({ rows, page, totalFiltered, fieldFilter: fieldFilter || null });
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    };
    countReq.onerror = () => reject(countReq.error);
  });
}

// Lee un archivo en streaming y devuelve solo las líneas que pasan el
// filtro — usa el Set de emails en memoria (liviano, sin problema de
// memoria con bases grandes), igual que en la versión original. Se usa
// para los 3 botones de descarga (nuevos/madre/perdidos).
async function streamFilter(meta, filterFn, progressBase, progressRange) {
  let leftover = '', isFirstChunk = true, offset = 0;
  const fileSize = meta.file.size;
  const lines = [];

  while (offset < fileSize) {
    const slice = meta.file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    offset += bytes.length;
    const progress = progressBase + Math.round((offset / fileSize) * progressRange);
    const text = leftover + decodeChunk(bytes, meta.encoding);
    const rawLines = text.split('\n');
    leftover = rawLines.pop();

    for (const rawLine of rawLines) {
      const line = rawLine.replace(/\r$/, '');
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (isFirstChunk && trimmed === meta.headerLine.trim()) { isFirstChunk = false; continue; }
      if (isFirstChunk) isFirstChunk = false;

      const cols = parseCSVLine(trimmed, meta.sep);
      const idx = meta.emailCol ? meta.headers.indexOf(meta.emailCol) : -1;
      const emailVal = idx >= 0 ? normalizeEmail(cols[idx] ?? '') : '';
      if (filterFn(emailVal)) lines.push(line);
    }
    self.postMessage({ type: 'dl_progress', progress });
  }

  if (leftover.trim()) {
    const trimmed = leftover.replace(/\r$/, '').trim();
    const cols = parseCSVLine(trimmed, meta.sep);
    const idx = meta.emailCol ? meta.headers.indexOf(meta.emailCol) : -1;
    const emailVal = idx >= 0 ? normalizeEmail(cols[idx] ?? '') : '';
    if (filterFn(emailVal)) lines.push(leftover.replace(/\r$/, ''));
  }

  return lines;
}

let storedA = null;
let storedB = null;
let resultDb = null;

self.onmessage = async (e) => {
  const { type } = e.data;

  if (type === 'load_a') {
    try {
      storedA = await indexFile(e.data.file, 'rb_compare_a', 'progress_a');
      self.postMessage({ type: 'loaded_a', totalRows: storedA.totalRows, uniqueEmails: storedA.uniqueCount });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'load_b') {
    try {
      storedB = await indexFile(e.data.file, 'rb_compare_b', 'progress_b');
      self.postMessage({ type: 'loaded_b', totalRows: storedB.totalRows, uniqueEmails: storedB.uniqueCount });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'compare_stats') {
    try {
      const stats = await computeStats(storedA, storedB);
      self.postMessage({ type: 'stats_done', stats });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'download_nuevos') {
    try {
      const lines = await streamFilter(storedB, email => !storedA.emailSet.has(email), 0, 100);
      self.postMessage({ type: 'download_ready', key: 'nuevos', lines, headerLine: storedB.headerLine });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'download_madre') {
    try {
      const lines = await streamFilter(storedB, email => storedA.emailSet.has(email), 0, 100);
      self.postMessage({ type: 'download_ready', key: 'madre', lines, headerLine: storedB.headerLine });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'download_perdidos') {
    try {
      const lines = await streamFilter(storedA, email => !storedB.emailSet.has(email), 0, 100);
      self.postMessage({ type: 'download_ready', key: 'perdidos', lines, headerLine: storedA.headerLine });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'compute_diffs') {
    try {
      await deleteDb('rb_compare_diffs');
      resultDb = await openDb('rb_compare_diffs');
      const result = await computeDiffsIndexed(storedA, storedB, resultDb, (progress) => {
        self.postMessage({ type: 'diffs_progress', progress });
      });
      self.postMessage({ type: 'diffs_done', totalChanged: result.totalChanged, colChangeSorted: result.colChangeSorted });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'get_diffs_page') {
    try {
      const { page, pageSize, fieldFilter } = e.data;
      const result = await getDiffsPage(resultDb, page, pageSize, fieldFilter);
      self.postMessage({ type: 'diffs_page_done', ...result });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }
  }
};
