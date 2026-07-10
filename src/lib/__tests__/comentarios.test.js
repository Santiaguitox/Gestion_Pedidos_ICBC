import { describe, it, expect } from 'vitest'
import {
  segmentarContenido,
  extraerMenciones,
  detectarMencionActiva,
  filtrarUsuarios,
  insertarMencion,
  insertarMencionAmigable,
  reconstruirMenciones,
  contenidoAFormularioAmigable,
  agruparReacciones,
  normalizar,
  esUrlDeImagen,
  extraerUrlsDeImagen,
} from '@/lib/comentarios.js'

const UUID_A = '11111111-2222-3333-4444-555555555555'
const UUID_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('segmentarContenido', () => {
  it('texto sin menciones es un único segmento de texto', () => {
    expect(segmentarContenido('hola equipo')).toEqual([
      { tipo: 'texto', valor: 'hola equipo' },
    ])
  })

  it('intercala texto y menciones preservando el orden', () => {
    const seg = segmentarContenido(`Che @[Juan Pérez](${UUID_A}) fijate esto`)
    expect(seg).toEqual([
      { tipo: 'texto', valor: 'Che ' },
      { tipo: 'mencion', valor: 'Juan Pérez', userId: UUID_A },
      { tipo: 'texto', valor: ' fijate esto' },
    ])
  })

  it('mención al inicio y al final, sin segmentos de texto vacíos', () => {
    const seg = segmentarContenido(`@[Ana](${UUID_A}) y @[Beto](${UUID_B})`)
    expect(seg.map(s => s.tipo)).toEqual(['mencion', 'texto', 'mencion'])
  })

  it('un @[...](...) con algo que NO es uuid queda como texto plano', () => {
    const seg = segmentarContenido('mirá @[esto](no-es-uuid) raro')
    expect(seg).toEqual([{ tipo: 'texto', valor: 'mirá @[esto](no-es-uuid) raro' }])
  })

  it('contenido null/undefined devuelve lista vacía', () => {
    expect(segmentarContenido(null)).toEqual([])
    expect(segmentarContenido(undefined)).toEqual([])
  })
})

describe('extraerMenciones', () => {
  it('extrae los uuid en orden de aparición', () => {
    const ids = extraerMenciones(`@[Ana](${UUID_A}) hola @[Beto](${UUID_B})`)
    expect(ids).toEqual([UUID_A, UUID_B])
  })

  it('deduplica menciones repetidas del mismo usuario', () => {
    const ids = extraerMenciones(`@[Ana](${UUID_A}) sí @[Ana](${UUID_A})`)
    expect(ids).toEqual([UUID_A])
  })

  it('sin menciones devuelve array vacío', () => {
    expect(extraerMenciones('nada por acá')).toEqual([])
  })
})

describe('detectarMencionActiva', () => {
  it('detecta @ recién tipeado (query vacía)', () => {
    expect(detectarMencionActiva('hola @', 6)).toEqual({ inicio: 5, query: '' })
  })

  it('detecta @ con query parcial, admitiendo espacios (nombres compuestos)', () => {
    expect(detectarMencionActiva('ok @juan pe', 11)).toEqual({ inicio: 3, query: 'juan pe' })
  })

  it('@ al inicio del texto es válido', () => {
    expect(detectarMencionActiva('@an', 3)).toEqual({ inicio: 0, query: 'an' })
  })

  it('@ pegado a una palabra (mail) NO es mención', () => {
    expect(detectarMencionActiva('juan@icomm', 10)).toBeNull()
  })

  it('un salto de línea después del @ cancela la mención', () => {
    expect(detectarMencionActiva('ver @\nhola', 10)).toBeNull()
  })

  it('query demasiado larga se descarta (el @ quedó atrás)', () => {
    const texto = '@' + 'x'.repeat(40)
    expect(detectarMencionActiva(texto, texto.length)).toBeNull()
  })

  it('sin @ antes del cursor devuelve null', () => {
    expect(detectarMencionActiva('hola equipo', 11)).toBeNull()
  })
})

describe('filtrarUsuarios / normalizar', () => {
  const usuarios = [
    { id: '1', full_name: 'Juan Pérez' },
    { id: '2', full_name: 'María Núñez' },
    { id: '3', full_name: 'Pedro Gómez' },
  ]

  it('normalizar saca acentos y baja a minúsculas', () => {
    expect(normalizar('Pérez Núñez')).toBe('perez nunez')
  })

  it('matchea por prefijo de cualquier palabra, sin acentos', () => {
    expect(filtrarUsuarios(usuarios, 'per').map(u => u.id)).toEqual(['1'])
    expect(filtrarUsuarios(usuarios, 'nuñ').map(u => u.id)).toEqual(['2'])
    expect(filtrarUsuarios(usuarios, 'go').map(u => u.id)).toEqual(['3'])
  })

  it('query vacía devuelve todos (recién tipeado el @)', () => {
    expect(filtrarUsuarios(usuarios, '')).toHaveLength(3)
  })

  it('sin matches devuelve vacío', () => {
    expect(filtrarUsuarios(usuarios, 'zzz')).toEqual([])
  })
})

describe('insertarMencion', () => {
  it('reemplaza desde el @ hasta el cursor por el token + espacio', () => {
    const { texto, cursor } = insertarMencion('ok @jua listo', 3, 7, { id: UUID_A, full_name: 'Juan Pérez' })
    expect(texto).toBe(`ok @[Juan Pérez](${UUID_A})  listo`)
    expect(texto.slice(cursor)).toBe(' listo')
  })
})

describe('mención amigable (composer/edición sin uuid visible)', () => {
  const MARCA = '\u2060'
  const usuarios = [
    { id: UUID_A, full_name: 'Juan Pérez' },
    { id: UUID_B, full_name: 'Beto' },
  ]

  it('insertarMencionAmigable no deja el uuid a la vista', () => {
    const { texto } = insertarMencionAmigable('ok @jua', 3, 7, { id: UUID_A, full_name: 'Juan Pérez' })
    expect(texto).toBe(`ok ${MARCA}@Juan Pérez${MARCA} `)
    expect(texto).not.toContain(UUID_A)
  })

  it('reconstruirMenciones arma el token @[Nombre](uuid) resolviendo contra el roster', () => {
    const amigable = `hola ${MARCA}@Juan Pérez${MARCA} y ${MARCA}@Beto${MARCA} che`
    expect(reconstruirMenciones(amigable, usuarios)).toBe(
      `hola @[Juan Pérez](${UUID_A}) y @[Beto](${UUID_B}) che`
    )
  })

  it('sin match en el roster degrada a texto plano (sin romper ni inventar uuid)', () => {
    const amigable = `hola ${MARCA}@Alguien Borrado${MARCA} che`
    expect(reconstruirMenciones(amigable, usuarios)).toBe('hola @Alguien Borrado che')
  })

  it('contenidoAFormularioAmigable es la inversa exacta de reconstruirMenciones', () => {
    const persistido = `hola @[Juan Pérez](${UUID_A}) che`
    const amigable = contenidoAFormularioAmigable(persistido)
    expect(amigable).toBe(`hola ${MARCA}@Juan Pérez${MARCA} che`)
    expect(reconstruirMenciones(amigable, usuarios)).toBe(persistido)
  })

  it('texto sin menciones no se altera en ningún sentido', () => {
    expect(contenidoAFormularioAmigable('sin nada')).toBe('sin nada')
    expect(reconstruirMenciones('sin nada', usuarios)).toBe('sin nada')
  })
})

describe('agruparReacciones', () => {
  const reacciones = [
    { emoji: '👍', user_id: 'u1', profiles: { full_name: 'Ana' } },
    { emoji: '👍', user_id: 'u2', profiles: { full_name: 'Beto' } },
    { emoji: '👀', user_id: 'u2', profiles: { full_name: 'Beto' } },
  ]

  it('agrupa por emoji con count y nombres, en orden de primera aparición', () => {
    const grupos = agruparReacciones(reacciones, 'u3')
    expect(grupos).toEqual([
      { emoji: '👍', count: 2, mia: false, nombres: ['Ana', 'Beto'] },
      { emoji: '👀', count: 1, mia: false, nombres: ['Beto'] },
    ])
  })

  it('marca mia si el usuario actual reaccionó con ese emoji', () => {
    const grupos = agruparReacciones(reacciones, 'u2')
    expect(grupos.find(g => g.emoji === '👍').mia).toBe(true)
    expect(grupos.find(g => g.emoji === '👀').mia).toBe(true)
  })

  it('lista vacía o null devuelve vacío', () => {
    expect(agruparReacciones([], 'u1')).toEqual([])
    expect(agruparReacciones(null, 'u1')).toEqual([])
  })
})

describe('detección de URLs (link e imagen)', () => {
  it('un tramo de texto plano con una URL de imagen se segmenta con esImagen=true', () => {
    const seg = segmentarContenido('mirá esto https://cdn.icomm.com/foto.png dale')
    expect(seg).toEqual([
      { tipo: 'texto', valor: 'mirá esto ' },
      { tipo: 'url', valor: 'https://cdn.icomm.com/foto.png', esImagen: true },
      { tipo: 'texto', valor: ' dale' },
    ])
  })

  it('una URL que no es de imagen se segmenta con esImagen=false', () => {
    const seg = segmentarContenido('ver https://icomm.com/pedido/123')
    expect(seg).toEqual([
      { tipo: 'texto', valor: 'ver ' },
      { tipo: 'url', valor: 'https://icomm.com/pedido/123', esImagen: false },
    ])
  })

  it('recorta puntuación de cierre pegada al final de la URL', () => {
    const seg = segmentarContenido('dale, https://x.com/foo.')
    expect(seg).toEqual([
      { tipo: 'texto', valor: 'dale, ' },
      { tipo: 'url', valor: 'https://x.com/foo', esImagen: false },
      { tipo: 'texto', valor: '.' },
    ])
  })

  it('reconoce imagen con query string después de la extensión', () => {
    const seg = segmentarContenido('https://x.com/img.jpg?w=200&h=100')
    expect(seg[0]).toEqual({ tipo: 'url', valor: 'https://x.com/img.jpg?w=200&h=100', esImagen: true })
  })

  it('convive con menciones sin pisarse: mención + url en el mismo comentario', () => {
    const seg = segmentarContenido(`@[Ana](${UUID_A}) mirá https://x.com/a.gif`)
    expect(seg).toEqual([
      { tipo: 'mencion', valor: 'Ana', userId: UUID_A },
      { tipo: 'texto', valor: ' mirá ' },
      { tipo: 'url', valor: 'https://x.com/a.gif', esImagen: true },
    ])
  })

  it('texto sin URLs no se altera', () => {
    expect(segmentarContenido('nada por acá')).toEqual([{ tipo: 'texto', valor: 'nada por acá' }])
  })
})

describe('esUrlDeImagen', () => {
  it('reconoce extensiones de imagen comunes, insensible a mayúsculas', () => {
    for (const ext of ['png', 'JPG', 'jpeg', 'gif', 'webp', 'avif', 'svg']) {
      expect(esUrlDeImagen(`https://x.com/foo.${ext}`)).toBe(true)
    }
  })

  it('un link que no es de imagen da false', () => {
    expect(esUrlDeImagen('https://x.com/pedido/123')).toBe(false)
  })
})

describe('extraerUrlsDeImagen', () => {
  it('extrae solo las URLs que son de imagen, en orden de aparición', () => {
    const contenido = 'mirá https://x.com/a.png y también https://x.com/pedido y esta https://x.com/b.jpg'
    expect(extraerUrlsDeImagen(contenido)).toEqual(['https://x.com/a.png', 'https://x.com/b.jpg'])
  })

  it('sin imágenes devuelve vacío', () => {
    expect(extraerUrlsDeImagen('sin nada, ni https://x.com/pedido')).toEqual([])
  })
})
