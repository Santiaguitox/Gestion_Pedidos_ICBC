// Configuración del motor de análisis externo (páginas públicas como /analisis).

// En desarrollo (npm run dev) el proxy de Vercel no existe: se usa el script
// local scripts/externo-proxy-local.mjs, que escucha en el puerto 3001.
export const PROXY_URL = import.meta.env?.DEV
  ? 'http://localhost:3001/api/externo/proxy'
  : '/api/externo/proxy'

// Las piezas solo se pueden traer de este dominio y sus subdominios. La
// defensa REAL está en api/externo/proxy.js; esta validación es de UX.
export const DOMINIO_PIEZAS = 'icommarketing.com'

// Clases que genera la propia plataforma de icomm en las piezas armadas con
// su editor y que no están definidas en el <style> de la pieza. No son un
// error del autor, así que el chequeo de clases las ignora.
// Si aparece otra, agregarla acá.
export const CLASES_DE_PLATAFORMA = new Set(['wrap'])

// Cuántas imágenes se miden en paralelo.
export const CONCURRENCIA_IMAGENES = 5
