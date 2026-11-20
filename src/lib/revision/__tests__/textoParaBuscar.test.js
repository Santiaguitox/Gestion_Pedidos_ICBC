import { describe, it, expect } from 'vitest'
import { textoParaBuscar } from '../textoParaBuscar'

const NBSP = String.fromCharCode(160)

describe('textoParaBuscar', () => {
  it('imagen: nombre del archivo (sin ruta ni query) si está en el HTML', () => {
    const html = '<img src="https://cdn/x/Separador_Blanco_128.png?v=2" alt="a">'
    expect(textoParaBuscar({ tipo: 'img', src: 'https://cdn/x/Separador_Blanco_128.png?v=2' }, html)).toBe('Separador_Blanco_128.png')
  })

  it('link: href tal cual; con & usa &amp; si así está escrito en el HTML', () => {
    const href = 'https://x.com/p?a=1&b=2'
    expect(textoParaBuscar({ tipo: 'link', href }, `<a href="${href}">x</a>`)).toBe(href)
    expect(textoParaBuscar({ tipo: 'link', href }, '<a href="https://x.com/p?a=1&amp;b=2">x</a>')).toBe('https://x.com/p?a=1&amp;b=2')
  })

  it('link: si no aparece de ninguna forma, copia lo que haya antes del &', () => {
    expect(textoParaBuscar({ tipo: 'link', href: 'https://x.com/p?a=1&b=2' }, '<a href="https://x.com/p?a=1&#38;b=2">x</a>')).toBe('https://x.com/p?a=1')
  })

  it('texto con tildes escritas como caracteres: copia el fragmento completo', () => {
    const html = '<td>¡Sacalo y hacé realidad tus proyectos!</td>'
    expect(textoParaBuscar({ tipo: 'texto', fragmento: 'Sacalo y hacé realidad tus proyectos!' }, html)).toBe('Sacalo y hacé realidad tus proyectos!')
  })

  it('texto con tildes como entidades nombradas: copia como está en el HTML', () => {
    const html = '<td>&iexcl;Sacalo y hac&eacute; realidad tus proyectos!</td>'
    expect(textoParaBuscar({ tipo: 'texto', fragmento: 'hacé realidad' }, html)).toBe('hac&eacute; realidad')
  })

  it('texto con entidades numéricas', () => {
    expect(textoParaBuscar({ tipo: 'texto', fragmento: 'hacé realidad' }, '<td>hac&#233; realidad</td>')).toBe('hac&#233; realidad')
  })

  it('nbsp y & en el texto', () => {
    expect(textoParaBuscar({ tipo: 'texto', fragmento: 'Tecno & Moda' }, '<td>Tecno &amp; Moda</td>')).toBe('Tecno &amp; Moda')
    expect(textoParaBuscar({ tipo: 'texto', fragmento: `hasta${NBSP}$40.000` }, '<td>hasta&nbsp;$40.000</td>')).toBe('hasta&nbsp;$40.000')
  })

  it('texto que cruza un tag: copia el tramo más largo que sí está en el HTML', () => {
    const html = '<td>¡Sacalo y <span style="font-weight:bold;">hacé realidad tus proyectos</span>!</td>'
    const r = textoParaBuscar({ tipo: 'texto', fragmento: 'Sacalo y hacé realidad tus proyectos!' }, html)
    expect(html.includes(r)).toBe(true)
    expect(r.length).toBeGreaterThanOrEqual(10)
  })

  it('si nada aparece, copia el fragmento original; sin html también', () => {
    expect(textoParaBuscar({ tipo: 'texto', fragmento: 'zzz yyy' }, '<td>otra cosa</td>')).toBe('zzz yyy')
    expect(textoParaBuscar({ tipo: 'texto', fragmento: 'hola mundo' })).toBe('hola mundo')
    expect(textoParaBuscar({ tipo: 'img', src: 'https://c/a.png' })).toBe('a.png')
  })

  it('ref inválido → vacío', () => {
    expect(textoParaBuscar(null, '<p/>')).toBe('')
    expect(textoParaBuscar({ tipo: 'raro' }, '<p/>')).toBe('')
  })
})
