// Controles de formulario compartidos por las pantallas de Estructura tipo tabla.

import { useEffect, useId, useRef, useState } from 'react'
import { copiarTexto, descargarTexto } from './utilidades.js'
import { esColorValido, hexAHsv, hsvAHex, normalizarColor } from '../../../lib/externo/estructuras/color.js'
import { Check, ChevronDown, Copy, Download, Info } from 'lucide-react'

/**
 * Panel con número, título y descripción. Con `plegable` el encabezado es un botón
 * que abre y cierra el contenido; cerrado se siguen viendo número, título y descripción.
 */
export function Panel({ paso, titulo, ayuda, children, acciones, className = '', plegable = false, abierto = true, onAlternar, id, insignia = null }) {
  const idCuerpo = useId()
  const titulos = (
    <>
      {paso != null && <span className="ex-est-panel__num" aria-hidden="true">{paso}</span>}
      <span className="ex-est-panel__titulos">
        <h2 className="ex-est-panel__titulo">{titulo}</h2>
        {ayuda && <p className="ex-est-panel__ayuda">{ayuda}</p>}
      </span>
    </>
  )
  return (
    <section id={id} className={`ex-est-panel ${plegable ? 'ex-est-panel--plegable' : ''} ${plegable && !abierto ? 'ex-est-panel--cerrado' : ''} ${className}`}>
      <header className="ex-est-panel__cab">
        {plegable ? (
          <button type="button" className="ex-est-panel__toggle" aria-expanded={abierto} aria-controls={idCuerpo} onClick={onAlternar}>
            {titulos}
            {insignia && !abierto && insignia.cantidad > 0 && (
              <span className={`ex-est-insignia ex-est-insignia--${insignia.nivel}`}>
                <span aria-hidden="true">{insignia.cantidad}</span>
                <span className="ex-solo-lector">{insignia.cantidad} {insignia.nivel === 'error' ? (insignia.cantidad === 1 ? 'error' : 'errores') : (insignia.cantidad === 1 ? 'aviso' : 'avisos')}</span>
              </span>
            )}
            <ChevronDown className="ex-icono ex-est-panel__chevron" aria-hidden="true" />
          </button>
        ) : (
          <div className="ex-est-panel__toggle ex-est-panel__toggle--fijo">{titulos}</div>
        )}
        {acciones && (!plegable || abierto) && <div className="ex-est-panel__acciones">{acciones}</div>}
      </header>
      {plegable ? <div id={idCuerpo} className="ex-est-panel__cuerpo" hidden={!abierto}>{children}</div> : children}
    </section>
  )
}

export function Campo({ etiqueta, ayuda, error, aviso, children, className = '', extra = null }) {
  const id = useId()
  return (
    <div className={`ex-est-campo ${className}`}>
      <span className="ex-est-campo__cab">
        <label className="ex-est-campo__etiqueta" htmlFor={id}>{etiqueta}</label>
        {extra}
      </span>
      {typeof children === 'function' ? children(id) : children}
      {error ? <p className="ex-est-campo__error" role="alert">{error}</p> : aviso ? <p className="ex-est-campo__aviso">{aviso}</p> : ayuda && <p className="ex-est-campo__ayuda">{ayuda}</p>}
    </div>
  )
}

export function Numero({ id, valor, onChange, min, max, sufijo, ariaLabel, placeholder }) {
  return (
    <span className="ex-est-numero">
      <input
        id={id}
        className="ex-est-input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={valor}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
      {sufijo && <span className="ex-est-numero__sufijo">{sufijo}</span>}
    </span>
  )
}

const PALETA = ['#ffffff', '#f3f4f6', '#e1f8fb', '#c0c0c0', '#6b7280', '#333333', '#000000', '#2457f1', '#0e316e', '#16a34a', '#f59e0b', '#dc2626']

/** Selector de color propio (el nativo del navegador abre en RGB y no se puede cambiar): cuadro de saturación/brillo, tono y paleta. */
function SelectorColor({ valor, onChange }) {
  const [hsv, setHsv] = useState(() => hexAHsv(valor))
  const area = useRef(null)

  const aplicar = nuevo => {
    setHsv(nuevo)
    onChange(hsvAHex(nuevo))
  }
  const desdePuntero = e => {
    const r = area.current.getBoundingClientRect()
    const s = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))
    const v = Math.min(100, Math.max(0, 100 - ((e.clientY - r.top) / r.height) * 100))
    aplicar({ ...hsv, s: Math.round(s), v: Math.round(v) })
  }
  const alTeclear = e => {
    const paso = e.shiftKey ? 10 : 1
    const mov = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, paso], ArrowDown: [0, -paso] }[e.key]
    if (!mov) return
    e.preventDefault()
    aplicar({ ...hsv, s: Math.min(100, Math.max(0, hsv.s + mov[0])), v: Math.min(100, Math.max(0, hsv.v + mov[1])) })
  }

  return (
    <div className="ex-est-selector-color" style={{ '--tono': hsv.h }}>
      <div
        ref={area}
        className="ex-est-selector-color__area"
        role="application"
        tabIndex={0}
        aria-label="Saturación y brillo. Usá las flechas para moverte."
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); desdePuntero(e) }}
        onPointerMove={e => { if (e.buttons === 1) desdePuntero(e) }}
        onKeyDown={alTeclear}
      >
        <span className="ex-est-selector-color__punto" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} />
      </div>
      <input
        className="ex-est-selector-color__tono"
        type="range"
        min={0}
        max={360}
        value={hsv.h}
        aria-label="Tono"
        onChange={e => aplicar({ ...hsv, h: Number(e.target.value) })}
      />
      <div className="ex-est-selector-color__paleta">
        {PALETA.map(c => (
          <button key={c} type="button" className="ex-est-selector-color__muestra" style={{ '--c': c }} aria-label={`Usar ${c}`} title={c} onClick={() => { setHsv(hexAHsv(c)); onChange(c) }} />
        ))}
      </div>
    </div>
  )
}

/**
 * Color en un solo campo: cuadrito con el color + código hexadecimal. El cuadrito abre un
 * selector; con `opcional` se puede dejar "sin color" (o el valor general, según `placeholder`).
 */
export function Color({ id, valor, onChange, opcional = false, ariaLabel, placeholder }) {
  const texto = String(valor ?? '')
  const valido = esColorValido(texto)
  const invalido = texto !== '' && !valido
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined
    const afuera = e => { if (!raiz.current?.contains(e.target)) setAbierto(false) }
    const tecla = e => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  const escribir = v => {
    const t = v.trim()
    onChange(/^[0-9a-f]{1,6}$/i.test(t) ? `#${t}` : t)
  }

  return (
    <span ref={raiz} className={`ex-est-color${invalido ? ' ex-est-color--error' : ''}`}>
      <button
        type="button"
        className={`ex-est-color__muestra${valido ? '' : ' ex-est-color__muestra--vacia'}`}
        style={valido ? { '--c': normalizarColor(texto) } : undefined}
        aria-label={ariaLabel ? `Elegir ${ariaLabel.toLowerCase()}` : 'Elegir color'}
        aria-expanded={abierto}
        onClick={() => setAbierto(a => !a)}
      />
      <input
        id={id}
        className="ex-est-color__codigo"
        type="text"
        spellCheck={false}
        autoComplete="off"
        maxLength={7}
        value={texto}
        placeholder={placeholder ?? (opcional ? 'sin color' : '#000000')}
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        onChange={e => escribir(e.target.value)}
      />
      {opcional && texto !== '' && (
        <button type="button" className="ex-est-color__quitar" onClick={() => onChange('')} aria-label="Quitar color">×</button>
      )}
      {abierto && <SelectorColor valor={normalizarColor(texto, '#ffffff')} onChange={onChange} />}
    </span>
  )
}

export function Interruptor({ marcado, onChange, children }) {
  return (
    <label className="ex-est-interruptor">
      <input type="checkbox" checked={marcado} onChange={e => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

export function Segmentado({ opciones, valor, onChange, ariaLabel }) {
  return (
    <div className="ex-est-segmentado" role="group" aria-label={ariaLabel}>
      {opciones.map(o => (
        <button
          key={o.valor}
          type="button"
          className="ex-est-segmentado__op"
          aria-pressed={valor === o.valor}
          title={o.titulo}
          onClick={() => onChange(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}

/** Botones de Copiar y Descargar con confirmación breve. */
export function AccionesArchivo({ texto, nombreArchivo, tipo = 'text/plain', saltosCrlf = false, deshabilitado = false, etiquetaDescarga }) {
  const [estado, setEstado] = useState('')
  const aviso = (que, ms = 1500) => {
    setEstado(que)
    setTimeout(() => setEstado(''), ms)
  }
  const copiar = async () => aviso((await copiarTexto(texto)) ? 'copiado' : 'error')
  const bajar = () => {
    descargarTexto(nombreArchivo, texto, tipo, { crlf: saltosCrlf })
    aviso('descargado')
  }
  return (
    <div className="ex-est-acciones">
      <button type="button" className="ex-boton ex-boton--secundario ex-boton--chico" onClick={copiar} disabled={deshabilitado}>
        {estado === 'copiado' ? <Check className="ex-icono" aria-hidden="true" /> : <Copy className="ex-icono" aria-hidden="true" />}
        {estado === 'copiado' ? 'Copiado' : estado === 'error' ? 'No se pudo copiar' : 'Copiar'}
      </button>
      <button type="button" className="ex-boton ex-boton--descarga ex-boton--chico" onClick={bajar} disabled={deshabilitado}>
        <Download className="ex-icono" aria-hidden="true" />
        {estado === 'descargado' ? 'Listo' : (etiquetaDescarga ?? `Descargar ${nombreArchivo.split('.').pop() === 'csv' ? '.csv' : '.html'}`)}
      </button>
    </div>
  )
}

/** Muestra un texto resaltando los separadores || (columna) y ## (fila). */
export function TextoConSeparadores({ texto }) {
  const partes = String(texto).split(/(\|\||##)/)
  return partes.map((p, i) => {
    if (p === '||') return <span key={i} className="ex-est-sep ex-est-sep--col">||</span>
    if (p === '##') return <span key={i} className="ex-est-sep ex-est-sep--fila">##</span>
    return <span key={i}>{p}</span>
  })
}

export function Avisos({ items, vacio = 'Todo en orden.' }) {
  if (!items.length) return <p className="ex-est-aviso ex-est-aviso--ok">{vacio}</p>
  return (
    <ul className="ex-est-avisos">
      {items.map((a, i) => <li key={i} className={`ex-est-aviso ex-est-aviso--${a.nivel}`}>{a.mensaje}</li>)}
    </ul>
  )
}

/** Botón "i" que abre un recuadro con una explicación corta (Esc o clic afuera lo cierran). */
export function Ayudita({ etiqueta = 'Más información', children }) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef(null)
  const idPop = useId()

  useEffect(() => {
    if (!abierto) return undefined
    const afuera = e => { if (!raiz.current?.contains(e.target)) setAbierto(false) }
    const tecla = e => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  return (
    <span className="ex-est-ayudita" ref={raiz}>
      <button type="button" className="ex-est-ayudita__boton" aria-label={etiqueta} aria-expanded={abierto} aria-controls={idPop} onClick={() => setAbierto(a => !a)}>
        <Info className="ex-icono" aria-hidden="true" />
      </button>
      {abierto && <span id={idPop} role="note" className="ex-est-popover">{children}</span>}
    </span>
  )
}

/** Cantidad con botones − y +. */
export function Contador({ valor, min, max, onChange, etiqueta }) {
  return (
    <span className="ex-est-contador" role="group" aria-label={etiqueta}>
      <button type="button" className="ex-est-contador__btn" aria-label="Una menos" disabled={valor <= min} onClick={() => onChange(valor - 1)}>−</button>
      <output className="ex-est-contador__valor" aria-live="polite">{valor}</output>
      <button type="button" className="ex-est-contador__btn" aria-label="Una más" disabled={valor >= max} onClick={() => onChange(valor + 1)}>+</button>
    </span>
  )
}
