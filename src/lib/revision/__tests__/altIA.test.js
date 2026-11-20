import { describe, it, expect, vi } from 'vitest'
import {
  ValidarAltCoincideImagen,
  combinarAltConIA,
  recolectarImagenesParaIA,
  MAX_IMAGENES_IA,
  MAX_LARGO_ALT_IA,
} from '@/lib/revision/altIA.js'
import { resumirResultados } from '@/lib/revision/ejecutarRevision.js'

// ejecutarRevision importa el conector real (altIAClient → Supabase), que
// necesita variables de entorno de Vite. Estos tests no hacen red.
vi.mock('@/lib/revision/altIAClient.js', () => ({ verificarAltsConIA: vi.fn() }))
vi.mock('@/lib/revision/ortografiaClient.js', () => ({ revisarOrtografiaConIA: vi.fn() }))

// Mismo criterio que imagenes.test.js: el validador solo usa
// querySelectorAll('img') y getAttribute, un fake mínimo alcanza.
const CDN = 'https://d343t93odde9ul.cloudfront.net/'

function img(attrs) {
  return { getAttribute: (nombre) => attrs[nombre] ?? null }
}
function docCon(...imgs) {
  return { querySelectorAll: () => imgs }
}
const conAlt = (archivo, alt) => img({ src: `${CDN}${archivo}`, alt })
const resp = (src, alt, estado, extra = {}) => ({ src, alt, estado, motivo: '', texto_detectado: '', ...extra })

describe('recolectarImagenesParaIA', () => {
  it('toma solo imágenes del CDN aprobado con alt con contenido', () => {
    const doc = docCon(
      conAlt('header.jpg', 'Cuidá tu clave'),
      img({ src: 'https://otro-sitio.com/x.jpg', alt: 'Algo' }),
      img({ src: `${CDN}sin-alt.jpg` }),
      conAlt('alt-vacio.jpg', '   '),
    )
    const { items } = recolectarImagenesParaIA(doc)
    expect(items).toEqual([{ src: `${CDN}header.jpg`, alt: 'Cuidá tu clave' }])
  })

  it('saltea separadores estructurales', () => {
    const doc = docCon(conAlt('Img_Separador265x100.png', 'separador'), conAlt('banner.jpg', 'Banner'))
    expect(recolectarImagenesParaIA(doc).items.map(i => i.src)).toEqual([`${CDN}banner.jpg`])
  })

  it('no repite el mismo par (src, alt) pero sí el mismo src con otro alt', () => {
    const doc = docCon(conAlt('logo.png', 'ICBC'), conAlt('logo.png', 'ICBC'), conAlt('logo.png', 'Logo ICBC'))
    expect(recolectarImagenesParaIA(doc).items).toHaveLength(2)
  })

  it('respeta el máximo de imágenes y deja el resto como sin verificar', () => {
    const imgs = Array.from({ length: MAX_IMAGENES_IA + 3 }, (_, i) => conAlt(`i${i}.jpg`, `Alt ${i}`))
    const { items, sinVerificar } = recolectarImagenesParaIA(docCon(...imgs))
    expect(items).toHaveLength(MAX_IMAGENES_IA)
    expect(sinVerificar).toHaveLength(3)
    expect(sinVerificar.every(s => s.razon === 'cupo')).toBe(true)
  })

  it('un alt demasiado largo no se envía', () => {
    const doc = docCon(conAlt('legal.jpg', 'a'.repeat(MAX_LARGO_ALT_IA + 1)))
    const { items, sinVerificar } = recolectarImagenesParaIA(doc)
    expect(items).toHaveLength(0)
    expect(sinVerificar[0].razon).toBe('largo')
  })
})

describe('ValidarAltCoincideImagen', () => {
  it('sin imágenes para verificar devuelve null y no llama a la IA', async () => {
    const verificar = vi.fn()
    expect(await ValidarAltCoincideImagen(docCon(img({ src: `${CDN}a.jpg` })), verificar)).toBeNull()
    expect(verificar).not.toHaveBeenCalled()
  })

  it('todo coincide: ok, sin errores', async () => {
    const doc = docCon(conAlt('a.jpg', 'Hola'))
    const r = await ValidarAltCoincideImagen(doc, async items => items.map(i => resp(i.src, i.alt, 'coincide')))
    expect(r.ok).toBe(true)
    expect(r.checks).toEqual([])
    expect(r.omitido).toBeUndefined()
  })

  it('un no_coincide es ERROR y nombra la imagen, el alt y el motivo', async () => {
    const doc = docCon(conAlt('header.jpg', 'Seguridad informática'))
    const r = await ValidarAltCoincideImagen(doc, async items =>
      items.map(i => resp(i.src, i.alt, 'no_coincide', { motivo: 'La imagen habla de una promo bancaria' })))
    expect(r.ok).toBe(false)
    expect(r.advertencia).toBeUndefined()
    expect(r.checks).toHaveLength(1)
    expect(r.checks[0].detalle).toContain('header.jpg')
    expect(r.checks[0].detalle).toContain('Seguridad informática')
    expect(r.checks[0].detalle).toContain('promo bancaria')
  })

  it('un dudoso NO es error: queda como detalle menor y la prueba sigue ok', async () => {
    const doc = docCon(conAlt('a.jpg', 'Hola'))
    const r = await ValidarAltCoincideImagen(doc, async items => items.map(i => resp(i.src, i.alt, 'dudoso')))
    expect(r.ok).toBe(true)
    expect(r.checks).toEqual([])
    expect(r.advertencias).toHaveLength(1)
  })

  it('mezcla: errores + no verificables → falla y agrega un único aviso resumen', async () => {
    const doc = docCon(conAlt('a.jpg', 'A'), conAlt('b.jpg', 'B'), conAlt('c.jpg', 'C'))
    const r = await ValidarAltCoincideImagen(doc, async ([a, b, c]) => [
      resp(a.src, a.alt, 'no_coincide'),
      resp(b.src, b.alt, 'no_verificable', { razon: 'tope_diario' }),
      resp(c.src, c.alt, 'no_verificable', { razon: 'tope_diario' }),
    ])
    expect(r.ok).toBe(false)
    expect(r.advertencias).toHaveLength(1)
    expect(r.advertencias[0].detalle).toContain('2 sin verificar')
  })

  it('si la IA falla (lanza), el bloque queda omitido y no es error', async () => {
    const doc = docCon(conAlt('a.jpg', 'Hola'))
    const r = await ValidarAltCoincideImagen(doc, async () => { throw new Error('HTTP 500') })
    expect(r.omitido).toBe(true)
    expect(r.checks).toEqual([])
  })

  it('si ninguna imagen pudo verificarse (sin crédito, tope), queda omitido con el motivo', async () => {
    const doc = docCon(conAlt('a.jpg', 'Hola'))
    const r = await ValidarAltCoincideImagen(doc, async items =>
      items.map(i => resp(i.src, i.alt, 'no_verificable', { razon: 'tope_diario' })))
    expect(r.omitido).toBe(true)
    expect(r.detalle).toContain('tope diario')
  })

  it('una respuesta que no es un array se trata como IA no disponible', async () => {
    const doc = docCon(conAlt('a.jpg', 'Hola'))
    const r = await ValidarAltCoincideImagen(doc, async () => ({ error: 'x' }))
    expect(r.omitido).toBe(true)
  })
})

describe('motivos de no verificable', () => {
  it.each([
    ['sin_credito', 'no tiene crédito'],
    ['imagen_no_legible', 'no pudo leer la imagen'],
    ['respuesta_invalida', 'no se pudo interpretar'],
    ['sin_configurar', 'no está configurada'],
  ])('razón %s se explica con su propio texto', async (razon, texto) => {
    const doc = docCon(conAlt('a.jpg', 'Hola'))
    const r = await ValidarAltCoincideImagen(doc, async items =>
      items.map(i => resp(i.src, i.alt, 'no_verificable', { razon })))
    expect(r.omitido).toBe(true)
    expect(r.detalle).toContain(texto)
  })

  it('con una imagen verificada y otra no, el aviso resumen dice por qué', async () => {
    const doc = docCon(conAlt('a.jpg', 'A'), conAlt('b.jpg', 'B'))
    const r = await ValidarAltCoincideImagen(doc, async ([a, b]) => [
      resp(a.src, a.alt, 'coincide'),
      resp(b.src, b.alt, 'no_verificable', { razon: 'imagen_no_legible' }),
    ])
    expect(r.omitido).toBeUndefined()
    expect(r.ok).toBe(true)
    expect(r.advertencias[0].detalle).toContain('no pudo leer la imagen')
  })
})

// "Alt de imágenes" sigue siendo UNA prueba: la IA se anida adentro y el
// total del resumen no cambia (ver combinarAltConIA).
describe('combinarAltConIA y el resumen', () => {
  const altOk = { ok: true, tipo: 'Alt de imágenes', detalle: 'Todas las imágenes (3) tienen alt correcto', checks: [] }
  const altMal = { ok: false, tipo: 'Alt de imágenes', detalle: '1 imagen con problemas de alt', checks: [{ ok: false, detalle: 'Sin atributo alt: x.jpg' }] }
  const iaOk = { ok: true, tipo: 'Alt coincide con la imagen', detalle: 'Los alts verificados (3) coinciden con sus imágenes', checks: [], advertencias: [] }
  const iaMal = { ok: false, tipo: 'Alt coincide con la imagen', detalle: '1 imagen con un alt que no coincide con lo que muestra', checks: [{ ok: false, detalle: 'h.jpg: no coincide' }], advertencias: [] }
  const iaOmitida = { ok: false, advertencia: true, omitido: true, tipo: 'Alt coincide con la imagen', detalle: 'No se pudo verificar: la IA no respondió', checks: [], advertencias: [] }

  const base = {
    pesoHTML: { ok: true }, pesoImagenes: { ok: true }, estructuraHTML: { ok: true },
    dominioImagenes: { ok: true }, clasesCSS: { ok: true }, legal: { ok: true },
    links: { ok: true }, dimensiones: { ok: true }, resumenTemplates: [],
  }

  it('sin resultado de IA devuelve el bloque original tal cual', () => {
    expect(combinarAltConIA(altOk, null)).toBe(altOk)
  })

  it('alt ok + IA ok: ok, y el detalle menciona ambas partes', () => {
    const r = combinarAltConIA(altOk, iaOk)
    expect(r.ok).toBe(true)
    expect(r.detalle).toContain('tienen alt correcto')
    expect(r.detalle).toContain('coinciden con sus imágenes')
    expect(r.ia).toBe(iaOk)
  })

  it('alt ok + IA con no coincide: la prueba falla y el detalle es el de la IA', () => {
    const r = combinarAltConIA(altOk, iaMal)
    expect(r.ok).toBe(false)
    expect(r.detalle).toBe(iaMal.detalle)
  })

  it('alt mal + IA mal: falla y el detalle junta los dos', () => {
    const r = combinarAltConIA(altMal, iaMal)
    expect(r.ok).toBe(false)
    expect(r.detalle).toContain('problemas de alt')
    expect(r.detalle).toContain('no coincide')
  })

  it('IA omitida: el resultado es el de siempre y el aviso queda adentro', () => {
    const bien = combinarAltConIA(altOk, iaOmitida)
    expect(bien.ok).toBe(true)
    expect(bien.detalle).toBe(altOk.detalle)
    expect(bien.ia.omitido).toBe(true)
    expect(combinarAltConIA(altMal, iaOmitida).ok).toBe(false)
  })

  it('el resumen guardado sigue siendo de 10 pruebas con la IA anidada', () => {
    expect(resumirResultados({ ...base, altImagenes: combinarAltConIA(altOk, iaOk) })).toEqual({ ok: 10, total: 10, severidad: 'ok' })
    expect(resumirResultados({ ...base, altImagenes: combinarAltConIA(altOk, iaOmitida) })).toEqual({ ok: 10, total: 10, severidad: 'ok' })
  })

  it('un no coincide de la IA baja el resumen a error en esa misma prueba', () => {
    expect(resumirResultados({ ...base, altImagenes: combinarAltConIA(altOk, iaMal) })).toEqual({ ok: 9, total: 10, severidad: 'error' })
  })
})
