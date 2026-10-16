import { Moon, Sun } from 'lucide-react'

export default function SelectorTema({ tema, onAlternar }) {
  const oscuro = tema === 'oscuro'
  return (
    <button
      type="button"
      className="ex-tema"
      role="switch"
      aria-checked={oscuro}
      aria-label="Modo oscuro"
      title={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onClick={onAlternar}
    >
      <Sun className="ex-tema__icono ex-tema__icono--sol" aria-hidden="true" />
      <Moon className="ex-tema__icono ex-tema__icono--luna" aria-hidden="true" />
      <span className="ex-tema__perilla" />
    </button>
  )
}
