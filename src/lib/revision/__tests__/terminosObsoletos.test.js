import { describe, it, expect } from 'vitest'
import { el, docDe } from './fakeDom.js'
import { extraerTextosPieza } from '@/lib/revision/textoPieza.js'
import {
  buscarTerminosObsoletos,
  buscarLinksObsoletos,
  combinarLinksConObsoletos,
} from '@/lib/revision/terminosObsoletos.js'

const hallazgosDeTexto = (...hijos) => buscarTerminosObsoletos(extraerTextosPieza(docDe(...hijos)))

describe('buscarTerminosObsoletos', () => {
  it('detecta ICBC Access Banking y Access Banking en el texto', () => {
    const h = hallazgosDeTexto(el('P', {}, 'Ingresá a ICBC Access Banking'), el('P', {}, 'Entrá a Access Banking ya'))
    expect(h).toHaveLength(2)
    expect(h[0].detalle).toContain('ICBC Access Banking')
    expect(h[0].detalle).toContain('ICBC Online y Mobile Banking')
  })

  it('ignora mayúsculas, espacios dobles, nbsp y AccessBanking pegado', () => {
    expect(hallazgosDeTexto(el('P', {}, 'ACCESS   BANKING'))).toHaveLength(1)
    expect(hallazgosDeTexto(el('P', {}, 'icbc access banking'))).toHaveLength(1)
    expect(hallazgosDeTexto(el('P', {}, 'AccessBanking'))).toHaveLength(1)
  })

  it('detecta ICBC Access sin Banking, pero no la palabra access suelta ni acceso', () => {
    expect(hallazgosDeTexto(el('P', {}, 'Con ICBC Access operás todo'))).toHaveLength(1)
    expect(hallazgosDeTexto(el('P', {}, 'Tu acceso a la cuenta'))).toHaveLength(0)
    expect(hallazgosDeTexto(el('P', {}, 'Wi-Fi access point'))).toHaveLength(0)
  })

  it('detecta el término cortado por etiquetas inline', () => {
    expect(hallazgosDeTexto(el('P', {}, 'ICBC ', el('B', {}, 'Access'), ' Banking'))).toHaveLength(1)
  })

  it('en un hipervínculo indica que debe decir ICBC Online Banking', () => {
    const h = hallazgosDeTexto(el('P', {}, 'Ingresá a ', el('A', { href: 'https://x.com' }, 'ICBC Access Banking')))
    expect(h).toHaveLength(1)
    expect(h[0].detalle).toContain('con hipervínculo')
    expect(h[0].detalle).toContain('reemplazarlo por: ICBC Online Banking')
    expect(h[0].detalle).not.toContain('Mobile Banking')
  })

  it('lo detecta también en alt y title, diciéndolo', () => {
    const h = hallazgosDeTexto(
      el('IMG', { src: 'a.jpg', alt: 'Logo ICBC Access Banking' }),
      el('A', { href: 'x', title: 'Access Banking' }, 'Ver más'),
    )
    expect(h.map(x => x.detalle).join('|')).toContain('en el alt de una imagen')
    expect(h.map(x => x.detalle).join('|')).toContain('en un atributo title')
  })

  it('no repite el mismo hallazgo', () => {
    const h = hallazgosDeTexto(el('P', {}, 'Access Banking'), el('P', {}, 'Access Banking'))
    expect(h).toHaveLength(1)
  })

  it('no marca ICBC Online Banking', () => {
    expect(hallazgosDeTexto(el('P', {}, 'Usá ICBC Online Banking o Mobile Banking'))).toHaveLength(0)
  })
})

describe('buscarLinksObsoletos', () => {
  const doc = (...hrefs) => docDe(...hrefs.map(h => el('A', { href: h }, 'link')))

  it('detecta el dominio con o sin www y con cualquier ruta', () => {
    expect(buscarLinksObsoletos(doc('https://www.accessbanking.com.ar/'))).toHaveLength(1)
    expect(buscarLinksObsoletos(doc('http://accessbanking.com.ar/login?x=1'))).toHaveLength(1)
  })

  it('lo detecta dentro de un link de tracking', () => {
    const url = `https://track.com/r?u=${encodeURIComponent('https://www.accessbanking.com.ar/')}`
    expect(buscarLinksObsoletos(doc(url))).toHaveLength(1)
  })

  it('no marca otros dominios ni hrefs vacíos', () => {
    expect(buscarLinksObsoletos(doc('https://www.icbc.com.ar', ''))).toHaveLength(0)
  })

  it('no repite el mismo href', () => {
    expect(buscarLinksObsoletos(doc('https://www.accessbanking.com.ar/', 'https://www.accessbanking.com.ar/'))).toHaveLength(1)
  })
})

describe('combinarLinksConObsoletos', () => {
  const links = { ok: true, tipo: 'Links', detalle: '3 links revisados', checks: [], advertencias: [{ detalle: 'a' }] }

  it('suma como detalle menor sin cambiar ok ni detalle', () => {
    const r = combinarLinksConObsoletos(links, [{ detalle: 'obsoleto' }])
    expect(r.ok).toBe(true)
    expect(r.detalle).toBe('3 links revisados')
    expect(r.advertencias).toHaveLength(2)
  })

  it('sin obsoletos devuelve el mismo objeto', () => {
    expect(combinarLinksConObsoletos(links, [])).toBe(links)
  })
})
