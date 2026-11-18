// La pieza "como la ve la persona en su bandeja". El HTML lo arma
// src/lib/externo/estructuras (texto escapado o limpio de scripts), así que se
// inyecta directo. El resaltado de celda/fila se aplica por data-f / data-c.

import { useEffect, useRef } from 'react'

export default function VistaBandeja({ html, resaltado, etiqueta = 'Vista de la pieza', pie }) {
  const raiz = useRef(null)
  const lienzoRef = useRef(null)

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    el.querySelectorAll('.ex-est-hl').forEach(n => n.classList.remove('ex-est-hl'))
    if (!resaltado) return
    const { fila, col } = resaltado
    let objetivo = []
    if (col != null) {
      const celda = el.querySelector(`[data-f="${fila}"][data-c="${col}"]`)
      if (celda) objetivo = [celda]
    } else {
      objetivo = [...el.querySelectorAll(`[data-f="${fila}"]`)]
    }
    objetivo.forEach(n => n.classList.add('ex-est-hl'))
    // Si lo resaltado queda fuera de la vista, se mueve solo el lienzo (no la página)
    const lienzo = lienzoRef.current
    const primero = objetivo[0]
    if (lienzo && primero) {
      const l = lienzo.getBoundingClientRect()
      const c = primero.getBoundingClientRect()
      if (c.top < l.top + 8) lienzo.scrollTop -= l.top + 8 - c.top
      else if (c.bottom > l.bottom - 8) lienzo.scrollTop += c.bottom - (l.bottom - 8)
    }
  }, [resaltado, html])

  return (
    <figure className="ex-est-bandeja">
      <figcaption className="ex-est-bandeja__etiqueta">{etiqueta}</figcaption>
      <div className="ex-est-bandeja__lienzo" ref={lienzoRef}>
        <div className="ex-est-bandeja__pieza" ref={raiz} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {pie && <p className="ex-est-bandeja__pie">{pie}</p>}
    </figure>
  )
}
