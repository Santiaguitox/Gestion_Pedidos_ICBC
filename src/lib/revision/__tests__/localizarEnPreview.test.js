import { describe, it, expect } from 'vitest'
import { localizarElemento } from '../localizarEnPreview'
import { el, docDe } from './fakeDom'

const img = el('IMG', { src: 'https://cdn/a.png', alt: 'Logo banco' })
const img2 = el('IMG', { src: 'https://cdn/b.png', alt: 'Otro' })
const a1 = el('A', { href: 'https://x.com', title: 'Ir al sitio' }, 'Entrá acá')
const a2 = el('A', { href: 'https://x.com' }, 'Otro link')
const p = el('P', {}, 'Hola ', el('STRONG', {}, 'mundo'), ' exclusiva', el('SUP', {}, '1'), ' de hoy')
const td1 = el('TD', {}, 'Asistencia para comercios')
const td2 = el('TD', {}, 'Cobertura completa')
const oculto = el('DIV', { style: 'display:none' }, 'texto escondido')
const doc = () => docDe(img, img2, a1, a2, p, el('TR', {}, td1, td2), oculto, el('STYLE', {}, '.x{}'))

describe('localizarElemento', () => {
  it('imagen por src', () => {
    expect(localizarElemento(doc(), { tipo: 'img', src: 'https://cdn/b.png' })).toBe(img2)
    expect(localizarElemento(doc(), { tipo: 'img', src: 'https://cdn/zzz.png' })).toBeNull()
  })

  it('link por href; si se repite, desempata por texto', () => {
    const d = docDe(a1, a2)
    expect(localizarElemento(d, { tipo: 'link', href: 'https://x.com' })).toBe(a1)
    expect(localizarElemento(d, { tipo: 'link', href: 'https://x.com', texto: 'Otro link' })).toBe(a2)
  })

  it('atributo alt / title', () => {
    expect(localizarElemento(docDe(img, a1), { tipo: 'atributo', atributo: 'alt', fragmento: 'logo banco' })).toBe(img)
    expect(localizarElemento(docDe(img, a1), { tipo: 'atributo', atributo: 'title', fragmento: 'ir al sitio' })).toBe(a1)
    expect(localizarElemento(docDe(img), { tipo: 'atributo', atributo: 'href', fragmento: 'x' })).toBeNull()
  })

  it('texto: devuelve el elemento que lo contiene, aunque cruce un inline', () => {
    expect(localizarElemento(doc(), { tipo: 'texto', fragmento: 'Hola mundo' })).toBe(p)
    expect(localizarElemento(doc(), { tipo: 'texto', fragmento: 'mundo' }).nodeName).toBe('STRONG')
  })

  it('texto: no mezcla celdas contiguas y tolera la nota al pie (usa un tramo del fragmento)', () => {
    expect(localizarElemento(doc(), { tipo: 'texto', fragmento: 'Asistencia para comercios' })).toBe(td1)
    expect(localizarElemento(doc(), { tipo: 'texto', fragmento: 'comerciosCobertura' })).toBeNull()
    expect(localizarElemento(doc(), { tipo: 'texto', fragmento: 'exclusiva(1) de hoy' })).toBe(p)
  })

  it('texto oculto o en <style> no se localiza; refs inválidos devuelven null', () => {
    expect(localizarElemento(doc(), { tipo: 'texto', fragmento: 'texto escondido' })).toBeNull()
    expect(localizarElemento(doc(), { tipo: 'texto', fragmento: '.x{}' })).toBeNull()
    expect(localizarElemento(doc(), null)).toBeNull()
    expect(localizarElemento(doc(), { tipo: 'raro' })).toBeNull()
  })
})
