// Lo "externo" no puede depender del resto de la app (ni de Supabase ni de la
// sesión): si algún día se rompe algo allá, estas páginas siguen andando.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
const CARPETAS = ['src/lib/externo', 'src/components/externo', 'api/externo']
const ARCHIVOS = ['src/pages/Analisis.jsx', 'scripts/externo-proxy-local.mjs']
const PERMITIDOS = [/^\.\.?\//, /^\.\.\/\.\.\/assets\/Icomm_Logo\.png$/, /^\.\.\/styles\/Externo\.css$/]

function listar(dir) {
  const completo = path.join(RAIZ, dir)
  return fs.readdirSync(completo, { withFileTypes: true }).flatMap(e => {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'fixtures' ? [] : listar(rel)
    return /\.(jsx?|mjs)$/.test(e.name) ? [rel] : []
  })
}

describe('aislamiento de lo externo', () => {
  const archivos = [...CARPETAS.flatMap(listar), ...ARCHIVOS].filter(f => !f.includes('__tests__'))
  it('hay archivos que revisar', () => expect(archivos.length).toBeGreaterThan(20))
  it.each(archivos)('%s solo importa de lo externo, librerías o assets', archivo => {
    const texto = fs.readFileSync(path.join(RAIZ, archivo), 'utf8')
    const imports = [...texto.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm)].map(m => m[1] || m[2] || m[3])
    for (const origen of imports) {
      expect(origen, `${archivo} importa ${origen}`).not.toMatch(/^@\/|supabase|context|revision/i)
      if (origen.startsWith('.')) {
        const destino = path.normalize(path.join(path.dirname(archivo), origen))
        const ok = /(^|\/)externo(\/|$)|externo[^/]*$/.test(destino) || /Analisis\.jsx$/.test(destino)
          || destino === 'src/assets/Icomm_Logo.png' || destino === 'src/styles/Externo.css'
        expect(ok, `${archivo} importa ${origen} (${destino})`).toBe(true)
      }
    }
    expect(PERMITIDOS.length).toBeGreaterThan(0)
  })
})
