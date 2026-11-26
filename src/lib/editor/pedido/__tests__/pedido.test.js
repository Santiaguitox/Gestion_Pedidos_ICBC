import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { interpretarPedido } from '../index.js'
import { extraerLegal, leerSecciones, linkPendiente, pedidoSinLegal } from '../secciones.js'
import { importarReferencia } from '../referencia.js'
import { construirFichas } from '../fichas.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const ref = fs.readFileSync(path.join(dir, 'ref.fixture.html'), 'utf8')
const pedido = fs.readFileSync(path.join(dir, 'pedido.fixture.txt'), 'utf8')

describe('secciones', () => {
  it('lee cabeceras y detecta link pendiente', () => {
    const s = leerSecciones(pedido)
    expect(s.header).toContain('https://')
    expect(linkPendiente(pedido)).toBe(true)
  })
  it('corta el legal y no lo manda a la IA', () => {
    const l = extraerLegal(pedido)
    expect(l.especifico.length).toBeGreaterThan(100)
    expect(pedidoSinLegal(pedido).length).toBeLessThan(pedido.length)
  })
})

describe('interpretarPedido', () => {
  it('importa, aplica operaciones válidas y rechaza inventadas', async () => {
    const importado = importarReferencia(ref)
    expect(importado.resultado).toBeTruthy()
    const fichas = construirFichas(importado.resultado)
    const fFecha = fichas.find(f => f.tipo === 'texto' && /3 de diciembre/.test(f.contenido))
    const fAnio = fichas.find(f => f.tipo === 'texto' && /2025/.test(f.contenido))
    expect(fFecha && fAnio).toBeTruthy()
    const r = await interpretarPedido({
      pedido, referenciaHtml: ref,
      llamarIa: async () => ({
        operaciones: [
          { id: fFecha.id, op: 'reemplazar', buscar: '3 de diciembre', por: '2 de diciembre' },
          { id: fAnio.id, op: 'reemplazar', buscar: '2025', por: '2026' },
          { id: fAnio.id, op: 'reemplazar', buscar: 'año', por: '15 años' },
          { id: 'b99.t0', op: 'reemplazar', buscar: 'x', por: 'y' },
        ],
        dudas: [{ texto: 'Falta el link del CTA' }],
      }),
    })
    expect(r.error).toBeUndefined()
    expect(r.cambios.some(c => c.id === fFecha.id)).toBe(true)
    expect(r.rechazadas.length).toBe(2)
    expect(r.dudas.some(d => d.origen === 'link-pendiente' && d.bloqueante)).toBe(true)
    expect(r.cambios.some(c => c.tipo === 'legal')).toBe(true)
    const html = r.resultado.canvas.map(b => b.htmlEditado ?? b.html).join('')
    expect(html).toContain('2 de diciembre')
    expect(r.resultado.legalesAdicionales[0].texto.length).toBeGreaterThan(100)
  })
  it('devuelve error si la IA no es verificable', async () => {
    const r = await interpretarPedido({ pedido, referenciaHtml: ref, llamarIa: async () => ({ no_verificable: true, mensaje: 'tope', razon: 'tope_diario' }) })
    expect(r.error).toBe('tope')
  })
})
