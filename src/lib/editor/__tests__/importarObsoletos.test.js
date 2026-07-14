import { describe, it, expect } from 'vitest'
import {
  convertirEstructurasObsoletas,
  convertirEstructurasObsoletasEnCanvas,
  encontrarTdsConDivInlineBlock,
  importarHeuristico,
} from '@/lib/editor/importar.js'

// Comparación estructural: colapsa todo el whitespace (indentación,
// saltos de línea) que no cambia el HTML renderizado. La referencia
// aprobada y la salida del conversor difieren solo en indentación.
function normalizar(html) {
  return html.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim()
}

// ─── Referencia dorada ──────────────────────────────────────────────
// ENTRADA: fila real de una pieza histórica (Seguro Protección en
// Cajeros, marzo 2021) con el patrón obsoleto de dos columnas armadas
// con <div inline-block> + condicionales MSO.
// SALIDA ESPERADA: la adaptación armada A MANO y aprobada por el
// equipo — esqueleto del Modulo_Doble_Clasico con class="top"/"bottom",
// los % de max-width de los divs pasados al width de los tds y el
// contenido de cada columna intacto. El conversor NO inventa markup:
// estas dos piezas de HTML definen sus reglas.

const FILA_OBSOLETA_REAL = `<tr>
				<td align="center" height="100%" style="max-width: 600px;" valign="top" bgcolor="#ffffff" width="100%">
								<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%">
												<tbody>
																<tr>
																	<td align="center" valign="top" style="font-size: 0;">
																		<!--[if (gte mso 9)|(IE)]>                            <table align='center' border='0' cellspacing='0' cellpadding='0' width='600'>                            <tr>                            <td align='center' valign='top' width='600'>                            <![endif]-->
																		<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
																			<tbody>
																				<tr>
																					<td align="center" valign="middle" style="font-size: 0;">
																						<!--[if (gte mso 9)|(IE)]>                                        <table align='center' border='0' cellspacing='0' cellpadding='0' width='600'>                                        <tr>                                        <td align='left' valign='top' width='300'>                                        <![endif]-->
																						<div style="display: inline-block; max-width: 40%; min-width: 200px; vertical-align: top; width: 100%;" class="img-max">
																							<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 200px;" class="img-max">
																								<tbody>
																									<tr>
																										<td style="font-size: 0; padding: 0; margin: 0;" valign="middle" align="center"><img src="https://icommktrepo.s3.amazonaws.com/minisites/ICBC/newsletters/marzo2021/img/modulos/Icono_Protecciones.jpg" alt="Seguro de accidentes personales." title="Seguro de accidentes personales." style="width: 195px; height: 120px; display: block; font-family: Arial,Helvetica,Open Sans,sans-serif; font-size: 22px; color: #c4161c; border: solid 0px;" width="195" height="120" border="0" class="ico-max"></td>
																									</tr>
																								</tbody>
																							</table>
																						</div>
																						<!--[if (gte mso 9)|(IE)]>                                        </td>                                        <td align='right' valign='top' width='300'>                                        <![endif]-->
																						<div style="display: inline-block; max-width: 60%; min-width: 315px; vertical-align: middle; width: 100%;" class="img-max">
																							<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 315px;" class="img-max">
																								<tbody>
																									<tr>
																										<td style="font-family: Arial, Helvetica, Open Sans, sans-serif; font-size: 17px; font-weight: normal; line-height: 24px; color: #333333;" height="120" align="left" valign="middle">Accedés a una <span style="font-weight: bold;">cobertura para compras de productos</span> realizadas con tu tarjeta ICBC débito y/o crédito.</td>
																									</tr>
																								</tbody>
																							</table>
																						</div>
																						<!--[if (gte mso 9)|(IE)]>                                        </td>                                        </tr>                                        </table>                                        <![endif]-->
																					</td>
																				</tr>
																			</tbody>
																		</table>
																		<!--[if (gte mso 9)|(IE)]>                            </td>                            </tr>                            </table>                            <![endif]-->
																	</td>
																</tr>
												</tbody>
								</table>
				</td>
</tr>`

const FILA_MODERNA_APROBADA = `<tr>
				<td style="font-size: 0; padding: 0; margin: 0;" valign="top" align="center">
								<table align="center" cellpadding="0" cellspacing="0" border="0" role="presentation">
												<tbody>
																<tr>
																	<td class="top" align="center" valign="top" width="40%">
																		<table width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
																			<tbody>
																				<tr>
																					<td style="font-size: 0; padding: 0; margin: 0;" valign="middle" align="center"><img src="https://icommktrepo.s3.amazonaws.com/minisites/ICBC/newsletters/marzo2021/img/modulos/Icono_Protecciones.jpg" alt="Seguro de accidentes personales." title="Seguro de accidentes personales." style="width: 195px; height: 120px; display: block; font-family: Arial,Helvetica,Open Sans,sans-serif; font-size: 22px; color: #c4161c; border: solid 0px;" width="195" height="120" border="0" class="ico-max"></td>
																				</tr>
																			</tbody>
																		</table>
																	</td>
																	<td class="bottom" align="center" valign="top" width="60%">
																		<table width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
																			<tbody>
																				<tr>
																					<td style="font-family: Arial, Helvetica, Open Sans, sans-serif; font-size: 17px; font-weight: normal; line-height: 24px; color: #333333;" height="120" align="left" valign="middle">Accedés a una <span style="font-weight: bold;">cobertura para compras de productos</span> realizadas con tu tarjeta ICBC débito y/o crédito.</td>
																				</tr>
																			</tbody>
																		</table>
																	</td>
																</tr>
												</tbody>
								</table>
				</td>
</tr>`

// Variante del mismo patrón con otro contenido (para el fixture de
// pieza completa) — segunda columna con otro texto.
const FILA_OBSOLETA_VARIANTE = FILA_OBSOLETA_REAL
  .replace('Icono_Protecciones.jpg', 'Icono_SumaAnual.jpg')
  .replace('cobertura para compras de productos', 'suma anual asegurada sin límite de incidentes')

describe('convertirEstructurasObsoletas — referencia dorada', () => {
  it('convierte la fila obsoleta real EXACTAMENTE a la adaptación aprobada por el equipo', () => {
    const { html, convertidas } = convertirEstructurasObsoletas(FILA_OBSOLETA_REAL)
    expect(convertidas).toBe(1)
    expect(normalizar(html)).toBe(normalizar(FILA_MODERNA_APROBADA))
  })

  it('la salida ya no tiene estructuras obsoletas (idempotencia)', () => {
    const primera = convertirEstructurasObsoletas(FILA_OBSOLETA_REAL)
    expect(encontrarTdsConDivInlineBlock(primera.html)).toHaveLength(0)
    const segunda = convertirEstructurasObsoletas(primera.html)
    expect(segunda.convertidas).toBe(0)
    expect(segunda.html).toBe(primera.html)
  })
})

// ─── Referencia dorada — 1 sola columna ─────────────────────────────
// ENTRADA: caso real aportado (pieza histórica con un único módulo de
// íconos armado como <div inline-block>, sin segunda columna).
// SALIDA ESPERADA: misma mecánica que la referencia de 2 columnas,
// pero solo <td class="top">, sin envoltorio extra de table
// role="presentation" (esa capa solo sirve para alinear 2 columnas
// entre sí, con una sola no cumple ningún propósito).
const FILA_OBSOLETA_UNA_COLUMNA = `<tr>
				<td style="font-size: 0; padding: 0; margin: 0; width: 530px;" width="530" valign="top" align="center">
								<!--[if (gte mso 9)|(IE)]>                                                                <table align='center' border='0' cellspacing='0' cellpadding='0' width='530'>                                                                    <tr>                                                                        <td align='center' valign='top' width='265'>                                                                            <![endif]-->
								<div style="display: inline-block; max-width: 50%; min-width: 265px; vertical-align: top; width: 100%; height: 128px; max-height: 128px; min-height: 128px; overflow: hidden;" class="mobile-wrapper">
												<table style="max-width: 265px;" class="max-width" width="100%" cellspacing="0" cellpadding="0" border="0">
																<tbody>
																	<tr>
																		<td style="font-family: Open Sans, Helvetica, Arial, sans-serif;" valign="top" align="center">
																			<table style="width: 265px;" width="265px" cellspacing="0" cellpadding="0" border="0">
																				<tbody>
																					<tr>
																						<td style="width: 265px;" width="265px" valign="top" align="center">
																							<table width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#c4161c">
																								<tbody>
																									<tr>
																										<td style="width: 265px;" width="265px" valign="top" align="center">
																											<table style="width: 265px;" width="265px" cellspacing="0" cellpadding="0" border="0">
																												<tbody>
																													<tr>
																														<td style="width: 2px; font-size: 0;" width="2px"> </td>
																														<!-- INICIO MODULO 1 -->
																														<td style="text-align: left; width: 128px; height: 128px; max-height: 128px; overflow: hidden;" width="128px" valign="top" bgcolor="#c4161c"><img src="https://d343t93odde9ul.cloudfront.net/minisites/ICBC/iconos128/ico-deco-128px-b.png" alt="DECO" style="display: block; width: 128px; height: 128px; color: #ffffff;" width="128px" height="128px"></td>
																														<!-- FIN MODULO 1 -->
																														<td style="width: 2px; font-size: 0;" width="2px"> </td>
																														<!-- INICIO SEPARADOR PUNTEADO 1 -->
																														<td style="width: 2px; height: 128px;" width="2px" valign="top" height="128" bgcolor="#c4161c"><img style="display: block; border: 0px; width: 2px; height: 128px;" src="https://d343t93odde9ul.cloudfront.net/minisites/ICBC/iconos128/puntos-128-blanco.png" alt="ICBC" width="2px" height="128px"></td>
																														<!-- FIN SEPARADOR PUNTEADO 1 --> <!-- INICIO MODULO 2 -->
																														<td style="text-align: left; width: 128px; height: 128px; max-height: 128px; overflow: hidden;" width="128px" valign="top" bgcolor="#c4161c"><img src="https://d343t93odde9ul.cloudfront.net/minisites/ICBC/iconos128/ico-pintureria-128px-b.png" alt="PINTURERIA" style="display: block; width: 128px; height: 128px; color: #ffffff;" width="128px" height="128px"></td>
																														<!-- FIN MODULO 4 -->
																														<td style="width: 3px; font-size: 0;" width="3px"> </td>
																													</tr>
																												</tbody>
																											</table>
																										</td>
																									</tr>
																								</tbody>
																							</table>
																						</td>
																					</tr>
																				</tbody>
																			</table>
																		</td>
																	</tr>
																</tbody>
												</table>
								</div>
								<!--[if (gte mso 9)|(IE)]>                                                                        </td>                                                                    </tr>                                                                </table>                                                            <![endif]-->
				</td>
</tr>`

const FILA_MODERNA_UNA_COLUMNA_APROBADA = `<tr>
    <td class="top" align="center" valign="top" width="50%">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
            <tbody>
                <tr>
                    <td style="font-family: Open Sans, Helvetica, Arial, sans-serif;" valign="top" align="center">
                        <table style="width: 265px;" width="265px" cellspacing="0" cellpadding="0" border="0">
                            <tbody>
                                <tr>
                                    <td style="width: 265px;" width="265px" valign="top" align="center">
                                        <table width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#c4161c">
                                            <tbody>
                                                <tr>
                                                    <td style="width: 265px;" width="265px" valign="top" align="center">
                                                        <table style="width: 265px;" width="265px" cellspacing="0" cellpadding="0" border="0">
                                                            <tbody>
                                                                <tr>
                                                                    <td style="width: 2px; font-size: 0;" width="2px"> </td>
                                                                    <!-- INICIO MODULO 1 -->
                                                                    <td style="text-align: left; width: 128px; height: 128px; max-height: 128px; overflow: hidden;" width="128px" valign="top" bgcolor="#c4161c"><img src="https://d343t93odde9ul.cloudfront.net/minisites/ICBC/iconos128/ico-deco-128px-b.png" alt="DECO" style="display: block; width: 128px; height: 128px; color: #ffffff;" width="128px" height="128px"></td>
                                                                    <!-- FIN MODULO 1 -->
                                                                    <td style="width: 2px; font-size: 0;" width="2px"> </td>
                                                                    <!-- INICIO SEPARADOR PUNTEADO 1 -->
                                                                    <td style="width: 2px; height: 128px;" width="2px" valign="top" height="128" bgcolor="#c4161c"><img style="display: block; border: 0px; width: 2px; height: 128px;" src="https://d343t93odde9ul.cloudfront.net/minisites/ICBC/iconos128/puntos-128-blanco.png" alt="ICBC" width="2px" height="128px"></td>
                                                                    <!-- FIN SEPARADOR PUNTEADO 1 --> <!-- INICIO MODULO 2 -->
                                                                    <td style="text-align: left; width: 128px; height: 128px; max-height: 128px; overflow: hidden;" width="128px" valign="top" bgcolor="#c4161c"><img src="https://d343t93odde9ul.cloudfront.net/minisites/ICBC/iconos128/ico-pintureria-128px-b.png" alt="PINTURERIA" style="display: block; width: 128px; height: 128px; color: #ffffff;" width="128px" height="128px"></td>
                                                                    <!-- FIN MODULO 4 -->
                                                                    <td style="width: 3px; font-size: 0;" width="3px"> </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>
    </td>
</tr>`

describe('convertirEstructurasObsoletas — referencia dorada (1 columna)', () => {
  it('convierte la fila obsoleta de una sola columna a class="top" sin envoltorio extra', () => {
    const { html, convertidas } = convertirEstructurasObsoletas(FILA_OBSOLETA_UNA_COLUMNA)
    expect(convertidas).toBe(1)
    expect(normalizar(html)).toBe(normalizar(FILA_MODERNA_UNA_COLUMNA_APROBADA))
  })

  it('la salida ya no tiene estructuras obsoletas ni "bottom" inventado', () => {
    const { html } = convertirEstructurasObsoletas(FILA_OBSOLETA_UNA_COLUMNA)
    expect(encontrarTdsConDivInlineBlock(html)).toHaveLength(0)
    expect(html).toContain('class="top"')
    expect(html).not.toContain('class="bottom"')
    expect(html).not.toContain('role="presentation"')
  })
})

describe('convertirEstructurasObsoletas — propagación de color de fondo', () => {
  // Caso real reportado: la tabla que se descarta al re-tagear (la
  // que vive directo dentro del div) traía su propio bgcolor/
  // background-color — perderlo dejaba la columna nueva sin el fondo
  // que tenía en la pieza original.
  const DIV_CON_FONDO = `<div style="display: inline-block; max-width: 50%; min-width: 265px; vertical-align: top; width: 100%; height: 128px; max-height: 128px; min-height: 128px; overflow: hidden;" class="max-width">
    <table style="max-width: 265px;" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#000000" align="center">
      <tbody><tr><td style="font-family: Open Sans, Helvetica, Arial, sans-serif; padding-bottom: 14px;" bgcolor="#000000" valign="top" align="center">
        <table width="265" cellspacing="0" cellpadding="0" border="0">
          <tbody><tr><td style="font-size: 0; padding: 0; margin: 0;" valign="top" align="center"><img src="icono-super.png" width="265" height="128"></td></tr></tbody>
        </table>
      </td></tr></tbody>
    </table>
  </div>`
  const DIV_SIN_FONDO = DIV_CON_FONDO
    .replace(' bgcolor="#000000" align="center"', ' align="center"')
    .replace('icono-super.png', 'icono-deposita.png')

  it('propaga el bgcolor de la tabla descartada a la tabla nueva', () => {
    const fila = `<tr><td style="font-size: 0;" valign="middle" align="center">${DIV_CON_FONDO}${DIV_SIN_FONDO}</td></tr>`
    const { html, convertidas } = convertirEstructurasObsoletas(fila)
    expect(convertidas).toBe(1)
    // Primera columna: la tabla original tenía bgcolor="#000000" en el
    // tag que se descarta — debe aparecer en la tabla nueva.
    const primeraTabla = html.match(/<td class="top"[^>]*>\s*<table[^>]*>/)[0]
    expect(primeraTabla).toContain('bgcolor="#000000"')
    expect(primeraTabla).toContain('background-color:#000000')
    // Segunda columna: no tenía color propio en la tabla descartada —
    // no se inventa ninguno.
    const segundaTabla = html.match(/<td class="bottom"[^>]*>\s*<table[^>]*>/)[0]
    expect(segundaTabla).not.toContain('bgcolor')
    // El contenido interno (que sí traía su propio bgcolor en el td
    // más profundo) sigue intacto en ambas columnas, sin duplicar ni
    // perder nada.
    expect(html).toContain('icono-super.png')
    expect(html).toContain('icono-deposita.png')
  })

  it('background-color en style (no solo atributo bgcolor) también se propaga', () => {
    const divConStyle = DIV_CON_FONDO.replace('bgcolor="#000000" align="center"', 'style="background-color: #635843;" align="center"')
    const otroDiv = DIV_SIN_FONDO
    const fila = `<tr><td style="font-size: 0;" valign="middle" align="center">${divConStyle}${otroDiv}</td></tr>`
    const { html } = convertirEstructurasObsoletas(fila)
    const primeraTabla = html.match(/<td class="top"[^>]*>\s*<table[^>]*>/)[0]
    expect(primeraTabla).toContain('#635843')
  })
})

describe('convertirEstructurasObsoletas — casos que NO se convierten (quedan marcados)', () => {
  it('tres divs: el patrón top/bottom es estrictamente de a uno o dos', () => {
    const div = (w) => `<div style="display: inline-block; max-width: ${w}%;"><table><tbody><tr><td>col</td></tr></tbody></table></div>`
    const tresDivs = `<tr><td style="font-size: 0;">${div(30)}${div(30)}${div(40)}</td></tr>`
    expect(convertirEstructurasObsoletas(tresDivs).convertidas).toBe(0)
  })

  it('div sin % en el max-width: no hay de dónde sacar el width del td', () => {
    const sinPct = FILA_OBSOLETA_REAL.replace('max-width: 40%', 'max-width: 200px')
    expect(convertirEstructurasObsoletas(sinPct).convertidas).toBe(0)
  })

  it('contenido visible suelto junto a los divs: convertir perdería ese contenido', () => {
    const conExtra = FILA_OBSOLETA_REAL.replace(
      '<div style="display: inline-block; max-width: 40%',
      'texto suelto que no puede perderse<div style="display: inline-block; max-width: 40%'
    )
    expect(convertirEstructurasObsoletas(conExtra).convertidas).toBe(0)
  })

  it('contenido visible en una capa wrapper: convierte un tr más interno y el contenido sobrevive', () => {
    // Una imagen hermana en una capa wrapper — el ancestro que la
    // contiene nunca califica para el reemplazo (perdería la imagen),
    // así que el algoritmo baja hasta el tr más externo que SÍ es puro
    // wrapper y convierte ahí: la estructura queda moderna y la imagen
    // queda intacta en su capa original.
    const conImgEnWrapper = FILA_OBSOLETA_REAL.replace(
      '<td align="center" valign="top" style="font-size: 0;">',
      '<td align="center" valign="top" style="font-size: 0;"><img src="sello.png">'
    )
    const { convertidas, html } = convertirEstructurasObsoletas(conImgEnWrapper)
    expect(convertidas).toBe(1)
    expect(html).toContain('sello.png')
    expect(html).toContain('class="top"')
    expect(encontrarTdsConDivInlineBlock(html)).toHaveLength(0)
  })
})

describe('convertirEstructurasObsoletas — pieza completa', () => {
  const PIEZA = `<table width="100%"><tbody>
    <tr><td align="center"><img src="https://cdn.test/header.jpg" width="600"></td></tr>
    <tr><td><table id="Show" style="max-width: 530px;" width="100%"><tbody>
      <tr><td style="font-family: Arial;">Texto introductorio de la pieza.</td></tr>
      ${FILA_OBSOLETA_REAL}
      <tr><td height="28"></td></tr>
      ${FILA_OBSOLETA_VARIANTE}
    </tbody></table></td></tr>
    <tr><td class="Texto_Legales">Legales de la pieza que no se tocan.</td></tr>
  </tbody></table>`

  it('convierte las 2 estructuras y no toca el resto de la pieza', () => {
    const { html, convertidas } = convertirEstructurasObsoletas(PIEZA)
    expect(convertidas).toBe(2)
    expect(encontrarTdsConDivInlineBlock(html)).toHaveLength(0)
    // Contenido de las columnas intacto
    expect(html).toContain('cobertura para compras de productos')
    expect(html).toContain('suma anual asegurada sin límite de incidentes')
    expect(html).toContain('Icono_Protecciones.jpg')
    expect(html).toContain('Icono_SumaAnual.jpg')
    // El resto de la pieza sigue donde estaba
    expect(html).toContain('header.jpg')
    expect(html).toContain('Texto introductorio de la pieza.')
    expect(html).toContain('Legales de la pieza que no se tocan.')
    // Estructura nueva presente, patrón viejo ausente
    expect((html.match(/class="top"/g) || []).length).toBe(2)
    expect((html.match(/class="bottom"/g) || []).length).toBe(2)
    expect(html).not.toContain('display: inline-block; max-width: 40%')
  })

  it('integración con importarHeuristico: SOLO avisa (detección), no convierte el HTML del análisis', () => {
    // La conversión real se aplica recién al confirmar la importación
    // (ver convertirEstructurasObsoletasEnCanvas más abajo) — a
    // propósito, para no tocar la lógica de análisis/preview que ya
    // funcionaba: la pantalla de resumen sigue avisando y marcando en
    // rojo la estructura obsoleta exactamente como antes.
    const { resultado, avisos } = importarHeuristico(PIEZA)
    expect(resultado).not.toBeNull()
    const avisoObsoleto = avisos.find(a => a.tipo === 'obsoleto')
    expect(avisoObsoleto).toBeTruthy()
    expect(avisoObsoleto.texto).toContain('2 estructuras de layout obsoletas')
    // El canvas recién analizado NO está convertido — cada estructura
    // obsoleta entra como código personalizado con el HTML original
    // (no matchea contra ningún template real, ver clasificación).
    const htmlCanvas = resultado.canvas.map(b => b.htmlEditado ?? b.html).join('\n')
    expect(htmlCanvas).toContain('display: inline-block')
    expect(htmlCanvas).not.toContain('class="top"')
  })

  it('convertirEstructurasObsoletasEnCanvas: convierte recién al confirmar la importación', () => {
    // Simula el paso siguiente del flujo real (confirmarImportacion en
    // EditorPiezas.jsx): tomar el canvas YA analizado y convertir ahí.
    const { resultado } = importarHeuristico(PIEZA)
    const { canvas: canvasConvertido, convertidas } = convertirEstructurasObsoletasEnCanvas(resultado.canvas)
    expect(convertidas).toBe(2)
    const htmlCanvas = canvasConvertido.map(b => b.htmlEditado ?? b.html).join('\n')
    expect(htmlCanvas).toContain('cobertura para compras de productos')
    expect(htmlCanvas).toContain('suma anual asegurada sin límite de incidentes')
    expect(htmlCanvas).toContain('class="top"')
    expect(htmlCanvas).not.toContain('display: inline-block')
  })

  it('convertirEstructurasObsoletasEnCanvas: una pieza sin estructuras obsoletas no convierte nada', () => {
    const { resultado } = importarHeuristico(PIEZA.replace(FILA_OBSOLETA_REAL, '').replace(FILA_OBSOLETA_VARIANTE, ''))
    const { convertidas } = convertirEstructurasObsoletasEnCanvas(resultado.canvas)
    expect(convertidas).toBe(0)
  })
})
