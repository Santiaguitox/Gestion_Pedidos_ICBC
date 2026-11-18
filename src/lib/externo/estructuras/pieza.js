// La pieza de ejemplo que envuelve al bloque en la guía y en el kit de prueba:
// estilos para Outlook/iOS/Android + tabla contenedora de 600px.

import { ANCHO_PIEZA } from './constantes.js'
import { generarBloque, generarBloqueVista } from './bloque.js'

export const ESTILOS_PIEZA = `<style type="text/css">
    /* ESTILOS PARA OUTLOOK */
    body, table, td, a {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
    }

    table, td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
    }

    img {
        -ms-interpolation-mode: bicubic;
    }
    /* RESET DE ESTILOS */
    img {
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
    }

    table {
        border-collapse: collapse !important;
    }

    body {
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
    }

    div {
        font-size: 0px;
    }
    /* iOS LINKS AZULES HEREDAN COLORES DEL HTML */
    a[x-apple-data-detectors] {
        color: inherit !important;
        text-decoration: none !important;
        font-size: inherit !important;
        font-family: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
    }
    /* MEDIA QUERIES */
    @media screen and (max-width: 600px) {
        .img-max {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
        }
    }
    /* SOLUCIÓN DE CENTRADO EN ANDROID */
    div[style*="margin: 16px 0;"] {
        margin: 0 !important;
    }
</style>`

/** Fila "TOTAL" que va debajo de la tabla (solo en el ejemplo de la guía; el diseñador no la genera). */
export function filaTotal(config, valor) {
  const ultima = Number(config.columnas[config.columnas.length - 1]?.ancho) || 25
  const resto = 100 - ultima
  const T = ANCHO_PIEZA - 2 * (Number(config.margen) || 0)
  const base = 'font-family: Tahoma, Helvetica, Open Sans, sans-serif; font-size: 14px; font-weight: bold; line-height: 12px; color: #333333; background-color: #f3f4f6;'
  return [
    `                                <tr>`,
    `                                    <td style="width: ${T}px;" width="${T}" valign="top">`,
    `                                        <table width="100%" cellspacing="0" cellpadding="0" border="0">`,
    `                                            <tbody>`,
    `                                                <tr>`,
    `                                                    <td valign="middle" style="${base} text-align: right;" height="30" width="${resto}%" bgcolor="#f3f4f6">TOTAL:&emsp;</td>`,
    `                                                    <td valign="middle" style="${base} text-align: center;" height="30" width="${ultima}%" bgcolor="#f3f4f6">${valor}</td>`,
    `                                                </tr>`,
    `                                            </tbody>`,
    `                                        </table>`,
    `                                    </td>`,
    `                                </tr>`,
  ].join('\n')
}

const TEXTO = 'font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 22px; color: #333333;'

/**
 * El email completo de prueba: encabezado, un texto, el bloque (el <tr> del campo
 * tipo tabla), otro texto y el pie. Todo con tablas y atributos que entienden los
 * clientes de mail (sin imágenes ni divs), así que se puede enviar tal cual.
 */
export function emailDePrueba(bloque) {
  return [
    `<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: ${ANCHO_PIEZA}px; border: solid 1px #b6ecf4;" bgcolor="#ffffff">`,
    '    <tr>',
    '        <td height="70" align="center" valign="middle" bgcolor="#e1f8fb" style="height: 70px; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: bold; color: #0e316e;">Encabezado de tu pieza</td>',
    '    </tr>',
    '    <tr>',
    `        <td style="padding: 24px 30px; ${TEXTO}">Hola, este es un envío de prueba del campo tipo tabla. Debajo se arma la tabla con los datos de cada contacto.</td>`,
    '    </tr>',
    bloque.split('\n').map(l => '    ' + l).join('\n'),
    '    <tr>',
    `        <td style="padding: 24px 30px; ${TEXTO}">Este texto sigue después de la tabla.</td>`,
    '    </tr>',
    '    <tr>',
    '        <td height="50" align="center" valign="middle" bgcolor="#f3f4f6" style="height: 50px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #64748b;">Pie de tu pieza</td>',
    '    </tr>',
    '</table>',
  ].join('\n')
}

/** El <style> y debajo el email completo con el bloque adentro: se puede pegar tal cual para un envío de prueba. */
export function htmlDeEmailCompleto(bloque) {
  return `${ESTILOS_PIEZA}\n${emailDePrueba(bloque)}`
}

/** Lo que se copia para el envío de prueba de la guía. */
export function htmlParaPlataforma(config, { extraAbajo = '' } = {}) {
  return htmlDeEmailCompleto(generarBloque(config, { extraAbajo }))
}

/** El mismo email, para mostrar en pantalla (con las marcas de celda y las imágenes de relleno). */
export function vistaDeEmail(config, filas, opciones = {}) {
  return emailDePrueba(generarBloqueVista(config, filas, opciones))
}
