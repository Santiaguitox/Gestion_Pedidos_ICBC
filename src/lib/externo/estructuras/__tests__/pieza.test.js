import { describe, it, expect } from 'vitest'
import { configInicial } from '../bloque.js'
import { emailDePrueba, htmlParaPlataforma, vistaDeEmail } from '../pieza.js'

describe('email de prueba', () => {
  it('deja el bloque entre el encabezado y el pie de la pieza', () => {
    const h = emailDePrueba('<tr><td id="bloque"></td></tr>')
    const i = h.indexOf('Encabezado de tu pieza')
    const b = h.indexOf('id="bloque"')
    const f = h.indexOf('Pie de tu pieza')
    expect(i).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(i)
    expect(f).toBeGreaterThan(b)
  })
  it('lo que se copia es el email completo con el bloque adentro, no solo el <tr>', () => {
    const h = htmlParaPlataforma(configInicial())
    expect(h.startsWith('<style')).toBe(true)
    expect(h).toContain('Encabezado de tu pieza')
    expect(h).toContain('<!--CampoTabla_datos_tabla-->')
    expect(h).toContain('Pie de tu pieza')
  })
  it('no usa imágenes ni divs (se ve igual en cualquier cliente de mail)', () => {
    const h = emailDePrueba('<tr></tr>')
    expect(h).not.toMatch(/<img|<div/)
  })
  it('la vista en pantalla muestra el mismo email', () => {
    const v = vistaDeEmail(configInicial(), [['', 'a', '1', '$1']], { modo: 'ejemplo' })
    expect(v).toContain('Encabezado de tu pieza')
    expect(v).toContain('data-f="1"')
  })
})
