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
