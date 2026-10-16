import { describe, it, expect } from 'vitest'
import { detectarVariables, encontrarVariables } from '../variables.js'

describe('detectarVariables', () => {
  it('literal en texto, en link e imagen', () => {
    const v = detectarVariables('<p>Hola <*Nombre*></p><a href="<*Baja*>">Baja <*Info1*></a><img src="<*Foto*>" alt="<*Nombre*>"><div data-x="<*Otro*>"></div>')
    expect(v.grupos.texto.map(x => x.variable).sort()).toEqual(['<*Info1*>', '<*Nombre*>'])
    expect(v.grupos.links.map(x => x.variable)).toEqual(['<*Baja*>'])
    expect(v.grupos.imagenes.map(x => x.variable).sort()).toEqual(['<*Foto*>', '<*Nombre*>'])
    expect(v.grupos.otros.map(x => x.variable)).toEqual(['<*Otro*>'])
    expect(v.escapadas).toBe(0)
  })
  it('escapadas con entidades con nombre, numéricas y doble escape', () => {
    const v = encontrarVariables('&lt;*A*&gt; &#60;*B*&#62; &#x3C;&ast;C&ast;&#x3E; &amp;lt;*D*&amp;gt;')
    expect(v.map(x => x.nombre)).toEqual(['A', 'B', 'C', 'D'])
    expect(v.every(x => x.forma === 'escapada')).toBe(true)
  })
  it('escapadas dentro de un href cuentan como links', () => {
    expect(detectarVariables('<a href="&lt;*Info4*&gt;">x</a>').grupos.links[0].variable).toBe('<*Info4*>')
  })
  it('cuenta repeticiones y no confunde ">" dentro de atributos', () => {
    const v = detectarVariables('<a title="a>b" href="<*X*>">t</a><p><*X*></p><p><*X*></p>')
    expect(v.grupos.texto[0].cantidad).toBe(2)
    expect(v.grupos.links[0].variable).toBe('<*X*>')
    expect(v.unicas).toBe(1)
    expect(v.total).toBe(3)
  })
  it('variables en comentarios y style van a otros; sin variables da 0', () => {
    expect(detectarVariables('<!-- <*C*> --><style>/* <*S*> */</style>').grupos.otros).toHaveLength(2)
    expect(detectarVariables('<p>nada * acá *</p>').total).toBe(0)
  })
})
