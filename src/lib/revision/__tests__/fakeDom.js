// DOM falso mínimo para probar las libs que recorren el árbol (los tests
// corren en entorno node, sin DOM real). Expone lo que usan textoPieza.js,
// terminosObsoletos.js y ortografia.js: childNodes, nodeType, nodeName,
// getAttribute, textContent, querySelectorAll('a').

export const txt = (s) => ({ nodeType: 3, textContent: s })

export function el(nodeName, attrs = {}, ...hijos) {
  const nodo = {
    nodeType: 1,
    nodeName,
    childNodes: hijos.map(h => (typeof h === 'string' ? txt(h) : h)),
    getAttribute: (n) => attrs[n] ?? null,
    get textContent() {
      return Array.from(this.childNodes).map(h => h.textContent ?? '').join('')
    },
  }
  for (const h of nodo.childNodes) h.parentNode = nodo
  return nodo
}

function descendientes(nodo, etiqueta, salida = []) {
  for (const h of nodo.childNodes ?? []) {
    if (h.nodeType !== 1) continue
    if (h.nodeName === etiqueta) salida.push(h)
    descendientes(h, etiqueta, salida)
  }
  return salida
}

export function docDe(...hijosBody) {
  const body = el('BODY', {}, ...hijosBody)
  return {
    body,
    querySelectorAll: (sel) => descendientes(body, sel.toUpperCase()),
  }
}
