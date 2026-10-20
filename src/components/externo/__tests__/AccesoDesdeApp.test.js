import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import AccesoDesdeApp from '../AccesoDesdeApp.jsx'

const render = state =>
  renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [{ pathname: '/analisis', state }] }, createElement(AccesoDesdeApp))
  )

describe('AccesoDesdeApp (barra de /analisis cuando se llega desde la app)', () => {
  it('con la señal desdeApp muestra Volver y Copiar link público', () => {
    const html = render({ desdeApp: true })
    expect(html).toContain('Volver a Revisión de emails')
    expect(html).toContain('Copiar link público')
  })
  it('entrando directo por el link público no muestra nada', () => {
    expect(render(undefined)).toBe('')
    expect(render(null)).toBe('')
  })
  it('solo el valor true activa la barra (no cualquier valor truthy)', () => {
    expect(render({ desdeApp: 'true' })).toBe('')
    expect(render({ desdeApp: 1 })).toBe('')
    expect(render({ otraCosa: true })).toBe('')
  })
})
