import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { quitarElementosDeExtensiones, resumirExtensiones } from '../extensiones.js'
import { arreglarPieza } from '../arreglos.js'
import { ValidarEstructuraHTML } from '../generales.js'

const BLOQUE = '<lt-highlighter contenteditable="false" style="display: none; z-index: 1 !important" data-lt-linked="1"><lt-div spellcheck="false" class="lt-highlighter__wrapper" style="width: 600px !important"><lt-div class="lt-highlighter__scroll-element" style="top: 0px !important"></lt-div></lt-div></lt-highlighter>'

describe('elementos inyectados por extensiones del navegador', () => {
  it('saca <lt-highlighter> completo, con sus <lt-div> anidados, sin tocar el resto', () => {
    const html = `<td style="font-family: Arial">${BLOQUE}${BLOQUE}<p>hola</p></td>`
    const r = quitarElementosDeExtensiones(html)
    expect(r.html).toBe('<td style="font-family: Arial"><p>hola</p></td>')
    expect(r.cantidad).toBe(2)
    expect(r.bytes).toBe(new TextEncoder().encode(BLOQUE + BLOQUE).length)
  })

  it('reconoce Grammarly y LanguageTool, y no toca etiquetas con otro nombre', () => {
    const html = `<grammarly-extension data-grammarly-shadow-root="true"></grammarly-extension>${BLOQUE}<ltr-algo>x</ltr-algo><p>ok</p>`
    const r = resumirExtensiones(html)
    expect(r.cantidad).toBe(2)
    expect(r.extensiones.sort()).toEqual(['Grammarly', 'LanguageTool'])
    expect(quitarElementosDeExtensiones(html).html).toBe('<ltr-algo>x</ltr-algo><p>ok</p>')
  })

  it('un elemento sin cierre no se toca', () => {
    const html = '<p>a</p><lt-highlighter><p>b</p>'
    expect(quitarElementosDeExtensiones(html)).toEqual({ html, cantidad: 0, bytes: 0 })
  })

  it('arreglarPieza los saca y lo informa aparte', () => {
    const r = arreglarPieza(`<td>${BLOQUE}<p>hola</p></td>`, [])
    expect(r.extensiones).toBe(1)
    expect(r.html).toBe('<td><p>hola</p></td>')
  })

  it('el informe lo marca como detalle menor con el sello de corrección', () => {
    const html = readFileSync(new URL('./fixtures/comafi-style-partido.html', import.meta.url), 'utf8')
    expect(resumirExtensiones(html).cantidad).toBe(3)
    const docVacio = { querySelectorAll: () => [] }
    const r = ValidarEstructuraHTML(docVacio, html)
    const aviso = r.advertencias.find(a => a.corrige?.tipo === 'extensiones')
    expect(aviso.detalle).toContain('3 bloques inyectados por una extensión del navegador (LanguageTool)')
    expect(aviso.corrige).toEqual({ tipo: 'extensiones', total: 3, corregidas: 3 })
  })
})
