// Barra que solo aparece cuando se llega a /analisis desde adentro de la app
// (botón "Análisis público" de Revisión de emails). Ofrece volver y copiar el
// link público para compartirlo.
//
// Mantiene la independencia de la página: no usa Supabase ni la sesión. La
// señal viaja en el estado de navegación del router; si falta (entrada directa
// por el link público) la barra no se muestra. El link copiado se arma siempre
// con el origen actual y la ruta fija, nunca con datos que vengan del estado.

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Link2 } from 'lucide-react'

const RUTA_PUBLICA = '/analisis'
const RUTA_VOLVER = '/revision-html'

export default function AccesoDesdeApp() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [copiado, setCopiado] = useState(false)
  const temporizador = useRef(null)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  if (state?.desdeApp !== true) return null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${RUTA_PUBLICA}`)
      setCopiado(true)
      clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles el botón simplemente no confirma.
    }
  }

  return (
    <div className="ex-acceso-app">
      <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={() => navigate(RUTA_VOLVER)}>
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a Revisión de emails
      </button>
      <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={copiar}>
        {copiado ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
        {copiado ? 'Link copiado' : 'Copiar link público'}
      </button>
    </div>
  )
}
