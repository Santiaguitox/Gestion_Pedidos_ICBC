import { describe, it, expect } from 'vitest'
import { ValidarBandaHeader } from '../bandaHeader'
import { el, docDe } from './fakeDom'

const NBSP = String.fromCharCode(160)
const espaciador = (alto, extra = {}) =>
  el('TR', {}, el('TD', { colspan: '3', style: `height: ${alto}px; font-size: 0px;`, height: String(alto), ...extra }, NBSP))

const logo = (alto, attrs = {}) =>
  el('IMG', { src: 'https://cdn/logo.png', width: '215', height: String(alto), style: `height: ${alto}px; display: block;`, ...attrs })

function banda(arriba, altoLogo, abajo, attrsImg) {
  return el('TABLE', { bgcolor: '#0D131A' },
    el('TBODY', {},
      espaciador(arriba),
      el('TR', {}, el('TD', { width: '35' }, NBSP), el('TD', { width: '530' }, el('TABLE', {}, el('TBODY', {}, el('TR', {}, el('TD', {}, logo(altoLogo, attrsImg)))))), el('TD', { width: '35' }, NBSP)),
      espaciador(abajo),
    ),
  )
}

// La pieza real: contenedores de 1 fila alrededor de la banda y más abajo otras imágenes.
const pieza = (b) => {
  const hero = el('IMG', { src: 'https://cdn/hero.png', width: '600', height: '425' })
  const interna = el('TABLE', {}, el('TBODY', {},
    el('TR', {}, el('TD', {}, b)),
    el('TR', {}, el('TD', {}, hero)),
  ))
  const externa = el('TABLE', {}, el('TBODY', {}, el('TR', {}, el('TD', {}, interna))))
  return docDe(el('DIV', { style: 'display:none' }, 'preheader'), externa)
}

describe('ValidarBandaHeader', () => {
  it('70 px (20 + 30 + 20, la pieza real) → sin hallazgos', () => {
    expect(ValidarBandaHeader(pieza(banda(20, 30, 20)))).toEqual([])
  })

  it('logo de otro alto con espaciadores ajustados (7 + 56 + 7) → ok', () => {
    expect(ValidarBandaHeader(pieza(banda(7, 56, 7)))).toEqual([])
  })

  it('distinto de 70 → error con la cuenta y ref al logo', () => {
    const r = ValidarBandaHeader(pieza(banda(20, 36, 20)))
    expect(r).toHaveLength(1)
    expect(r[0].banda).toBe(true)
    expect(r[0].errores[0].detalle).toContain('mide 76px (arriba 20 + logo 36 + abajo 20)')
    expect(r[0].errores[0].ref).toEqual({ tipo: 'img', src: 'https://cdn/logo.png' })
  })

  it('el style gana sobre el atributo height del logo', () => {
    const r = ValidarBandaHeader(pieza(banda(20, 30, 20, { height: '40' })))
    expect(r).toEqual([])
  })

  it('no confunde line-height ni max-height con el alto', () => {
    const b = banda(20, 30, 20, { style: 'line-height: 99px; max-height: 5px; height: 30px;' })
    expect(ValidarBandaHeader(pieza(b))).toEqual([])
  })

  it('se salta el píxel de seguimiento de 1x1 que va antes del logo', () => {
    const doc = docDe(el('IMG', { src: 'https://t/p.gif', width: '1', height: '1' }), el('TABLE', {}, el('TBODY', {}, el('TR', {}, el('TD', {}, banda(20, 30, 20))))))
    expect(ValidarBandaHeader(doc)).toEqual([])
  })

  it('header viejo con una banda interna anidada (14 + [1 + 41 + 1] + 14) → mide 71 y se marca', () => {
    const interna = el('TABLE', {}, el('TBODY', {}, espaciador(1), el('TR', {}, el('TD', {}, logo(41))), espaciador(1)))
    const externa = el('TABLE', {}, el('TBODY', {}, espaciador(14), el('TR', {}, el('TD', { width: '35' }, NBSP), el('TD', {}, interna), el('TD', { width: '35' }, NBSP)), espaciador(14)))
    const r = ValidarBandaHeader(pieza(externa))
    expect(r[0].errores[0].detalle).toContain('mide 71px (arriba 14 + logo 43 + abajo 14)')
  })

  it('un contenedor de 3 filas más arriba no se suma a la banda', () => {
    const contenedor = el('TABLE', {}, el('TBODY', {}, el('TR', {}, el('TD', {}, banda(20, 30, 20))), el('TR', {}, el('TD', {}, 'otra cosa')), el('TR', {}, el('TD', {}, 'más'))))
    expect(ValidarBandaHeader(docDe(contenedor))).toEqual([])
  })

  it('funciona con childNodes tipo NodeList (sin filter/some), como en el navegador', () => {
    const doc = pieza(banda(20, 36, 20))
    const comoNodeList = (n) => {
      if (!n.childNodes) return
      n.childNodes.forEach(comoNodeList)
      const lista = n.childNodes
      n.childNodes = { length: lista.length, item: i => lista[i], [Symbol.iterator]: () => lista[Symbol.iterator]() }
    }
    comoNodeList(doc.body)
    expect(ValidarBandaHeader(doc)[0].errores[0].detalle).toContain('mide 76px')
  })

  it('la celda del logo más alta que la imagen manda (td 43 con logo de 28 → 14 + 43 + 14 = 71)', () => {
    const celdaLogo = el('TD', { style: 'vertical-align: middle; height: 43px;' }, logo(28))
    const interna = el('TABLE', {}, el('TBODY', {}, el('TR', {}, celdaLogo, el('TD', { width: '30%' }, NBSP))))
    const b = el('TABLE', {}, el('TBODY', {}, espaciador(14), el('TR', {}, el('TD', { width: '35' }), el('TD', {}, interna), el('TD', { width: '35' })), espaciador(14)))
    expect(ValidarBandaHeader(pieza(b))[0].errores[0].detalle).toContain('mide 71px (arriba 14 + logo 43 + abajo 14)')
  })

  it('una celda del logo más baja que la imagen no la achica', () => {
    const celdaLogo = el('TD', { style: 'height: 10px;' }, logo(30))
    const b = el('TABLE', {}, el('TBODY', {}, espaciador(20), el('TR', {}, celdaLogo), espaciador(20)))
    expect(ValidarBandaHeader(pieza(b))).toEqual([])
  })

  it('sin estructura de 3 filas → se marca igual (todas las piezas llevan banda)', () => {
    const doc = docDe(el('TABLE', {}, el('TBODY', {}, el('TR', {}, el('TD', {}, logo(30))))))
    const r = ValidarBandaHeader(doc)
    expect(r).toHaveLength(1)
    expect(r[0].errores[0].detalle).toContain('No se pudo identificar la banda de header')
  })

  it('espaciador sin alto declarado → no se puede medir, se marca', () => {
    const b = el('TABLE', {}, el('TBODY', {}, el('TR', {}, el('TD', { colspan: '3' }, NBSP)), el('TR', {}, el('TD', {}, logo(30))), espaciador(20)))
    expect(ValidarBandaHeader(docDe(b))[0].errores[0].detalle).toContain('No se pudo identificar')
  })

  it('pieza sin imágenes → se marca sin ref', () => {
    const r = ValidarBandaHeader(docDe(el('P', {}, 'hola')))
    expect(r[0].errores[0].ref).toBeUndefined()
  })
})
