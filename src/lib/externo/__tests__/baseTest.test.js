import { describe, it, expect } from 'vitest'
import { camposDeBase, escaparValorCsv, generarCsvBaseTest, nombreBaseTest, parsearEmails, tipoCampo, valorPorDefecto, URL_LINK_DEFAULT } from '../baseTest.js'

describe('baseTest', () => {
  it('toma las variables únicas en orden y deja Email aparte', () => {
    const html = '<p><*Nombre*> <*Email*> <a href="<*LinkBoton*>"><*Nombre*></a> &lt;*Dirección*&gt;</p>'
    expect(camposDeBase(html)).toEqual({ campos: ['Nombre', 'LinkBoton', 'Dirección'], tieneEmail: true })
  })
  it('detecta el tipo por el nombre y arranca con un valor que funciona', () => {
    expect(tipoCampo('LinkBoton')).toBe('link')
    expect(tipoCampo('ImagenHeader')).toBe('imagen')
    expect(tipoCampo('Dirección')).toBe('texto')
    expect(valorPorDefecto('URL_CTA')).toBe(URL_LINK_DEFAULT)
    expect(valorPorDefecto('Nombre')).toBe('Nombre Test')
  })
  it('arma el csv con ; y una fila por email', () => {
    const csv = generarCsvBaseTest(['Nombre', 'Dirección'], { Nombre: 'Ana', Dirección: 'Av. Corrientes; CABA' }, ['a@x.com', 'b@x.com'])
    expect(csv).toBe('Email;Nombre;Dirección\na@x.com;Ana;"Av. Corrientes; CABA"\nb@x.com;Ana;"Av. Corrientes; CABA"')
  })
  it('escapa comillas y saltos de línea', () => {
    expect(escaparValorCsv('dijo "hola"', ';')).toBe('"dijo ""hola"""')
    expect(escaparValorCsv('a\nb', ';')).toBe('"a\nb"')
    expect(escaparValorCsv('simple', ';')).toBe('simple')
  })
  it('parsea emails por línea, coma o ;, sin repetir y marcando los inválidos', () => {
    expect(parsearEmails('a@x.com\nb@x.com, A@x.com; roto')).toEqual({ validos: ['a@x.com', 'b@x.com'], invalidos: ['roto'] })
    expect(parsearEmails('')).toEqual({ validos: [], invalidos: [] })
  })
  it('nombra el archivo a partir de la pieza', () => {
    expect(nombreBaseTest('sony-ar_pieza_21012855.html', 'csv')).toBe('sony-ar_base_test_21012855.csv')
    expect(nombreBaseTest('x_pieza.html', 'txt')).toBe('x_base_test.txt')
    expect(nombreBaseTest('', 'csv')).toBe('pieza_base_test.csv')
  })
})
