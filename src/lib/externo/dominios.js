// Resumen de los dominios en los que están alojadas las imágenes de una pieza.
//
// Es informativo (no suma ni resta al puntaje). Una fila por dominio con la
// cantidad de imágenes (<img>), el peso total y el protocolo, más avisos
// para lo que puede dar problemas en los clientes de correo:
//   - http://      → contenido mixto, algunos clientes lo bloquean
//   - data:        → imagen embebida en el HTML, Gmail y otros no la muestran
//   - src con variable de personalización (<*prod1_img_url*>): imagen dinámica,
//     la URL sale de la base de cada envío; se cuenta aparte y no es un aviso
//   - ruta relativa o sin protocolo → no se ve fuera del servidor de la pieza
//   - imágenes que no se pudieron medir (el peso del dominio queda incompleto)
//
// El peso se suma por aparición de cada <img>, igual que el chequeo "Peso de
// imágenes", para que los dos números coincidan.

import { nombreImagen } from './helpers.js'
import { encontrarVariables } from './variables.js'

// Textos de cada tipo de aviso. Se arman en singular (una imagen) o plural.
// Los avisos se agrupan por tipo: el mensaje aparece una sola vez y debajo
// van los nombres de las imágenes afectadas.
const TEXTOS = {
  http: {
    uno: 'usa un protocolo sin cifrar (http).',
    varios: 'usan un protocolo sin cifrar (http).',
    detalleUno: 'Clientes como Gmail suelen bloquear este tipo de imágenes. Podría generar problemas de visualización en la comunicación. Subir la imagen a un servidor cifrado (https) solucionaría el inconveniente.',
    detalleVarios: 'Clientes como Gmail suelen bloquear este tipo de imágenes. Podría generar problemas de visualización en la comunicación. Subir las imágenes a un servidor cifrado (https) solucionaría el inconveniente.',
  },
  sinProtocolo: {
    uno: 'no indica http:// ni https://.',
    varios: 'no indican http:// ni https://.',
    detalleUno: 'Algunos clientes de correo no la cargan.',
    detalleVarios: 'Algunos clientes de correo no las cargan.',
  },
  data: {
    uno: 'está embebida en el HTML.',
    varios: 'están embebidas en el HTML.',
    detalleUno: 'Muchos clientes de correo no la muestran.',
    detalleVarios: 'Muchos clientes de correo no las muestran.',
  },
  relativa: {
    uno: 'usa una ruta relativa.',
    varios: 'usan una ruta relativa.',
    detalleUno: 'No se va a ver fuera del servidor de la pieza.',
    detalleVarios: 'No se van a ver fuera del servidor de la pieza.',
  },
  otroEsquema: {
    uno: 'usa un protocolo que muchos clientes de correo no cargan.',
    varios: 'usan un protocolo que muchos clientes de correo no cargan.',
    detalleUno: '',
    detalleVarios: '',
  },
  sinMedir: {
    uno: 'no se pudo medir.',
    varios: 'no se pudieron medir.',
    detalleUno: 'Su peso y medidas no están incluidos.',
    detalleVarios: 'Su peso y medidas no están incluidos.',
  },
}

// Orden en que se muestran los grupos.
const ORDEN_AVISOS = ['http', 'sinProtocolo', 'data', 'relativa', 'otroEsquema', 'sinMedir']

function armarAvisos(grupos) {
  return ORDEN_AVISOS.flatMap(tipo => {
    const g = grupos.get(tipo)
    if (!g) return []
    const t = TEXTOS[tipo]
    const uno = g.nombres.length === 1
    const esquemas = tipo === 'otroEsquema' ? [...g.esquemas].map(e => `${e}:`).join(', ') : ''
    return [{
      tipo,
      nombres: g.nombres,
      predicado: uno ? t.uno : t.varios,
      detalle: (uno ? t.detalleUno : t.detalleVarios) || (esquemas ? `Protocolo: ${esquemas}` : ''),
    }]
  })
}

function clasificar(src) {
  const s = src.trim()
  if (/^data:/i.test(s)) return { tipo: 'data' }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      return { tipo: 'web', host: u.hostname.toLowerCase(), protocolo: u.protocol === 'https:' ? 'https' : 'http' }
    } catch {
      return { tipo: 'relativa', motivo: 'invalida' }
    }
  }
  if (s.startsWith('//')) {
    try {
      const u = new URL('https:' + s)
      return { tipo: 'sinProtocolo', host: u.hostname.toLowerCase() }
    } catch {
      return { tipo: 'relativa', motivo: 'invalida' }
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return { tipo: 'otroEsquema', esquema: s.split(':')[0].toLowerCase() }
  return { tipo: 'relativa' }
}

// cacheDatos: { [src]: { peso, width, height, formato } } — lo que midió el proxy.
export function resumirDominios(doc, cacheDatos = {}) {
  const filas = new Map()
  const grupos = new Map()
  const avisados = new Set()
  let sinDominio = 0
  const dinamicas = []
  let total = 0

  // Un mismo src se avisa una sola vez por tipo, aunque aparezca en varios <img>.
  function avisar(clave, tipo, nombre, esquema) {
    if (avisados.has(clave)) return
    avisados.add(clave)
    let g = grupos.get(tipo)
    if (!g) {
      g = { nombres: [], esquemas: new Set() }
      grupos.set(tipo, g)
    }
    g.nombres.push(nombre)
    if (esquema) g.esquemas.add(esquema)
  }

  for (const img of doc.querySelectorAll('img')) {
    const src = (img.getAttribute('src') || '').trim()
    if (!src) continue
    total++
    // La URL (o parte de ella) la completa la base del envío: no hay nada que
    // medir ni que avisar. Se lista como dinámica.
    const vars = encontrarVariables(src)
    if (vars.length) {
      dinamicas.push({ variable: vars[0].nombre, src })
      continue
    }
    const info = clasificar(src)
    const nombre = nombreImagen(src)

    if (info.tipo === 'data') {
      sinDominio++
      avisar(`data:${src.slice(0, 80)}`, 'data', nombre)
      continue
    }
    if (info.tipo === 'relativa') {
      sinDominio++
      avisar(`rel:${src}`, 'relativa', nombre)
      continue
    }
    if (info.tipo === 'otroEsquema') {
      sinDominio++
      avisar(`esq:${src}`, 'otroEsquema', nombre, info.esquema)
      continue
    }

    // web (http/https) o sin protocolo (//host/...)
    const protocolo = info.tipo === 'sinProtocolo' ? 'sin protocolo' : info.protocolo
    let fila = filas.get(info.host)
    if (!fila) {
      fila = { host: info.host, cantidad: 0, pesoBytes: 0, medidas: 0, protocolos: new Set() }
      filas.set(info.host, fila)
    }
    fila.cantidad++
    fila.protocolos.add(protocolo)

    const datos = cacheDatos[src]
    if (datos && !datos.error && datos.peso) {
      fila.pesoBytes += datos.peso
      fila.medidas++
    } else {
      avisar(`medir:${src}`, 'sinMedir', nombre)
    }

    if (protocolo === 'http') avisar(`http:${src}`, 'http', nombre, 'usa un protocolo sin cifrar (http). Clientes como Gmail suelen bloquear este tipo de imágenes. Debería ser https.')
    if (protocolo === 'sin protocolo') avisar(`sp:${src}`, 'sinProtocolo', nombre)
  }

  const dominios = [...filas.values()]
    .map(f => ({
      host: f.host,
      cantidad: f.cantidad,
      pesoBytes: f.pesoBytes,
      medidas: f.medidas,
      protocolo: f.protocolos.size > 1 ? 'mixto' : [...f.protocolos][0],
    }))
    .sort((a, b) => b.cantidad - a.cantidad || a.host.localeCompare(b.host))

  return { dominios, avisos: armarAvisos(grupos), total, sinDominio, dinamicas }
}
