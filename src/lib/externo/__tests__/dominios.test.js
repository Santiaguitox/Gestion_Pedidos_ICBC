import { describe, it, expect } from 'vitest'
import { resumirDominios } from '../dominios.js'

const docCon = srcs => ({
  querySelectorAll: () => srcs.map(s => ({ getAttribute: a => (a === 'src' ? s : null) })),
})

describe('resumirDominios: imágenes con variable', () => {
  it('src que es una variable se cuenta como dinámica, sin avisos', () => {
    const r = resumirDominios(docCon(['<*prod1_img_url*>', '&lt;*prod2_img_url*&gt;']))
    expect(r.dinamicas.map(d => d.variable)).toEqual(['prod1_img_url', 'prod2_img_url'])
    expect(r.avisos).toEqual([])
    expect(r.sinDominio).toBe(0)
    expect(r.total).toBe(2)
  })

  it('una URL con variable adentro no pide medición ni avisa', () => {
    const r = resumirDominios(docCon(['https://cdn.x.com/<*foto*>.jpg']))
    expect(r.dinamicas).toHaveLength(1)
    expect(r.avisos).toEqual([])
    expect(r.dominios).toEqual([])
  })

  it('las imágenes normales siguen igual', () => {
    const r = resumirDominios(docCon(['img/a.png', 'https://cdn.x.com/a.jpg']), { 'https://cdn.x.com/a.jpg': { peso: 100 } })
    expect(r.dinamicas).toEqual([])
    expect(r.sinDominio).toBe(1)
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0].tipo).toBe('relativa')
    expect(r.dominios[0].host).toBe('cdn.x.com')
  })
})

describe('resumirDominios: avisos agrupados', () => {
  const medidas = { 'https://cdn.x.com/a.jpg': { peso: 100 } }

  it('agrupa las imágenes http en un solo aviso, en plural', () => {
    const r = resumirDominios(docCon(['http://a.com/uno.jpg', 'http://a.com/dos.jpg', 'http://b.com/tres.png']), {
      'http://a.com/uno.jpg': { peso: 1 }, 'http://a.com/dos.jpg': { peso: 1 }, 'http://b.com/tres.png': { peso: 1 },
    })
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0].tipo).toBe('http')
    expect(r.avisos[0].nombres).toHaveLength(3)
    expect(r.avisos[0].predicado).toBe('usan un protocolo sin cifrar (http).')
    expect(r.avisos[0].detalle).toContain('Subir las imágenes')
  })

  it('con una sola imagen usa el singular', () => {
    const r = resumirDominios(docCon(['http://a.com/uno.jpg']), { 'http://a.com/uno.jpg': { peso: 1 } })
    expect(r.avisos[0].nombres).toHaveLength(1)
    expect(r.avisos[0].predicado).toBe('usa un protocolo sin cifrar (http).')
    expect(r.avisos[0].detalle).toContain('Subir la imagen')
  })

  it('el mismo src repetido se cuenta una vez', () => {
    const r = resumirDominios(docCon(['http://a.com/uno.jpg', 'http://a.com/uno.jpg']), { 'http://a.com/uno.jpg': { peso: 1 } })
    expect(r.avisos[0].nombres).toHaveLength(1)
  })

  it('un grupo por tipo y en orden fijo', () => {
    const r = resumirDominios(docCon(['img/a.png', 'http://a.com/x.jpg', '//c.com/y.jpg', 'data:image/png;base64,AAAA', 'https://cdn.x.com/a.jpg', 'https://cdn.x.com/sinmedir.jpg']), {
      ...medidas, 'http://a.com/x.jpg': { peso: 1 }, '//c.com/y.jpg': { peso: 1 },
    })
    expect(r.avisos.map(a => a.tipo)).toEqual(['http', 'sinProtocolo', 'data', 'relativa', 'sinMedir'])
  })

  it('otro esquema muestra el protocolo detectado', () => {
    const r = resumirDominios(docCon(['ftp://a.com/x.jpg']))
    expect(r.avisos[0].tipo).toBe('otroEsquema')
    expect(r.avisos[0].detalle).toContain('ftp:')
  })
})
