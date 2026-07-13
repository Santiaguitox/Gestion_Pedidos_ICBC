import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { registrarServiceWorker } from '@/lib/push'

// Registro temprano del service worker (Fase 2 — Web Push): idempotente
// y best-effort. Hace que los dispositivos ya suscriptos sigan
// recibiendo push al abrir la app, sin que el usuario tenga que volver
// a tocar el toggle.
registrarServiceWorker()

createRoot(document.getElementById('root')).render(
  <App />
)

// ─── Retiro del splash de arranque (ver #app-splash en index.html) ───
// El splash vive fuera de #root, así que React no lo pisa al montar:
// lo retiramos nosotros, garantizando un mínimo de exhibición de 2s
// (medido desde window.__twhSplashStart, que se marca en index.html
// antes de pedir el bundle). Antes duraba lo que tardaba el bundle en
// cargar — con caché eran milisegundos y parecía un glitch.
const SPLASH_MIN_MS = 2000
const SPLASH_FADE_MS = 350
{
  const splash = document.getElementById('app-splash')
  if (splash) {
    const transcurrido = Date.now() - (window.__twhSplashStart || Date.now())
    const espera = Math.max(0, SPLASH_MIN_MS - transcurrido)
    setTimeout(() => {
      splash.classList.add('app-splash-out')
      setTimeout(() => splash.remove(), SPLASH_FADE_MS)
    }, espera)
  }
}
