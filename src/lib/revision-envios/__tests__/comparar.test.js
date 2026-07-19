import { describe, it, expect } from 'vitest'
import {
  detectSep, parseHeaders, extractFields, validateCsvHeaders, compararCampos,
} from '@/lib/revision-envios/comparar'

describe('detectSep', () => {
  it('detecta ; como separador más común', () => {
    expect(detectSep('Email;Nombre;Empresa')).toBe(';')
  })

  it('detecta , cuando es el que más se repite', () => {
    expect(detectSep('Email,Nombre,Empresa')).toBe(',')
  })

  it('detecta tab', () => {
    expect(detectSep('Email\tNombre\tEmpresa')).toBe('\t')
  })

  it('con una sola columna (sin separador real) no rompe', () => {
    expect(() => detectSep('SoloUnaColumna')).not.toThrow()
  })
})

describe('parseHeaders', () => {
  it('parsea la primera línea y descarta vacíos', () => {
    expect(parseHeaders('Email;Nombre;Empresa\notros;datos')).toEqual(['Email', 'Nombre', 'Empresa'])
  })

  it('recorta espacios de cada columna', () => {
    expect(parseHeaders('Email ; Nombre ;Empresa')).toEqual(['Email', 'Nombre', 'Empresa'])
  })
})

describe('extractFields', () => {
  it('extrae todos los <*Campo*> sin duplicados', () => {
    const html = '<td><*Nombre*> - <*Empresa*> - <*Nombre*></td>'
    expect(extractFields(html)).toEqual(new Set(['Nombre', 'Empresa']))
  })

  it('recorta espacios dentro del campo', () => {
    expect(extractFields('<*  Nombre  *>')).toEqual(new Set(['Nombre']))
  })

  it('desescapa entidades &lt;* *&gt; antes de buscar', () => {
    expect(extractFields('&lt;*Nombre*&gt;')).toEqual(new Set(['Nombre']))
  })

  it('devuelve set vacío si no hay campos', () => {
    expect(extractFields('<td>Sin campos acá</td>').size).toBe(0)
  })
})

describe('validateCsvHeaders', () => {
  it('sin texto no devuelve avisos', () => {
    expect(validateCsvHeaders('')).toEqual([])
  })

  it('avisa de caracteres inválidos en una columna', () => {
    const avisos = validateCsvHeaders('Email;Nombre Completo')
    const aviso = avisos.find(a => a.tipo === 'caracteres_invalidos')
    expect(aviso).toBeDefined()
    expect(aviso.campo).toBe('Nombre Completo')
    expect(aviso.chars[' ']).toBeDefined()
  })

  it('error si falta la columna Email exacta', () => {
    const avisos = validateCsvHeaders('Nombre;Empresa')
    const aviso = avisos.find(a => a.tipo === 'falta_email')
    expect(aviso.severidad).toBe('error')
  })

  it('sugiere columnas parecidas cuando falta Email exacto', () => {
    const avisos = validateCsvHeaders('E-mail;Nombre')
    const aviso = avisos.find(a => a.tipo === 'falta_email')
    expect(aviso.suspects).toContain('E-mail')
  })

  it('no avisa falta_email si está presente (case-insensitive)', () => {
    const avisos = validateCsvHeaders('EMAIL;Nombre')
    expect(avisos.find(a => a.tipo === 'falta_email')).toBeUndefined()
  })

  it('detecta columnas duplicadas case-insensitive', () => {
    const avisos = validateCsvHeaders('Email;Nombre;email')
    const aviso = avisos.find(a => a.tipo === 'duplicado')
    expect(aviso).toBeDefined()
    expect(aviso.campos).toEqual(['Email', 'email'])
  })
})

describe('compararCampos — el corazón de la herramienta', () => {
  it('separa campos en ok / miss / unused correctamente', () => {
    const headers = 'Email;Nombre;Empresa'
    const html = '<*Nombre*> <*Telefono*>'
    const r = compararCampos(headers, html)
    expect(r.ok).toEqual(['Nombre'])
    expect(r.miss).toEqual(['Telefono'])
    expect(r.unused).toEqual(['Email', 'Empresa'])
  })

  it('el match es case-insensitive entre HTML y header', () => {
    const r = compararCampos('Email;NOMBRE', '<*nombre*>')
    expect(r.ok).toEqual(['nombre'])
    expect(r.miss).toEqual([])
  })

  it('sin campos en el HTML, ok y miss quedan vacíos', () => {
    const r = compararCampos('Email;Nombre', '<td>Sin campos</td>')
    expect(r.ok).toEqual([])
    expect(r.miss).toEqual([])
    expect(r.unused).toEqual(['Email', 'Nombre'])
  })
})
