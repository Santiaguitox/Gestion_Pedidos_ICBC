import { Component } from 'react'
import { ErrorPage } from '@/pages/ErrorPage'

// Se pone en true una sola vez por sesión de pestaña para no entrar en
// loop de recargas si el reload no soluciona nada (ej. servidor caído
// de verdad). App.jsx la limpia apenas el árbol renderiza bien una
// vez, así que un deploy nuevo posterior en la misma pestaña puede
// volver a disparar un reload automático si hace falta.
const CHUNK_RELOAD_KEY = 'twh-chunk-reload-intentado'

// Después de un deploy, los chunks de Vite cambian de hash. Si alguien
// ya tenía la pestaña abierta y en un momento navega a una página
// lazy-loaded, el navegador pide el chunk viejo — que ya no existe, y
// el hosting devuelve el index.html (SPA fallback) en vez de un 404.
// Eso rompe el MIME type esperado ("application/javascript" vs
// "text/html") y el import() dinámico rechaza con alguno de estos
// mensajes según el navegador.
function esErrorDeChunkDesactualizado(error) {
  const mensaje = String(error?.message ?? '')
  return /dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(mensaje)
}

export class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    if (esErrorDeChunkDesactualizado(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      window.location.reload()
      return
    }
    // Cualquier otro error de React (uno real, no de deploy) se
    // muestra — no tiene sentido recargar en loop algo que no se va a
    // arreglar solo.
  }

  render() {
    if (this.state.hasError) return <ErrorPage />
    return this.props.children
  }
}
