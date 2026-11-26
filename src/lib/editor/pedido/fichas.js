// Fichas: lista compacta de lo editable de la pieza importada. Es lo único
// que ve la IA (nunca el HTML). Cada ficha tiene un id estable que la IA cita
// en sus operaciones y que aplicar.js resuelve de vuelta a un campo real.
//
// ids: "hdr" (imagen principal), "b3.t1" (texto n°1 del bloque 3),
//      "b3.l0" (link), "b3.i0" (imagen), "legal.0" (legal adicional).

import { detectarCampos } from '../campos.js'

const htmlDe = bloque => bloque.htmlEditado ?? bloque.html ?? ''

export function construirFichas(resultado) {
  const fichas = []
  const img = resultado.imgPrincipal
  if (img?.activo && img.src) {
    fichas.push({ id: 'hdr', tipo: 'imagen', bloque: 'Header', src: img.src, alt: img.alt ?? '' })
  }
  ;(resultado.canvas ?? []).forEach((bloque, b) => {
    const campos = detectarCampos(htmlDe(bloque))
    let t = 0, l = 0, i = 0
    for (const c of campos) {
      if (c.tipo === 'texto') {
        const contenido = String(c.contenido ?? '').trim()
        if (!contenido) { t++; continue }
        fichas.push({ id: `b${b}.t${t++}`, tipo: 'texto', bloque: bloque.nombre, contenido, _campo: c, _b: b })
      } else if (c.tipo === 'link') {
        fichas.push({ id: `b${b}.l${l++}`, tipo: 'link', bloque: bloque.nombre, valor: c.valor, _campo: c, _b: b })
      } else if (c.tipo === 'imagen') {
        fichas.push({ id: `b${b}.i${i++}`, tipo: 'imagen', bloque: bloque.nombre, src: c.src, alt: c.alt ?? '', _campo: c, _b: b })
      }
    }
  })
  ;(resultado.legalesAdicionales ?? []).forEach((leg, n) => {
    fichas.push({ id: `legal.${n}`, tipo: 'legal', bloque: 'Legal', largo: String(leg.texto ?? '').length })
  })
  return fichas
}

// Versión que viaja a la IA: sin referencias internas.
export function fichasParaIa(fichas) {
  return fichas.map(f => Object.fromEntries(Object.entries(f).filter(([k]) => !k.startsWith('_'))))
}
