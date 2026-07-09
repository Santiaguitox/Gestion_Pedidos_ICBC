import { RefreshCw } from 'lucide-react'
import { AuthBrandBackdrop } from '@/components/auth/AuthBrandBackdrop'

// Fallback de <ErrorBoundary> para errores de React que no se
// recuperan solos (a diferencia del caso de chunk desactualizado tras
// un deploy, que ErrorBoundary intenta resolver con un reload
// automático ANTES de llegar a mostrar esto — ver
// src/components/ErrorBoundary.jsx). Si el usuario ve esta pantalla,
// el reload automático ya se descartó o ya se intentó y no alcanzó.
//
// Calcado del diseño de marca "404" ya aprobado
// (TeamWorkHub_Demo_Marca_v1.html, sección #s-404): fondo con el
// isotipo en las esquinas (AuthBrandBackdrop, igual que Login) +
// isotipo chico arriba + código grande con degradé + título +
// subtítulo + botón — SIN caja ni wordmark completo ni "Powered by",
// eso es de Login/SetPassword, no de esta pantalla. Cambié el "404"
// por "¡Ups!" porque esto no es una ruta inexistente, es un error de
// carga/render; el botón usa el mismo estilo lindo con flecha de
// Login (btn-primary-brand), con ícono de refresh en vez de la
// flecha, a pedido.
export function ErrorPage() {
  return (
    <div className="errpage-wrap">
      <AuthBrandBackdrop />
      <img src="/icon-192.png" alt="" aria-hidden="true" className="errpage-iso" />
      <div className="errpage-code">¡Upss!</div>
      <h1 className="errpage-title">Algo salió mal</h1>
      <p className="errpage-sub">
        Hubo un error inesperado cargando la página.<br />
        Probá recargar, si el problema persiste, reportalo al equipo.
      </p>
      <button onClick={() => window.location.reload()} className="btn-primary btn-primary-brand errpage-btn">
        Recargar <span className="btn-arrow"><RefreshCw size={16} /></span>
      </button>
    </div>
  )
}
