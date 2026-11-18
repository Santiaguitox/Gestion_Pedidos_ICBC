import { ArrowRight, Check, ChevronDown, Clock, House, Menu, ScanSearch, Table2 } from 'lucide-react'

const ICONOS = {
  inicio: House,
  analisis: ScanSearch,
  estructuras: Table2,
  proximamente: Clock,
  flecha: ArrowRight,
  check: Check,
  menu: Menu,
  chevron: ChevronDown,
}

export default function HerramientaIcono({ nombre, className = '', size = 18 }) {
  const Icono = ICONOS[nombre] ?? ScanSearch
  return <Icono className={className} size={size} aria-hidden="true" />
}
