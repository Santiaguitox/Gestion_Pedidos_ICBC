// Imágenes PURAMENTE ESTRUCTURALES: separadores y líneas punteadas —
// píxeles transparentes (o una línea decorativa) que se estiran al
// espacio que haga falta. Su aspect ratio no tiene significado visual:
// un PNG entero con fondo transparente deformado no se "ve mal", solo
// ocupa el hueco que se le pidió. Por eso la desproporción declarado
// vs. real NO es un error en estas imágenes — a lo sumo un detalle
// menor para revisar.
//
// ÚNICA FUENTE DE VERDAD del criterio, compartida por:
//   - lib/revision/imagenes.js  → ValidarDimensionesImagenes degrada la
//     desproporción de estas imágenes a "detalle menor" (advertencia)
//   - EditorPiezas (CampoImagen) → no dispara la alerta de "la imagen
//     no coincide con las medidas" al cambiar la URL
//   - lib/editor/campos.js → las excluye de los campos editables del
//     import (son estructura fija del template, no contenido)
// Antes el editor tenía este regex inline duplicado en dos lugares y la
// revisión no lo aplicaba — el criterio ya había empezado a divergir.
//
// El patrón cubre (case-insensitive, con o sin guión/guión bajo) los
// separadores conocidos del repositorio de imágenes:
//   Img_Separador.png, Img_Separador265x100.png, Img_Separador265x128.png,
//   Img_Separador_265x2.png, ImgSeparadorH_Rojo10px.jpg,
//   ImgSeparadorH_Rojo5px.jpg — y MediaLineaPunteada* (la divisoria del
//   Módulo Doble Con Imagen Punteada, visible solo en mobile).
// Un separador nuevo que respete la convención de nombres
// ("...separador..." en el archivo) entra solo, sin tocar código.
export const PATRON_IMAGEN_ESTRUCTURAL = /img[_-]?separador|lineapunteada/i

// Acepta tanto una URL completa como un nombre de archivo suelto.
export function esImagenEstructural(srcONombre) {
  if (!srcONombre) return false
  return PATRON_IMAGEN_ESTRUCTURAL.test(srcONombre)
}
