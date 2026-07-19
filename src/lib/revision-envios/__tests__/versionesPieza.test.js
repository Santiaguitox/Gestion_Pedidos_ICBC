import { describe, it, expect } from 'vitest'
import { parseVersionPieza, filtrarSoloUltimaVersion } from '@/lib/revision-envios/versionesPieza'

describe('parseVersionPieza', () => {
  it('reconoce el sufijo _vN al final del nombre', () => {
    expect(parseVersionPieza('Newsletter_v2')).toEqual({ nombreBase: 'Newsletter', version: 2 })
  })

  it('es case-insensitive en la V', () => {
    expect(parseVersionPieza('Newsletter_V10')).toEqual({ nombreBase: 'Newsletter', version: 10 })
  })

  it('devuelve null si no hay sufijo de versión', () => {
    expect(parseVersionPieza('Newsletter')).toBeNull()
  })

  it('no matchea un _v en medio del nombre, solo al final', () => {
    expect(parseVersionPieza('Newsletter_v2_corregido')).toBeNull()
  })

  it('devuelve null para nombre vacío o undefined', () => {
    expect(parseVersionPieza('')).toBeNull()
    expect(parseVersionPieza(undefined)).toBeNull()
  })
})

describe('filtrarSoloUltimaVersion', () => {
  it('se queda con la versión más alta de cada nombre base', () => {
    const piezas = [
      { id: 1, nombre_pieza: 'Newsletter_v1' },
      { id: 2, nombre_pieza: 'Newsletter_v3' },
      { id: 3, nombre_pieza: 'Newsletter_v2' },
    ]
    const { vigentes, excluidas } = filtrarSoloUltimaVersion(piezas)
    expect(vigentes.map(p => p.id)).toEqual([2])
    expect(excluidas.map(p => p.id).sort()).toEqual([1, 3])
  })

  it('piezas sin patrón de versión pasan todas como vigentes, sin agruparse', () => {
    const piezas = [
      { id: 1, nombre_pieza: 'PromoVerano' },
      { id: 2, nombre_pieza: 'PromoInvierno' },
    ]
    const { vigentes, excluidas } = filtrarSoloUltimaVersion(piezas)
    expect(vigentes.map(p => p.id).sort()).toEqual([1, 2])
    expect(excluidas).toEqual([])
  })

  it('mezcla piezas versionadas y sin versionar sin interferencia', () => {
    const piezas = [
      { id: 1, nombre_pieza: 'Newsletter_v1' },
      { id: 2, nombre_pieza: 'Newsletter_v2' },
      { id: 3, nombre_pieza: 'PromoUnica' },
    ]
    const { vigentes, excluidas } = filtrarSoloUltimaVersion(piezas)
    expect(vigentes.map(p => p.id).sort()).toEqual([2, 3])
    expect(excluidas.map(p => p.id)).toEqual([1])
  })
})
