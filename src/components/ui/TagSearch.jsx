import { useState, useRef, useEffect } from 'react'
import { Tag, X, ChevronDown } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'

// Selector de tag con buscador.
//
// DOS presentaciones, una por contexto — y la razon importa (esta
// decision cerro una saga larga de bugs de teclado en iOS, no
// simplificarla sin leer esto):
//
// - DESKTOP: popover absolute anclado al trigger, en flujo. Sin teclado
//   virtual no hay nada que mueva el viewport, el anclaje es estable.
//   El overflow:hidden del acordeon de filtros se libera solo mientras
//   esta abierto via :has (ver .acordeon-anim-clip en global.css).
//
// - MOBILE: bottom sheet de altura FIJA (mismo lenguaje visual que los
//   sheets del editor de piezas, replicado en clases tagsearch-sheet-*
//   de global.css porque EditorPiezas.css solo se carga en esa pagina).
//   Un popover anclado a un trigger en medio de la pagina no convive
//   con el teclado de iOS: si el trigger esta en la mitad inferior, el
//   input del buscador nace en la zona que el teclado va a tapar, iOS
//   lo "revela" paneando la VENTANA (aunque el shell sea
//   overflow:hidden) y al cerrar el teclado no siempre deshace el
//   corrimiento — esa era la franja gris al pie. El sheet mide 82dvh
//   FIJOS (no max-height): el buscador, pegado al header, queda siempre
//   en el quinto superior de la pantalla, por encima del teclado, este
//   el trigger donde este — iOS no necesita panear nada, nunca. El
//   autoFocus se conserva.
export function TagSearch({ tags, value, onChange, placeholder = 'Buscar tag…' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // Solo desktop: de que lado del trigger cuelga el popover. En la
  // grilla de filtros el TagSearch suele vivir pegado al borde derecho
  // y colgar siempre a la izquierda (left:0) mandaba sus 220px por
  // fuera del viewport. Se decide al abrir midiendo el espacio real.
  const [alineacion, setAlineacion] = useState('left')
  const ref = useRef(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function abrir() {
    if (!isMobile) {
      const ANCHO_DROPDOWN = 220 // debe matchear el width del popover
      const r = ref.current?.getBoundingClientRect()
      if (r) {
        const espacioDerecha = window.innerWidth - r.left
        setAlineacion(espacioDerecha < ANCHO_DROPDOWN + 8 ? 'right' : 'left')
      }
    }
    setOpen(v => !v)
  }

  function cerrar() {
    setQuery('')
    setOpen(false)
  }

  const filtrados = tags.filter(t =>
    t.toLowerCase().includes(query.toLowerCase())
  )

  function seleccionar(tag) {
    onChange(tag)
    cerrar()
  }

  function limpiar(e) {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  // Compartido entre ambas presentaciones — el input mantiene la clase
  // tagsearch-input SIEMPRE: en global.css esa clase tiene el override
  // de 16px en mobile que evita el auto-zoom de iOS al enfocarlo (un
  // fontSize inline le ganaria a ese override, por eso no hay ninguno).
  const inputBuscador = (
    <input
      autoFocus
      className="tagsearch-input"
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder={placeholder}
      onClick={e => e.stopPropagation()}
    />
  )

  const lista = (
    <>
      {filtrados.length === 0 && (
        <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', padding:'0.5rem 0.75rem' }}>Sin resultados</p>
      )}
      {filtrados.map(t => (
        <button key={t} onClick={() => seleccionar(t)}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.75rem', fontSize:'0.8125rem', textAlign:'left', background: value === t ? 'rgba(91,78,232,0.08)' : 'transparent', color: value === t ? 'var(--icomm-violet)' : 'var(--text-secondary)', fontWeight: value === t ? 600 : 400, transition:'background 100ms' }}
          onMouseEnter={e => { if (value !== t) e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { if (value !== t) e.currentTarget.style.background = 'transparent' }}>
          <Tag size={11} style={{ flexShrink:0 }} />{t}
          {value === t && <span style={{ marginLeft:'auto', fontSize:'0.6875rem', color:'var(--icomm-violet)' }}>✓</span>}
        </button>
      ))}
    </>
  )

  return (
    <div ref={ref} className={`tagsearch${open ? ' tagsearch-abierto' : ''}`} style={{ position:'relative', minWidth:'150px', width:'auto' }}>
      {/* Trigger */}
      <div onClick={abrir}
        style={{ display:'flex', alignItems:'center', gap:'0.375rem', padding:'0.5rem 0.75rem', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:'0.875rem', fontWeight:400, color: value ? 'var(--icomm-violet)' : 'var(--text-muted)', minWidth:'150px', userSelect:'none', transition:'border-color 150ms ease, box-shadow 150ms ease' }}>
        <Tag size={13} style={{ flexShrink:0 }} />
        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {value || 'Todos los tags'}
        </span>
        {value
          ? <button onClick={limpiar} style={{ display:'flex', alignItems:'center', color:'var(--icomm-violet)', flexShrink:0 }}><X size={12} /></button>
          : <ChevronDown size={12} style={{ flexShrink:0, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 150ms' }} />
        }
      </div>

      {/* MOBILE: bottom sheet (lenguaje visual de los sheets del editor
          de piezas). Fixed inset:0 — no se ancla a nada, ningun
          corrimiento de viewport puede desacomodarlo, y el overflow del
          acordeon no lo recorta (overflow no clipea descendientes
          fixed). Tap en el fondo o en la X cierra. */}
      {open && isMobile && (
        <div className="tagsearch-sheet-overlay" onClick={cerrar}>
          <div className="tagsearch-sheet" onClick={e => e.stopPropagation()}>
            <div className="tagsearch-sheet-handle" />
            <div className="tagsearch-sheet-header">
              <span>Filtrar por tag</span>
              <button onClick={cerrar} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="tagsearch-sheet-search">
              {inputBuscador}
            </div>
            <div className="tagsearch-sheet-body">
              {lista}
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP: popover anclado al trigger */}
      {open && !isMobile && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left: alineacion === 'left' ? 0 : 'auto', right: alineacion === 'right' ? 0 : 'auto', zIndex:400, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-lg)', width:'220px', maxWidth:'calc(100vw - 24px)', overflow:'hidden' }}>
          <div style={{ padding:'0.5rem' }}>
            {inputBuscador}
          </div>
          <div className="tagsearch-lista" style={{ overflowY:'auto' }}>
            {lista}
          </div>
        </div>
      )}
    </div>
  )
}
