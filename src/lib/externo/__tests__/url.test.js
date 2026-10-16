import { describe, it, expect } from 'vitest'
import { Buffer } from 'node:buffer'
import { validarUrl, decodificarQuery, idDePieza, nombreDescarga } from '../url.js'

const b64 = s => Buffer.from(s).toString('base64')

describe('validarUrl', () => {
  it('acepta icommarketing.com y subdominios', () => {
    expect(validarUrl('https://icbc-avisos.icommarketing.com/x?y=1').ok).toBe(true)
    expect(validarUrl('icbc.icommarketing.com/x').ok).toBe(true)
  })
  it('rechaza otros dominios y falsos subdominios', () => {
    expect(validarUrl('https://example.com').error).toMatch(/icommarketing\.com/)
    expect(validarUrl('https://evilicommarketing.com').ok).toBe(false)
    expect(validarUrl('https://icommarketing.com.evil.com').ok).toBe(false)
  })
  it('rechaza vacío, basura y esquemas raros', () => {
    expect(validarUrl('').ok).toBe(false)
    expect(validarUrl('::: no').error).toMatch(/no es válida/)
    expect(validarUrl('ftp://a.icommarketing.com').ok).toBe(false)
  })
})

describe('descarga', () => {
  const q = '&pieza=98765&x=1'
  it('decodifica el query en Base64 con el relleno reemplazado por 2', () => {
    for (const texto of ['cliente=12' + q, 'cliente=1' + q, 'cliente=123' + q]) {
      const enc = b64(texto).replace(/=+$/, '2')
      const url = `https://a.icommarketing.com/ver?${enc}`
      expect(decodificarQuery(new URL(url).search)).toBe(texto)
      expect(idDePieza(url)).toBe('98765')
    }
  })
  it('también acepta Base64 normal y query en texto plano', () => {
    expect(idDePieza(`https://a.icommarketing.com/v?${b64('a=1&pieza=55')}`)).toBe('55')
    expect(idDePieza('https://a.icommarketing.com/v?pieza=77')).toBe('77')
  })
  it('arma {subdominio}_pieza_{id}.html y cae a {subdominio}_pieza.html', () => {
    expect(nombreDescarga(`https://icbc-avisos.icommarketing.com/v?${b64('pieza=12')}`)).toBe('icbc-avisos_pieza_12.html')
    expect(nombreDescarga('https://mishka.icommarketing.com/v?nada=1')).toBe('mishka_pieza.html')
    expect(nombreDescarga('https://icommarketing.com/')).toBe('pieza_pieza.html')
  })
})
