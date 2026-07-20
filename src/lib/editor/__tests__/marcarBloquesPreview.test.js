import { describe, it, expect } from 'vitest'
import { marcarBloquesNoReconocidosParaPreview } from '@/lib/editor/importar.js'

function marcador(slug, idx, contenido, origen) {
  const origenAttr = origen ? ` origen="${origen}"` : ''
  return `<!--BLOQUE slug="${slug}" idx="${idx}"${origenAttr}-->\n${contenido}\n<!--/BLOQUE-->`
}

describe('marcarBloquesNoReconocidosParaPreview', () => {
  it('un bloque con slug="codigo" recibe el id Y el marco punteado "No reconocido"', () => {
    const html = marcador('codigo', 3, '<tr><td>texto roto</td></tr>')
    const resultado = marcarBloquesNoReconocidosParaPreview(html)
    expect(resultado).toContain('id="preview-bloque-3"')
    expect(resultado).toContain('No reconocido')
    expect(resultado).toContain('outline: 2px dashed')
  })

  it('un bloque con origen="fuera-de-rango" recibe la etiqueta y color distintos', () => {
    const html = marcador('codigo', 5, '<tr><td>texto</td></tr>', 'fuera-de-rango')
    const resultado = marcarBloquesNoReconocidosParaPreview(html)
    expect(resultado).toContain('id="preview-bloque-5"')
    expect(resultado).toContain('Fuera de lugar')
    expect(resultado).toContain('#DC2626')
  })

  it('regresión (Santi, 2026-07-20): un bloque con slug real (no "codigo") TAMBIÉN recibe el id, sin el marco punteado', () => {
    // Antes de este fix, un aviso de atributo roto sobre un bloque
    // clasificado normal (ej. Bloque_Texto_Base, desde que dejamos de
    // forzar código personalizado para cualquier atributo roto) no
    // tenía ningún id puesto — el click en el aviso no encontraba
    // nada para hacer scrollIntoView().
    const html = marcador('Bloque_Texto_Base', 7, '<tr><td>Hola mundo</td></tr>')
    const resultado = marcarBloquesNoReconocidosParaPreview(html)
    expect(resultado).toContain('id="preview-bloque-7"')
    expect(resultado).not.toContain('No reconocido')
    expect(resultado).not.toContain('outline: 2px dashed')
    expect(resultado).toContain('Hola mundo')
  })

  it('el contenido real del bloque sobrevive intacto adentro del wrapper, sea cual sea el slug', () => {
    const html = marcador('Bullet_Titular_Negro', 1, '<tr><td><img src="a.png"> Texto del bullet</td></tr>')
    const resultado = marcarBloquesNoReconocidosParaPreview(html)
    expect(resultado).toContain('<img src="a.png">')
    expect(resultado).toContain('Texto del bullet')
  })

  it('varios bloques mixtos (codigo y normales) en la misma pieza reciben su id cada uno', () => {
    const html = [
      marcador('Bloque_Texto_Base', 0, '<tr><td>Uno</td></tr>'),
      marcador('codigo', 1, '<tr><td>Dos roto</td></tr>'),
      marcador('Espaciador', 2, '<tr><td height="10"></td></tr>'),
    ].join('\n')
    const resultado = marcarBloquesNoReconocidosParaPreview(html)
    expect(resultado).toContain('id="preview-bloque-0"')
    expect(resultado).toContain('id="preview-bloque-1"')
    expect(resultado).toContain('id="preview-bloque-2"')
    // Solo el bloque 1 (codigo) tiene el marco punteado.
    const cantidadMarcos = (resultado.match(/No reconocido/g) || []).length
    expect(cantidadMarcos).toBe(1)
  })

  it('sin ningún marcador BLOQUE en el HTML, no hace nada (no rompe HTML normal)', () => {
    const html = '<tr><td>Texto cualquiera</td></tr>'
    expect(marcarBloquesNoReconocidosParaPreview(html)).toBe(html)
  })

  it('regresión (Santi, 2026-07-20): el div del marco "codigo" declara su propio font-size, no hereda el div{font-size:0} típico de piezas de mail', () => {
    // Muchas piezas traen `div { font-size: 0px; }` en su propio
    // <style> global (truco para ocultar el preheader) — sin un
    // font-size propio en este div, un bloque roto sin NINGÚN CSS
    // válido (ver reconstruirAtributos.js) se queda sin nada que le
    // gane a ese 0 heredado y el texto colapsa a alto cero.
    const html = marcador('codigo', 2, '<tr><td style="atributo:=" roto="">Texto que no debe colapsar</td></tr>')
    const resultado = marcarBloquesNoReconocidosParaPreview(html)
    expect(resultado).toMatch(/<div style="[^"]*font-size:\s*14px/)
  })
})

// ─── Fix 2026-07-20 (2da sesión): marco para bloques con atributos ───────
// rotos de CUALQUIER slug. Motivo verificado contra el DOM real del
// pipeline: generarExport envuelve el contenido en un <td> con
// font-size: 0 inline — un bloque cuyo tag roto no aporta NINGÚN CSS
// válido hereda ese 0 y el texto colapsa a alto cero en el preview de
// importación. El marco (que declara font-size: 14px) se interpone en
// la herencia; antes solo lo recibían los slug="codigo", pero desde
// que un atributo roto ya no fuerza código personalizado, una fila
// rota puede clasificar Bloque_Texto_Base y quedaba sin marco.
describe('marcarBloquesNoReconocidosParaPreview — bloques con atributos rotos (idxsAtributosRotos)', () => {
  it('un bloque de slug normal cuyo idx viene en la lista recibe marco ámbar "Atributos rotos" con font-size propio', () => {
    const html = '<!--BLOQUE slug="Bloque_Texto_Base" idx="2"--><tr><td>hola</td></tr><!--/BLOQUE-->'
    const resultado = marcarBloquesNoReconocidosParaPreview(html, [2])
    expect(resultado).toContain('id="preview-bloque-2"')
    expect(resultado).toContain('Atributos rotos')
    expect(resultado).toContain('#CA8A04')
    expect(resultado).toContain('font-size: 14px;')
  })

  it('un bloque de slug normal cuyo idx NO viene en la lista queda igual que siempre (sin marco)', () => {
    const html = '<!--BLOQUE slug="Bloque_Texto_Base" idx="2"--><tr><td>hola</td></tr><!--/BLOQUE-->'
    const resultado = marcarBloquesNoReconocidosParaPreview(html, [5])
    expect(resultado).toContain('id="preview-bloque-2"')
    expect(resultado).not.toContain('Atributos rotos')
    expect(resultado).not.toContain('outline')
  })

  it('sin segundo argumento (callers viejos / export sin avisos) el comportamiento no cambia en nada', () => {
    const html = '<!--BLOQUE slug="Bloque_Texto_Base" idx="0"--><tr><td>hola</td></tr><!--/BLOQUE-->'
    const resultado = marcarBloquesNoReconocidosParaPreview(html)
    expect(resultado).not.toContain('Atributos rotos')
  })

  it('un bloque slug="codigo" con atributo roto conserva su marco naranja de "No reconocido" (ya visible, no se duplica marco)', () => {
    const html = '<!--BLOQUE slug="codigo" idx="1"--><tr><td>x</td></tr><!--/BLOQUE-->'
    const resultado = marcarBloquesNoReconocidosParaPreview(html, [1])
    expect(resultado).toContain('No reconocido')
    expect(resultado).not.toContain('Atributos rotos')
    expect(resultado).toContain('font-size: 14px;')
  })
})
