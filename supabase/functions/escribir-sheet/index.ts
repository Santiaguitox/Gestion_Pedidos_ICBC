import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, requireUser, errorResponse } from '../_shared/auth.ts'

const SHEET_ID = '1d487ncbJ1y-gP2cS2LtH8kbzT5lQTGKl1F4zcMEfkJk'

// Mismo criterio que delete-user/invite-user: la lista vive en la
// función (no viene del cliente). Se excluye 'viewer' — rol de solo
// lectura en toda la app.
const ROLES_PERMITIDOS = ['super_admin', 'admin', 'colaborador']
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

  if (!tokenRes.ok) {
    // Sin este chequeo, un JWT rechazado por Google (reloj desincronizado,
    // key rotada, etc.) devuelve tokenData sin access_token y el error
    // real se pierde: recién explota más abajo en appendRow con un 401
    // confuso que no dice que el problema fue obtener el token.
    const err = await tokenRes.text()
    throw new Error(`No se pudo obtener el access token de Google: ${err}`)
  }

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

// Color de fondo para filas marcadas como "Pedido fuera de hora" — el
// mismo #ff9900 que ya se usa en otras partes de la app para esta
// categoría. La API de Sheets espera RGB en escala 0-1, no 0-255.
const COLOR_FUERA_DE_HORA = { red: 1, green: 0.6, blue: 0 }
// Blanco explícito — IMPORTANTE: no alcanza con "no pintar" la fila
// cuando fueraDeHora es false. Al insertar una fila nueva con
// INSERT_ROWS, Google Sheets hereda automáticamente el formato de la
// fila de arriba — si esa fila anterior había quedado pintada de
// naranja, la fila nueva nace pintada también aunque su checkbox no
// esté tildado. Por eso SIEMPRE se aplica un color de fondo explícito
// después del append (blanco en el caso normal, naranja si corresponde),
// nunca se deja "sin tocar".
const COLOR_BLANCO = { red: 1, green: 1, blue: 1 }

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

// Obtiene el sheetId NUMÉRICO (distinto del SHEET_ID del spreadsheet
// completo) de una pestaña por su nombre — necesario para el
// batchUpdate de formato, que referencia rangos por sheetId numérico,
// no por nombre de pestaña.
async function getSheetIdPorNombre(accessToken: string, nombreHoja: string): Promise<number> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`No se pudo obtener metadata del spreadsheet: ${await res.text()}`)
  const meta = await res.json()
  const sheet = meta.sheets?.find((s: any) => s.properties?.title === nombreHoja)
  if (!sheet) throw new Error(`No se encontró la hoja '${nombreHoja}' en el spreadsheet`)
  return sheet.properties.sheetId
}

// Pinta de fondo 'color' toda la fila recién agregada. 'updatedRange'
// viene de la respuesta de appendRow, con forma tipo "'Pedidos
// 2026'!A15:K15" — de ahí se extrae el número de fila (15) para saber
// exactamente qué fila pintar (la API de append no permite pintar en
// la misma llamada, hace falta un batchUpdate aparte). Se llama SIEMPRE
// (con blanco o naranja según corresponda) — ver comentario en
// COLOR_BLANCO sobre por qué no alcanza con omitir esta llamada.
async function pintarFila(accessToken: string, sheetId: number, updatedRange: string, cantidadColumnas: number, color: { red: number, green: number, blue: number }) {
  const match = updatedRange.match(/![A-Z]+(\d+):/)
  if (!match) throw new Error(`No se pudo determinar el número de fila desde '${updatedRange}'`)
  const fila = parseInt(match[1], 10)

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`
  const body = {
    requests: [{
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: fila - 1, // la API usa índices base 0
          endRowIndex: fila,
          startColumnIndex: 0,
          endColumnIndex: cantidadColumnas,
        },
        cell: { userEnteredFormat: { backgroundColor: color } },
        fields: 'userEnteredFormat.backgroundColor',
      },
    }],
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API error (formato de fila): ${err}`)
  }
}

// Caracteres que Google Sheets interpreta como inicio de fórmula cuando
// valueInputOption=USER_ENTERED. Un valor tipeado por un usuario (ej. en
// "aclaraciones" o el nombre de campaña) que arranque con alguno de estos
// se ejecuta como fórmula en la planilla oficial — más probable que sea
// un accidente que un ataque en un equipo interno, pero la planilla es
// el registro formal y no debería depender de qué tipeó cada usuario.
const CARACTERES_FORMULA = ['=', '+', '-', '@']

// Prefija con ' (comilla simple) todo string que empiece con uno de esos
// caracteres — Sheets lo toma como texto literal y no evalúa nada. Los
// campos de fecha/hora que sí necesitan que USER_ENTERED los parsee no
// arrancan con estos caracteres, así que no se ven afectados. Valores
// no-string (ej. cantidad_envios) se devuelven sin tocar.
function sanearValorFormula(valor: unknown): unknown {
  if (typeof valor !== 'string' || valor.length === 0) return valor
  if (CARACTERES_FORMULA.includes(valor[0])) return `'${valor}`
  return valor
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Registrar en el Sheet es una escritura con efecto externo real
    // (queda en la planilla oficial): pueden hacerlo los roles que
    // operan pedidos, pero NO 'viewer' (rol de solo lectura). La UI ya
    // no le muestra el botón al viewer, pero el enforcement real tiene
    // que estar acá — el endpoint es alcanzable con cualquier JWT válido.
    await requireUser(req, ROLES_PERMITIDOS)

    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT')
    if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT secret no configurado')

    const body = await req.json()
    const { hoja, data, fueraDeHora } = body

    // data para Hoja 1 (Pedidos):
    // [nombre_campana, fecha_pedido, hora_pedido, descripcion, instancia,
    //  fecha_aprobacion, hora_aprobacion, cantidad_envios, aclaraciones,
    //  dia_programacion, hora_programacion]

    // data para Hoja 2 (Diseño):
    // [nombre_campana, fecha_pedido, hora_pedido, descripcion,
    //  fecha_entrega, hora_entrega, aclaraciones]

    // 'hoja' se valida estricta: antes cualquier valor distinto de
    // 'diseno' (incluido undefined o basura) caía silenciosamente en
    // la hoja de Pedidos — mejor rechazar el request malformado que
    // escribir una fila en la hoja equivocada.
    if (hoja !== 'pedidos' && hoja !== 'diseno') {
      return new Response(JSON.stringify({ error: "'hoja' debe ser 'pedidos' o 'diseno'" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
    const dataSaneada = data.map(sanearValorFormula)
    const appendResult = await appendRow(accessToken, hojaTarget, dataSaneada)

    // SIEMPRE se fija un color de fondo explícito en la fila recién
    // escrita (blanco en el caso normal, #ff9900 si fueraDeHora) —
    // requiere un segundo llamado (batchUpdate) porque la API de append
    // no permite setear formato en la misma operación. No se puede
    // omitir esta llamada cuando fueraDeHora es false: al insertar una
    // fila nueva, Sheets hereda el formato de la fila de arriba, así
    // que si la fila anterior había quedado naranja, la nueva nacería
    // naranja también si no se la pinta de blanco explícitamente.
    const updatedRange = appendResult?.updates?.updatedRange
    if (updatedRange) {
      const sheetId = await getSheetIdPorNombre(accessToken, hojaTarget)
      await pintarFila(accessToken, sheetId, updatedRange, esperadas, fueraDeHora ? COLOR_FUERA_DE_HORA : COLOR_BLANCO)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return errorResponse(err)
  }
})