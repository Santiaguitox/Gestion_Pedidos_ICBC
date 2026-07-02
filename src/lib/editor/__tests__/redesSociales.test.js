import { describe, it, expect } from 'vitest'
import { detectarRedesSociales, reordenarRedesSociales } from '@/lib/editor/redesSociales.js'
import { BLOQUES_HEADER } from '@/lib/editor/bloques.js'

const headerCG = () => BLOQUES_HEADER.find(b => b.slug === 'CG_Banda_Roja_Header').html
const headerComex = () => BLOQUES_HEADER.find(b => b.slug === 'CG_Banda_Roja_Header_Comex').html

const contarCeldas = html => (html.match(/<td class="IconoRedes"/g) || []).length

describe('detectarRedesSociales', () => {
  it('detecta las redes presentes en un header real por dominio', () => {
    const redes = detectarRedesSociales(headerCG())
    expect(redes.length).toBeGreaterThan(0)
    expect(redes).toContain('twitter')
  })

  it('devuelve [] para html vacío', () => {
    expect(detectarRedesSociales('')).toEqual([])
  })

  it('con conEstado=true, en un template crudo todas las redes están activas', () => {
    const redes = detectarRedesSociales(headerCG(), true)
    expect(redes.every(r => r.activa === true)).toBeTruthy()
  })
})

describe('reordenarRedesSociales', () => {
  it('reordena poniendo las activas primero, sin cambiar la cantidad de celdas', () => {
    const html = headerCG()
    const orden = detectarRedesSociales(html, true)
    // Desactivar la primera y mover la última al frente
    const nuevaConfig = [orden[orden.length - 1], ...orden.slice(0, -1).map((r, i) => i === 0 ? { ...r, activa: false } : r)]
    const nuevo = reordenarRedesSociales(html, nuevaConfig)
    expect(contarCeldas(nuevo)).toBe(contarCeldas(html))
    // Cada celda queda identificada aunque esté vacía
    expect((nuevo.match(/data-red="/g) || []).length).toBe(contarCeldas(html))
  })

  it('una red desactivada queda con celda vacía pero detectable (bug real de reimportación)', () => {
    const html = headerCG()
    const orden = detectarRedesSociales(html, true)
    const apagada = orden[0].key
    const nuevo = reordenarRedesSociales(html, orden.map(r => r.key === apagada ? { ...r, activa: false } : r))
    const releido = detectarRedesSociales(nuevo, true)
    const red = releido.find(r => r.key === apagada)
    // La red sigue presente (por data-red) pero como inactiva —
    // antes del fix desaparecía sin rastro y el pill se perdía.
    expect(red).toBeDefined()
    expect(red.activa).toBe(false)
    // Y las demás siguen activas
    expect(releido.filter(r => r.activa)).toHaveLength(orden.length - 1)
  })

  it('reordenar dos veces con el mismo orden es estable (no duplica data-red)', () => {
    const html = headerCG()
    const orden = detectarRedesSociales(html, true)
    const una = reordenarRedesSociales(html, orden)
    const dos = reordenarRedesSociales(una, orden)
    expect(dos).toBe(una)
  })

  it('un header sin redes reales (Comex) vuelve intacto', () => {
    const html = headerComex()
    expect(reordenarRedesSociales(html, [{ key: 'twitter', activa: true }])).toBe(html)
  })

  it('ordenActivo null u html vacío no rompen', () => {
    expect(reordenarRedesSociales(headerCG(), null)).toBe(headerCG())
    expect(reordenarRedesSociales('', [])).toBe('')
  })
})
