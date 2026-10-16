import { describe, it, expect } from 'vitest'
import { ValidarLinks } from '../generales.js'
import { tipoDeLink } from '../inventarioLinks.js'

let JSDOM = null
try { ({ JSDOM } = await import('jsdom')) } catch { /* sin jsdom: se saltean los que necesitan DOM */ }

// ValidarLinks usa NodeFilter como global del navegador.
const doc = html => {
  const dom = new JSDOM(html)
  globalThis.NodeFilter = dom.window.NodeFilter
  return dom.window.document
}

describe.skipIf(!JSDOM)('Links: href que es solo "#"', () => {
  it('un link de imagen con "#" es error y se nombra con el alt de la imagen', () => {
    const r = ValidarLinks(doc('<a href="#" target="_blank"><img src="a.png" alt="Aprovechá y volá"></a>'))
    expect(r.ok).toBe(false)
    expect(r.checks.map(c => c.detalle)).toEqual(['Link de imagen "Aprovechá y volá" apunta solo a "#": falta el destino'])
  })

  it('un link de texto con "#" es error', () => {
    const r = ValidarLinks(doc('<a href="#" target="_blank">Ver más</a>'))
    expect(r.ok).toBe(false)
    expect(r.checks[0].detalle).toContain('Link "Ver más" apunta solo a "#"')
  })

  it('un ancla real (#seccion) no es error', () => {
    const r = ValidarLinks(doc('<a href="#seccion" target="_blank">Ir</a>'))
    expect(r.checks.some(c => /solo a "#"/.test(c.detalle))).toBe(false)
  })

  it('href vacío de una imagen también usa el alt', () => {
    const r = ValidarLinks(doc('<a href="" target="_blank"><img src="a.png" alt="Logo"></a>'))
    expect(r.checks[0].detalle).toBe('Link de imagen "Logo" tiene el href vacío')
  })

  it('el inventario distingue "#" pelado de un ancla', () => {
    expect(tipoDeLink('#')).toBe('placeholder')
    expect(tipoDeLink('#seccion')).toBe('ancla')
  })
})
