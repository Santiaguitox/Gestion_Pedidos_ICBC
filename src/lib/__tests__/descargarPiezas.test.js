import { describe, it, expect } from 'vitest'
import { sanitizarNombreZip, nombreArchivo } from '@/lib/descargarPiezas.js'

// limpiarHtml y descargarZip usan DOMParser/JSZip/document.createElement
// y quedan fuera de esta suite por el mismo criterio que
// aplicarReglasAHtml en ejecutarAuditoria.test.js (sin jsdom como
// dependencia de test). Lo que sí es puro — nombrar los archivos que
// terminan en el ZIP que el usuario descarga — se cubre acá: un nombre
// mal sanitizado es la clase de bug que solo se nota mirando el ZIP ya
// descargado.

describe('sanitizarNombreZip', () => {
  it('normaliza tildes y ñ, reemplaza espacios y separadores por _', () => {
    expect(sanitizarNombreZip('Envío Plazo Fijo | CAMPAÑA NRO 33')).toBe('Envio_Plazo_Fijo_CAMPANA_NRO_33')
  })

  it('colapsa múltiples _ consecutivos y recorta los bordes', () => {
    expect(sanitizarNombreZip('  ***Promo***  ')).toBe('Promo')
  })

  it('nombre vacío o solo símbolos cae al default "piezas"', () => {
    expect(sanitizarNombreZip('')).toBe('piezas')
    expect(sanitizarNombreZip('###???')).toBe('piezas')
    expect(sanitizarNombreZip(null)).toBe('piezas')
  })

  it('recorta a 80 caracteres', () => {
    const largo = 'A'.repeat(200)
    expect(sanitizarNombreZip(largo).length).toBeLessThanOrEqual(80)
  })

  it('Ñ mayúscula se preserva como N mayúscula (no rompe el casing)', () => {
    expect(sanitizarNombreZip('BAÑO ESPAÑA')).toBe('BANO_ESPANA')
  })
})

describe('nombreArchivo', () => {
  it('prioriza nombre_pieza sobre link_online', () => {
    expect(nombreArchivo({ nombre_pieza: 'Promo Verano', link_online: 'https://x.com/y' })).toBe('Promo_Verano.html')
  })

  it('sin nombre_pieza, deriva del link quitando el protocolo y dominio', () => {
    expect(nombreArchivo({ link_online: 'https://icommarketing.com/piezas/promo-2024' })).toBe('piezas_promo-2024.html')
  })

  it('sin nombre ni link, cae al default "pieza"', () => {
    expect(nombreArchivo({})).toBe('pieza.html')
  })

  it('caracteres no alfanuméricos (fuera de guion y guion bajo) se reemplazan por _, y los bordes se recortan', () => {
    expect(nombreArchivo({ nombre_pieza: 'Promo: 2x1 (Verano)!' })).toBe('Promo_2x1_Verano.html')
  })
})
