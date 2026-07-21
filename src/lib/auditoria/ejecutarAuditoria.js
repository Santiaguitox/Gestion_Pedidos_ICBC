import { REVISION_CONFIG } from '@/lib/revision/config'

// ============================================================================
// PARSEO DE PIEZAS
// ============================================================================
// Hay dos formas de cargar piezas, que conviven como dos tabs en la UI:
//
// 1. PEGADO SIMPLE — una línea por pieza, "Nombre | URL" / "Nombre, URL"
//    (csv) / o solo la URL. Ver parsearPiezasSimple().
//
// 2. PEGAR TABLA — se pega una tabla completa (tab-separated, como sale
//    de copiar un rango de Excel/Sheets), con headers en la primera
//    fila. El usuario elige qué columnas usar como identificador de la
//    pieza (cualquier cantidad, una de ellas marcada como "principal")
//    y cuál columna es el link a escanear. Ver parsearTabla() y
//    construirPiezasDesdeTabla().
//
// En AMBOS casos el resultado final es la misma forma:
//   { id, url, valida, error, campos: [{ etiqueta, valor }], nombre }
// 'campos' son los pares clave-valor elegidos para identificar la
// pieza (en modo simple, un único campo "Nombre"). 'nombre' es un
// string derivado de 'campos' (el campo marcado como principal, o el
// primero) — se usa donde hace falta un título corto y plano.
// El resto del motor (matching, export) no necesita saber de qué modo
// vino la pieza, solo lee 'campos'/'nombre'/'url'.

const DOMINIO_PERMITIDO = 'icommarketing.com'

// Solo cosmético (UX) — igual que en RevisionEmail.jsx, la defensa REAL
// contra SSRF vive en api/proxy.js. Mantener sincronizado a mano si se
// agrega un dominio nuevo allá.
function hostnamePermitido(hostname) {
  return hostname === DOMINIO_PERMITIDO || hostname.endsWith('.' + DOMINIO_PERMITIDO)
}

function acortarUrl(url) {
  try {
    const u = new URL(url)
    const path = u.pathname.length > 28 ? u.pathname.slice(0, 28) + '…' : u.pathname
    return u.hostname.replace('.' + DOMINIO_PERMITIDO, '') + path
  } catch {
    return url
  }
}

// Arma el objeto final de pieza, validando la URL una sola vez para
// ambos modos de carga.
function construirPieza({ id, urlCruda, campos }) {
  const nombre = campos[0]?.valor || urlCruda

  let urlObj
  try {
    urlObj = new URL(urlCruda)
  } catch {
    return { id, url: urlCruda, valida: false, error: 'URL inválida', campos, nombre: nombre || urlCruda }
  }

  if (!hostnamePermitido(urlObj.hostname)) {
    return { id, url: urlCruda, valida: false, error: `Solo se permiten piezas de ${DOMINIO_PERMITIDO}`, campos, nombre: nombre || acortarUrl(urlCruda) }
  }

  return { id, url: urlCruda, valida: true, error: null, campos, nombre: nombre || acortarUrl(urlCruda) }
}

// ---------------------------------------------------------------------
// Modo 1: Pegado simple
// ---------------------------------------------------------------------

// Separa "nombre" y "url" de una línea probando, en orden: pipe, tab,
// última coma (las URLs no suelen tener comas, pero el nombre de la
// pieza sí podría tenerlas — por eso se parte por la ÚLTIMA coma, no la
// primera). Si ningún separador aparece, se asume que la línea entera
// es la URL.
function partirLinea(linea) {
  if (linea.includes('|')) {
    const idx = linea.indexOf('|')
    return { nombreCrudo: linea.slice(0, idx).trim(), urlCruda: linea.slice(idx + 1).trim() }
  }
  if (linea.includes('\t')) {
    const idx = linea.indexOf('\t')
    return { nombreCrudo: linea.slice(0, idx).trim(), urlCruda: linea.slice(idx + 1).trim() }
  }
  if (linea.includes(',')) {
    const idx = linea.lastIndexOf(',')
    return { nombreCrudo: linea.slice(0, idx).trim(), urlCruda: linea.slice(idx + 1).trim() }
  }
  return { nombreCrudo: '', urlCruda: linea.trim() }
}

// Parsea el textarea de pegado simple. Devuelve un array de piezas
// (ver forma común documentada arriba).
export function parsearPiezasSimple(textoCompleto) {
  return textoCompleto
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map((linea, i) => {
      const { nombreCrudo, urlCruda } = partirLinea(linea)
      const campos = nombreCrudo ? [{ etiqueta: 'Nombre', valor: nombreCrudo }] : []
      return construirPieza({ id: `pieza-${i}`, urlCruda, campos })
    })
}

// Alias retrocompatible — usado tal cual en versiones anteriores de la
// página antes de existir el modo tabla.
export const parsearPiezas = parsearPiezasSimple

// ---------------------------------------------------------------------
// Modo 2: Pegar tabla (Excel/Sheets)
// ---------------------------------------------------------------------

// Separador real entre celdas al copiar un rango de Excel/Google
// Sheets es siempre TAB — a diferencia del modo simple (que acepta
// pipe/coma/tab para una sola línea de "nombre | url"), acá no hace
// falta adivinar: si no hay tabs, no es una tabla pegada.
function partirFilaTabla(linea) {
  return linea.split('\t').map(c => c.trim())
}

// Parsea el texto pegado como tabla: primera fila = headers, resto =
// filas de datos. Devuelve { headers, filas, tieneHeaders }.
// 'filas' es un array de arrays (misma forma que headers).
// tieneHeaders=false si no se pudo detectar una fila de encabezado
// razonable (heurística: la primera fila no tiene tabs, o tiene menos
// de 2 columnas) — en ese caso headers/filas vienen vacíos y la UI debe
// avisar en vez de adivinar.
export function parsearTabla(textoCompleto) {
  const lineas = textoCompleto.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim() !== '')
  if (lineas.length === 0) return { headers: [], filas: [], tieneHeaders: false }

  const primeraFila = partirFilaTabla(lineas[0])
  if (primeraFila.length < 2) {
    return { headers: [], filas: [], tieneHeaders: false }
  }

  const headers = primeraFila
  const filas = lineas.slice(1).map(partirFilaTabla)
  return { headers, filas, tieneHeaders: true }
}

// A partir del resultado de parsearTabla() + la selección del usuario
// (qué columnas usar como identificador, cuál es la "principal", y
// cuál columna es el link), arma el array final de piezas.
//   columnasNombre: array de índices de columna (en el orden que el
//     usuario los seleccionó/quiere ver en el reporte)
//   columnaPrincipal: índice de columna marcado como identificador
//     principal — debe estar incluido en columnasNombre. Si es null,
//     se usa la primera de columnasNombre.
//   columnaLink: índice de columna con la URL (obligatoria)
export function construirPiezasDesdeTabla({ headers, filas }, { columnasNombre, columnaPrincipal, columnaLink }) {
  if (columnaLink == null) return []

  // Reordena columnasNombre para que la principal quede primera —
  // construirPieza() usa siempre campos[0] como 'nombre' derivado.
  const ordenColumnas = columnaPrincipal != null && columnasNombre.includes(columnaPrincipal)
    ? [columnaPrincipal, ...columnasNombre.filter(c => c !== columnaPrincipal)]
    : columnasNombre

  return filas.map((fila, i) => {
    const urlCruda = (fila[columnaLink] || '').trim()
    const campos = ordenColumnas
      .map(idx => ({ etiqueta: headers[idx], valor: (fila[idx] || '').trim() }))
      .filter(c => c.valor !== '')
    return construirPieza({ id: `pieza-tabla-${i}`, urlCruda, campos })
  }).filter(p => p.url) // filas completamente vacías en la columna link se descartan, no tiene sentido reportarlas como error
}

// ============================================================================
// REGLAS DE BÚSQUEDA
// ============================================================================

export const TIPOS_REGLA = {
  texto: 'Texto',
  link: 'Link',
  imagen: 'Imagen',
}

export function nuevaRegla() {
  return { id: `regla-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, tipo: 'texto', valor: '', ignorarMayus: true }
}

export function reglaEsValida(regla) {
  return regla.valor.trim().length > 0
}

// ============================================================================
// MOTOR DE MATCHING
// ============================================================================

// Trae el HTML crudo de una pieza vía el mismo proxy que usa el resto
// de las herramientas de revisión (validación de dominio + SSRF ya
// resuelta ahí, no se duplica acá).
async function traerHtmlDeUrl(url) {
  const response = await fetch(`${REVISION_CONFIG.PROXY_URL}?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error(`No se pudo obtener el HTML (status ${response.status})`)
  return await response.text()
}

// Devuelve un fragmento de contexto alrededor de un índice de match
// dentro de un texto, recortando ~40 caracteres antes y después y
// agregando "…" en los bordes si el recorte no llega al principio/fin
// real del texto.
// export para poder testearla directo (pura: texto+índice in →
// fragmentos out, sin tocar el DOM).
export function extraerContexto(texto, indice, largoMatch, margen = 40) {
  const inicio = Math.max(0, indice - margen)
  const fin = Math.min(texto.length, indice + largoMatch + margen)
  const prefijo = inicio > 0 ? '…' : ''
  const sufijo = fin < texto.length ? '…' : ''
  return {
    antes: prefijo + texto.slice(inicio, indice).trimStart(),
    match: texto.slice(indice, indice + largoMatch),
    despues: texto.slice(indice + largoMatch, fin).trimEnd() + sufijo,
  }
}

// Busca TODAS las ocurrencias de 'valor' dentro de 'texto', devolviendo
// el contexto de cada una. ignorarMayus controla si la comparación es
// case-insensitive.
// export para poder testearla directo — es la lógica que decide CUÁNTOS
// hallazgos se reportan por pieza; un error acá (ej. loop infinito con
// valor vacío, u overlap mal resuelto) es silencioso: no tira
// excepción, solo cuenta mal.
export function buscarOcurrencias(texto, valor, ignorarMayus) {
  if (!valor) return []
  const ocurrencias = []
  const textoComp = ignorarMayus ? texto.toLowerCase() : texto
  const valorComp = ignorarMayus ? valor.toLowerCase() : valor
  let desde = 0
  while (true) {
    const idx = textoComp.indexOf(valorComp, desde)
    if (idx === -1) break
    ocurrencias.push(extraerContexto(texto, idx, valor.length))
    desde = idx + valor.length
  }
  return ocurrencias
}

// Corre todas las reglas contra el HTML de UNA pieza ya descargado.
// Devuelve un array de "hallazgos", uno por regla que tuvo al menos 1
// ocurrencia: { regla, ocurrencias: [...] }
function aplicarReglasAHtml(html, reglas) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const hallazgos = []

  for (const regla of reglas) {
    if (!reglaEsValida(regla)) continue

    if (regla.tipo === 'texto') {
      // Texto visible únicamente — body.innerText (no .textContent) para
      // no levantar contenido oculto de <style>/<script>/elementos con
      // display:none, evitando falsos positivos.
      const textoVisible = doc.body?.innerText ?? ''
      const ocurrencias = buscarOcurrencias(textoVisible, regla.valor, regla.ignorarMayus)
      if (ocurrencias.length > 0) hallazgos.push({ regla, ocurrencias })
    } else if (regla.tipo === 'link') {
      const links = Array.from(doc.querySelectorAll('a[href]')).map(a => a.getAttribute('href') || '')
      const ocurrencias = []
      for (const href of links) {
        if (buscarOcurrencias(href, regla.valor, regla.ignorarMayus).length > 0) {
          ocurrencias.push({ antes: '', match: href, despues: '' })
        }
      }
      if (ocurrencias.length > 0) hallazgos.push({ regla, ocurrencias })
    } else if (regla.tipo === 'imagen') {
      const imagenes = Array.from(doc.querySelectorAll('img[src]')).map(img => img.getAttribute('src') || '')
      const ocurrencias = []
      for (const src of imagenes) {
        if (buscarOcurrencias(src, regla.valor, regla.ignorarMayus).length > 0) {
          ocurrencias.push({ antes: '', match: src, despues: '' })
        }
      }
      if (ocurrencias.length > 0) hallazgos.push({ regla, ocurrencias })
    }
  }

  return hallazgos
}

// Corre la auditoría completa: recorre las piezas SECUENCIALMENTE (para
// no saturar el proxy con N fetches en paralelo ni trabar la UI), y por
// cada una aplica todas las reglas. onProgreso(pieza, indice, total, acumulado)
// se llama antes de procesar cada pieza — 'acumulado' trae los conteos
// resueltos HASTA ese momento ({ conMatch, sinMatch }), para que la UI
// pueda mostrar un conteo en vivo mientras corre, no solo el avance.
//
// Devuelve: { conCoincidencias: [...], sinCoincidencias: [...], conError: [...] }
// Cada item de conCoincidencias: { pieza, hallazgos }
// Cada item de sinCoincidencias / conError: { pieza, error? }
export async function ejecutarAuditoria({ piezas, reglas, onProgreso }) {
  const piezasValidas = piezas.filter(p => p.valida)
  const reglasValidas = reglas.filter(reglaEsValida)

  const conCoincidencias = []
  const sinCoincidencias = []
  const conError = []

  for (let i = 0; i < piezasValidas.length; i++) {
    const pieza = piezasValidas[i]
    onProgreso?.(pieza, i, piezasValidas.length, { conMatch: conCoincidencias.length, sinMatch: sinCoincidencias.length })

    try {
      const html = await traerHtmlDeUrl(pieza.url)
      const hallazgos = aplicarReglasAHtml(html, reglasValidas)
      if (hallazgos.length > 0) {
        conCoincidencias.push({ pieza, hallazgos })
      } else {
        sinCoincidencias.push({ pieza })
      }
    } catch (err) {
      conError.push({ pieza, error: err.message || 'Error desconocido al analizar la pieza' })
    }
  }

  // Piezas con URL/dominio inválido desde el parseo inicial — no
  // llegaron a intentar el fetch siquiera.
  const piezasInvalidas = piezas.filter(p => !p.valida)
  for (const pieza of piezasInvalidas) {
    conError.push({ pieza, error: pieza.error })
  }

  return { conCoincidencias, sinCoincidencias, conError }
}

// ============================================================================
// EXPORTAR REPORTE
// ============================================================================

// Arma un TXT con una pieza por línea, columnas separadas por " | " —
// formato pedido explícitamente: "Valor | Link". Usa exactamente las
// columnas (campos) que el usuario eligió al pegar la tabla — distintos
// usuarios pueden elegir distintas columnas (con o sin ID, por
// ejemplo) — más el LINK siempre al final.
function listadoTabulado(piezas, titulo) {
  const etiquetas = []
  for (const pieza of piezas) {
    for (const campo of pieza.campos) {
      if (!etiquetas.includes(campo.etiqueta)) etiquetas.push(campo.etiqueta)
    }
  }
  if (etiquetas.length === 0) etiquetas.push('Nombre')

  const encabezados = [...etiquetas, 'Link']
  const filas = piezas.map(pieza => {
    const valoresCampos = etiquetas.map(etq => pieza.campos.find(c => c.etiqueta === etq)?.valor ?? (etq === 'Nombre' ? pieza.nombre : ''))
    return [...valoresCampos, pieza.url]
  })

  const lineas = []
  lineas.push(`${titulo} — ${new Date().toLocaleString('es-AR')}`)
  lineas.push(`${piezas.length} pieza${piezas.length !== 1 ? 's' : ''}`)
  lineas.push('')
  lineas.push(encabezados.join(' | '))
  filas.forEach(f => lineas.push(f.join(' | ')))

  return lineas.join('\n')
}

// Listado de las piezas que TUVIERON coincidencia — es el subconjunto
// que realmente aporta valor: las piezas auditadas en su totalidad ya
// las tiene el usuario (las cargó él en el paso 1), lo que necesita es
// justamente filtrar cuáles requieren trabajo.
export function generarListadoConCoincidenciasTexto({ conCoincidencias }) {
  return listadoTabulado(conCoincidencias.map(x => x.pieza), 'Piezas con coincidencias')
}

// Listado de las piezas SIN coincidencia — útil como complemento para
// confirmar qué piezas NO requieren cambios (descarte explícito).
export function generarListadoSinCoincidenciasTexto({ sinCoincidencias }) {
  return listadoTabulado(sinCoincidencias.map(x => x.pieza), 'Piezas sin coincidencias')
}

export function descargarArchivo(contenido, nombreArchivo, tipoMime) {
  const blob = new Blob([contenido], { type: tipoMime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
