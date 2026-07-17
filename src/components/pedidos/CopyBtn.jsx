import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useNotificaciones } from '@/context/NotificacionesContext'

export function CopyBtn({ text, size = 13 }) {
  const { showError } = useNotificaciones()
  const [copied, setCopied] = useState(false)

  async function handleCopy(e) {
    e?.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Sin este catch, un fallo de clipboard (permiso denegado, browser
      // sin soporte, contexto no seguro) igual mostraba "copiado" — el
      // usuario pegaba vacío pensando que el link sí se había copiado.
      showError('No se pudo copiar al portapapeles')
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className={`copy-btn ${copied ? 'copy-btn-copied' : ''}`}>
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}
