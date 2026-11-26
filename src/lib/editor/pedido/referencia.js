// Importa la pieza de referencia con el importador determinístico del
// editor. Misma normalización que usa analizarImportacion (EditorPiezas.jsx):
// atributos con comillas simples, > o < sueltos dentro de atributos y dominio
// del repositorio viejo.

import { importarDesdeHtml, importarHeuristico } from '../importar.js'

export function normalizarHtmlReferencia(html) {
  return String(html ?? '')
    .replace(/([a-zA-Z-]+)=(['"])([^'"]*)\2/g, (_m, attr, q, val) =>
      `${attr}=${q}${val.replace(/>/g, '&gt;').replace(/</g, '&lt;')}${q}`)
    .replace(/(\s[a-zA-Z-]+)='([^']*)'/g, (_m, attr, val) => `${attr}="${val}"`)
    .replace(/https?:\/\/icommktrepo\.s3\.amazonaws\.com\//gi, 'https://d343t93odde9ul.cloudfront.net/')
}

// → { resultado, avisos, confianza } o { resultado: null }
export function importarReferencia(html) {
  const normalizado = normalizarHtmlReferencia(html)
  const porMarcadores = importarDesdeHtml(normalizado)
  if (porMarcadores.resultado) return { ...porMarcadores, confianza: 'alta', viaMarcadores: true }
  return { ...importarHeuristico(normalizado), viaMarcadores: false }
}
