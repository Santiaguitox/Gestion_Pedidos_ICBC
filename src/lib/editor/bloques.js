// Catálogo de bloques del Editor de Piezas, cargado con
// import.meta.glob de Vite sobre los templates HTML reales.
// Módulo aparte a propósito: es el ÚNICO de lib/editor que depende
// de Vite (import.meta.glob no existe en Node puro) — mantenerlo
// aislado permite que el resto de las libs sean funciones puras
// testeables, y que un test pueda proveer su propio catálogo si
// hiciera falta.

// ─── Bloques ────────────────────────────────────────────────────────────────
// IMPORTANTE: { as: 'raw' } es la sintaxis VIEJA de import.meta.glob,
// removida en Vite 5+. Este proyecto usa Vite 8 (ver package.json) —
// con la sintaxis vieja, Vite cae al comportamiento default del glob
// (importar el módulo completo, no el string crudo), y cada entrada de
// BLOQUES_RAW termina siendo un objeto Module en vez de un string. Eso
// explica el bug real visto en producción: el HTML del bloque se
// mostraba como el texto literal "[object Module]" en vez de su
// contenido — pasaba solo en Vercel (que reinstala node_modules según
// package.json, trayendo Vite 8 real) y no en local, donde
// probablemente había quedado una instalación vieja de Vite que sí
// soportaba la sintaxis deprecada sin avisar con un error.
export const BLOQUES_RAW = import.meta.glob(
  '/src/data/Templates/ICBC/{Header,Contenido,Botones}/*.html',
  { query: '?raw', import: 'default', eager: true }
)
export const BLOQUES = Object.entries(BLOQUES_RAW).map(([path, html]) => {
  const partes = path.split('/')
  const categoria = partes[partes.length - 2]
  const slug = partes[partes.length - 1].replace('.html', '')
  const nombre = slug.replace(/_/g, ' ')
  return { id: path, categoria, nombre, slug, html }
}).sort((a, b) => a.nombre.localeCompare(b.nombre))

export const BLOQUES_HEADER = BLOQUES.filter(b => b.categoria === 'Header')
export const BLOQUES_CONTENIDO = BLOQUES.filter(b => b.categoria !== 'Header')
export const BLOQUE_ESPACIADOR = BLOQUES.find(b => b.slug === 'Espaciador')

// ─── Manipulación de HTML como STRING PURO ─────────────────────────────────
// NUNCA se usa DOMParser para serializar — contamina el HTML con estilos
// computados del browser. Solo se manipula como string.
