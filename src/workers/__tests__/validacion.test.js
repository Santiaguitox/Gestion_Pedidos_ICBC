import { describe, it, expect } from 'vitest'
import { validateRow, isExcluded, EXCLUDE_CODES } from '@/workers/validacion'

// validateRow es el corazón del validador de bases: decide qué
// contactos entran a la base limpia y cuáles se excluyen. Cada código
// tiene una consecuencia real (isExcluded saca la fila de la base que
// se envía) — estos tests fijan la matriz completa de decisiones.

const codes = issues => issues.map(i => i.code)
const validar = (row, { emailCol = 'email', nameCol = null, seen = new Map(), rowNum = 1 } = {}) =>
  validateRow(row, emailCol, nameCol, seen, rowNum)

describe('validateRow — email', () => {
  it('email válido y limpio: sin issues', () => {
    expect(validar({ email: 'juan.perez@gmail.com' })).toEqual([])
  })

  it('sin columna de email detectada → NO_EMAIL_COL (error de archivo, no de fila)', () => {
    expect(codes(validar({}, { emailCol: null }))).toEqual(['NO_EMAIL_COL'])
  })

  it('email vacío → EMPTY', () => {
    expect(codes(validar({ email: '   ' }))).toEqual(['EMPTY'])
  })

  it('formato inválido → INVALID_FORMAT (y no sigue chequeando lo demás)', () => {
    expect(codes(validar({ email: 'no-es-un-email' }))).toEqual(['INVALID_FORMAT'])
    expect(codes(validar({ email: 'sin@tld' }))).toEqual(['INVALID_FORMAT'])
    expect(codes(validar({ email: 'a b@test.com' }))).toEqual(['INVALID_FORMAT'])
  })

  it('dominio desechable → DISPOSABLE', () => {
    expect(codes(validar({ email: 'x@mailinator.com' }))).toContain('DISPOSABLE')
  })

  it('typo de dominio conocido → TYPO_DOMAIN', () => {
    expect(codes(validar({ email: 'juan@gmai.com' }))).toContain('TYPO_DOMAIN')
    expect(codes(validar({ email: 'ana@hotmial.com' }))).toContain('TYPO_DOMAIN')
  })

  it('TLD sospechoso → SUSPICIOUS_TLD (warning, no excluye)', () => {
    const issues = validar({ email: 'x@promos.xyz' })
    expect(codes(issues)).toContain('SUSPICIOUS_TLD')
    expect(issues.find(i => i.code === 'SUSPICIOUS_TLD').type).toBe('warning')
  })

  it('doble punto → DOUBLE_DOT; punto al inicio/fin del usuario → DOT_POSITION', () => {
    expect(codes(validar({ email: 'juan..perez@gmail.com' }))).toContain('DOUBLE_DOT')
    expect(codes(validar({ email: '.juan@gmail.com' }))).toContain('DOT_POSITION')
    expect(codes(validar({ email: 'juan.@gmail.com' }))).toContain('DOT_POSITION')
  })
})

describe('validateRow — duplicados', () => {
  it('la primera aparición registra el email; la segunda es DUPLICATE citando la fila original', () => {
    const seen = new Map()
    expect(validar({ email: 'a@test.com' }, { seen, rowNum: 3 })).toEqual([])
    const issues = validar({ email: 'a@test.com' }, { seen, rowNum: 8 })
    expect(codes(issues)).toEqual(['DUPLICATE'])
    expect(issues[0].msg).toContain('fila 3')
  })

  it('los duplicados se detectan tras normalizar: mayúsculas y espacios no los esquivan', () => {
    const seen = new Map()
    validar({ email: 'a@test.com' }, { seen, rowNum: 1 })
    expect(codes(validar({ email: '  A@TEST.com ' }, { seen, rowNum: 2 }))).toEqual(['DUPLICATE'])
  })
})

describe('validateRow — nombre', () => {
  const conNombre = nombre => validar({ email: 'ok@test.com', nombre }, { nameCol: 'nombre' })

  it('nombre vacío → EMPTY_NAME (warning)', () => {
    expect(codes(conNombre(''))).toEqual(['EMPTY_NAME'])
  })

  it('nombre genérico (test, prueba, asdf...) → GENERIC_NAME', () => {
    expect(codes(conNombre('Prueba'))).toContain('GENERIC_NAME')
    expect(codes(conNombre('test'))).toContain('GENERIC_NAME')
  })

  it('nombre con números o caracteres raros → ODD_NAME', () => {
    expect(codes(conNombre('Juan123'))).toContain('ODD_NAME')
    expect(codes(conNombre('Juan <script>'))).toContain('ODD_NAME')
  })

  it('nombre de un solo carácter → SHORT_NAME', () => {
    expect(codes(conNombre('J'))).toContain('SHORT_NAME')
  })

  it('nombre normal con tilde: sin issues', () => {
    expect(conNombre('José Pérez')).toEqual([])
  })
})

describe('isExcluded', () => {
  it('excluye por los códigos duros (formato, typo, vacío, doble punto)', () => {
    for (const code of EXCLUDE_CODES) {
      expect(isExcluded({ codes: [code] })).toBe(true)
    }
  })

  it('NO excluye por warnings ni por DISPOSABLE/DUPLICATE (esos se reportan pero la decisión de sacarlos es aparte)', () => {
    expect(isExcluded({ codes: ['SUSPICIOUS_TLD'] })).toBe(false)
    expect(isExcluded({ codes: ['GENERIC_NAME', 'SHORT_NAME'] })).toBe(false)
    expect(isExcluded({ codes: ['DISPOSABLE'] })).toBe(false)
    expect(isExcluded({ codes: ['DUPLICATE'] })).toBe(false)
    expect(isExcluded({ codes: [] })).toBe(false)
  })

  it('alcanza con UN código excluyente entre varios', () => {
    expect(isExcluded({ codes: ['GENERIC_NAME', 'TYPO_DOMAIN'] })).toBe(true)
  })
})
