import { describe, expect, it } from 'vitest'
import { contenidoDeArchivo } from '../archivo.js'

describe('contenidoDeArchivo', () => {
  it('por defecto no toca el texto', () => {
    expect(contenidoDeArchivo('a\nb')).toBe('a\nb')
  })
  it('crlf convierte todos los saltos a \\r\\n sin duplicarlos', () => {
    expect(contenidoDeArchivo('a\nb\r\nc', { crlf: true })).toBe('a\r\nb\r\nc')
  })
  it('no agrega salto de línea al final', () => {
    expect(contenidoDeArchivo('a\nb', { crlf: true }).endsWith('\n')).toBe(false)
  })
  it('el BOM solo se agrega si se pide', () => {
    expect(contenidoDeArchivo('email;x', { bom: true }).charCodeAt(0)).toBe(0xfeff)
    expect(contenidoDeArchivo('email;x').charCodeAt(0)).not.toBe(0xfeff)
  })
})
