import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { tipografiaDeEjemplo, conTipografiasCargadas, ValidarEstructuraHTML } from '../generales.js'
import { arreglarPieza } from '../arreglos.js'

let JSDOM = null
try { ({ JSDOM } = await import('jsdom')) } catch { /* sin jsdom: se saltean los que necesitan DOM */ }

describe('tipografiaDeEjemplo', () => {
  it('toma la primera que no es de sistema, respetando el nombre cargado', () => {
    expect(tipografiaDeEjemplo(['font-family: Arial, barlow, sans-serif;'], ['Barlow'])).toBe('Barlow')
  })
  it('limpia comillas y pone mayúsculas si no está cargada', () => {
    expect(tipografiaDeEjemplo(["font-family: 'museo sans', arial;"], [])).toBe('Museo Sans')
  })
  it('sin ninguna fuera de sistema usa la cargada por link, y si no, Open Sans', () => {
    expect(tipografiaDeEjemplo(['font-family: Arial, sans-serif;'], ['Roboto'])).toBe('Roboto')
    expect(tipografiaDeEjemplo([undefined, 'color: red'], [])).toBe('Open Sans')
  })
})

describe('arreglo sin comillas en el nombre de la tipografía', () => {
  it('las de varias palabras tampoco llevan comillas', () => {
    expect(conTipografiasCargadas('font-family: open sans, arial;', ['Open Sans'])).toBe('font-family: Open Sans, arial;')
  })
  it('la descarga de una pieza con "Open Sans" cargada no deja comillas', () => {
    const html = `<link href='https://fonts.googleapis.com/css2?family=Open+Sans&display=swap' rel='stylesheet'><p style="color: red; font-family: " open sans", arial; margin: 0">x</p>`
    const { html: salida } = arreglarPieza(html, ['Open Sans'])
    expect(salida).toContain('font-family: Open Sans, arial')
    expect(salida).not.toMatch(/font-family:\s*['"]/)
  })
})

describe.skipIf(!JSDOM)('consejo "Cómo se arregla" con la tipografía real de la pieza', () => {
  it('usa la tipografía de la pieza analizada en el ejemplo', () => {
    const html = readFileSync(new URL('./fixtures/style-partido.html', import.meta.url), 'utf8')
    const dom = new JSDOM(html)
    globalThis.NodeFilter = dom.window.NodeFilter
    const r = ValidarEstructuraHTML(dom.window.document, html)
    const texto = r.consejos[0].texto
    expect(texto).toContain('Ejemplo correcto: `style="font-family: Barlow, Arial, sans-serif;"`')
    expect(texto).toContain('La columna “Dónde se corta” indica el punto donde se interrumpe el estilo.')
  })
})
