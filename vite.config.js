import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa las dependencias grandes de terceros en chunks propios.
        // Objetivo: cacheo entre deploys — estas libs casi nunca cambian,
        // así que al tener su propio chunk con hash estable, un cambio en
        // el código de la app (que es lo que cambia seguido) no invalida
        // el chunk de React/Supabase/etc. y el navegador los reusa de
        // cache en vez de re-descargarlos en cada deploy.
        //
        // Vite 8 usa Rolldown, que exige manualChunks como FUNCIÓN (no
        // como objeto). Se matchea por ruta del módulo. El orden importa:
        // las libs más específicas van primero para que 'react-day-picker'
        // caiga en vendor-dates (depende de date-fns) y no en vendor-react
        // por contener 'react' en el nombre. react/react-dom/react-router
        // van juntos a propósito (comparten estado interno, separarlos
        // puede romper el orden de inicialización).
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-day-picker')) return 'vendor-dates'
          if (id.includes('date-fns')) return 'vendor-dates'
          if (id.includes('react-router')) return 'vendor-react'
          if (id.includes('react-dom')) return 'vendor-react'
          if (id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('jszip')) return 'vendor-jszip'
          if (id.includes('lucide-react')) return 'vendor-icons'
        },
      },
    },
  },
})
