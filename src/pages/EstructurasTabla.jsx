// /estructuras-tabla — herramienta pública (sin login) para entender el campo
// tipo tabla de los envíos, diseñar su bloque HTML y armar bases de prueba.
//
// Dos pestañas: Guía (cómo funciona) e Implementar (diseñar el bloque con la marca
// del cliente y armar la base de prueba, en un solo flujo). Es INDEPENDIENTE del
// resto de la app: no usa Supabase ni la sesión
// (ver src/lib/externo/__tests__/aislamiento.test.js).

import { useRef, useState } from 'react'
import '../styles/Externo.css'
import '../styles/ExternoNav.css'
import '../styles/ExternoEstructuras.css'
import Guia from '../components/externo/estructuras/Guia.jsx'
import Implementar from '../components/externo/estructuras/Implementar.jsx'
import { useEstadoEstructuras } from '../components/externo/estructuras/useEstadoEstructuras.js'
import EncabezadoHerramienta from '../components/externo/herramientas/EncabezadoHerramienta.jsx'
import { useCabeceraExterna } from '../components/externo/herramientas/useCabeceraExterna.js'
import { MarcaFondo } from '../components/externo/Marca.jsx'
import PiePagina from '../components/externo/PiePagina.jsx'
import { useTemaExterno } from '../components/externo/useTemaExterno.js'

const PASOS = [
  { id: 'guia', numero: 1, titulo: 'Guía: cómo funciona' },
  { id: 'implementar', numero: 2, titulo: 'Implementar' },
]

export default function EstructurasTabla() {
  const { tema, alternar } = useTemaExterno()
  useCabeceraExterna('Estructura tipo tabla · TeamWorkHub')
  const { estado, setEstado, actualizarConfig, actualizarPedido, empezarDeCero } = useEstadoEstructuras()
  const [paso, setPaso] = useState('guia')
  const pasosRef = useRef(null)

  const irA = id => {
    setPaso(id)
    // Al cambiar de paso desde un botón de la página, se vuelve al inicio del contenido
    pasosRef.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <div className="ex-pantalla" data-theme={tema}>
      <MarcaFondo />
      <div className="ex-pantalla__interior">
        <EncabezadoHerramienta
          tema={tema}
          onAlternarTema={alternar}
          actual="estructuras"
          titulo="Estructura tipo tabla"
          subtitulo="Conocé cómo funcionan estas estructuras y creá diseños personalizados para tus clientes, listos para implementar y probar."
        />

        <div className="ex-est-pasos" role="tablist" aria-label="Pasos" ref={pasosRef}>
          {PASOS.map(p => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`ex-est-tab-${p.id}`}
              aria-selected={paso === p.id}
              aria-controls="ex-est-contenido"
              className="ex-est-paso"
              onClick={() => setPaso(p.id)}
            >
              <span className="ex-est-paso__num" aria-hidden="true">{p.numero}</span>
              {p.titulo}
            </button>
          ))}
        </div>

        <main id="ex-est-contenido" role="tabpanel" aria-labelledby={`ex-est-tab-${paso}`}>
          {paso === 'guia' && <Guia alImplementar={() => irA('implementar')} />}
          {paso === 'implementar' && (
            <Implementar
              estado={estado}
              actualizarConfig={actualizarConfig}
              actualizarPedido={actualizarPedido}
              setEstado={setEstado}
              empezarDeCero={empezarDeCero}
            />
          )}
        </main>

        <PiePagina />
      </div>
    </div>
  )
}
