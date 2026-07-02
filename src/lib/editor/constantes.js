// Constantes compartidas del Editor de Piezas — temas visuales,
// legal fijo, firma institucional, colores por prefijo de header y
// data de redes sociales. Sin dependencias (hoja del grafo de libs).

// ─── Temas de template — ICBC (fondo blanco), Avisos (fondo beige,
// comunicaciones especiales tipo regulaciones bancarias), Mall (fondo
// negro, ofertas de ICBC Mall). La ESTRUCTURA del email es la misma
// en los 3 — header, imagen principal, contenido por bloques, footer
// con legales — lo que cambia, confirmado contra HTML reales de
// Avisos y Mall:
//  - bgContenido: el fondo del bloque de contenido (antes siempre
//    #ffffff fijo).
//  - colorTexto: el color base del texto dentro de cada bloque de
//    contenido (cada bloque trae #333333 hardcodeado en su propio
//    HTML, no heredado — por eso aplicarColorTexto lo reemplaza al
//    vuelo al exportar, no al cargar el bloque).
//  - conBorde: si la tabla principal de 600px lleva el borde rojo de
//    1px — ICBC y Mall sí, Avisos NO (confirmado: el HTML real de
//    Avisos no tiene ningún border en esa tabla).
// El fondo de la página detrás del email (#ffffff exterior) y el
// fondo del bloque de footer/legales (#ffffff) NO cambian en ningún
// tema — en los 2 ejemplos reales (Avisos y Mall) ambos siguen siendo
// blancos siempre, solo el contenido del medio cambia.
export const TEMAS = {
  icbc:   { label: 'ICBC',   bgContenido: '#ffffff', colorTexto: '#333333', conBorde: true,  colorSwatch: '#D0111B' },
  avisos: { label: 'Avisos', bgContenido: '#dcd2c9', colorTexto: '#333333', conBorde: false, colorSwatch: '#dcd2c9' },
  mall:   { label: 'Mall',   bgContenido: '#2e2f31', colorTexto: '#ffffff', conBorde: true,  colorSwatch: '#2e2f31' },
}
export const TEMA_DEFAULT = 'icbc'


export const LEGAL_FIJO_HTML = `El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a 6 meses, salvo que acredite un interés legítimo al efecto conforme lo establecido en el art. 14 inc. 3 de la ley 25.326. La agencia de acceso a la información pública, en su carácter de órgano de control de la ley 25.326 tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales. Para contactar a la misma: Av. Pte. Gral. Julio A. Roca 710, piso 2 - C1067ABP – CABA / Tel.: +54 (11) 3988-3968 <a style="color: #333333; text-decoration: underline;" target="_blank" href="https://www.argentina.gob.ar/aaip/datospersonales">https://www.argentina.gob.ar/aaip/datospersonales</a> - <a style="color: #333333; text-decoration: underline;" target="_blank" href="mailto:datospersonales@aaip.gob.ar">datospersonales@aaip.gob.ar</a>. Nuestra política de envío de correo electrónico no incluye la solicitud de ningún tipo de información por este medio de comunicación, es por tal motivo que, ante la llegada de una comunicación que le parezca no habitual, le recomendamos no responder ni ingresar en el mismo datos personales y/o claves de acceso y/o información de sus productos, por favor, háganos llegar la misma a la siguiente dirección de correo: <a style="color: #333333; text-decoration: underline;" target="_blank" href="mailto:seguridadinternet@icbc.com.ar">seguridadinternet@icbc.com.ar</a> o contáctenos al 0810-555-9200 de lunes a viernes de 8 a 20 horas o, sábados, domingos y feriados de 10 a 18 horas, o bien desde el exterior, al (54-11) 4820-9200. Los links adjuntos en esta pieza remiten únicamente a páginas de publicidad. Industrial and Commercial Bank of China (Argentina) S.A.U. es una Sociedad Anónima Unipersonal bajo la Ley Argentina. Su accionista limita su responsabilidad al capital aportado. Florida 99, CABA, CUIT 30709447846.`


// Firma institucional (ICBC Investments / Sociedad Gerente-Depositaria)
// — sección fija opcional, vista en piezas de Fondos Comunes de
// Inversión (FCI): dos filas de 2 columnas cada una (izquierda/
// derecha, mismo <td class="Texto_Legales"> que el resto de legales
// pero CADA texto en su propia celda corta, no en un párrafo largo
// corrido). Antes de este fix, el importador heurístico/con marcador
// no distinguía estos <td> de los legales adicionales reales —
// terminaba creando 4 "legales adicionales" sueltos y activando el
// modo "separados" por error (ver comentario junto a
// FIRMA_INSTITUCIONAL_REGEX). Valores por defecto = los textos reales
// vistos en la pieza que motivó este fix; el usuario puede editarlos
// si el texto institucional cambia en el futuro, pero la estructura
// (2 filas fijas, 2 columnas cada una) no es editable por diseño —no
// es una lista abierta como Legales adicionales o Indicadores.
export const FIRMA_INSTITUCIONAL_DEFAULT = {
  fila1Izq: 'ICBC Investments SAU SGFCI',
  fila1Der: 'Industrial and Commercial Bank of China (Argentina) SAU',
  fila2Izq: 'Sociedad Gerente',
  fila2Der: 'Sociedad Depositaria',
}


// El color "de marca" de una banda de Header depende del PREFIJO del
// nombre de archivo, no de un valor fijo — confirmado por la
// convención real: CG_* (Comercial Generalista) es rojo de marca,
// EB_* (Exclusive Banking) es negro, PAY_* (Payroll/Sueldos) es el
// marrón institucional de esa línea (#635843). Si en el futuro se
// suma un prefijo nuevo, cae al rojo de marca por default en vez de
// romper o quedar sin color. Se usa tanto para el thumb de la
// biblioteca (generarThumbSVG) como para el borde de la pieza en el
// export (generarExport, ver conBorde) — una sola fuente de verdad,
// para que cambiar el color de un prefijo no requiera tocar dos
// lugares por separado y arriesgar que se desincronicen.
export function colorPorPrefijoHeader(slug) {
  const slugUpper = (slug || '').toUpperCase()
  if (slugUpper.startsWith('EB_')) return '#000000'
  if (slugUpper.startsWith('PAY_')) return '#635843'
  return '#c4161c' // CG_* y cualquier otro prefijo no reconocido
}


// Data de cada red social del header — key (para los marcadores
// data-red que escribe reordenarRedesSociales), dominio (para la
// detección sobre HTML crudo de template) y label (UI). Los
// COMPONENTES de ícono de cada red viven en EditorPiezas.jsx
// (REDES_ICONOS) — son la única parte de esto que necesita React,
// por eso la data se separa acá y el ícono se resuelve por key del
// lado del componente.
export const REDES_SOCIALES = [
  { key: 'twitter',   dominio: 'twitter.com',   label: 'Twitter' },
  { key: 'facebook',  dominio: 'facebook.com',  label: 'Facebook' },
  { key: 'instagram', dominio: 'instagram.com', label: 'Instagram' },
  { key: 'linkedin',  dominio: 'linkedin.com',  label: 'LinkedIn' },
]
