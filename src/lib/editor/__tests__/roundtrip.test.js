import { describe, it, expect } from 'vitest'
import { generarExport } from '@/lib/editor/exportar.js'
import { importarDesdeHtml } from '@/lib/editor/importar.js'
import { detectarCampos, actualizarCampoEnHtml } from '@/lib/editor/campos.js'
import { BLOQUES_HEADER, BLOQUES_CONTENIDO } from '@/lib/editor/bloques.js'

// El test más valioso del editor: exportar una pieza con TODO el
// estado posible y verificar que importarDesdeHtml reconstruye ese
// mismo estado. Cubre de una pasada los marcadores, el tinte/destinte
// de color por tema, redes activas/inactivas, legales en los dos
// modos, firma, indicadores con sigla multi-palabra (bug real) e
// imágenes principal/footer.

function estadoBase({ legalesSeparados = false, tema = 'mall' } = {}) {
  const header = BLOQUES_HEADER.find(b => b.slug === 'EB_Banda_Negra_Header')
  const bloqueTexto = BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base')
  const bloqueBullet = BLOQUES_CONTENIDO.find(b => b.slug === 'Bullet_Bull_Rojo')

  // Editar un campo de texto antes de exportar, como haría el usuario
  const campo = detectarCampos(bloqueTexto.html).find(c => c.tipo === 'texto')
  const htmlEditado = actualizarCampoEnHtml(bloqueTexto.html, 'texto', campo.posicionOrden, { contenido: 'Texto editado por el usuario antes de exportar' }, campo.posicionReal)

  return {
    bandaHeader: header,
    redesOrden: [
      { key: 'linkedin', activa: true },
      { key: 'twitter', activa: false },
      { key: 'facebook', activa: true },
      { key: 'instagram', activa: true },
    ],
    tema,
    canvas: [
      { ...bloqueTexto, instanceId: `${bloqueTexto.id}-t`, htmlEditado },
      { ...bloqueBullet, instanceId: `${bloqueBullet.id}-b` },
    ],
    imgPrincipal: { activo: true, src: 'https://cdn/principal.png', alt: 'Alt principal', title: 'Title principal', link: 'https://promo.icbc.com.ar/destino' },
    imgFooter: { activo: true, src: 'https://cdn/footer.png', alt: 'Alt footer', link: 'https://promo.icbc.com.ar/footer' },
    legalesAdicionales: [
      { id: 1, texto: 'Primer legal específico de la promo.' },
      { id: 2, texto: 'Segundo legal, con más condiciones.' },
    ],
    legalesSeparados,
    firmaInstitucional: { activo: true, fila1Izq: 'ICBC Investments SAU SGFCI', fila1Der: 'ICBC (Argentina) SAU', fila2Izq: 'Sociedad Gerente', fila2Der: 'Sociedad Depositaria' },
    indicadores: [
      { id: 1, ref: '1', sigla: 'TNA Adelantada', valor: '133,00%' },
      { id: 2, ref: '2', sigla: 'CFTNA', valor: '241,50%' },
    ],
  }
}

describe('roundtrip export → import (marcadores)', () => {
  const estado = estadoBase()
  const html = generarExport(estado)
  const { resultado, avisos } = importarDesdeHtml(html)

  it('no genera avisos y reconstruye header y tema', () => {
    expect(avisos).toEqual([])
    expect(resultado.bandaHeader.slug).toBe('EB_Banda_Negra_Header')
    expect(resultado.tema).toBe('mall')
  })

  it('reconstruye el canvas con los mismos slugs y el texto editado', () => {
    expect(resultado.canvas.map(b => b.slug)).toEqual(['Bloque_Texto_Base', 'Bullet_Bull_Rojo'])
    expect(resultado.canvas[0].htmlEditado).toContain('Texto editado por el usuario antes de exportar')
  })

  it('revierte el color del tema al neutro #333333 (no queda teñido con el blanco de Mall)', () => {
    // El tema Mall exporta el texto en #ffffff; el htmlEditado que
    // guarda el editor debe volver al #333333 base — si quedara
    // teñido, cambiar de tema después no actualizaría el color.
    expect(resultado.canvas[0].htmlEditado).toContain('#333333')
    expect(resultado.canvas[0].htmlEditado).not.toContain('#ffffff')
  })

  it('reconstruye el estado real de las redes, incluida la desactivada (bug real)', () => {
    const twitter = resultado.redesOrden.find(r => r.key === 'twitter')
    expect(twitter).toBeDefined()
    expect(twitter.activa).toBe(false)
    expect(resultado.redesOrden.filter(r => r.activa)).toHaveLength(3)
    // Y la primera activa respeta el orden elegido por el usuario
    expect(resultado.redesOrden.filter(r => r.activa)[0].key).toBe('linkedin')
  })

  it('reconstruye imagen principal y footer con todos sus campos', () => {
    expect(resultado.imgPrincipal).toEqual({ activo: true, src: 'https://cdn/principal.png', alt: 'Alt principal', title: 'Title principal', link: 'https://promo.icbc.com.ar/destino', alto: 425 })
    expect(resultado.imgFooter).toEqual({ activo: true, src: 'https://cdn/footer.png', alt: 'Alt footer', link: 'https://promo.icbc.com.ar/footer' })
  })

  it('reconstruye los legales adicionales en orden, en modo corrido', () => {
    expect(resultado.legalesAdicionales.map(l => l.texto)).toEqual([
      'Primer legal específico de la promo.',
      'Segundo legal, con más condiciones.',
    ])
    expect(resultado.legalesSeparados).toBe(false)
  })

  it('reconstruye la firma institucional campo por campo', () => {
    expect(resultado.firmaInstitucional.activo).toBe(true)
    expect(resultado.firmaInstitucional.fila1Izq).toBe('ICBC Investments SAU SGFCI')
    expect(resultado.firmaInstitucional.fila2Der).toBe('Sociedad Depositaria')
  })

  it('reconstruye indicadores incluso con sigla de más de una palabra (bug real)', () => {
    expect(resultado.indicadores.map(i => [i.ref, i.sigla, i.valor])).toEqual([
      ['1', 'TNA Adelantada', '133,00%'],
      ['2', 'CFTNA', '241,50%'],
    ])
  })
})

describe('roundtrip — variantes', () => {
  it('modo legales separados se infiere correctamente al reimportar', () => {
    const { resultado } = importarDesdeHtml(generarExport(estadoBase({ legalesSeparados: true })))
    expect(resultado.legalesSeparados).toBe(true)
    expect(resultado.legalesAdicionales).toHaveLength(2)
  })

  it('tema icbc por default cuando no se pasa tema', () => {
    const estado = estadoBase()
    delete estado.tema
    const { resultado } = importarDesdeHtml(generarExport(estado))
    expect(resultado.tema).toBe('icbc')
  })

  it('estado mínimo (sin imágenes, legales, firma ni indicadores) también hace roundtrip limpio', () => {
    const bloque = BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base')
    const html = generarExport({
      bandaHeader: BLOQUES_HEADER.find(b => b.slug === 'CG_Banda_Roja_Header'),
      imgPrincipal: { activo: false, src: '', alt: '', title: '', link: '' },
      imgFooter: { activo: false, src: '', alt: '', link: '' },
      canvas: [{ ...bloque, instanceId: 'x' }],
      indicadores: [],
    })
    const { resultado, avisos } = importarDesdeHtml(html)
    expect(avisos).toEqual([])
    expect(resultado.imgPrincipal.activo).toBe(false)
    expect(resultado.imgFooter.activo).toBe(false)
    expect(resultado.legalesAdicionales).toEqual([])
    expect(resultado.firmaInstitucional).toBeNull()
    expect(resultado.indicadores).toEqual([])
  })
})

describe('importarDesdeHtml — fail soft', () => {
  it('un slug desconocido entra como código personalizado con aviso, sin tirar el resto', () => {
    const estado = estadoBase()
    const html = generarExport(estado).replace('slug="Bullet_Bull_Rojo"', 'slug="Template_Que_Ya_No_Existe"')
    const { resultado, avisos } = importarDesdeHtml(html)
    expect(resultado.canvas).toHaveLength(2)
    expect(resultado.canvas[0].slug).toBe('Bloque_Texto_Base')
    expect(resultado.canvas[1].slug).toBe('codigo')
    expect(avisos).toHaveLength(1)
    expect(avisos[0].tipo).toBe('no-reconocido')
    expect(avisos[0].canvasIdx).toBe(1)
  })

  it('HTML sin ningún marcador devuelve resultado null con aviso general', () => {
    const { resultado, avisos } = importarDesdeHtml('<table><tr><td>una pieza cualquiera</td></tr></table>')
    expect(resultado).toBeNull()
    expect(avisos).toHaveLength(1)
    expect(avisos[0].tipo).toBe('general')
  })
})

describe('generarExport — comillas dobles en atributos de imagen', () => {
  it('escapa comillas dobles en alt/title/link de Imagen principal y footer', () => {
    const bloque = BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base')
    const html = generarExport({
      bandaHeader: BLOQUES_HEADER.find(b => b.slug === 'CG_Banda_Roja_Header'),
      imgPrincipal: { activo: true, src: 'https://x.com/a.png', alt: 'Promo "Hot Sale" 50%', title: 'Título "con comillas"', link: 'https://x.com?a="1"' },
      imgFooter: { activo: true, src: 'https://x.com/f.png', alt: 'Footer "x"', title: '', link: '' },
      canvas: [{ ...bloque, instanceId: 'x' }],
      indicadores: [],
    })
    // Ningún atributo debería cortarse antes de tiempo por una
    // comilla suelta — se verifica que <img no aparezca partido
    // buscando el par completo alt="...&quot;...&quot;..."
    expect(html).toContain('alt="Promo &quot;Hot Sale&quot; 50%"')
    expect(html).toContain('title="Título &quot;con comillas&quot;"')
    expect(html).toContain('href="https://x.com?a=&quot;1&quot;"')
    expect(html).toContain('alt="Footer &quot;x&quot;"')
    // El HTML sigue siendo importable después del escape (no rompió el roundtrip)
    const { resultado, avisos } = importarDesdeHtml(html)
    expect(avisos).toEqual([])
    expect(resultado.imgPrincipal.activo).toBe(true)
  })
})

describe('generarExport — alto real de Imagen principal (no forzado a 425)', () => {
  it('exporta el alto medido en vez de 425 fijo, y lo reimporta sin perderlo', () => {
    const bloque = BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base')
    const html = generarExport({
      bandaHeader: BLOQUES_HEADER.find(b => b.slug === 'CG_Banda_Roja_Header'),
      imgPrincipal: { activo: true, src: 'https://x.com/vertical.png', alt: '', title: '', link: '', alto: 900 },
      imgFooter: { activo: false, src: '' },
      canvas: [{ ...bloque, instanceId: 'x' }],
      indicadores: [],
    })
    expect(html).toContain('height: 900px')
    expect(html).toContain('height="900"')
    expect(html).not.toContain('height="425"')
    const { resultado } = importarDesdeHtml(html)
    expect(resultado.imgPrincipal.alto).toBe(900)
  })

  it('sin alto especificado, sigue exportando 425 (compatibilidad hacia atrás)', () => {
    const bloque = BLOQUES_CONTENIDO.find(b => b.slug === 'Bloque_Texto_Base')
    const html = generarExport({
      bandaHeader: BLOQUES_HEADER.find(b => b.slug === 'CG_Banda_Roja_Header'),
      imgPrincipal: { activo: true, src: 'https://x.com/a.png', alt: '', title: '', link: '' }, // sin alto
      imgFooter: { activo: false, src: '' },
      canvas: [{ ...bloque, instanceId: 'x' }],
      indicadores: [],
    })
    expect(html).toContain('height="425"')
  })
})
