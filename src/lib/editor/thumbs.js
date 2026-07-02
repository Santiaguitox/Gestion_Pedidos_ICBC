// Miniaturas SVG descriptivas para la biblioteca de bloques.

import { colorPorPrefijoHeader } from './constantes.js'

// ─── Miniatura visual para la biblioteca ───────────────────────────────────
// En lugar de renderizar el HTML complejo (que se ve raro a tamaño miniatura),
// generamos una miniatura SVG descriptiva basada en el nombre y categoría del bloque.

export function generarThumbSVG(bloque) {
  const colores = {
    Header: { bg: colorPorPrefijoHeader(bloque.slug), fg: '#ffffff', accent: '#ffffff' },
    Contenido: { bg: '#f5f5f5', fg: '#333333', accent: '#c4161c' },
    Botones: { bg: '#f5f5f5', fg: '#333333', accent: '#c4161c' },
  }
  const { bg, fg, accent } = colores[bloque.categoria] || colores.Contenido

  const esBoton = /btn|boton|button/i.test(bloque.nombre)
  const esBullet = /bullet/i.test(bloque.nombre)
  const esEspaciador = /espaciador|space/i.test(bloque.nombre)
  const esIcono = /icono|icon/i.test(bloque.nombre)

  // Sin inicializador a propósito: la cadena if/else de abajo cubre
  // todos los casos (tiene else final), así que un valor inicial acá
  // sería código muerto.
  let contenido

  // Cualquier banda de Header usa el MISMO thumb (4 círculos blancos
  // simulando los íconos de redes + 2 líneas simulando el logo/firma)
  // — antes solo CG_Banda_Roja_Header lo tenía, y los demás headers
  // (Mall, Comex, y los nuevos Pay/EB) caían al genérico de 4 barras
  // grises sin sentido, ya que las 3 (ahora 5) bandas de header
  // comparten exactamente la misma estructura visual, solo cambia el
  // color de fondo (ya resuelto arriba con bgHeaderPorPrefijo).
  if (bloque.categoria === 'Header') {
    contenido = `
      <circle cx="30" cy="40" r="9" fill="white" opacity="0.9"/>
      <circle cx="55" cy="40" r="9" fill="white" opacity="0.9"/>
      <circle cx="80" cy="40" r="9" fill="white" opacity="0.9"/>
      <circle cx="105" cy="40" r="9" fill="white" opacity="0.9"/>
      <rect x="140" y="30" width="50" height="8" rx="2" fill="white" opacity="0.7"/>
      <rect x="140" y="44" width="35" height="6" rx="2" fill="white" opacity="0.4"/>`
  } else if (bloque.slug === 'Modulo_Doble_Con_Imagen_Punteada') {
    contenido = `
      <rect x="10" y="10" width="85" height="60" rx="2" fill="${accent}" opacity="0.85"/>
      <rect x="105" y="10" width="85" height="60" rx="2" fill="${accent}" opacity="0.65"/>
      <line x1="100" y1="10" x2="100" y2="70" stroke="#333333" stroke-width="2" stroke-dasharray="4,3"/>`
  } else if (bloque.slug === 'Modulo_Doble_Clasico') {
    // Mismo concepto que el Punteada (2 módulos lado a lado) pero SIN
    // la línea divisoria — el bloque real no tiene ningún separador
    // entre las dos imágenes, son dos <td> al 50% sin más.
    contenido = `
      <rect x="10" y="10" width="85" height="60" rx="2" fill="${accent}" opacity="0.85"/>
      <rect x="105" y="10" width="85" height="60" rx="2" fill="${accent}" opacity="0.85"/>`
  } else if (bloque.slug === 'CG_Modulo_Simple_Editable_PF') {
    // 2 cajas con BORDE rojo y fondo rojo (no imágenes sólidas como
    // Modulo_Doble_Clasico) — distingue visualmente el patrón de
    // "tasa/dato numérico destacado en caja", separadas por un punto
    // vertical, igual al bloque real (tasa nominal anual + porcentaje).
    contenido = `
      <rect x="15" y="8" width="75" height="64" rx="2" fill="none" stroke="#c4161c" stroke-width="3"/>
      <rect x="22" y="30" width="61" height="6" rx="2" fill="#ffffff" opacity="0.9"/>
      <circle cx="100" cy="40" r="2" fill="${accent}" opacity="0.6"/>
      <rect x="110" y="8" width="75" height="64" rx="2" fill="none" stroke="#c4161c" stroke-width="3"/>
      <text x="147" y="48" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="bold" font-family="Arial">%</text>`
  } else if (bloque.slug === 'Destacado_Topes_Promo') {
    contenido = `
      <rect x="10" y="10" width="180" height="60" rx="3" fill="none" stroke="#c4161c" stroke-width="2"/>
      <rect x="20" y="22" width="120" height="8" rx="2" fill="${fg}" opacity="0.5"/>
      <rect x="20" y="36" width="100" height="6" rx="2" fill="${fg}" opacity="0.3"/>
      <rect x="20" y="48" width="80" height="6" rx="2" fill="#c4161c" opacity="0.5"/>`
  } else if (bloque.slug === 'Destacado_GiftCard_BigBox') {
    // Imagen a la izq, texto a la der, todo con borde rojo — invertido al Topes_Promo
    contenido = `
      <rect x="10" y="10" width="180" height="60" rx="3" fill="none" stroke="#c4161c" stroke-width="2"/>
      <rect x="18" y="18" width="55" height="44" rx="2" fill="#c4161c" opacity="0.2"/>
      <rect x="82" y="22" width="100" height="8" rx="2" fill="${fg}" opacity="0.5"/>
      <rect x="82" y="36" width="80" height="6" rx="2" fill="${fg}" opacity="0.3"/>
      <rect x="82" y="48" width="60" height="6" rx="2" fill="#c4161c" opacity="0.5"/>`
  } else if (esEspaciador) {
    contenido = `<line x1="10" y1="40" x2="190" y2="40" stroke="${accent}" stroke-width="2" stroke-dasharray="4,3"/><text x="100" y="55" text-anchor="middle" fill="${fg}" font-size="10" font-family="Arial">ESPACIADOR</text>`
  } else if (esBoton) {
    contenido = `<rect x="50" y="25" width="100" height="28" rx="4" fill="${accent}"/><text x="100" y="44" text-anchor="middle" fill="#fff" font-size="11" font-family="Arial" font-weight="bold">BOTÓN</text>`
  } else if (esBullet) {
    const color = /rojo|red/i.test(bloque.nombre) ? '#c4161c' : '#333333'
    contenido = `
      <circle cx="20" cy="28" r="4" fill="${color}"/>
      <rect x="32" y="24" width="120" height="8" rx="2" fill="${fg}" opacity="0.3"/>
      <circle cx="20" cy="45" r="4" fill="${color}"/>
      <rect x="32" y="41" width="100" height="8" rx="2" fill="${fg}" opacity="0.3"/>
      <circle cx="20" cy="62" r="4" fill="${color}"/>
      <rect x="32" y="58" width="110" height="8" rx="2" fill="${fg}" opacity="0.3"/>`
  } else if (esIcono) {
    contenido = `
      <rect x="10" y="20" width="40" height="40" rx="4" fill="${accent}" opacity="0.2"/>
      <rect x="60" y="25" width="130" height="8" rx="2" fill="${fg}" opacity="0.4"/>
      <rect x="60" y="40" width="100" height="6" rx="2" fill="${fg}" opacity="0.25"/>
      <rect x="60" y="53" width="115" height="6" rx="2" fill="${fg}" opacity="0.25"/>`
  } else if (bloque.slug === 'Imagen_Libre') {
    // Marco con ícono de "foto" clásico (montaña + sol) — distingue
    // visualmente este bloque del genérico de "líneas de texto", ya
    // que es un bloque de SOLO imagen, sin ningún campo de texto.
    contenido = `
      <rect x="20" y="12" width="160" height="56" rx="3" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5"/>
      <circle cx="60" cy="32" r="7" fill="${accent}" opacity="0.4"/>
      <path d="M30 60 L70 35 L95 50 L130 25 L170 60 Z" fill="${accent}" opacity="0.25"/>`
  } else {
    contenido = `
      <rect x="10" y="18" width="180" height="8" rx="2" fill="${fg}" opacity="0.4"/>
      <rect x="10" y="32" width="160" height="6" rx="2" fill="${fg}" opacity="0.25"/>
      <rect x="10" y="44" width="170" height="6" rx="2" fill="${fg}" opacity="0.25"/>
      <rect x="10" y="56" width="120" height="6" rx="2" fill="${fg}" opacity="0.25"/>`
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><rect width="200" height="80" fill="${bg}"/>${contenido}</svg>`)}`
}
