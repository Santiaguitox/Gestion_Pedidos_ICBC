import { describe, it, expect } from 'vitest'
import {
  HEADERS_ANTERIORES, SLUGS_MALBA,
  detectarHeaderEnHtml, detectarHeaderPorSlug, esIconoRedSocial, marcaPorNombreDeLogo, resolverHeaderImportado, segmentoPorColorDeFondo,
} from '@/lib/editor/headersCompat.js'
import { combinacionValida, crearBandaHeader, URL_BASE_LOGOS } from '@/lib/editor/headers.js'
import { BLOQUES_HEADER, bandasHeaderBiblioteca, buscarMalba, etiquetaHeaderBiblioteca, resolverHeaderPorSlug } from '@/lib/editor/bloques.js'
import { generarExport } from '@/lib/editor/exportar.js'
import { encontrarImgPrincipal, importarDesdeHtml, importarHeuristico } from '@/lib/editor/importar.js'

// Los 14 headers del diseño anterior, tal cual estaban en el proyecto
// (con sus logos, redes sociales y colores viejos). Son la prueba real
// de que el reconocimiento no depende de datos inventados.
const HEADERS_VIEJOS = import.meta.glob('./fixtures/headers-anteriores/*.html', { query: '?raw', import: 'default', eager: true })
const PIEZAS = import.meta.glob('./fixtures/*.html', { query: '?raw', import: 'default', eager: true })
const piezaLogoPyme = PIEZAS['./fixtures/pieza-marcador-viejo-logo-pyme.html']
const viejo = slug => HEADERS_VIEJOS[`./fixtures/headers-anteriores/${slug}.html`]

const logoNuevo = (marca, sufijo = '_Blanco') => `<img src="${URL_BASE_LOGOS}Logo_Header_${marca}${sufijo}.png" alt="x" />`
const conFondo = (hex, interior = '') => `<table style="background-color: ${hex};" bgcolor="${hex}">${interior}</table>`

describe('segmentoPorColorDeFondo', () => {
  it('reconoce los colores nuevos y los del diseño anterior', () => {
    expect(segmentoPorColorDeFondo(conFondo('#C7000B'))).toBe('CG')
    expect(segmentoPorColorDeFondo(conFondo('#c4161c'))).toBe('CG')
    expect(segmentoPorColorDeFondo(conFondo('#0D131A'))).toBe('EB')
    expect(segmentoPorColorDeFondo(conFondo('#000000'))).toBe('EB')
    expect(segmentoPorColorDeFondo(conFondo('#000'))).toBe('EB')
    expect(segmentoPorColorDeFondo(conFondo('#635843'))).toBe('PAY')
  })
  it('devuelve null si no hay color de segmento o si hay de dos segmentos distintos', () => {
    expect(segmentoPorColorDeFondo(conFondo('#2e2f31'))).toBeNull()
    expect(segmentoPorColorDeFondo(conFondo('#c7000b') + conFondo('#635843'))).toBeNull()
    expect(segmentoPorColorDeFondo('')).toBeNull()
  })
  it('ignora el color de texto: solo cuentan los fondos', () => {
    expect(segmentoPorColorDeFondo('<td style="color: #c7000b;">x</td>')).toBeNull()
  })
})

describe('detectarHeaderEnHtml — logos del diseño nuevo', () => {
  it('_Coin_Rojo es siempre EB', () => {
    expect(detectarHeaderEnHtml(logoNuevo('Mall', '_Blanco_Coin_Rojo'))).toMatchObject({ tipo: 'nuevo', marcaId: 'Mall', segmentoId: 'EB' })
  })
  it('_Blanco toma el segmento del color de fondo: CG o Pay', () => {
    expect(detectarHeaderEnHtml(conFondo('#c7000b', logoNuevo('Empresas')))).toMatchObject({ marcaId: 'Empresas', segmentoId: 'CG' })
    expect(detectarHeaderEnHtml(conFondo('#635843', logoNuevo('Sueldos')))).toMatchObject({ marcaId: 'Sueldos', segmentoId: 'PAY' })
  })
  it('_Blanco sin color reconocible deja el segmento sin resolver', () => {
    expect(detectarHeaderEnHtml(logoNuevo('Pymes'))).toMatchObject({ tipo: 'nuevo', marcaId: 'Pymes', segmentoId: null })
  })
  it('_Blanco sobre fondo EB es inconsistente: no se adivina', () => {
    expect(detectarHeaderEnHtml(conFondo('#0d131a', logoNuevo('Pymes')))).toMatchObject({ marcaId: 'Pymes', segmentoId: null })
  })
  it('una combinación que no existe (Exclusive en CG) no se acepta', () => {
    expect(detectarHeaderEnHtml(conFondo('#c7000b', logoNuevo('Exclusive')))).toMatchObject({ marcaId: 'Exclusive', segmentoId: null })
  })
  it('ignora el dominio y las mayúsculas del nombre de archivo', () => {
    const html = conFondo('#c7000b', '<img src="https://otro-cdn.com/x/LOGO_HEADER_HIPOTECARIOS_BLANCO.PNG?v=2">')
    expect(detectarHeaderEnHtml(html)).toMatchObject({ marcaId: 'Hipotecarios', segmentoId: 'CG' })
  })
  it('un logo con una marca que no está en el catálogo no se reconoce', () => {
    expect(detectarHeaderEnHtml(logoNuevo('MarcaNueva')).tipo).toBeNull()
  })
})

describe('detectarHeaderEnHtml — los 14 headers del diseño anterior', () => {
  it('hay un fixture por cada header anterior (12 con equivalente + 2 Malba)', () => {
    expect(Object.keys(HEADERS_VIEJOS)).toHaveLength(14)
  })

  for (const h of HEADERS_ANTERIORES) {
    it(`${h.slug} → ${h.marcaId} · ${h.segmentoId}`, () => {
      expect(detectarHeaderEnHtml(viejo(h.slug))).toMatchObject({ tipo: 'anterior', marcaId: h.marcaId, segmentoId: h.segmentoId })
    })
  }

  it('cada equivalente nuevo existe en el catálogo', () => {
    for (const h of HEADERS_ANTERIORES) expect(combinacionValida(h.marcaId, h.segmentoId), h.slug).toBe(true)
  })

  it('Malba (CG y EB) se reconoce como Malba, con el segmento por su color viejo', () => {
    expect(detectarHeaderEnHtml(viejo(SLUGS_MALBA.CG))).toMatchObject({ tipo: 'malba', segmentoId: 'CG' })
    expect(detectarHeaderEnHtml(viejo(SLUGS_MALBA.EB))).toMatchObject({ tipo: 'malba', segmentoId: 'EB' })
  })

  it('Multipay estaba en CG y en EB con el mismo logo: se desempata por el color', () => {
    expect(detectarHeaderEnHtml(viejo('CG_Banda_Roja_Header_Multipay'))).toMatchObject({ marcaId: 'Multipay', segmentoId: 'CG' })
    expect(detectarHeaderEnHtml(viejo('EB_Banda_Negra_Header_Multipay'))).toMatchObject({ marcaId: 'Multipay', segmentoId: 'EB' })
  })

  it('Multipay sin color reconocible deja el segmento sin resolver', () => {
    const sinColor = viejo('CG_Banda_Roja_Header_Multipay').replace(/#c4161c/gi, '#123456')
    expect(detectarHeaderEnHtml(sinColor)).toMatchObject({ tipo: 'anterior', marcaId: 'Multipay', segmentoId: null })
  })

  it('una pieza sin ningún logo reconocible no se identifica (pero puede dar el segmento por color)', () => {
    expect(detectarHeaderEnHtml('<table bgcolor="#635843"><img src="x/otra.png"></table>')).toMatchObject({ tipo: null, marcaId: null, segmentoId: 'PAY' })
  })
})

describe('detectarHeaderPorSlug', () => {
  it('reconoce los slugs nuevos', () => {
    expect(detectarHeaderPorSlug('EB_Exclusive')).toMatchObject({ tipo: 'nuevo', marcaId: 'Exclusive', segmentoId: 'EB' })
  })
  it('mapea cada slug anterior a su equivalente nuevo', () => {
    for (const h of HEADERS_ANTERIORES) {
      expect(detectarHeaderPorSlug(h.slug)).toMatchObject({ tipo: 'anterior', marcaId: h.marcaId, segmentoId: h.segmentoId })
    }
  })
  it('reconoce los slugs de Malba', () => {
    expect(detectarHeaderPorSlug(SLUGS_MALBA.CG)).toMatchObject({ tipo: 'malba', segmentoId: 'CG' })
    expect(detectarHeaderPorSlug(SLUGS_MALBA.EB)).toMatchObject({ tipo: 'malba', segmentoId: 'EB' })
  })
  it('un slug desconocido o vacío no se reconoce', () => {
    expect(detectarHeaderPorSlug('Lo_Que_Sea').tipo).toBeNull()
    expect(detectarHeaderPorSlug(null).tipo).toBeNull()
  })
})

describe('headers Malba (siguen siendo HTML estático, con los colores nuevos)', () => {
  it('están en el catálogo del editor, uno por segmento', () => {
    expect(buscarMalba('CG')?.slug).toBe(SLUGS_MALBA.CG)
    expect(buscarMalba('EB')?.slug).toBe(SLUGS_MALBA.EB)
    expect(BLOQUES_HEADER.filter(b => b.anterior)).toHaveLength(2)
  })
  it('usan los colores nuevos y ninguno de los viejos', () => {
    const cg = buscarMalba('CG').html
    const eb = buscarMalba('EB').html
    expect(cg).toContain('background-color: #c7000b;')
    expect(cg).toContain('bgcolor="#c7000b"')
    expect(cg).not.toContain('#c4161c')
    expect(eb).toContain('background-color: #0d131a;')
    expect(eb).toContain('bgcolor="#0d131a"')
    expect(eb).not.toContain('#000000')
  })
  it('conservan la disposición de las imágenes (logo del socio + logo ICBC)', () => {
    const quitarColor = h => h.replace(/#c4161c|#000000|#c7000b|#0d131a/gi, 'C')
    expect(quitarColor(buscarMalba('CG').html)).toBe(quitarColor(viejo(SLUGS_MALBA.CG)))
    expect(quitarColor(buscarMalba('EB').html)).toBe(quitarColor(viejo(SLUGS_MALBA.EB)))
  })
})

describe('resolverHeaderImportado', () => {
  it('un header anterior con equivalente se reemplaza y avisa que es del diseño anterior', () => {
    const r = resolverHeaderImportado(detectarHeaderPorSlug('CG_Banda_Roja_Header_Empresas'), buscarMalba)
    expect(r.bandaHeader.slug).toBe('CG_Empresas')
    expect(r.headerPendiente).toBeNull()
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0].texto).toMatch(/diseño anterior/)
    expect(r.avisos[0].texto).toMatch(/Empresas · CG/)
    expect(r.avisos[0].texto).toMatch(/redes sociales/)
  })
  it('un header nuevo se carga sin avisos', () => {
    const r = resolverHeaderImportado(detectarHeaderPorSlug('PAY_Sueldos'), buscarMalba)
    expect(r.bandaHeader.slug).toBe('PAY_Sueldos')
    expect(r.avisos).toEqual([])
    expect(r.headerPendiente).toBeNull()
  })
  it('Malba se conserva; el aviso aparece solo si se lo reconoció por el logo, no por el marcador', () => {
    const porSlug = resolverHeaderImportado(detectarHeaderPorSlug(SLUGS_MALBA.EB), buscarMalba)
    expect(porSlug.bandaHeader.slug).toBe(SLUGS_MALBA.EB)
    expect(porSlug.avisos).toEqual([])
    const porLogo = resolverHeaderImportado(detectarHeaderEnHtml(viejo(SLUGS_MALBA.CG)), buscarMalba)
    expect(porLogo.bandaHeader.slug).toBe(SLUGS_MALBA.CG)
    expect(porLogo.avisos[0].texto).toMatch(/Malba/)
  })
  it('marca reconocida pero segmento dudoso: queda pendiente con lo que sí se sabe', () => {
    const r = resolverHeaderImportado({ tipo: 'nuevo', marcaId: 'Pymes', segmentoId: null }, buscarMalba)
    expect(r.headerPendiente).toEqual({ marcaId: 'Pymes', segmentoId: null })
    expect(r.bandaHeader.marcaId).toBe('Pymes')
    expect(r.avisos[0].texto).toMatch(/no su segmento/)
  })
  it('irreconocible: carga Base · CG y queda pendiente', () => {
    const r = resolverHeaderImportado(detectarHeaderPorSlug('Lo_Que_Sea'), buscarMalba)
    expect(r.bandaHeader.slug).toBe('CG_Base')
    expect(r.headerPendiente).toEqual({ marcaId: null, segmentoId: null })
    expect(r.avisos[0].texto).toMatch(/No se pudo identificar/)
  })
  it('irreconocible pero con el segmento por color: usa ese segmento por defecto', () => {
    const r = resolverHeaderImportado({ tipo: null, marcaId: null, segmentoId: 'PAY' }, buscarMalba)
    expect(r.bandaHeader.slug).toBe('PAY_Base')
    expect(r.headerPendiente).toEqual({ marcaId: null, segmentoId: 'PAY' })
  })
  it('Malba sin segmento claro queda pendiente', () => {
    const r = resolverHeaderImportado({ tipo: 'malba', marcaId: null, segmentoId: null, origen: 'html' }, buscarMalba)
    expect(r.headerPendiente).not.toBeNull()
  })
})

describe('resolverHeaderPorSlug (borradores guardados)', () => {
  it('un borrador con el slug viejo pasa al header nuevo equivalente', () => {
    const r = resolverHeaderPorSlug('EB_Banda_Negra_Header_Exclusive')
    expect(r.bandaHeader.slug).toBe('EB_Exclusive')
    expect(r.avisos[0].texto).toMatch(/diseño anterior/)
  })
})

// ─── Importación completa de una pieza ──────────────────────────────────────
const base = { imgPrincipal: { activo: false, src: '' }, imgFooter: { activo: false, src: '' }, canvas: [], legalesAdicionales: [], legalesSeparados: false, firmaInstitucional: null, indicadores: [] }
function piezaConMarcador(slugHeader, bandaHeader = crearBandaHeader('Base', 'CG')) {
  const bloque = { id: 'x', slug: 'Bloque_Texto_Base', instanceId: 'i', html: '<tr><td>texto</td></tr>' }
  let html = generarExport({ ...base, bandaHeader, canvas: [bloque] }).replace(/<!--HEADER:[^-]+-->/, `<!--HEADER:${slugHeader}-->`)
  // Una pieza del editor viejo trae el HTML de ese header viejo (no el generado).
  if (viejo(slugHeader)) html = html.replace(bandaHeader.html, viejo(slugHeader))
  return html
}

describe('importarDesdeHtml — header de piezas con marcador', () => {
  it('pieza exportada por el editor nuevo: header exacto, sin avisos ni pendientes', () => {
    for (const [marca, seg] of [['Empresas', 'CG'], ['Mall', 'EB'], ['Sueldos', 'PAY'], ['Exclusive', 'EB']]) {
      const html = generarExport({ ...base, bandaHeader: crearBandaHeader(marca, seg), canvas: [{ id: 'x', slug: 'Bloque_Texto_Base', instanceId: 'i', html: '<tr><td>texto</td></tr>' }] })
      const { resultado, avisos } = importarDesdeHtml(html)
      expect(resultado.bandaHeader.slug, `${marca} ${seg}`).toBe(`${seg}_${marca}`)
      expect(resultado.headerPendiente).toBeNull()
      expect(avisos.filter(a => /header/i.test(a.texto))).toEqual([])
    }
  })

  it('pieza exportada por el editor VIEJO: se reemplaza por el header nuevo y avisa', () => {
    const { resultado, avisos } = importarDesdeHtml(piezaConMarcador('CG_Banda_Roja_Header_Comex'))
    expect(resultado.bandaHeader.slug).toBe('CG_Comex')
    expect(resultado.headerPendiente).toBeNull()
    expect(avisos.some(a => /diseño anterior/.test(a.texto))).toBe(true)
  })

  it('pieza con header Malba: se conserva, sin avisos', () => {
    const malba = buscarMalba('EB')
    const html = generarExport({ ...base, bandaHeader: malba, canvas: [{ id: 'x', slug: 'Bloque_Texto_Base', instanceId: 'i', html: '<tr><td>texto</td></tr>' }] })
    const { resultado, avisos } = importarDesdeHtml(html)
    expect(resultado.bandaHeader.slug).toBe(SLUGS_MALBA.EB)
    expect(avisos.filter(a => /header|Malba/i.test(a.texto))).toEqual([])
  })

  it('slug irreconocible: queda pendiente para que el usuario elija', () => {
    const { resultado, avisos } = importarDesdeHtml(piezaConMarcador('Header_Inventado'))
    expect(resultado.headerPendiente).toEqual({ marcaId: null, segmentoId: null })
    expect(resultado.bandaHeader.slug).toBe('CG_Base')
    expect(avisos.some(a => /No se pudo identificar/.test(a.texto))).toBe(true)
  })

  it('sin marcador de header pero con el logo nuevo: lo reconoce por el logo y el color', () => {
    const html = piezaConMarcador('x', crearBandaHeader('Hipotecarios', 'PAY')).replace(/<!--HEADER:[^-]+-->/, '').replace('<!--/HEADER-->', '')
    const { resultado } = importarDesdeHtml(html)
    expect(resultado.bandaHeader.slug).toBe('PAY_Hipotecarios')
    expect(resultado.headerPendiente).toBeNull()
  })

  it('ya no devuelve redesOrden', () => {
    const { resultado } = importarDesdeHtml(piezaConMarcador('CG_Base'))
    expect('redesOrden' in resultado).toBe(false)
  })
})

// importarHeuristico es el camino de las piezas externas (sin marcadores).
// Se arma la pieza con generarExport y se le sacan todos los comentarios
// de marcador, que es lo que ve el importador con una pieza ajena.
function sinMarcadores(html) {
  return html.replace(/<!--\/?(?:BLOQUE|HEADER|IMG_PRINCIPAL|IMG_FOOTER|FIRMA_INSTITUCIONAL|INDICADORES)[^>]*-->/g, '')
}
describe('importarHeuristico — header de piezas externas', () => {
  const bloques = [{ id: 'x', slug: 'Bloque_Texto_Base', instanceId: 'i', html: '<tr><td style="font-family: Arial; font-size: 15px; color: #333333;">Texto de la pieza</td></tr>' }]
  const importar = banda => importarHeuristico(sinMarcadores(generarExport({ ...base, bandaHeader: banda, canvas: bloques })))

  it('reconoce el header nuevo por logo y color, para todas las combinaciones', () => {
    for (const [marca, seg] of [['Empresas', 'CG'], ['Mall', 'EB'], ['Sueldos', 'PAY'], ['Multipay', 'CG'], ['Multipay', 'EB'], ['Exclusive', 'EB']]) {
      const { resultado, avisos } = importar(crearBandaHeader(marca, seg))
      expect(resultado.bandaHeader.slug, `${marca} ${seg}`).toBe(`${seg}_${marca}`)
      expect(resultado.headerPendiente).toBeNull()
      expect(avisos.some(a => /Header detectado/.test(a.texto)), `${marca} ${seg}`).toBe(true)
    }
  })

  it('una pieza con un header del diseño anterior se reemplaza por su equivalente y avisa', () => {
    const headerNuevo = crearBandaHeader('Base', 'CG')
    const piezaVieja = sinMarcadores(generarExport({ ...base, bandaHeader: headerNuevo, canvas: bloques }))
      .replace(headerNuevo.html, viejo('CG_Banda_Roja_Header_Empresas'))
    expect(piezaVieja).toContain('firma_icbc_empresas_blanco.png')
    const { resultado, avisos } = importarHeuristico(piezaVieja)
    expect(resultado.bandaHeader.slug).toBe('CG_Empresas')
    expect(avisos.some(a => /diseño anterior/.test(a.texto))).toBe(true)
  })

  it('una pieza con el header Malba viejo (colores viejos) queda con Malba y colores nuevos', () => {
    const base2 = sinMarcadores(generarExport({ ...base, bandaHeader: buscarMalba('EB'), canvas: bloques }))
    const piezaVieja = base2.replace(buscarMalba('EB').html, viejo(SLUGS_MALBA.EB))
    const { resultado } = importarHeuristico(piezaVieja)
    expect(resultado.bandaHeader.slug).toBe(SLUGS_MALBA.EB)
    expect(resultado.bandaHeader.html).toContain('#0d131a')
  })

  it('una pieza con un header que no es de ninguna marca conocida queda pendiente', () => {
    const html = sinMarcadores(generarExport({ ...base, bandaHeader: crearBandaHeader('Mall', 'CG'), canvas: bloques }))
      .replace(/Logo_Header_Mall_Blanco\.png/g, 'logo_de_otra_cosa.png')
    const { resultado } = importarHeuristico(html)
    expect(resultado.headerPendiente).not.toBeNull()
    expect(resultado.headerPendiente.segmentoId).toBe('CG')
  })

  it('ya no devuelve redesOrden', () => {
    const { resultado } = importar(crearBandaHeader('Base', 'CG'))
    expect('redesOrden' in resultado).toBe(false)
  })
})

describe('biblioteca de headers: una tarjeta por segmento', () => {
  it('lista CG, EB y Pay para la marca elegida', () => {
    expect(bandasHeaderBiblioteca('Base').map(b => b.slug)).toEqual(['CG_Base', 'EB_Base', 'PAY_Base'])
    expect(bandasHeaderBiblioteca('Base').map(etiquetaHeaderBiblioteca)).toEqual(['CG', 'EB', 'Pay'])
  })
  it('omite los segmentos donde la marca no existe', () => {
    expect(bandasHeaderBiblioteca('Exclusive').map(b => b.slug)).toEqual(['EB_Exclusive'])
    expect(bandasHeaderBiblioteca('Malba').map(b => b.segmentoId)).toEqual(['CG', 'EB'])
  })
})

describe('Malba en la biblioteca', () => {
  it('solo hay dos headers Malba (CG y EB) aunque queden .html viejos en Header/', () => {
    const malba = BLOQUES_HEADER.filter(b => b.anterior)
    expect(malba.map(b => b.slug).sort()).toEqual(['CG_Banda_Roja_Header_Malba', 'EB_Banda_Negra_Header_Malba'])
    expect(BLOQUES_HEADER).toHaveLength(31 + 2)
    expect(buscarMalba('PAY')).toBeNull()
  })
})

describe('marcador desactualizado: manda el logo de la pieza', () => {
  // Pieza real: el marcador dice CG_Banda_Roja_Header (Base) pero alguien
  // cambió el logo a logo_ICBC_Pyme.png en el HTML.
  it('tu pieza real (marcador de Base + logo_ICBC_Pyme.png): carga Pymes · CG, no la Base', () => {
    const { resultado, avisos } = importarHeuristico(piezaLogoPyme)
    expect(resultado.bandaHeader.slug).toBe('CG_Pymes')
    expect(resultado.headerPendiente).toBeNull()
    expect(avisos.some(a => /diseño anterior/.test(a.texto))).toBe(true)
  })
  it('con marcador que no coincide con el logo, manda el logo y avisa', () => {
    const html = piezaConMarcador('CG_Base', crearBandaHeader('Pymes', 'CG'))
    const { resultado, avisos } = importarDesdeHtml(html)
    expect(resultado.bandaHeader.slug).toBe('CG_Pymes')
    expect(avisos.some(a => /marcador del header decía "Base".*Pymes/.test(a.texto))).toBe(true)
  })
  it('marcador y logo que coinciden: sin aviso de discrepancia', () => {
    const { avisos } = importarDesdeHtml(piezaConMarcador('CG_Banda_Roja_Header_Comex'))
    expect(avisos.some(a => /marcador del header decía/.test(a.texto))).toBe(false)
  })
  it('reconoce la marca por el nombre del logo, con singular o plural', () => {
    for (const [archivo, marca] of [['logo_ICBC_Pyme.png', 'Pymes'], ['Logo_ICBC_Mall_240x60.png', 'Mall'], ['firma_inversion.png', 'Inversiones'], ['firma_empresa.png', 'Empresas']]) {
      expect(marcaPorNombreDeLogo(archivo)?.id, archivo).toBe(marca)
    }
  })
  it('la marca tiene que aparecer como palabra y "Base" no se busca por nombre', () => {
    expect(marcaPorNombreDeLogo('logo_small_240.png')).toBeNull()
    expect(marcaPorNombreDeLogo('logo_ICBC_base.png')).toBeNull()
    expect(marcaPorNombreDeLogo('icbc-Pymes-HOR.png')?.id).toBe('Pymes')
  })
  it('la imagen principal (600px) no cuenta como logo aunque diga Pymes', () => {
    const sinLogo = '<table><tr><td><img src="https://x.com/logos/header/logo-Tw_B_56x56.png" width="28"></td></tr><tr><td><img src="https://x.com/img/ICBC_Pymes2025_EmlMKT_1200x842.png" width="600" height="421"></td></tr></table>'
    expect(detectarHeaderEnHtml(sinLogo).marcaId).toBeNull()
  })
})

describe('logo desconocido en un header viejo con redes sociales', () => {
  it('reconoce los íconos de redes de los headers viejos', () => {
    for (const f of ['logo-Tw_B_56x56.png', 'logo-Fb_B_56x56.png', 'logo-Ig_B_56x56.png', 'logo-In_B_56x56.png']) expect(esIconoRedSocial(f), f).toBe(true)
    expect(esIconoRedSocial('logo_ICBC_Pyme.png')).toBe(false)
  })
  it('las redes vienen primero, pero se revisa el logo de la marca que sigue', () => {
    // Header viejo real (4 redes + logo) con el logo cambiado por uno de nombre desconocido.
    const html = viejo('CG_Banda_Roja_Header_Empresas').replace('firma_icbc_empresas_blanco.png', 'logo_ICBC_Pyme.png')
    expect(html.indexOf('logo-Tw_B_56x56.png')).toBeLessThan(html.indexOf('logo_ICBC_Pyme.png'))
    const d = detectarHeaderEnHtml(html)
    expect(d.marcaId).toBe('Pymes')
    expect(d.segmentoId).toBe('CG')
  })
})

describe('pieza real: redes + logo icbc-Pymes-HOR.png + imagen principal 600x421', () => {
  const caso = PIEZAS['./fixtures/pieza-redes-logo-icbc-pymes-hor.html']
  it('reconoce el header Pymes · CG saltando las redes, aunque el logo no esté en logos/header ni diga "logo"', () => {
    const { resultado } = importarHeuristico(caso)
    expect(resultado.bandaHeader.slug).toBe('CG_Pymes')
    expect(resultado.headerPendiente).toBeNull()
  })
  it('reconoce la imagen principal aunque mida 421 de alto, y conserva ese alto', () => {
    const { resultado, avisos } = importarHeuristico(caso)
    expect(resultado.imgPrincipal.activo).toBe(true)
    expect(resultado.imgPrincipal.src).toContain('ICBC_Pymes2025_EmlMKT_1200x842_5.png')
    expect(resultado.imgPrincipal.alto).toBe(421)
    expect(avisos.some(a => /imagen principal/i.test(a.texto))).toBe(false)
  })
  it('acepta solo alturas razonables', () => {
    const img = h => `<img src="https://x.com/a.png" width="600" height="${h}">`
    expect(encontrarImgPrincipal(img(425))).not.toBeNull()
    expect(encontrarImgPrincipal(img(421))).not.toBeNull()
    expect(encontrarImgPrincipal(img(150))).toBeNull()
    expect(encontrarImgPrincipal(img(900))).toBeNull()
    expect(encontrarImgPrincipal('<img src="https://x.com/a.png" width="300" height="425">')).toBeNull()
  })
})
