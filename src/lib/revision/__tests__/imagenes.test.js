import { describe, it, expect } from 'vitest'
import { ValidarDimensionesImagenes } from '@/lib/revision/imagenes.js'

// El validador solo usa doc.querySelectorAll('img') y getAttribute de
// cada nodo — con un fake mínimo alcanza y el test no necesita DOM
// (vitest corre en environment node, sin DOMParser).
function img(attrs) {
  return { getAttribute: (nombre) => attrs[nombre] ?? null }
}
function docCon(...imgs) {
  return { querySelectorAll: () => imgs }
}

const IMG_PNG_COMO_JPG = img({
  src: 'https://cdn.test/cg_vencimiento_190705.jpg',
  width: '600',
  height: '425',
})

describe('ValidarDimensionesImagenes — formato real vs extensión', () => {
  it('PNG renombrado a .jpg con proporciones correctas: advertencia, sin error (caso real del fix)', async () => {
    // 1200x850 reales, 600x425 declarados — misma proporción, el único
    // hallazgo debe ser el aviso de extensión. Antes del fix del proxy
    // este caso reportaba "imagen real: 14521x41510" (bytes PNG
    // parseados como JPEG por confiar en el content-type).
    const cache = {
      'https://cdn.test/cg_vencimiento_190705.jpg': { width: 1200, height: 850, formato: 'png', peso: 100 },
    }
    const r = await ValidarDimensionesImagenes(docCon(IMG_PNG_COMO_JPG), cache)
    expect(r.ok).toBe(true)
    expect(r.checks).toEqual([])
    expect(r.advertencias).toHaveLength(1)
    expect(r.advertencias[0].detalle).toContain('.jpg')
    expect(r.advertencias[0].detalle).toContain('PNG')
  })

  it('la advertencia de extensión no tapa un error real de proporción', async () => {
    const cache = {
      'https://cdn.test/banner.jpg': { width: 1200, height: 300, formato: 'png', peso: 100 },
    }
    const nodo = img({ src: 'https://cdn.test/banner.jpg', width: '600', height: '425' })
    const r = await ValidarDimensionesImagenes(docCon(nodo), cache)
    expect(r.ok).toBe(false)
    expect(r.checks[0].detalle).toContain('Proporción incorrecta')
    expect(r.advertencias).toHaveLength(1)
  })

  it('extensión y formato coinciden: sin advertencia', async () => {
    const cache = {
      'https://cdn.test/banner.png': { width: 1200, height: 850, formato: 'png', peso: 100 },
    }
    const nodo = img({ src: 'https://cdn.test/banner.png', width: '600', height: '425' })
    const r = await ValidarDimensionesImagenes(docCon(nodo), cache)
    expect(r.ok).toBe(true)
    expect(r.advertencias).toEqual([])
  })

  it('.jpeg y .jpg mapean al mismo formato jpeg', async () => {
    const cache = {
      'https://cdn.test/foto.jpeg': { width: 800, height: 600, formato: 'jpeg', peso: 100 },
    }
    const nodo = img({ src: 'https://cdn.test/foto.jpeg', width: '400', height: '300' })
    const r = await ValidarDimensionesImagenes(docCon(nodo), cache)
    expect(r.advertencias).toEqual([])
  })

  it('la extensión se lee ignorando el querystring', async () => {
    const cache = {
      'https://cdn.test/banner.jpg?v=3': { width: 1200, height: 850, formato: 'png', peso: 100 },
    }
    const nodo = img({ src: 'https://cdn.test/banner.jpg?v=3', width: '600', height: '425' })
    const r = await ValidarDimensionesImagenes(docCon(nodo), cache)
    expect(r.advertencias).toHaveLength(1)
    expect(r.advertencias[0].detalle).toContain('.jpg')
  })

  it('el mismo src repetido en varios <img> avisa una sola vez', async () => {
    const cache = {
      'https://cdn.test/cg_vencimiento_190705.jpg': { width: 1200, height: 850, formato: 'png', peso: 100 },
    }
    const r = await ValidarDimensionesImagenes(docCon(IMG_PNG_COMO_JPG, IMG_PNG_COMO_JPG), cache)
    expect(r.advertencias).toHaveLength(1)
  })

  it('cache sin campo formato (proxy anterior aún deployado): ni advertencia ni crash', async () => {
    // Compatibilidad hacia atrás: el front puede correr contra un
    // proxy que todavía no devuelve `formato`.
    const cache = {
      'https://cdn.test/cg_vencimiento_190705.jpg': { width: 1200, height: 850, peso: 100 },
    }
    const r = await ValidarDimensionesImagenes(docCon(IMG_PNG_COMO_JPG), cache)
    expect(r.ok).toBe(true)
    expect(r.advertencias).toEqual([])
  })

  it('extensión desconocida (webp, svg): sin advertencia aunque haya formato', async () => {
    const cache = {
      'https://cdn.test/icono.webp': { width: 64, height: 64, formato: null, peso: 100 },
    }
    const nodo = img({ src: 'https://cdn.test/icono.webp', width: '32', height: '32' })
    const r = await ValidarDimensionesImagenes(docCon(nodo), cache)
    expect(r.advertencias).toEqual([])
  })
})

describe('ValidarDimensionesImagenes — medidas reales impares', () => {
  const U = 'https://cdn.test/'
  const cacheDe = (nombre, width, height) => ({ [`${U}${nombre}`]: { width, height, formato: 'png', peso: 100 } })
  const conMedidas = (nombre, w, h) => img({ src: `${U}${nombre}`, width: String(w), height: String(h) })

  it('avisa cuando el ancho real es impar', async () => {
    const r = await ValidarDimensionesImagenes(docCon(conMedidas('a.png', 300, 100)), cacheDe('a.png', 601, 200))
    expect(r.ok).toBe(true)
    expect(r.advertencias).toHaveLength(1)
    expect(r.advertencias[0].detalle).toBe('a.png: mide 601x200, el ancho es impar (conviene par)')
  })

  it('avisa cuando el alto real es impar y cuando son los dos', async () => {
    const alto = await ValidarDimensionesImagenes(docCon(conMedidas('b.png', 300, 100)), cacheDe('b.png', 600, 201))
    expect(alto.advertencias[0].detalle).toContain('el alto es impar')
    const ambos = await ValidarDimensionesImagenes(docCon(conMedidas('c.png', 300, 100)), cacheDe('c.png', 601, 201))
    expect(ambos.advertencias[0].detalle).toContain('el ancho y el alto son impares')
  })

  it('no avisa con medidas reales pares, aunque la declarada sea impar (1200x850 declarado 600x425)', async () => {
    const r = await ValidarDimensionesImagenes(docCon(conMedidas('d.png', 600, 425)), cacheDe('d.png', 1200, 850))
    expect(r.advertencias).toEqual([])
    expect(r.detalle).toContain('proporciones correctas')
  })

  it('avisa también si no tiene width/height declarados', async () => {
    const r = await ValidarDimensionesImagenes(docCon(img({ src: `${U}e.png` })), cacheDe('e.png', 301, 100))
    expect(r.advertencias).toHaveLength(1)
  })

  it('no avisa por separadores ni líneas punteadas', async () => {
    const doc = docCon(conMedidas('Img_Separador265x100.png', 265, 100), conMedidas('MediaLineaPunteada.png', 265, 100))
    const cache = { ...cacheDe('Img_Separador265x100.png', 265, 101), ...cacheDe('MediaLineaPunteada.png', 265, 101) }
    const r = await ValidarDimensionesImagenes(doc, cache)
    expect(r.advertencias).toEqual([])
  })

  it('una imagen repetida avisa una sola vez', async () => {
    const r = await ValidarDimensionesImagenes(docCon(conMedidas('f.png', 300, 100), conMedidas('f.png', 300, 100)), cacheDe('f.png', 601, 200))
    expect(r.advertencias).toHaveLength(1)
  })

  it('sin datos reales o con error de medición no avisa', async () => {
    const sin = await ValidarDimensionesImagenes(docCon(conMedidas('g.png', 300, 100)), {})
    expect(sin.advertencias).toEqual([])
    const conError = await ValidarDimensionesImagenes(docCon(conMedidas('h.png', 300, 100)), { [`${U}h.png`]: { error: true } })
    expect(conError.advertencias).toEqual([])
  })

  it('no cambia si la prueba pasa; el error de proporción sigue siendo error y el texto cuenta los detalles menores', async () => {
    const r = await ValidarDimensionesImagenes(docCon(conMedidas('i.png', 600, 300)), cacheDe('i.png', 1201, 400))
    expect(r.ok).toBe(false)
    expect(r.checks).toHaveLength(1)
    expect(r.advertencias).toHaveLength(1)
    expect(r.detalle).toBe('1 problema encontrado (+1 detalle menor)')
  })
})

describe('ValidarDimensionesImagenes — alto/ancho leídos del style', () => {
  const U = 'https://cdn.test/a.png'
  const conStyle = (style, extra = {}) => img({ src: U, width: '80', height: '80', style, ...extra })

  it('line-height no se confunde con height (caso contacto-100x100.png)', async () => {
    const style = 'border: 0px; height: auto; line-height: 15px; outline: none; display: block; font-size: 15px;'
    const r = await ValidarDimensionesImagenes(docCon(conStyle(style)), {})
    expect(r.ok).toBe(true)
    expect(r.checks).toEqual([])
  })

  it('max-height / min-height / max-width / min-width tampoco', async () => {
    const style = 'max-height: 15px; min-height: 20px; max-width: 5px; min-width: 7px;'
    const r = await ValidarDimensionesImagenes(docCon(conStyle(style)), {})
    expect(r.ok).toBe(true)
  })

  it('un height real en el style sigue comparándose (primero, después de ; y con espacios)', async () => {
    for (const style of ['height: 40px;', 'display:block;height:40px', 'display: block; height : 40px !important;']) {
      const r = await ValidarDimensionesImagenes(docCon(conStyle(style)), {})
      expect(r.ok).toBe(false)
      expect(r.checks[0].detalle).toContain('Alto inconsistente — atributo: 80px, style: 40px')
    }
  })

  it('un width real en el style sigue comparándose', async () => {
    const r = await ValidarDimensionesImagenes(docCon(conStyle('width: 60px; max-width: 5px;')), {})
    expect(r.checks[0].detalle).toContain('Ancho inconsistente — atributo: 80px, style: 60px')
  })
})

describe('ValidarDimensionesImagenes — URL con doble barra', () => {
  const conUrl = (src) => img({ src, width: '100', height: '100' })

  it('avisa como detalle menor y trae ref a la imagen', async () => {
    const src = 'https://d343t93odde9ul.cloudfront.net//minisites/ICBC/botones-2026/ICBC_BaseBotones2026-VERBENEFICIOS-v2.png'
    const r = await ValidarDimensionesImagenes(docCon(conUrl(src)), {})
    expect(r.ok).toBe(true)
    expect(r.advertencias).toHaveLength(1)
    expect(r.advertencias[0].detalle).toContain('ICBC_BaseBotones2026-VERBENEFICIOS-v2.png: la URL tiene una doble barra (//)')
    expect(r.advertencias[0].ref).toEqual({ tipo: 'img', src })
  })

  it('también en el medio de la ruta', async () => {
    const r = await ValidarDimensionesImagenes(docCon(conUrl('https://cdn.test/minisites//ICBC/a.png')), {})
    expect(r.advertencias).toHaveLength(1)
  })

  it('no avisa con URL normal, con // solo en el query ni con URL relativa al protocolo', async () => {
    for (const src of ['https://cdn.test/minisites/a.png', 'https://cdn.test/a.png?u=https://x.com//y', '//cdn.test/a.png', 'http://cdn.test/a.png']) {
      const r = await ValidarDimensionesImagenes(docCon(conUrl(src)), {})
      expect(r.advertencias).toEqual([])
    }
  })

  it('una misma URL repetida avisa una sola vez', async () => {
    const src = 'https://cdn.test//a.png'
    const r = await ValidarDimensionesImagenes(docCon(conUrl(src), conUrl(src)), {})
    expect(r.advertencias).toHaveLength(1)
  })
})
