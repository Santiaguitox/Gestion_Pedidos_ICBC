// Diff campo a campo entre dos filas del mismo contacto, extraído de
// compare.worker.js para poder testearlo (el worker define
// self.onmessage al importarse). Es el corazón del comparador de
// bases: decide qué se reporta como "cambió" — un error acá es
// silencioso por definición (no tira excepción, solo da un resultado
// incorrecto).

export function diffRows(rowA, rowB, commonCols) {
  const fieldDiffs = []
  for (const col of commonCols) {
    const valA = (rowA[col] ?? '').trim()
    const valB = (rowB[col] ?? '').trim()
    if (valA !== valB) fieldDiffs.push({ col, valA, valB })
  }
  return fieldDiffs
}
