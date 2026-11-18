import { describe, it, expect } from 'vitest'
import { configInicial, columnaNueva, generarBloque } from '../bloque.js'
import { generarCsv, parsearBase, cargarBase, validarPedido, pedidoInicial, renumerarEjemplo, rellenarImagenes, urlPlaceholder, copiarDatos, regenerarImagenes, textoDePlaceholder, columnaTieneDatos } from '../pedido.js'
import { agregarColumna, quitarColumna, estadoInicial, estadoDesdeGuardado, estadoEnBlanco, cambiarTipoColumna, limpiarContenido } from '../estado.js'
import { EJEMPLOS, celdasDeBase } from '../ejemplos.js'

const cfg3 = () => ({ ...configInicial(), columnas: [1, 2, 3].map(n => ({ ...columnaNueva(n), ancho: n === 1 ? 34 : 33 })) })
const ped = (extra = {}) => ({ variables: [], contactos: [{ email: 'a@b.com', vars: [], filas: [['x', 'y', 'z'], ['1', '2', '3']] }], ...extra })

describe('generarCsv', () => {
  it('email;campo con filas separadas por || y terminadas en ##', () => {
    expect(generarCsv(cfg3(), ped())).toBe('email;datos_tabla\na@b.com;x||y||z##1||2||3##')
  })
  it('el campo tipo tabla va SIEMPRE último, aunque haya variables', () => {
    const csv = generarCsv(cfg3(), ped({ variables: ['nombre', 'total'], contactos: [{ email: 'a@b.com', vars: ['Ana', '$5'], filas: [['x', 'y', 'z']] }] }))
    expect(csv).toBe('email;nombre;total;datos_tabla\na@b.com;Ana;$5;x||y||z##')
  })
  it('usa el nombre de campo elegido', () => {
    expect(generarCsv({ ...cfg3(), nombreCampo: 'mis_filas' }, ped()).split('\n')[0]).toBe('email;mis_filas')
  })
  it('las filas vacías no entran', () => {
    const p = ped(); p.contactos[0].filas.push(['', '', ''])
    expect(generarCsv(cfg3(), p)).toBe('email;datos_tabla\na@b.com;x||y||z##1||2||3##')
  })
  it('en columnas de imagen la celda es el <img> armado desde la URL', () => {
    const c = configInicial()
    const p = { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas: [['https://a.com/1.png', 'd', '2', '$3']] }] }
    const csv = generarCsv(c, p)
    expect(csv).toContain("<img src='https://a.com/1.png' style='width: 90px;")
    expect(csv).toContain("alt='Producto' />||d||2||$3##")
  })
})

describe('parsearBase / cargarBase', () => {
  it('ida y vuelta: lo generado se vuelve a leer igual (incluso con ; dentro del <img>)', () => {
    const c = configInicial()
    const p = { variables: ['nombre'], contactos: [{ email: 'a@b.com', vars: ['Ana'], filas: [['https://a.com/1.png', 'd', '2', '$3'], ['https://a.com/2.png', 'e', '1', '$4']] }] }
    const csv = generarCsv(c, p)
    const r = cargarBase(csv, c)
    expect(r.error).toBeUndefined()
    expect(r.pedido.variables).toEqual(['nombre'])
    expect(r.pedido.contactos[0].filas).toEqual(p.contactos[0].filas)
    expect(generarCsv(r.config, r.pedido)).toBe(csv)
  })
  it('si el campo no estaba al final, lo avisa y lo deja último', () => {
    const r = cargarBase('email;datos_tabla;nombre\na@b.com;x||y##;Ana', cfg3())
    expect(r.avisos.join(' ')).toMatch(/no estaba al final/)
    expect(generarCsv(r.config, r.pedido).split('\n')[0]).toBe('email;nombre;datos_tabla')
  })
  it('ajusta la cantidad de columnas del diseño a la base', () => {
    const r = cargarBase('email;datos_tabla\na@b.com;x||y##', cfg3())
    expect(r.config.columnas).toHaveLength(2)
    expect(r.config.columnas.reduce((t, c) => t + c.ancho, 0)).toBe(100)
  })
  it('adopta el nombre del campo si la base trae otro', () => {
    const r = cargarBase('email;filas\na@b.com;x||y||z##', cfg3())
    expect(r.config.nombreCampo).toBe('filas')
  })
  it('errores claros', () => {
    expect(parsearBase('solo una línea').error).toMatch(/encabezado/)
    expect(parsearBase('nombre;datos\nx;y').error).toMatch(/email/)
    expect(cargarBase('email;datos_tabla\na@b.com;', cfg3()).error).toMatch(/filas/)
  })
  it('limita contactos y variables', () => {
    const lineas = ['email;a;b;c;d;e;f;datos_tabla']
    for (let i = 0; i < 12; i++) lineas.push(`u${i}@x.com;1;2;3;4;5;6;x||y||z##`)
    const r = cargarBase(lineas.join('\n'), cfg3())
    expect(r.pedido.contactos).toHaveLength(10)
    expect(r.pedido.variables).toHaveLength(5)
  })
  it('lee archivos con BOM y saltos de línea de Windows', () => {
    const r = parsearBase('﻿email;datos_tabla\r\na@b.com;x||y##\r\n')
    expect(r.contactos).toHaveLength(1)
  })
})

describe('validarPedido', () => {
  const niveles = (c, p) => validarPedido(c, p).map(r => r.nivel)
  it('un pedido correcto no tiene errores', () => expect(niveles(cfg3(), ped())).not.toContain('error'))
  it('email faltante, repetido e inválido', () => {
    const p = ped(); p.contactos.push({ email: 'a@b.com', vars: [], filas: [['1', '2', '3']] }, { email: '', vars: [], filas: [['1', '2', '3']] }, { email: 'malo', vars: [], filas: [['1', '2', '3']] })
    const m = validarPedido(cfg3(), p).map(r => r.mensaje).join('|')
    expect(m).toMatch(/repetido/); expect(m).toMatch(/falta el email/); expect(m).toMatch(/no parece válido/)
  })
  it('|| y ## dentro de una celda', () => {
    const p = ped(); p.contactos[0].filas[0][0] = 'a||b'
    expect(validarPedido(cfg3(), p).some(r => r.nivel === 'error' && /\|\|/.test(r.mensaje))).toBe(true)
  })
  it('; en una variable', () => {
    const p = ped({ variables: ['nombre'] }); p.contactos[0].vars = ['a;b']
    expect(validarPedido(cfg3(), p).some(r => r.nivel === 'error' && /;/.test(r.mensaje))).toBe(true)
  })
  it('variables repetidas, vacías o con el nombre del campo', () => {
    const p = ped({ variables: ['nombre', 'Nombre', '', 'datos_tabla'] }); p.contactos[0].vars = ['', '', '', '']
    expect(validarPedido(cfg3(), p).filter(r => r.nivel === 'error').length).toBeGreaterThanOrEqual(3)
  })
  it('URL de imagen inválida', () => {
    const c = configInicial()
    const p = { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas: [['no-es-url', 'd', '1', '$1']] }] }
    expect(validarPedido(c, p).some(r => r.nivel === 'error' && /URL/.test(r.mensaje))).toBe(true)
  })
})

describe('estado conjunto', () => {
  it('agregar y quitar columnas mantiene diseño y pedido alineados y suma 100%', () => {
    let e = estadoInicial()
    e = agregarColumna(e)
    expect(e.config.columnas).toHaveLength(5)
    expect(e.pedido.contactos.every(c => c.filas.every(f => f.length === 5))).toBe(true)
    expect(e.config.columnas.reduce((t, c) => t + c.ancho, 0)).toBe(100)
    e = quitarColumna(e, 0)
    expect(e.config.columnas).toHaveLength(4)
    expect(e.pedido.contactos.every(c => c.filas.every(f => f.length === 4))).toBe(true)
  })
  it('no pasa de 6 columnas ni baja de 1', () => {
    let e = estadoInicial()
    for (let i = 0; i < 6; i++) e = agregarColumna(e)
    expect(e.config.columnas).toHaveLength(6)
    e = estadoEnBlanco()
    e = quitarColumna(quitarColumna(e, 0), 0)
    expect(e.config.columnas).toHaveLength(1)
  })
  it('renumera los contactos de ejemplo al borrar uno', () => {
    const config = configInicial()
    const contacto = k => ({
      email: `contacto${k}@ejemplo.com`,
      vars: [],
      filas: [config.columnas.map((c, i) => (c.tipo === 'imagen' ? `https://placehold.co/180x180/e1f8fb/0e316e.png?text=Imagen+${k}.1` : `C${k} dato 1.${i + 1}`))],
    })
    const sin = renumerarEjemplo({ variables: [], contactos: [contacto(1), contacto(3)] })
    expect(sin.contactos[1].email).toBe('contacto2@ejemplo.com')
    expect(sin.contactos[1].filas[0][1]).toMatch(/^C2 dato/)
    expect(sin.contactos[1].filas[0][0]).toContain('Imagen+2.1')
  })
  it('el pedido inicial arranca con un solo contacto', () => {
    expect(pedidoInicial(configInicial()).contactos).toHaveLength(1)
  })
  it('lo guardado se recupera y lo corrupto se descarta', () => {
    const e = estadoInicial()
    expect(estadoDesdeGuardado(JSON.stringify(e)).config.columnas).toHaveLength(4)
    expect(estadoDesdeGuardado('{roto')).toBeNull()
    expect(estadoDesdeGuardado('{"config":{"columnas":[]}}')).toBeNull()
  })
})

describe('ejemplos de la guía', () => {
  it('tabla básica: base de dos campos', () => {
    const e = EJEMPLOS.basica
    const csv = generarCsv(e.config, { variables: e.variables, contactos: [{ email: 't@e.com', vars: e.valores, filas: e.filas }] })
    expect(csv.split('\n')[0]).toBe('email;datos_tabla')
    expect(csv).toContain('Dato 1 columna 1||Dato 1 columna 2||Dato 1 columna 3##Dato 2')
  })
  it('productos: el total es un campo aparte y la tabla va última', () => {
    const e = EJEMPLOS.productos
    const csv = generarCsv(e.config, { variables: e.variables, contactos: [{ email: 't@e.com', vars: e.valores, filas: e.filas }] })
    expect(csv.split('\n')[0]).toBe('email;total;datos_tabla')
    expect(csv.split('\n')[1].startsWith('t@e.com;$42.500;')).toBe(true)
    expect(celdasDeBase(e)[0][0]).toMatch(/^<img src=/)
  })
})

describe('imágenes de relleno', () => {
  it('arma la URL con el doble del ancho (pantallas retina) y el texto codificado', () => {
    expect(urlPlaceholder(90, 'Mi producto 1.2')).toBe('https://placehold.co/180x180/e1f8fb/0e316e.png?text=Mi+producto+1.2')
  })
  it('completa solo las celdas vacías de la columna de imagen elegida', () => {
    const config = configInicial()
    const pedido = { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas: [['', 'x', '1', '$1'], ['https://ya.com/a.png', 'y', '2', '$2']] }] }
    const r = rellenarImagenes(pedido, config, 0)
    expect(r.contactos[0].filas[0][0]).toMatch(/^https:\/\/placehold\.co\/180x180\//)
    expect(r.contactos[0].filas[1][0]).toBe('https://ya.com/a.png')
    expect(r.contactos[0].filas[0][1]).toBe('x')
  })
  it('no toca columnas que no son de imagen', () => {
    const config = configInicial()
    const pedido = { variables: [], contactos: [{ email: '', vars: [], filas: [['', '', '', '']] }] }
    expect(rellenarImagenes(pedido, config, 1)).toBe(pedido)
  })
})

describe('copiar datos de un contacto', () => {
  it('copia filas y variables, mantiene el email del destino y no comparte referencias', () => {
    const origen = { email: 'a@b.com', vars: ['Ana'], filas: [['x', 'y']] }
    const k = copiarDatos(origen, { email: 'nuevo@b.com', vars: [''], filas: [['', '']] })
    expect(k.email).toBe('nuevo@b.com')
    expect(k.vars).toEqual(['Ana'])
    expect(k.filas).toEqual([['x', 'y']])
    k.filas[0][0] = 'z'
    expect(origen.filas[0][0]).toBe('x')
  })
})

describe('texto de las imágenes de relleno', () => {
  const config = configInicial()
  const pedido = { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas: [['', 'x', '1', '$1'], ['', 'y', '2', '$2']] }] }
  it('usa el texto elegido y numera por contacto y fila', () => {
    const r = rellenarImagenes(pedido, config, 0, { texto: 'Mi foto' })
    expect(r.contactos[0].filas[0][0]).toContain('text=Mi+foto+1.1')
    expect(r.contactos[0].filas[1][0]).toContain('text=Mi+foto+1.2')
  })
  it('sin numerar todas dicen lo mismo', () => {
    const r = rellenarImagenes(pedido, config, 0, { texto: 'Foto', numerar: false })
    expect(r.contactos[0].filas[1][0]).toContain('text=Foto')
    expect(r.contactos[0].filas[1][0]).not.toContain('1.2')
  })
  it('el tamaño sigue al ancho configurado de la imagen (el doble)', () => {
    const c = { ...config, columnas: config.columnas.map((x, i) => (i === 0 ? { ...x, imagen: { ...x.imagen, ancho: 100 } } : x)) }
    expect(rellenarImagenes(pedido, c, 0).contactos[0].filas[0][0]).toContain('/200x200/')
  })
  it('el pedido inicial también respeta el ancho de la imagen', () => {
    const c = { ...config, columnas: config.columnas.map((x, i) => (i === 0 ? { ...x, imagen: { ...x.imagen, ancho: 120 } } : x)) }
    expect(pedidoInicial(c).contactos[0].filas[0][0]).toContain('/240x240/')
  })
})

describe('cambiar el tipo de una columna', () => {
  it('de imagen a texto reemplaza las URLs por un texto de ejemplo', () => {
    const e = estadoInicial()
    const r = cambiarTipoColumna(e, 0, 'texto')
    expect(r.config.columnas[0].tipo).toBe('texto')
    expect(r.pedido.contactos[0].filas[0][0]).toBe('C1 dato 1.1')
    expect(r.pedido.contactos[0].filas[1][0]).toBe('C1 dato 2.1')
  })
  it('de texto a imagen vacía los textos de ejemplo automáticos y respeta los escritos a mano', () => {
    const e = estadoInicial()
    const conMano = { ...e, pedido: { ...e.pedido, contactos: [{ ...e.pedido.contactos[0], filas: [['', 'C1 dato 1.2', 'a', 'b'], ['', 'Hola', 'a', 'b']] }] } }
    const r = cambiarTipoColumna(conMano, 1, 'imagen')
    expect(r.pedido.contactos[0].filas[0][1]).toBe('')
    expect(r.pedido.contactos[0].filas[1][1]).toBe('Hola')
  })
  it('no toca nada si el tipo es el mismo', () => {
    const e = estadoInicial()
    expect(cambiarTipoColumna(e, 0, 'imagen')).toBe(e)
  })
})

describe('colores de las imágenes de relleno', () => {
  it('la URL lleva el fondo y el color de texto elegidos (sin #)', () => {
    expect(urlPlaceholder(90, 'Hola', { fondo: '#FF0000', color: '#ffffff' })).toBe('https://placehold.co/180x180/ff0000/ffffff.png?text=Hola')
  })
  it('un color inválido cae al de siempre', () => {
    expect(urlPlaceholder(90, 'Hola', { fondo: 'zzz', color: '' })).toBe('https://placehold.co/180x180/e1f8fb/0e316e.png?text=Hola')
  })
  it('lee el texto de una URL de relleno', () => {
    expect(textoDePlaceholder('https://placehold.co/180x180/e1f8fb/0e316e.png?text=Mi+foto+1.2')).toBe('Mi foto 1.2')
    expect(textoDePlaceholder('https://otro.com/a.png?text=x')).toBe('')
  })
  it('regenerar rehace solo las de relleno con el tamaño y colores nuevos y conserva el texto', () => {
    const base = configInicial()
    const config = { ...base, columnas: base.columnas.map((c, i) => (i === 0 ? { ...c, imagen: { ...c.imagen, ancho: 100 } } : c)) }
    const pedido = { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas: [
      ['https://placehold.co/180x180/e1f8fb/0e316e.png?text=Foto+1.1', 'x', '1', '$1'],
      ['https://mi-sitio.com/real.png', 'y', '2', '$2'],
      ['', 'z', '3', '$3'],
    ] }] }
    const r = regenerarImagenes(pedido, config, 0, { fondo: '#000000', color: '#ffffff' })
    expect(r.contactos[0].filas[0][0]).toBe('https://placehold.co/200x200/000000/ffffff.png?text=Foto+1.1')
    expect(r.contactos[0].filas[1][0]).toBe('https://mi-sitio.com/real.png')
    expect(r.contactos[0].filas[2][0]).toBe('')
  })
  it('rellenar usa los colores elegidos', () => {
    const config = configInicial()
    const pedido = { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas: [['', 'x', '1', '$1']] }] }
    expect(rellenarImagenes(pedido, config, 0, { fondo: '#111111', color: '#eeeeee' }).contactos[0].filas[0][0]).toContain('/111111/eeeeee.png')
  })
})

describe('datos de una columna y limpiar contenido', () => {
  it('detecta si una columna tiene algo cargado', () => {
    const p = { variables: [], contactos: [{ email: '', vars: [], filas: [['', 'x'], ['', '']] }] }
    expect(columnaTieneDatos(p, 0)).toBe(false)
    expect(columnaTieneDatos(p, 1)).toBe(true)
  })
  it('limpiar contenido deja el diseño y un contacto vacío', () => {
    const e = estadoInicial()
    const l = limpiarContenido(e)
    expect(l.config).toBe(e.config)
    expect(l.pedido.contactos).toHaveLength(1)
    expect(l.pedido.contactos[0].email).toBe('')
  })
  it('un encabezado vacío no es un error de la base (los encabezados no viajan en ella)', () => {
    const config = configInicial()
    config.columnas[1].titulo = ''
    const p = { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas: [['', 'x', '1', '$1']] }] }
    expect(validarPedido({ ...config, columnas: config.columnas.map((c, i) => (i === 0 ? { ...c, tipo: 'texto' } : c)) }, p).some(a => /encabezado/i.test(a.mensaje))).toBe(false)
  })
})

describe('anchos al agregar y quitar columnas', () => {
  it('agregar achica proporcionalmente las otras y suma 100', () => {
    const e = estadoInicial() // 20 40 15 25
    const r = agregarColumna(e)
    const a = r.config.columnas.map(c => c.ancho)
    expect(a.reduce((t, x) => t + x, 0)).toBe(100)
    expect(a[1]).toBeGreaterThan(a[0]) // se mantiene que la 2 es más ancha que la 1
    expect(a[1]).toBeGreaterThan(a[2])
  })
  it('quitar reparte lo liberado en proporción y suma 100', () => {
    const e = estadoInicial()
    const r = quitarColumna(e, 3)
    const a = r.config.columnas.map(c => c.ancho)
    expect(a.reduce((t, x) => t + x, 0)).toBe(100)
    expect(a[1]).toBeGreaterThan(a[2])
  })
})

describe('alt de las imágenes', () => {
  it('el bloque y el CSV usan el mismo alt (el nombre de la columna si no hay uno propio)', () => {
    const config = configInicial()
    config.columnas[0].imagen = { ...config.columnas[0].imagen, alt: '' }
    const filas = [['https://x.com/a.png', 'd', '1', '$1']]
    const csv = generarCsv(config, { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas }] })
    const bloque = generarBloque(config, { modo: 'ejemplo', filas })
    expect(csv).toContain("alt='Producto'")
    expect(bloque).toContain("alt='Producto'")
  })
})

describe('imagen.ejemplo retirado (v11)', () => {
  it('al abrir un guardado o proyecto viejo se descarta el campo imagen.ejemplo', () => {
    const e = estadoInicial()
    const i = e.config.columnas.findIndex(c => c.tipo === 'imagen')
    e.config.columnas[i].imagen.ejemplo = 'https://x.com/a.png'
    const r = estadoDesdeGuardado(JSON.stringify(e))
    expect('ejemplo' in r.config.columnas[i].imagen).toBe(false)
  })
  it('una URL inválida en una celda es error de la base y sale vacía en el CSV', () => {
    const config = configInicial()
    const i = config.columnas.findIndex(c => c.tipo === 'imagen')
    const fila = config.columnas.map((c, k) => (k === i ? 'foto.png' : 'x'))
    const p = { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas: [fila] }] }
    expect(validarPedido(config, p).some(a => a.nivel === 'error' && /http/.test(a.mensaje))).toBe(true)
    expect(generarCsv(config, p)).not.toContain('<img')
  })
  it('la imagen de relleno del paso 5 sale en la base, y el recuadro gris de la vista no se exporta', () => {
    const config = configInicial()
    const i = config.columnas.findIndex(c => c.tipo === 'imagen')
    const url = urlPlaceholder(90, 'Foto 1.1', {})
    const filas = [config.columnas.map((c, k) => (k === i ? url : 'x')), config.columnas.map((c, k) => (k === i ? '' : 'x'))]
    const p = { variables: [], contactos: [{ email: 'a@b.com', vars: [], filas }] }
    expect(generarCsv(config, p)).toContain('placehold.co')
    expect(generarCsv(config, p)).not.toContain('data:image/svg')
    expect(generarBloque(config, { modo: 'ejemplo', filas })).not.toContain('data:image/svg')
  })
})
