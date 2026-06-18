import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyBtn({ text, size = 13 }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => { e?.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      title="Copiar"
      className={`copy-btn ${copied ? 'copy-btn-copied' : ''}`}>
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}
