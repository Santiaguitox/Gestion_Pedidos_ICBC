// Tests del proxy de /analisis: reglas de IP/URL y el cliente HTTP contra un
// servidor local (con un validador de IP permisivo inyectado, porque 127.0.0.1
// es justamente lo que el proxy real bloquea).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import { Buffer } from 'node:buffer'
import { esIpPublica, validarDestino, esHostDePiezas } from '../../../../api/externo/_seguridad.js'
import { pedir } from '../../../../api/externo/_cliente.js'
import { crearHandler } from '../../../../api/externo/proxy.js'
import { medirImagen } from '../../../../api/externo/_imagen.js'

describe('esIpPublica', () => {
  const publicas = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8', '64:ff9b::808:808']
  const privadas = [
    '0.0.0.0', '127.0.0.1', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '2001:db8::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '64:ff9b::7f00:1', '2002:7f00:1::',
  ]
  it.each(publicas)('%s es pública', ip => expect(esIpPublica(ip)).toBe(true))
  it.each(privadas)('%s está bloqueada', ip => expect(esIpPublica(ip)).toBe(false))
  it('texto que no es una IP está bloqueado', () => {
    expect(esIpPublica('localhost')).toBe(false)
    expect(esIpPublica('')).toBe(false)
  })
})

describe('validarDestino', () => {
  const codigo = (fn) => { try { fn(); return null } catch (e) { return e.codigo } }
  it('acepta piezas de icomm y subdominios', () => {
    expect(esHostDePiezas('icommarketing.com')).toBe(true)
    expect(esHostDePiezas('icbc-avisos.icommarketing.com')).toBe(true)
    expect(esHostDePiezas('evilicommarketing.com')).toBe(false)
    expect(esHostDePiezas('icommarketing.com.evil.com')).toBe(false)
  })
  it('modo piezas rechaza otros dominios e IPs', () => {
    expect(codigo(() => validarDestino('https://example.com/', { soloPiezas: true }))).toBe('dominio_no_permitido')
    expect(codigo(() => validarDestino('https://8.8.8.8/', { soloPiezas: true }))).toBe('dominio_no_permitido')
    expect(codigo(() => validarDestino('https://a.icommarketing.com/x?y=1', { soloPiezas: true }))).toBeNull()
  })
  it('rechaza esquemas, credenciales y puertos raros', () => {
    expect(codigo(() => validarDestino('ftp://a.icommarketing.com/'))).toBe('url_invalida')
    expect(codigo(() => validarDestino('file:///etc/passwd'))).toBe('url_invalida')
    expect(codigo(() => validarDestino('https://user:pw@a.icommarketing.com/'))).toBe('url_invalida')
    expect(codigo(() => validarDestino('https://a.icommarketing.com:8443/'))).toBe('url_invalida')
    expect(codigo(() => validarDestino('https://a.icommarketing.com:443/'))).toBeNull()
    expect(codigo(() => validarDestino('no es una url'))).toBe('url_invalida')
  })
  it('rechaza IPs privadas escritas de cualquier forma', () => {
    for (const u of ['http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.1/', 'http://[::1]/', 'http://[::ffff:7f00:1]/', 'http://169.254.169.254/latest', 'http://0/']) {
      expect(codigo(() => validarDestino(u)), u).toBe('dominio_no_permitido')
    }
    expect(codigo(() => validarDestino('http://8.8.8.8/x.png'))).toBeNull()
  })
})

// ── Servidor de prueba ─────────────────────────────────────────────────
const PNG = Buffer.alloc(300 * 1024, 7)
Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(PNG, 0)
PNG.writeUInt32BE(600, 16)
PNG.writeUInt32BE(200, 20)

let servidor, base
beforeAll(async () => {
  servidor = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    if (u.pathname === '/html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end('<p>hola ñandú</p>') }
    if (u.pathname === '/grande') { res.setHeader('Content-Type', 'text/html'); return res.end('a'.repeat(5000)) }
    if (u.pathname === '/pdf') { res.setHeader('Content-Type', 'application/pdf'); return res.end('x') }
    if (u.pathname === '/r1') { res.statusCode = 302; res.setHeader('Location', '/r2'); return res.end() }
    if (u.pathname === '/r2') { res.statusCode = 302; res.setHeader('Location', '/r3'); return res.end() }
    if (u.pathname === '/r3') { res.statusCode = 302; res.setHeader('Location', '/r4'); return res.end() }
    if (u.pathname === '/r4') { res.statusCode = 302; res.setHeader('Location', '/html'); return res.end() }
    if (u.pathname === '/fuera') { res.statusCode = 302; res.setHeader('Location', 'ftp://x/'); return res.end() }
    if (u.pathname === '/404') { res.statusCode = 404; return res.end('no') }
    if (u.pathname === '/img-completa') { res.setHeader('Content-Type', 'image/png'); return res.end(PNG) }
    if (u.pathname === '/img-range') {
      const m = /bytes=(\d+)-(\d+)/.exec(req.headers.range || '')
      if (!m) { res.setHeader('Content-Type', 'image/png'); return res.end(PNG) }
      const parte = PNG.subarray(Number(m[1]), Number(m[2]) + 1)
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${m[1]}-${m[2]}/${PNG.length}`)
      return res.end(parte)
    }
    if (u.pathname === '/img-chunked') {
      res.setHeader('Content-Type', 'image/png')
      res.write(PNG.subarray(0, 100 * 1024))
      return res.end(PNG.subarray(100 * 1024))
    }
    res.statusCode = 404; res.end()
  })
  await new Promise(r => servidor.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${servidor.address().port}`
})
afterAll(() => new Promise(r => servidor.close(r)))

const PERMISIVO = { validarIp: () => true, cualquierPuerto: true }

describe('pedir', () => {
  it('trae el cuerpo', async () => {
    const r = await pedir(base + '/html', { ...PERMISIVO, guardar: 1000 })
    expect(r.status).toBe(200)
    expect(r.cuerpo.toString('utf8')).toContain('hola')
    expect(r.excedioGuardado).toBe(false)
  })
  it('marca cuando el cuerpo supera el tope', async () => {
    const r = await pedir(base + '/grande', { ...PERMISIVO, guardar: 1000 })
    expect(r.excedioGuardado).toBe(true)
    expect(r.cuerpo.length).toBe(1000)
  })
  it('sigue hasta 3 redirecciones y corta en la 4ta', async () => {
    const ok = await pedir(base + '/r2', { ...PERMISIVO, guardar: 1000 })
    expect(ok.status).toBe(200)
    await expect(pedir(base + '/r1', { ...PERMISIVO, guardar: 1000 })).rejects.toMatchObject({ codigo: 'demasiadas_redirecciones' })
  })
  it('revalida el destino de cada redirección', async () => {
    await expect(pedir(base + '/fuera', { ...PERMISIVO })).rejects.toMatchObject({ codigo: 'url_invalida' })
  })
  it('con el validador real, 127.0.0.1 está bloqueado', async () => {
    await expect(pedir(base + '/html', { cualquierPuerto: true })).rejects.toMatchObject({ codigo: 'dominio_no_permitido' })
  })
  it('el lookup rechaza un nombre que resuelve a una IP privada', async () => {
    await expect(pedir(`http://localhost:${new URL(base).port}/html`, { cualquierPuerto: true })).rejects.toMatchObject({ codigo: 'dominio_no_permitido' })
  })
})

function respuestaFalsa() {
  const r = { cabeceras: {}, estado: 200, cuerpo: undefined }
  r.setHeader = (k, v) => { r.cabeceras[k] = v }
  r.status = n => { r.estado = n; return r }
  r.json = c => { r.cuerpo = c; return r }
  r.send = c => { r.cuerpo = c; return r }
  return r
}
async function llamar(handler, query, method = 'GET') {
  const res = respuestaFalsa()
  await handler({ method, query }, res)
  return res
}

describe('handler', () => {
  const handler = crearHandler(PERMISIVO)
  const real = crearHandler()

  it('rechaza métodos que no son GET y URLs ausentes', async () => {
    expect((await llamar(real, { url: 'x' }, 'POST')).estado).toBe(405)
    expect((await llamar(real, {})).estado).toBe(400)
    expect((await llamar(real, { url: 'a'.repeat(3000) })).estado).toBe(400)
  })
  it('modo HTML: solo icommarketing.com', async () => {
    const r = await llamar(real, { url: 'https://example.com/' })
    expect(r.estado).toBe(400)
    expect(r.cuerpo).toEqual({ error: 'dominio_no_permitido' })
  })
  it('modo imagen: con el validador real bloquea IPs internas sin filtrar detalles', async () => {
    const r = await llamar(real, { modo: 'imagen', url: 'http://169.254.169.254/latest/meta-data' })
    expect(r.estado).toBe(200)
    expect(r.cuerpo).toEqual({ error: 'dominio_no_permitido' })
  })
  it('mide el peso total con Range (206) y no devuelve el contenido', async () => {
    const r = await llamar(handler, { modo: 'imagen', url: base + '/img-range' })
    expect(r.cuerpo).toEqual({ peso: PNG.length, width: 600, height: 200, formato: 'png' })
  })
  it('mide el peso con Content-Length si el servidor ignora Range', async () => {
    const r = await llamar(handler, { modo: 'imagen', url: base + '/img-completa' })
    expect(r.cuerpo).toEqual({ peso: PNG.length, width: 600, height: 200, formato: 'png' })
  })
  it('cuenta los bytes si no hay tamaño declarado', async () => {
    const r = await llamar(handler, { modo: 'imagen', url: base + '/img-chunked' })
    expect(r.cuerpo.peso).toBe(PNG.length)
    expect(r.cuerpo.truncado).toBeUndefined()
  })
  it('imagen inexistente: 200 con error', async () => {
    const r = await llamar(handler, { modo: 'imagen', url: base + '/404' })
    expect(r.estado).toBe(200)
    expect(r.cuerpo.error).toBeTruthy()
  })
})

describe('medirImagen', () => {
  it('detecta formato por firma, no por extensión', () => {
    expect(medirImagen(new Uint8Array(PNG)).formato).toBe('png')
    expect(medirImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])).formato).toBe('jpeg')
    expect(medirImagen(Buffer.from('GIF89a\x10\x00\x20\x00', 'latin1'))).toEqual({ formato: 'gif', width: 16, height: 32 })
    expect(medirImagen(new Uint8Array([1, 2, 3, 4]))).toEqual({ formato: null, width: null, height: null })
  })
  it('WebP VP8X', () => {
    const b = Buffer.alloc(40)
    b.write('RIFF', 0); b.write('WEBP', 8); b.write('VP8X', 12)
    b.writeUIntLE(799, 24, 3); b.writeUIntLE(399, 27, 3)
    expect(medirImagen(b)).toEqual({ formato: 'webp', width: 800, height: 400 })
  })
})
