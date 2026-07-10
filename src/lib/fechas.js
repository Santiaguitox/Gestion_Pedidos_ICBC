import { startOfWeek, endOfWeek, addWeeks, differenceInDays } from 'date-fns'

// Lógica de fechas de pedidos, compartida entre pantallas. Vivía en
// Dashboard.jsx (que la exportaba, cosa que además rompía la regla
// react-refresh/only-export-components), pero la consumen también
// CargaTrabajoModal y Calendario — un util de dominio no pertenece a
// una página.
//
// ⚠️ CRITERIO ÚNICO DE "VENCIDO": un pedido que vence HOY todavía NO
// está vencido — está en juego durante todo el día, recién vence al
// empezar mañana. Antes cada pantalla decidía por su cuenta y no
// coincidían: Dashboard usaba `dias < 0` (correcto) pero Calendario
// usaba isPast(fecha_limite a las 00:00), que desde las 00:01 ya daba
// true — el mismo pedido figuraba "Hoy" en el Dashboard y "vencido" en
// el contador del Calendario. Cualquier pantalla nueva que necesite el
// concepto debe usar esVencido() de acá, nunca reimplementarlo.

// Parseo canónico de fecha_limite (columna date, string 'YYYY-MM-DD'):
// el sufijo T00:00:00 fuerza interpretación en hora LOCAL — sin él,
// new Date('2026-07-10') se interpreta como UTC y en Argentina (UTC-3)
// cae a las 21:00 del día ANTERIOR, corriendo todos los cálculos un día.
export function parseFechaLimite(fechaLimite) {
  return new Date(fechaLimite + 'T00:00:00')
}

export function esVencido(fechaLimite, hoy = new Date()) {
  if (!fechaLimite) return false
  // Se normaliza hoy a medianoche ACÁ ADENTRO (a diferencia de
  // calcularGrupo, que lo exige del llamador): así esVencido acepta un
  // new Date() crudo con hora y el resultado es diferencia de días de
  // calendario exacta, sin depender de que differenceInDays trunque
  // períodos parciales a favor.
  const h = new Date(hoy)
  h.setHours(0, 0, 0, 0)
  return differenceInDays(parseFechaLimite(fechaLimite), h) < 0
}

// Clasifica un pedido (ya activo, sin 'finalizado') en uno de los 7
// grupos semánticos, según su fecha_limite respecto a hoy.
//
// ⚠️ CONTRATO: `hoy` debe venir normalizado a medianoche
// (hoy.setHours(0,0,0,0)) — como ya hacen Dashboard y CargaTrabajoModal.
// Con un new Date() crudo, differenceInDays cuenta períodos de 24hs
// COMPLETOS: mañana a las 00:00 menos hoy a las 15:30 son 8,5 horas =
// 0 días, y un pedido de mañana caería en el grupo "hoy".
//
// El orden de
// evaluación es deliberado: Hoy/Mañana siempre "ganan" sobre la semana a
// la que pertenecen, incluso si caen sábado/domingo (ver discusión del
// 2026-06-20 en el spec).
export function calcularGrupo(pedido, hoy) {
  if (!pedido.fecha_limite) return 'sin_fecha'

  const fecha = parseFechaLimite(pedido.fecha_limite)
  const dias = differenceInDays(fecha, hoy)

  if (dias < 0) return 'vencidos'
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'

  const finEstaSemana = endOfWeek(hoy, { weekStartsOn: 1 })
  if (fecha <= finEstaSemana) return 'esta_semana'

  const inicioProxSemana = startOfWeek(addWeeks(hoy, 1), { weekStartsOn: 1 })
  const finProxSemana = endOfWeek(addWeeks(hoy, 1), { weekStartsOn: 1 })
  if (fecha >= inicioProxSemana && fecha <= finProxSemana) return 'proxima_semana'

  return 'mas_adelante'
}
