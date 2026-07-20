import { describe, it, expect } from 'vitest'
import { importarHeuristico } from '@/lib/editor/importar.js'

// Pieza mínima válida (con tabla id="Show") para que
// encontrarTablaContenido la reconozca — ver comentario de esa
// función en importar.js para el porqué del id="Show".
function piezaCon(filaHtml) {
  return `<table id="Show" width="600" cellpadding="0" cellspacing="0" border="0">
    <tbody>${filaHtml}</tbody>
  </table>`
}

describe('importarHeuristico — filas con atributos rotos se fuerzan a código personalizado', () => {
  it('un <img> suelto con atributo roto NO cae como Imagen_Libre — antes se normalizaba en silencio y perdía el atributo roto', () => {
    // Sin el fix, esta fila matchea Imagen_Libre por forma y
    // normalizarImagenLibre reescribe el <img> entero, descartando
    // los atributos rotos sin que el aviso pueda ofrecer nada — ver
    // la discusión completa del 2026-07-19/20 (incluye un bug real
    // encontrado ahí: el ancho "100px" con unidad inválida caía al
    // default hardcodeado de 530 en vez de preservar 100).
    const filaRota = `<tr><td><div>
      <img src="https://cdn.test/icono.png" style="font-family: " museo="" sans',="" arial,="" sans-serif;="" display:="" block;="" color:="" #c4161c;'="" width="80" height="80" alt="Icono">
    </div></td></tr>`

    const { resultado, avisos } = importarHeuristico(piezaCon(filaRota))

    expect(resultado.canvas).toHaveLength(1)
    expect(resultado.canvas[0].slug).toBe('codigo')
    // El tag roto sobrevive byte a byte en el bloque — nada lo tocó.
    expect(resultado.canvas[0].htmlEditado).toContain('museo=""')
    expect(resultado.canvas[0].htmlEditado).toContain('width="80"')

    const avisoAtributo = avisos.find(a => a.tipo === 'atributo-roto')
    expect(avisoAtributo).toBeDefined()
    // canvasIdx exacto, resuelto en el momento (no por búsqueda de
    // texto después) — apunta al único bloque que hay.
    expect(avisoAtributo.canvasIdx).toBe(0)
    expect(avisoAtributo.tagReconstruido).toContain('font-family: museo, sans')
  })

  it('una fila sin atributos rotos sigue clasificando normal (no se forzó código de más)', () => {
    const filaSana = `<tr><td><div>
      <img src="https://cdn.test/icono.png" style="display: block; color: #c4161c;" width="80" height="80" alt="Icono">
    </div></td></tr>`

    const { resultado, avisos } = importarHeuristico(piezaCon(filaSana))

    expect(resultado.canvas).toHaveLength(1)
    expect(resultado.canvas[0].slug).toBe('Imagen_Libre')
    expect(avisos.find(a => a.tipo === 'atributo-roto')).toBeUndefined()
  })

  it('con dos filas, solo la rota se fuerza a código — la otra clasifica normal', () => {
    const filaRota = `<tr><td><div>
      <img src="https://cdn.test/a.png" style="color: " rojo="" display:="" width="50" height="50" alt="A">
    </div></td></tr>`
    const filaSana = `<tr><td><div>
      <img src="https://cdn.test/b.png" style="display: block; color: #333;" width="50" height="50" alt="B">
    </div></td></tr>`

    const { resultado, avisos } = importarHeuristico(piezaCon(filaRota + filaSana))

    expect(resultado.canvas).toHaveLength(2)
    expect(resultado.canvas[0].slug).toBe('codigo')
    expect(resultado.canvas[1].slug).toBe('Imagen_Libre')

    const avisoAtributo = avisos.find(a => a.tipo === 'atributo-roto')
    expect(avisoAtributo.canvasIdx).toBe(0)
  })

  it('un bloque de TEXTO con atributo roto clasifica normal (Bloque_Texto_Base) — solo Imagen_Libre se fuerza a código', () => {
    // Caso real reportado por Santi (2026-07-20): normalizarNegritas
    // (lo único que se aplica a Bloque_Texto_Base y a casi cualquier
    // otro template) jamás toca atributos de otros tags — solo
    // convierte <strong> a <span style="font-weight:bold;">. El HTML
    // roto sobrevive intacto acá exactamente igual que forzando
    // código personalizado, así que no hay ningún motivo para negarle
    // al usuario la edición normal de un bloque de texto simple.
    const filaTexto = `<tr><td arial="" helvetica="" open="" sans="" sans-serif="" font-size:="" 17px="" font-weight:="" normal="" color:="" 333333="" text-align:="" left="" line-height:="" 24px="" align="left">Hola mundo, este es un texto de prueba normal.</td></tr>`

    const { resultado, avisos } = importarHeuristico(piezaCon(filaTexto))

    expect(resultado.canvas).toHaveLength(1)
    expect(resultado.canvas[0].slug).toBe('Bloque_Texto_Base')
    expect(resultado.canvas[0].htmlEditado).toContain('arial=""')

    const avisoAtributo = avisos.find(a => a.tipo === 'atributo-roto')
    expect(avisoAtributo).toBeDefined()
    expect(avisoAtributo.canvasIdx).toBe(0)
  })
})
