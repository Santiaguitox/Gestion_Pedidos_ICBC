// ⚠️ TEMPORAL — solo para que Santi apruebe visualmente el splash de
// arranque (ver index.html, sección #app-splash) sin tener que hacer
// push y recargar en frío la PWA del celular. Reproduce a mano el
// mismo markup/CSS que vive en index.html (no se puede compartir
// código entre ambos: el splash real vive fuera de React, en el HTML
// crudo, antes de que el bundle cargue). Si algún día cambia el splash
// de verdad, actualizar ACÁ también o borrar esta página.
//
// Una vez aprobado el diseño: borrar este archivo y su ruta en
// App.jsx (buscar "PreviewDeCarga"). Esta página NO reemplaza probar
// el splash real en un celu — solo deja ver el diseño y la animación
// sin pushear; el timing real (cuánto dura antes de que React lo
// reemplace) depende de la velocidad de red/dispositivo y no se puede
// simular acá.
import { useState } from 'react'

const SHAPES = [
  { top: '26%', left: '16%', width: '54%', height: '54%', rotate: '-18deg', color: '#0039D1', delay: '0s' },
  { top: '20%', left: '26%', width: '58%', height: '58%', rotate: '0deg', color: '#3364FF', delay: '0.16s' },
  { top: '26%', left: '36%', width: '54%', height: '54%', rotate: '18deg', color: '#47BDDF', delay: '0.32s' },
]

export default function PreviewCarga() {
  const [tema, setTema] = useState('light')
  const fondo = tema === 'dark' ? '#0A1230' : '#F4F5FA'
  // Wordmark en color sólido (no degradado con background-clip:text):
  // esa técnica se rompía en dark — el shorthand "background:
  // linear-gradient(...)" del override de dark reseteaba
  // background-clip a su valor inicial, y el texto quedaba invisible
  // dentro de un rectángulo pintado en vez de recortado a la forma de
  // las letras. Color plano es mucho más robusto para algo tan chico.
  const colorWordmark = tema === 'dark' ? '#5B85FF' : '#2457F1'

  return (
    <div style={{ position: 'fixed', inset: 0, background: fondo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      <style>{`
        @keyframes preview-splash-breathe {
          0%, 100% { transform: scale(1);     filter: brightness(1); }
          50%      { transform: scale(1.055); filter: brightness(1.12); }
        }
      `}</style>

      <span style={{
        fontFamily: "'Poppins', 'DM Sans', -apple-system, sans-serif",
        fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.02em', lineHeight: 1, whiteSpace: 'nowrap',
        color: colorWordmark,
      }}>
        TeamWorkHub<sup style={{ fontSize: '0.42em', fontWeight: 600, color: '#47BDDF', verticalAlign: 'super' }}>.app</sup>
      </span>

      <div style={{ position: 'relative', width: 120, height: 120 }}>
        {SHAPES.map((s, i) => (
          <div key={i} style={{ position: 'absolute', top: s.top, left: s.left, width: s.width, height: s.height, transform: `rotate(${s.rotate})` }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '30%', background: s.color,
              boxShadow: '0 10px 22px rgba(6,14,40,0.30), inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -7px 12px rgba(0,0,10,0.16)',
              animation: `preview-splash-breathe 2.1s ease-in-out infinite`,
              animationDelay: s.delay,
            }} />
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <button
          onClick={() => setTema(t => t === 'dark' ? 'light' : 'dark')}
          style={{
            padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: tema === 'dark' ? '#FFFFFF' : '#0D0F20',
            color: tema === 'dark' ? '#0D0F20' : '#FFFFFF',
            font: '600 13px Inter, sans-serif',
          }}
        >
          Ver en {tema === 'dark' ? 'claro' : 'oscuro'}
        </button>
      </div>
    </div>
  )
}
