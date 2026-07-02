import { describe, it, expect } from 'vitest'
import { DetectarContenidoDuplicado, DetectarInlineEnvolviendoOutlook } from '@/lib/revision/generales.js'
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
