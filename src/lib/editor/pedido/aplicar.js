// Aplica las operaciones que devuelve la IA sobre el resultado del importador,
// con validación por código. La IA propone; acá se decide qué entra.
//
// Operaciones (todas citan el id de una ficha):
//   { id, op:'reemplazar', buscar, por }   texto: sustituye un fragmento
//   { id, op:'link', valor }               link: nueva URL
//   { id, op:'imagen', src }               imagen / header: nueva URL
// dudas de la IA: [{ texto, bloqueante? }]
//
// Reglas de validación:
//  - el id tiene que existir y ser del tipo correcto
//  - "buscar" aparece 1 a 3 veces en el texto actual
//  - números y URLs nuevos tienen que estar en el pedido (o ya estar en el
//    original): si no, se rechaza y pasa a duda (la IA no inventa datos)

import { actualizarCampoEnHtml } from '../campos.js'
import { colapsar, extraerLegal, compararConLegalFijo, linkPendiente } from './secciones.js'

const RE_URL = /https?:\/\/[^\s"'<>)]+/gi
const RE_NUM = /\d+(?:[.,]\d+)*/g

const normUrl = u => String(u ?? '').trim().replace(/[.,;]+$/, '')

function urlsDe(texto) { return (String(texto ?? '').match(RE_URL) ?? []).map(normUrl) }
function numerosDe(texto) { return String(texto ?? '').match(RE_NUM) ?? [] }

function ocurrencias(texto, fragmento) {
  if (!fragmento) return 0
  let n = 0, i = 0
  while ((i = texto.indexOf(fragmento, i)) !== -1) { n++; i += fragmento.length }
  return n
}

function sinGrounding(nuevo, original, pedido) {
  const base = `${pedido}\n${original}`
  const urls = urlsDe(nuevo).filter(u => !urlsDe(base).includes(u))
  const nums = numerosDe(nuevo).filter(n => !numerosDe(base).includes(n))
  return [...urls, ...nums]
}

const htmlDe = b => b.htmlEditado ?? b.html ?? ''

export function aplicarOperaciones({ resultado, fichas, operaciones = [], dudasIa = [], pedido }) {
  const canvas = resultado.canvas.map(b => ({ ...b }))
  let imgPrincipal = resultado.imgPrincipal ? { ...resultado.imgPrincipal } : resultado.imgPrincipal
  let legalesAdicionales = (resultado.legalesAdicionales ?? []).map(l => ({ ...l }))

  const cambios = []
  const dudas = dudasIa
    .filter(d => d && String(d.texto ?? '').trim())
    .map(d => ({ texto: String(d.texto).trim(), bloqueante: !!d.bloqueante, origen: 'ia' }))
  const rechazadas = []
  const porId = new Map(fichas.map(f => [f.id, f]))
  const rechazar = (op, motivo) => {
    rechazadas.push({ op, motivo })
    dudas.push({ texto: `No pude aplicar un cambio propuesto (${motivo}). Revisalo a mano.`, bloqueante: false, origen: 'validacion' })
  }
  const textoActual = new Map()

  for (const op of operaciones) {
    const f = porId.get(op?.id)
    if (!f) { rechazar(op, 'ficha inexistente'); continue }

    if (op.op === 'reemplazar') {
      if (f.tipo !== 'texto') { rechazar(op, 'no es un texto'); continue }
      const actual = textoActual.get(f.id) ?? f.contenido
      const buscar = String(op.buscar ?? '')
      const n = ocurrencias(actual, buscar)
      if (n < 1 || n > 3) { rechazar(op, n === 0 ? `no encontré "${buscar}"` : `"${buscar}" aparece ${n} veces`); continue }
      const por = String(op.por ?? '')
      const faltan = sinGrounding(por, actual, pedido)
      if (faltan.length) { rechazar(op, `${faltan.join(', ')} no figura en el pedido`); continue }
      const nuevo = actual.split(buscar).join(por)
      textoActual.set(f.id, nuevo)
      cambios.push({ id: f.id, tipo: 'texto', bloque: f.bloque, bloqueIdx: f._b, antes: f.contenido, despues: nuevo })
    } else if (op.op === 'link') {
      if (f.tipo !== 'link') { rechazar(op, 'no es un link'); continue }
      const valor = normUrl(op.valor)
      if (!urlsDe(pedido).includes(valor)) { rechazar(op, 'el link no figura en el pedido'); continue }
      cambios.push({ id: f.id, tipo: 'link', bloque: f.bloque, bloqueIdx: f._b, antes: f.valor, despues: valor })
    } else if (op.op === 'imagen') {
      if (f.tipo !== 'imagen') { rechazar(op, 'no es una imagen'); continue }
      const src = normUrl(op.src)
      if (!urlsDe(pedido).includes(src)) { rechazar(op, 'la imagen no figura en el pedido'); continue }
      cambios.push({ id: f.id, tipo: 'imagen', bloque: f.bloque, bloqueIdx: f._b, antes: f.src, despues: src })
    } else {
      rechazar(op, 'operación desconocida')
    }
  }

  // Un solo cambio por ficha: si hubo varios reemplazos sobre el mismo texto
  // ya quedaron encadenados en textoActual; se deja el último con el "antes" original.
  const ultimos = new Map()
  for (const c of cambios) ultimos.set(`${c.id}|${c.tipo}`, c)
  const finales = [...ultimos.values()]

  // Aplicar al canvas / header
  for (const c of finales) {
    if (c.id === 'hdr') {
      imgPrincipal = { ...imgPrincipal, src: c.despues }
      continue
    }
    const f = porId.get(c.id)
    const b = canvas[f._b]
    const campo = f._campo
    let html = htmlDe(b)
    if (c.tipo === 'texto') html = actualizarCampoEnHtml(html, 'texto', campo.posicionOrden, { contenido: c.despues }, campo.posicionReal)
    else if (c.tipo === 'link') html = actualizarCampoEnHtml(html, 'link', campo.idx, { valor: c.despues })
    else html = actualizarCampoEnHtml(html, 'imagen', campo.posicionReal, { src: c.despues })
    canvas[f._b] = { ...b, htmlEditado: html }
  }

  // Legal: lo carga el código, literal.
  const legal = extraerLegal(pedido)
  if (legal?.especifico) {
    const antes = legalesAdicionales.map(l => l.texto).join('\n')
    if (colapsar(antes) !== legal.especifico) {
      const id = legalesAdicionales[0]?.id ?? 'legal-pedido'
      legalesAdicionales = [{ id, texto: legal.especifico }, ...legalesAdicionales.slice(1)]
      finales.push({ id: 'legal.0', tipo: 'legal', bloque: 'Legal', antes, despues: legal.especifico })
    }
    const dif = compararConLegalFijo(legal.tramoFijo)
    if (dif) {
      dudas.push({
        texto: `El legal del pedido difiere del legal fijo del editor (que no se puede editar) en: "${dif.frases.join('" / "').slice(0, 300)}". Confirmá con el cliente.`,
        bloqueante: false, origen: 'legal',
      })
    }
  }

  // Link pendiente: si el pedido lo declara pendiente, ningún link heredado de
  // la referencia es confiable.
  const hayCambioDeLink = finales.some(c => c.tipo === 'link')
  const heredados = fichas.filter(f => f.tipo === 'link' && /^https?:/i.test(f.valor ?? ''))
  if (linkPendiente(pedido) && !hayCambioDeLink && heredados.length) {
    dudas.unshift({
      texto: `El pedido dice que el link está pendiente, pero la pieza conserva links de la referencia (${heredados.map(f => f.valor).slice(0, 3).join(', ')}). Puede quedar apuntando a un evento viejo.`,
      bloqueante: true, origen: 'link-pendiente',
    })
  }

  return {
    resultado: { ...resultado, canvas, imgPrincipal, legalesAdicionales },
    cambios: finales,
    dudas,
    rechazadas,
  }
}
