import { describe, it, expect } from 'vitest'
import { decodificarProtegidos, resumirProtegidos } from '../protegidos.js'
import { DetectarContenidoDuplicado } from '../generales.js'
import { arreglarPieza } from '../arreglos.js'

const enc = s => `<!--{cke_protected}{C}${encodeURIComponent(s)}-->`

describe('comentarios {cke_protected} del editor', () => {
  it('repone el CSS de un <style> y los comentarios condicionales de Outlook', () => {
    const css = '<!--\n[style*=\'archivo\'] {font-family: \'Archivo\', sans-serif !important;}\n-->'
    const mso = '<!--[if (gte mso 9)|(IE)]><table width=\'600\'><tr><td><![endif]-->'
    const html = `<style type="text/css">${enc(css)}</style><body>${enc(mso)}<p>hola</p></body>`
    const r = decodificarProtegidos(html)
    expect(r.cantidad).toBe(2)
    expect(r.html).toBe(`<style type="text/css">${css}</style><body>${mso}<p>hola</p></body>`)
  })

  it('un % inválido no rompe: ese comentario queda como estaba', () => {
    const html = '<!--{cke_protected}{C}%E0%A4%A-->'
    expect(decodificarProtegidos(html)).toEqual({ html, cantidad: 0 })
  })

  it('resume cuántos hay y de qué son', () => {
    const html = enc('<!--\na {color: red;}\n-->') + enc('<!--[if mso]><table><![endif]-->') + enc('<!--HEADER-->')
    expect(resumirProtegidos(html)).toEqual({ total: 3, css: 1, outlook: 1 })
  })

  it('arreglarPieza los repone y lo informa aparte de las etiquetas', () => {
    const r = arreglarPieza(`<style>${enc('<!--\na {color: red;}\n-->')}</style>`, [])
    expect(r.cambios).toBe(0)
    expect(r.protegidos).toBe(1)
    expect(r.html).toContain('a {color: red;}')
    expect(r.html).not.toContain('cke_protected')
  })
})

describe('comillas de los style dentro de lo repuesto', () => {
  it("style='...font-family: 'Ubuntu'...' pasa a comillas dobles con la tipografía SIN comillas, y los style sanos no cambian", () => {
    const mso = "<!--[if (gte mso 9)|(IE)]><table width='600' align='center' style='border-spacing:0;font-family: 'Ubuntu', sans-serif;color:#333333;' ><tr><td style='padding-top:0;padding-left:0;' ><![endif]-->"
    const r = decodificarProtegidos(enc(mso))
    expect(r.html).toBe("<!--[if (gte mso 9)|(IE)]><table width='600' align='center' style=\"border-spacing:0;font-family: Ubuntu, sans-serif;color:#333333;\" ><tr><td style='padding-top:0;padding-left:0;' ><![endif]-->")
  })
})

describe('tipografías sin comillas dentro de lo repuesto', () => {
  it("tipografía de varias palabras: font-family: 'Open Sans', Arial pasa a Open Sans, Arial", () => {
    const mso = "<!--[if mso]><td style='color:#000;font-family: 'Open Sans', Arial, sans-serif;margin:0' ><![endif]-->"
    const r = decodificarProtegidos(enc(mso))
    expect(r.html).toBe('<!--[if mso]><td style="color:#000;font-family: Open Sans, Arial, sans-serif;margin:0" ><![endif]-->')
  })
})

describe('bloques <style> distintos vs repetidos', () => {
  it('dos <style> distintos: aviso menor (advertencia), no error', () => {
    const r = DetectarContenidoDuplicado('<head><style>a{color:red}</style><style>b{color:blue}</style></head>')
    expect(r).toHaveLength(1)
    expect(r[0].advertencia).toBe(true)
  })

  it('dos <style> idénticos: error (head pegado dos veces)', () => {
    const r = DetectarContenidoDuplicado('<head><style>a{color:red}</style><style>a{color:red}</style></head>')
    expect(r).toHaveLength(1)
    expect(r[0].advertencia).toBeUndefined()
  })

  it('el style codificado por el editor se compara ya decodificado', () => {
    const css = '<!--\na{color:red}\n-->'
    const r = DetectarContenidoDuplicado(`<head><style>a{color:red}</style><style>${enc(css)}</style></head>`)
    expect(r[0].advertencia).toBeUndefined() // mismo CSS: está repetido
  })
})

describe('estructuras de Outlook codificadas', () => {
  it('si están como comentario del editor no se avisa que faltan', async () => {
    const { DetectarEstructurasOutlook } = await import('../generales.js')
    const html = `<body>${enc("<!--[if mso]><table><tr><td><![endif]-->")}</body>`
    expect(DetectarEstructurasOutlook(html)).toEqual([])
  })

  it('si no hay ninguna, sigue avisando', async () => {
    const { DetectarEstructurasOutlook } = await import('../generales.js')
    expect(DetectarEstructurasOutlook('<body></body>')).toHaveLength(1)
  })
})
