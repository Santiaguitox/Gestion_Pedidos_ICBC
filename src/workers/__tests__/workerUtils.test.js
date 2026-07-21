import { describe, it, expect } from 'vitest'
import { decodeLatin1, detectEncoding, decodeChunk, parseCSVLine, detectCol, normalizeEmail } from '@/workers/worker-utils'

// Estas utilidades procesan las bases de datos reales de clientes en
// los tres workers (validador, comparador, segmentador). Un error acá
// es silencioso por definición: una fila mal parseada no tira
// excepción, solo produce un resultado incorrecto que nadie ve.

describe('detectEncoding', () => {
  it('detecta UTF-8 en texto con tildes bien codificadas', () => {
    const bytes = new TextEncoder().encode('nombre;email\nJosé;jose@gmail.com')
    expect(detectEncoding(bytes)).toBe('utf8')
  })

  it('detecta latin1 cuando los bytes de tildes no son UTF-8 válido', () => {
    // "José" en latin1: la é es el byte 0xE9 suelto — inválido como
    // UTF-8, el TextDecoder lo reemplaza por U+FFFD y eso dispara la
    // detección. Es EXACTAMENTE el caso de los CSV exportados por
    // Excel en Windows con configuración regional es-AR.
    const bytes = new Uint8Array([0x4A, 0x6F, 0x73, 0xE9, 0x3B, 0x61])
    expect(detectEncoding(bytes)).toBe('latin1')
  })

  it('texto ASCII puro es utf8 (compatible con ambos, se prefiere el default)', () => {
    const bytes = new TextEncoder().encode('email\ntest@test.com')
    expect(detectEncoding(bytes)).toBe('utf8')
  })
})

describe('decodeChunk / decodeLatin1', () => {
  it('decodifica latin1 recuperando las tildes byte a byte', () => {
    const bytes = new Uint8Array([0x4A, 0x6F, 0x73, 0xE9]) // "José" en latin1
    expect(decodeLatin1(bytes)).toBe('José')
    expect(decodeChunk(bytes, 'latin1')).toBe('José')
  })

  it('decodifica utf8 con el TextDecoder estándar', () => {
    const bytes = new TextEncoder().encode('José')
    expect(decodeChunk(bytes, 'utf8')).toBe('José')
  })
})

describe('parseCSVLine', () => {
  it('separa campos simples por el separador dado', () => {
    expect(parseCSVLine('a;b;c', ';')).toEqual(['a', 'b', 'c'])
    expect(parseCSVLine('a,b,c', ',')).toEqual(['a', 'b', 'c'])
  })

  it('respeta el separador DENTRO de comillas (el caso que rompe un split ingenuo)', () => {
    expect(parseCSVLine('"Pérez; Juan";juan@test.com', ';')).toEqual(['Pérez; Juan', 'juan@test.com'])
  })

  it('comillas escapadas ("" dentro de un campo entrecomillado) quedan como una comilla literal', () => {
    expect(parseCSVLine('"Empresa ""El Sol"" SA";contacto@elsol.com', ';')).toEqual(['Empresa "El Sol" SA', 'contacto@elsol.com'])
  })

  it('campos vacíos consecutivos se conservan (la posición de columna importa)', () => {
    expect(parseCSVLine('a;;c;', ';')).toEqual(['a', '', 'c', ''])
  })

  it('una comilla en el MEDIO de un campo sin comillas de apertura es un carácter literal', () => {
    // La apertura de comillas solo cuenta al inicio del campo
    // (current === '') — un apóstrofo o comilla suelta en el medio no
    // debe activar el modo entrecomillado.
    expect(parseCSVLine('O"Higgins;test@test.com', ';')).toEqual(['O"Higgins', 'test@test.com'])
  })
})

describe('detectCol', () => {
  it('encuentra el primer header que matchea alguno de los patrones', () => {
    const headers = ['id', 'Nombre', 'E-mail', 'telefono']
    expect(detectCol(headers, [/mail/i])).toBe('E-mail')
    expect(detectCol(headers, [/^nombre$/i, /name/i])).toBe('Nombre')
  })

  it('devuelve null si ningún header matchea (la UI debe avisar, no adivinar)', () => {
    expect(detectCol(['a', 'b'], [/mail/i])).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('minúsculas + trim', () => {
    expect(normalizeEmail('  Juan.Perez@GMAIL.com ')).toBe('juan.perez@gmail.com')
  })

  it('normaliza Unicode a NFC — la MISMA dirección con tilde compuesta o descompuesta compara igual', () => {
    // 'é' precompuesto (U+00E9) vs 'e' + combining acute (U+0065 U+0301):
    // visualmente idénticos, bytes distintos. Sin NFC, el mismo contacto
    // en dos exports distintos no se detectaría como duplicado.
    const precompuesto = 'jos\u00e9@test.com'
    const descompuesto = 'jose\u0301@test.com'
    expect(normalizeEmail(precompuesto)).toBe(normalizeEmail(descompuesto))
  })
})
