// Conteo de <style> y clases definidas en TODOS los bloques de estilo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DetectarContenidoDuplicado, tipografiasCargadas } from '../generales.js'
import { arreglarPieza } from '../arreglos.js'
import { reconstruirStyleRoto } from '../reconstruirAtributos.js'

let JSDOM = null
try { ({ JSDOM } = await import('jsdom')) } catch { /* sin jsdom */ }
const { ValidarClasesDefinidas } = await import('../generales.js')

const sony = readFileSync(new URL('./fixtures/sony-cumple.html', import.meta.url), 'utf8')

describe('bloques <style> propios', () => {
  it('el <style> de un comentario condicional de Outlook no cuenta', () => {
    expect(DetectarContenidoDuplicado(sony)).toEqual([])
  })
  it('dos <style> reales siguen avisando', () => {
    const html = '<head><style>a{}</style><style>b{}</style></head><body></body>'
    expect(DetectarContenidoDuplicado(html)).toHaveLength(1)
  })
  it('un <style> normal + uno condicional de Outlook: sin aviso', () => {
    const html = '<head><style>a{}</style><!--[if mso]><style>b{}</style><![endif]--></head>'
    expect(DetectarContenidoDuplicado(html)).toEqual([])
  })
})

describe.skipIf(!JSDOM)('alt de imágenes', () => {
  const doc = html => new JSDOM(html).window.document
  it('sin alt o alt vacío: advertencia, no error', async () => {
    const { ValidarAltImagenes } = await import('../generales.js')
    const r = ValidarAltImagenes(doc('<body><img src="a.png"><img src="b.png" alt=""><img src="c.png" alt="ok"></body>'))
    expect(r.ok).toBe(false)
    expect(r.advertencia).toBe(true)
    expect(r.checks).toHaveLength(2)
  })
  it('todas con alt: ok', async () => {
    const { ValidarAltImagenes } = await import('../generales.js')
    expect(ValidarAltImagenes(doc('<body><img src="a.png" alt="x"></body>')).ok).toBe(true)
  })
})

describe.skipIf(!JSDOM)('alt de imágenes', () => {
  const doc = html => new JSDOM(html).window.document
  it('sin alt o alt vacío: advertencia, no error', async () => {
    const { ValidarAltImagenes } = await import('../generales.js')
    const r = ValidarAltImagenes(doc('<body><img src="a.png"><img src="b.png" alt=""><img src="c.png" alt="ok"></body>'))
    expect(r.ok).toBe(false)
    expect(r.advertencia).toBe(true)
    expect(r.checks).toHaveLength(2)
  })
  it('todas con alt: ok', async () => {
    const { ValidarAltImagenes } = await import('../generales.js')
    expect(ValidarAltImagenes(doc('<body><img src="a.png" alt="x"></body>')).ok).toBe(true)
  })
})

describe.skipIf(!JSDOM)('clases definidas en cualquier <style>', () => {
  const doc = html => new JSDOM(html).window.document
  it('definida en el segundo <style> o dentro de @media: ok', () => {
    const r = ValidarClasesDefinidas(doc('<head><style>.a{}</style><style media="screen"><!-- @media (max-width:600px){ .b{x:y} } --></style></head><body class="a"><p class="b"></p></body>'))
    expect(r.ok).toBe(true)
  })
  it('definida solo en un <style> de comentario condicional: ok', () => {
    const r = ValidarClasesDefinidas(doc('<head><!--[if mso]><style>.solo-outlook{x:y}</style><![endif]--></head><body><p class="solo-outlook"></p></body>'))
    expect(r.ok).toBe(true)
  })
  it('pieza Sony: img (selector de elemento) no define .img; las 5 quedan como advertencia', () => {
    const r = ValidarClasesDefinidas(doc(sony))
    expect(r.advertencia).toBe(true)
    expect(r.detalle).toMatch(/img, nota-hero, footer-bar, text-footer, link-footer-u/)
  })
})

describe.skipIf(!JSDOM)('style partido por comillas', () => {
  it('pieza real: 12 etiquetas agrupadas en un error, con decimal y tipografía repuestos', async () => {
    const { ValidarEstructuraHTML } = await import('../generales.js')
    const html = readFileSync(new URL('./fixtures/style-partido.html', import.meta.url), 'utf8')
    const r = ValidarEstructuraHTML(new JSDOM(html).window.document, html)
    expect(r.ok).toBe(false)
    expect(r.checks).toHaveLength(1)
    expect(r.detalle).toBe('1 problema de estructura encontrado')
    const g = r.checks[0].estilosPartidos
    expect(g.total).toBe(12)
    expect(g.corregidas).toBe(12)
    expect(g.etiquetas[0].etiqueta).toBe('<p class="title">')
    expect(g.etiquetas[0].sugerido).toContain('line-height: 1.05;')
    expect(g.etiquetas[0].sugerido).toContain('font-family: Barlow, arial')
    expect(r.consejos?.[0].titulo).toBe('Cómo se arregla')
  })
})

describe('tipografías cargadas', () => {
  it('lee Google Fonts (css2 y css, con espacios y varias familias)', () => {
    const html = "<link href='https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&family=Barlow&display=swap' rel='stylesheet'><style>@import url('https://fonts.googleapis.com/css?family=Roboto|Lato');</style>"
    expect(tipografiasCargadas(html)).toEqual(['Open Sans', 'Barlow', 'Roboto', 'Lato'])
  })
})

describe('arreglo del HTML descargado', () => {
  const html = readFileSync(new URL('./fixtures/style-partido.html', import.meta.url), 'utf8')
  const { html: arreglado, cambios } = arreglarPieza(html, tipografiasCargadas(html))
  it('corrige las 12 etiquetas, con la tipografía y el decimal bien', () => {
    expect(cambios).toBe(12)
    expect(arreglado).toContain('line-height: 1.05;')
    expect(arreglado).toContain('font-family: Barlow, arial')
    expect(arreglado).not.toMatch(/\sbarlow=''/)
  })
  it('el resultado ya no tiene styles partidos ni toca el resto de la pieza', () => {
    for (const m of arreglado.matchAll(/<[a-zA-Z][^>]*>/g)) expect(reconstruirStyleRoto(m[0])).toBeNull()
    expect(arreglado).toContain("<link href='https://fonts.googleapis.com/css2?family=Barlow:wght@400;800&display=swap' rel='stylesheet'>")
  })
  it('una pieza sana no cambia', () => {
    const sana = readFileSync(new URL('./fixtures/sony-cumple.html', import.meta.url), 'utf8')
    const r = arreglarPieza(sana, [])
    expect(r.cambios).toBe(0)
    expect(r.html).toBe(sana)
  })
})

describe('style duplicado en la misma etiqueta', () => {
  it("style='…' ya completo + style roto: queda UN solo style con todo fusionado", () => {
    const tag = "<p class='subtitle' style='margin: 0; color: #73787c; font-size: 19px; line-height: 1.3;' barlow='' arial='' helvetica='' sans-serif='' font-weight:='' bold=''>"
    const { html, cambios } = arreglarPieza(tag, ['Barlow'])
    expect(cambios).toBe(1)
    expect(html.match(/style=/g)).toHaveLength(1)
    expect(html).toBe('<p class=\'subtitle\' style="margin: 0; color: #73787c; font-size: 19px; line-height: 1.3; font-family: Barlow, arial, helvetica, sans-serif; font-weight: bold;">')
  })
  it('en la pieza real ninguna etiqueta arreglada queda con dos style', () => {
    const html = readFileSync(new URL('./fixtures/style-partido.html', import.meta.url), 'utf8')
    const { html: arreglado } = arreglarPieza(html, tipografiasCargadas(html))
    for (const m of arreglado.matchAll(/<[a-zA-Z][^>]*>/g)) expect((m[0].match(/\sstyle\s*=/gi) || []).length).toBeLessThanOrEqual(1)
  })
})

describe('arreglarPieza con la pieza real de Comafi', () => {
  it('arregla todos los style partidos de la pieza', async () => {
    const fs = await import('node:fs')
    const html = fs.readFileSync(new URL('./fixtures/comafi-style-partido.html', import.meta.url), 'utf8')
    const { arreglarPieza } = await import('../arreglos.js')
    const { tipografiasCargadas } = await import('../generales.js')
    const r = arreglarPieza(html, tipografiasCargadas(html))
    expect(r.cambios).toBe(19)
    // Las fuentes cargadas por <link> recuperan la mayúscula
    expect(r.html).toContain('font-family: Archivo, sans-serif; color: #606060;')
    expect(r.html).toContain('margin: 0 auto; width: 100%; max-width: 600px;')
    // No queda ningún atributo suelto de los que genera el accidente
    const restos = r.html.match(/<[a-z]+\b[^>]*\s[\w:-]+=""[^>]*>/g)?.filter(t => !/\balt=""/.test(t)) ?? []
    expect(restos).toEqual([])
  })
})
