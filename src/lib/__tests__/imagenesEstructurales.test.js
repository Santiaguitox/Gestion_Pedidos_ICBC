import { describe, it, expect } from 'vitest'
import { esImagenEstructural } from '@/lib/imagenesEstructurales.js'

describe('esImagenEstructural', () => {
  // Los 6 separadores del repositorio de imágenes reportados por Santi
  // (2026-07-10) — si alguno de estos deja de matchear, la Revisión
  // vuelve a marcarlos como error y el editor vuelve a alertar
  // desproporción al cambiar la URL.
  const separadores = [
    'Img_Separador.png',
    'Img_Separador265x100.png',
    'Img_Separador265x128.png',
    'ImgSeparadorH_Rojo10px.jpg',
    'ImgSeparadorH_Rojo5px.jpg',
    'Img_Separador_265x2.png',
  ]

  it.each(separadores)('%s es estructural', (nombre) => {
    expect(esImagenEstructural(nombre)).toBe(true)
  })

  it('también matchea con la URL completa, no solo el nombre', () => {
    expect(esImagenEstructural('https://cdn.icommkt.com/imgs/Img_Separador265x100.png')).toBe(true)
  })

  it('la línea punteada del Módulo Doble es estructural', () => {
    expect(esImagenEstructural('MediaLineaPunteada_600.png')).toBe(true)
  })

  it('es case-insensitive (convención de nombres con mayúsculas variables)', () => {
    expect(esImagenEstructural('IMG_SEPARADOR.PNG')).toBe(true)
    expect(esImagenEstructural('img_separador.png')).toBe(true)
  })

  it('las imágenes de contenido NO son estructurales', () => {
    expect(esImagenEstructural('Img_Header_600x200.png')).toBe(false)
    expect(esImagenEstructural('logo_icbc.png')).toBe(false)
    expect(esImagenEstructural('Boton_ConoceMas_205x47.png')).toBe(false)
    expect(esImagenEstructural('foto_promo_separada.jpg')).toBe(false)
  })

  it('src vacío o null no es estructural', () => {
    expect(esImagenEstructural('')).toBe(false)
    expect(esImagenEstructural(null)).toBe(false)
    expect(esImagenEstructural(undefined)).toBe(false)
  })
})
