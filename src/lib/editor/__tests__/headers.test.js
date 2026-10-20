import { describe, it, expect } from 'vitest'
import {
  ALTO_BANDA, CATALOGO_MARCAS, SEGMENTOS, URL_BASE_LOGOS,
  buscarMarca, combinacionValida, crearBandaHeader, dimensionesLogo, espaciadoresBanda,
  generarBloquesHeader, generarHtmlBanda, parsearSlugHeader, slugHeader, validarCatalogo,
} from '@/lib/editor/headers.js'
import { colorPorPrefijoHeader } from '@/lib/editor/constantes.js'
import { generarExport } from '@/lib/editor/exportar.js'

// Suma de las tres alturas que forman la banda: espaciador de arriba +
// alto del logo + espaciador de abajo. Se lee del HTML generado (no de
// los helpers) para comprobar el resultado real.
function alturasDeBanda(html) {
  const espaciadores = [...html.matchAll(/<td colspan="3" style="height: (\d+)px;/g)].map(m => Number(m[1]))
  const logo = Number(html.match(/<img\b[^>]*\sheight="(\d+)"/)[1])
  return { arriba: espaciadores[0], abajo: espaciadores[1], logo, total: espaciadores[0] + logo + espaciadores[1] }
}

describe('catálogo de marcas y segmentos', () => {
  it('no tiene errores de validación', () => {
    expect(validarCatalogo()).toEqual([])
  })

  it('tiene las 11 marcas del rediseño y los 3 segmentos con sus colores', () => {
    expect(CATALOGO_MARCAS.map(m => m.id)).toEqual(['Base', 'Comex', 'Empresas', 'Exclusive', 'Hipotecarios', 'Inversiones', 'Jubilaciones', 'Mall', 'Multipay', 'Pymes', 'Sueldos'])
    expect(SEGMENTOS.map(s => [s.id, s.color])).toEqual([['CG', '#c7000b'], ['EB', '#0d131a'], ['PAY', '#635843']])
  })

  it('muestra los logos a la mitad del archivo (escala 2), salvo Multipay (1x) y Base (126x44)', () => {
    expect(dimensionesLogo(buscarMarca('Comex'))).toEqual({ ancho: 265, alto: 28 })
    expect(dimensionesLogo(buscarMarca('Empresas'))).toEqual({ ancho: 189, alto: 28 })
    expect(dimensionesLogo(buscarMarca('Base'))).toEqual({ ancho: 126, alto: 44 })
    expect(dimensionesLogo(buscarMarca('Multipay'))).toEqual({ ancho: 174, alto: 28 })
  })

  it('conserva la proporción exacta del archivo al mostrarlo', () => {
    for (const m of CATALOGO_MARCAS.filter(m => !m.mostrar)) {
      const { ancho, alto } = dimensionesLogo(m)
      expect(ancho / alto).toBeCloseTo(m.ancho / m.alto, 10)
    }
  })

  it('Exclusive solo existe en EB (no tiene versión _Blanco)', () => {
    expect(combinacionValida('Exclusive', 'EB')).toBe(true)
    expect(combinacionValida('Exclusive', 'CG')).toBe(false)
    expect(combinacionValida('Exclusive', 'PAY')).toBe(false)
    expect(crearBandaHeader('Exclusive', 'CG')).toBeNull()
  })

  it('Sueldos y Jubilaciones existen en los tres segmentos (tienen las dos variantes de imagen)', () => {
    for (const id of ['Sueldos', 'Jubilaciones']) {
      for (const seg of ['CG', 'EB', 'PAY']) expect(combinacionValida(id, seg)).toBe(true)
    }
  })

  it('genera una banda por cada combinación válida (11 × 3 − 2 de Exclusive)', () => {
    expect(generarBloquesHeader()).toHaveLength(31)
  })

  it('el alto del logo va fijo en el style, así img { height: auto } no lo pisa', () => {
    for (const b of generarBloquesHeader()) {
      const { alto } = dimensionesLogo(buscarMarca(b.marcaId))
      expect(b.html).toContain(`!important; height: ${alto}px; display: block;`)
    }
  })

  it('Base se muestra a 126x44: espaciadores de 13px y banda de 70px', () => {
    const html = crearBandaHeader('Base', 'CG').html
    expect(html).toContain('width="126" height="44"')
    expect(html.match(/height="13"/g)).toHaveLength(2)
  })

  it('busca marcas sin distinguir mayúsculas', () => {
    expect(buscarMarca('empresas')?.id).toBe('Empresas')
    expect(buscarMarca('inexistente')).toBeNull()
  })
})

describe('validarCatalogo — detecta datos mal cargados', () => {
  const ok = { id: 'Nueva', ancho: 300, alto: 56 }
  const norm = m => ({ nombre: m.id, alt: `ICBC ${m.id}`, escala: 2, segmentos: ['CG', 'EB', 'PAY'], ...m })

  it('acepta una marca bien cargada', () => {
    expect(validarCatalogo([norm(ok)])).toEqual([])
  })
  it('rechaza ancho o alto impares del archivo', () => {
    expect(validarCatalogo([norm({ ...ok, ancho: 301 })]).join()).toMatch(/ancho.*impar/)
    expect(validarCatalogo([norm({ ...ok, alto: 55 })]).join()).toMatch(/alto.*impar/)
  })
  it('rechaza un alto mostrado impar (los espaciadores no sumarían 70px)', () => {
    expect(validarCatalogo([norm({ ...ok, alto: 54 })]).join()).toMatch(/alto mostrado \(27px\) es impar/)
  })
  it('rechaza un logo más alto que la banda', () => {
    expect(validarCatalogo([norm({ ...ok, alto: 144 })]).join()).toMatch(/no entra en la banda/)
  })
  it('rechaza un logo más ancho que el área útil', () => {
    expect(validarCatalogo([norm({ ...ok, ancho: 1100 })]).join()).toMatch(/530px/)
  })
  it('rechaza ids repetidos o con caracteres que rompen el slug', () => {
    expect(validarCatalogo([norm(ok), norm(ok)]).join()).toMatch(/repetido/)
    expect(validarCatalogo([norm({ ...ok, id: 'Con_Guion' })]).join()).toMatch(/solo puede tener letras/)
  })
})

describe('espaciadores — la banda siempre mide 70px', () => {
  it('reparte lo que sobra entre arriba y abajo', () => {
    expect(espaciadoresBanda(28)).toEqual({ arriba: 21, abajo: 21 })
    expect(espaciadoresBanda(30)).toEqual({ arriba: 20, abajo: 20 })
    expect(espaciadoresBanda(32)).toEqual({ arriba: 19, abajo: 19 })
  })
  it('un logo más alto achica los espaciadores y sigue sumando 70', () => {
    for (const alto of [20, 28, 30, 34, 40, 50, 70]) {
      const { arriba, abajo } = espaciadoresBanda(alto)
      expect(arriba + alto + abajo).toBe(ALTO_BANDA)
    }
  })
  it('con un alto impar (no debería pasar) igual suma 70', () => {
    const { arriba, abajo } = espaciadoresBanda(33)
    expect(arriba + 33 + abajo).toBe(ALTO_BANDA)
  })
  it('todas las bandas generadas miden exactamente 70px', () => {
    for (const b of generarBloquesHeader()) {
      expect(alturasDeBanda(b.html).total, b.slug).toBe(ALTO_BANDA)
    }
  })
  it('un logo de 34px de alto genera espaciadores de 18 (la banda no crece)', () => {
    const marca = { ...buscarMarca('Mall'), alto: 68, ancho: 240 }
    const html = generarHtmlBanda(marca, SEGMENTOS[0])
    expect(alturasDeBanda(html)).toEqual({ arriba: 18, abajo: 18, logo: 34, total: 70 })
  })
})

describe('generarHtmlBanda', () => {
  it('usa el color del segmento en el estilo y en bgcolor, y ningún otro', () => {
    for (const seg of SEGMENTOS) {
      const html = generarHtmlBanda(buscarMarca('Mall'), seg)
      expect(html).toContain(`background-color: ${seg.color};`)
      expect(html).toContain(`bgcolor="${seg.color}"`)
      for (const otro of SEGMENTOS.filter(s => s.id !== seg.id)) expect(html).not.toContain(otro.color)
    }
  })

  it('arma la URL del logo según el segmento: _Blanco en CG y Pay, _Coin_Rojo en EB', () => {
    const cg = generarHtmlBanda(buscarMarca('Hipotecarios'), SEGMENTOS.find(s => s.id === 'CG'))
    const eb = generarHtmlBanda(buscarMarca('Hipotecarios'), SEGMENTOS.find(s => s.id === 'EB'))
    const pay = generarHtmlBanda(buscarMarca('Hipotecarios'), SEGMENTOS.find(s => s.id === 'PAY'))
    expect(cg).toContain(`src="${URL_BASE_LOGOS}Logo_Header_Hipotecarios_Blanco.png"`)
    expect(pay).toContain(`src="${URL_BASE_LOGOS}Logo_Header_Hipotecarios_Blanco.png"`)
    expect(eb).toContain(`src="${URL_BASE_LOGOS}Logo_Header_Hipotecarios_Blanco_Coin_Rojo.png"`)
  })

  it('pone ancho, alto, max-width y celda del logo con el tamaño mostrado', () => {
    const html = generarHtmlBanda(buscarMarca('Comex'), SEGMENTOS[0])
    expect(html).toContain('width="265" height="28"')
    expect(html).toContain('max-width: 265px !important')
    expect(html).toContain('width: 265px; height: 28px;')
    expect(html).toContain('alt="ICBC Comercio Exterior"')
  })

  it('escapa comillas en el alt', () => {
    const html = generarHtmlBanda({ ...buscarMarca('Mall'), alt: 'ICBC "Mall"' }, SEGMENTOS[0])
    expect(html).toContain('alt="ICBC &quot;Mall&quot;"')
  })

  // Referencia: la banda tal cual la armó el equipo de diseño para el
  // rediseño (ICBC Empresas sobre CG, 28px de alto, 190px de ancho).
  // Solo cambian los valores que el generador calcula (imagen, alt y
  // medidas); la ESTRUCTURA tiene que ser idéntica.
  it('respeta la estructura de la banda de referencia del rediseño', () => {
    const referencia = `<table style="max-width: 600px; background-color: #c7000b;" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#c7000b" align="center">
            <tbody>
                <tr>
                    <td colspan="3" style="height: 21px; font-size: 0px;" height="21">&nbsp;</td>
                </tr>
                <tr>
                    <td style="width: 35px; min-width: 35px; font-family: Arial; font-size: 1px;" width="35">&nbsp;</td>
                    <td style="width: 530px;" width="530" valign="middle" align="left">
                        <table width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tbody>
                                <tr>
                                    <td style="vertical-align: middle; width: 190px; height: 28px; text-align:left;" width="190" valign="middle" align="left"><img src="https://d343t93odde9ul.cloudfront.net/minisites/ICBC/logos/header/firma_icbc_empresas_blanco_2026.png" style="max-width: 190px !important; display: block; font-family: Arial,Helvetica,Open Sans,sans-serif; font-size: 15px; color: #333333;" alt="ICBC EMPRESAS" width="190" height="28" /></td>
                                    <td>&nbsp;</td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                    <td style="width: 35px; min-width: 35px; font-family: Arial; font-size: 1px;" width="35">&nbsp;</td>
                </tr>
                <tr>
                    <td colspan="3" style="height: 21px; font-size: 0px;" height="21">&nbsp;</td>
                </tr>
            </tbody>
        </table>`
    // Única diferencia intencional con la plantilla: el style de la img lleva
    // también `height` (ver generarHtmlBanda), para que el reset img { height: auto }
    // del CSS exportado no recalcule el alto con la proporción del archivo.
    const normalizar = h => h.replace(/\s+/g, ' ').replace(/ height: \d+px; display: block;/, ' display: block;').replace(/src="[^"]*"/, 'src="SRC"').replace(/alt="[^"]*"/, 'alt="ALT"')
    const generado = generarHtmlBanda({ ...buscarMarca('Empresas'), ancho: 380, alto: 56 }, SEGMENTOS[0])
    expect(normalizar(generado)).toBe(normalizar(referencia))
  })
})

describe('slugs de header', () => {
  it('slugHeader y parsearSlugHeader son inversas', () => {
    for (const b of generarBloquesHeader()) {
      expect(parsearSlugHeader(b.slug)).toEqual({ marcaId: b.marcaId, segmentoId: b.segmentoId })
      expect(slugHeader(b.marcaId, b.segmentoId)).toBe(b.slug)
    }
  })
  it('el prefijo del slug es el segmento (lo usan las pestañas y el color del borde)', () => {
    expect(crearBandaHeader('Mall', 'PAY').slug).toBe('PAY_Mall')
    expect(crearBandaHeader('Mall', 'EB').slug).toBe('EB_Mall')
  })
  it('no confunde un slug anterior con uno nuevo', () => {
    expect(parsearSlugHeader('CG_Banda_Roja_Header_Empresas')).toBeNull()
    expect(parsearSlugHeader('EB_Exclusivo')).toBeNull()
    expect(parsearSlugHeader('')).toBeNull()
  })
})

describe('colorPorPrefijoHeader (color del borde y del fondo de la pieza)', () => {
  it('sigue a los colores nuevos de cada segmento', () => {
    expect(colorPorPrefijoHeader('CG_Empresas')).toBe('#c7000b')
    expect(colorPorPrefijoHeader('EB_Mall')).toBe('#0d131a')
    expect(colorPorPrefijoHeader('PAY_Sueldos')).toBe('#635843')
  })
  it('los headers Malba anteriores usan los mismos colores nuevos por su prefijo', () => {
    expect(colorPorPrefijoHeader('CG_Banda_Roja_Header_Malba')).toBe('#c7000b')
    expect(colorPorPrefijoHeader('EB_Banda_Negra_Header_Malba')).toBe('#0d131a')
  })
  it('un slug desconocido cae al rojo (CG), sin romper', () => {
    expect(colorPorPrefijoHeader('XX_algo')).toBe('#c7000b')
    expect(colorPorPrefijoHeader(undefined)).toBe('#c7000b')
  })
})

describe('generarExport con el header generado', () => {
  const base = { imgPrincipal: { activo: false, src: '' }, imgFooter: { activo: false, src: '' }, canvas: [], legalesAdicionales: [], legalesSeparados: false, firmaInstitucional: null, indicadores: [] }

  it('escribe el marcador con el slug nuevo y la banda dentro de la celda del color del segmento', () => {
    const html = generarExport({ ...base, bandaHeader: crearBandaHeader('Empresas', 'EB') })
    expect(html).toContain('<!--HEADER:EB_Empresas-->')
    expect(html).toContain('<td width="100%" valign="top" bgcolor="#0d131a" align="center">')
    expect(html).toContain('Logo_Header_Empresas_Blanco_Coin_Rojo.png')
    expect(html).not.toContain('IconoRedes"')
  })

  it('el borde del tema ICBC sigue al color del segmento nuevo', () => {
    const html = generarExport({ ...base, bandaHeader: crearBandaHeader('Mall', 'PAY'), tema: 'icbc' })
    expect(html).toContain('border: solid 1px #635843;')
  })

  it('el tema Avisos pinta el marco con el color del segmento (sin borde)', () => {
    const html = generarExport({ ...base, bandaHeader: crearBandaHeader('Mall', 'CG'), tema: 'avisos' })
    expect(html).toContain('background-color: #c7000b;')
    expect(html).not.toContain('border: solid 1px')
  })
})
