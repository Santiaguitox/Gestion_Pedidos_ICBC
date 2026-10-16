import { describe, it, expect } from 'vitest'
import { ValidarDimensionesImagenes } from '../imagenes.js'

let JSDOM = null
try { ({ JSDOM } = await import('jsdom')) } catch { /* sin jsdom: se saltean */ }

const doc = html => new JSDOM(html).window.document
const img = (attrs) => `<img src="https://x.com/a.png" alt="a" ${attrs}>`

describe.skipIf(!JSDOM)('Dimensiones: atributo vs style', () => {
  it('width="100%" con style width:100% y max-width:300px NO es inconsistente', async () => {
    const r = await ValidarDimensionesImagenes(
      doc(img('width="100%" style="display:block; width: 100%; height: auto; max-width: 300px !important"')), {})
    expect(r.ok).toBe(true)
  })

  it('max-width / min-width no se leen como width', async () => {
    const r = await ValidarDimensionesImagenes(
      doc(img('width="200" style="max-width: 300px; min-width: 50px"')), {})
    expect(r.ok).toBe(true)
  })

  it('line-height / max-height no se leen como height', async () => {
    const r = await ValidarDimensionesImagenes(
      doc(img('height="40" style="line-height: 10px; max-height: 99px"')), {})
    expect(r.ok).toBe(true)
  })

  it('una inconsistencia real en px se sigue detectando', async () => {
    const r = await ValidarDimensionesImagenes(
      doc(img('width="100" style="width: 300px"')), {})
    expect(r.ok).toBe(false)
    expect(r.checks[0].detalle).toContain('atributo: 100px, style: 300px')
  })

  it('width sin unidad cuenta como px', async () => {
    const r = await ValidarDimensionesImagenes(doc(img('width="100" style="width:100px"')), {})
    expect(r.ok).toBe(true)
  })
})
