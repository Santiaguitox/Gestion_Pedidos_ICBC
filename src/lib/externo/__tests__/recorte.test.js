import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { recortarPieza, documentoVistaPrevia, encontrarContenedor } from '../recorte.js'

const leer = n => fs.readFileSync(fileURLToPath(new URL(`./fixtures/${n}.html`, import.meta.url)), 'utf8')

describe('recortarPieza con piezas reales', () => {
  it('pieza custom (Table_01): conserva la variable sin escapar, el preheader y el style', () => {
    const r = recortarPieza(leer('icbc-avisos'))
    expect(r.recortado).toBe(true)
    expect(r.tipo).toBe('custom')
    expect(r.estilos).toBe(1)
    expect(r.html).toContain('<*Info4*>')
    expect(r.html).not.toContain('&lt;*Info4*&gt;')
    expect(r.html).toMatch(/id=["']Table_01["']/i)
    expect(r.html.startsWith('<style')).toBe(true)
    expect(r.html).not.toMatch(/<html|<head|<body/i)
  })
  it('pieza del editor (backgroundTable)', () => {
    const r = recortarPieza(leer('mishka'))
    expect(r.recortado).toBe(true)
    expect(r.tipo).toBe('editor')
    expect(r.html).toMatch(/id=["']backgroundTable["']/i)
  })
  it('deja afuera el style VML de la plataforma', () => {
    for (const n of ['icbc-avisos', 'mishka']) {
      expect(recortarPieza(leer(n)).html).not.toMatch(/behavior:\s*url\(#default#VML\)/)
    }
  })
})

describe('pieza con media query de 600px', () => {
  it('se recorta bien y conserva variable, preheader y style', () => {
    const r = recortarPieza(leer('icbc-ddm'))
    expect(r.tipo).toBe('custom')
    expect(r.html).toContain('<*Nombre*>')
    expect(r.html).toContain('El Futuro nos Inspira.')
    expect(r.html).toContain('max-width: 600px')
  })
})

describe('recortarPieza casos armados', () => {
  it('balancea tablas anidadas e ignora las de comentarios de Outlook', () => {
    const html = '<html><head><style>a{}</style></head><body><table id="Table_01"><tr><td><!--[if mso]><table><tr><td><![endif]--><table><tr><td>x</td></tr></table></td></tr></table><p>afuera</p></body></html>'
    const r = recortarPieza(html)
    expect(r.html.endsWith('</table>')).toBe(true)
    expect(r.html).not.toContain('afuera')
    expect(r.html).toContain('x')
  })
  it('id sin importar mayúsculas', () => {
    expect(recortarPieza('<body><TABLE ID="BACKGROUNDTABLE"><tr><td>1</td></tr></TABLE></body>').tipo).toBe('editor')
  })
  it('sin contenedor: devuelve el HTML original', () => {
    const r = recortarPieza('<html><body><p>hola</p></body></html>')
    expect(r.recortado).toBe(false)
    expect(r.tipo).toBeNull()
    expect(r.html).toBe('<html><body><p>hola</p></body></html>')
  })
  it('contenedor sin cierre: no recorta', () => {
    expect(encontrarContenedor('<table id="Table_01"><tr><td>x</td></tr>')).toBeNull()
  })
  it('conserva un comentario condicional con <style> del head', () => {
    const html = '<head><!--[if mso]><style>.x{}</style><![endif]--></head><table id="Table_01"><tr><td>1</td></tr></table>'
    expect(recortarPieza(html).html).toContain('[if mso]')
  })
})

describe('documentoVistaPrevia', () => {
  it('envuelve el fragmento con base _blank', () => {
    const doc = documentoVistaPrevia(recortarPieza('<table id="Table_01"><tr><td>1</td></tr></table>'))
    expect(doc).toContain('<base target="_blank">')
    expect(doc).toContain('<table id="Table_01">')
  })
  it('sin recorte inserta base en el head original', () => {
    expect(documentoVistaPrevia(recortarPieza('<html><head></head><body>x</body></html>'))).toContain('<head><base target="_blank"><style>html{background:#fff}</style>')
  })
})
