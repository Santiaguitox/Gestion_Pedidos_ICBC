import { describe, it, expect } from 'vitest'
import { detectSep, evaluarCondicion, pasaFiltro } from '@/workers/segmentacion'
import { diffRows } from '@/workers/comparacion'

describe('detectSep', () => {
  it('elige el separador más frecuente de la primera línea', () => {
    expect(detectSep('nombre;email;telefono')).toBe(';')
    expect(detectSep('nombre,email,telefono')).toBe(',')
    expect(detectSep('nombre\temail\ttelefono')).toBe('\t')
  })

  it('con separadores mezclados gana el que más aparece (headers con comas en el texto)', () => {
    expect(detectSep('apellido, nombre;email;ciudad, provincia;cp')).toBe(';')
  })
})

describe('evaluarCondicion', () => {
  it('eq / neq comparan case-insensitive', () => {
    expect(evaluarCondicion('CABA', 'eq', 'caba')).toBe(true)
    expect(evaluarCondicion('CABA', 'neq', 'caba')).toBe(false)
    expect(evaluarCondicion('Rosario', 'eq', 'caba')).toBe(false)
  })

  it('contains / ncontains / starts', () => {
    expect(evaluarCondicion('juan@gmail.com', 'contains', 'GMAIL')).toBe(true)
    expect(evaluarCondicion('juan@gmail.com', 'ncontains', 'hotmail')).toBe(true)
    expect(evaluarCondicion('Buenos Aires', 'starts', 'buenos')).toBe(true)
    expect(evaluarCondicion('Buenos Aires', 'starts', 'aires')).toBe(false)
  })

  it('empty / nempty consideran vacío a los espacios en blanco', () => {
    expect(evaluarCondicion('   ', 'empty', '')).toBe(true)
    expect(evaluarCondicion('x', 'empty', '')).toBe(false)
    expect(evaluarCondicion('x', 'nempty', '')).toBe(true)
  })

  it('celda null/undefined se trata como string vacío, no explota', () => {
    expect(evaluarCondicion(null, 'empty', '')).toBe(true)
    expect(evaluarCondicion(undefined, 'contains', 'x')).toBe(false)
  })

  it('operador desconocido deja pasar la fila (fail-open documentado en el switch)', () => {
    expect(evaluarCondicion('x', 'operador-inventado', 'y')).toBe(true)
  })
})

describe('pasaFiltro', () => {
  const colIndex = { ciudad: 0, email: 1 }
  const fila = ['CABA', 'juan@gmail.com']

  it('sin condiciones pasa todo', () => {
    expect(pasaFiltro(fila, colIndex, [], true)).toBe(true)
  })

  it('AND exige todas; OR alcanza con una', () => {
    const condiciones = [
      { columna: 'ciudad', operador: 'eq', valor: 'caba' },
      { columna: 'email', operador: 'contains', valor: 'hotmail' },
    ]
    expect(pasaFiltro(fila, colIndex, condiciones, true)).toBe(false)
    expect(pasaFiltro(fila, colIndex, condiciones, false)).toBe(true)
  })

  it('una condición sobre una columna inexistente cuenta como false (no matchea, no explota)', () => {
    const condiciones = [{ columna: 'no-existe', operador: 'eq', valor: 'x' }]
    expect(pasaFiltro(fila, colIndex, condiciones, true)).toBe(false)
  })
})

describe('diffRows', () => {
  it('reporta solo las columnas cuyo valor cambió', () => {
    const rowA = { nombre: 'Juan', ciudad: 'CABA', plan: 'Gold' }
    const rowB = { nombre: 'Juan', ciudad: 'Rosario', plan: 'Black' }
    const diffs = diffRows(rowA, rowB, ['nombre', 'ciudad', 'plan'])
    expect(diffs).toEqual([
      { col: 'ciudad', valA: 'CABA', valB: 'Rosario' },
      { col: 'plan', valA: 'Gold', valB: 'Black' },
    ])
  })

  it('los espacios alrededor NO cuentan como cambio (trim antes de comparar)', () => {
    expect(diffRows({ a: ' x ' }, { a: 'x' }, ['a'])).toEqual([])
  })

  it('columna ausente en una fila se trata como vacío — vacío vs valor SÍ es cambio', () => {
    expect(diffRows({}, { a: 'x' }, ['a'])).toEqual([{ col: 'a', valA: '', valB: 'x' }])
    expect(diffRows({}, {}, ['a'])).toEqual([])
  })

  it('solo mira las columnas en común que le pasan — lo demás no existe para el diff', () => {
    expect(diffRows({ a: '1', b: '2' }, { a: '9', b: '9' }, ['a'])).toEqual([{ col: 'a', valA: '1', valB: '9' }])
  })
})
