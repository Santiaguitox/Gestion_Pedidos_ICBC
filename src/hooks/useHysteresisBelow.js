import { useRef } from 'react'

// Devuelve un booleano ESTABLE ante un valor que fluctúa cerca de un
// umbral (típicamente un ancho medido con ResizeObserver) — evita el
// parpadeo de ida y vuelta cuando cruzar el umbral en una dirección
// dispara, como efecto secundario, un cambio que empuja el valor de
// vuelta para el otro lado (por ej.: un layout que cambia de padding
// o le agrega/saca una scrollbar al propio contenedor que se está
// midiendo — ver el comentario en EditorPiezas.jsx que usa este hook
// para un caso real de esto).
//
// Dos umbrales, no uno: para pasar a `true` hace falta bajar de
// `enterBelow`; para volver a `false` hace falta subir de `exitAbove`
// (mayor que enterBelow). Mientras el valor esté en esa zona
// intermedia, se mantiene el estado anterior sin cambiar — es la
// "zona muerta" que absorbe el salto.
//
// value == null se trata como "todavía no hay medición real" — no
// toca el estado previo (evita un flash antes de la primera medición
// real de quien le pase el valor).
//
// Nota de implementación: el estado vive en un ref y se actualiza
// DURANTE el render (no en un useEffect) — mismo patrón que ya usa
// este proyecto para estado derivado de otro valor (ver el comentario
// sobre redesOrden en EditorPiezas.jsx): evita una pasada de render
// extra en la que se vería el valor viejo antes de re-renderizar con
// el nuevo.
export function useHysteresisBelow(value, enterBelow, exitAbove) {
  const activeRef = useRef(false)

  if (value == null) return activeRef.current

  if (!activeRef.current && value <= enterBelow) {
    activeRef.current = true
  } else if (activeRef.current && value >= exitAbove) {
    activeRef.current = false
  }

  return activeRef.current
}
