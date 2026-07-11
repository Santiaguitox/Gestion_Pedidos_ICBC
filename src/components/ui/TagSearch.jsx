import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Tag, X, ChevronDown, Search, Check } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'

// Selector de tag con buscador.
//
// DOS presentaciones, totalmente independientes:
//
// - DESKTOP: popover absolute anclado al trigger, en flujo. Nunca se
//   tocó en toda esta saga y sigue igual.
//
// - MOBILE: panel de TOMA COMPLETA DE PANTALLA (full-screen takeover),
//   no un bottom-sheet. Este es el patrón que usan los buscadores/filtros
//   nativos (Maps, App Store, Gmail) y el que resuelve de raíz — no
//   parchea — los tres síntomas que veníamos arrastrando:
//
//   - "Franja gris": un panel con alto fijo en vh no se achica cuando
//     aparece el teclado (en iOS el teclado reduce el visual viewport,
//     no el layout viewport) y deja un espacio muerto. Acá el panel usa
//     100dvh (dinámico) y el teclado nunca tiene que competir por
//     espacio con nada: el header y el buscador son fijos arriba, la
//     lista es la ÚNICA zona flexible.
//   - "El panel se movía o desaparecía": pasaba porque Safari, al
//     enfocar un input, hace scroll automático del documento — y un
//     panel fixed queda anclado al layout viewport que Safari acaba de
//     mover. Acá el buscador NO tiene autoFocus (el usuario lo toca
//     cuando quiere buscar), así que el teclado nunca aparece solo, sin
//     que el usuario ya esté mirando el panel ya asentado.
//   - "Colapsaba con 0 resultados": pasaba porque el alto dependía del
//     contenido. Acá el alto es SIEMPRE 100dvh y el estado "sin
//     resultados" se renderiza adentro del mismo flex:1 — nunca encoge
//     el panel.
//
//   Se cierra con la X, eligiendo un tag, o con el botón atrás de
//   Android (se pushea una entrada al history al abrir y se escucha
//   popstate — ver efecto más abajo). No existe "tocar afuera" porque
//   no hay afuera: es pantalla completa, sin backdrop que alinear.
export function TagSearch({ tags, value, onChange, placeholder = 'Buscar tag…' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // Solo visual, panel mobile: resalta el buscador (fondo blanco + borde
  // rojo de marca) mientras tiene foco, calcado del refresh visual que
  // pidió el usuario. No afecta el layout ni el teclado.
  const [buscadorEnfocado, setBuscadorEnfocado] = useState(false)
  // Solo desktop: de que lado del trigger cuelga el popover. En la
  // grilla de filtros el TagSearch suele vivir pegado al borde derecho
  // y colgar siempre a la izquierda (left:0) mandaba sus 220px por
  // fuera del viewport. Se decide al abrir midiendo el espacio real.
  const [alineacion, setAlineacion] = useState('left')
  // Refuerzo del punto 7 del spec (Android WebView viejos): si hay
  // window.visualViewport, seguimos su alto en vivo y lo aplicamos como
  // alto explícito del panel en vez de confiar solo en 100dvh.
  const [altoVisual, setAltoVisual] = useState(null)
  const ref = useRef(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    function handleClick(e) {
      // El panel mobile vive portaleado en document.body, fuera del
      // subárbol de `ref` — sin este chequeo, cualquier click adentro
      // (tipear, elegir un tag) se leería como "click afuera".
      if (e.target.closest('.tagsearch-full')) return
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // SCROLL-LOCK del fondo mientras el panel mobile está abierto. No es
  // estrictamente necesario para el layout (el panel es pantalla
  // completa, no depende de dónde esté el scroll de la página) pero
  // evita que un swipe se "filtre" al fondo y lo mueva mientras tanto.
  // Se restaura el scroll exacto al cerrar (punto 8 del spec).
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

  // Botón ATRÁS de Android (punto 8 del spec): pushea una entrada al
  // history al abrir, y popstate cierra el panel en vez de sacar al
  // usuario de la pantalla. cerrar() dispara history.back() en vez de
  // cerrar directo, para consumir esa entrada — así el próximo atrás
  // "de verdad" no queda pisado por una entrada fantasma.
  useEffect(() => {
    if (!open || !isMobile) return
    window.history.pushState({ tagsearchOpen: true }, '')
    // Si el panel muere sin pasar por popstate (ej. el componente se
    // desmonta con el panel abierto porque algo navegó por otra vía),
    // la entrada pusheada quedaba huérfana: el próximo "atrás" del
    // usuario la consumía sin efecto visible. El cleanup la consume él
    // mismo — pero SOLO si el tope del history sigue siendo nuestra
    // entrada (history.state.tagsearchOpen): si react-router ya pusheó
    // una navegación encima, hacer back() acá sacaría al usuario de la
    // pantalla a la que acaba de ir, que es peor que la entrada muerta.
    let consumida = false
    function handlePopState() {
      consumida = true
      setOpen(false)
      setQuery('')
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (!consumida && window.history.state?.tagsearchOpen) window.history.back()
    }
  }, [open, isMobile])

  // Refuerzo opcional de visualViewport (punto 7 del spec) — sigue el
  // alto real disponible en vivo (con o sin teclado) para navegadores
  // viejos donde 100dvh no alcance a reaccionar solo.
  useEffect(() => {
    if (!open || !isMobile || !window.visualViewport) return
    const vv = window.visualViewport
    function actualizar() { setAltoVisual(vv.height) }
    actualizar()
    vv.addEventListener('resize', actualizar)
    return () => {
      vv.removeEventListener('resize', actualizar)
      setAltoVisual(null)
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
    if (isMobile && open) {
      // Deja que el popstate handler cierre y limpie el query — así se
      // consume la entrada de history que se pusheó al abrir.
      window.history.back()
    } else {
      setQuery('')
      setOpen(false)
    }
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

  // Input de DESKTOP — se conserva tal cual, con autoFocus (ahí nunca
  // hubo problema de teclado). La clase tagsearch-input trae el override
  // de 16px en mobile que evita el auto-zoom de iOS al enfocarlo (un
  // fontSize inline le ganaría a ese override, por eso no hay ninguno).
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

  // Lista MOBILE — filas de 52px con badge de ícono redondeado (look del
  // refresh visual), rojo de marca (--accent-primary / --red-bg) en vez
  // de gris plano cuando el tag está seleccionado.
  const listaMobile = (
    <>
      {filtrados.map(t => {
        const sel = value === t
        return (
          <button key={t} onClick={() => seleccionar(t)} className="tagsearch-full-row"
            style={{ background: sel ? 'var(--red-bg)' : 'transparent' }}>
            <span className="tagsearch-full-row-left">
              <span className="tagsearch-full-row-badge" style={{ background: sel ? 'var(--red-bg-soft)' : 'var(--bg-hover)' }}>
                <Tag size={14} style={{ color: sel ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              </span>
              <span style={{ color: sel ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: sel ? 700 : 500, fontSize:'0.9688rem' }}>{t}</span>
            </span>
            {sel && <Check size={17} strokeWidth={2.6} style={{ color:'var(--accent-primary)', flexShrink:0 }} />}
          </button>
        )
      })}
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

      {/* MOBILE: panel full-screen, portaleado a document.body — ver
          comentario de cabecera. Sin backdrop: el panel ES la pantalla. */}
      {open && isMobile && createPortal(
        <div className="tagsearch-full" style={altoVisual ? { height: `${altoVisual}px` } : undefined}>
          <div className="tagsearch-full-header">
            <div className="tagsearch-full-handle" />
            <div className="tagsearch-full-titlebar">
              <span>Filtrar por tag</span>
              <button onClick={cerrar} aria-label="Cerrar" className="tagsearch-full-close"><X size={16} /></button>
            </div>
            <div className="tagsearch-full-searchbar" style={{ background: buscadorEnfocado ? 'var(--bg-surface)' : 'var(--bg-hover)', borderColor: buscadorEnfocado ? 'var(--accent-primary)' : 'transparent' }}>
              <Search size={16} style={{ flexShrink:0, color:'var(--text-muted)' }} />
              <input
                className="tagsearch-full-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setBuscadorEnfocado(true)}
                onBlur={() => setBuscadorEnfocado(false)}
                placeholder={placeholder}
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="tagsearch-full-clear-x"><X size={11} /></button>
              )}
            </div>
          </div>

          <div className="tagsearch-full-body">
            {filtrados.length > 0 ? listaMobile : (
              <div className="tagsearch-full-empty">
                <Tag size={36} strokeWidth={1.6} style={{ color:'var(--border-strong)' }} />
                <p>No hay tags que coincidan con<br /><strong style={{ color:'var(--text-secondary)' }}>"{query}"</strong></p>
                <button onClick={() => setQuery('')} className="tagsearch-full-empty-btn">Limpiar búsqueda</button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* DESKTOP: popover anclado al trigger — sin cambios */}
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
