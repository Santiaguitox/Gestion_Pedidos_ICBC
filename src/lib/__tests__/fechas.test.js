import { describe, it, expect } from 'vitest'
import { esVencido, calcularGrupo, parseFechaLimite } from '@/lib/fechas.js'
import { format, addDays } from 'date-fns'

// "Hoy" fijo para que los tests no dependan del día en que corren.
// Dos variantes: la normalizada a medianoche (el contrato de
// calcularGrupo — los llamadores hacen setHours(0,0,0,0)) y una con
// hora de la tarde, para probar que esVencido normaliza por su cuenta
// (el bug que lo motivó era justamente de hora: isPast(medianoche)
// daba vencido a partir de las 00:01 del mismo día).
const HOY = new Date(2026, 6, 8) // miércoles 8 de julio de 2026, 00:00
const HOY_TARDE = new Date(2026, 6, 8, 15, 30)

const fecha = (offsetDias) => format(addDays(HOY, offsetDias), 'yyyy-MM-dd')

describe('parseFechaLimite', () => {
  it('interpreta el string en hora local, no UTC', () => {
    const d = parseFechaLimite('2026-07-08')
    // En UTC-3, new Date('2026-07-08') sin sufijo caería al 7 a las 21:00.
    expect(d.getDate()).toBe(8)
    expect(d.getHours()).toBe(0)
  })
})

describe('esVencido', () => {
  it('vence HOY → NO está vencido (sigue en juego todo el día)', () => {
    expect(esVencido(fecha(0), HOY)).toBe(false)
    expect(esVencido(fecha(0), HOY_TARDE)).toBe(false)
  })

  it('venció ayer → vencido, a cualquier hora del día', () => {
    expect(esVencido(fecha(-1), HOY)).toBe(true)
    expect(esVencido(fecha(-1), HOY_TARDE)).toBe(true)
  })

  it('vence mañana → no vencido, a cualquier hora del día', () => {
    expect(esVencido(fecha(1), HOY)).toBe(false)
    expect(esVencido(fecha(1), HOY_TARDE)).toBe(false)
  })

  it('sin fecha límite → no vencido', () => {
    expect(esVencido(null, HOY)).toBe(false)
    expect(esVencido('', HOY)).toBe(false)
  })

  it('coincide con el grupo "vencidos"/"hoy" de calcularGrupo (criterio único)', () => {
    // La razón de ser de esVencido: que Calendario y Dashboard no
    // puedan volver a divergir. Vencido ⟺ grupo 'vencidos'.
    for (const off of [-2, -1, 0, 1, 5]) {
      const grupo = calcularGrupo({ fecha_limite: fecha(off) }, HOY)
      expect(esVencido(fecha(off), HOY)).toBe(grupo === 'vencidos')
    }
  })
})

describe('calcularGrupo', () => {
  it('sin fecha → sin_fecha', () => {
    expect(calcularGrupo({ fecha_limite: null }, HOY)).toBe('sin_fecha')
  })

  it('ayer → vencidos, hoy → hoy, mañana → mañana', () => {
    expect(calcularGrupo({ fecha_limite: fecha(-1) }, HOY)).toBe('vencidos')
    expect(calcularGrupo({ fecha_limite: fecha(0) }, HOY)).toBe('hoy')
    expect(calcularGrupo({ fecha_limite: fecha(1) }, HOY)).toBe('mañana')
  })

  it('el viernes de esta semana → esta_semana', () => {
    // HOY es miércoles: +2 es viernes, dentro de la misma semana ISO.
    expect(calcularGrupo({ fecha_limite: fecha(2) }, HOY)).toBe('esta_semana')
  })

  it('el miércoles que viene → proxima_semana', () => {
    expect(calcularGrupo({ fecha_limite: fecha(7) }, HOY)).toBe('proxima_semana')
  })

  it('en tres semanas → mas_adelante', () => {
    expect(calcularGrupo({ fecha_limite: fecha(21) }, HOY)).toBe('mas_adelante')
  })
})
