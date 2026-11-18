import { describe, it, expect } from 'vitest'
import { normalizarNombre, revisarNombre, validarNombre } from '../nombre.js'
import { normalizarColor, esColorValido } from '../color.js'
import { limpiarHtmlCelda } from '../html.js'

describe('nombre del campo', () => {
  it('espacios y guiones pasan a guion bajo, no se borran', () => {
    expect(normalizarNombre('Mi Tabla-X')).toBe('Mi_Tabla_X')
    expect(normalizarNombre('  datos  tabla ')).toBe('datos_tabla')
    expect(normalizarNombre('Mi ', { recortar: false })).toBe('Mi_')
  })
  it('saca acentos y símbolos', () => {
    expect(normalizarNombre('Descripción ñandú!')).toBe('Descripcion_nandu')
    expect(normalizarNombre('a.b,c')).toBe('abc')
  })
  it('avisa si hubo que cambiar algo', () => {
    expect(revisarNombre('datos_tabla').cambio).toBe(false)
    expect(revisarNombre('mi tabla').cambio).toBe(true)
  })
  it('valida', () => {
    expect(validarNombre('datos_tabla').ok).toBe(true)
    expect(validarNombre('').ok).toBe(false)
    expect(validarNombre('1abc').ok).toBe(false)
    expect(validarNombre('EMAIL').ok).toBe(false)
    expect(validarNombre('a b').ok).toBe(false)
  })
})

describe('color', () => {
  it('normaliza a #rrggbb', () => {
    expect(normalizarColor('#ABC')).toBe('#aabbcc')
    expect(normalizarColor('E1F8FB')).toBe('#e1f8fb')
    expect(normalizarColor('rojo', '#111111')).toBe('#111111')
  })
  it('detecta válidos', () => {
    expect(esColorValido('#fff')).toBe(true)
    expect(esColorValido('xyz')).toBe(false)
  })
})

describe('limpiarHtmlCelda', () => {
  it('saca scripts, handlers y javascript:', () => {
    const s = limpiarHtmlCelda(`<img src='a.png' onerror="x()"><script>alert(1)</script><a href="javascript:alert(1)">x</a>`)
    expect(s).not.toMatch(/script/i)
    expect(s).not.toMatch(/onerror/i)
    expect(s).not.toMatch(/javascript:/i)
    expect(s).toContain("<img src='a.png'")
  })
})
