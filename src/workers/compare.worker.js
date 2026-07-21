// ════════════════════════════════════════════════════════════════════════
// La carga de Base A y Base B (y los 3 botones de descarga: nuevos/madre/
// perdidos) usan SIEMPRE el método simple y rápido de toda la vida — un
// Set de emails en memoria, sin IndexedDB. Esto nunca tuvo problemas de
// memoria ni de velocidad, así que no se complica.
//
// El ÚNICO punto que necesita cuidado especial es "Cambios campo a campo"
// (computeDiffs): ahí sí puede haber más de un millón de contactos en
// común, y guardar la fila completa de cada uno en memoria (como hacía
// la versión original) puede agotar la RAM con bases de varios cientos
// de MB. Para eso hay DOS modos, y el usuario elige según el tamaño real
// de sus bases:
//
//  - MODO RÁPIDO: igual que la versión original (se comparan directo en
//    memoria, sin pasar por disco). Rápido, pero puede fallar con bases
//    muy grandes.
//  - MODO SEGURO: usa IndexedDB para guardar el resultado a medida que
//    se calcula (en vez de un array en RAM) — más lento de escribir,
//    pero el uso de memoria no escala con la cantidad de contactos.
// ════════════════════════════════════════════════════════════════════════

import { detectEncoding, decodeChunk, parseCSVLine, detectCol, normalizeEmail } from '@/workers/worker-utils'
// diffRows vive en comparacion.js para poder testearla — mismo
// criterio que worker-utils.js.
import { diffRows } from '@/workers/comparacion'

const CHUNK_SIZE = 2 * 1024 * 1024;

// Umbral a partir del cual se sugiere "modo seguro" para el cálculo de
// diffs — por encima de esto, guardar todas las filas en memoria
// empieza a ser riesgoso en máquinas con RAM modesta.
const SAFE_MODE_THRESHOLD_MB = 150;

// ─── Carga de archivo (rápida, de siempre) ───────────────────────────────
// Lee el archivo completo una vez, guarda un Set de emails (liviano) Y,
// de paso, el offset+length de cada línea (también liviano: 3 valores
// chicos por fila, nada que ver con guardar la fila completa) — así el
// modo seguro de diffs puede reusar exactamente esta misma carga sin
// tener que leer el archivo una segunda vez.
async function readFileLight(file, progressType) {
  let headers = null, headerLine = '', emailCol = null, sep = ';';
  let leftover = '', leftoverOffset = 0, isFirstChunk = true, encoding = null;
  const fileSize = file.size;
  let offset = 0;
  const emailSet = new Set();
  const positions = new Map(); // email -> { offset, length } — liviano
  let totalRows = 0;
  const encoder = new TextEncoder();

  while (offset < fileSize) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    offset += bytes.length;
    if (encoding === null) encoding = detectEncoding(bytes);
    const progress = Math.round((offset / fileSize) * 100);
    const text = leftover + decodeChunk(bytes, encoding);
    const lines = text.split('\n');
    leftover = lines.pop();

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
      const cols = parseCSVLine(trimmed, sep);
      const idx = emailCol ? headers.indexOf(emailCol) : -1;
      const emailVal = idx >= 0 ? normalizeEmail(cols[idx] ?? '') : '';
      if (emailVal) {
        emailSet.add(emailVal);
        positions.set(emailVal, { offset: lineStart, length: encoder.encode(line).length });
      }
    }
    leftoverOffset = cursor;
    self.postMessage({ type: progressType, progress });
  }

  // Última línea, si el archivo no termina con salto de línea — sin
  // esto, el último contacto del archivo nunca se procesaba (bug que ya
  // habíamos encontrado y arreglado antes).
  if (leftover.trim() && headers) {
    const line = leftover.replace(/\r$/, '');
    const trimmed = line.trim();
    const cols = parseCSVLine(trimmed, sep);
    const idx = emailCol ? headers.indexOf(emailCol) : -1;
    const emailVal = idx >= 0 ? normalizeEmail(cols[idx] ?? '') : '';
    totalRows++;
    if (emailVal) {
      emailSet.add(emailVal);
      positions.set(emailVal, { offset: leftoverOffset, length: encoder.encode(line).length });
    }
  }

  return { emailSet, positions, headerLine, headers, emailCol, sep, totalRows, file, encoding };
}

// Lee una línea puntual del archivo dado su offset+length, parseada como
// { columna: valor }. Se usa tanto en modo rápido como en modo seguro.
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

// ─── MODO RÁPIDO — diffs en memoria, sin IndexedDB ───────────────────────
async function computeDiffsFast(metaA, metaB, onProgress) {
  const commonCols = metaA.headers.filter(h => metaB.headers.includes(h) && h !== metaA.emailCol);
  const commonEmails = [];
  for (const email of metaA.emailSet) if (metaB.emailSet.has(email)) commonEmails.push(email);

  const diffs = [];
  const colChangeSummary = {};
  const total = Math.max(1, commonEmails.length);

  for (let i = 0; i < commonEmails.length; i++) {
    const email = commonEmails[i];
    const posA = metaA.positions.get(email);
    const posB = metaB.positions.get(email);
    const [rowA, rowB] = await Promise.all([
      readRowAt(metaA, posA.offset, posA.length),
      readRowAt(metaB, posB.offset, posB.length),
    ]);
    const fieldDiffs = diffRows(rowA, rowB, commonCols);
    if (fieldDiffs.length > 0) {
      diffs.push({ email, diffs: fieldDiffs, fields: fieldDiffs.map(d => d.col) });
      fieldDiffs.forEach(d => { colChangeSummary[d.col] = (colChangeSummary[d.col] || 0) + 1; });
    }
    if (i % 500 === 0) onProgress(Math.min(99, Math.round((i / total) * 100)));
  }

  onProgress(100);
  const colChangeSorted = Object.entries(colChangeSummary).sort((x, y) => y[1] - x[1]).slice(0, 20);
  return { diffs, colChangeSorted };
}

// ─── MODO SEGURO — diffs vía IndexedDB ───────────────────────────────────
// Mismo cálculo que el modo rápido, pero el resultado se va guardando en
// IndexedDB en vez de un array en RAM. Como readFileLight ya guardó
// offset+length por fila, no hace falta releer/reindexar nada — solo
// recorrer los emails en común y escribir en lotes.

function openResultDb(dbName) {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('diffs')) {
        const store = db.createObjectStore('diffs', { keyPath: 'email' });
        store.createIndex('byField', 'fields', { multiEntry: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteResultDb(dbName) {
  return new Promise((resolve) => {
    const req = self.indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
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

async function computeDiffsSafe(metaA, metaB, resultDb, onProgress) {
  const commonCols = metaA.headers.filter(h => metaB.headers.includes(h) && h !== metaA.emailCol);
  const commonEmails = [];
  for (const email of metaA.emailSet) if (metaB.emailSet.has(email)) commonEmails.push(email);

  const total = Math.max(1, commonEmails.length);
  const colChangeSummary = {};
  let writeBuffer = [];
  const FLUSH_EVERY = 500;

  async function flush() {
    if (!writeBuffer.length) return;
    const batch = writeBuffer;
    writeBuffer = [];
    await idbPutBatch(resultDb, 'diffs', batch);
  }

  for (let i = 0; i < commonEmails.length; i++) {
    const email = commonEmails[i];
    const posA = metaA.positions.get(email);
    const posB = metaB.positions.get(email);
    const [rowA, rowB] = await Promise.all([
      readRowAt(metaA, posA.offset, posA.length),
      readRowAt(metaB, posB.offset, posB.length),
    ]);
    const fieldDiffs = diffRows(rowA, rowB, commonCols);
    if (fieldDiffs.length > 0) {
      writeBuffer.push({ email, diffs: fieldDiffs, fields: fieldDiffs.map(d => d.col) });
      fieldDiffs.forEach(d => { colChangeSummary[d.col] = (colChangeSummary[d.col] || 0) + 1; });
      if (writeBuffer.length >= FLUSH_EVERY) await flush();
    }
    if (i % 500 === 0) onProgress(Math.min(99, Math.round((i / total) * 100)));
  }

  await flush();
  onProgress(100);
  const colChangeSorted = Object.entries(colChangeSummary).sort((x, y) => y[1] - x[1]).slice(0, 20);
  return { totalChanged: commonEmails.length, colChangeSorted };
}

function getDiffsPageSafe(resultDb, page, pageSize, fieldFilter) {
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
        if (!cursor) { resolve({ rows, page, totalFiltered, fieldFilter: fieldFilter || null }); return; }
        if (skipped < toSkip) { skipped++; cursor.continue(); return; }
        if (rows.length < pageSize) { rows.push(cursor.value); cursor.continue(); }
        else resolve({ rows, page, totalFiltered, fieldFilter: fieldFilter || null });
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    };
    countReq.onerror = () => reject(countReq.error);
  });
}

// Pagina sobre el resultado del modo rápido (array en RAM) — mismo
// formato de respuesta que el modo seguro, para que el frontend no
// tenga que distinguir cuál modo se usó.
function getDiffsPageFast(diffsArray, page, pageSize, fieldFilter) {
  const filtered = fieldFilter ? diffsArray.filter(r => r.fields.includes(fieldFilter)) : diffsArray;
  const rows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  return { rows, page, totalFiltered: filtered.length, fieldFilter: fieldFilter || null };
}

// ─── Descargas (nuevos / madre / perdidos) — siempre con el Set liviano ──
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
      // La primera línea no vacía SIEMPRE es el header — se salta por
      // posición, no por comparación de contenido. Antes se comparaba
      // trimmed contra meta.headerLine.trim(), pero eso es frágil: un
      // BOM al inicio del archivo (común en CSV exportados de Excel) o
      // cualquier diferencia sutil de encoding entre la carga inicial y
      // esta segunda lectura podía hacer que la comparación nunca
      // matcheara, dejando que el header se procesara como si fuera una
      // fila de datos real.
      if (isFirstChunk) { isFirstChunk = false; continue; }

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

function computeStats(metaA, metaB) {
  const emailsA = metaA.emailSet;
  const emailsB = metaB.emailSet;
  let nuevosCount = 0, madreCount = 0, perdidosCount = 0;
  for (const email of emailsB) { if (emailsA.has(email)) madreCount++; else nuevosCount++; }
  for (const email of emailsA) { if (!emailsB.has(email)) perdidosCount++; }
  return {
    uniqueA: emailsA.size, uniqueB: emailsB.size,
    totalA: metaA.totalRows, totalB: metaB.totalRows,
    nuevosCount, madreCount, perdidosCount,
  };
}

let storedA = null;
let storedB = null;
let resultDb = null;
let fastDiffsResult = null; // array en RAM, solo cuando se usó modo rápido

self.onmessage = async (e) => {
  const { type } = e.data;

  if (type === 'load_a') {
    try {
      storedA = await readFileLight(e.data.file, 'progress_a');
      const sizeMb = Math.round(storedA.file.size / (1024 * 1024));
      self.postMessage({
        type: 'loaded_a', totalRows: storedA.totalRows, uniqueEmails: storedA.emailSet.size,
        sizeMb, suggestSafeMode: sizeMb >= SAFE_MODE_THRESHOLD_MB,
      });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'load_b') {
    try {
      storedB = await readFileLight(e.data.file, 'progress_b');
      const sizeMb = Math.round(storedB.file.size / (1024 * 1024));
      self.postMessage({
        type: 'loaded_b', totalRows: storedB.totalRows, uniqueEmails: storedB.emailSet.size,
        sizeMb, suggestSafeMode: sizeMb >= SAFE_MODE_THRESHOLD_MB,
      });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'compare_stats') {
    try {
      const stats = computeStats(storedA, storedB);
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
    // e.data.mode: 'fast' | 'safe' — lo elige el usuario en el frontend
    // tras ver el aviso de tamaño.
    try {
      if (e.data.mode === 'safe') {
        fastDiffsResult = null;
        await deleteResultDb('rb_compare_diffs');
        resultDb = await openResultDb('rb_compare_diffs');
        const result = await computeDiffsSafe(storedA, storedB, resultDb, (progress) => {
          self.postMessage({ type: 'diffs_progress', progress });
        });
        self.postMessage({ type: 'diffs_done', totalChanged: result.totalChanged, colChangeSorted: result.colChangeSorted, mode: 'safe' });
      } else {
        resultDb = null;
        const result = await computeDiffsFast(storedA, storedB, (progress) => {
          self.postMessage({ type: 'diffs_progress', progress });
        });
        fastDiffsResult = result.diffs;
        self.postMessage({ type: 'diffs_done', totalChanged: result.diffs.length, colChangeSorted: result.colChangeSorted, mode: 'fast' });
      }
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }

  } else if (type === 'get_diffs_page') {
    try {
      const { page, pageSize, fieldFilter } = e.data;
      const result = resultDb
        ? await getDiffsPageSafe(resultDb, page, pageSize, fieldFilter)
        : getDiffsPageFast(fastDiffsResult || [], page, pageSize, fieldFilter);
      self.postMessage({ type: 'diffs_page_done', ...result });
    } catch (err) { self.postMessage({ type: 'error', message: err.message }); }
  }
};
