const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwam.com','yopmail.com',
  'trashmail.com','sharklasers.com','grr.la','spam4.me','10minutemail.com',
  'fakeinbox.com','dispostable.com','maildrop.cc','mailnull.com','spamgourmet.com',
  'trashmail.at','trashmail.io','trashmail.me','discard.email','spamhereplease.com',
  'getairmail.com','filzmail.com','throwam.com','mailexpire.com','spamex.com',
]);

const GENERIC_NAMES = new Set([
  'test','testing','prueba','asdf','xxxxx','noreply','no-reply','admin','info',
  'example','usuario','user','nombre','name','contact','contacto','cliente','client',
  'demo','sample','muestra','null','none','n/a','na',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SUSPICIOUS_TLD = /\.(xyz|top|click|loan|work|gdn|bid|win|download|accountant|webcam)$/i;
const ROWS_PER_CODE = 500;
const EXCLUDE_CODES = new Set(['INVALID_FORMAT', 'TYPO_DOMAIN', 'EMPTY', 'DOUBLE_DOT']);

function normalizeEmail(email) {
  return email.normalize('NFC').toLowerCase().trim();
}

function detectCol(headers, patterns) {
  return headers.find(h => patterns.some(p => p.test(h))) || null;
}

function validateRow(row, emailCol, nameCol, seenEmails, rowNum) {
  const issues = [];
  const raw = emailCol ? String(row[emailCol] ?? '').trim() : '';
  const email = normalizeEmail(raw);
  const name = nameCol ? String(row[nameCol] ?? '').trim() : '';

  if (!emailCol) {
    issues.push({ type: 'error', code: 'NO_EMAIL_COL', msg: 'No se encontró columna de email' });
  } else if (!email) {
    issues.push({ type: 'error', code: 'EMPTY', msg: 'Email vacío' });
  } else {
    if (!EMAIL_RE.test(email)) {
      issues.push({ type: 'error', code: 'INVALID_FORMAT', msg: 'Formato inválido' });
    } else {
      const [local, domain] = email.split('@');
      if (DISPOSABLE_DOMAINS.has(domain)) {
        issues.push({ type: 'error', code: 'DISPOSABLE', msg: `Dominio desechable: ${domain}` });
      }
      if (seenEmails.has(email)) {
        issues.push({ type: 'error', code: 'DUPLICATE', msg: `Duplicado (primera vez: fila ${seenEmails.get(email)})` });
      } else {
        seenEmails.set(email, rowNum);
      }
      if (email.includes('..')) {
        issues.push({ type: 'warning', code: 'DOUBLE_DOT', msg: 'Doble punto en el email' });
      }
      if (local.startsWith('.') || local.endsWith('.')) {
        issues.push({ type: 'warning', code: 'DOT_POSITION', msg: 'Punto al inicio/fin del usuario' });
      }
      if (SUSPICIOUS_TLD.test(domain)) {
        issues.push({ type: 'warning', code: 'SUSPICIOUS_TLD', msg: `TLD sospechoso: .${domain.split('.').pop()}` });
      }
      const typos = {
        'gmai.com':1,'gmial.com':1,'gmal.com':1,'gnail.com':1,'gamil.com':1,
        'hotnail.com':1,'hotmial.com':1,'hotmil.com':1,
        'yaho.com':1,'yhaoo.com':1,'yahooo.com':1,
        'outlok.com':1,'outook.com':1,'otlook.com':1,
      };
      if (typos[domain]) {
        issues.push({ type: 'error', code: 'TYPO_DOMAIN', msg: `Posible typo en dominio: ${domain}` });
      }
    }
  }

  if (nameCol) {
    if (!name) {
      issues.push({ type: 'warning', code: 'EMPTY_NAME', msg: 'Nombre vacío' });
    } else {
      if (GENERIC_NAMES.has(name.toLowerCase())) {
        issues.push({ type: 'warning', code: 'GENERIC_NAME', msg: `Nombre genérico: "${name}"` });
      }
      if (/[<>{}\\|\/\d]/.test(name)) {
        issues.push({ type: 'warning', code: 'ODD_NAME', msg: 'Nombre con caracteres raros o números' });
      }
      if (name.length < 2) {
        issues.push({ type: 'warning', code: 'SHORT_NAME', msg: 'Nombre demasiado corto' });
      }
    }
  }

  return issues;
}

function parseCSVLine(line, sep) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"' && !inQuotes && current === '') {
      inQuotes = true;
    } else if (ch === '"' && inQuotes) {
      if (line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = false;
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
    i++;
  }
  result.push(current);
  return result;
}

function decodeLatin1(uint8array) {
  let str = '';
  for (let i = 0; i < uint8array.length; i++) {
    str += String.fromCharCode(uint8array[i]);
  }
  return str;
}

function detectEncoding(bytes) {
  const sample = bytes.slice(0, 4096);
  const testUtf8 = new TextDecoder('utf-8').decode(sample);
  return testUtf8.includes('\uFFFD') ? 'latin1' : 'utf8';
}

function decodeChunk(bytes, encoding) {
  return encoding === 'utf8'
    ? new TextDecoder('utf-8').decode(bytes)
    : decodeLatin1(bytes);
}

let storedAllRows = [];
let storedHeaderLine = '';
let storedEmailCol = null;
let storedSep = ';';
let storedHeaders = [];
let originalEmailSet = new Set();

self.onmessage = async (e) => {
  const { type } = e.data;
  if (type === 'analyze') await handleAnalyze(e.data);
  else if (type === 'generate_clean') await handleGenerateClean();
  else if (type === 'generate_removed') await handleGenerateRemoved();
  else if (type === 'verify') await handleVerify(e.data);
};

async function handleAnalyze({ file }) {
  const CHUNK_SIZE = 2 * 1024 * 1024;
  let headers = null;
  let headerLine = '';
  let emailCol = null;
  let nameCol = null;
  let sep = ';';
  let seenEmails = new Map();
  let rowNum = 1;
  let totalRows = 0;
  let errorRows = 0;
  let warnRows = 0;
  let issueRowsByCode = {};
  let issueSummary = {};
  let leftover = '';
  let isFirstChunk = true;
  let encoding = null;
  const fileSize = file.size;
  let offset = 0;
  let allRows = [];

  storedAllRows = [];
  originalEmailSet = new Set();

  function addIssue(rowNum, emailVal, issues) {
    const hasError = issues.some(i => i.type === 'error');
    if (hasError) errorRows++; else warnRows++;
    issues.forEach(issue => {
      issueSummary[issue.code] = issueSummary[issue.code] || { type: issue.type, msg: issue.msg, count: 0 };
      issueSummary[issue.code].count++;
      if (!issueRowsByCode[issue.code]) issueRowsByCode[issue.code] = [];
      if (issueRowsByCode[issue.code].length < ROWS_PER_CODE) {
        issueRowsByCode[issue.code].push({ rowNum, email: emailVal, msg: issue.msg });
      }
    });
  }

  try {
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

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (isFirstChunk && !headers) {
          sep = trimmed.includes(';') ? ';' : ',';
          headers = parseCSVLine(trimmed, sep).map(c => c.trim());
          headerLine = line;
          emailCol = detectCol(headers, [/email/i, /correo/i, /^e-mail$/i, /^mail$/i]);
          nameCol = detectCol(headers, [/nombre/i, /^name$/i, /^first.?name$/i, /^apellido$/i]);
          isFirstChunk = false;
          self.postMessage({ type: 'headers', headers, emailCol, nameCol });
          continue;
        }

        if (!headers) continue;
        rowNum++; totalRows++;

        const cols = parseCSVLine(trimmed, sep);
        const row = {};
        headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
        const emailVal = emailCol ? normalizeEmail(row[emailCol] ?? '') : '';
        const issues = validateRow(row, emailCol, nameCol, seenEmails, rowNum);
        const codes = issues.map(i => i.code);

        if (emailVal) originalEmailSet.add(emailVal);
        allRows.push({ line, emailVal, codes });

        if (issues.length > 0) addIssue(rowNum, emailVal, issues);
      }

      self.postMessage({ type: 'progress', progress, totalRows, errorRows, warnRows });
    }

    if (leftover.trim() && headers) {
      const line = leftover.replace(/\r$/, '');
      const trimmed = line.trim();
      const cols = parseCSVLine(trimmed, sep);
      const row = {};
      headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
      const emailVal = emailCol ? normalizeEmail(row[emailCol] ?? '') : '';
      rowNum++; totalRows++;
      const issues = validateRow(row, emailCol, nameCol, seenEmails, rowNum);
      const codes = issues.map(i => i.code);
      if (emailVal) originalEmailSet.add(emailVal);
      allRows.push({ line, emailVal, codes });
      if (issues.length > 0) addIssue(rowNum, emailVal, issues);
    }

    const lastIndexByEmail = new Map();
    for (let i = 0; i < allRows.length; i++) {
      if (allRows[i].emailVal) lastIndexByEmail.set(allRows[i].emailVal, i);
    }
    let cleanCount = 0;
    let removedCount = 0;
    for (let i = 0; i < allRows.length; i++) {
      const r = allRows[i];
      if (r.codes.some(c => EXCLUDE_CODES.has(c))) { removedCount++; continue; }
      if (r.emailVal && lastIndexByEmail.get(r.emailVal) !== i) { removedCount++; continue; }
      cleanCount++;
    }

    storedAllRows = allRows;
    storedHeaderLine = headerLine;
    storedEmailCol = emailCol;
    storedSep = sep;
    storedHeaders = headers;

    self.postMessage({
      type: 'done',
      totalRows, errorRows, warnRows,
      validRows: totalRows - errorRows - warnRows,
      issueRowsByCode, issueSummary,
      headers, emailCol, nameCol,
      cleanCount, removedCount,
    });

  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
}

async function handleGenerateClean() {
  try {
    const allRows = storedAllRows;
    const total = allRows.length;
    const lastIndexByEmail = new Map();
    for (let i = 0; i < total; i++) {
      if (allRows[i].emailVal) lastIndexByEmail.set(allRows[i].emailVal, i);
    }

    const cleanLines = [storedHeaderLine];
    const BATCH = 50000;

    for (let i = 0; i < total; i++) {
      const r = allRows[i];
      if (r.codes.some(c => EXCLUDE_CODES.has(c))) continue;
      if (r.emailVal && lastIndexByEmail.get(r.emailVal) !== i) continue;
      cleanLines.push(r.line);
      if (i % BATCH === 0) {
        self.postMessage({ type: 'clean_progress', progress: Math.round((i / total) * 100) });
      }
    }

    self.postMessage({ type: 'clean_done', cleanLines, cleanCount: cleanLines.length - 1 });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
}

async function handleGenerateRemoved() {
  try {
    const allRows = storedAllRows;
    const total = allRows.length;
    const lastIndexByEmail = new Map();
    for (let i = 0; i < total; i++) {
      if (allRows[i].emailVal) lastIndexByEmail.set(allRows[i].emailVal, i);
    }

    const removedLines = [storedHeaderLine];
    const BATCH = 50000;

    for (let i = 0; i < total; i++) {
      const r = allRows[i];
      let excluded = false;
      if (r.codes.some(c => EXCLUDE_CODES.has(c))) excluded = true;
      if (r.emailVal && lastIndexByEmail.get(r.emailVal) !== i) excluded = true;
      if (excluded) removedLines.push(r.line);
      if (i % BATCH === 0) {
        self.postMessage({ type: 'removed_progress', progress: Math.round((i / total) * 100) });
      }
    }

    self.postMessage({ type: 'removed_done', removedLines, removedCount: removedLines.length - 1 });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
}

async function handleVerify({ file }) {
  try {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    let headers = null;
    let emailCol = null;
    let sep = ';';
    let leftover = '';
    let isFirstChunk = true;
    let encoding = null;
    const fileSize = file.size;
    let offset = 0;
    let totalRows = 0;
    let notInOriginal = [];
    let duplicatesInClean = [];
    let seenInClean = new Map();

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

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '').trim();
        if (!line) continue;

        if (isFirstChunk && !headers) {
          sep = line.includes(';') ? ';' : ',';
          headers = parseCSVLine(line, sep).map(c => c.trim());
          emailCol = detectCol(headers, [/email/i, /correo/i, /^e-mail$/i, /^mail$/i]);
          isFirstChunk = false;
          continue;
        }

        if (!headers) continue;
        totalRows++;

        const cols = parseCSVLine(line, sep);
        const row = {};
        headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
        const emailVal = emailCol ? normalizeEmail(row[emailCol] ?? '') : '';

        if (emailVal && !originalEmailSet.has(emailVal) && notInOriginal.length < 500) {
          notInOriginal.push({ rowNum: totalRows + 1, email: emailVal });
        }
        if (emailVal && seenInClean.has(emailVal) && duplicatesInClean.length < 500) {
          duplicatesInClean.push({ rowNum: totalRows + 1, email: emailVal, firstRow: seenInClean.get(emailVal) });
        } else if (emailVal) {
          seenInClean.set(emailVal, totalRows + 1);
        }
      }

      self.postMessage({ type: 'verify_progress', progress });
    }

    // Procesar la última línea del archivo, que puede haber quedado en
    // `leftover` sin pasar por el bucle de arriba si el archivo no
    // termina con un salto de línea (muy común en exports de CSV) — sin
    // este bloque, el último contacto del archivo nunca se analiza y
    // puede aparecer incorrectamente marcado como "faltante".
    if (leftover.trim() && headers) {
      const line = leftover.replace(/\r$/, '').trim();
      totalRows++;

      const cols = parseCSVLine(line, sep);
      const row = {};
      headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
      const emailVal = emailCol ? normalizeEmail(row[emailCol] ?? '') : '';

      if (emailVal && !originalEmailSet.has(emailVal) && notInOriginal.length < 500) {
        notInOriginal.push({ rowNum: totalRows + 1, email: emailVal });
      }
      if (emailVal && seenInClean.has(emailVal) && duplicatesInClean.length < 500) {
        duplicatesInClean.push({ rowNum: totalRows + 1, email: emailVal, firstRow: seenInClean.get(emailVal) });
      } else if (emailVal) {
        seenInClean.set(emailVal, totalRows + 1);
      }
    }

    const lastIndexByEmail = new Map();
    for (let i = 0; i < storedAllRows.length; i++) {
      if (storedAllRows[i].emailVal) lastIndexByEmail.set(storedAllRows[i].emailVal, i);
    }
    const expectedCleanEmails = new Set();
    for (let i = 0; i < storedAllRows.length; i++) {
      const r = storedAllRows[i];
      if (r.codes.some(c => EXCLUDE_CODES.has(c))) continue;
      if (r.emailVal && lastIndexByEmail.get(r.emailVal) !== i) continue;
      if (r.emailVal) expectedCleanEmails.add(r.emailVal);
    }

    const missingFromClean = [];
    for (const email of expectedCleanEmails) {
      if (!seenInClean.has(email) && missingFromClean.length < 500) {
        missingFromClean.push(email);
      }
    }

    self.postMessage({
      type: 'verify_done',
      totalRows,
      originalTotal: storedAllRows.length,
      expectedCleanCount: expectedCleanEmails.size,
      notInOriginal,
      duplicatesInClean,
      missingFromClean,
    });

  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
}