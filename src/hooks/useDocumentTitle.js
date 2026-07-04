import { useEffect } from 'react'

// Setea el título de la pestaña del navegador con el formato "WorkHub | Sección".
// Se llama una vez por página (ver src/pages/*.jsx). Si `titulo` es null/undefined
// (por ejemplo mientras un dato todavía está cargando), muestra solo "WorkHub".
export function useDocumentTitle(titulo) {
  useEffect(() => {
    document.title = titulo ? `WorkHub | ${titulo}` : 'WorkHub'
  }, [titulo])
}
