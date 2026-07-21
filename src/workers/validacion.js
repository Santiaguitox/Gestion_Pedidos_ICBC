import { normalizeEmail } from '@/workers/worker-utils'

// Lógica de validación de contactos, extraída de validator.worker.js
// para poder testearla: el worker define self.onmessage al importarse
// (self no existe fuera del contexto de Web Worker), así que sus
// funciones internas eran imposibles de cubrir con la suite. Mismo
// criterio que worker-utils.js — el worker queda como cáscara de
// mensajería + IO por chunks, la lógica pura vive acá.

export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwam.com','yopmail.com',
  'trashmail.com','sharklasers.com','grr.la','spam4.me','10minutemail.com',
  'fakeinbox.com','dispostable.com','maildrop.cc','mailnull.com','spamgourmet.com',
  'trashmail.at','trashmail.io','trashmail.me','discard.email','spamhereplease.com',
  'getairmail.com','filzmail.com','throwam.com','mailexpire.com','spamex.com',
])

export const GENERIC_NAMES = new Set([
  'test','testing','prueba','asdf','xxxxx','noreply','no-reply','admin','info',
  'example','usuario','user','nombre','name','contact','contacto','cliente','client',
  'demo','sample','muestra','null','none','n/a','na',
])

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const SUSPICIOUS_TLD = /\.(xyz|top|click|loan|work|gdn|bid|win|download|accountant|webcam)$/i

// Antes este mapa vivía DENTRO de validateRow y se re-creaba en cada
// llamada — o sea, una vez por fila, sobre bases que pueden tener
// millones. Afuera se crea una sola vez (micro-fix aprovechando la
// extracción, sin cambio de comportamiento).
export const TYPO_DOMAINS = {
  'gmai.com':1,'gmial.com':1,'gmal.com':1,'gnail.com':1,'gamil.com':1,
  'hotnail.com':1,'hotmial.com':1,'hotmil.com':1,
  'yaho.com':1,'yhaoo.com':1,'yahooo.com':1,
  'outlok.com':1,'outook.com':1,'otlook.com':1,
}

export const EXCLUDE_CODES = new Set(['INVALID_FORMAT', 'TYPO_DOMAIN', 'EMPTY', 'DOUBLE_DOT'])

// Único lugar que decide si una fila se considera "excluida" de la base
// limpia — ver historial en validator.worker.js: antes este chequeo
// estaba repetido en 3 lugares distintos.
export function isExcluded(row) {
  return row.codes.some(c => EXCLUDE_CODES.has(c))
}

export function validateRow(row, emailCol, nameCol, seenEmails, rowNum) {
  const issues = []
  const raw = emailCol ? String(row[emailCol] ?? '').trim() : ''
  const email = normalizeEmail(raw)
  const name = nameCol ? String(row[nameCol] ?? '').trim() : ''

  if (!emailCol) {
    issues.push({ type: 'error', code: 'NO_EMAIL_COL', msg: 'No se encontró columna de email' })
  } else if (!email) {
    issues.push({ type: 'error', code: 'EMPTY', msg: 'Email vacío' })
  } else {
    if (!EMAIL_RE.test(email)) {
      issues.push({ type: 'error', code: 'INVALID_FORMAT', msg: 'Formato inválido' })
    } else {
      const [local, domain] = email.split('@')
      if (DISPOSABLE_DOMAINS.has(domain)) {
        issues.push({ type: 'error', code: 'DISPOSABLE', msg: `Dominio desechable: ${domain}` })
      }
      if (seenEmails.has(email)) {
        issues.push({ type: 'error', code: 'DUPLICATE', msg: `Duplicado (primera vez: fila ${seenEmails.get(email)})` })
      } else {
        seenEmails.set(email, rowNum)
      }
      if (email.includes('..')) {
        issues.push({ type: 'warning', code: 'DOUBLE_DOT', msg: 'Doble punto en el email' })
      }
      if (local.startsWith('.') || local.endsWith('.')) {
        issues.push({ type: 'warning', code: 'DOT_POSITION', msg: 'Punto al inicio/fin del usuario' })
      }
      if (SUSPICIOUS_TLD.test(domain)) {
        issues.push({ type: 'warning', code: 'SUSPICIOUS_TLD', msg: `TLD sospechoso: .${domain.split('.').pop()}` })
      }
      if (TYPO_DOMAINS[domain]) {
        issues.push({ type: 'error', code: 'TYPO_DOMAIN', msg: `Posible typo en dominio: ${domain}` })
      }
    }
  }

  if (nameCol) {
    if (!name) {
      issues.push({ type: 'warning', code: 'EMPTY_NAME', msg: 'Nombre vacío' })
    } else {
      if (GENERIC_NAMES.has(name.toLowerCase())) {
        issues.push({ type: 'warning', code: 'GENERIC_NAME', msg: `Nombre genérico: "${name}"` })
      }
      if (/[<>{}\\|/\d]/.test(name)) {
        issues.push({ type: 'warning', code: 'ODD_NAME', msg: 'Nombre con caracteres raros o números' })
      }
      if (name.length < 2) {
        issues.push({ type: 'warning', code: 'SHORT_NAME', msg: 'Nombre demasiado corto' })
      }
    }
  }

  return issues
}
