// Imágenes PURAMENTE ESTRUCTURALES: separadores y líneas punteadas, píxeles
// transparentes (o una línea decorativa) que se estiran al espacio que haga
// falta. Su aspect ratio no tiene significado visual, así que la
// desproporción "declarado vs. real" NO es un error en estas imágenes: a lo
// sumo un detalle menor.
//
// COPIA de src/lib/imagenesEstructurales.js (TeamWorkHub), hecha el
// 2026-10-14 para que el motor externo sea independiente de la app.
//
// El patrón cubre (case-insensitive, con o sin guión/guión bajo) los
// separadores conocidos del repositorio de imágenes: Img_Separador*.png,
// ImgSeparadorH_Rojo*.jpg y MediaLineaPunteada*.
export const PATRON_IMAGEN_ESTRUCTURAL = /img[_-]?separador|lineapunteada/i

// Acepta tanto una URL completa como un nombre de archivo suelto.
export function esImagenEstructural(srcONombre) {
  if (!srcONombre) return false
  return PATRON_IMAGEN_ESTRUCTURAL.test(srcONombre)
}
