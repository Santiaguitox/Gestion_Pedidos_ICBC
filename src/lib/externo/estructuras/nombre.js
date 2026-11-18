// Nombre del campo tipo tabla (y de las variables extra de la base).
// Aparece en tres lugares del template (<!--CampoTabla_NOMBRE-->, <*NOMBRE*> y
// <!--/CampoTabla_NOMBRE-->) y en el encabezado del CSV, así que tiene que ser
// un identificador simple: letras, números y guion bajo.

import { NOMBRES_RESERVADOS } from './constantes.js'

/**
 * Convierte lo que escribió la persona en un nombre válido.
 * Espacios y guiones pasan a "_" (no se borran en silencio) y se quitan acentos
 * y cualquier otro símbolo.
 */
export function normalizarNombre(texto, { recortar = true } = {}) {
  const base = String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return (recortar ? base.trim() : base)
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
}

/** Normaliza e informa si hubo que cambiar algo (para avisarlo en pantalla). */
export function revisarNombre(texto) {
  const valor = normalizarNombre(texto)
  return { valor, cambio: valor !== String(texto ?? '').trim() }
}

export function validarNombre(nombre, { reservados = NOMBRES_RESERVADOS } = {}) {
  const n = String(nombre ?? '')
  if (!n) return { ok: false, error: 'Falta el nombre.' }
  if (!/^[A-Za-z0-9_]+$/.test(n)) return { ok: false, error: 'Solo letras, números y guion bajo.' }
  if (/^[0-9]/.test(n)) return { ok: false, error: 'No puede empezar con un número.' }
  if (reservados.some(r => r.toLowerCase() === n.toLowerCase())) {
    return { ok: false, error: `"${n}" ya lo usa la base: elegí otro nombre.` }
  }
  return { ok: true, error: '' }
}
