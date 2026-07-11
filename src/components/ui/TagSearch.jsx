import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Tag, X, ChevronDown } from 'lucide-react'

export function TagSearch({ tags, value, onChange, placeholder = 'Buscar tag…' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // Posicion del dropdown en coordenadas del viewport (position: fixed).
  // El dropdown se renderiza en un PORTAL a document.body y no adentro
  // del wrapper: cuando vivia adentro, cualquier ancestro con
  // overflow: hidden (el .acordeon-anim-clip del acordeon de filtros
  // del Dashboard, por ejemplo) lo recortaba y no se llegaba a ver
  // completo. Con el portal + fixed ningun contenedor lo puede recortar.
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      // El dropdown vive en el portal (FUERA de ref), asi que el
      // click-afuera tiene que chequear los dos contenedores — si solo
      // mirara ref, un click en una opcion cerraria el dropdown en el
      // mousedown antes de que llegue a dispararse el onClick.
      if (ref.current && ref.current.contains(e.target)) return
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Recalcula la posicion al abrir, y la mantiene pegada al trigger si
  // la pagina scrollea o cambia el tamano de la ventana mientras esta
  // abierto (scroll en fase captura para enterarse tambien del scroll
  // de contenedores internos, no solo del window).
  useLayoutEffect(() => {
    if (!open) return
    function reposicionar() {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const ancho = Math.max(200, r.width)
      setPos({
        top: r.bottom + 4,
        left: Math.min(r.left, Math.max(8, window.innerWidth - ancho - 8)),
        minWidth: ancho,
      })
    }
    reposicionar()
    window.addEventListener('resize', reposicionar)
    window.addEventListener('scroll', reposicionar, true)
    return () => {
      window.removeEventListener('resize', reposicionar)
      window.removeEventListener('scroll', reposicionar, true)
    }
  }, [open])

  const filtrados = tags.filter(t =>
    t.toLowerCase().includes(query.toLowerCase())
  )

  function seleccionar(tag) {
    onChange(tag)
    setQuery('')
    setOpen(false)
  }

  function limpiar(e) {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  return (
    <div ref={ref} style={{ position:'relative', minWidth:'150px', width:'auto' }}>
      {/* Trigger */}
      <div onClick={() => setOpen(v => !v)}
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

      {/* Dropdown — en portal a document.body (ver comentario de pos) */}
      {open && pos && createPortal(
        <div ref={dropdownRef} style={{ position:'fixed', top:pos.top, left:pos.left, zIndex:400, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-lg)', minWidth:pos.minWidth, overflow:'hidden' }}>
          {/* Buscador */}
          <div style={{ padding:'0.5rem' }}>
            {/* fontSize y padding viven en .tagsearch-input (global.css) y no
                inline: un estilo inline le gana hasta al bloque mobile de
                global.css, y este input necesita el override de 16px en el
                celu para no disparar el auto-zoom al enfocarlo. */}
            <input
              autoFocus
              className="tagsearch-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              onClick={e => e.stopPropagation()}
            />
          </div>
          {/* Opciones */}
          <div style={{ maxHeight:'220px', overflowY:'auto' }}>
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
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
