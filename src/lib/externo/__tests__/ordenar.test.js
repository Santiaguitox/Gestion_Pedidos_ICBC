import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ordenarHtml, minificarHtml } from '../ordenar.js'
import { recortarPieza } from '../recorte.js'

const sinBlancos = s => s.replace(/\s+/g, '')
const fx = n => readFileSync(new URL(`./fixtures/${n}.html`, import.meta.url), 'utf8')

describe('ordenarHtml', () => {
  it('indenta tablas y celdas, una por línea', () => {
    const r = ordenarHtml('<table><tbody><tr><td>Hola</td><td><img src="a.png"></td></tr></tbody></table>')
    expect(r).toBe('<table>\n\t<tbody>\n\t\t<tr>\n\t\t\t<td>\n\t\t\t\tHola\n\t\t\t</td>\n\t\t\t<td>\n\t\t\t\t<img src="a.png">\n\t\t\t</td>\n\t\t</tr>\n\t</tbody>\n</table>\n')
  })
  it('no toca el espacio entre elementos en línea ni el texto', () => {
    const r = ordenarHtml('<td><a href="#">uno</a> <a href="#">dos</a> y texto  con  espacios</td>')
    expect(r).toContain('</a> <a href="#">')
    expect(r).toContain('y texto  con  espacios')
  })
  it('conserva variables, comentarios y style tal cual', () => {
    const entrada = '<style>a  { color:red }\n</style><table><tr><td><*Nombre*> <!--[if mso]><table><tr><td><![endif]--></td></tr></table>'
    const r = ordenarHtml(entrada)
    expect(r).toContain('<style>a  { color:red }\n</style>')
    expect(r).toContain('<*Nombre*>')
    expect(r).toContain('<!--[if mso]><table><tr><td><![endif]-->')
  })
  it.each(['sony-cumple', 'style-partido', 'icbc-avisos', 'mishka', 'icbc-ddm'])('%s: solo cambia espacio en blanco', nombre => {
    const pieza = recortarPieza(fx(nombre)).html
    const r = ordenarHtml(pieza)
    expect(sinBlancos(r)).toBe(sinBlancos(pieza))
  })
  it('es estable: ordenar dos veces da lo mismo', () => {
    const pieza = recortarPieza(fx('sony-cumple')).html
    const una = ordenarHtml(pieza)
    expect(ordenarHtml(una)).toBe(una)
  })
})

describe('minificarHtml', () => {
  it('quita saltos y tabs entre etiquetas estructurales y deja el texto en línea igual', () => {
    const r = minificarHtml('<table>\n\t<tbody>\n\t\t<tr>\n\t\t\t<td>\n\t\t\t\t<a>uno</a> <a>dos</a>\n\t\t\t</td>\n\t\t</tr>\n\t</tbody>\n</table>')
    expect(r).toBe('<table><tbody><tr><td><a>uno</a> <a>dos</a></td></tr></tbody></table>')
  })
  it('junta los <style> en una línea y no toca comentarios', () => {
    const r = minificarHtml('<style>\n  a {\n    color: red;\n  }\n</style><!--[if mso]>\n  <b>x</b>\n<![endif]--><table><tr><td>x</td></tr></table>')
    expect(r).toContain('<style> a { color: red; } </style>')
    expect(r).toContain('<!--[if mso]>\n  <b>x</b>\n<![endif]-->')
  })
  it.each(['sony-cumple', 'style-partido', 'icbc-avisos', 'mishka', 'icbc-ddm'])('%s: solo cambia espacio en blanco y no crece', nombre => {
    const pieza = recortarPieza(fx(nombre)).html
    const r = minificarHtml(pieza)
    expect(sinBlancos(r)).toBe(sinBlancos(pieza))
    expect(r.length).toBeLessThanOrEqual(pieza.length)
  })
})
