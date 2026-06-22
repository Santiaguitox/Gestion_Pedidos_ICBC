import { REVISION_CONFIG } from '@/lib/revision/config.js'
const DOMINIO_APROBADO = REVISION_CONFIG.DOMINIO_IMAGENES_APROBADO

function parsearMedida(valor) {
  if (!valor) return null
  return parseInt(valor.replace('px', '').trim())
}

function extraerMedidaStyle(style, propiedad) {
  if (!style) return null
  const regex = new RegExp(`${propiedad}\\s*:\\s*([\\d.]+)px`, 'i')
  const match = style.match(regex)
  return match ? parseInt(match[1]) : null
}

export async function ValidarDimensionesImagenes(doc, cacheDatos) {
  const imagenes = [...doc.querySelectorAll('img')]
  const problemas = []
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

    if (anchoDec && altoDec && src) {
      const real = cacheDatos[src] || null
      if (real && !real.error) {
        const ratioReal = real.width / real.height
        const ratioDec = anchoDec / altoDec
        const diferencia = Math.abs(ratioReal - ratioDec) / ratioReal

        if (diferencia > TOLERANCIA) {
          problemas.push({
            nombre,
            detalle: `Proporción incorrecta — imagen real: ${real.width}x${real.height}, declarado: ${anchoDec}x${altoDec}`
          })
        }
      }
    }
  }

  if (problemas.length > 0) {
    return {
      ok: false,
      tipo: 'Dimensiones de imágenes',
      detalle: `${problemas.length} problema${problemas.length > 1 ? 's' : ''} encontrado${problemas.length > 1 ? 's' : ''}`,
      checks: problemas.map(p => ({ ok: false, detalle: `${p.nombre}: ${p.detalle}` })),
    }
  }

  return {
    ok: true,
    tipo: 'Dimensiones de imágenes',
    detalle: `Todas las imágenes (${imagenes.length}) tienen proporciones correctas`,
    checks: [],
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