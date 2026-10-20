import { describe, it, expect } from 'vitest'
import {
  ROJO_ACENTO, ROJO_ACENTO_ANTERIOR, NEGRO_EB,
  avisoMigracionRojo, migrarColoresSegmentoModuloDoble, migrarHtmlEditadoGuardado, migrarRojoAnterior,
} from '@/lib/editor/colores.js'
import { BLOQUES_CONTENIDO } from '@/lib/editor/bloques.js'
import { importarHeuristico } from '@/lib/editor/importar.js'
import { limpiarHtmlExport } from '@/lib/editor/htmlUtils.js'
import { generarThumbSVG } from '@/lib/editor/thumbs.js'

describe('colores de acento (rediseño 2026)', () => {
  it('los valores nuevos y anteriores', () => {
    expect(ROJO_ACENTO).toBe('#c7000b')
    expect(ROJO_ACENTO_ANTERIOR).toBe('#c4161c')
    expect(NEGRO_EB).toBe('#0d131a')
  })

  it('ningún template de contenido ni de botones conserva el rojo anterior', () => {
    for (const b of BLOQUES_CONTENIDO) expect(b.html.toLowerCase(), b.slug).not.toContain('#c4161c')
  })

  it('las miniaturas usan el rojo nuevo', () => {
    for (const b of BLOQUES_CONTENIDO) expect(generarThumbSVG(b).toLowerCase(), b.slug).not.toContain('c4161c')
  })

  it('el rojo en rgb() pegado o exportado se normaliza al nuevo', () => {
    expect(limpiarHtmlExport('<span style="color: rgb(196, 22, 28)">x</span>')).toContain('#c7000b')
    expect(limpiarHtmlExport('<span style="color: rgb(199, 0, 11)">x</span>')).toContain('#c7000b')
  })
})

describe('migrarRojoAnterior', () => {
  it('reemplaza hex (en cualquier mayúscula) y rgb, y cuenta los reemplazos', () => {
    const r = migrarRojoAnterior('<td style="color: #c4161c; border: solid 2px #C4161C" bgcolor="#c4161c"><b style="color: rgb(196, 22, 28)">x</b></td>')
    expect(r.cantidad).toBe(4)
    expect(r.html).not.toMatch(/c4161c/i)
    expect(r.html).not.toContain('rgb(196')
    expect(r.html).toContain('border: solid 2px #c7000b')
  })
  it('no toca otros colores ni hex más largos', () => {
    const html = '<td style="color: #333333" bgcolor="#c4161cff">x</td><td bgcolor="#c7000b">y</td>'
    expect(migrarRojoAnterior(html)).toEqual({ html, cantidad: 0 })
  })
  it('sin nada que migrar no hay aviso', () => {
    expect(avisoMigracionRojo(0)).toBeNull()
    expect(avisoMigracionRojo(1).texto).toMatch(/1 lugar/)
    expect(avisoMigracionRojo(3).texto).toMatch(/3 lugares/)
  })
})

describe('Módulo Doble punteado: el negro EB pasa al nuevo, solo ahí', () => {
  it('migra bgcolor #000000 del módulo', () => {
    expect(migrarColoresSegmentoModuloDoble('<td bgcolor="#000000"></td>')).toContain(`bgcolor="${NEGRO_EB}"`)
  })
  it('un borrador guardado migra rojo siempre y negro solo en ese bloque', () => {
    const doble = migrarHtmlEditadoGuardado('Modulo_Doble_Con_Imagen_Punteada', '<td bgcolor="#000000"></td><td bgcolor="#c4161c"></td>')
    expect(doble).toBe(`<td bgcolor="${NEGRO_EB}"></td><td bgcolor="${ROJO_ACENTO}"></td>`)
    const otro = migrarHtmlEditadoGuardado('Bloque_Texto_Base', '<td style="color:#000000">x</td><b style="color:#c4161c">y</b>')
    expect(otro).toBe('<td style="color:#000000">x</td><b style="color:#c7000b">y</b>')
    expect(migrarHtmlEditadoGuardado('X', undefined)).toBeUndefined()
  })
})

describe('importar una pieza con el rojo anterior', () => {
  // Pieza real, con el rojo nuevo; la versión "vieja" es la misma con el rojo anterior.
  const PIEZAS = import.meta.glob('./fixtures/*.html', { query: '?raw', import: 'default', eager: true })
  const nueva = PIEZAS['./fixtures/pieza-marcador-viejo-logo-pyme.html']
  const vieja = nueva.replace(/#c7000b/gi, '#c4161c')

  it('migra el rojo y avisa una sola vez', () => {
    expect(vieja.toLowerCase()).toContain('#c4161c')
    const { resultado, avisos } = importarHeuristico(vieja)
    expect(JSON.stringify(resultado).toLowerCase()).not.toContain('c4161c')
    expect(avisos.filter(a => /rojo del diseño anterior/.test(a.texto))).toHaveLength(1)
  })
  it('con el rojo nuevo no avisa nada', () => {
    const { avisos } = importarHeuristico(nueva)
    expect(avisos.some(a => /rojo del diseño anterior/.test(a.texto))).toBe(false)
  })
})
