// Orquestador: referencia → fichas → IA → operaciones validadas.
// La llamada a la IA se inyecta (`llamarIa`) para poder testear sin red.

import { importarReferencia } from './referencia.js'
import { construirFichas, fichasParaIa } from './fichas.js'
import { aplicarOperaciones } from './aplicar.js'
import { pedidoSinLegal } from './secciones.js'

export async function interpretarPedido({ pedido, referenciaHtml, llamarIa }) {
  if (!String(pedido ?? '').trim()) return { error: 'Pegá el texto del pedido.' }
  const importado = importarReferencia(referenciaHtml)
  if (!importado.resultado) return { error: 'No pude importar la pieza de referencia. Probá importándola en la pestaña HTML para ver el detalle.' }

  const fichas = construirFichas(importado.resultado)
  let respuesta
  try {
    respuesta = await llamarIa({ pedido: pedidoSinLegal(pedido), fichas: fichasParaIa(fichas) })
  } catch (e) {
    return { error: e?.message || 'La IA no está disponible.' }
  }
  if (respuesta?.no_verificable) return { error: respuesta.mensaje || 'La IA no pudo interpretar el pedido.', razon: respuesta.razon }

  const aplicado = aplicarOperaciones({
    resultado: importado.resultado,
    fichas,
    operaciones: respuesta?.operaciones ?? [],
    dudasIa: respuesta?.dudas ?? [],
    pedido,
  })
  return { ...aplicado, avisosImportacion: importado.avisos ?? [], confianzaImportacion: importado.confianza }
}
