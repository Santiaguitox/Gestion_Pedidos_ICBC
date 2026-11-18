import { describe, it, expect } from 'vitest'
import { hexAHsv, hsvAHex } from '../color.js'

describe('conversión hex <-> hsv', () => {
  it('colores básicos', () => {
    expect(hexAHsv('#ff0000')).toEqual({ h: 0, s: 100, v: 100 })
    expect(hexAHsv('#00ff00').h).toBe(120)
    expect(hexAHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 100 })
    expect(hexAHsv('#000000').v).toBe(0)
  })
  it('ida y vuelta casi exacta', () => {
    for (const hex of ['#2457f1', '#e1f8fb', '#c0c0c0', '#0e316e', '#f3f4f6']) {
      const v = hsvAHex(hexAHsv(hex))
      const d = [1, 3, 5].map(i => Math.abs(parseInt(v.slice(i, i + 2), 16) - parseInt(hex.slice(i, i + 2), 16)))
      expect(Math.max(...d)).toBeLessThanOrEqual(3)
    }
  })
})
