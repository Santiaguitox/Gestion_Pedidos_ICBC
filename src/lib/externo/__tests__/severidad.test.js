// Severidad de dos chequeos que NO deben ser error:
//  - falta de estructuras condicionales de Outlook
//  - clases usadas sin definir en el <style>
// Necesitan DOM: se saltean si jsdom no está instalado (npm i -D jsdom).
import { describe, it, expect } from 'vitest'

let JSDOM = null
try { ({ JSDOM } = await import('jsdom')) } catch { /* sin jsdom */ }

const { ValidarEstructuraHTML, ValidarClasesDefinidas } = await import('../generales.js')
const { ValidarDimensionesImagenes } = await import('../imagenes.js')
const doc = html => new JSDOM(html).window.document

describe.skipIf(!JSDOM)('severidad', () => {
  const OUTLOOK = '<!--[if mso]><table><tr><td><![endif]-->x<!--[if mso]></td></tr></table><![endif]-->'

  it('sin estructuras de Outlook: advertencia, no error', () => {
    const html = '<html><body><table><tbody><tr><td>x</td></tr></tbody></table></body></html>'
    const r = ValidarEstructuraHTML(doc(html), html)
    expect(r.ok).toBe(false)
    expect(r.advertencia).toBe(true)
    expect(r.checks[0].detalle).toMatch(/Outlook/)
  })
  it('con estructuras de Outlook y todo bien: OK', () => {
    const html = `<html><body><table><tbody><tr><td>${OUTLOOK}</td></tr></tbody></table></body></html>`
    expect(ValidarEstructuraHTML(doc(html), html).ok).toBe(true)
  })
  it('con un error real, sigue siendo error y el aviso de Outlook queda como detalle menor', () => {
    const html = '<html><body><table><tbody><tr><td><img alt="a"></td></tr></tbody></table></body></html>'
    const r = ValidarEstructuraHTML(doc(html), html)
    expect(r.ok).toBe(false)
    expect(r.advertencia).toBeUndefined()
    expect(r.checks.some(c => /src/.test(c.detalle))).toBe(true)
    expect(r.advertencias.some(c => /Outlook/.test(c.detalle))).toBe(true)
  })
  it('clase sin definir en el style: advertencia', () => {
    const r = ValidarClasesDefinidas(doc('<html><head><style>.a{}</style></head><body><div class="a screen-container">x</div></body></html>'))
    expect(r.ok).toBe(false)
    expect(r.advertencia).toBe(true)
    expect(r.detalle).toMatch(/screen-container/)
  })

  it('dimensiones: atributo y style distintos es advertencia', async () => {
    const d = doc('<img src="https://x.com/a.png" width="600" style="width:500px" alt="a">')
    const r = await ValidarDimensionesImagenes(d, {})
    expect(r.ok).toBe(false)
    expect(r.advertencia).toBe(true)
    expect(r.checks[0].detalle).toMatch(/inconsistente/)
  })
  it('dimensiones: proporción incorrecta sigue siendo error', async () => {
    const d = doc('<img src="https://x.com/a.png" width="600" height="300" alt="a">')
    const r = await ValidarDimensionesImagenes(d, { 'https://x.com/a.png': { peso: 1, width: 600, height: 425, formato: 'png' } })
    expect(r.ok).toBe(false)
    expect(r.advertencia).toBeUndefined()
    expect(r.checks[0].detalle).toMatch(/Proporción incorrecta/)
  })
  it('dimensiones: error de proporción + inconsistencia: error, la inconsistencia va como detalle menor', async () => {
    const d = doc('<img src="https://x.com/a.png" width="600" height="300" style="width:500px" alt="a">')
    const r = await ValidarDimensionesImagenes(d, { 'https://x.com/a.png': { peso: 1, width: 600, height: 425, formato: 'png' } })
    expect(r.advertencia).toBeUndefined()
    expect(r.advertencias.some(a => /inconsistente/.test(a.detalle))).toBe(true)
  })
})
