// Puntaje "X de 7". Misma fórmula que la pantalla de Revisión de emails de
// TeamWorkHub (RevisionEmail.jsx): suman al puntaje las pruebas OK y las que
// solo tienen advertencia; es error lo que no está OK ni es advertencia.

export const PRUEBAS = [
  { clave: 'estructuraHTML', numero: '01', titulo: 'Estructura HTML' },
  { clave: 'clasesCSS', numero: '02', titulo: 'Clases utilizadas en el HTML' },
  { clave: 'links', numero: '03', titulo: 'Links' },
  { clave: 'altImagenes', numero: '04', titulo: 'Alt de imágenes' },
  { clave: 'dimensiones', numero: '05', titulo: 'Dimensiones de imágenes' },
  { clave: 'pesoImagenes', numero: '06', titulo: 'Peso de imágenes' },
  { clave: 'pesoHTML', numero: '07', titulo: 'Peso del HTML' },
]

export const CLAVES_PRUEBAS = PRUEBAS.map(p => p.clave)

export function calcularPuntaje(resultados) {
  const todos = CLAVES_PRUEBAS.map(k => resultados?.[k]).filter(Boolean)
  const okN = todos.filter(b => b.ok).length
  const warnN = todos.filter(b => !b.ok && b.advertencia).length
  const errN = todos.filter(b => !b.ok && !b.advertencia).length
  // Contador extra: avisos menores de Links (ej: falta target="_blank") y de
  // Dimensiones, que no cambian el estado de la prueba.
  const detalleMenorN = (resultados?.links?.advertencias?.length ?? 0)
    + (resultados?.dimensiones?.advertencias?.length ?? 0)
  return { okN, warnN, errN, detalleMenorN, score: okN + warnN, total: CLAVES_PRUEBAS.length }
}
