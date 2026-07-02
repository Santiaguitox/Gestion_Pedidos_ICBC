import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Config propia de vitest (vitest la prefiere sobre vite.config.js):
// evita cargar los plugins de React y Tailwind al correr tests — no
// hacen falta porque la suite cubre solo las libs puras (string in →
// string/estructura out), sin componentes ni DOM, y sin ellos el
// arranque es más rápido y sin efectos colaterales de build.
//
// import.meta.glob (usado por src/lib/editor/bloques.js para cargar
// los templates reales) es feature core de Vite y funciona en vitest
// sin ningún plugin — los tests corren contra los MISMOS HTML de
// src/data/Templates que usa la app.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
  },
})
