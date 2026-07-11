import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Tag, X, ChevronDown } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'

// Selector de tag con buscador.
//
// DOS presentaciones, una por contexto:
//
// - DESKTOP: popover absolute anclado al trigger, en flujo. Sin teclado
//   virtual no hay nada que mueva el viewport, el anclaje es estable.
//   El overflow:hidden del acordeon de filtros ya no le afecta: ver mas
//   abajo por que ahora ni siquiera vive adentro del acordeon.
//
// - MOBILE: bottom sheet con position:fixed. La causa real de TODOS los
//   síntomas anteriores (franja gris, el panel "se movía"/desaparecía
//   con "Sin resultados") no era el teclado ni el autoFocus: es que
//   fixed se ancla al layout viewport, y si la PÁGINA DE FONDO se
//   scrollea mientras el sheet está abierto (el navegador la reacomoda
//   solo, por ejemplo cuando el contenido cambia de alto al no haber
//   coincidencias), el sheet queda "flotando" en un punto que ya no
//   coincide con lo que ves en pantalla. Se resuelve de raíz con lo que
//   usa cualquier bottom-sheet mobile serio, dos cosas combinadas:
//
//   1) SCROLL-LOCK: mientras el sheet está abierto, el body queda
//      literalmente congelado (position:fixed + top negativo = scrollY
//      guardado) — no puede moverse pase lo que pase adentro del sheet.
//      Sin página movediza debajo, no hay a qué desalinearse. Se
//      restaura el scroll exacto al cerrar.
//   2) PORTAL: el sheet se renderiza directo en document.body (createPortal),
//      no anidado en el acordeón de filtros. Así queda aislado de
//      cualquier overflow/clip/transform de ese contenedor — ya no hace
//      falta el parche :has(.tagsearch-abierto) en el acordeón.
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
      // El sheet mobile vive portaleado en document.body, fuera del
      // subárbol de `ref` — sin este chequeo extra, cualquier click
      // adentro del sheet (tipear, elegir un tag) se leería como "click
      // afuera" y lo cerraría antes de procesar la selección.
      if (e.target.closest('.tagsearch-sheet-overlay')) return
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // SCROLL-LOCK del fondo mientras el sheet mobile está abierto — ver
  // comentario de cabecera. Congela el body en su posición actual
  // (position:fixed + top negativo con el scrollY guardado) para que
  // nada pueda moverlo mientras el sheet vive encima, y lo restaura tal
  // cual estaba al cerrar. Solo aplica en mobile: el popover de desktop
  // no lo necesita (nunca desalinea nada).
  useEffect(() => {
    if (!open || !isMobile) return
    const scrollY = window.scrollY
    const { style } = document.body
    const prev = { position: style.position, top: style.top, left: style.left, right: style.right, width: style.width, overflow: style.overflow }
    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.left = '0'
    style.right = '0'
    style.width = '100%'
    style.overflow = 'hidden'
    return () => {
      style.position = prev.position
      style.top = prev.top
      style.left = prev.left
      style.right = prev.right
      style.width = prev.width
      style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [open, isMobile])

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

  // Input de DESKTOP — se conserva tal cual, con autoFocus (ahi nunca
  // hubo problema de teclado). La clase tagsearch-input trae el override
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

  // Input de MOBILE — igual pero SIN autoFocus (ver comentario de
  // cabecera: es la pieza clave para que no haya franja gris).
  const inputBuscadorMobile = (
    <input
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

      {/* MOBILE: bottom sheet, portaleado directo a document.body — ver
          comentario de cabecera. Fixed inset:0 dentro del portal, y con
          el scroll-lock de arriba nada puede desalinearlo. Tap en el
          fondo o en la X cierra. */}
      {open && isMobile && createPortal(
        <div className="tagsearch-sheet-overlay" onClick={cerrar}>
          <div className="tagsearch-sheet" onClick={e => e.stopPropagation()}>
            <div className="tagsearch-sheet-handle" />
            <div className="tagsearch-sheet-header">
              <span>Filtrar por tag</span>
              <button onClick={cerrar} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="tagsearch-sheet-search">
              {inputBuscadorMobile}
            </div>
            <div className="tagsearch-sheet-body">
              {lista}
            </div>
          </div>
        </div>,
        document.body
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
