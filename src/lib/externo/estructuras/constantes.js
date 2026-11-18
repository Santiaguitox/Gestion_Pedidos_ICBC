// Límites y valores fijos de "Estructura tipo tabla" (/estructuras-tabla).
// Todo lo de esta carpeta es independiente del resto de la app (ver
// src/lib/externo/__tests__/aislamiento.test.js).

export const ANCHO_PIEZA = 600
export const MARGEN_MAX = 150
export const ANCHO_TABLA_MIN = 320

export const MAX_COLUMNAS = 6
export const MAX_CONTACTOS = 10
export const MAX_FILAS = 12
export const MAX_VARIABLES = 5

export const CAMPO_POR_DEFECTO = 'datos_tabla'
// Nombres que ya usa la base y no se pueden elegir para el campo ni para variables extra
export const NOMBRES_RESERVADOS = ['email']

export const SEP_COLUMNA = '||'
export const SEP_FILA = '##'

export const FUENTES = [
  { id: 'tahoma', etiqueta: 'Tahoma', pila: 'Tahoma, Helvetica, Open Sans, sans-serif' },
  { id: 'arial', etiqueta: 'Arial', pila: 'Arial, Helvetica, sans-serif' },
  { id: 'verdana', etiqueta: 'Verdana', pila: 'Verdana, Geneva, sans-serif' },
  { id: 'trebuchet', etiqueta: 'Trebuchet MS', pila: 'Trebuchet MS, Helvetica, sans-serif' },
  { id: 'georgia', etiqueta: 'Georgia', pila: 'Georgia, Times New Roman, serif' },
  { id: 'times', etiqueta: 'Times New Roman', pila: 'Times New Roman, Times, serif' },
  { id: 'courier', etiqueta: 'Courier New', pila: 'Courier New, Courier, monospace' },
]

export const ALINEACIONES = ['left', 'center', 'right']

// Estilos de borde que se pueden elegir. En Outlook de escritorio los punteados y
// rayados pueden verse como línea sólida; el "doble" necesita al menos 3 px.
export const ESTILOS_BORDE = [
  { valor: 'solid', etiqueta: 'Sólido' },
  { valor: 'dashed', etiqueta: 'Rayado' },
  { valor: 'dotted', etiqueta: 'Punteado' },
  { valor: 'double', etiqueta: 'Doble (mín. 3 px)' },
]
export const DOBLE_MIN = 3
