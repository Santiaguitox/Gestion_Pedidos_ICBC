import { esImagenEstructural } from '@/lib/imagenesEstructurales'

function parsearMedida(valor) {
  if (!valor) return null
  return parseInt(valor.replace('px', '').trim())
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
  const regex = new RegExp(`${propiedad}\\s*:\\s*([\\d.]+)px`, 'i')
  const match = style.match(regex)
  return match ? parseInt(match[1]) : null
}

export async function ValidarDimensionesImagenes(doc, cacheDatos) {
  const imagenes = [...doc.querySelectorAll('img')]
  const problemas = []
  const advertencias = []
  // Dedupe del aviso de extensión: el mismo src puede aparecer en
  // varios <img> de la pieza y con avisar una vez alcanza.
  const srcConMismatch = new Set()
  const TOLERANCIA = 0.02

  for (let idx = 0; idx < imagenes.length; idx++) {
    const img = imagenes[idx]
    const src = img.getAttribute('src') || ''
    const nombre = src.split('/').pop() || 'imagen sin src'
    const style = img.getAttribute('style') || ''

    const anchoAtrib = parsearMedida(img.getAttribute('width'))
    const altoAtrib = parsearMedida(img.getAttribute('height'))
    const anchoStyle = extraerMedidaStyle(style, 'width')
    const altoStyle = extraerMedidaStyle(style, 'height')

    if (anchoAtrib !== null && anchoStyle !== null && anchoAtrib !== anchoStyle) {
      problemas.push({ nombre, detalle: `Ancho inconsistente — atributo: ${anchoAtrib}px, style: ${anchoStyle}px` })
    }
    if (altoAtrib !== null && altoStyle !== null && altoAtrib !== altoStyle) {
      problemas.push({ nombre, detalle: `Alto inconsistente — atributo: ${altoAtrib}px, style: ${altoStyle}px` })
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

  // Mismo contrato que Links: la prueba falla solo por ERRORES; las
  // advertencias viajan aparte y la UI las lista como "Detalle menor"
  // en amarillo (ResultadoPanel) — no bajan el score.
  if (problemas.length > 0 || advertencias.length > 0) {
    const detalle = problemas.length > 0
      ? `${problemas.length} problema${problemas.length > 1 ? 's' : ''} encontrado${problemas.length > 1 ? 's' : ''}${advertencias.length > 0 ? ` (+${advertencias.length} detalle${advertencias.length > 1 ? 's' : ''} menor${advertencias.length > 1 ? 'es' : ''} en separadores)` : ''}`
      : `Proporciones correctas — ${advertencias.length} separador${advertencias.length > 1 ? 'es' : ''} estructural${advertencias.length > 1 ? 'es' : ''} estirado${advertencias.length > 1 ? 's' : ''} a revisar si hace falta`
    return {
      ok: problemas.length === 0,
      tipo: 'Dimensiones de imágenes',
      detalle,
      checks: problemas.map(p => ({ ok: false, detalle: `${p.nombre}: ${p.detalle}` })),
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
        nombre: src.split('/').pop(),
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
        detalle: 'No se pudo obtener el peso de las imágenes — verificá que el proxy esté configurado',
        checks: [],
      }
    }

    return {
      ok,
      tipo: 'Peso de imágenes',
      detalle: `${imagenesConPeso} imágenes — peso total: ${pesoTotalMb}mb${superaTotal ? ' — supera el límite recomendado de 3mb' : ''}`,
      checks,
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
    }
  }
}