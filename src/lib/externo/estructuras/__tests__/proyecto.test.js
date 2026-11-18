import { describe, expect, it } from 'vitest'
import { estadoInicial } from '../estado.js'
import { FORMATO_PROYECTO, nombreArchivoProyecto, proyectoAJson, proyectoDesdeJson } from '../proyecto.js'
import { generarBloque } from '../bloque.js'
import { generarCsv } from '../pedido.js'

describe('guardar y abrir un proyecto', () => {
  it('ida y vuelta: lo abierto genera el mismo bloque y la misma base', () => {
    const e = estadoInicial()
    e.config.columnas[1].titulo = 'Detalle'
    e.config.encabezado.alineacion = 'right'
    e.pedido.contactos[0].email = 'a@b.com'
    e.pedido.contactos[0].filas[0][1] = 'hola'
    const r = proyectoDesdeJson(proyectoAJson(e))
    expect(r.error).toBeUndefined()
    expect(generarBloque(r.estado.config)).toBe(generarBloque(e.config))
    expect(generarCsv(r.estado.config, r.estado.pedido)).toBe(generarCsv(e.config, e.pedido))
  })
  it('lleva la marca y la versión del formato', () => {
    const v = JSON.parse(proyectoAJson(estadoInicial()))
    expect(v.formato).toBe(FORMATO_PROYECTO)
    expect(v.version).toBe(1)
  })
  it('rechaza texto vacío, JSON roto y archivos que no son un proyecto', () => {
    expect(proyectoDesdeJson('').error).toMatch(/No hay contenido/)
    expect(proyectoDesdeJson('{no').error).toMatch(/no es válido/)
    expect(proyectoDesdeJson('{"a":1}').error).toMatch(/no corresponde a un proyecto/)
    expect(proyectoDesdeJson('[]').error).toMatch(/no corresponde a un proyecto/)
  })
  it('rechaza una versión más nueva y un proyecto sin columnas', () => {
    const v = JSON.parse(proyectoAJson(estadoInicial()))
    expect(proyectoDesdeJson(JSON.stringify({ ...v, version: 99 })).error).toMatch(/más reciente/)
    expect(proyectoDesdeJson(JSON.stringify({ ...v, config: { ...v.config, columnas: [] } })).error).toMatch(/no contiene columnas/)
  })
  it('rechaza más columnas que el máximo', () => {
    const v = JSON.parse(proyectoAJson(estadoInicial()))
    v.config.columnas = Array.from({ length: 20 }, () => v.config.columnas[0])
    expect(proyectoDesdeJson(JSON.stringify(v)).error).toMatch(/supera el límite de 6 columnas/)
  })
  it('completa con valores por defecto lo que falte (archivos de versiones viejas)', () => {
    const v = JSON.parse(proyectoAJson(estadoInicial()))
    delete v.config.encabezado.alineacion
    delete v.config.columnas[0].sinTitulo
    const r = proyectoDesdeJson(JSON.stringify(v))
    expect(r.estado.config.encabezado.alineacion).toBe('columna')
    expect(r.estado.config.columnas[0].sinTitulo).toBe(false)
  })
  it('sanea el pedido: tipos, máximos y filas con la cantidad de columnas', () => {
    const v = JSON.parse(proyectoAJson(estadoInicial()))
    v.pedido = { variables: Array(50).fill('x'), contactos: Array.from({ length: 40 }, () => ({ email: 5, filas: [[1, null]] })) }
    const { estado } = proyectoDesdeJson(JSON.stringify(v))
    expect(estado.pedido.variables.length).toBe(5)
    expect(estado.pedido.contactos.length).toBe(10)
    expect(estado.pedido.contactos[0].email).toBe('5')
    expect(estado.pedido.contactos[0].filas[0]).toHaveLength(estado.config.columnas.length)
  })
  it('el nombre de archivo sale del nombre del campo', () => {
    expect(nombreArchivoProyecto({ nombreCampo: 'datos_tabla' })).toBe('datos_tabla.proyecto.json')
    expect(nombreArchivoProyecto({ nombreCampo: '' })).toBe('tabla.proyecto.json')
  })
})
