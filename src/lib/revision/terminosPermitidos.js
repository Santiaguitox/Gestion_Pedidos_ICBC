// Glosario de términos que el corrector de ortografía NO debe marcar:
// siglas, nombres de productos, marcas y expresiones legales del banco.
//
// Se envía tal cual a la Edge Function revisar-ortografia, que se lo pasa al
// modelo como "términos permitidos" y además descarta cualquier hallazgo
// cuyo fragmento coincida con uno de ellos (ignorando mayúsculas). Para
// sumar un término alcanza con agregar una línea acá: no hace falta
// redesplegar la función.
//
// Qué va y qué no:
//   SÍ   siglas, nombres propios, productos, marcas, términos legales fijos.
//   NO   palabras comunes del rubro (préstamo, cuota, tasa, acreditación):
//        esas se siguen revisando, "prestamo" sin tilde es un error real.
//
// "ICBC Access" / "Access Banking" NO están acá a propósito: es un canal
// dado de baja y lo detecta terminosObsoletos.js.
//
// Máximo 200 términos de hasta 60 caracteres (lo valida la función).

export const TERMINOS_PERMITIDOS = [
  // Siglas financieras y legales
  'ICBC', 'CFT', 'CFTNA', 'CFTEA', 'TNA', 'TEA', 'TEM', 'UVA', 'CER',
  'CUIT', 'CUIL', 'DNI', 'IVA', 'CBU', 'CVU', 'BCRA', 'CNV', 'FAL', 'CABA',
  'NFC', 'QR', 'MBR', 'S.A.U.',

  // Expresiones legales fijas
  'Sociedad Anónima Unipersonal',
  'Comisión Nacional de Valores',
  'Ley de Entidades Financieras',
  'Banco Central',
  'Resolución General',
  'Fondo de Asistencia Laboral',

  // Productos y canales del banco
  'ICBC Mobile', 'ICBC Hola', 'ICBC Club', 'ICBC Mall', 'ICBC Exclusive',
  'ICBC Sueldos', 'ICBC Jubilaciones', 'ICBC Investments', 'ICBC Empresas',
  'ICBC Comercio Exterior', 'ICBC Multipay', 'ICBC Pay', 'Pay',
  'Mobile Banking', 'Online Banking', 'ICBC Online Banking',
  'ICBC Online y Mobile Banking', 'Banca Empresas', 'CIBI',
  'Pymes que Sí', 'BigBox', 'MALBA', 'Commercial Bank',

  // Marcas y redes
  'Visa', 'Visa Contactless', 'Mastercard',
  'Twitter', 'Facebook', 'Instagram', 'LinkedIn',

  // Slogan del banco: las mayúsculas son parte de la marca. Con y sin punto
  // porque el fragmento que devuelve la IA puede traerlo.
  'El Futuro nos Inspira', 'El Futuro nos Inspira.',

  // Variantes de mayúsculas que se usan en las piezas
  'PYMES', 'Pymes', 'ICBC EMPRESAS', 'ICBC CLUB',
]
