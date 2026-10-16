import { describe, it, expect } from 'vitest'
import { calcularPuntaje } from '../puntaje.js'

describe('calcularPuntaje (misma fórmula que la app)', () => {
  it('suma OK y advertencias; error es lo que no es ni OK ni advertencia', () => {
    const r = {
      estructuraHTML: { ok: true }, clasesCSS: { ok: true }, links: { ok: false, advertencias: [{}, {}] },
      altImagenes: { ok: true }, dimensiones: { ok: false, advertencia: true, advertencias: [{}] },
      pesoImagenes: { ok: false }, pesoHTML: { ok: true },
    }
    expect(calcularPuntaje(r)).toEqual({ okN: 4, warnN: 1, errN: 2, detalleMenorN: 3, score: 5, total: 7 })
  })
})
