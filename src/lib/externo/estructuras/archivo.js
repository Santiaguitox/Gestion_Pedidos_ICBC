// Contenido de los archivos que se descargan. Va aparte de los componentes para poder probarlo.

const BOM = '\uFEFF'

/**
 * El texto tal como se escribe en el archivo.
 * - crlf: los saltos de línea pasan a \r\n. icomm no lee bien una base con \n sueltos
 *   (lo verificamos con una base real: con \r\n y sin BOM carga los contactos).
 * - bom: agrega la marca de UTF-8, que sirve para Excel pero deja un carácter invisible
 *   delante del nombre de la primera columna ("email") para quien lee el archivo como texto.
 */
export function contenidoDeArchivo(texto, { crlf = false, bom = false } = {}) {
  const t = crlf ? String(texto).replace(/\r?\n/g, '\r\n') : String(texto)
  return bom ? BOM + t : t
}
