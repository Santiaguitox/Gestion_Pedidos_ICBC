// Cliente HTTP del proxy de /analisis: pide una URL con todas las defensas.
//
//  - Valida la IP en el momento de conectar (lookup propio), así un DNS que
//    cambia de respuesta entre el chequeo y la conexión no sirve de nada.
//  - Redirecciones manuales (máx. 3), revalidando el destino en cada salto.
//  - Tope de bytes y de tiempo total.

import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import { Buffer } from 'node:buffer'
import { ErrorProxy, esIpPublica, validarDestino } from './_seguridad.js'

const REDIRECCIONES_MAX = 3

function lookupSeguro(validarIp) {
  return (hostname, opciones, cb) => {
    if (typeof opciones === 'function') { cb = opciones; opciones = {} }
    dns.lookup(hostname, { ...opciones, all: true }, (err, direcciones) => {
      if (err) return cb(err)
      // Si CUALQUIERA de las direcciones es privada, se rechaza todo el host.
      if (!direcciones.length || !direcciones.every(d => validarIp(d.address))) {
        return cb(new ErrorProxy('dominio_no_permitido'))
      }
      if (opciones.all) return cb(null, direcciones)
      return cb(null, direcciones[0].address, direcciones[0].family)
    })
  }
}

function unSalto(url, { headers, guardar, contarHasta, signal, validarIp }) {
  return new Promise((resolve, reject) => {
    const modulo = url.protocol === 'https:' ? https : http
    const req = modulo.request(url, {
      method: 'GET',
      headers,
      signal,
      lookup: lookupSeguro(validarIp),
    }, res => {
      const status = res.statusCode || 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        return resolve({ redireccion: res.headers.location })
      }

      const largo = Number(res.headers['content-length'])
      const conoceTotal = Number.isFinite(largo) && largo >= 0
      // Si el servidor ya dice el tamaño, alcanza con leer lo que se guarda;
      // si no, se sigue contando hasta el tope. El +1 permite distinguir
      // "justo entra" de "había más" (excedioGuardado / cortado).
      const leerHasta = (conoceTotal || status === 206 ? guardar : Math.max(guardar, contarHasta)) + 1

      const trozos = []
      let guardados = 0
      let contados = 0
      let cortado = false

      res.on('data', trozo => {
        contados += trozo.length
        if (guardados < guardar) {
          const parte = trozo.subarray(0, guardar - guardados)
          trozos.push(parte)
          guardados += parte.length
        }
        if (contados >= leerHasta && !cortado) {
          cortado = true
          res.destroy()
          finalizar()
        }
      })
      res.on('end', finalizar)
      res.on('error', e => { if (!cortado) reject(e) })
      res.on('close', finalizar)

      let terminado = false
      function finalizar() {
        if (terminado) return
        terminado = true
        resolve({
          status,
          headers: res.headers,
          cuerpo: Buffer.concat(trozos),
          bytesLeidos: contados,
          cortado,
          excedioGuardado: contados > guardar,
        })
      }
    })
    req.on('error', reject)
    req.end()
  })
}

// opciones:
//   soloPiezas   → solo icommarketing.com y subdominios (modo HTML)
//   guardar      → bytes máximos que se devuelven en `cuerpo`
//   contarHasta  → bytes máximos que se siguen contando si el servidor no dice el tamaño
//   timeoutMs    → tiempo total para todo el pedido (incluye redirecciones)
//   validarIp    → inyectable en los tests
export async function pedir(urlTexto, opciones = {}) {
  const {
    soloPiezas = false,
    guardar = 256 * 1024,
    contarHasta = 0,
    timeoutMs = 8000,
    headers = {},
    validarIp = esIpPublica,
    cualquierPuerto = false, // solo para tests
  } = opciones

  const signal = AbortSignal.timeout(timeoutMs)
  let url = validarDestino(urlTexto, { soloPiezas, validarIp, cualquierPuerto })

  for (let salto = 0; salto <= REDIRECCIONES_MAX; salto++) {
    let r
    try {
      r = await unSalto(url, { headers, guardar, contarHasta, signal, validarIp })
    } catch (e) {
      if (e instanceof ErrorProxy) throw e
      if (signal.aborted || e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new ErrorProxy('timeout')
      if (e?.cause instanceof ErrorProxy) throw e.cause
      throw new ErrorProxy('error_origen')
    }
    if (r.redireccion === undefined) return { ...r, url }
    if (salto === REDIRECCIONES_MAX) throw new ErrorProxy('demasiadas_redirecciones')
    // El destino se revalida entero: host permitido, puerto, credenciales, IP.
    url = validarDestino(new URL(r.redireccion, url).href, { soloPiezas, validarIp, cualquierPuerto })
  }
  throw new ErrorProxy('demasiadas_redirecciones')
}
