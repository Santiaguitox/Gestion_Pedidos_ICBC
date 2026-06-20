import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, requireUser, errorResponse } from '../_shared/auth.ts'

const SHEET_ID = '1d487ncbJ1y-gP2cS2LtH8kbzT5lQTGKl1F4zcMEfkJk'
const HOJA_PEDIDOS = 'Pedidos 2026'
const HOJA_DISENO = 'Diseño piezas 2026'

// Cantidad de columnas esperadas según la hoja destino (ver comentarios más abajo)
const COLUMNAS_ESPERADAS = { pedidos: 11, diseno: 7 }

// Genera JWT para autenticación con Google
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const headerB64 = encode(header)
  const payloadB64 = encode(payload)
  const signingInput = `${headerB64}.${payloadB64}`

  // Importar clave privada
  const pemKey = sa.private_key
  const pemContents = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${signatureB64}`

  // Intercambiar JWT por access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

async function appendRow(accessToken: string, hoja: string, values: string[]) {
  const range = `'${hoja}'!A:K`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API error: ${err}`)
  }

  return await res.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cualquier usuario logueado con perfil válido puede registrar en el Sheet.
    await requireUser(req)

    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT')
    if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT secret no configurado')

    const body = await req.json()
    const { hoja, data } = body

    // data para Hoja 1 (Pedidos):
    // [nombre_campana, fecha_pedido, hora_pedido, descripcion, instancia,
    //  fecha_aprobacion, hora_aprobacion, cantidad_envios, aclaraciones,
    //  dia_programacion, hora_programacion]

    // data para Hoja 2 (Diseño):
    // [nombre_campana, fecha_pedido, hora_pedido, descripcion,
    //  fecha_entrega, hora_entrega, aclaraciones]

    const esDiseno = hoja === 'diseno'
    const hojaTarget = esDiseno ? HOJA_DISENO : HOJA_PEDIDOS
    const esperadas = esDiseno ? COLUMNAS_ESPERADAS.diseno : COLUMNAS_ESPERADAS.pedidos

    if (!Array.isArray(data) || data.length !== esperadas) {
      return new Response(JSON.stringify({
        error: `'data' debe ser un array de ${esperadas} valores para la hoja '${esDiseno ? 'diseno' : 'pedidos'}'`
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const accessToken = await getGoogleAccessToken(serviceAccountJson)
    await appendRow(accessToken, hojaTarget, data)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return errorResponse(err)
  }
})