import { describe, it, expect } from 'vitest'
import { tokenizarAtributosDeTag, reconstruirStyleRoto, ATRIBUTOS_HTML_CONOCIDOS } from '@/lib/revision/reconstruirAtributos.js'

describe('tokenizarAtributosDeTag', () => {
  it('tokeniza atributos con comillas dobles y simples, en orden', () => {
    const r = tokenizarAtributosDeTag(`<img src="a.png" alt='texto' width="100">`)
    expect(r.map(a => [a.nombre, a.valor])).toEqual([
      ['src', 'a.png'], ['alt', 'texto'], ['width', '100'],
    ])
  })

  it('un atributo sin valor (booleano real) queda con valor vacío', () => {
    const r = tokenizarAtributosDeTag(`<input disabled type="text">`)
    expect(r.map(a => [a.nombre, a.valor])).toEqual([['disabled', ''], ['type', 'text']])
  })

  it('nombres de atributo con dos puntos (el caso roto) se tokenizan igual que cualquier otro', () => {
    const r = tokenizarAtributosDeTag(`<img display:="" color:="" src="a.png">`)
    expect(r.map(a => a.nombre)).toEqual(['display:', 'color:', 'src'])
  })

  it('los offsets inicio/fin apuntan exactamente al atributo dentro del string original', () => {
    const tag = `<img src="a.png" width="100">`
    const r = tokenizarAtributosDeTag(tag)
    const width = r.find(a => a.nombre === 'width')
    expect(tag.slice(width.inicio, width.fin)).toBe('width="100"')
  })

  it('tag autocerrado (/>) no arrastra basura después del cierre', () => {
    const r = tokenizarAtributosDeTag(`<img src="a.png" />`)
    expect(r.map(a => a.nombre)).toEqual(['src'])
  })
})

describe('reconstruirStyleRoto — caso real reportado por Santi (2026-07-19), resuelto sin ancla el 2026-07-20', () => {
  const TAG_REAL = `<img src="https://d343t93odde9ul.cloudfront.net/minisites/ICBC/iconos/IconoTasaPreferencial.png" display:="" block="" color:="" c4161c="" width="100px" height="100px" alt="" />`

  it('reconstruye SIN ancla — un display:/color: suelto es señal suficiente por sí solo, no hace falta un style="..." previo', () => {
    // Versión anterior de este test exigía un style="...:" truncado
    // en el mismo tag para animarse a reconstruir. Pushback válido de
    // Santi: "es obvio que si encontrás un display o color van
    // adentro de un style, o no?" — no hacía falta esa restricción.
    // buscarCorridaFantasma ahora reconstruye igual sin ancla, usando
    // el mismo criterio de siempre (al menos un nombre terminado en
    // ':' en la corrida) como única señal de confianza.
    const r = reconstruirStyleRoto(TAG_REAL)
    expect(r).not.toBeNull()
    expect(r.confiable).toBe(true)
    expect(r.styleReconstruido).toBe('display: block; color: #c4161c;')
    expect(r.tagReconstruido).toContain('style="display: block; color: #c4161c;"')
    expect(r.tagReconstruido).toContain('width="100px"')
  })
})

describe('reconstruirStyleRoto — caso sintético completo (style con font-family entre comillas simples)', () => {
  // Reproduce el mecanismo completo: un style='...' que envolvía TODO
  // el atributo con comillas simples, con una tipografía no-sistema
  // también entre comillas simples adentro — verificado por separado
  // contra un parser HTML real (jsdom) para confirmar que este es
  // exactamente el HTML que ese parseo deja en el DOM antes de
  // volver a serializarse a string.
  const TAG_ROTO = `<img src="https://cdn.test/icono.png" style="font-family: " museo="" sans',="" arial,="" sans-serif;="" display:="" block;="" color:="" #c4161c;'="" width="100" height="100" alt="">`

  it('reconstruye un style con forma válida y lo marca confiable', () => {
    const r = reconstruirStyleRoto(TAG_ROTO)
    expect(r).not.toBeNull()
    expect(r.confiable).toBe(true)
    expect(r.styleReconstruido).toContain('font-family: museo, sans')
    expect(r.styleReconstruido).toContain('display: block')
    expect(r.styleReconstruido).toContain('color: #c4161c')
  })

  it('fragmentoRoto aísla solo la porción rota (sin src/width/height/alt alrededor) para un diff corto y legible', () => {
    const r = reconstruirStyleRoto(TAG_ROTO)
    expect(r.fragmentoRoto).not.toContain('src=')
    expect(r.fragmentoRoto).not.toContain('width=')
    expect(r.fragmentoRoto).toContain('style="font-family: "')
    expect(r.fragmentoRoto).toContain('museo=""')
  })

  it('el tag reconstruido conserva intactos los demás atributos (src, width, height, alt) y su orden', () => {
    const r = reconstruirStyleRoto(TAG_ROTO)
    expect(r.tagReconstruido).toContain('src="https://cdn.test/icono.png"')
    expect(r.tagReconstruido).toContain('width="100"')
    expect(r.tagReconstruido).toContain('height="100"')
    expect(r.tagReconstruido).toContain('alt=""')
    // El alt="" real (atributo conocido) NO debe haber sido absorbido
    // por la reconstrucción del style — tiene que seguir siendo un
    // atributo propio, separado.
    expect(r.styleReconstruido).not.toContain('alt')
  })

  it('regresión (reportado por Santi, 2026-07-20): ninguna comilla suelta sobrevive, ni al final ni en el medio', () => {
    // La comilla de CIERRE del nombre de la tipografía ('Museo Sans')
    // cae en el medio del string reconstruido ("...sans', arial..."),
    // no al final — el fix anterior (sacarComillaSueltaFinal) solo
    // miraba el último carácter y la dejaba pasar. styleReconstruido
    // no debe tener NINGÚN caracter ' o " en ningún punto.
    const r = reconstruirStyleRoto(TAG_ROTO)
    expect(r.styleReconstruido).not.toMatch(/['"]/)
    expect(r.tagReconstruido).not.toContain(`sans',`)
  })

  it('no toca el resto del tag byte a byte (src/width/height/alt quedan exactamente como estaban)', () => {
    const r = reconstruirStyleRoto(TAG_ROTO)
    expect(r.tagReconstruido.endsWith('width="100" height="100" alt="">')).toBe(true)
  })
})

describe('reconstruirStyleRoto — un alt="" real no se lo come la reconstrucción (caso carísimo de común)', () => {
  it('el alt="" pegado justo después de la corrida rota corta la reconstrucción ahí, no se incluye', () => {
    const tag = `<img src="a.png" style="color: " rojo="" alt="Ícono de tasa preferencial" width="50">`
    const r = reconstruirStyleRoto(tag)
    expect(r).not.toBeNull()
    expect(r.styleReconstruido).toBe('color: rojo;')
    expect(r.tagReconstruido).toContain('alt="Ícono de tasa preferencial"')
  })
})

describe('reconstruirStyleRoto — casos que NO deben reconstruirse con confianza', () => {
  it('un valor con forma irreconocible (filter:progid:... roto) se marca no confiable, sin tagReconstruido', () => {
    // Caso real de compatibilidad IE/Outlook — comillas anidadas,
    // paréntesis y dos-puntos de sobra que ningún style="..." simple
    // puede reconstruir con confianza a partir de nombres de atributo
    // sueltos.
    const tag = `<td style="filter: " progid:dximagetransform.microsoft.gradient(startcolorstr="" width="200">`
    const r = reconstruirStyleRoto(tag)
    expect(r).not.toBeNull()
    expect(r.confiable).toBe(false)
    expect(r.tagReconstruido).toBeNull()
  })

  it('un style ya completo (termina en ;) y sin ningún otro atributo sospechoso no dispara nada', () => {
    const tag = `<td style="color: red;" width="200">texto normal</td>`
    expect(reconstruirStyleRoto(tag)).toBeNull()
  })

  it('un atributo con \':\' suelto pero sin nada real detrás (caso B sin ancla) se intenta pero queda no confiable', () => {
    // "otroatributo:" es una corrida real detectable (tiene ':' en el
    // nombre, la señal de siempre) pero no tiene ningún contenido
    // real después de los dos puntos — el resultado no tiene forma
    // de declaración CSS válida, así que confiable queda en false y
    // no se ofrece aplicar. Ya no devuelve null de una (como antes de
    // sumar el caso B): ahora SÍ lo intenta, y la validación de forma
    // es la que lo descarta — mismo resultado práctico para el
    // usuario (sin botón de aplicar), por una razón más precisa.
    const tag = `<td style="color: red;" otroatributo:="" width="200">`
    const r = reconstruirStyleRoto(tag)
    expect(r).not.toBeNull()
    expect(r.confiable).toBe(false)
    expect(r.tagReconstruido).toBeNull()
  })

  it('sin atributos fantasma después del style truncado, no hay nada que reconstruir', () => {
    const tag = `<td style="color: " width="200">`
    expect(reconstruirStyleRoto(tag)).toBeNull()
  })

  it('un tag sin ningún style no dispara nada', () => {
    const tag = `<td width="200" align="center">Texto normal</td>`
    expect(reconstruirStyleRoto(tag)).toBeNull()
  })
})

describe('reconstruirStyleRoto — agrega el # faltante en colores hex (2026-07-20)', () => {
  it('color hex de 6 dígitos sin # (caso real de Santi) recupera el #', () => {
    const tag = `<img src="a.png" display:="" block="" color:="" c4161c="" width="100" alt="">`
    const r = reconstruirStyleRoto(tag)
    expect(r.styleReconstruido).toBe('display: block; color: #c4161c;')
  })

  it('color hex de 3 dígitos sin # también recupera el #', () => {
    const tag = `<img src="a.png" color:="" 000="" width="100" alt="">`
    const r = reconstruirStyleRoto(tag)
    expect(r.styleReconstruido).toBe('color: #000;')
  })

  it('funciona también con background-color u otra propiedad-*color*, no solo "color"', () => {
    const tag = `<img src="a.png" background-color:="" fff="" width="100" alt="">`
    const r = reconstruirStyleRoto(tag)
    expect(r.styleReconstruido).toBe('background-color: #fff;')
  })

  it('si el # ya está presente, no lo duplica', () => {
    const tag = `<img src="a.png" style="font-family: " museo="" sans',="" arial,="" sans-serif;="" display:="" block;="" color:="" #c4161c;'="" width="80" alt="">`
    const r = reconstruirStyleRoto(tag)
    expect(r.styleReconstruido).toContain('color: #c4161c;')
    expect(r.styleReconstruido).not.toContain('##')
  })

  it('un valor que NO es hex válido (contiene letras fuera de a-f) no se toca', () => {
    const tag = `<img src="a.png" color:="" red="" width="100" alt="">`
    const r = reconstruirStyleRoto(tag)
    expect(r.styleReconstruido).toBe('color: red;')
  })

  it('una propiedad que no es de color no agrega # aunque el valor parezca hex', () => {
    const tag = `<img src="a.png" width:="" 100="" src2:="" href="" alt="">`
    // width: 100 tiene forma "propiedad: hex-like" pero "width" no
    // contiene "color" — no se le agrega '#' (no tendría sentido).
    const r = reconstruirStyleRoto(tag)
    if (r) expect(r.styleReconstruido).not.toContain('#100')
  })
})

describe('reconstruirStyleRoto — recupera el nombre de propiedad perdido cuando el valor es inequívoco (2026-07-20)', () => {
  it('caso real reportado por Santi: font-family sin su nombre sobreviviendo, recuperado por "sans-serif" (palabra reservada exclusiva)', () => {
    // "arial helvetica open sans sans-serif" son los VALORES de un
    // font-family cuyo nombre de propiedad ("font-family:") no
    // sobrevivió en ningún atributo. A diferencia de adivinar un
    // color o un valor cualquiera, "sans-serif" es un tipo de valor
    // reservado por el spec de CSS — no aparece en ninguna otra
    // propiedad — así que etiquetarlo como font-family no es
    // inventar, es la única lectura posible.
    const tag = `<td arial="" helvetica="" open="" sans="" sans-serif="" font-size:="" 17px="" font-weight:="" normal="" color:="" 333333="" text-align:="" left="" line-height:="" 24px="" align="left">`
    const r = reconstruirStyleRoto(tag)
    expect(r).not.toBeNull()
    expect(r.confiable).toBe(true)
    expect(r.declaracionesInvalidas).toEqual([])
    expect(r.styleReconstruido).toContain('font-family: arial, helvetica, open, sans, sans-serif;')
    expect(r.styleReconstruido).toContain('font-size: 17px;')
    expect(r.styleReconstruido).toContain('color: #333333;')
  })

  it('text-decoration recuperado por "underline" (también exclusiva)', () => {
    const tag = `<a href="a.com" underline="" color:="" red="" width="100">texto</a>`
    const r = reconstruirStyleRoto(tag)
    expect(r).not.toBeNull()
    expect(r.styleReconstruido).toContain('text-decoration: underline;')
  })

  it('un valor ambiguo (ej. "normal", sin ninguna palabra exclusiva) NO se etiqueta — queda inválido a propósito', () => {
    // "normal" por sí solo podría ser font-weight, line-height,
    // white-space, font-style... no hay forma honesta de saber cuál
    // sin el nombre de la propiedad. Debe seguir sin reconstruirse.
    const tag = `<td normal="" color:="" 333333="" width="100">`
    const r = reconstruirStyleRoto(tag)
    expect(r).not.toBeNull()
    expect(r.confiable).toBe(false)
    expect(r.declaracionesInvalidas).toContain('normal')
  })

  it('la regla de comas es GENERAL — funciona con tipografías inventadas, no depende de una lista fija de este proyecto', () => {
    // A propósito NINGUNA de estas palabras existe como tipografía
    // real — si esto reconstruye bien, confirma que la regla es
    // "font-family siempre se une con comas" (spec de CSS), no una
    // lista hardcodeada de "las fuentes que usa este proyecto".
    const tag = `<td zzzfuenteinventada="" otrainventada="" sans-serif="" font-weight:="" bold="" width="100">`
    const r = reconstruirStyleRoto(tag)
    expect(r).not.toBeNull()
    expect(r.confiable).toBe(true)
    expect(r.styleReconstruido).toContain('font-family: zzzfuenteinventada, otrainventada, sans-serif;')
  })
})

describe('ATRIBUTOS_HTML_CONOCIDOS', () => {
  it('incluye los atributos más comunes de piezas de mail', () => {
    expect(ATRIBUTOS_HTML_CONOCIDOS.has('alt')).toBe(true)
    expect(ATRIBUTOS_HTML_CONOCIDOS.has('width')).toBe(true)
    expect(ATRIBUTOS_HTML_CONOCIDOS.has('bgcolor')).toBe(true)
  })

  it('un nombre roto típico (con dos puntos, o un valor hex suelto) no está en la lista', () => {
    expect(ATRIBUTOS_HTML_CONOCIDOS.has('display:')).toBe(false)
    expect(ATRIBUTOS_HTML_CONOCIDOS.has('c4161c')).toBe(false)
  })
})

// ─── Fix 2026-07-20 (2da sesión): ancla con `=` colgado ──────────────────
// Patrón de corrupción real (3er HTML de Santi): `="` insertado después
// de cada `:` y cada `;` del style — el parser deja el valor de style
// como "padding-left:=" (nombre de propiedad + `:` + `=` colgado). El
// nombre NO está perdido: está en el ancla. Antes de este fix, el
// detector de anclas exigía terminar en ":", el ancla no matcheaba, la
// reconstrucción caía al caso "sin ancla" y "20px" quedaba huérfano e
// irreconstruible (confiable=false, sin botón de aplicar) — y como el
// td quedaba sin NINGÚN CSS válido, heredaba el font-size:0 del <td>
// contenedor del export y el texto colapsaba a alto cero en el preview.
describe('reconstruirStyleRoto — ancla "propiedad:=" (patrón =" insertado, 2026-07-20)', () => {
  const tagCaso3 = `<td style="padding-left:=" " 20px;" " font-family:=" " Arial;=" " font-size:=" " 17px;=" " font-weight:=" " normal;=" " line-height:=" " 24px;=" " color:=" " #333333=" " ; align="left">`

  it('el caso real completo reconstruye TODAS las declaraciones, incluida padding-left: 20px', () => {
    const r = reconstruirStyleRoto(tagCaso3)
    expect(r).not.toBeNull()
    expect(r.confiable).toBe(true)
    expect(r.declaracionesInvalidas).toEqual([])
    expect(r.styleReconstruido).toBe('padding-left: 20px; font-family: Arial; font-size: 17px; font-weight: normal; line-height: 24px; color: #333333;')
    expect(r.tagReconstruido).toBe('<td style="padding-left: 20px; font-family: Arial; font-size: 17px; font-weight: normal; line-height: 24px; color: #333333;" align="left">')
  })

  it('el ancla clásica (termina en ":", sin "=") sigue funcionando igual', () => {
    const r = reconstruirStyleRoto(`<td style="color: " c4161c="" width="100">`)
    expect(r).not.toBeNull()
    expect(r.styleReconstruido).toBe('color: #c4161c;')
    expect(r.confiable).toBe(true)
  })

  it('un style legítimo que casualmente termina en "=" pero NO en "propiedad:=" no dispara ancla', () => {
    // background con url base64 terminada en "=" — cierra con ")", el
    // regex de ancla exige propiedad:{=}$ así que no matchea; y sin
    // atributos fantasma detrás tampoco hay caso B.
    const r = reconstruirStyleRoto(`<td style="background: url(data:image/png;base64,iVBOR=)" width="100">`)
    expect(r).toBeNull()
  })
})

// ─── Revisión en profundidad 2026-07-20 (2da sesión) ─────────────────────
// Bugs encontrados estresando el módulo con variantes generadas por un
// parser HTML real (no inventadas a mano), más defensas nuevas.
describe('reconstruirStyleRoto — ancla con VARIAS declaraciones completas antes de la truncada', () => {
  // El caso más probable de todos en la vida real: style='...' con
  // comillas simples, varias declaraciones sanas, y la tipografía con
  // comillas propias recién al final. El corte cae en la font — todo
  // lo anterior sobrevive intacto dentro del ancla. Input generado
  // con jsdom desde el origen real, no escrito a mano.
  const tag = `<td style="font-size: 17px; line-height: 24px; color: #333333; font-family: " open="" sans',="" arial,="" sans-serif;'="" align="left">`

  it('las declaraciones completas del ancla pasan byte a byte y la truncada recupera su regla de comas', () => {
    const r = reconstruirStyleRoto(tag)
    expect(r.confiable).toBe(true)
    // Antes de este fix: el regex de prefijo capturaba solo la PRIMERA
    // propiedad (font-size) como activa, el resto del ancla quedaba
    // como un token de valor, y la lista de tipografías se unía con
    // ESPACIOS (CSS inválido para font-family) con confiable=true.
    expect(r.styleReconstruido).toBe('font-size: 17px; line-height: 24px; color: #333333; font-family: open, sans, arial, sans-serif;')
  })
})

describe('tokenizarAtributosDeTag — atributos con valor SIN comillas', () => {
  it('border=0 / width=100 quedan como UN atributo, no un nombre más un token fantasma', () => {
    const attrs = tokenizarAtributosDeTag(`<img width=100 border=0 alt="">`)
    expect(attrs.map(a => a.nombre)).toEqual(['width', 'border', 'alt'])
    expect(attrs[0].valor).toBe('100')
    expect(attrs[1].valor).toBe('0')
  })
})

describe('reconstruirStyleRoto — defensa contra el fix a medias', () => {
  it('si queda otra corrida con señal CSS fuera del rango a reemplazar, muestra la reconstrucción pero NO ofrece aplicar', () => {
    // Tag sintético con DOS corridas separadas por un atributo
    // conocido — no debería pasar en una corrupción real (el CSS de
    // un style es contiguo), justamente por eso se declina: aplicar
    // arreglaría solo la primera mitad y marcaría el aviso como
    // resuelto con la otra mitad todavía rota.
    const r = reconstruirStyleRoto(`<img display:="" block="" width=100 color:="" c4161c="" alt="">`)
    expect(r).not.toBeNull()
    expect(r.confiable).toBe(false)
    expect(r.tagReconstruido).toBeNull()
  })
})

describe('buscarCorridaFantasma vía reconstruirStyleRoto — cualquier data-* corta la corrida', () => {
  it('un data- del proyecto que no está en la lista fija (data-legal-especifico) corta igual que uno listado', () => {
    const r = reconstruirStyleRoto(`<span color:="" c4161c="" data-legal-especifico="true">`)
    expect(r.styleReconstruido).toBe('color: #c4161c;')
    expect(r.confiable).toBe(true)
    // El data- quedó FUERA del rango reemplazado
    expect(r.tagReconstruido).toContain('data-legal-especifico="true"')
  })
})

describe('analizarDeclaraciones vía reconstruirStyleRoto — guarda de comillas dobles', () => {
  it('un ancla con url("...") legítimo entre las declaraciones completas nunca se ofrece aplicar', () => {
    // El wrapper del style original era de comillas SIMPLES, así que
    // sus declaraciones completas pueden traer comillas DOBLES sanas
    // adentro (un url("x.png") es CSS perfectamente válido). La
    // reconstrucción en sí es correcta, pero interpolarla dentro de
    // tagReconstruido (que envuelve en style="...") cortaría el
    // atributo justo en esa comilla y dejaría el tag MÁS roto que
    // antes — se muestra a título informativo, sin botón de aplicar.
    const r = reconstruirStyleRoto(`<td style='background: url("x.png"); color: ' c4161c="" align="left">`)
    expect(r).not.toBeNull()
    expect(r.styleReconstruido).toContain('url("x.png")')
    expect(r.confiable).toBe(false)
    expect(r.tagReconstruido).toBeNull()
  })
})

describe('reconstruirStyleRoto — variante creada por la normalización de comillas del import', () => {
  // La normalización de comillas simples a dobles del modal de importar
  // (ver comentario grande en analizarImportacion, EditorPiezas.jsx)
  // aplicada sobre un style='...' con tipografía de comillas simples
  // adentro produce SU PROPIA variante del tag roto: el par de
  // apertura se convierte (style="font-family: ") y el resto queda
  // como TEXTO SUELTO dentro del tag (Open Sans', Arial;'), sin el
  // ="" que agrega un parser real al serializar. Es la variante que
  // ve la detección cuando la pieza se importa por URL — a diferencia
  // de la variante de parser, acá las mayúsculas SOBREVIVEN.
  it('reconstruye el tag tal como queda después de normalizar comillas, conservando mayúsculas', () => {
    const tag = `<td style="font-size: 17px; font-family: " Open Sans', Arial;' align="left">`
    const r = reconstruirStyleRoto(tag)
    expect(r.confiable).toBe(true)
    expect(r.styleReconstruido).toBe('font-size: 17px; font-family: Open, Sans, Arial;')
    expect(r.tagReconstruido).toBe('<td style="font-size: 17px; font-family: Open, Sans, Arial;" align="left">')
  })
})
