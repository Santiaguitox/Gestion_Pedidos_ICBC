import { describe, it, expect } from 'vitest'
import {
  extraerTdsConBalance,
  normalizarNegritas,
  quitarWrapperSiEnvuelveTodo,
  validarUrl,
  formaDeTags,
  similitudDeForma,
} from '@/lib/editor/htmlUtils.js'
import { BLOQUES_CONTENIDO } from '@/lib/editor/bloques.js'

describe('extraerTdsConBalance', () => {
  it('un td que contiene una tabla es contenedor, no hoja', () => {
    const html = `
      <tr><td>
        <table><tbody>
          <tr><td>texto interno</td></tr>
        </tbody></table>
      </td></tr>`
    const celdas = extraerTdsConBalance(html)
    expect(celdas).toHaveLength(1)
    expect(celdas[0].contenido).toBe('texto interno')
  })

  it('posicionOrden cuenta todas las hojas; posicionContenido solo las que tienen contenido real', () => {
    // Celda 0: espaciador decorativo (&nbsp;), celda 1: texto real,
    // celda 2: solo una imagen (cuenta como contenido real).
    const html = `<tr><td height="14">&nbsp;</td><td>Un texto con contenido real</td><td><img src="x.png"></td></tr>`
    const celdas = extraerTdsConBalance(html)
    expect(celdas.map(c => c.posicionOrden)).toEqual([0, 1, 2])
    expect(celdas.map(c => c.posicionContenido)).toEqual([null, 0, 1])
    expect(celdas.map(c => c.tieneContenidoReal)).toEqual([false, true, true])
  })

  it('la identidad por posicionOrden sobrevive a que la celda quede vacía (contrato del fix de campos)', () => {
    const conTexto = `<tr><td>&nbsp;</td><td>hola mundo</td></tr>`
    const vaciada = `<tr><td>&nbsp;</td><td></td></tr>`
    const antes = extraerTdsConBalance(conTexto).find(c => c.contenido === 'hola mundo')
    const despues = extraerTdsConBalance(vaciada)[antes.posicionOrden]
    // Misma celda física, mismo posicionOrden — aunque su
    // posicionContenido ahora sea null por estar vacía.
    expect(despues.posicionOrden).toBe(antes.posicionOrden)
    expect(despues.posicionContenido).toBeNull()
  })
})

describe('normalizarNegritas', () => {
  it('convierte strong al span de negrita que usan los templates', () => {
    expect(normalizarNegritas('a <strong>b</strong> c'))
      .toBe('a <span style="font-weight: bold;">b</span> c')
  })
})

describe('quitarWrapperSiEnvuelveTodo', () => {
  it('quita un wrapper que envuelve todo el contenido', () => {
    expect(quitarWrapperSiEnvuelveTodo('<div><p>hola</p></div>')).toBe('<p>hola</p>')
  })

  it('no toca contenido con hermanos al mismo nivel', () => {
    const html = '<span>a</span><span>b</span>'
    expect(quitarWrapperSiEnvuelveTodo(html)).toBe(html)
  })

  it('respeta anidamiento del mismo tag (balance real, no primer cierre)', () => {
    expect(quitarWrapperSiEnvuelveTodo('<span><span>a</span></span>')).toBe('<span>a</span>')
  })

  it('no confunde un tag que abre al inicio pero cierra antes del final (bug documentado del <a>)', () => {
    const html = '<a href="https://x.com">link</a> y texto que sigue'
    expect(quitarWrapperSiEnvuelveTodo(html)).toBe(html)
  })
})

describe('validarUrl', () => {
  it('agrega https:// a URLs sin protocolo', () => {
    expect(validarUrl('icbc.com.ar')).toBe('https://icbc.com.ar')
  })
  it('respeta http(s) y mailto existentes', () => {
    expect(validarUrl('http://a.com')).toBe('http://a.com')
    expect(validarUrl('mailto:hola@icbc.com.ar')).toBe('mailto:hola@icbc.com.ar')
    expect(validarUrl('')).toBe('')
  })
})

describe('formaDeTags / similitudDeForma', () => {
  it('un template es 100% similar a sí mismo', () => {
    for (const b of BLOQUES_CONTENIDO) {
      expect(similitudDeForma(formaDeTags(b.html), formaDeTags(b.html))).toBe(1)
    }
  })

  it('cambiar solo el texto (misma estructura de tags) no cambia la forma', () => {
    const base = BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base')
    const editado = base.html.replace(
      'Queremos mejorar tu experiencia',
      'Otro texto real distinto de largo comparable para la pieza'
    )
    expect(similitudDeForma(formaDeTags(base.html), formaDeTags(editado))).toBe(1)
  })

  it('dos templates estructuralmente distintos no dan similitud perfecta', () => {
    const texto = BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base')
    const doble = BLOQUES_CONTENIDO.find(b => b.slug === 'Modulo_Doble_Clasico')
    const sim = similitudDeForma(formaDeTags(texto.html), formaDeTags(doble.html))
    expect(sim).toBeLessThan(1)
    expect(sim).toBeGreaterThanOrEqual(0)
  })
})
