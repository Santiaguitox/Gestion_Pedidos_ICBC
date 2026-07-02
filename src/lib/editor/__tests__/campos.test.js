import { describe, it, expect } from 'vitest'
import { detectarCampos, actualizarCampoEnHtml } from '@/lib/editor/campos.js'
import { BLOQUES_CONTENIDO } from '@/lib/editor/bloques.js'

const bloqueTexto = () => BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base').html

describe('detectarCampos', () => {
  it('detecta el campo de texto del Bloque_Texto_Base con su contenido real', () => {
    const campos = detectarCampos(bloqueTexto())
    const textos = campos.filter(c => c.tipo === 'texto')
    expect(textos).toHaveLength(1)
    expect(textos[0].contenido).toContain('Queremos mejorar tu experiencia')
    expect(textos[0].posicionOrden).toBeDefined()
    expect(textos[0].posicionReal).toBeDefined()
  })

  it('un <a> dentro de un td de texto editable NO se lista como campo Link aparte (bug documentado)', () => {
    const html = `<tr><td>Texto largo con un <a href="https://promo.icbc.com.ar">link adentro</a> del párrafo</td></tr>`
    const campos = detectarCampos(html)
    expect(campos.filter(c => c.tipo === 'link')).toHaveLength(0)
    expect(campos.filter(c => c.tipo === 'texto')).toHaveLength(1)
  })

  it('un <a> fuera de un td de texto (botón con imagen) SÍ es campo Link; los sociales se excluyen', () => {
    const html = `<tr><td><a href="https://promo.icbc.com.ar/x"><img src="btn.png"></a></td><td><a href="https://twitter.com/icbc"><img src="tw.png"></a></td></tr>`
    const links = detectarCampos(html).filter(c => c.tipo === 'link')
    expect(links).toHaveLength(1)
    expect(links[0].valor).toBe('https://promo.icbc.com.ar/x')
  })
})

describe('actualizarCampoEnHtml — texto', () => {
  it('reemplaza el contenido del td anclando por posicionOrden', () => {
    const html = bloqueTexto()
    const campo = detectarCampos(html).find(c => c.tipo === 'texto')
    const nuevo = actualizarCampoEnHtml(html, 'texto', campo.posicionOrden, { contenido: 'Contenido nuevo de prueba' }, campo.posicionReal)
    expect(nuevo).toContain('Contenido nuevo de prueba')
    expect(nuevo).not.toContain('Queremos mejorar tu experiencia')
    // La estructura alrededor no se toca
    expect(nuevo).toContain('<tr>')
    expect(nuevo).toContain('font-size: 17px')
  })

  it('vaciar el campo y volver a escribir en la MISMA celda funciona (bug real del fix posicionOrden)', () => {
    const html = bloqueTexto()
    const campo = detectarCampos(html).find(c => c.tipo === 'texto')
    // 1) el usuario vacía el campo
    const vaciado = actualizarCampoEnHtml(html, 'texto', campo.posicionOrden, { contenido: '' }, campo.posicionReal)
    expect(vaciado).not.toContain('Queremos mejorar')
    // 2) escribe de nuevo usando el MISMO ancla guardado al detectar —
    // con el anclaje viejo por posicionContenido esto se perdía en
    // silencio porque la celda vacía dejaba de "contar".
    const reescrito = actualizarCampoEnHtml(vaciado, 'texto', campo.posicionOrden, { contenido: 'Texto reescrito' }, campo.posicionReal)
    expect(reescrito).toContain('Texto reescrito')
  })
})

describe('actualizarCampoEnHtml — imagen y link', () => {
  const htmlImg = `<tr><td><img src="https://cdn/vieja.png" alt="vieja" width="600" height="200" style="display: block; width: 600px; height: 200px;"></td></tr>`

  it('actualiza src, alt y title del <img> en la posición idx', () => {
    const nuevo = actualizarCampoEnHtml(htmlImg, 'imagen', 0, { src: 'https://cdn/nueva.png', alt: 'nueva', title: 'tooltip' })
    expect(nuevo).toContain('src="https://cdn/nueva.png"')
    expect(nuevo).toContain('alt="nueva"')
    expect(nuevo).toContain('title="tooltip"')
    expect(nuevo).not.toContain('vieja.png')
  })

  it('actualiza width/height tanto en el atributo como en el style inline', () => {
    const nuevo = actualizarCampoEnHtml(htmlImg, 'imagen', 0, { width: 300, height: 100 })
    expect(nuevo).toContain('width="300"')
    expect(nuevo).toContain('height="100"')
    expect(nuevo).toContain('width: 300px')
    expect(nuevo).toContain('height: 100px')
  })

  it('no toca un <img> en otra posición', () => {
    const dos = htmlImg + htmlImg.replace('vieja', 'segunda')
    const nuevo = actualizarCampoEnHtml(dos, 'imagen', 1, { src: 'https://cdn/editada.png' })
    expect(nuevo).toContain('src="https://cdn/vieja.png"')
    expect(nuevo).toContain('src="https://cdn/editada.png"')
  })

  it('edita el href de un link no-social por posición, salteando los sociales', () => {
    const html = `<a href="https://twitter.com/icbc"><img src="t.png"></a><a href="https://promo.icbc.com.ar/a"><img src="b.png"></a>`
    const nuevo = actualizarCampoEnHtml(html, 'link', 0, { valor: 'https://promo.icbc.com.ar/nuevo' })
    // idx 0 de links editables = el de promo (twitter no cuenta)
    expect(nuevo).toContain('href="https://promo.icbc.com.ar/nuevo"')
    expect(nuevo).toContain('href="https://twitter.com/icbc"')
  })
})
