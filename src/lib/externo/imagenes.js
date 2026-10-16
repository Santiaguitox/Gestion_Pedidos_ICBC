// ============================================================================
// COPIA de src/lib/revision/imagenes.js (TeamWorkHub), hecha el 2026-10-14.
// Ver el encabezado de generales.js: es una copia independiente a propósito.
// Diferencias respecto del original (marcadas con "EXTERNO:"): nombres de
// imagen con nombreImagen() y números extra en ValidarPesoImagenes para la UI.
// ============================================================================
import { esImagenEstructural } from './imagenesEstructurales.js'
import { nombreImagen } from './helpers.js'

// EXTERNO: solo cuenta como medida el número en px (o sin unidad, que el
// navegador toma como px). "100%", "auto", "10em" no son una medida en píxeles:
// antes "100%" se leía como 100px y generaba inconsistencias falsas.
function parsearMedida(valor) {
  if (!valor) return null
  const m = String(valor).trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i)
  return m ? parseInt(m[1]) : null
}

// Extensión del nombre de archivo, ignorando querystring/hash
// (banner.jpg?v=3 → jpg). Solo para comparar contra el formato real.
function extensionDe(nombre) {
  const limpio = nombre.split('?')[0].split('#')[0]
  const punto = limpio.lastIndexOf('.')
  return punto === -1 ? null : limpio.slice(punto + 1).toLowerCase()
}

const FORMATO_DE_EXTENSION = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', gif: 'gif' }

function extraerMedidaStyle(style, propiedad) {
  if (!style) return null
  // EXTERNO: el lookbehind evita confundir width con max-width / min-width
  // (y height con line-height / max-height): son otras propiedades.
  const regex = new RegExp(`(?<![\\w-])${propiedad}\\s*:\\s*([\\d.]+)px(?![\\w%])`, 'i')
  const match = style.match(regex)
  return match ? parseInt(match[1]) : null
}

export async function ValidarDimensionesImagenes(doc, cacheDatos) {
  const imagenes = [...doc.querySelectorAll('img')]
  const problemas = []
  const advertencias = []
  // EXTERNO: ancho/alto distintos entre atributo y style = advertencia (no error)
  const inconsistencias = []
  // Dedupe del aviso de extensión: el mismo src puede aparecer en
  // varios <img> de la pieza y con avisar una vez alcanza.
  const srcConMismatch = new Set()
  const TOLERANCIA = 0.02

  for (let idx = 0; idx < imagenes.length; idx++) {
    const img = imagenes[idx]
    const src = img.getAttribute('src') || ''
    const nombre = nombreImagen(src) || 'imagen sin src' // EXTERNO: sin ?query ni data:
    const style = img.getAttribute('style') || ''

    const anchoAtrib = parsearMedida(img.getAttribute('width'))
    const altoAtrib = parsearMedida(img.getAttribute('height'))
    const anchoStyle = extraerMedidaStyle(style, 'width')
    const altoStyle = extraerMedidaStyle(style, 'height')

    if (anchoAtrib !== null && anchoStyle !== null && anchoAtrib !== anchoStyle) {
      inconsistencias.push({ nombre, detalle: `Ancho inconsistente — atributo: ${anchoAtrib}px, style: ${anchoStyle}px` })
    }
    if (altoAtrib !== null && altoStyle !== null && altoAtrib !== altoStyle) {
      inconsistencias.push({ nombre, detalle: `Alto inconsistente — atributo: ${altoAtrib}px, style: ${altoStyle}px` })
    }

    const anchoDec = anchoAtrib ?? anchoStyle
    const altoDec = altoAtrib ?? altoStyle

    const real = src ? (cacheDatos[src] || null) : null

    // Extensión que dice una cosa, bytes que dicen otra (típico PNG
    // renombrado a .jpg en el circuito de diseño). No es un error —
    // los clientes de correo miran los bytes, no el nombre, así que
    // se ve bien — pero un PNG fotográfico pesa bastante más que su
    // JPEG equivalente, vale la pena que quien revisa lo sepa. Fue
    // además la causa del bug de dimensiones basura (el proxy elegía
    // parser por content-type, que el server deriva de la extensión).
    if (real && !real.error && real.formato) {
      const ext = extensionDe(nombre)
      const formatoSegunExt = ext ? FORMATO_DE_EXTENSION[ext] : null
      if (formatoSegunExt && formatoSegunExt !== real.formato && !srcConMismatch.has(src)) {
        srcConMismatch.add(src)
        advertencias.push({
          detalle: `${nombre}: la extensión dice .${ext} pero el archivo es ${real.formato.toUpperCase()} — se ve bien igual, pero revisar el peso (un PNG fotográfico pesa más que su JPEG equivalente)`
        })
      }
    }

    if (anchoDec && altoDec && src) {
      if (real && !real.error) {
        const ratioReal = real.width / real.height
        const ratioDec = anchoDec / altoDec
        const diferencia = Math.abs(ratioReal - ratioDec) / ratioReal

        if (diferencia > TOLERANCIA) {
          // Separadores y líneas punteadas (ver lib/imagenesEstructurales):
          // se estiran a propósito al espacio necesario, la desproporción
          // no se ve — baja de error a "detalle menor" para revisar a lo
          // sumo. La inconsistencia atributo vs. style de más arriba
          // sigue siendo error también para estas imágenes: dos
          // declaraciones que se contradicen son un defecto del markup,
          // no una decisión de layout.
          if (esImagenEstructural(nombre) || esImagenEstructural(src)) {
            advertencias.push({
              detalle: `${nombre}: separador estructural estirado — imagen real: ${real.width}x${real.height}, declarado: ${anchoDec}x${altoDec} (esperado en separadores)`
            })
          } else {
            problemas.push({
              nombre,
              detalle: `Proporción incorrecta — imagen real: ${real.width}x${real.height}, declarado: ${anchoDec}x${altoDec}`
            })
          }
        }
      }
    }
  }

  // Mismo contrato que Links: la prueba falla como ERROR solo por problemas
  // de proporción; las advertencias viajan aparte y la UI las lista como
  // "Detalle menor". EXTERNO: si lo único que hay son inconsistencias entre
  // atributo y style, la prueba queda en ADVERTENCIA (amarillo).
  const plural = (n, uno, varios) => (n === 1 ? uno : varios)
  const detalleMenor = [
    ...advertencias,
    ...(problemas.length > 0 ? inconsistencias.map(i => ({ ...i, detalle: `${i.nombre}: ${i.detalle}` })) : []),
  ]

  if (problemas.length > 0) {
    return {
      ok: false,
      tipo: 'Dimensiones de imágenes',
      detalle: `${problemas.length} ${plural(problemas.length, 'problema encontrado', 'problemas encontrados')}${detalleMenor.length > 0 ? ` (+${detalleMenor.length} ${plural(detalleMenor.length, 'detalle menor', 'detalles menores')})` : ''}`,
      checks: problemas.map(p => ({ ok: false, detalle: `${p.nombre}: ${p.detalle}` })),
      advertencias: detalleMenor,
    }
  }

  if (inconsistencias.length > 0) {
    return {
      ok: false,
      advertencia: true,
      tipo: 'Dimensiones de imágenes',
      detalle: `${inconsistencias.length} ${plural(inconsistencias.length, 'medida inconsistente', 'medidas inconsistentes')} entre atributo y style${advertencias.length > 0 ? ` (+${advertencias.length} ${plural(advertencias.length, 'detalle menor', 'detalles menores')})` : ''}`,
      checks: inconsistencias.map(p => ({ ok: false, detalle: `${p.nombre}: ${p.detalle}` })),
      advertencias,
    }
  }

  if (advertencias.length > 0) {
    return {
      ok: true,
      tipo: 'Dimensiones de imágenes',
      detalle: `Proporciones correctas — ${advertencias.length} ${plural(advertencias.length, 'detalle menor', 'detalles menores')} a revisar si hace falta`,
      checks: [],
      advertencias,
    }
  }

  return {
    ok: true,
    tipo: 'Dimensiones de imágenes',
    detalle: `Todas las imágenes (${imagenes.length}) tienen proporciones correctas`,
    checks: [],
    advertencias: [],
  }
}

export async function ValidarPesoImagenes(doc, cacheDatos) {
  try {
    const imagenes = [...doc.querySelectorAll('img')]
    const LIMITE_POR_IMAGEN = 1.5 * 1024 * 1024
    const LIMITE_TOTAL = 3 * 1024 * 1024

    let pesoTotal = 0
    const detalleImagenes = []
    let imagenesConPeso = 0

    for (const img of imagenes) {
      const src = img.getAttribute('src') || ''
      if (!src) continue

      const datos = cacheDatos[src] || null
      if (!datos || datos.error || !datos.peso) continue

      imagenesConPeso++
      pesoTotal += datos.peso
      detalleImagenes.push({
        nombre: nombreImagen(src), // EXTERNO
        peso: datos.peso,
        pesoMb: (datos.peso / (1024 * 1024)).toFixed(2),
        heavy: datos.peso > LIMITE_POR_IMAGEN,
      })
    }

    const pesoTotalMb = (pesoTotal / (1024 * 1024)).toFixed(2)
    const superaTotal = pesoTotal > LIMITE_TOTAL
    const hayHeavy = detalleImagenes.some(i => i.heavy)
    const ok = !superaTotal && !hayHeavy

    const imagenesOrdenadas = [...detalleImagenes].sort((a, b) => b.peso - a.peso)
    const checks = []
    // EXTERNO: los números viajan estructurados para que la UI arme el
    // ranking, los kb/MB y el resumen sin parsear los textos de arriba.
    const numeros = {
      pesoTotalBytes: pesoTotal,
      imagenesConPeso,
      ranking: imagenesOrdenadas,
      superaTotal,
      hayHeavy,
      limitePorImagenBytes: LIMITE_POR_IMAGEN,
      limiteTotalBytes: LIMITE_TOTAL,
    }

    if (superaTotal || hayHeavy) {
      const top = superaTotal ? imagenesOrdenadas : imagenesOrdenadas.filter(i => i.heavy)
      top.forEach((img, i) => {
        checks.push({
          ok: false,
          detalle: `#${i + 1} ${img.nombre} — ${img.pesoMb}mb${img.heavy ? ' ⚠ supera 1.5mb' : ''}`,
        })
      })
    }

    if (imagenesConPeso === 0) {
      return {
        ok: true,
        tipo: 'Peso de imágenes',
        detalle: 'No se pudo medir el peso de las imágenes',
        checks: [],
        ...numeros, // EXTERNO
      }
    }

    return {
      ok,
      tipo: 'Peso de imágenes',
      detalle: `${imagenesConPeso} imágenes — peso total: ${pesoTotalMb}mb${superaTotal ? ' — supera el límite recomendado de 3mb' : ''}`,
      checks,
      ...numeros, // EXTERNO
    }
  } catch {
    // Si algo falla acá (proxy caído, respuesta inesperada, etc.) se
    // marca ok:true a propósito — no se puede confirmar si las
    // imágenes pesan de más, pero tampoco hay evidencia de que sea un
    // problema real de LA PIEZA. Bloquear o marcar error esta prueba
    // por una falla de infraestructura (no del HTML en sí) generaría
    // falsos negativos confusos para quien está revisando la pieza.
    return {
      ok: true,
      tipo: 'Peso de imágenes',
      detalle: 'No se pudo analizar el peso de las imágenes',
      checks: [],
      pesoTotalBytes: 0, imagenesConPeso: 0, ranking: [], superaTotal: false, hayHeavy: false, // EXTERNO
    }
  }
}