// Proxy local para probar /analisis con `npm run dev`.
//
// En desarrollo, Vite no sirve las funciones de /api (eso lo hace Vercel).
// Este script levanta el MISMO handler de api/externo/proxy.js en un servidor
// de Node, en el puerto 3001, y el front (en modo dev) le pega ahí.
//
// Uso (en una segunda terminal, con `npm run dev` corriendo en la primera):
//   node scripts/externo-proxy-local.mjs
//
// Solo escucha en 127.0.0.1 y solo acepta pedidos de páginas locales.

import http from 'node:http'
import handler from '../api/externo/proxy.js'

const PUERTO = Number(process.env.EXTERNO_PROXY_PORT) || 3001

const ORIGEN_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

const servidor = http.createServer(async (req, res) => {
  const origen = req.headers.origin
  if (origen && ORIGEN_LOCAL.test(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen)
    res.setHeader('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.statusCode = 204
    res.end()
    return
  }

  const url = new URL(req.url, `http://127.0.0.1:${PUERTO}`)
  if (url.pathname !== '/api/externo/proxy') {
    res.statusCode = 404
    res.end('Not found')
    return
  }

  // Lo mínimo del objeto que Vercel le pasa a la función
  req.query = Object.fromEntries(url.searchParams)
  res.status = codigo => { res.statusCode = codigo; return res }
  res.json = cuerpo => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(cuerpo))
    return res
  }
  res.send = cuerpo => { res.end(cuerpo); return res }

  try {
    await handler(req, res)
  } catch (e) {
    console.error('[externo-proxy-local]', e)
    if (!res.headersSent) res.status(500).json({ error: 'error_origen' })
  }
})

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Proxy de /analisis escuchando en http://localhost:${PUERTO}/api/externo/proxy`)
  console.log('Dejalo corriendo y abrí http://localhost:5173/analisis (npm run dev).')
})
