import { describe, it, expect, vi } from 'vitest'
import { el, docDe } from './fakeDom.js'
import {
  extraerTextosPieza,
  prepararParaIA,
  MAX_CARACTERES_ITEM,
  MAX_CARACTERES_IA,
  MAX_ITEMS_IA,
} from '@/lib/revision/textoPieza.js'
import { ValidarOrtografiaYRedaccion } from '@/lib/revision/ortografia.js'
import { TERMINOS_PERMITIDOS } from '@/lib/revision/terminosPermitidos.js'

describe('extraerTextosPieza', () => {
  it('toma texto visible, alt y title, y saltea script/style/head', () => {
    const doc = docDe(
      el('STYLE', {}, '.a{color:red}'),
      el('SCRIPT', {}, 'var x = "hola"'),
      el('TABLE', {}, el('TR', {}, el('TD', {}, 'Hola ', el('B', {}, 'mundo')))),
      el('IMG', { src: 'a.jpg', alt: 'Banner de préstamos' }),
      el('A', { href: 'x', title: 'Ver condiciones' }, 'Ver más'),
    )
    const items = extraerTextosPieza(doc)
    expect(items.filter(i => i.lugar === 'texto').map(i => i.contenido)).toEqual(['Hola mundo', 'Ver más'])
    expect(items.find(i => i.lugar === 'alt').contenido).toBe('Banner de préstamos')
    expect(items.find(i => i.lugar === 'title').contenido).toBe('Ver condiciones')
    expect(items.some(i => i.contenido.includes('color:red') || i.contenido.includes('var x'))).toBe(false)
  })

  it('un <br> separa palabras y los bloques distintos no se pegan', () => {
    const doc = docDe(el('TD', {}, 'uno', el('BR'), 'dos'), el('TD', {}, 'tres'))
    expect(extraerTextosPieza(doc).map(i => i.contenido)).toEqual(['uno dos', 'tres'])
  })

  it('ignora relleno invisible (nbsp, zero-width) y textos sin letras', () => {
    const doc = docDe(el('TD', {}, ' ‌ ‌'), el('TD', {}, '12345 $'), el('TD', {}, 'Texto real'))
    expect(extraerTextosPieza(doc).map(i => i.contenido)).toEqual(['Texto real'])
  })

  it('no repite textos iguales y junta los enlaces del bloque', () => {
    const doc = docDe(el('TD', {}, 'Hola ', el('A', { href: 'x' }, 'acá')), el('TD', {}, 'Hola ', el('A', { href: 'x' }, 'acá')))
    const items = extraerTextosPieza(doc)
    expect(items).toHaveLength(1)
    expect(items[0].enlaces).toEqual(['acá'])
  })

  it('devuelve [] sin body', () => {
    expect(extraerTextosPieza({})).toEqual([])
  })
})

describe('prepararParaIA', () => {
  it('parte los textos largos en trozos sin cortar palabras', () => {
    const largo = Array(600).fill('palabra').join(' ')
    const { textos } = prepararParaIA([{ lugar: 'texto', contenido: largo, enlaces: [] }])
    expect(textos.length).toBeGreaterThan(1)
    for (const t of textos) {
      expect(t.contenido.length).toBeLessThanOrEqual(MAX_CARACTERES_ITEM)
      expect(t.contenido.split(' ').every(p => p === 'palabra')).toBe(true)
    }
  })

  it('pone alt y title antes que el texto del cuerpo', () => {
    const { textos } = prepararParaIA([
      { lugar: 'texto', contenido: 'cuerpo', enlaces: [] },
      { lugar: 'alt', contenido: 'un alt', enlaces: [] },
    ])
    expect(textos.map(t => t.lugar)).toEqual(['alt', 'texto'])
  })

  it('respeta el tope de caracteres y avisa que truncó', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ lugar: 'texto', contenido: `${'a'.repeat(1500)} ${i}`, enlaces: [] }))
    const { textos, truncado } = prepararParaIA(items)
    expect(truncado).toBe(true)
    expect(textos.reduce((n, t) => n + t.contenido.length, 0)).toBeLessThanOrEqual(MAX_CARACTERES_IA)
  })

  it('respeta el tope de items', () => {
    const items = Array.from({ length: MAX_ITEMS_IA + 5 }, (_, i) => ({ lugar: 'texto', contenido: `texto ${i}`, enlaces: [] }))
    const { textos, truncado } = prepararParaIA(items)
    expect(textos).toHaveLength(MAX_ITEMS_IA)
    expect(truncado).toBe(true)
  })
})

const doc = () => docDe(
  el('P', {}, 'Solicitá tu prestamo hoy'),
  el('IMG', { src: 'a.jpg', alt: 'Banner de prestamos' }),
)
const ok = (hallazgos = []) => ({ estado: 'ok', hallazgos })
const h = (extra = {}) => ({ lugar: 'texto', fragmento: 'prestamo', sugerencia: 'préstamo', tipo: 'tilde', motivo: 'falta la tilde', ...extra })

describe('ValidarOrtografiaYRedaccion', () => {
  it('sin texto devuelve null y no llama a la IA', async () => {
    const revisar = vi.fn()
    expect(await ValidarOrtografiaYRedaccion(docDe(el('IMG', { src: 'a.jpg' })), revisar)).toBeNull()
    expect(revisar).not.toHaveBeenCalled()
  })

  it('envía textos y el glosario a la IA', async () => {
    const revisar = vi.fn().mockResolvedValue(ok())
    await ValidarOrtografiaYRedaccion(doc(), revisar)
    const arg = revisar.mock.calls[0][0]
    expect(arg.glosario).toBe(TERMINOS_PERMITIDOS)
    expect(arg.textos).toEqual(expect.arrayContaining([
      { lugar: 'texto', contenido: 'Solicitá tu prestamo hoy' },
      { lugar: 'alt', contenido: 'Banner de prestamos' },
    ]))
  })

  it('sin hallazgos queda ok (verde)', async () => {
    const r = await ValidarOrtografiaYRedaccion(doc(), async () => ok())
    expect(r.ok).toBe(true)
    expect(r.advertencia).toBe(false)
    expect(r.detalle).toMatch(/No se detectaron/)
  })

  it('con hallazgos es advertencia (amarillo), nunca error', async () => {
    const r = await ValidarOrtografiaYRedaccion(doc(), async () => ok([h(), h({ lugar: 'alt', fragmento: 'prestamos', sugerencia: 'préstamos' })]))
    expect(r.ok).toBe(false)
    expect(r.advertencia).toBe(true)
    expect(r.hallazgos).toHaveLength(2)
    expect(r.hallazgos[0].detalle).toBe('En el texto: "prestamo" → "préstamo" (falta la tilde)')
    expect(r.hallazgos[1].detalle).toContain('En un alt')
    expect(r.detalle).toBe('2 posibles errores de ortografía o redacción')
  })

  it('descarta hallazgos sin corrección (la IA dijo que estaba bien)', async () => {
    const r = await ValidarOrtografiaYRedaccion(doc(), async () => ok([h({ sugerencia: '', motivo: 'Revisado sin hallazgos.' }), h()]))
    expect(r.hallazgos).toHaveLength(1)
    const sin = await ValidarOrtografiaYRedaccion(doc(), async () => ok([h({ sugerencia: '' })]))
    expect(sin.ok).toBe(true)
  })

  it('descarta hallazgos cuyo motivo admite que no corresponde reportar', async () => {
    const motivo = 'Revisar signos de puntuación; el texto no está en forma interrogativa, así que no corresponde reportar.'
    const r = await ValidarOrtografiaYRedaccion(doc(), async () => ok([h({ fragmento: 'Debés generar tu ID FAL', sugerencia: '¿Debés generar...?', motivo }), h()]))
    expect(r.hallazgos).toHaveLength(1)
  })

  it('descarta "Sin error" y "Revisión innecesaria", pero conserva "tilde innecesaria"', async () => {
    const r = await ValidarOrtografiaYRedaccion(doc(), async () => ok([
      h({ fragmento: 'ENTRA EN LA APP', sugerencia: 'Sin error: revisar si se requiere otra forma', motivo: 'Revisión innecesaria' }),
      h({ fragmento: 'sólo', sugerencia: 'solo', motivo: 'tilde innecesaria' }),
    ]))
    expect(r.hallazgos).toHaveLength(1)
    expect(r.hallazgos[0].detalle).toContain('sólo')
  })

  it('descarta hallazgos con campo nota o con motivo "no se reporta"', async () => {
    const r = await ValidarOrtografiaYRedaccion(doc(), async () => ok([
      { ...h({ fragmento: 'a', sugerencia: 'b' }), nota: 'descartar' },
      h({ fragmento: 'c', sugerencia: 'd', motivo: 'no se reporta como error' }),
      h(),
    ]))
    expect(r.hallazgos).toHaveLength(1)
  })

  it('cada hallazgo trae un ref para ubicarlo en la pieza', async () => {
    const r = await ValidarOrtografiaYRedaccion(doc(), async () => ok([
      h({ lugar: 'alt', fragmento: 'logo banco', sugerencia: 'logotipo del banco', motivo: 'x' }),
      h({ fragmento: 'Bank', sugerencia: 'Banco', motivo: 'x' }),
    ]))
    expect(r.hallazgos[0].ref).toEqual({ tipo: 'atributo', atributo: 'alt', fragmento: 'logo banco' })
    expect(r.hallazgos[1].ref).toEqual({ tipo: 'texto', fragmento: 'Bank' })
  })

  it('si la IA falla, avisa y no inventa errores (sigue sin ser error)', async () => {
    for (const revisar of [
      async () => { throw new Error('x') },
      async () => null,
      async () => ({ estado: 'no_verificable', razon: 'sin_credito', hallazgos: [] }),
    ]) {
      const r = await ValidarOrtografiaYRedaccion(doc(), revisar)
      expect(r.advertencia).toBe(true)
      expect(r.hallazgos).toEqual([])
      expect(r.detalle).toMatch(/No se pudo revisar la ortografía/)
    }
    const r = await ValidarOrtografiaYRedaccion(doc(), async () => ({ estado: 'no_verificable', razon: 'sin_credito' }))
    expect(r.detalle).toContain('no tiene crédito')
  })

  it('los términos obsoletos aparecen aunque la IA falle', async () => {
    const d = docDe(el('P', {}, 'Ingresá a ICBC Access Banking'))
    const r = await ValidarOrtografiaYRedaccion(d, async () => { throw new Error('x') })
    expect(r.obsoletos).toHaveLength(1)
    expect(r.detalle).toContain('1 término desactualizado')
    expect(r.detalle).toContain('No se pudo revisar')
    expect(r.advertencia).toBe(true)
  })

  it('obsoletos y ortografía se cuentan juntos en el detalle', async () => {
    const d = docDe(el('P', {}, 'Access Banking y prestamo'))
    const r = await ValidarOrtografiaYRedaccion(d, async () => ok([h()]))
    expect(r.detalle).toBe('1 posible error de ortografía o redacción · 1 término desactualizado')
  })

  it('avisa cuando solo se revisó una parte', async () => {
    const d = docDe(...Array.from({ length: 20 }, (_, i) => el('P', {}, `${'a'.repeat(1500)} ${i}`)))
    const r = await ValidarOrtografiaYRedaccion(d, async () => ok())
    expect(r.advertencia).toBe(true)
    expect(r.detalle).toMatch(/solo una parte/)
  })

  it('el glosario no contiene el término obsoleto', () => {
    expect(TERMINOS_PERMITIDOS.some(t => /access/i.test(t))).toBe(false)
    for (const sigla of ['CBU', 'CVU', 'BCRA', 'QR', 'TEM', 'CFTEA', 'DNI', 'CUIL', 'IVA']) {
      expect(TERMINOS_PERMITIDOS).toContain(sigla)
    }
  })
})

describe('extraerTextosPieza — título en negrita + <br> + bajada', () => {
  const textos = (doc) => extraerTextosPieza(doc).filter(i => i.lugar === 'texto').map(i => i.contenido)
  const celda = (...hijos) => el('TABLE', {}, el('TBODY', {}, el('TR', {}, el('TD', { style: 'font-weight: normal;' }, ...hijos))))

  it('separa el título en <strong> de la bajada (caso real de ICBC)', () => {
    const doc = docDe(celda(el('STRONG', {}, 'Asistencia para comercios y edilicia'), el('BR'), ' Cobertura completa para mantenimiento y emergencias 24/7.'))
    expect(textos(doc)).toEqual(['Asistencia para comercios y edilicia', 'Cobertura completa para mantenimiento y emergencias 24/7.'])
  })

  it('también con <b> y con font-weight en el estilo', () => {
    expect(textos(docDe(celda(el('B', {}, 'Título'), el('BR'), 'Bajada')))).toEqual(['Título', 'Bajada'])
    expect(textos(docDe(celda(el('SPAN', { style: 'font-weight:700' }, 'Título'), el('BR'), 'Bajada')))).toEqual(['Título', 'Bajada'])
  })

  it('no corta un salto de renglón en una frase normal', () => {
    expect(textos(docDe(celda('Primera parte de la frase', el('BR'), 'segunda parte.')))).toEqual(['Primera parte de la frase segunda parte.'])
  })

  it('no corta una negrita en medio de una frase', () => {
    expect(textos(docDe(celda('Pagá ', el('STRONG', {}, 'hoy'), ' mismo', el('BR'), 'y listo.')))).toEqual(['Pagá hoy mismo y listo.'])
  })

  it('no corta si la negrita sigue con texto normal antes del <br>', () => {
    expect(textos(docDe(celda(el('STRONG', {}, 'Ojo:'), ' esto sigue', el('BR'), 'y esto también.')))).toEqual(['Ojo: esto sigue y esto también.'])
  })
})

describe('extraerTextosPieza — superíndices', () => {
  const textos = (doc) => extraerTextosPieza(doc).filter(i => i.lugar === 'texto').map(i => i.contenido)
  const td = (...h) => el('TABLE', {}, el('TBODY', {}, el('TR', {}, el('TD', {}, ...h))))

  it('ignora las marcas de nota al pie: (1), (2), *', () => {
    const doc = docDe(td('Te invitamos a una charla exclusiva', el('SUP', {}, '(1)'), ' sobre el Fondo (FAL', el('SUP', {}, '(2)'), '), con novedades.', el('SUP', {}, '*')))
    expect(textos(doc)).toEqual(['Te invitamos a una charla exclusiva sobre el Fondo (FAL), con novedades.'])
  })

  it('conserva los superíndices con letras (1er, N°)', () => {
    expect(textos(docDe(td('El 1', el('SUP', {}, 'er'), ' premio')))).toEqual(['El 1er premio'])
  })
})

describe('glosario — slogan del banco', () => {
  it('"El Futuro nos Inspira" está permitido, con y sin punto', async () => {
    const { TERMINOS_PERMITIDOS } = await import('@/lib/revision/terminosPermitidos.js')
    expect(TERMINOS_PERMITIDOS).toContain('El Futuro nos Inspira')
    expect(TERMINOS_PERMITIDOS).toContain('El Futuro nos Inspira.')
    expect(TERMINOS_PERMITIDOS.length).toBeLessThanOrEqual(200)
    expect(TERMINOS_PERMITIDOS.every(t => t.length <= 60)).toBe(true)
  })
})

describe('extraerTextosPieza — marcas de nota en alt y title', () => {
  const img = (alt, title) => el('IMG', { alt, title })
  const items = (doc) => extraerTextosPieza(doc).map(i => [i.lugar, i.contenido])

  it('saca (1), (2) y (*) de los alt y title sin tocar el resto', () => {
    const doc = docDe(img('CYBERMONDAY | Hasta 18 CUOTAS Con tus tarjetas ICBC.(1) | pagando con MODO.(2)', 'Hasta 3 cuotas (*) sin interés'))
    expect(items(doc)).toEqual([
      ['title', 'Hasta 3 cuotas sin interés'],
      ['alt', 'CYBERMONDAY | Hasta 18 CUOTAS Con tus tarjetas ICBC. | pagando con MODO.'],
    ])
  })

  it('conserva paréntesis con texto, como (FAL)', () => {
    expect(items(docDe(img('Fondo de Asistencia Laboral (FAL)')))).toEqual([['alt', 'Fondo de Asistencia Laboral (FAL)']])
  })
})
