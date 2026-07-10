// Severidad consolidada de un pedido — el "peor" resultado entre sus
// piezas (revisión de pruebas) o sus bases (revisión de envíos), para
// los badges de la vista compacta. Mudado desde PedidoCard.jsx (ver
// nota en src/lib/avatares.js).

// El peor resultado de revisión entre todas las piezas de un pedido —
// usado en la vista COMPACTA, que no tiene espacio para mostrar cada
// pieza por separado (eso sí pasa en EntregablesCard, usado en la
// vista FULL). Prioridad: error > advertencia > ok — si CUALQUIER
// pieza tiene un error, el badge consolidado lo muestra, aunque el
// resto esté perfecto, para no esconder un problema real detrás de
// piezas que sí pasaron bien.
const ORDEN_SEVERIDAD = { error: 0, advertencia: 1, ok: 2 }

export function peorRevisionDePedido(entregables) {
  const conRevision = (entregables ?? []).filter(e => e.revision_pruebas_total != null)
  if (conRevision.length === 0) return null
  return conRevision.reduce((peor, e) =>
    ORDEN_SEVERIDAD[e.revision_severidad] < ORDEN_SEVERIDAD[peor.revision_severidad] ? e : peor
  )
}

// Mismo patrón que peorRevisionDePedido, pero para Revisión de envíos
// (compatibilidad base↔pieza, ver BaseDatosSection.jsx) — el peor
// resultado entre todas las bases cargadas en el pedido. Jerarquía:
// 'miss' (campos realmente faltantes, problema de compatibilidad real)
// > 'error_proxy' (no se pudo verificar, falla técnica, no implica que
// esté mal) > 'ok'. Bases sin resultado_tipo (nunca verificadas) se
// ignoran acá — no hay nada que mostrar todavía, no es lo mismo que un
// error.
const ORDEN_SEVERIDAD_BASE = { miss: 0, error_proxy: 1, ok: 2 }

export function peorBaseDePedido(pedidoBase) {
  const conResultado = (pedidoBase ?? []).filter(b => b.resultado_tipo != null)
  if (conResultado.length === 0) return null
  return conResultado.reduce((peor, b) =>
    ORDEN_SEVERIDAD_BASE[b.resultado_tipo] < ORDEN_SEVERIDAD_BASE[peor.resultado_tipo] ? b : peor
  )
}

