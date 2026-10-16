// Proxy de la herramienta pública /analisis (src/pages/Analisis.jsx).
//
// Es INDEPENDIENTE de api/proxy.js (el de la app): si algo se rompe o se
// retoca acá, la app no se entera.
//
//   GET /api/externo/proxy?url=<pieza>
//       Devuelve el HTML de una pieza. Solo icommarketing.com y subdominios.
//       Errores: HTTP 4xx/5xx con { error: "<codigo>" }.
//
//   GET /api/externo/proxy?modo=imagen&url=<imagen>
//       Mide una imagen de CUALQUIER host público (las piezas de cada cliente
//       alojan las imágenes en lugares distintos). Devuelve SOLO metadatos
//       { peso, width, height, formato }, nunca el contenido. Los errores
//       vuelven como 200 { error } para que una imagen rota no corte el análisis.
//
// Defensas (ver _seguridad.js y _cliente.js): solo http/https en los puertos
// 80/443, sin credenciales en la URL, IP validada al conectar, redirecciones
// manuales revalidadas, tope de tamaño y de tiempo. Sin CORS: el front y la
// función son del mismo origen.
//
// Límite de consultas: se configura en el Firewall de Vercel (regla de rate
// limit sobre /api/externo/proxy), no acá.

import { pedir } from './_cliente.js'
import { ErrorProxy } from './_seguridad.js'
import { medirImagen } from './_imagen.js'

const MAX_HTML = 3 * 1024 * 1024
const BYTES_CABECERA_IMAGEN = 256 * 1024
const MAX_CONTAR_IMAGEN = 8 * 1024 * 1024

const ESTADO_POR_CODIGO = {
  url_invalida: 400,
  dominio_no_permitido: 400,
  demasiadas_redirecciones: 502,
  no_encontrada: 404,
  no_es_html: 415,
  muy_grande: 413,
  timeout: 504,
  error_origen: 502,
}

function decodificar(cuerpo, contentType) {
  const m = /charset\s*=\s*"?([\w-]+)/i.exec(contentType || '')
  try {
    return new TextDecoder(m ? m[1] : 'utf-8').decode(cuerpo)
  } catch {
    return new TextDecoder('utf-8').decode(cuerpo)
  }
}

async function responderHtml(url, res, opciones) {
  const r = await pedir(url, {
    soloPiezas: true,
    guardar: MAX_HTML,
    timeoutMs: 8000,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
    ...opciones,
  })
  if (r.status === 404 || r.status === 410) throw new ErrorProxy('no_encontrada')
  if (r.status < 200 || r.status >= 300) throw new ErrorProxy('error_origen')
  const tipo = String(r.headers['content-type'] || '')
  if (tipo && !/text\/html|application\/xhtml/i.test(tipo)) throw new ErrorProxy('no_es_html')
  if (r.excedioGuardado) throw new ErrorProxy('muy_grande')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(decodificar(r.cuerpo, tipo))
}

function pesoDeLaRespuesta(r) {
  if (r.status === 206) {
    const m = /\/(\d+)\s*$/.exec(String(r.headers['content-range'] || ''))
    if (m) return { peso: Number(m[1]), truncado: false }
    return { peso: r.bytesLeidos, truncado: r.cortado }
  }
  const largo = Number(r.headers['content-length'])
  if (Number.isFinite(largo) && largo >= 0) return { peso: largo, truncado: false }
  // Sin tamaño declarado (chunked): se cuenta hasta el tope.
  return { peso: r.bytesLeidos, truncado: r.cortado }
}

async function responderImagen(url, res, opciones) {
  try {
    const r = await pedir(url, {
      soloPiezas: false,
      guardar: BYTES_CABECERA_IMAGEN,
      contarHasta: MAX_CONTAR_IMAGEN,
      timeoutMs: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Encoding': 'identity',
        'Range': `bytes=0-${BYTES_CABECERA_IMAGEN - 1}`,
      },
      ...opciones,
    })
    if (r.status < 200 || r.status >= 300) {
      res.status(200).json({ error: 'No se pudo obtener la imagen' })
      return
    }
    const { peso, truncado } = pesoDeLaRespuesta(r)
    const meta = medirImagen(new Uint8Array(r.cuerpo))
    const cuerpo = { peso, width: meta.width, height: meta.height, formato: meta.formato }
    if (truncado) cuerpo.truncado = true
    res.status(200).json(cuerpo)
  } catch (e) {
    res.status(200).json({ error: e instanceof ErrorProxy ? e.codigo : 'error_origen' })
  }
}

// `opciones` existe para los tests (inyectar un validador de IP permisivo).
export function crearHandler(opciones = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      res.status(405).json({ error: 'metodo_no_permitido' })
      return
    }

    const { url, modo } = req.query || {}
    if (typeof url !== 'string' || !url || url.length > 2048) {
      res.status(400).json({ error: 'url_invalida' })
      return
    }

    try {
      if (modo === 'imagen') await responderImagen(url, res, opciones)
      else await responderHtml(url, res, opciones)
    } catch (e) {
      // El cliente solo ve un código genérico, nunca qué regla de seguridad falló.
      const codigo = e instanceof ErrorProxy ? e.codigo : 'error_origen'
      res.status(ESTADO_POR_CODIGO[codigo] || 502).json({ error: codigo })
    }
  }
}

export default crearHandler()
