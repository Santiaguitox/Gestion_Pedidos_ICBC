// Formato de números para la UI (es-AR: coma decimal, punto de miles).
// Hecho a mano para no depender de los datos de idioma del entorno.

function conComa(n, decimales) {
  const [entera, dec] = n.toFixed(decimales).split('.')
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec && Number(dec) !== 0 ? `${miles},${dec}` : miles
}

export function formatoNumero(n) {
  return conComa(Number(n) || 0, 0)
}

// Por debajo de 1 MB se muestra en kb; desde 1 MB, en MB.
// partesPeso separa valor y unidad (la UI los estiliza distinto).
export function partesPeso(bytes) {
  const b = Number(bytes) || 0
  if (b < 1024 * 1024) return { valor: conComa(b / 1024, 1), unidad: 'kb' }
  return { valor: conComa(b / (1024 * 1024), 2), unidad: 'MB' }
}

export function formatoPeso(bytes) {
  const { valor, unidad } = partesPeso(bytes)
  return `${valor} ${unidad}`
}

export function formatoKb(kb) {
  return `${conComa(Number(kb) || 0, 1)} kb`
}
