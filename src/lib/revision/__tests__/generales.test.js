import { describe, it, expect } from 'vitest'
import { DetectarContenidoDuplicado, DetectarInlineEnvolviendoOutlook, DetectarFragmentoHtmlCrudoEnTexto } from '@/lib/revision/generales.js'
import { generarExport } from '@/lib/editor/exportar.js'
import { BLOQUES_HEADER, BLOQUES_CONTENIDO } from '@/lib/editor/bloques.js'

// Una pieza "sana" real: el propio export del editor (trae exactamente
// 1 preheader oculto y 1 <style>) — así el test de duplicados corre
// contra el mismo tipo de HTML que la herramienta analiza en serio.
function piezaSana() {
  return generarExport({
    bandaHeader: BLOQUES_HEADER.find(b => b.slug === 'CG_Banda_Roja_Header'),
    imgPrincipal: { activo: false, src: '', alt: '', title: '', link: '' },
    imgFooter: { activo: false, src: '', alt: '', link: '' },
    canvas: [{ ...BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base'), instanceId: 'x' }],
    indicadores: [],
  })
}

const STYLE_VML = `<style>v\\:* {behavior: url(#default#VML); display: inline-block;}</style>`

describe('DetectarContenidoDuplicado', () => {
  it('una pieza sana no dispara nada', () => {
    expect(DetectarContenidoDuplicado(piezaSana())).toEqual([])
  })

  it('la pieza pegada dos veces dispara las dos señales (preheader y <style> duplicados)', () => {
    const sana = piezaSana()
    const problemas = DetectarContenidoDuplicado(sana + '\n' + sana)
    expect(problemas).toHaveLength(2)
    expect(problemas[0].detalle).toContain('preheader')
    expect(problemas[1].detalle).toContain('<style>')
  })

  it('el <style> de VML que inyecta la plataforma NO cuenta como duplicado (caso URL)', () => {
    // Analizada por URL, TODA pieza sana viene con este style extra —
    // sin descartarlo, cualquier pieza daría falso positivo.
    const comoVieneDeUrl = STYLE_VML + '\n' + piezaSana()
    expect(DetectarContenidoDuplicado(comoVieneDeUrl)).toEqual([])
  })

  it('un div oculto que no cumple el patrón completo de preheader no cuenta', () => {
    // display:none sin font-size:1px ni opacity:0 — típico de
    // contenido mobile/desktop condicional, no es un preheader.
    const html = piezaSana() + `<div style="display: none;">bloque solo mobile</div>`
    expect(DetectarContenidoDuplicado(html)).toEqual([])
  })
})

describe('DetectarInlineEnvolviendoOutlook', () => {
  it('una pieza sana (con sus bloques MSO bien cerrados) no dispara nada', () => {
    expect(DetectarInlineEnvolviendoOutlook(piezaSana())).toEqual([])
  })

  it('detecta un <span> que envuelve la APERTURA de un bloque condicional de Outlook', () => {
    const html = `<td><span><!--[if (gte mso 9)|(IE)]><table><tr><td><![endif]--> texto</span></td>`
    const problemas = DetectarInlineEnvolviendoOutlook(html)
    expect(problemas).toHaveLength(1)
    expect(problemas[0].detalle).toContain('<span>')
  })

  it('detecta un <a> que envuelve el CIERRE de un bloque condicional', () => {
    const html = `<td><a href="https://x.com">texto <!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]--></a></td>`
    const problemas = DetectarInlineEnvolviendoOutlook(html)
    expect(problemas.length).toBeGreaterThanOrEqual(1)
    expect(problemas.some(p => p.detalle.includes('<a>'))).toBeTruthy()
  })

  it('un condicional COMPLETO dentro de un tag inline con contenido alrededor no dispara', () => {
    // El comentario condicional está adentro pero no toca ni la
    // apertura ni el cierre del tag — no es el patrón de riesgo.
    const html = `<span>antes <!--[if mso]>x<![endif]--> después</span>`
    expect(DetectarInlineEnvolviendoOutlook(html)).toEqual([])
  })
})

describe('DetectarFragmentoHtmlCrudoEnTexto', () => {
  it('detecta el caso real reportado: un <a> cortado pegado como texto', () => {
    const textoPegado = 'style="color: #333333; text-decoration: underline;" href="https://www.beneficios.icbc.com.ar/" data-label="LinkRef4_2" data-btnid="MjA0ODE2NDI%3d" target="_blank"&gt;https://www.beneficios.icbc.com.ar/'
    const html = `<td>${textoPegado}</td>`
    const problemas = DetectarFragmentoHtmlCrudoEnTexto(html)
    expect(problemas).toHaveLength(1)
    expect(problemas[0].detalle).toContain('href=')
  })

  it('detecta el mismo fragmento SIN el cierre ">" del tag — bug real reportado (Señal B)', () => {
    // Variante real reportada por segunda vez: el fragmento se cortó
    // ANTES del cierre del tag, así que nunca hay ningún < / > de por
    // medio (nada que el navegador escape a entidad) — la Señal A
    // (basada en &lt;/&gt;) no tiene nada para agarrarse acá. La
    // Señal B (2+ pares atributo="valor" en el mismo texto) sí lo
    // cubre, sin depender de ninguna entidad.
    const textoPegado = 'style="color: #333333; text-decoration: underline;" href="https://www.beneficios.icbc.com.ar/" data-label="LinkRef4_2" data-btnid="MjA0ODE2NDI%3d" target="_blank"'
    const html = `<td>${textoPegado}</td>`
    const problemas = DetectarFragmentoHtmlCrudoEnTexto(html)
    expect(problemas).toHaveLength(1)
    expect(problemas[0].snippet).toContain('target="_blank"')
  })

  it('un solo atributo="valor" suelto en texto normal NO dispara (la Señal B exige 2 o más)', () => {
    // Un legal real puede perfectamente mencionar algo como
    // 'configurado con style="dark"' una sola vez sin que sea un bug
    // — se necesitan 2+ pares para que la señal se active.
    const html = `<td>Este producto viene configurado con style="dark" por defecto.</td>`
    expect(DetectarFragmentoHtmlCrudoEnTexto(html)).toEqual([])
  })

  it('una pieza sana (el propio export del editor) no dispara nada', () => {
    const html = generarExport({
      bandaHeader: BLOQUES_HEADER.find(b => b.slug === 'CG_Banda_Roja_Header'),
      imgPrincipal: { activo: false, src: '', alt: '', title: '', link: '' },
      imgFooter: { activo: false, src: '', alt: '', link: '' },
      canvas: [{ ...BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base'), instanceId: 'x' }],
      indicadores: [],
    })
    expect(DetectarFragmentoHtmlCrudoEnTexto(html)).toEqual([])
  })

  it('un texto legítimo con un > suelto (ej. una comparación) no dispara si no hay atributos cerca', () => {
    const html = `<td>La tasa es mayor &gt; que el 5% anual, referencia general.</td>`
    expect(DetectarFragmentoHtmlCrudoEnTexto(html)).toEqual([])
  })

  it('un tag real (con < y > literales, no escapados) no dispara', () => {
    const html = `<td><a href="https://x.com" target="_blank" style="color:red;">texto real</a></td>`
    expect(DetectarFragmentoHtmlCrudoEnTexto(html)).toEqual([])
  })

  it('un alt="&gt;" legítimo describiendo un ícono (bullet tipo flecha) no dispara — bug real reportado', () => {
    // Caso real: alt="&gt;" vive DENTRO del atributo de un <img> real,
    // rodeado de los OTROS atributos de ESE MISMO tag (src, style,
    // width, height) — antes del fix, esos atributos "vecinos" caían
    // en la ventana de análisis alrededor de la entidad y disparaban
    // un falso positivo, aunque la entidad nunca estuvo en texto
    // visible sino dentro de un atributo de un tag real.
    const html = `<td align="left"><img src="https://cdn/bullets/bullet-super-rojo-der.png" alt="&gt;" style="display: inline; margin-bottom: -3px;" width="20" height="20"> Por ser cliente ICBC, tenés un descuento.</td>`
    expect(DetectarFragmentoHtmlCrudoEnTexto(html)).toEqual([])
  })

  it('agrupa varias entidades cercanas del mismo fragmento en un solo aviso', () => {
    // < y > ambos escapados (el fragmento completo de un <a ...> pegado como texto)
    const textoPegado = '&lt;a href="https://x.com" style="color:red;" target="_blank"&gt;texto&lt;/a&gt;'
    const html = `<td>${textoPegado}</td>`
    const problemas = DetectarFragmentoHtmlCrudoEnTexto(html)
    expect(problemas).toHaveLength(1)
  })
})
