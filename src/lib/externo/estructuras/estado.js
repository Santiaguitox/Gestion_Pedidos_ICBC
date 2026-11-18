// Acciones sobre el estado conjunto { config, pedido }. Diseño y pedido comparten
// las columnas: agregar o quitar una columna toca los dos a la vez.

import { MAX_COLUMNAS } from './constantes.js'
import { columnaNueva, configInicial, escalarAnchos, repartirAnchos } from './bloque.js'
import { extraerUrlImagen } from './imagen.js'
import { normalizarPedido, pedidoInicial, pedidoVacio } from './pedido.js'

export function estadoInicial() {
  const config = configInicial()
  return { config, pedido: pedidoInicial(config) }
}

export function estadoEnBlanco() {
  const config = { ...configInicial(), columnas: [{ ...columnaNueva(1) }, { ...columnaNueva(2) }] }
  config.columnas = config.columnas.map((c, i) => ({ ...c, ancho: repartirAnchos(2)[i] }))
  return { config, pedido: pedidoVacio(config) }
}

export function agregarColumna(estado) {
  const n = estado.config.columnas.length
  if (n >= MAX_COLUMNAS) return estado
  // La columna nueva toma su parte pareja y las otras se achican en proporción (sin pisar lo que se ajustó)
  const nueva = repartirAnchos(n + 1)[n]
  const otros = escalarAnchos(estado.config.columnas.map(c => c.ancho), 100 - nueva)
  const anchos = [...otros, nueva]
  const columnas = [...estado.config.columnas, columnaNueva(n + 1)].map((c, i) => ({ ...c, ancho: anchos[i] }))
  const config = { ...estado.config, columnas }
  return {
    config,
    pedido: normalizarPedido(estado.pedido, columnas.length),
  }
}

export function quitarColumna(estado, indice) {
  const cols = estado.config.columnas
  if (cols.length <= 1) return estado
  // Lo que ocupaba la columna quitada se reparte entre las otras en proporción
  const restantes = cols.filter((_, i) => i !== indice)
  const anchos = escalarAnchos(restantes.map(c => c.ancho), 100)
  const columnas = restantes.map((c, i) => ({ ...c, ancho: anchos[i] }))
  const pedido = {
    ...estado.pedido,
    contactos: estado.pedido.contactos.map(c => ({ ...c, filas: c.filas.map(f => f.filter((_, i) => i !== indice)) })),
  }
  return { config: { ...estado.config, columnas }, pedido: normalizarPedido(pedido, columnas.length) }
}

/** Deja el contenido de prueba en blanco (un contacto vacío) sin tocar el diseño. */
export function limpiarContenido(estado) {
  return { ...estado, pedido: pedidoVacio(estado.config) }
}

/**
 * Cambia el tipo de una columna (texto / imagen) y arregla lo que ya estaba cargado en ella:
 * al pasar a texto, las URLs o <img> se reemplazan por un texto de ejemplo (si no, se verían
 * como texto); al pasar a imagen se vacían los textos de ejemplo automáticos.
 */
export function cambiarTipoColumna(estado, indice, tipo) {
  const col = estado.config.columnas[indice]
  if (!col || col.tipo === tipo) return estado
  const columnas = estado.config.columnas.map((c, i) => (i === indice ? { ...c, tipo } : c))
  const contactos = estado.pedido.contactos.map((ct, ci) => ({
    ...ct,
    filas: ct.filas.map((f, ri) => f.map((v, k) => {
      if (k !== indice) return v
      if (tipo === 'texto') return extraerUrlImagen(v) ? `C${ci + 1} dato ${ri + 1}.${indice + 1}` : v
      return /^C\d+ dato \d+\.\d+$/.test(String(v).trim()) ? '' : v
    })),
  }))
  return { config: { ...estado.config, columnas }, pedido: { ...estado.pedido, contactos } }
}

/** Une la imagen guardada con la de por defecto y descarta `ejemplo`, un campo de versiones anteriores que ya no se usa. */
function imagenSaneada(porDefecto, guardada) {
  const img = { ...porDefecto, ...guardada }
  delete img.ejemplo
  return img
}

/** Lee lo guardado en el navegador y descarta lo que no tenga la forma esperada. */
export function estadoDesdeGuardado(crudo) {
  try {
    const v = typeof crudo === 'string' ? JSON.parse(crudo) : crudo
    if (!v?.config?.columnas?.length || !v?.pedido?.contactos?.length) return null
    const base = configInicial()
    const config = {
      ...base,
      ...v.config,
      encabezado: { ...base.encabezado, ...v.config.encabezado, bordes: { ...base.encabezado.bordes, ...v.config.encabezado?.bordes }, borde: { ...base.encabezado.borde, ...v.config.encabezado?.borde } },
      cuerpo: {
        ...base.cuerpo,
        ...v.config.cuerpo,
        bordes: { ...base.cuerpo.bordes, ...v.config.cuerpo?.bordes },
        borde: { ...base.cuerpo.borde, ...v.config.cuerpo?.borde },
        separacion: { ...base.cuerpo.separacion, ...v.config.cuerpo?.separacion },
      },
      columnas: v.config.columnas.map((c, i) => ({ ...columnaNueva(i + 1), ...c, imagen: imagenSaneada(columnaNueva(i + 1).imagen, c.imagen) })),
    }
    if (config.columnas.length > MAX_COLUMNAS) return null
    const pedido = normalizarPedido({ variables: v.pedido.variables ?? [], contactos: v.pedido.contactos }, config.columnas.length)
    return { config, pedido }
  } catch {
    return null
  }
}
