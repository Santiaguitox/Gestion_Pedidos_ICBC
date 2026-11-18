import { describe, it, expect } from 'vitest'
import { configInicial, generarBloque, generarVistaPrevia, anchoTabla, maxAnchoImagen, repartirAnchos, escalarAnchos, validarConfig, filasDeEjemplo, columnaNueva } from '../bloque.js'
import { construirImg, validarUrlImagen, extraerUrlImagen } from '../imagen.js'

const cfg = (cambios = {}) => ({ ...configInicial(), ...cambios })

describe('generarBloque', () => {
  it('es un único <tr> raíz', () => {
    const h = generarBloque(configInicial())
    expect(h.startsWith('<tr>')).toBe(true)
    expect(h.trimEnd().endsWith('</tr>')).toBe(true)
  })
  it('el nombre del campo aparece en los tres lugares', () => {
    const h = generarBloque(cfg({ nombreCampo: 'mis_filas' }))
    expect(h).toContain('<!--CampoTabla_mis_filas--> &lt;*mis_filas*&gt;')
    expect(h).toContain('<!--/CampoTabla_mis_filas-->')
    expect(h).not.toContain('datos_tabla')
  })
  it('los márgenes definen los td laterales y el ancho de la tabla (600 - 2 x margen)', () => {
    const h = generarBloque(cfg({ margen: 40 }))
    expect(h.match(/<td style="width: 40px; font-size: 0;" width="40">&nbsp;<\/td>/g)).toHaveLength(2)
    expect(h).toContain('<table style="width: 520px;" width="520"')
    expect(anchoTabla({ margen: 40 })).toBe(520)
  })
  it('sin margen no deja td laterales', () => {
    const h = generarBloque(cfg({ margen: 0 }))
    expect(h).not.toContain('font-size: 0;" width=')
    expect(h).toContain('width="600"')
  })
  it('los anchos de columna salen en % en style y en el atributo width', () => {
    const h = generarBloque(configInicial())
    for (const w of [20, 40, 15, 25]) {
      expect(h).toContain(`width: ${w}%;`)
      expect(h).toContain(`width="${w}%"`)
    }
  })
  it('la plantilla lleva encabezado y una fila modelo con celdas vacías', () => {
    const h = generarBloque(configInicial())
    expect(h.match(/<tr>/g)).toHaveLength(5) // 3 de contenedores + encabezado + 1 fila modelo
    expect(h).toContain('>Producto</td>')
    expect(h).toMatch(/align="center"[^>]*><\/td>/)
  })
  it('usa bgcolor y background-color', () => {
    const h = generarBloque(configInicial())
    expect(h).toContain('bgcolor="#e1f8fb"')
    expect(h).toContain('background-color: #e1f8fb;')
  })
  it('los bordes salen solo en los lados elegidos', () => {
    const c = configInicial()
    c.encabezado.bordes = { arriba: true, abajo: false, izquierda: false, derecha: false, divisores: false }
    c.encabezado.borde = { ancho: 3, color: '#ff0000' }
    const h = generarBloque(c)
    expect(h).toContain('border-top: solid 3px #ff0000;')
    expect(h).not.toContain('border-right: solid 3px #ff0000;')
  })
  it('la separación entre filas es línea, espacio o nada', () => {
    const c = configInicial()
    c.cuerpo.separacion = { tipo: 'espacio', ancho: 8, color: '#ffffff' }
    expect(generarBloque(c)).toContain('border-bottom: solid 8px #ffffff;')
    c.cuerpo.separacion = { tipo: 'ninguna', ancho: 1, color: '#000000' }
    expect(generarBloque(c)).not.toContain('border-bottom')
  })
  it('escapa el texto de los encabezados', () => {
    const c = configInicial()
    c.columnas[0].titulo = 'A <b>&</b>'
    expect(generarBloque(c)).toContain('A &lt;b&gt;&amp;&lt;/b&gt;')
  })
  it('colores inválidos caen a un valor seguro en vez de romper el HTML', () => {
    const c = configInicial()
    c.encabezado.fondo = '"><script>'
    const h = generarBloque(c)
    expect(h).not.toContain('<script>')
  })
  it('la vista previa marca fila y columna en cada celda y usa imagen de relleno sin URL', () => {
    const v = generarVistaPrevia(configInicial(), filasDeEjemplo(configInicial()))
    expect(v).toContain('data-f="0" data-c="0"')
    expect(v).toContain('data-f="3" data-c="3"')
    expect(v).toContain('data:image/svg+xml')
  })
  it('el HTML exportado no lleva marcas de vista previa ni imágenes de relleno', () => {
    const h = generarBloque(configInicial(), { modo: 'ejemplo', filas: filasDeEjemplo(configInicial()) })
    expect(h).not.toContain('data-f=')
    expect(h).not.toContain('data:image')
  })
})

describe('anchos', () => {
  it('repartirAnchos suma siempre 100', () => {
    for (let n = 1; n <= 6; n++) expect(repartirAnchos(n).reduce((a, b) => a + b, 0)).toBe(100)
  })
  it('máximo de imagen = ancho de la columna menos el padding de los dos lados', () => {
    const c = configInicial() // tabla 540, columna 20% = 108, padding 5
    expect(maxAnchoImagen(c, c.columnas[0])).toBe(98)
  })
})

describe('validarConfig', () => {
  const errores = c => validarConfig(c).filter(r => r.nivel === 'error')
  it('el diseño inicial es válido', () => expect(errores(configInicial())).toHaveLength(0))
  it('anchos que no suman 100', () => {
    const c = configInicial()
    c.columnas[0].ancho = 30
    expect(errores(c).some(e => e.campo === 'anchos')).toBe(true)
  })
  it('imagen más ancha que la columna', () => {
    const c = configInicial()
    c.columnas[0].imagen.ancho = 120
    expect(errores(c).some(e => e.campo.startsWith('imagen-'))).toBe(true)
  })
  it('margen que deja la tabla muy angosta', () => {
    expect(errores(cfg({ margen: 150 })).some(e => e.campo === 'margen')).toBe(true)
  })
  it('nombre de campo inválido', () => {
    expect(errores(cfg({ nombreCampo: 'a b' })).some(e => e.campo === 'nombreCampo')).toBe(true)
  })
  it('encabezado vacío es aviso, no error', () => {
    const c = configInicial()
    c.columnas[1].titulo = ''
    expect(validarConfig(c).some(r => r.nivel === 'aviso')).toBe(true)
    expect(errores(c)).toHaveLength(0)
  })
  it('una columna nueva tiene valores por defecto razonables', () => {
    expect(columnaNueva(3).titulo).toBe('Columna 3')
  })
})

describe('imagen', () => {
  it('arma el <img> con width como atributo y estilos para Outlook', () => {
    const h = construirImg({ url: 'https://x.com/a.png?v=1&w=2', ancho: 90, alt: "Cafe 'bar'" })
    expect(h).toBe("<img src='https://x.com/a.png?v=1&w=2' style='width: 90px; max-width: 90px; display: block; border: solid 0px; margin-left:auto; margin-right:auto;' width='90' border='0' alt='Cafe &#39;bar&#39;' />")
  })
  it('sin URL válida no devuelve nada', () => {
    expect(construirImg({ url: 'javascript:alert(1)' })).toBe('')
    expect(construirImg({ url: '' })).toBe('')
  })
  it('valida la URL', () => {
    expect(validarUrlImagen('https://a.com/x.png').ok).toBe(true)
    expect(validarUrlImagen('a.com/x.png').ok).toBe(false)
    expect(validarUrlImagen("https://a.com/x'.png").ok).toBe(false)
    expect(validarUrlImagen('https://a.com/x y.png').ok).toBe(false)
  })
  it('extrae la URL de un <img> existente', () => {
    expect(extraerUrlImagen("<img src='https://a.com/x.png' width='9' />")).toBe('https://a.com/x.png')
    expect(extraerUrlImagen('https://a.com/x.png')).toBe('https://a.com/x.png')
    expect(extraerUrlImagen('hola')).toBe('')
  })
})

describe('estilo de borde', () => {
  it('usa el estilo elegido en bordes y en la línea entre filas', () => {
    const c = configInicial()
    c.cuerpo.bordes = { izquierda: true, derecha: false, divisores: false }
    c.cuerpo.borde = { ancho: 2, color: '#112233', estilo: 'dotted' }
    c.cuerpo.separacion = { tipo: 'linea', ancho: 1, color: '#c0c0c0', estilo: 'dashed' }
    const h = generarBloque(c)
    expect(h).toContain('border-left: dotted 2px #112233;')
    expect(h).toContain('border-bottom: dashed 1px #c0c0c0;')
  })
  it('el espacio entre filas es siempre sólido', () => {
    const c = configInicial()
    c.cuerpo.separacion = { tipo: 'espacio', ancho: 8, color: '#ffffff', estilo: 'dotted' }
    expect(generarBloque(c)).toContain('border-bottom: solid 8px #ffffff;')
  })
  it('un estilo desconocido cae a sólido', () => {
    const c = configInicial()
    c.cuerpo.separacion = { tipo: 'linea', ancho: 1, color: '#c0c0c0', estilo: 'groove' }
    expect(generarBloque(c)).toContain('border-bottom: solid 1px #c0c0c0;')
  })
  it('avisa si el borde doble mide menos de 3 px', () => {
    const c = configInicial()
    c.cuerpo.separacion = { tipo: 'linea', ancho: 1, color: '#c0c0c0', estilo: 'double' }
    expect(validarConfig(c).some(a => a.campo === 'borde-doble' && a.nivel === 'aviso')).toBe(true)
    c.cuerpo.separacion.ancho = 3
    expect(validarConfig(c).some(a => a.campo === 'borde-doble')).toBe(false)
  })
})

describe('columnas con ajustes propios', () => {
  it('el alto es opcional: vacío no escribe height', () => {
    const h = generarBloque(configInicial())
    expect(h).not.toMatch(/ height="/)
    const c = configInicial()
    c.cuerpo.alto = 40
    c.encabezado.alto = 32
    const h2 = generarBloque(c)
    expect(h2).toContain(' height="40"')
    expect(h2).toContain(' height="32"')
  })
  it('cada columna puede tener su color de encabezado', () => {
    const c = configInicial()
    c.columnas[1].encabezadoFondo = '#ff0000'
    c.columnas[1].encabezadoColor = '#ffffff'
    const h = generarBloque(c)
    expect(h).toContain('background-color: #ff0000;')
    expect(h).toContain('bgcolor="#ff0000">Descripción</td>')
    expect(h.match(/bgcolor="#e1f8fb"/g)).toHaveLength(3)
  })
  it('sin texto deja el encabezado en blanco y no avisa', () => {
    const c = configInicial()
    c.columnas[2].sinTitulo = true
    expect(generarBloque(c)).toMatch(/bgcolor="#e1f8fb">&nbsp;<\/td>/)
    expect(validarConfig(c).some(a => a.campo.startsWith('titulo-'))).toBe(false)
    c.columnas[2].sinTitulo = false
    c.columnas[2].titulo = ''
    const av = validarConfig(c).find(a => a.campo.startsWith('titulo-'))
    expect(av.nivel).toBe('aviso')
  })
  it('el texto de cada columna puede tener tamaño, interlineado y color propios', () => {
    const c = configInicial()
    c.columnas[3].tamano = 20
    c.columnas[3].interlineado = 26
    c.columnas[3].color = '#ff00aa'
    const h = generarBloque(c)
    expect(h).toContain('font-size: 20px;')
    expect(h).toContain('line-height: 26px;')
    expect(h).toContain('color: #ff00aa;')
    expect(h).toContain('font-size: 14px;')
  })
})

describe('alineación del encabezado y pasos de los avisos', () => {
  it('por defecto el encabezado sigue la alineación de cada columna', () => {
    const c = configInicial() // columnas: center, left, center, center
    const h = generarBloque(c)
    expect(h).toMatch(/text-align: left;[^>]*align="left" bgcolor="#e1f8fb">Descripción/)
  })
  it('se puede fijar una alineación para todo el encabezado', () => {
    const c = configInicial()
    c.encabezado.alineacion = 'right'
    const h = generarBloque(c)
    expect(h).toMatch(/align="right" bgcolor="#e1f8fb">Descripción/)
    expect(h).toMatch(/align="right" bgcolor="#e1f8fb">Producto/)
  })
  it('cada aviso dice en qué paso se corrige', () => {
    const c = configInicial()
    c.nombreCampo = '1mal'
    c.columnas[0].ancho = 50
    c.cuerpo.color = 'zzz'
    const por = Object.fromEntries(validarConfig(c).map(a => [a.campo, a.paso]))
    expect(por.nombreCampo).toBe(1)
    expect(por.anchos).toBe(4)
    expect(por.cuerpo).toBe(3)
    expect(validarConfig(c).every(a => [1, 2, 3, 4].includes(a.paso))).toBe(true)
  })
})

describe('escalarAnchos', () => {
  it('mantiene proporciones y suma el objetivo', () => {
    const r = escalarAnchos([20, 40, 15, 25], 80)
    expect(r.reduce((t, x) => t + x, 0)).toBe(80)
    expect(r[1]).toBe(32)
  })
  it('si algún ancho quedara menor a 5 reparte parejo', () => {
    expect(escalarAnchos([5, 5, 90], 50).reduce((t, x) => t + x, 0)).toBe(100)
  })
})

describe('textos de validación (v11)', () => {
  it('los avisos de color nombran el elemento y piden revisar el valor', () => {
    const c = configInicial()
    c.fondoContenedor = 'zzz'
    c.cuerpo.fondo = 'zzz'
    const m = validarConfig(c).map(a => a.mensaje)
    expect(m).toContain('El color de fondo del bloque no es válido. Revisá el valor ingresado.')
    expect(m).toContain('El color de fondo de las filas no es válido. Revisá el valor ingresado.')
  })
  it('anchos, margen y columnas con la redacción nueva (porcentajes sin espacio)', () => {
    const c = configInicial()
    c.columnas[0].ancho = 50
    c.margen = 999
    const m = validarConfig(c).map(a => a.mensaje).join('|')
    expect(m).toMatch(/suman \d+% y deben sumar 100%/)
    expect(m).toMatch(/El margen debe estar entre 0 y \d+ px\./)
  })
  it('imagen muy ancha y falta de ancho', () => {
    const c = configInicial()
    const i = c.columnas.findIndex(x => x.tipo === 'imagen')
    c.columnas[i].imagen.ancho = 500
    expect(validarConfig(c).map(a => a.mensaje).join('|')).toMatch(/la imagen tiene un ancho de 500 px, pero el espacio disponible es de \d+ px\. Reducí/)
    c.columnas[i].imagen.ancho = ''
    expect(validarConfig(c).map(a => a.mensaje).join('|')).toMatch(/configurá el ancho de la imagen/)
  })
  it('encabezado vacío: remite a «Dejar encabezado vacío»', () => {
    const c = configInicial()
    c.columnas[1].titulo = ''
    expect(validarConfig(c).find(a => a.campo.startsWith('titulo-')).mensaje).toMatch(/«Dejar encabezado vacío» en el paso 2/)
  })
  it('ya no existe el aviso de la imagen de ejemplo (campo retirado)', () => {
    const c = configInicial()
    const i = c.columnas.findIndex(x => x.tipo === 'imagen')
    c.columnas[i].imagen.ejemplo = 'noesurl'
    expect(validarConfig(c).some(a => a.campo.startsWith('imagen-ejemplo'))).toBe(false)
    expect(configInicial().columnas.every(x => !('ejemplo' in x.imagen))).toBe(true)
  })
})
