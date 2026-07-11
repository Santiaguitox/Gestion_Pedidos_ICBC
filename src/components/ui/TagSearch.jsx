import { useState, useRef, useEffect } from 'react'
import { Tag, X, ChevronDown } from 'lucide-react'

export function TagSearch({ tags, value, onChange, placeholder = 'Buscar tag…' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

  // El dropdown se renderiza EN FLUJO (absolute dentro de este wrapper),
  // no en un portal con position: fixed: fixed se rompe en iOS cuando el
  // teclado esta abierto (el sistema panea el visual viewport y los
  // elementos fixed quedan anclados al layout viewport, asi que el
  // dropdown quedaba flotando en cualquier lado). En flujo scrollea junto
  // con el contenido y no tiene ese problema.
  // El recorte del overflow: hidden del acordeon de filtros se resuelve
  // del lado del CSS: la clase tagsearch-abierto de este wrapper le avisa
  // al clip del acordeon (via :has, ver .acordeon-anim-clip en global.css)
  // que libere el overflow SOLO mientras el dropdown esta abierto — asi
  // la animacion de apertura/cierre del acordeon queda intacta.
  return (
    <div ref={ref} className={`tagsearch${open ? ' tagsearch-abierto' : ''}`} style={{ position:'relative', minWidth:'150px', width:'auto' }}>
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

      {/* Dropdown */}
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:400, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-lg)', minWidth:'200px', overflow:'hidden' }}>
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
        </div>
      )}
    </div>
  )
}
