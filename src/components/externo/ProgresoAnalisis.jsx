import { LoaderCircle } from 'lucide-react'

export default function ProgresoAnalisis({ texto, porcentaje }) {
  const pct = Math.max(0, Math.min(100, Math.round(porcentaje || 0)))
  return (
    <section className="ex-progreso" aria-live="polite">
      <div className="ex-progreso__fila">
        <LoaderCircle className="ex-icono ex-icono--giro" aria-hidden="true" />
        <p className="ex-progreso__texto">{texto || 'Analizando…'}</p>
        <span className="ex-progreso__porcentaje">{pct} %</span>
      </div>
      <progress className="ex-medidor" max="100" value={pct} aria-label="Progreso del análisis">{pct} %</progress>
      <p className="ex-progreso__nota">Estamos descargando el HTML y revisando cada imagen de la pieza.</p>
    </section>
  )
}
