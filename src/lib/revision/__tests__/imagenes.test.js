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
