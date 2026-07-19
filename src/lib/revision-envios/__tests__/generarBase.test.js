import { describe, it, expect } from 'vitest'
import {
  tipoCampo, valorPorDefecto, generarCsvBaseTest, emailValido,
  reemplazarCampos, escaparValorCsv,
} from '@/lib/revision-envios/generarBase'

describe('tipoCampo — heurística por nombre', () => {
  it('detecta link por palabras clave, sin distinguir acentos ni mayúsculas', () => {
    expect(tipoCampo('LinkBoton')).toBe('link')
    expect(tipoCampo('URL_CTA')).toBe('link')
    expect(tipoCampo('Href')).toBe('link')
  })

  it('detecta imagen por palabras clave, incluida la variante con tilde', () => {
    expect(tipoCampo('ImagenHeader')).toBe('imagen')
    expect(tipoCampo('Ícono')).toBe('imagen') // sinAcentos normaliza antes de comparar
    expect(tipoCampo('Banner_Footer')).toBe('imagen')
  })

  it('cae en texto cuando no matchea ninguna palabra clave', () => {
    expect(tipoCampo('Nombre')).toBe('texto')
    expect(tipoCampo('Empresa')).toBe('texto')
  })
})

describe('valorPorDefecto — valores de arranque por tipo', () => {
  it('usa la URL de ejemplo real para link e imagen, nunca un placeholder que rompa el href/src', () => {
    expect(valorPorDefecto('LinkBoton')).toBe('https://www.icbc.com.ar/personas')
    expect(valorPorDefecto('ImagenHeader')).toContain('https://')
  })

  it('usa "{Campo} Test" para campos de texto', () => {
    expect(valorPorDefecto('Nombre')).toBe('Nombre Test')
  })
})

describe('escaparValorCsv — RFC 4180', () => {
  it('no toca valores sin caracteres especiales', () => {
    expect(escaparValorCsv('Juan Perez', ';')).toBe('Juan Perez')
  })

  it('envuelve en comillas un valor que contiene el separador', () => {
    expect(escaparValorCsv('Av. Corrientes; CABA', ';')).toBe('"Av. Corrientes; CABA"')
  })

  it('envuelve en comillas y duplica comillas internas', () => {
    expect(escaparValorCsv('Dijo "hola"', ';')).toBe('"Dijo ""hola"""')
  })

  it('envuelve en comillas un valor con salto de línea', () => {
    expect(escaparValorCsv('Linea1\nLinea2', ';')).toBe('"Linea1\nLinea2"')
  })

  it('trata null/undefined como string vacío', () => {
    expect(escaparValorCsv(undefined, ';')).toBe('')
    expect(escaparValorCsv(null, ';')).toBe('')
  })
})

describe('generarCsvBaseTest — caso feliz', () => {
  it('arma header + una fila por email, con los mismos valores en todas las filas', () => {
    const csv = generarCsvBaseTest(
      ['Nombre', 'LinkBoton'],
      { Nombre: 'Juan', LinkBoton: 'https://ejemplo.com' },
      ['a@test.com', 'b@test.com'],
    )
    expect(csv).toBe(
      'Email;Nombre;LinkBoton\n' +
      'a@test.com;Juan;https://ejemplo.com\n' +
      'b@test.com;Juan;https://ejemplo.com'
    )
  })

  it('descarta emails vacíos o solo espacios', () => {
    const csv = generarCsvBaseTest(['Nombre'], { Nombre: 'Juan' }, ['a@test.com', '  ', ''])
    expect(csv.split('\n')).toHaveLength(2) // header + 1 fila
  })
})

describe('generarCsvBaseTest — regresión del bug de escape (revisión 2026-07-19)', () => {
  it('un valor de prueba con el separador adentro no corre las columnas de la fila', () => {
    const csv = generarCsvBaseTest(
      ['Direccion', 'Telefono'],
      { Direccion: 'Av. Corrientes; CABA', Telefono: '11-5555-5555' },
      ['a@test.com'],
    )
    const filaDatos = csv.split('\n')[1]
    // El valor queda entre comillas — un parser CSV real (Excel, etc.)
    // lo lee como una sola celda pese al ';' interno. Un split(';')
    // ingenuo (sin respetar comillas) SÍ lo partiría mal, que es
    // justamente la razón por la que hace falta el escape.
    expect(filaDatos).toBe('a@test.com;"Av. Corrientes; CABA";11-5555-5555')
  })

  it('un valor con comillas dobles no rompe el parseo de la celda', () => {
    const csv = generarCsvBaseTest(['Cita'], { Cita: 'Dijo "hola" ayer' }, ['a@test.com'])
    expect(csv.split('\n')[1]).toBe('a@test.com;"Dijo ""hola"" ayer"')
  })

  it('un nombre de columna con el separador también se escapa', () => {
    const csv = generarCsvBaseTest(['Nombre;Apellido'], { 'Nombre;Apellido': 'Juan' }, ['a@test.com'])
    expect(csv.split('\n')[0]).toBe('Email;"Nombre;Apellido"')
  })
})

describe('emailValido', () => {
  it('acepta formatos básicos válidos', () => {
    expect(emailValido('test@icomm.com.ar')).toBe(true)
  })

  it('rechaza formatos claramente inválidos', () => {
    expect(emailValido('no-es-un-email')).toBe(false)
    expect(emailValido('falta@dominio')).toBe(false)
    expect(emailValido('  ')).toBe(false)
  })
})

describe('reemplazarCampos — preview en vivo', () => {
  it('reemplaza cada <*Campo*> por su valor actual', () => {
    const html = '<td>Hola <*Nombre*>, mirá <*LinkBoton*></td>'
    const out = reemplazarCampos(html, { Nombre: 'Juan', LinkBoton: 'https://x.com' }, 'test@x.com')
    expect(out).toBe('<td>Hola Juan, mirá https://x.com</td>')
  })

  it('completa <*Email*> con el email de preview, no con valoresCampos', () => {
    const html = '<td><*Email*></td>'
    const out = reemplazarCampos(html, {}, 'preview@x.com')
    expect(out).toBe('<td>preview@x.com</td>')
  })

  it('desescapa entidades &lt;* *&gt; antes de buscar campos', () => {
    const html = '<td>Hola &lt;*Nombre*&gt;</td>'
    const out = reemplazarCampos(html, { Nombre: 'Juan' }, 'x@x.com')
    expect(out).toBe('<td>Hola Juan</td>')
  })

  it('deja el placeholder intacto si el campo no tiene valor cargado', () => {
    const html = '<td><*SinValor*></td>'
    const out = reemplazarCampos(html, {}, 'x@x.com')
    expect(out).toBe('<td><*SinValor*></td>')
  })
})
