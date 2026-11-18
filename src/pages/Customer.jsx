// /customer — landing pública (sin login) con las herramientas externas de
// TeamWorkHub: cada una vive en su propia ruta y se suma desde
// src/lib/externo/herramientas.js.
//
// Es INDEPENDIENTE del resto de la app: no usa Supabase ni la sesión
// (ver src/lib/externo/__tests__/aislamiento.test.js).

import '../styles/Externo.css'
import '../styles/ExternoNav.css'
import '../styles/ExternoLanding.css'
import { MarcaFondo, Wordmark } from '../components/externo/Marca.jsx'
import PiePagina from '../components/externo/PiePagina.jsx'
import SelectorTema from '../components/externo/SelectorTema.jsx'
import TarjetaHerramienta from '../components/externo/herramientas/TarjetaHerramienta.jsx'
import { useCabeceraExterna } from '../components/externo/herramientas/useCabeceraExterna.js'
import { useTemaExterno } from '../components/externo/useTemaExterno.js'
import { HERRAMIENTAS, RUTA_INICIO } from '../lib/externo/herramientas.js'

export default function Customer() {
  const { tema, alternar } = useTemaExterno()
  useCabeceraExterna('Herramientas y recursos · TeamWorkHub')

  return (
    <div className="ex-pantalla" data-theme={tema}>
      <MarcaFondo />
      <div className="ex-pantalla__interior">
        <header className="ex-encabezado__barra">
          <Wordmark to={RUTA_INICIO} />
          <SelectorTema tema={tema} onAlternar={alternar} />
        </header>

        <main className="ex-landing">
          <div className="ex-landing-cab">
            <p className="ex-landing-eyebrow">Customer</p>
            <h1 className="ex-landing-titulo">Herramientas y recursos</h1>
            <p className="ex-landing-subtitulo">
              Soluciones simples y prácticas para tareas diarias.
            </p>
          </div>
          <ul className="ex-landing-grilla">
            {HERRAMIENTAS.map(h => (
              <li key={h.id}><TarjetaHerramienta herramienta={h} /></li>
            ))}
          </ul>
        </main>

        <PiePagina />
      </div>
    </div>
  )
}
