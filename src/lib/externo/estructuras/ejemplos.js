// Los dos ejemplos de la guía: una tabla básica y una de productos con total.
// Se arman con el mismo generador que el diseñador, así la guía y la
// herramienta nunca se contradicen.

import { columnaNueva, configInicial, repartirAnchos } from './bloque.js'
import { construirImg } from './imagen.js'

export const EMAIL_EJEMPLO = 'tu_email@ejemplo.com'

function configBasica() {
  const base = configInicial()
  const anchos = repartirAnchos(3)
  return {
    ...base,
    columnas: [1, 2, 3].map(n => ({ ...columnaNueva(n), titulo: `Columna ${n}`, ancho: anchos[n - 1], padding: 10 })),
    cuerpo: { ...base.cuerpo, separacion: { tipo: 'linea', ancho: 1, color: '#e1f8fb' } },
  }
}

const IMAGENES = [1, 2, 3].map(n => `https://placehold.co/180x180/e1f8fb/0e316e.png?text=Producto+${n}`)

function configProductos() {
  const base = configInicial()
  return { ...base, columnas: base.columnas.map(c => ({ ...c, imagen: { ...c.imagen, alt: c.imagen.alt || '' } })) }
}

export const EJEMPLOS = {
  basica: {
    id: 'basica',
    titulo: 'Tabla básica',
    resumen: 'Un ejemplo sencillo con columnas de texto para entender cómo funciona el campo tipo tabla.',
    config: configBasica(),
    variables: [],
    valores: [],
    filas: [1, 2, 3, 4].map(r => [1, 2, 3].map(c => `Dato ${r} columna ${c}`)),
    total: null,
  },
  productos: {
    id: 'productos',
    titulo: 'Productos con total',
    resumen: 'Un ejemplo con imágenes, descripciones, cantidades y precios, más un total que se muestra por separado.',
    config: configProductos(),
    variables: ['total'],
    valores: ['$42.500'],
    // En las columnas de imagen va la URL; el <img> lo arma el generador
    filas: [
      [IMAGENES[0], 'Producto de ejemplo 1', '1', '$10.000'],
      [IMAGENES[1], 'Producto de ejemplo 2', '1', '$25.000'],
      [IMAGENES[2], 'Producto de ejemplo 3', '1', '$7.500'],
    ],
    total: '$42.500',
  },
}

/** Lo que carga la base en cada celda (con el <img> armado en las columnas de imagen). */
export function celdasDeBase(ejemplo) {
  return ejemplo.filas.map(f => f.map((v, i) => {
    const col = ejemplo.config.columnas[i]
    return col.tipo === 'imagen'
      ? construirImg({ url: v, ancho: col.imagen.ancho, alt: col.imagen.alt || col.titulo, alineacion: col.alineacion })
      : v
  }))
}
