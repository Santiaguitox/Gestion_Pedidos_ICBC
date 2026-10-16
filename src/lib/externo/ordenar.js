// Indenta el HTML de la pieza para leerlo cómodo en un editor de código.
//
// Es conservador a propósito: en un email, un espacio de más entre elementos
// en línea (<a>, <img>, texto) puede abrir huecos o correr cosas en Outlook.
// Por eso SOLO se agregan saltos de línea y tabs pegados a las etiquetas
// estructurales (tablas, celdas, divs). Lo que está adentro de un texto o
// entre etiquetas en línea queda byte a byte igual, igual que los comentarios,
// los <style> y los atributos. Lo único que cambia es espacio en blanco que el
// navegador ya ignora (entre celdas o al borde de un bloque).

import { TOKENS } from './recorte.js'

const ESTRUCTURALES = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'div', 'center'])

function partir(html) {
  const re = new RegExp(TOKENS.source, 'gi')
  const piezas = []
  let ultimo = 0
  let m
  while ((m = re.exec(html)) !== null) {
    if (m.index > ultimo) piezas.push({ tipo: 'texto', texto: html.slice(ultimo, m.index) })
    const crudo = m[0]
    if (m[3] !== undefined) {
      const nombre = m[3].toLowerCase()
      piezas.push({
        tipo: 'tag',
        texto: crudo,
        nombre,
        cierre: m[2] === '/',
        autocierre: /\/\s*$/.test(m[4] ?? ''),
        estructural: ESTRUCTURALES.has(nombre),
      })
    } else {
      piezas.push({ tipo: 'bloque', texto: crudo }) // comentario, <style> o <script>
    }
    ultimo = m.index + crudo.length
  }
  if (ultimo < html.length) piezas.push({ tipo: 'texto', texto: html.slice(ultimo) })
  return piezas
}

// Dos formatos de salida, mismas reglas de seguridad:
//   ordenarHtml    → indentado (lectura en el editor)
//   minificarHtml  → sin saltos ni tabs entre etiquetas estructurales y con los
//                    <style> en una sola línea (lo más liviano que se puede
//                    lograr sin tocar el render)
export function ordenarHtml(htmlOriginal) {
  return formatear(htmlOriginal, true)
}

export function minificarHtml(htmlOriginal) {
  return formatear(htmlOriginal, false)
}

function formatear(htmlOriginal, indentar) {
  const html = String(htmlOriginal ?? '')
  const piezas = partir(html)
  let salida = ''
  let nivel = 0
  let previoEstructural = true // al inicio no hay nada que separar

  const tab = n => (indentar ? '\t'.repeat(Math.max(0, n)) : '')
  const salto = indentar ? '\n' : ''

  for (let i = 0; i < piezas.length; i++) {
    const p = piezas[i]

    if (p.tipo === 'tag' && p.estructural) {
      if (p.cierre) nivel = Math.max(0, nivel - 1)
      salida = salida.replace(/[ \t\r\n]+$/, '')
      salida += (salida ? salto : '') + tab(nivel) + p.texto
      if (!p.cierre && !p.autocierre) nivel++
      previoEstructural = true
      continue
    }

    if (p.tipo === 'texto') {
      // El blanco que queda pegado a una etiqueta estructural es ignorado por
      // el navegador: se descarta (el salto lo pone la etiqueta).
      let t = p.texto
      if (previoEstructural) t = t.replace(/^\s+/, '')
      const siguiente = piezas[i + 1]
      if (siguiente?.tipo === 'tag' && siguiente.estructural) t = t.replace(/\s+$/, '')
      if (t === '') continue
      if (previoEstructural && salida) salida += salto + tab(nivel)
      salida += t
      previoEstructural = false
      continue
    }

    // Etiqueta en línea o bloque (comentario/style/script): queda tal cual.
    // Si viene justo después de una etiqueta estructural arranca en línea nueva
    // indentada, para que no quede pegada.
    if (previoEstructural && salida) salida += salto + tab(nivel)
    // Minificado: los bloques <style> pierden los saltos y tabs repetidos
    salida += !indentar && /^<style\b/i.test(p.texto) ? p.texto.replace(/\s+/g, ' ') : p.texto
    previoEstructural = false
  }
  return indentar ? salida.trim() + '\n' : salida.trim()
}
