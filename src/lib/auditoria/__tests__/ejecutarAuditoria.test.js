import { describe, it, expect } from 'vitest'
import { nuevaRegla, reglaEsValida, extraerContexto, buscarOcurrencias, parsearPiezasSimple, parsearTabla, construirPiezasDesdeTabla } from '@/lib/auditoria/ejecutarAuditoria.js'

// aplicarReglasAHtml (el wrapper que usa DOMParser para elegir texto
// visible / hrefs / srcs según el tipo de regla) queda fuera de esta
// suite a propósito: el proyecto ya tiene el criterio establecido de
// no traer jsdom como dependencia de test (ver el comentario en
// src/lib/revision/__tests__/imagenes.test.js) y esta función no
// admite inyectar un DOMParser fake sin tocar su firma. Lo que SÍ es
// puro y es el corazón real de "cuántos hallazgos se reportan" —
// extraerContexto y buscarOcurrencias, que no tocan el DOM — queda
// cubierto acá.

describe('reglaEsValida / nuevaRegla', () => {
  it('una regla nueva arranca inválida (valor vacío)', () => {
    expect(reglaEsValida(nuevaRegla())).toBe(false)
  })

  it('valor con solo espacios sigue siendo inválida', () => {
    expect(reglaEsValida({ valor: '   ' })).toBe(false)
  })

  it('con contenido real es válida', () => {
    expect(reglaEsValida({ valor: 'Promo 2x1' })).toBe(true)
  })
})

describe('extraerContexto', () => {
  const texto = 'x'.repeat(60) + 'PROMO2024' + 'y'.repeat(60)

  it('recorta ~40 caracteres antes y después, con el match exacto en el medio', () => {
    const idx = texto.indexOf('PROMO2024')
    const r = extraerContexto(texto, idx, 'PROMO2024'.length)
    expect(r.match).toBe('PROMO2024')
    expect(r.antes.replace('…', '')).toHaveLength(40)
    expect(r.despues.replace('…', '')).toHaveLength(40)
  })

  it('agrega "…" al inicio si el recorte no llega al principio real del texto', () => {
    const idx = texto.indexOf('PROMO2024')
    const r = extraerContexto(texto, idx, 9)
    expect(r.antes.startsWith('…')).toBe(true)
  })

  it('NO agrega "…" cuando el match está pegado al principio/fin real', () => {
    const corto = 'PROMO2024 al inicio del texto'
    const r = extraerContexto(corto, 0, 9)
    expect(r.antes.startsWith('…')).toBe(false)
    expect(r.antes).toBe('')
  })

  it('con margen chico no agrega … si el resto cabe entero', () => {
    const r = extraerContexto('hola PROMO chau', 5, 5, 40)
    expect(r.antes).toBe('hola ')
    expect(r.despues).toBe(' chau')
  })
})

describe('buscarOcurrencias', () => {
  it('valor vacío no matchea nada (y sobre todo no entra en loop infinito)', () => {
    expect(buscarOcurrencias('cualquier texto', '', true)).toEqual([])
  })

  it('encuentra TODAS las ocurrencias, no solo la primera', () => {
    const r = buscarOcurrencias('promo aca, otra promo alla, y una promo mas', 'promo', true)
    expect(r).toHaveLength(3)
  })

  it('ignorarMayus=true matchea sin importar el casing', () => {
    expect(buscarOcurrencias('Promoción ICBC', 'promoción', true)).toHaveLength(1)
  })

  it('ignorarMayus=false es case-sensitive', () => {
    expect(buscarOcurrencias('Promoción ICBC', 'promoción', false)).toHaveLength(0)
    expect(buscarOcurrencias('Promoción ICBC', 'Promoción', false)).toHaveLength(1)
  })

  it('ocurrencias adyacentes (match justo al lado del anterior) se cuentan ambas, sin overlap', () => {
    // 'aa' en 'aaaa': matches en 0 y 2, no en 1 (el avance salta el
    // largo del match, no busca solapado) — comportamiento esperado
    // para evitar contar la misma ocurrencia física dos veces.
    expect(buscarOcurrencias('aaaa', 'aa', true)).toHaveLength(2)
  })
})

describe('parsearPiezasSimple / parsearTabla / construirPiezasDesdeTabla', () => {
  it('pegado simple soporta pipe, tab y coma como separador, y URL sola', () => {
    const texto = [
      'Promo verano | https://icommarketing.com/a',
      'Promo invierno\thttps://icommarketing.com/b',
      'Promo otoño, https://icommarketing.com/c',
      'https://icommarketing.com/d',
    ].join('\n')
    const piezas = parsearPiezasSimple(texto)
    expect(piezas).toHaveLength(4)
    expect(piezas[0].nombre).toBe('Promo verano')
    expect(piezas[3].nombre).toBe('https://icommarketing.com/d') // sin nombre, cae a la URL
    expect(piezas.every(p => p.valida)).toBe(true)
  })

  it('rechaza piezas de dominios que no son icommarketing.com (o subdominios)', () => {
    const piezas = parsearPiezasSimple('Ajena | https://otro-dominio.com/x')
    expect(piezas[0].valida).toBe(false)
    expect(piezas[0].error).toMatch(/icommarketing\.com/)
  })

  it('acepta subdominios de icommarketing.com', () => {
    const piezas = parsearPiezasSimple('CDN | https://cdn.icommarketing.com/x')
    expect(piezas[0].valida).toBe(true)
  })

  it('URL malformada da valida=false con error específico, sin tirar excepción', () => {
    const piezas = parsearPiezasSimple('Rota | no-es-una-url')
    expect(piezas[0].valida).toBe(false)
    expect(piezas[0].error).toBe('URL inválida')
  })

  it('parsearTabla detecta headers cuando la primera fila tiene ≥2 columnas tab-separadas', () => {
    const texto = 'Nombre\tLink\nPromo A\thttps://icommarketing.com/a\nPromo B\thttps://icommarketing.com/b'
    const { headers, filas, tieneHeaders } = parsearTabla(texto)
    expect(tieneHeaders).toBe(true)
    expect(headers).toEqual(['Nombre', 'Link'])
    expect(filas).toHaveLength(2)
  })

  it('parsearTabla NO detecta headers si la primera fila no tiene tabs (evita adivinar)', () => {
    const { tieneHeaders, headers, filas } = parsearTabla('esto es una sola columna\notra fila')
    expect(tieneHeaders).toBe(false)
    expect(headers).toEqual([])
    expect(filas).toEqual([])
  })

  it('construirPiezasDesdeTabla reordena la columna principal primero y descarta filas sin link', () => {
    const parsed = {
      headers: ['ID', 'Nombre', 'Link'],
      filas: [
        ['1', 'Promo A', 'https://icommarketing.com/a'],
        ['2', 'Sin link', ''],
      ],
    }
    const piezas = construirPiezasDesdeTabla(parsed, { columnasNombre: [0, 1], columnaPrincipal: 1, columnaLink: 2 })
    expect(piezas).toHaveLength(1) // la fila sin link se descarta
    expect(piezas[0].campos[0]).toEqual({ etiqueta: 'Nombre', valor: 'Promo A' }) // principal primero
    expect(piezas[0].nombre).toBe('Promo A')
  })

  it('construirPiezasDesdeTabla sin columnaLink devuelve vacío (contrato documentado)', () => {
    expect(construirPiezasDesdeTabla({ headers: [], filas: [] }, { columnasNombre: [], columnaPrincipal: null, columnaLink: null })).toEqual([])
  })
})
