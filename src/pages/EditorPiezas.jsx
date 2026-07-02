import { useState, useRef, useEffect, forwardRef } from 'react'
import { GripVertical, Trash2, Eye, Download, X, Code, Lock, Image, FileText, Layout, ChevronDown, Check, Type, Underline, RotateCcw, Plus, Loader2, Copy, ClipboardCheck, AlertCircle, Link2, Pencil, Info } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { DetectarInlineEnvolviendoOutlook, DetectarContenidoDuplicado } from '@/lib/revision/generales'
import '@/styles/EditorPiezas.css'
import {
  FIRMA_INSTITUCIONAL_DEFAULT,
  LEGAL_FIJO_HTML,
  REDES_SOCIALES,
  TEMAS,
  TEMA_DEFAULT,
} from '@/lib/editor/constantes.js'
import { BLOQUES, BLOQUES_CONTENIDO, BLOQUES_HEADER, BLOQUE_ESPACIADOR } from '@/lib/editor/bloques.js'
import { extraerTdsConBalance, limpiarHtmlEditor, validarUrl } from '@/lib/editor/htmlUtils.js'
import { actualizarCampoEnHtml, detectarCampos } from '@/lib/editor/campos.js'
import { detectarRedesSociales, reordenarRedesSociales } from '@/lib/editor/redesSociales.js'
import { generarExport, wrapPreview } from '@/lib/editor/exportar.js'
import { generarThumbSVG } from '@/lib/editor/thumbs.js'
import {
  importarDesdeHtml,
  importarHeuristico,
  marcarBloquesNoReconocidosParaPreview,
  marcarEstructurasObsoletasParaPreview,
  tituloYDetalleDeAviso,
} from '@/lib/editor/importar.js'

// Ícono + color por tipo de aviso real ('no-reconocido', 'fuera-de-
// rango', 'obsoleto', 'general') — mismos colores que ya usa el resto
// del modal de importación (naranja de marca para no-reconocido, rojo
// para los dos casos más graves, neutro para avisos informativos sin
// bloque puntual al que ir).
const AVISO_ICONO_POR_TIPO = {
  'no-reconocido': { Icono: Code, color: '#F97316' },
  'fuera-de-rango': { Icono: AlertCircle, color: '#DC2626' },
  'obsoleto': { Icono: AlertCircle, color: '#DC2626' },
  'outlook-riesgo': { Icono: AlertCircle, color: '#DC2626' },
  'contenido-duplicado': { Icono: AlertCircle, color: '#DC2626' },
  'general': { Icono: Info, color: null }, // null = neutro, ver CSS
}

// ─── Redes sociales en bandas de Header ────────────────────────────────────
// Cualquier banda de header (ICBC, Mall, Comex, las que se sumen a
// futuro) puede traer hasta 4 íconos de redes — algunas comunicaciones
// puntuales no las usan (ver CG_Banda_Roja_Header_Comex.html, que ya
// viene con los <td class="IconoRedes"> vacíos). En vez de modelar 2
// versiones de cada header (con/sin redes), se detectan las redes
// presentes por el dominio del <a href> dentro de cada
// <td class="IconoRedes">, y se reordenan/desactivan al vuelo al
// exportar/previsualizar — mismo criterio que aplicarColorTexto: la
// transformación se aplica recién al generar el HTML final, nunca se
// "quema" en el bandaHeader guardado. El ORDEN del array de abajo es
// el orden real en el que aparecen hoy en los headers existentes —
// no tiene ningún significado especial más que ser el default antes
// de que el usuario reordene.
// Íconos de redes sociales como SVG propios — lucide-react eliminó
// todos los íconos de marca registrada (Twitter/X, Facebook,
// Instagram, GitHub, etc.) en su versión 1.0 por motivos legales y de
// mantenimiento, recomendando reemplazarlos por un SVG propio o el
// paquete aparte Simple Icons. Como son solo 4 íconos chicos y fijos,
// se escriben acá inline en vez de sumar una dependencia nueva al
// proyecto solo para esto. Mismo patrón de props (size, currentColor
// vía CSS) que los íconos de lucide-react que ya se usan en el resto
// del archivo, para que el resto del código no tenga que tratarlos
// distinto.
function IconoTwitter({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.9 1.9h3.7l-8.1 9.3 9.5 12.6h-7.5l-5.9-7.7-6.7 7.7H.2l8.7-9.9L0 1.9h7.6l5.3 7.1zM17 22h2L7.1 3.6H5z" />
    </svg>
  )
}
function IconoFacebook({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.5 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94z" />
    </svg>
  )
}
function IconoInstagram({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
function IconoLinkedin({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.34 18.34V9.75H5.67v8.59zM7 8.6a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1zm11.34 9.74v-4.7c0-2.52-1.35-3.69-3.15-3.69a2.72 2.72 0 0 0-2.46 1.35h-.04V9.75H10v8.59h2.67v-4.27c0-1.13.21-2.22 1.61-2.22 1.38 0 1.4 1.29 1.4 2.29v4.2z" />
    </svg>
  )
}

// Mapa key → componente de ícono de cada red. La DATA (key, dominio,
// label) vive en lib/editor/constantes (REDES_SOCIALES) para que
// detectarRedesSociales/reordenarRedesSociales sean libs puras sin
// React — acá queda solo la parte visual, resuelta por key.
const REDES_ICONOS = {
  twitter: IconoTwitter,
  facebook: IconoFacebook,
  instagram: IconoInstagram,
  linkedin: IconoLinkedin,
}

// ─── Mini editor rich text ──────────────────────────────────────────────────

function RichEditor({ value, onChange }) {
  const ref = useRef(null)
  const [showLink, setShowLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkColor, setLinkColor] = useState('#c4161c')
  const savedRange = useRef(null)
  const isInternalChange = useRef(false)

  useEffect(() => {
    if (ref.current && !isInternalChange.current) {
      ref.current.innerHTML = value || ''
    }
    isInternalChange.current = false
  }, [value])

  function guardarRango() {
    const sel = window.getSelection()
    if (sel?.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange()
  }

  function aplicarEstilo(propiedades) {
    ref.current?.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const container = range.commonAncestorContainer
    const spanExistente = (container.nodeType === Node.TEXT_NODE
      ? container.parentElement : container)?.closest?.('span')
    if (spanExistente && range.toString() === spanExistente.textContent) {
      Object.entries(propiedades).forEach(([k, v]) => { spanExistente.style[k] = v })
    } else {
      const span = document.createElement('span')
      Object.entries(propiedades).forEach(([k, v]) => { span.style[k] = v })
      try { range.surroundContents(span) } catch { return }
    }
    isInternalChange.current = true
    onChange(limpiarHtmlEditor(ref.current.innerHTML))
  }

  function aplicarSup() {
    ref.current?.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const sup = document.createElement('sup')
    sup.style.fontSize = '8px'
    try { range.surroundContents(sup) } catch { return }
    isInternalChange.current = true
    onChange(limpiarHtmlEditor(ref.current.innerHTML))
  }

  function aplicarLink() {
    if (!savedRange.current || !linkUrl) { setShowLink(false); return }
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(savedRange.current)
    if (sel?.isCollapsed) { setShowLink(false); return }
    const range = sel.getRangeAt(0)
    const a = document.createElement('a')
    a.href = validarUrl(linkUrl)
    a.target = '_blank'
    a.style.color = linkColor
    a.style.textDecoration = 'underline'
    try { range.surroundContents(a) } catch { return }
    isInternalChange.current = true
    onChange(limpiarHtmlEditor(ref.current.innerHTML))
    setShowLink(false); setLinkUrl('')
  }

  function limpiarTodo() {
    if (ref.current) ref.current.innerHTML = ''
    isInternalChange.current = true
    onChange('&nbsp;')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      document.execCommand('insertLineBreak')
      isInternalChange.current = true
      onChange(limpiarHtmlEditor(ref.current.innerHTML))
    }
  }

  function onPaste(e) {
    e.preventDefault()
    const texto = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, texto)
    isInternalChange.current = true
    onChange(limpiarHtmlEditor(ref.current.innerHTML))
  }

  function onInput() {
    isInternalChange.current = true
    const limpio = limpiarHtmlEditor(ref.current.innerHTML)
    onChange(limpio || '&nbsp;')
  }

  return (
    <div className="ep-rich-wrap">
      <div className="ep-rich-toolbar">
        <button type="button" className="ep-rich-btn ep-rich-btn-b" title="Negrita"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ fontWeight: 'bold' }) }}>B</button>
        <button type="button" className="ep-rich-btn ep-rich-btn-i" title="Cursiva"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ fontStyle: 'italic' }) }}>I</button>
        <button type="button" className="ep-rich-btn" title="Texto normal"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ fontWeight: 'normal', fontStyle: 'normal' }) }}>
          <Type size={12} />
        </button>
        <button type="button" className="ep-rich-btn" title="Superíndice"
          onMouseDown={e => { e.preventDefault(); aplicarSup() }}>
          x<sup style={{ fontSize: 8 }}>2</sup>
        </button>
        <div className="ep-rich-separator" />
        <button type="button" className="ep-rich-btn" title="Subrayado"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ textDecoration: 'underline' }) }}>
          <Underline size={12} />
        </button>
        <button type="button" className="ep-rich-btn" title="Sin subrayado"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ textDecoration: 'none' }) }}>
          <span style={{ textDecoration: 'line-through', fontSize: 11 }}>U</span>
        </button>
        <div className="ep-rich-separator" />
        <button type="button" className="ep-rich-btn" title="Color rojo #c4161c"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ color: '#c4161c' }) }}>
          <span className="ep-color-dot" style={{ background: '#c4161c' }} />
        </button>
        <button type="button" className="ep-rich-btn" title="Color negro #333333"
          onMouseDown={e => { e.preventDefault(); guardarRango(); aplicarEstilo({ color: '#333333' }) }}>
          <span className="ep-color-dot" style={{ background: '#333333' }} />
        </button>
        <div className="ep-rich-separator" />
        <button type="button" className="ep-rich-btn" title="Link"
          onMouseDown={e => { e.preventDefault(); guardarRango(); setShowLink(v => !v) }}><Link2 size={12} /></button>
        <div className="ep-rich-separator" />
        <button type="button" className="ep-rich-btn" title="Limpiar todo el texto"
          onMouseDown={e => { e.preventDefault(); limpiarTodo() }}>
          <Trash2 size={12} />
        </button>
      </div>
      {showLink && (
        <div className="ep-rich-link-popup">
          <input className="ep-rich-link-input" autoComplete="off" placeholder="https://..." value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && aplicarLink()} autoFocus
            autoComplete="off" />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>Color link:</span>
            <button type="button"
              className={`ep-rich-btn ${linkColor === '#c4161c' ? 'active' : ''}`}
              onClick={() => setLinkColor('#c4161c')} title="Rojo">
              <span className="ep-color-dot" style={{ background: '#c4161c' }} />
            </button>
            <button type="button"
              className={`ep-rich-btn ${linkColor === '#333333' ? 'active' : ''}`}
              onClick={() => setLinkColor('#333333')} title="Negro">
              <span className="ep-color-dot" style={{ background: '#333333' }} />
            </button>
            <button type="button" className="ep-rich-link-ok" onClick={aplicarLink}>OK</button>
          </div>
        </div>
      )}
      <div ref={ref} className="ep-rich-content" contentEditable suppressContentEditableWarning
        onInput={onInput} onKeyDown={onKeyDown} onPaste={onPaste} />
    </div>
  )
}

// ─── Campo de imagen con alerta de dimensiones ──────────────────────────────
function CampoImagen({ campo, onActualizar, onReset }) {
  const [srcLocal, setSrcLocal] = useState(campo.src)
  const [altLocal, setAltLocal] = useState(campo.alt)
  const [titleLocal, setTitleLocal] = useState(campo.title)
  const [widthLocal, setWidthLocal] = useState(campo.width)
  const [heightLocal, setHeightLocal] = useState(campo.height)
  const [dimAlert, setDimAlert] = useState(null)
  // Si la URL actual no carga (rota, vacía, o todavía no tipeada del
  // todo) el preview muestra un placeholder en vez de un ícono roto de
  // imagen del navegador — se resetea a cada cambio de srcLocal para
  // no quedar pegado en "rota" después de corregir la URL.
  const [previewRoto, setPreviewRoto] = useState(false)

  const origW = parseInt(campo.width) || 0
  const origH = parseInt(campo.height) || 0

  function commit(overrides = {}) {
    onActualizar({ src: srcLocal, alt: altLocal, title: titleLocal, width: widthLocal, height: heightLocal, ...overrides })
  }

  function onSrcBlur(nuevoSrc) {
    setSrcLocal(nuevoSrc)
    // Imágenes puramente estructurales — "separador" (Img_Separador_*)
    // y "línea punteada" (MediaLineaPunteada*, la línea divisoria del
    // Módulo Doble Con Imagen Punteada, visible solo en mobile) son
    // píxeles transparentes usados para forzar espacios o decoración
    // de layout, no contenido real — su aspect ratio no tiene ningún
    // significado visual, así que no tiene sentido alertar por una
    // "desproporción" que en los hechos no se ve. Se detecta por el
    // nombre de archivo en la URL, no por el contenido real de la
    // imagen.
    const esEstructural = /img[_-]?separador|lineapunteada/i.test(nuevoSrc)
    if (!nuevoSrc || !origW || !origH || esEstructural) { commit({ src: nuevoSrc }); return }
    const img = new window.Image()
    img.onload = () => {
      if (img.naturalWidth !== origW || img.naturalHeight !== origH) {
        const sugeridoH = Math.round(origW / (img.naturalWidth / img.naturalHeight))
        setDimAlert({ sugeridoW: origW, sugeridoH, realW: img.naturalWidth, realH: img.naturalHeight, src: nuevoSrc })
      } else {
        commit({ src: nuevoSrc })
      }
    }
    img.onerror = () => commit({ src: nuevoSrc })
    img.src = nuevoSrc
  }

  function aceptarSugerencia() {
    const w = String(dimAlert.sugeridoW), h = String(dimAlert.sugeridoH)
    setWidthLocal(w); setHeightLocal(h); setDimAlert(null)
    onActualizar({ src: dimAlert.src, alt: altLocal, title: titleLocal, width: w, height: h })
  }

  return (
    <div className="ep-seccion">
      <div className="ep-seccion-titulo">{campo.label}</div>

      {/* Preview en vivo — responde a la pregunta "¿cuál imagen del
          bloque es esta?" sin tener que ir a buscarla en el canvas:
          se ve acá mismo, junto al campo que la edita. Usa srcLocal
          (el valor en pantalla, no el ya confirmado) para reflejar
          también lo que se está tipeando antes de salir del campo. */}
      <div className="ep-campo-imagen-preview">
        {srcLocal && !previewRoto ? (
          <img src={srcLocal} alt="" onError={() => setPreviewRoto(true)} onLoad={() => setPreviewRoto(false)} />
        ) : (
          <div className="ep-campo-imagen-preview-vacio">
            <Image size={20} />
            <span>{srcLocal ? 'No se pudo cargar la imagen' : 'Sin imagen'}</span>
          </div>
        )}
      </div>

      <div className="ep-campo">
        <label className="ep-campo-label">URL</label>
        <input className="ep-campo-input" autoComplete="off" value={srcLocal}
          onChange={e => setSrcLocal(e.target.value)} onBlur={e => onSrcBlur(e.target.value)}
          placeholder="https://cdn.ejemplo.com/imagen.png" />
      </div>
      <div className="ep-campo" style={{ marginTop: 6 }}>
        <label className="ep-campo-label">Alt</label>
        <input className="ep-campo-input" autoComplete="off" value={altLocal}
          onChange={e => setAltLocal(e.target.value)} onBlur={commit} placeholder="Texto alternativo" />
      </div>
      <div className="ep-campo" style={{ marginTop: 6 }}>
        <label className="ep-campo-label">Title</label>
        <input className="ep-campo-input" autoComplete="off" value={titleLocal}
          onChange={e => setTitleLocal(e.target.value)} onBlur={commit} placeholder="Título de la imagen" />
      </div>

      {/* Ancho/Alto — siempre editables, no solo cuando hay una alerta
          de desproporción activa. Bug real reportado: un bloque de
          botón (categoría Botones) puede tener cualquier medida según
          el botón real (ej. 205×47, otro puede ser 180×40) — antes el
          único lugar donde aparecían estos campos era dentro de la
          alerta de "la imagen nueva no coincide con las medidas
          esperadas", que solo se dispara al cambiar la URL por una
          con proporción distinta — si el usuario nunca toca la URL,
          no había ninguna forma de ajustar manualmente el tamaño real
          del botón. */}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <div style={{ flex: 1 }}>
          <label className="ep-campo-label">Ancho (px)</label>
          <input className="ep-campo-input" autoComplete="off" value={widthLocal} onChange={e => setWidthLocal(e.target.value)} onBlur={commit} placeholder="auto" />
        </div>
        <div style={{ flex: 1 }}>
          <label className="ep-campo-label">Alto (px)</label>
          <input className="ep-campo-input" autoComplete="off" value={heightLocal} onChange={e => setHeightLocal(e.target.value)} onBlur={commit} placeholder="auto" />
        </div>
      </div>

      {dimAlert && (
        <div className="ep-dim-alert">
          <span>La imagen nueva mide <strong>{dimAlert.realW}×{dimAlert.realH}px</strong>. Las medidas esperadas son <strong>{origW}×{origH}px</strong>. Medidas recomendadas manteniendo el ancho: <strong>{dimAlert.sugeridoW}×{dimAlert.sugeridoH}px</strong></span>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="ep-btn ep-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }} onClick={aceptarSugerencia}>Usar recomendado</button>
            <button className="ep-btn ep-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }} onClick={() => { setDimAlert(null); commit({ src: dimAlert.src }) }}>Mantener original</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Panel de edición de la banda Header (redes sociales) ──────────────────
// Una sola lista de pills (uno por red detectada en el header actual),
// cada pill con el ícono de la red en gris neutro (sin colores de
// marca — desentonaban del resto del diseño del editor, que usa un
// único acento violeta para todo estado activo/hover) — click para
// tachar/activar (igual idea visual que ya usa el resto del editor
// para "incluida/no incluida"), arrastrable para reordenar. El orden
// del array ES el orden final en el export — no hay una zona separada
// de "disponibles" vs "activas", todo vive en una sola lista, más
// simple de entender de un vistazo.
function PanelEditorHeader({ bandaHeader, redesOrden, onToggle, onReordenar }) {
  const [dragKey, setDragKey] = useState(null)
  const redes = redesOrden ?? []

  if (redes.length === 0) {
    return (
      <div className="ep-editor-empty">
        <Layout size={28} style={{ color: 'var(--border)' }} />
        <span>Esta banda de header no tiene redes sociales para editar.</span>
      </div>
    )
  }

  return (
    <div className="ep-editor-body">
      <div className="ep-campo">
        <label className="ep-campo-label">Redes sociales</label>
        <p className="ep-header-redes-hint">
          Click para mostrar/ocultar — arrastrá para reordenar.
        </p>
        <div className="ep-header-redes-pills">
          {redes.map(r => {
            const red = REDES_SOCIALES.find(s => s.key === r.key)
            if (!red) return null
            const Icono = REDES_ICONOS[red.key]
            return (
              <div
                key={r.key}
                className={`ep-header-red-pill ${!r.activa ? 'inactiva' : ''} ${dragKey === r.key ? 'dragging' : ''}`}
                draggable
                onDragStart={() => setDragKey(r.key)}
                onDragEnd={() => setDragKey(null)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  if (dragKey && dragKey !== r.key) onReordenar(dragKey, redes.findIndex(x => x.key === r.key))
                  setDragKey(null)
                }}
                onClick={() => onToggle(r.key)}
                title={r.activa ? `Ocultar ${red.label}` : `Mostrar ${red.label}`}
              >
                <GripVertical size={12} className="ep-header-red-grip" />
                <Icono size={14} />
                <span>{red.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PanelEditor({ bloque, onActualizar, onSwap, onActualizarEstilos }) {
  const [htmlLocal, setHtmlLocal] = useState(bloque.htmlEditado || bloque.html)
  const [saving, setSaving] = useState(false)
  // Estilos custom del bloque de código personalizado — CSS plano sin
  // selector @media (ver actualizarEstilosBloque). Cada bloque de
  // código guarda los suyos; al exportar, generarExport los recolecta
  // de TODOS los bloques de código del canvas y los suma en una sola
  // hoja (desktop antes del @media, mobile adentro).
  const [estilosDesktopLocal, setEstilosDesktopLocal] = useState(bloque.estilosDesktop || '')
  const [estilosMobileLocal, setEstilosMobileLocal] = useState(bloque.estilosMobile || '')

  // Estados para el panel de Imagen Libre — declarados siempre al
  // nivel del componente (reglas de hooks). Se inicializan leyendo
  // directo del HTML real del bloque (htmlEditado si existe, sino html
  // del template) para evitar el bug de import donde el panel mostraba
  // la imagen de ejemplo del template en vez de la importada.
  const _ilHtml = bloque.htmlEditado || bloque.html
  const _ilImgAttrs = (() => { const m = _ilHtml.match(/<img([^>]*)>/i); return m ? m[1] : '' })()
  const _ilGetAttr = (name) => { const m = _ilImgAttrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i')); return m ? m[1] : '' }
  const _ilGetStyleProp = (prop) => { const m = _ilImgAttrs.match(new RegExp(`${prop}:\\s*([\\d.]+)px`, 'i')); return m ? m[1] : '' }
  const _ilGetClass = () => { const m = _ilImgAttrs.match(/class=["']([^"']*)["']/i); return m ? m[1] : '' }
  const _ilLinkMatch = _ilHtml.match(/<a\s[^>]*href=["']([^"']*)["'][^>]*>\s*<img/i)
  const [ilSrc, setIlSrc] = useState(_ilGetAttr('src'))
  const [ilAlt, setIlAlt] = useState(_ilGetAttr('alt'))
  const [ilTitle, setIlTitle] = useState(_ilGetAttr('title'))
  const [ilWidth, setIlWidth] = useState(_ilGetAttr('width') || _ilGetStyleProp('max-width') || _ilGetStyleProp('width'))
  const [ilHeight, setIlHeight] = useState(_ilGetAttr('height'))
  const [ilClase, setIlClase] = useState(_ilGetClass())
  const [ilLink, setIlLink] = useState(_ilLinkMatch ? _ilLinkMatch[1] : '')
  // Por defecto, SIEMPRE contra bloque.html (el HTML original del
  // archivo fuente), NUNCA contra bloque.htmlEditado. Bug real que
  // esto corrige: si detectarCampos corriera contra el HTML ya
  // editado, un campo de texto vaciado por completo por el usuario
  // (selección + borrar, o el ícono de limpiar) deja de matchear el
  // filtro de "longitud > 2 caracteres reales" — el campo "desaparece"
  // de la lista, y como esta lista es la única fuente de qué editar,
  // se pierde la posibilidad de volver a escribir algo ahí. Pasaba
  // también en bloques con imagen+texto en la misma celda: vaciar el
  // texto hacía que ESA celda dejara de contarse como campo de texto,
  // aunque la imagen (detectada por separado) siguiera bien. La
  // estructura de campos (cuántos hay, de qué tipo, en qué posición)
  // tiene que ser estable y depender solo del original — el VALOR
  // actual de cada campo (lo que se muestra/edita) sí debe reflejar lo
  // editado, y eso se resuelve por separado más abajo con
  // valorActualDelCampo, no mezclando ambas cosas en una sola pasada.
  //
  // EXCEPCIÓN real encontrada con bloques IMPORTADOS: la heurística de
  // importación puede matchear un bloque real contra un template cuya
  // forma es parecida pero con MENOS repeticiones internas que el
  // contenido real (ej. un template de "un solo bullet" matcheando
  // contra una pieza real con DOS bullets anidados dentro del mismo
  // <td> padre — la similitud de forma los considera "el mismo tipo de
  // bloque" a propósito, ver formaDeTags). En ese caso, contar campos
  // sobre bloque.html (el template, con 1 bullet) deja afuera el
  // segundo bullet real, que sí existe en bloque.htmlEditado — el
  // usuario podía editar el primero pero no tenía forma de llegar al
  // segundo.
  //
  // El criterio de "cuál usar como base" NO puede ser "cuál detecta
  // más CAMPOS" (detectarCampos filtra por contenido — un <td> vacío
  // no cuenta como campo) — eso reintroduce el mismo bug que esto
  // pretende arreglar: si el usuario vacía el PRIMER bullet de los dos
  // y guarda, al reabrir el panel detectarCampos(htmlEditado) vuelve a
  // dar 1 campo (el vaciado ya no cuenta), empata con el original (1),
  // y el SEGUNDO bullet (con contenido real) queda inaccesible de
  // nuevo — el bug que se quería resolver, pero ahora persistente
  // entre sesiones. Por eso la comparación es ESTRUCTURAL: cantidad
  // TOTAL de <td> (sin filtrar por contenido, count crudo) — un <td>
  // vacío sigue siendo un <td>, así que este número es estable sin
  // importar qué tan vacíos estén los campos. Si htmlEditado tiene más
  // <td> totales que el original, hay repeticiones reales que el
  // template no contempla, y se usa ese como base — en el caso normal
  // (sin importación, o importación sin repeticiones extra) ambos
  // tienen la misma cantidad de <td>, así que el comportamiento de
  // siempre queda intacto.
  const camposOriginales = useRef(null)
  if (!camposOriginales.current) {
    const contarTds = (h) => (h.match(/<td\b/gi) || []).length
    const tdsOriginal = contarTds(bloque.html)
    const tdsEditado = bloque.htmlEditado ? contarTds(bloque.htmlEditado) : 0
    const baseHtml = tdsEditado > tdsOriginal ? bloque.htmlEditado : bloque.html
    camposOriginales.current = detectarCampos(baseHtml)
  }
  const esCodigo = bloque.tipo === 'codigo'
  const esEspaciador = bloque.slug === 'Espaciador'
  const esImagenLibre = bloque.slug === 'Imagen_Libre'
  const sinCampos = !esCodigo && !esEspaciador && !esImagenLibre && camposOriginales.current.length === 0

  function actualizarCampo(tipo, idx, cambios, idxFallback) {
    setHtmlLocal(prev => actualizarCampoEnHtml(prev, tipo, idx, cambios, idxFallback))
  }

  function aplicar() {
    setSaving(true)
    setTimeout(() => {
      onActualizar(bloque.instanceId, htmlLocal)
      if (bloque.tipo === 'codigo' && onActualizarEstilos) {
        onActualizarEstilos(bloque.instanceId, 'estilosDesktop', estilosDesktopLocal)
        onActualizarEstilos(bloque.instanceId, 'estilosMobile', estilosMobileLocal)
      }
      setSaving(false)
    }, 400)
  }

  function resetBloque() {
    setHtmlLocal(bloque.html)
    onActualizar(bloque.instanceId, null) // null = volver al html original
  }

  if (esCodigo) return (
    <>
      <div className="ep-editor-body">
        <div className="ep-seccion">
          <div className="ep-seccion-titulo">Código HTML</div>
          <textarea className="ep-codigo-textarea" value={htmlLocal}
            onChange={e => setHtmlLocal(e.target.value)} placeholder="Pegá el HTML del bloque acá..." />
        </div>

        {/* Estilos custom — CSS plano, SIN selector @media: el sistema
            ya envuelve cada uno en la hoja correspondiente al
            exportar (desktop directo en el <style> principal, mobile
            adentro del @media max-width:600px). Si la pieza tiene
            varios bloques de código, los estilos de TODOS se suman en
            la hoja final — cada bloque aporta lo suyo, sin pisar lo
            que aportó otro. */}
        <div className="ep-seccion">
          <div className="ep-seccion-titulo">Estilos — Desktop</div>
          <textarea className="ep-codigo-textarea ep-codigo-textarea-estilos" value={estilosDesktopLocal}
            onChange={e => setEstilosDesktopLocal(e.target.value)}
            placeholder=".mi-clase { color: red; }" />
        </div>
        <div className="ep-seccion">
          <div className="ep-seccion-titulo">Estilos — Mobile</div>
          <textarea className="ep-codigo-textarea ep-codigo-textarea-estilos" value={estilosMobileLocal}
            onChange={e => setEstilosMobileLocal(e.target.value)}
            placeholder=".mi-clase { font-size: 14px !important; }" />
          <span className="ep-codigo-hint">Se aplica dentro de @media screen and (max-width: 600px) — no hace falta escribir el selector de media query, solo las reglas.</span>
        </div>
      </div>
      <div className="ep-editor-footer">
        <button className="ep-btn ep-btn-primary ep-btn-aplicar" onClick={aplicar} disabled={saving}>
          {saving ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
          {saving ? 'Aplicando…' : 'Aplicar cambios'}
        </button>
      </div>
    </>
  )

  if (esEspaciador) {
    const altMatch = htmlLocal.match(/height:\s*(\d+)px/)
    const altActual = altMatch ? parseInt(altMatch[1]) : 14
    // El espaciador aplica en vivo al elegir el alto — no tiene sentido
    // pedir un click de "Aplicar cambios" para algo tan inmediato como
    // un chip de 3 opciones fijas (a diferencia de texto/imagen, donde
    // sí puede convenir terminar de escribir antes de aplicar).
    function setAlto(px) {
      const nuevo = htmlLocal
        .replace(/height:\s*\d+px/g, `height: ${px}px`)
        .replace(/line-height:\s*\d+px/g, `line-height: ${px}px`)
        .replace(/mso-line-height-alt:\s*\d+px/g, `mso-line-height-alt: ${px}px`)
        .replace(/height="\d+"/g, `height="${px}"`)
      setHtmlLocal(nuevo)
      onActualizar(bloque.instanceId, nuevo)
    }
    return (
      <>
        <div className="ep-editor-body">
          <div className="ep-campo">
            <label className="ep-campo-label">Alto del espaciador</label>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {[7, 14, 28].map(px => (
                <button key={px} onClick={() => setAlto(px)}
                  className={`ep-espaciador-chip ${altActual === px ? 'activo' : ''}`}>{px}px</button>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Panel dedicado para Imagen Libre ────────────────────────────────
  // A diferencia de los bloques genéricos (donde CampoImagen solo
  // muestra dimensiones cuando hay desproporción), acá SIEMPRE se
  // muestran todos los campos: src, alt, title, width, height, link y
  // clase mobile. Se lee directo de htmlLocal (que viene de
  // bloque.htmlEditado ?? bloque.html) para evitar el bug de import
  // donde CampoImagen inicializaba con la imagen de ejemplo del
  // template en vez de la imagen real importada.
  if (esImagenLibre) {
    // Helpers para leer valores actuales del htmlLocal — se usan
    // solo dentro de commitImagenLibre. Los estados controlled de
    // cada input (ilSrc, ilAlt, etc.) están declarados al nivel del
    // componente para respetar las reglas de hooks.
    const imgMatch = htmlLocal.match(/<img([^>]*)>/i)
    const imgAttrs = imgMatch ? imgMatch[1] : ''
    const getAttr = (name) => {
      const m = imgAttrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))
      return m ? m[1] : ''
    }
    const getStyleProp = (prop) => {
      const m = imgAttrs.match(new RegExp(`${prop}:\\s*([\\d.]+)px`, 'i'))
      return m ? m[1] : ''
    }
    const getClass = () => {
      const m = imgAttrs.match(/class=["']([^"']*)["']/i)
      return m ? m[1] : ''
    }
    // Link: detecta si la imagen está envuelta en un <a href="...">
    const linkMatch = htmlLocal.match(/<a\s[^>]*href=["']([^"']*)["'][^>]*>\s*<img/i)
    const linkActual = linkMatch ? linkMatch[1] : ''

    // Aplica un cambio puntual sobre htmlLocal y lo propaga al editor
    // inmediatamente (auto-save en blur) — el botón "Aplicar" llama
    // a aplicar() que hace el mismo onActualizar con feedback visual.
    function commitImagenLibre(cambios) {
      setHtmlLocal(prev => {
        let h = prev
        // src
        if (cambios.src !== undefined)
          h = h.replace(/(<img[^>]*)\bsrc=["'][^"']*["']/i, `$1src="${cambios.src}"`)
        // alt
        if (cambios.alt !== undefined)
          h = h.replace(/(<img[^>]*)\balt=["'][^"']*["']/i, `$1alt="${cambios.alt}"`)
        // title — agregar si no existe
        if (cambios.title !== undefined) {
          if (/\btitle=["'][^"']*["']/i.test(h))
            h = h.replace(/(<img[^>]*)\btitle=["'][^"']*["']/i, `$1title="${cambios.title}"`)
          else
            h = h.replace(/(<img[^>]*)>/i, `$1 title="${cambios.title}">`)
        }
        // width: atributo + propiedad CSS en style si existe
        if (cambios.width !== undefined) {
          h = h.replace(/(<img[^>]*)\bwidth=["']\d*["']/i, `$1width="${cambios.width}"`)
          if (/max-width:\s*\d+px/i.test(h))
            h = h.replace(/(style="[^"]*)\bmax-width:\s*\d+px/i, `$1max-width: ${cambios.width}px`)
        }
        // height: atributo
        if (cambios.height !== undefined)
          h = h.replace(/(<img[^>]*)\bheight=["']\d*["']/i, `$1height="${cambios.height}"`)
        // clase mobile — tres casos: reemplazar existente, agregar si
        // no había, o quitar el atributo si se dejó vacío
        if (cambios.clase !== undefined) {
          if (/\bclass=["'][^"']*["']/i.test(h)) {
            if (cambios.clase.trim() === '') {
              // Quitar el atributo class completo
              h = h.replace(/\s*\bclass=["'][^"']*["']/i, '')
            } else {
              h = h.replace(/\bclass=["'][^"']*["']/i, `class="${cambios.clase}"`)
            }
          } else if (cambios.clase.trim() !== '') {
            // Agregar class antes del style o del cierre del tag
            h = h.replace(/(<img[^>]*?)(\s+style=|\/?>)/i, `$1 class="${cambios.clase}"$2`)
          }
        }
        // link: envolver o actualizar el <a> que rodea la imagen
        if (cambios.link !== undefined) {
          const tieneLink = /<a\s[^>]*href=/i.test(h)
          if (cambios.link.trim() === '') {
            // Quitar el <a> si existía
            h = h.replace(/<a\s[^>]*>\s*(<img[^>]*>)\s*<\/a>/i, '$1')
          } else if (tieneLink) {
            h = h.replace(/(<a\s[^>]*)\bhref=["'][^"']*["']/i, `$1href="${cambios.link}"`)
          } else {
            // Envolver la imagen en un <a> nuevo
            h = h.replace(/(<img[^>]*>)/i, `<a href="${cambios.link}" target="_blank">$1</a>`)
          }
        }
        return h
      })
    }

    // Estados locales por campo — declarados al nivel del componente,
    // ver inicio de PanelEditor.

    return (
      <>
        <div className="ep-editor-body">
          <div className="ep-campo">
            <label className="ep-campo-label">URL de la imagen</label>
            <input className="ep-campo-input" autoComplete="off" value={ilSrc}
              onChange={e => setIlSrc(e.target.value)}
              onBlur={e => commitImagenLibre({ src: e.target.value })}
              placeholder="https://cdn.ejemplo.com/imagen.png" />
          </div>
          <div className="ep-campo">
            <label className="ep-campo-label">Alt</label>
            <input className="ep-campo-input" autoComplete="off" value={ilAlt}
              onChange={e => setIlAlt(e.target.value)}
              onBlur={e => commitImagenLibre({ alt: e.target.value })}
              placeholder="Texto alternativo" />
          </div>
          <div className="ep-campo">
            <label className="ep-campo-label">Title</label>
            <input className="ep-campo-input" autoComplete="off" value={ilTitle}
              onChange={e => setIlTitle(e.target.value)}
              onBlur={e => commitImagenLibre({ title: e.target.value })}
              placeholder="Título de la imagen" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div className="ep-campo" style={{ flex: 1 }}>
              <label className="ep-campo-label">Ancho (px)</label>
              <input className="ep-campo-input" autoComplete="off" value={ilWidth}
                onChange={e => setIlWidth(e.target.value)}
                onBlur={e => commitImagenLibre({ width: e.target.value })}
                placeholder="530" />
            </div>
            <div className="ep-campo" style={{ flex: 1 }}>
              <label className="ep-campo-label">Alto (px)</label>
              <input className="ep-campo-input" autoComplete="off" value={ilHeight}
                onChange={e => setIlHeight(e.target.value)}
                onBlur={e => commitImagenLibre({ height: e.target.value })}
                placeholder="auto" />
            </div>
          </div>
          <div className="ep-campo">
            <label className="ep-campo-label">Link (opcional)</label>
            <input className="ep-campo-input" autoComplete="off" value={ilLink}
              onChange={e => setIlLink(e.target.value)}
              onBlur={e => commitImagenLibre({ link: e.target.value })}
              placeholder="https://..." />
          </div>
          <div className="ep-campo">
            <label className="ep-campo-label">Clase mobile</label>
            <input className="ep-campo-input" autoComplete="off" value={ilClase}
              onChange={e => setIlClase(e.target.value)}
              onBlur={e => commitImagenLibre({ clase: e.target.value })}
              placeholder="img-max, img-max-product, img-max-Logo…" />
            <span className="ep-campo-hint">Define cómo se adapta la imagen en pantallas chicas. Clases disponibles: <code>img-max</code> (100%), <code>img-max-product</code> (50%), <code>img-max-Logo</code> (85%)</span>
          </div>
        </div>
        <div className="ep-editor-footer">
          <button className="ep-btn ep-btn-primary ep-btn-aplicar" onClick={aplicar} disabled={saving}>
            {saving ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
            {saving ? 'Aplicando…' : 'Aplicar cambios'}
          </button>
          <button className="ep-btn ep-btn-ghost ep-btn-aplicar" onClick={resetBloque} style={{ marginTop: 4 }}>
            <RotateCcw size={13} /> Restaurar original
          </button>
        </div>
      </>
    )
  }
  // Valor actual de cada <td>-hoja, indexado por posicionOrden (ver
  // comentario grande junto a extraerTdsConBalance) — usa balance real
  // de profundidad, a diferencia del regex no-greedy simple que se
  // usaba antes (no respeta anidamiento: con doble nivel de tablas,
  // como Borde_Izq_Rojo_Texto, terminaba devolviendo el contenido de
  // la celda equivocada). SIN filtrar por contenido, porque acá lo que
  // importa es poder indexar por posicionOrden de forma estable. Si en
  // cambio se llamara a detectarCampos(htmlLocal) de nuevo, un campo
  // vaciado dejaría de aparecer en esa lista y correría los índices de
  // los campos siguientes — el mismo bug que ya se corrigió en
  // detectarCampos / actualizarCampoEnHtml, pero del lado de la
  // lectura en vez de la escritura.
  //
  // Bug real reportado, ya resuelto (uso normal, sin necesidad de
  // importar nada — pasaba con cualquier bloque, recién arrastrado o
  // importado): este código YA decía en el comentario que indexaba
  // por posicionOrden, pero efectivamente buscaba por
  // campo.posicionReal (= posicionContenido, ver detectarCampos) —
  // una discrepancia real entre lo documentado y lo implementado.
  // posicionContenido de una celda vacía pasa a ser null en cuanto esa
  // celda deja de tener contenido real, así que después de vaciar el
  // ÚNICO campo de texto de un bloque, buscar por posicionContenido ya
  // no encontraba nada — ni para LEER el valor actual (esta función)
  // ni para ESCRIBIR uno nuevo (actualizarCampoEnHtml, ver ese
  // comentario para el detalle completo), el campo quedaba vacío para
  // siempre sin importar cuánto se reintentara escribir. Fix: tanto
  // esta función como actualizarCampoEnHtml ahora anclan por
  // posicionOrden (propiedad fija de la posición física de la celda,
  // nunca cambia esté vacía o no) — detectarCampos ahora expone
  // posicionOrden en cada campo de texto además de posicionReal.
  // Bug real reportado con una pieza real (Borde_Izq_Rojo_Texto en una
  // pieza de "Viaje a China"): el panel siempre mostraba el texto de
  // EJEMPLO del template ("Miércoles 15 de julio...") en vez del texto
  // real importado. Causa: el criterio de baseHtml (más arriba, "cuál
  // tiene más <td> totales") asume que el template SIEMPRE tiene igual
  // o menos estructura decorativa que la pieza real — pero puede ser
  // al revés: el template de este bloque envuelve el texto en una
  // sub-tabla propia de 3 filas (2 espaciadores + texto), mientras que
  // la pieza real real tenía el texto directo en el <td> de nivel
  // superior, sin esa sub-tabla. El template termina con MÁS <td> que
  // la pieza real, así que se elige como baseHtml — y el campo de
  // texto queda con el posicionOrden correspondiente A LA ESTRUCTURA
  // DEL TEMPLATE (3), que no existe en la pieza real (que solo llega
  // hasta el índice 2). Buscar ese posicionOrden en htmlLocal no
  // encuentra nada, y silenciosamente caía al texto del template.
  // Fix: si posicionOrden no encuentra celda, fallback a
  // posicionReal/posicionContenido — la posición ENTRE SOLO LAS
  // CELDAS CON CONTENIDO REAL, que en el caso normal (1 único campo de
  // texto en el bloque) sigue siendo la misma sin importar cuántas
  // celdas decorativas haya alrededor en cada estructura. No reabre el
  // bug viejo (campo vaciado quedando inaccesible): ese caso siempre
  // encuentra la celda por posicionOrden primero (la celda física
  // nunca deja de existir, vacía o no), así que el fallback nunca
  // llega a activarse ahí.
  const todosLosTdActuales = extraerTdsConBalance(htmlLocal)
  function valorActualDeTexto(campo) {
    let celda = todosLosTdActuales.find(c => c.posicionOrden === campo.posicionOrden)
    if (celda) return celda.contenido
    celda = todosLosTdActuales.find(c => c.posicionContenido === campo.posicionReal)
    return celda ? celda.contenido : campo.contenido
  }

  // Mismo problema que el de arriba, pero del lado de imagen: campo.src
  // (y alt/title/width/height) quedan FIJOS desde el detectarCampos
  // original (corrido una sola vez, contra bloque.html o
  // bloque.htmlEditado — ver comentario grande más arriba), y
  // CampoImagen los usa para inicializar su propio useState. Bug real
  // reportado: en un bloque importado por heurística que matchea
  // contra un template (ej. Imagen_Libre) con la MISMA cantidad de
  // <td> que el HTML real importado, baseHtml termina siendo
  // bloque.html (el template) — y el <img src> que se muestra en el
  // panel es el de la imagen de EJEMPLO hardcodeada en ese archivo de
  // template, no la imagen real de la pieza que se importó (que sí
  // está bien en htmlLocal/bloque.htmlEditado, solo que nadie la
  // vuelve a leer de ahí). Mismo criterio de fix que valorActualDeTexto:
  // releer el <img> real por posicionReal contra htmlLocal en cada
  // render, en vez de confiar en el valor capturado una sola vez.
  const todosLosImgActuales = [...htmlLocal.matchAll(/<img([^>]*)>/gi)].map(m => m[1])
  function valorActualDeImagen(campo) {
    const attrs = todosLosImgActuales[campo.posicionReal]
    if (attrs === undefined) return campo
    const getAttr = (name) => {
      const m = attrs.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))
      return m ? m[1] : ''
    }
    const getStyleProp = (prop) => {
      const m = attrs.match(new RegExp(`${prop}:\\s*([\\d.]+)px`, 'i'))
      return m ? m[1] : ''
    }
    return {
      ...campo,
      src: getAttr('src'),
      alt: getAttr('alt'),
      title: getAttr('title'),
      width: getAttr('width') || getStyleProp('width'),
      height: getAttr('height') || getStyleProp('height'),
    }
  }

  const campos = camposOriginales.current

  return (
    <>
      <div className="ep-editor-body">
        {sinCampos && (
          <div className="ep-sin-campos">
            <div className="ep-sin-campos-icono"><Type size={20} /></div>
            <strong>Sin campos editables</strong>
            <span>Este bloque no tiene textos, imágenes ni links detectados para editar.</span>
          </div>
        )}
        {bloque.slug === 'Modulo_Doble_Con_Imagen_Punteada' && (() => {
          // Selector de color de segmento — los 4 bgcolor de las celdas de
          // imagen de este bloque siempre son el mismo color (el del segmento).
          // Se lee el color actual de htmlLocal para marcar el chip activo.
          const SEGMENTOS = [
            { label: 'CG',    color: '#c4161c' },
            { label: 'EB',    color: '#000000' },
            { label: 'Pay',   color: '#635843' },
            { label: 'Start', color: '#f58220' },
          ]
          const colorActual = (htmlLocal.match(/bgcolor="(#(?!fff(?:fff)?)[^"]+)"/i)?.[1] ?? '').toLowerCase()
          function aplicarSegmento(nuevoColor) {
            setHtmlLocal(prev => prev.replace(/bgcolor="(#(?!fff(?:fff)?)[^"]+)"/gi, `bgcolor="${nuevoColor}"`))
          }
          const esCustom = colorActual && !SEGMENTOS.some(s => s.color === colorActual)
          // El chip activo se pinta con el color real de ese segmento
          // (borde sólido + fondo muy tenue del mismo color) en vez del
          // violeta genérico que usan los chips de espaciador — mismo
          // criterio que ya aplican las pestañas CG/EB/Pay de la
          // biblioteca: el color de marca identifica la opción activa,
          // no un acento neutro compartido con otros controles.
          function estiloChipSegmento(color, activo) {
            if (!activo) return undefined
            return { borderColor: color, background: `${color}1a`, color: 'var(--text-primary)' }
          }
          return (
            <div className="ep-campo">
              <label className="ep-campo-label">Color de segmento</label>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {SEGMENTOS.map(s => (
                  <button key={s.label} title={s.color}
                    onClick={() => aplicarSegmento(s.color)}
                    className={`ep-espaciador-chip${colorActual === s.color ? ' activo' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...estiloChipSegmento(s.color, colorActual === s.color) }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: s.color, border: '1px solid rgba(0,0,0,0.2)', flexShrink: 0 }} />
                    {s.label}
                  </button>
                ))}
                <label title="Color personalizado"
                  className={`ep-espaciador-chip${esCustom ? ' activo' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', ...estiloChipSegmento(colorActual, esCustom) }}>
                  <input type="color" value={esCustom ? colorActual : '#888888'}
                    onChange={e => aplicarSegmento(e.target.value)}
                    style={{ width: 12, height: 12, padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }} />
                  Custom
                </label>
              </div>
            </div>
          )
        })()}
        {campos.map((campo, i) => {
          if (campo.tipo === 'texto') return (
            <div key={i} className="ep-seccion">
              <div className="ep-seccion-titulo">{campo.label}</div>
              <RichEditor value={valorActualDeTexto(campo)}
                onChange={v => actualizarCampo('texto', campo.posicionOrden, { contenido: v }, campo.posicionReal)} />
            </div>
          )
          if (campo.tipo === 'imagen') {
            const campoActual = valorActualDeImagen(campo)
            return (
              <CampoImagen key={`${i}-${campoActual.src}`} campo={campoActual}
                onActualizar={c => actualizarCampo('imagen', campo.posicionReal, c)}
                onReset={() => { setHtmlLocal(bloque.html); onActualizar(bloque.instanceId, null) }} />
            )
          }
          if (campo.tipo === 'link') return (
            <div key={i} className="ep-seccion">
              <div className="ep-seccion-titulo">{campo.label} (opcional)</div>
              <input className="ep-campo-input" defaultValue={campo.valor} placeholder="https://... (dejar vacío si no tiene link)" autoComplete="off"
                onBlur={e => actualizarCampo('link', campo.idx, { valor: e.target.value })} />
            </div>
          )
          return null
        })}
      </div>
      {!sinCampos && (
        <div className="ep-editor-footer">
          <button className="ep-btn ep-btn-primary ep-btn-aplicar" onClick={aplicar} disabled={saving}>
            {saving ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
            {saving ? 'Aplicando…' : 'Aplicar cambios'}
          </button>
          {(bloque.slug === 'Icono_Separador_Rojo_Texto' || bloque.slug === 'Icono_Grande_Separador_Rojo_Texto') && (() => {
            // Detectar versión real por el HTML actual (no por slug) —
            // un bloque importado puede tener slug "chico" pero HTML
            // con borde 5px si la heurística lo clasificó mal.
            const htmlReal = bloque.htmlEditado || bloque.html
            const esGrandeReal = /border-left:\s*solid\s*5px/i.test(htmlReal)
            const slugDestino = esGrandeReal ? 'Icono_Separador_Rojo_Texto' : 'Icono_Grande_Separador_Rojo_Texto'
            return (
              <button className="ep-btn ep-btn-ghost ep-btn-aplicar" style={{ marginTop: 4 }}
                onClick={() => onSwap(bloque.instanceId, slugDestino)}>
                {esGrandeReal ? '↕ Cambiar a versión chica' : '↕ Cambiar a versión grande'}
              </button>
            )
          })()}
          <button className="ep-btn ep-btn-ghost ep-btn-aplicar" onClick={resetBloque} style={{ marginTop: 4 }}>
            <RotateCcw size={13} /> Restaurar original
          </button>
        </div>
      )}
    </>
  )
}

// ─── Iframe auto-alto ───────────────────────────────────────────────────────
const AutoIframe = forwardRef(function AutoIframe({ srcDoc, title, className, height, width }, refExterna) {
  const refInterna = useRef(null)
  // Permite que el padre (modal de importar, para hacer scroll a un
  // bloque marcado) acceda al mismo nodo <iframe> que este componente
  // ya usa internamente para medir su alto — sin esto, cada quien
  // tendría su propia referencia desincronizada.
  const ref = (node) => { refInterna.current = node; if (typeof refExterna === 'function') refExterna(node); else if (refExterna) refExterna.current = node }

  function ajustarAlto() {
    if (height) return
    try {
      const doc = refInterna.current?.contentDocument
      if (!doc?.body) return
      const h = doc.body.scrollHeight || doc.documentElement?.scrollHeight || 40
      refInterna.current.style.height = `${Math.max(h, 40)}px`
    } catch { if (refInterna.current) refInterna.current.style.height = '80px' }
  }

  // Reajustar alto cada vez que cambia el srcDoc, o el width (un email
  // más angosto —modo mobile— casi siempre necesita más alto que el
  // mismo contenido a ancho completo, así que el height medido en un
  // ancho no sirve para el otro; sin re-medir, el iframe queda con el
  // alto del modo anterior y corta contenido al cambiar de modo).
  useEffect(() => {
    const iframe = refInterna.current
    if (!iframe) return
    // onLoad puede no dispararse si el iframe ya está montado — forzar via evento
    const handler = () => ajustarAlto()
    iframe.addEventListener('load', handler)
    // Si ya tiene documento cargado, ajustar ahora mismo — un frame
    // después del cambio de width, para que el navegador ya haya
    // recalculado el layout interno del iframe con el ancho nuevo
    // antes de medir scrollHeight (si se mide en el mismo tick
    // síncrono del cambio de estilo, puede leer todavía el alto
    // calculado con el ancho anterior).
    if (iframe.contentDocument?.readyState === 'complete') {
      requestAnimationFrame(ajustarAlto)
    }
    return () => iframe.removeEventListener('load', handler)
  }, [srcDoc, width])

  return <iframe ref={ref} className={className} srcDoc={srcDoc} title={title}
    scrolling="no" style={{ height: height || 40, border: 'none', display: 'block', width: width || '100%', background: '#fff' }} />
})

// ─── Categoría colapsable ───────────────────────────────────────────────────
function CategoriaColapsable({ titulo, children, count = null }) {
  const [abierto, setAbierto] = useState(true)
  return (
    <div className="ep-categoria">
      <button className="ep-categoria-header" onClick={() => setAbierto(v => !v)}>
        <span className="ep-categoria-titulo">{titulo}</span>
        {count != null && <span className="ep-categoria-count">{count}</span>}
        <ChevronDown size={13} className="ep-categoria-chevron" style={{ transform: abierto ? 'rotate(180deg)' : 'none' }} />
      </button>
      {abierto && <div className="ep-categoria-body">{children}</div>}
    </div>
  )
}

// ─── Selector de pestañas (CG / EB / Pay dentro de "Header") ───────────────
// No es un acordeón anidado: es un selector de una sola pestaña activa a la
// vez — debajo se muestra la lista plana de bloques de esa pestaña. Cada
// opción puede traer su propio color de marca (mismos valores que el
// selector de segmento de Modulo_Doble_Con_Imagen_Punteada: CG rojo, EB
// negro, Pay marrón) para que la pestaña activa se pinte con ese color en
// vez de quedar siempre roja.
function SelectorPestanas({ opciones, activa, onCambiar }) {
  return (
    <div className="ep-pestanas-header">
      {opciones.map(op => (
        <button key={op.key}
          className={`ep-pestana-chip ${activa === op.key ? 'activa' : ''}`}
          style={activa === op.key && op.color ? { borderColor: op.color, background: op.color, color: '#fff' } : undefined}
          onClick={() => onCambiar(op.key)}>
          {op.label}
        </button>
      ))}
    </div>
  )
}

// ─── Menú desplegable genérico (botón gatillo + popover) ──────────────────
// Usado para el selector de Tema y el split button de Exportación de la
// barra superior. Se cierra solo al hacer click afuera — comportamiento
// estándar de cualquier menú de este tipo, así que vive en un componente
// propio en vez de repetir la lógica de "click afuera" en cada lugar que
// lo necesite.
function MenuDesplegable({ trigger, children, alinear = 'derecha', popoverClassName = '' }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    function onClickAfuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickAfuera)
    return () => document.removeEventListener('mousedown', onClickAfuera)
  }, [abierto])
  return (
    <div className="ep-menu-wrap" ref={ref}>
      {trigger(() => setAbierto(v => !v), abierto)}
      {abierto && (
        <div className={`ep-menu-popover ${alinear === 'izquierda' ? 'ep-menu-popover-izq' : ''} ${popoverClassName}`}>
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  )
}

// ─── Context card del panel de edición ──────────────────────────────────
// Tarjeta destacada arriba del formulario de edición — comunica de un
// vistazo qué bloque está seleccionado (miniatura real + nombre + badge
// de categoría) antes de que el usuario llegue a los campos editables.
// Reutiliza generarThumbSVG, la misma miniatura que ya se ve en la
// biblioteca, así el usuario reconoce el bloque por la misma imagen en
// los dos lugares en vez de tener dos representaciones visuales distintas
// del mismo bloque.
const CATEGORIA_LABEL = {
  Header: 'Header',
  Contenido: 'Contenido',
  Botones: 'Botón / Link',
  Personalizado: 'Código HTML',
}
function ContextCardEditor({ bloque }) {
  const label = CATEGORIA_LABEL[bloque.categoria] ?? bloque.categoria
  return (
    <div className="ep-context-card">
      <div className="ep-context-card-thumb">
        <img src={generarThumbSVG(bloque)} alt="" />
      </div>
      <div className="ep-context-card-info">
        <span className="ep-context-card-nombre">{bloque.nombre}</span>
        <span className="ep-context-card-badge">{label}</span>
      </div>
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────
// Reconstruye el objeto bandaHeader completo a partir del slug guardado
// — localStorage solo guarda el slug (string liviano), no el HTML
// completo del template (que ya vive en BLOQUES y no tiene sentido
// duplicar en storage).
function headerDesdeSlag(slug) {
  return BLOQUES_HEADER.find(b => b.slug === slug) ?? BLOQUES_HEADER[0] ?? null
}

export default function EditorPiezas() {
  const { showSuccess } = useNotificaciones()
  const [busqueda, setBusqueda] = useState('')
  // Pestaña activa del selector CG/EB/Pay dentro de "Header" en la
  // biblioteca — no es parte del borrador persistido, es solo un
  // estado de navegación de la UI (se resetea al recargar la página).
  const [pestanaHeaderActiva, setPestanaHeaderActiva] = useState('CG')

  // ── Borrador persistido en localStorage ────────────────────────────
  // useLocalStorage encapsula lectura lazy + try/catch de escritura.
  // El borrador es un objeto compuesto (nombre, tema, canvas, etc.) —
  // se lee UNA vez al montar para inicializar cada estado individual,
  // y se escribe en el useEffect de guardado automático vía setBorrador.
  const [borrador, setBorrador] = useLocalStorage('ep_borrador', null)
  const [nombre, setNombre] = useState(() => borrador?.nombre ?? 'Nueva pieza')
  // Nombre de la pieza — "click to edit": en reposo se ve como texto
  // plano + lápiz (no como un input siempre activo, que invita menos
  // a tocarlo); al hacer click se convierte en input real con foco
  // automático, y al perder el foco vuelve a texto plano.
  const [editandoNombre, setEditandoNombre] = useState(false)
  const inputNombreRef = useRef(null)
  useEffect(() => {
    if (editandoNombre) inputNombreRef.current?.focus()
  }, [editandoNombre])
  // ICBC / Avisos / Mall — cambiable en cualquier momento (no solo al
  // crear la pieza), ya que afecta solo colores en el momento de
  // exportar/previsualizar, nunca el contenido editado por el usuario.
  const [tema, setTema] = useState(() => borrador?.tema ?? TEMA_DEFAULT)
  const [bandaHeader, setBandaHeader] = useState(() => borrador?.bandaHeaderSlug ? headerDesdeSlag(borrador.bandaHeaderSlug) : (BLOQUES_HEADER[0] ?? null))
  // Array de { key, activa } en el ORDEN elegido por el usuario
  // (arrastrando los pills en el panel de edición del header) — null
  // hasta que se inicializa por primera vez con las redes reales que
  // trae el header actual (ver inicializarRedesOrdenSiHaceFalta), así
  // se resetea automáticamente al cambiar a un header distinto.
  const [redesOrden, setRedesOrden] = useState(() => borrador?.redesOrden ?? null)
  function toggleRedActiva(key) {
    setRedesOrden(prev => (prev ?? []).map(r => r.key === key ? { ...r, activa: !r.activa } : r))
  }
  function reordenarPillRed(fromKey, toIndex) {
    setRedesOrden(prev => {
      const arr = [...(prev ?? [])]
      const fromIdx = arr.findIndex(r => r.key === fromKey)
      if (fromIdx === -1) return prev
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIndex, 0, item)
      return arr
    })
  }
  const [canvas, setCanvas] = useState(() => {
    const guardado = borrador?.canvas
    if (!guardado) return []
    // Reconstruir el html original de cada bloque desde BLOQUES —
    // no se guarda en localStorage (solo htmlEditado y metadata),
    // así que hay que cruzarlo de vuelta con la fuente real.
    return guardado.map(b => {
      const original = BLOQUES.find(x => x.id === b.id)
      return original ? { ...b, html: original.html } : b
    }).filter(b => b.html != null) // descartar bloques cuyo template ya no existe
  })
  const [selectedId, setSelectedId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  // Desktop (600px, ancho real del email) / Mobile (375px) — angostar
  // el propio iframe con width fijo es lo que dispara los media
  // queries reales del HTML (@media max-width: 600px en construirCanvasStyles,
  // que ya trae todo el responsive real: Ocultar_Desktop, tamaños de
  // imagen, paddings). Un simple CSS de "achicar visualmente" el
  // iframe no alcanza — el viewport interno que ve el contenido sigue
  // siendo el mismo si no se cambia el width real del elemento.
  const [previewModo, setPreviewModo] = useState('desktop')
  const [draggingBibliotecaId, setDraggingBibliotecaId] = useState(null)
  const [draggingCanvasId, setDraggingCanvasId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null) // { id, posicion: 'arriba'|'abajo' }
  const [dragOverZona, setDragOverZona] = useState(false)
  const [dragOverHeader, setDragOverHeader] = useState(false)
  const [imgPrincipal, setImgPrincipal] = useState(() => borrador?.imgPrincipal ?? { activo: false, src: '', alt: '', title: '', link: '' })
  const [imgFooter, setImgFooter] = useState(() => borrador?.imgFooter ?? { activo: false, src: '', alt: '', title: '', link: '' })
  // Array de legales adicionales — mismo patrón que indicadores (cada
  // uno con su id, botón Agregar, eliminar individual). Disponible en
  // los 3 templates, no es exclusivo de Mall.
  const [legalesAdicionales, setLegalesAdicionales] = useState(() => borrador?.legalesAdicionales ?? [])
  function agregarLegalAdicional() { setLegalesAdicionales(p => [...p, { id: Date.now(), texto: '' }]) }
  function actualizarLegalAdicional(id, texto) { setLegalesAdicionales(p => p.map(l => l.id === id ? { ...l, texto } : l)) }
  function eliminarLegalAdicional(id) { setLegalesAdicionales(p => p.filter(l => l.id !== id)) }
  // DEFAULT false = texto corrido, un punto y seguido tras otro, igual
  // que el comportamiento de siempre — es lo normal para la mayoría de
  // las piezas (un legal corto o ninguno). true = cada legal en su
  // propia fila/celda separada por un espaciador de 14px — opción
  // explícita, solo tiene sentido cuando se van a sumar varios legales
  // largos, para evitar que algunos proveedores de correo detecten el
  // bloque de texto corrido como sospechoso y lo bloqueen (confirmado
  // contra el HTML real de Mall, donde el legal completo viene
  // partido así).
  const [legalesSeparados, setLegalesSeparados] = useState(() => borrador?.legalesSeparados ?? false)
  // Firma institucional (ICBC Investments / Sociedad Gerente-
  // Depositaria) — null = sección apagada (no aparece en el export).
  // A diferencia de legalesAdicionales/indicadores (listas abiertas,
  // se agregan de a uno), esta es una sección de estructura FIJA: 2
  // filas, 2 columnas cada una, solo se activa/desactiva entera y se
  // editan sus 4 textos — ver FIRMA_INSTITUCIONAL_DEFAULT.
  const [firmaInstitucional, setFirmaInstitucional] = useState(() => borrador?.firmaInstitucional ?? null)
  function toggleFirmaInstitucional() {
    setFirmaInstitucional(p => p ? null : { activo: true, ...FIRMA_INSTITUCIONAL_DEFAULT })
  }
  function actualizarFirmaInstitucional(campo, valor) {
    setFirmaInstitucional(p => p ? { ...p, [campo]: valor } : p)
  }
  const [indicadores, setIndicadores] = useState(() => borrador?.indicadores ?? [])
  // Estado visual de "guardando" para los botones Confirmar de las
  // secciones especiales (imagen principal/footer, legal específico,
  // indicadores) — mismo criterio que ya usa PanelEditor.aplicar() para
  // el botón "Aplicar cambios": como estos campos ya actualizan el
  // estado en vivo vía onChange, el guardado real es instantáneo, pero
  // sin ningún feedback visual el click se siente "mudo" (¿pasó algo?).
  // Un breve estado de loading (mismo delay que aplicar()) confirma al
  // usuario que la acción se registró.
  const [confirmando, setConfirmando] = useState({})
  function confirmarSeccion(key) {
    setConfirmando(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setConfirmando(prev => ({ ...prev, [key]: false })), 400)
  }
  // Qué alto de espaciador se está arrastrando desde el FAB flotante
  // (7/14/28, o null si no hay ningún drag de spacer en curso) — se
  // setea en el dragStart de cada opción del FAB y se consume en el
  // momento del drop, junto con el mismo flujo de drag and drop que ya
  // usan los bloques de la biblioteca.
  const [spacerPxArrastrando, setSpacerPxArrastrando] = useState(null)
  // Igual concepto que spacerPxArrastrando: "Código personalizado" no
  // tiene un archivo .html real detrás (es un bloque vacío que el
  // usuario llena con su propio HTML), así que no existe en BLOQUES y
  // el onDropZona normal nunca lo encuentra por id. Antes esto hacía
  // que el card no fuera arrastrable en absoluto — solo tenía onClick,
  // siempre se agregaba al final del canvas sin poder elegir posición.
  const [arrastrandoCodigoPersonalizado, setArrastrandoCodigoPersonalizado] = useState(false)

  const bloquesFiltradosHeader = BLOQUES_HEADER.filter(b => b.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const bloquesFiltradosContenido = BLOQUES_CONTENIDO.filter(b =>
    b.slug !== 'Espaciador' && b.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const categoriasContenido = [...new Set(bloquesFiltradosContenido.map(b => b.categoria))]

  // ── Guardado automático en localStorage ────────────────────────────
  // setBorrador viene de useLocalStorage — ya tiene el try/catch
  // encapsulado, no hace falta repetirlo acá. Debounce de 500ms para
  // no escribir en cada keystroke sino cuando el usuario para un momento.
  // El html original de cada bloque no se guarda — se reconstruye
  // desde BLOQUES al cargar (ver inicialización de canvas más arriba).
  useEffect(() => {
    const t = setTimeout(() => {
      setBorrador({
        nombre,
        tema,
        bandaHeaderSlug: bandaHeader?.slug ?? null,
        redesOrden,
        canvas: canvas.map(b => ({ ...b, html: undefined })),
        imgPrincipal,
        imgFooter,
        legalesAdicionales,
        legalesSeparados,
        firmaInstitucional,
        indicadores,
      })
    }, 500)
    return () => clearTimeout(t)
  }, [nombre, tema, bandaHeader, redesOrden, canvas, imgPrincipal, imgFooter, legalesAdicionales, legalesSeparados, firmaInstitucional, indicadores])

  // ── Nueva pieza — resetea todo el estado al default ────────────────
  // También borra el borrador del localStorage para que al recargar
  // no vuelva a aparecer la pieza anterior.
  function nuevaPieza() {
    setNombre('Nueva pieza')
    setTema(TEMA_DEFAULT)
    setBandaHeader(BLOQUES_HEADER[0] ?? null)
    setRedesOrden(null)
    setCanvas([])
    setSelectedId(null)
    setImgPrincipal({ activo: false, src: '', alt: '', title: '', link: '' })
    setImgFooter({ activo: false, src: '', alt: '', link: '' })
    setLegalesAdicionales([])
    setLegalesSeparados(false)
    setFirmaInstitucional(null)
    setIndicadores([])
    setBorrador(null)
  }

  function crearInstancia(bloque) {
    return { ...bloque, instanceId: `${bloque.id}-${Date.now()}`, htmlEditado: null }
  }

  function agregarAlCanvas(bloque, antesDeId = null, posicion = 'abajo', htmlOverride = null) {
    const inst = crearInstancia(bloque)
    if (htmlOverride != null) inst.htmlEditado = htmlOverride
    setCanvas(prev => {
      if (antesDeId == null) return [...prev, inst]
      const idx = prev.findIndex(b => b.instanceId === antesDeId)
      if (idx === -1) return [...prev, inst]
      const arr = [...prev]
      arr.splice(posicion === 'arriba' ? idx : idx + 1, 0, inst)
      return arr
    })
    setSelectedId(inst.instanceId)
  }

  // Genera el HTML del espaciador con un alto custom — misma lógica de
  // reemplazo que ya usa el editor del espaciador en el panel lateral
  // (PanelEditor → esEspaciador → setAlto), reusada acá para que el
  // FAB flotante pueda soltar directamente con el alto correcto, sin
  // pasar primero por el HTML default y editarlo después.
  function htmlEspaciadorConAlto(px) {
    if (!BLOQUE_ESPACIADOR) return null
    return BLOQUE_ESPACIADOR.html
      .replace(/height:\s*\d+px/g, `height: ${px}px`)
      .replace(/line-height:\s*\d+px/g, `line-height: ${px}px`)
      .replace(/mso-line-height-alt:\s*\d+px/g, `mso-line-height-alt: ${px}px`)
      .replace(/height="\d+"/g, `height="${px}"`)
  }

  function agregarEspaciadorDespues(instanceId) {
    if (!BLOQUE_ESPACIADOR) return
    const inst = crearInstancia(BLOQUE_ESPACIADOR)
    setCanvas(prev => {
      const idx = prev.findIndex(b => b.instanceId === instanceId)
      const arr = [...prev]
      arr.splice(idx + 1, 0, inst)
      return arr
    })
  }

  function agregarCodigo() {
    const inst = { id: 'codigo', instanceId: `codigo-${Date.now()}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: '', htmlEditado: null, tipo: 'codigo', slug: 'codigo' }
    setCanvas(prev => [...prev, inst])
    setSelectedId(inst.instanceId)
  }

  function eliminarBloque(instanceId) {
    setCanvas(prev => prev.filter(b => b.instanceId !== instanceId))
    if (selectedId === instanceId) setSelectedId(null)
  }

  function actualizarBloque(instanceId, htmlEditado) {
    setCanvas(prev => prev.map(b => b.instanceId === instanceId ? { ...b, htmlEditado } : b))
  }

  // Estilos custom de un bloque de código personalizado — CSS plano
  // (sin selector @media, el sistema ya envuelve cada uno en su hoja
  // correspondiente al exportar). Se guardan como campos propios del
  // bloque (no como parte del htmlEditado), para que generarExport
  // pueda recolectarlos de TODOS los bloques de código del canvas y
  // sumarlos a una sola hoja final — cada bloque aporta lo suyo, sin
  // pisar lo que aportó otro.
  function actualizarEstilosBloque(instanceId, campo, valor) {
    setCanvas(prev => prev.map(b => b.instanceId === instanceId ? { ...b, [campo]: valor } : b))
  }

  // Reemplaza un bloque en el canvas por otro template, preservando
  // el instanceId — usado por el intercambio Icono/IcónoGrande.
  function swapBloque(instanceId, nuevoSlug) {
    // Los únicos valores que cambian entre chico y grande son conocidos
    // y fijos. El src del ícono y el texto se preservan sin tocarlos.
    //
    // Se usan reemplazos por REGEX (no string literal con .split/.join)
    // por dos motivos encontrados en testing real:
    // 1) Bug real: el espaciador ANTES del borde es 10px en la chica y
    //    5px en la grande, pero el espaciador DESPUÉS del borde es 5px
    //    en AMBAS versiones — al ir de chico a grande, el primero pasa
    //    a "width: 5px" y queda IDÉNTICO al segundo. Un reemplazo de
    //    string ciego para la vuelta (grande→chico) no puede saber
    //    cuál de los dos "5px" corresponde a cuál — se resuelve
    //    anclando el regex a que el <td> espaciador-antes-del-borde es
    //    el que está INMEDIATAMENTE seguido por el <td> con
    //    border-left (\s* tolera cualquier whitespace/indentación
    //    entre ambos, a diferencia de un string literal con un salto
    //    de línea fijo, que se rompía contra el CRLF + indentación
    //    real del archivo en disco).
    // 2) Bug real: un bloque con el separador de imagen real
    //    (Img_Separador_265x2.png, presente en Modulo_Canal_Feriado y
    //    en cualquier bloque armado con esa sub-estructura) tiene su
    //    ancho FIJO en 445px (correcto para la chica: ícono 60px +
    //    espaciadores = 85px ocupados, 530-85=445) — al pasar a
    //    grande (ícono 80px + espaciadores = 105px ocupados,
    //    530-105=425, confirmado contra Modulo_Canal_Feriado) ese
    //    ancho quedaba sin actualizar, 20px más ancho de lo que el
    //    espacio real disponible permite — desborda visualmente la
    //    celda en un cliente de correo real.
    function aGrande(html) {
      return html
        .replace(/width="60" height="60" valign="middle"/g, 'width="80" height="80" valign="middle"')
        .replace(/width="60" height="60"\s*\/>/g, 'width="75" height="75" />')
        .replace(/style="width:\s*10px;"\s*width="10"(\s*valign="top"\s*align="left"><\/td>\s*<td\s+style="border-left)/g, 'style="width: 5px;" width="5"$1')
        .replace(/border-left:\s*solid\s*2px\s*#c4161c;/g, 'border-left: solid 5px #c4161c;')
        .replace(/\b445(?=px|")/g, '425')
    }
    function aChico(html) {
      return html
        .replace(/width="80" height="80" valign="middle"/g, 'width="60" height="60" valign="middle"')
        .replace(/width="75" height="75"\s*\/>/g, 'width="60" height="60" />')
        .replace(/style="width:\s*5px;"\s*width="5"(\s*valign="top"\s*align="left"><\/td>\s*<td\s+style="border-left)/g, 'style="width: 10px;" width="10"$1')
        .replace(/border-left:\s*solid\s*5px\s*#c4161c;/g, 'border-left: solid 2px #c4161c;')
        .replace(/\b425(?=px|")/g, '445')
    }
    const esGrandeActual = /border-left:\s*solid\s*5px/i.test(
      canvas.find(b => b.instanceId === instanceId)?.htmlEditado ||
      canvas.find(b => b.instanceId === instanceId)?.html || ''
    )
    setCanvas(prev => prev.map(b => {
      if (b.instanceId !== instanceId) return b
      const nuevo = BLOQUES_CONTENIDO.find(bl => bl.slug === nuevoSlug)
      if (!nuevo) return b
      const html = b.htmlEditado || b.html
      const htmlTransformado = esGrandeActual ? aChico(html) : aGrande(html)
      return { ...nuevo, instanceId, htmlEditado: htmlTransformado }
    }))
  }

  function onDragStartBiblioteca(e, bloque) {
    setDraggingBibliotecaId(bloque.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onDropZona(e, targetId = null, pos = 'abajo') {
    e.preventDefault()
    setDragOverZona(false)
    // Caso 1: se soltó una de las 3 opciones del FAB de espaciador —
    // el alto ya viene decidido desde el dragStart, se aplica directo.
    if (spacerPxArrastrando != null) {
      if (BLOQUE_ESPACIADOR) agregarAlCanvas(BLOQUE_ESPACIADOR, targetId, pos, htmlEspaciadorConAlto(spacerPxArrastrando))
      setSpacerPxArrastrando(null)
      setDragOverId(null)
      return
    }
    // Caso 1b: se soltó el card de "Código personalizado" — no existe
    // en BLOQUES (no tiene archivo .html real), así que se construye
    // la instancia a mano con la misma forma que crea agregarCodigo().
    if (arrastrandoCodigoPersonalizado) {
      const inst = { id: 'codigo', instanceId: `codigo-${Date.now()}`, categoria: 'Personalizado', nombre: 'Código personalizado', html: '', htmlEditado: null, tipo: 'codigo', slug: 'codigo' }
      setCanvas(prev => {
        if (targetId == null) return [...prev, inst]
        const idx = prev.findIndex(b => b.instanceId === targetId)
        if (idx === -1) return [...prev, inst]
        const arr = [...prev]
        arr.splice(pos === 'arriba' ? idx : idx + 1, 0, inst)
        return arr
      })
      setSelectedId(inst.instanceId)
      setArrastrandoCodigoPersonalizado(false)
      setDragOverId(null)
      return
    }
    // Caso 2: bloque normal de la biblioteca
    if (!draggingBibliotecaId) return
    const bloque = BLOQUES.find(b => b.id === draggingBibliotecaId)
    if (bloque && bloque.categoria !== 'Header') agregarAlCanvas(bloque, targetId, pos)
    setDraggingBibliotecaId(null)
    setDragOverId(null)
  }

  function onDropHeader(e) {
    e.preventDefault()
    setDragOverHeader(false)
    if (!draggingBibliotecaId) return
    const bloque = BLOQUES.find(b => b.id === draggingBibliotecaId)
    if (bloque?.categoria === 'Header') { setBandaHeader(bloque); setRedesOrden(null) }
    setDraggingBibliotecaId(null)
  }

  function onDragStartCanvas(e, instanceId) {
    setDraggingCanvasId(instanceId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOverBloque(e, instanceId) {
    e.preventDefault()
    if (draggingBibliotecaId || draggingCanvasId || spacerPxArrastrando != null || arrastrandoCodigoPersonalizado) {
      const rect = e.currentTarget.getBoundingClientRect()
      const posicion = e.clientY < rect.top + rect.height / 2 ? 'arriba' : 'abajo'
      setDragOverId({ id: instanceId, posicion })
    }
  }

  function onDropBloque(e, targetInstanceId) {
    e.preventDefault()
    if (draggingBibliotecaId || spacerPxArrastrando != null || arrastrandoCodigoPersonalizado) {
      onDropZona(e, targetInstanceId, dragOverId?.posicion ?? 'abajo')
      return
    }
    if (!draggingCanvasId || draggingCanvasId === targetInstanceId) { setDraggingCanvasId(null); setDragOverId(null); return }
    const posicion = dragOverId?.posicion ?? 'abajo'
    setCanvas(prev => {
      const arr = [...prev]
      const from = arr.findIndex(b => b.instanceId === draggingCanvasId)
      const [item] = arr.splice(from, 1)
      const to = arr.findIndex(b => b.instanceId === targetInstanceId)
      arr.splice(posicion === 'arriba' ? to : to + 1, 0, item)
      return arr
    })
    setDraggingCanvasId(null)
    setDragOverId(null)
  }

  function agregarIndicador() { setIndicadores(p => [...p, { id: Date.now(), ref: '(*)', sigla: 'CFTNA', valor: '0,00%' }]) }
  function actualizarIndicador(id, campo, val) { setIndicadores(p => p.map(i => i.id === id ? { ...i, [campo]: val } : i)) }
  function eliminarIndicador(id) { setIndicadores(p => p.filter(i => i.id !== id)) }

  function exportar() {
    const html = generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalesAdicionales, legalesSeparados, firmaInstitucional, indicadores, tema, redesOrden })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const slug = nombre.replace(/[ñÑ]/g, m => m === 'ñ' ? 'n' : 'N').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'pieza'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${slug}.html`; a.click()
    URL.revokeObjectURL(url)
  }

  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    const html = generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalesAdicionales, legalesSeparados, firmaInstitucional, indicadores, tema, redesOrden })
    await navigator.clipboard.writeText(html)
    setCopiado(true)
    showSuccess('HTML copiado al portapapeles')
    setTimeout(() => setCopiado(false), 2000)
  }

  const [showConfirmReinicio, setShowConfirmReinicio] = useState(false)

  // ── Importar pieza (desde HTML pegado o link) ──────────────────────
  // Flujo en 3 pasos dentro del mismo modal, sin un ConfirmModal
  // aparte: 1) el usuario pega HTML o pone un link y confirma, 2)
  // loading mientras se analiza (importarDesdeHtml primero, fallback a
  // importarHeuristico si no encontró marcadores), 3) resumen + preview
  // renderizado del resultado, con un único botón final que sirve a la
  // vez de "confirmo la importación" y "confirmo que esto reemplaza lo
  // que tenía armado" — no hace falta una segunda confirmación
  // separada, decisión explícita para no duplicar el mismo gesto.
  const [showImportar, setShowImportar] = useState(false)
  const [importarModo, setImportarModo] = useState('html') // 'html' | 'url'
  const [importarHtmlInput, setImportarHtmlInput] = useState('')
  const [importarUrlInput, setImportarUrlInput] = useState('')
  const [importarCargando, setImportarCargando] = useState(false)
  // Progreso simulado del análisis — el proceso real (parseo de
  // strings + regex) es síncrono y no tiene etapas reales que
  // reportar con un porcentaje fiel, así que esto es una animación de
  // avance progresivo, no una medición real. Sí refleja con precisión
  // en qué ETAPA real está (vía marcadores primero, vía heurística
  // después si la primera no encuentra nada) — eso no es inventado.
  // Llega a 100% recién cuando analizarImportacion termina de verdad,
  // nunca antes, para no mostrar "completado" mientras todavía sigue
  // procesando.
  const [importarProgreso, setImportarProgreso] = useState(0)
  const [importarEtapa, setImportarEtapa] = useState('marcadores') // 'marcadores' | 'heuristica'
  const importarProgresoRef = useRef(null)
  const [importarError, setImportarError] = useState('')
  // null mientras no se analizó nada todavía — una vez que hay un
  // resultado (aunque sea de baja confianza), pasamos a la pantalla de
  // resumen/preview dentro del mismo modal.
  const [importarResultado, setImportarResultado] = useState(null)
  // Referencia al <iframe> del preview de importación — el srcDoc lo
  // hace same-origin (contenido inline, no una URL externa), así que
  // se puede acceder directo a contentDocument sin restricciones de
  // iframe cross-origin. Se usa para hacer scroll/resaltado al bloque
  // marcado cuando el usuario hace click en su aviso correspondiente
  // (ver irABloqueEnPreview).
  const previewIframeRef = useRef(null)

  // Lleva la vista del preview directo al bloque marcado que
  // corresponde a un aviso clickeado — busca el id="preview-bloque-N"
  // que marcarBloquesNoReconocidosParaPreview ya dejó en el HTML del
  // iframe (N = canvasIdx del aviso). Hace scroll suave y agrega un
  // pulso de resaltado breve (clase con animación, se quita sola) para
  // que el ojo lo encuentre aunque el bloque ya estuviera a la vista
  // (scrollIntoView solo mueve algo si hace falta — sin el pulso, un
  // click sobre un bloque ya visible no daría ningún feedback).
  function irABloqueEnPreview(canvasIdx) {
    if (canvasIdx == null) return
    const doc = previewIframeRef.current?.contentDocument
    const el = doc?.getElementById(`preview-bloque-${canvasIdx}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.style.animation = 'none'
    // Forzar reflow antes de reasignar la animación, para que se
    // reinicie aunque el usuario haga click dos veces seguidas sobre
    // el mismo aviso (sin esto, la segunda vez no reproduciría nada
    // porque el navegador ve el mismo valor de animation que ya tenía).
    void el.offsetWidth
    el.style.animation = 'ep-preview-pulso 1100ms ease-out 2'
  }

  // Lleva la vista al primer <div inline-block> marcado como obsoleto
  // en el preview de importación (id="preview-obsoleto-0").
  function irAObsoletoEnPreview() {
    const iframeDoc = previewIframeRef.current?.contentDocument
    const el = iframeDoc?.getElementById('preview-obsoleto-0')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.style.outline = 'none'
    void el.offsetWidth
    el.style.outline = '3px solid #DC2626'
  }
  // Switch Desktop/Mobile del preview del resultado — mismo patrón
  // que showPreview/previewModo del modal de Vista previa, pero
  // independiente (este modal puede abrirse sin que el otro esté
  // abierto, y viceversa).
  const [importarModoPreview, setImportarModoPreview] = useState('desktop') // 'desktop' | 'mobile'
  // Índice del aviso activo (último clickeado) — antes el único
  // feedback de "este es el aviso que estoy viendo" era el hover, que
  // desaparece en cuanto el mouse se aleja. Ahora queda marcado de
  // forma persistente hasta que se clickea otro aviso o se cierra el
  // modal.
  const [avisoActivo, setAvisoActivo] = useState(null)

  function cerrarModalImportar() {
    setShowImportar(false)
    setImportarModo('html')
    setImportarHtmlInput('')
    setImportarUrlInput('')
    setImportarError('')
    setImportarResultado(null)
    setImportarModoPreview('desktop')
    clearInterval(importarProgresoRef.current)
    setImportarProgreso(0)
    setImportarEtapa('marcadores')
    setAvisoActivo(null)
  }

  async function analizarImportacion() {
    setImportarError('')
    const entrada = importarModo === 'html' ? importarHtmlInput.trim() : importarUrlInput.trim()
    if (!entrada) { setImportarError(importarModo === 'html' ? 'Pegá el HTML de la pieza.' : 'Ingresá el link de la pieza.'); return }

    setImportarCargando(true)
    setImportarProgreso(8)
    setImportarEtapa('marcadores')
    // Avance simulado mientras dura el análisis real — sube rápido al
    // principio y se frena cerca del techo (90%) para no llegar nunca
    // a 100% por sí solo; el 100% real lo pone el finally, recién
    // cuando analizarImportacion termina de verdad.
    clearInterval(importarProgresoRef.current)
    importarProgresoRef.current = setInterval(() => {
      setImportarProgreso(p => (p >= 90 ? p : p + (90 - p) * 0.18))
    }, 120)
    try {
      // Modo URL pasa por el mismo proxy que ya usan Revisión de
      // emails y Revisión de envíos — valida SSRF en capas (allowlist
      // de dominio, resolución de IP, redirects controlados), no
      // necesita ningún cambio acá. Solo corre en el deploy de Vercel
      // (ver nota en README, "Correr localmente") — en local, probar
      // con el modo HTML.
      const html = importarModo === 'html'
        ? entrada
        : await fetch(`/api/proxy?url=${encodeURIComponent(entrada)}`).then(r => {
            if (!r.ok) throw new Error('No se pudo obtener el HTML de ese link.')
            return r.text()
          })

      // Bug real encontrado con una pieza real, accedida por LINK (no
      // pegando el HTML directo desde el editor de la plataforma): el
      // HTML resultante traía 166 atributos con comillas SIMPLES
      // ('...') en vez de dobles ("...") — confirmado comparando ese
      // mismo HTML "limpio" pegado a mano (comillas dobles, se
      // importa bien) contra el obtenido por URL (comillas simples,
      // no se importa nada). Todo el resto de la estructura era
      // idéntico entre ambos — la causa concreta de por qué la
      // plataforma reescribe a comillas simples específicamente en el
      // camino de acceso por URL no se pudo confirmar (puede ser un
      // paso de minificación o sanitización propio de esa vía), pero
      // no hace falta entenderla para resolver el síntoma: TODOS los
      // regex de importarDesdeHtml/importarHeuristico (524 ocurrencias
      // de ="..." en el archivo) asumen comillas dobles literales —
      // reescribir cada uno para tolerar ambas sería un cambio enorme
      // y arriesgado. Normalizar una sola vez, acá, antes de que el
      // HTML llegue a cualquiera de las dos funciones, es la solución
      // estándar para HTML con comillas simples en atributos (válido
      // en el estándar HTML desde siempre, cualquier navegador real lo
      // acepta sin distinción) — no es un parche del síntoma puntual,
      // es tolerancia genérica que cualquier importador de HTML
      // debería tener. El regex exige que la comilla de apertura venga
      // pegada a `nombre-de-atributo=`, con un espacio antes del
      // nombre — así nunca toca un apóstrofe de texto visible (ej.
      // "Spider-Man's web" queda intacto, confirmado con pruebas).
      //
      // Segundo bug real encontrado AL CORREGIR el de arriba (estaba
      // tapado por él, nunca se veía mientras toda la pieza fallaba
      // entera): un <img alt='>'> con el carácter > SIN ESCAPAR como
      // valor literal del atributo (el diseñador tipeó '>' directo en
      // vez de la entidad &gt; — los templates propios de este editor
      // siempre usan &gt;, confirmado, así que es un error puntual de
      // esta pieza, no un patrón de la plataforma). El problema es
      // INDEPENDIENTE de las comillas: cualquier regex genérico de tag
      // (ej. /<img\b[^>]*>/, hay muchos en el archivo) usa [^>]* para
      // "todo hasta el cierre del tag" — no entiende de comillas, así
      // que un > suelto DENTRO de un atributo corta el match ahí
      // mismo, mucho antes del cierre real, dejando el resto del tag
      // (style, width, height, el >) como texto suelto en el bloque
      // siguiente. Se escapan > y < a sus entidades SOLO cuando viven
      // dentro de un valor de atributo completo (con su comilla de
      // apertura Y cierre, cualquiera de los dos tipos) — nunca se
      // tocan los > y < reales que delimitan tags, que viven afuera de
      // cualquier comilla. Tiene que aplicarse ANTES de normalizar
      // comillas simples a dobles (no cambia el resultado si se aplica
      // antes o después, pero mantiene cada fix enfocado en una sola
      // cosa).
      const htmlSinMayorQueSuelto = html.replace(/([a-zA-Z-]+)=(['"])([^'"]*)\2/g, (_m, attr, q, val) => {
        const valEscapado = val.replace(/>/g, '&gt;').replace(/</g, '&lt;')
        return `${attr}=${q}${valEscapado}${q}`
      })
      const htmlNormalizado = htmlSinMayorQueSuelto
        .replace(/(\s[a-zA-Z-]+)='([^']*)'/g, (_m, attr, val) => `${attr}="${val}"`)
        .replace(/https?:\/\/icommktrepo\.s3\.amazonaws\.com\//gi, 'https://d343t93odde9ul.cloudfront.net/')

      // importarDesdeHtml primero (100% determinístico si la pieza
      // tiene marcadores de este editor) — solo si devuelve resultado
      // null (ningún <!--BLOQUE--> encontrado) se cae a la heurística
      // sin marcadores, mucho más trabajosa y de menor certeza.
      const porMarcadores = importarDesdeHtml(htmlNormalizado)
      let resultadoFinal
      if (porMarcadores.resultado) {
        resultadoFinal = { ...porMarcadores, confianza: 'alta', viaMarcadores: true }
      } else {
        setImportarEtapa('heuristica')
        const porHeuristica = importarHeuristico(htmlNormalizado)
        resultadoFinal = { ...porHeuristica, viaMarcadores: false }
      }

      // Chequeo específico de riesgo Outlook — independiente de que
      // la pieza se haya podido importar bien o no (es un problema del
      // HTML ORIGINAL, no algo que importarDesdeHtml/importarHeuristico
      // puedan arreglar ni que necesiten para funcionar). Mismo
      // detector que usa "Revisión de HTML" — ver el comentario en
      // DetectarInlineEnvolviendoOutlook (generales.js) para el detalle
      // de por qué este caso puntual necesita mirar el string crudo en
      // vez del DOM ya parseado. Se corre sobre htmlNormalizado (no
      // sobre 'html' tal cual llegó) para evitar falsos negativos por
      // las comillas simples que a veces trae el HTML obtenido por
      // URL — esta detección, como todos los regex de este archivo,
      // asume comillas dobles.
      const riesgosOutlook = DetectarInlineEnvolviendoOutlook(htmlNormalizado)
      if (riesgosOutlook.length > 0) {
        resultadoFinal.avisos = [
          ...riesgosOutlook.map(r => ({ texto: r.detalle, tipo: 'outlook-riesgo', canvasIdx: null })),
          ...(resultadoFinal.avisos ?? []),
        ]
      }

      // Chequeo de contenido duplicado (ver DetectarContenidoDuplicado
      // en generales.js) — importa especialmente ACÁ, porque
      // importarHeuristico puede terminar "absorbiendo" el contenido
      // duplicado en un resultado que a simple vista se ve razonable
      // (bloques que se pisan/mergean sin tirar error), sin que quien
      // importó se entere de que el HTML de origen ya venía roto. El
      // aviso avisa aunque el import general haya salido bien, para
      // que se confirme a mano que no se perdió nada al mergear.
      const riesgosDuplicado = DetectarContenidoDuplicado(htmlNormalizado)
      if (riesgosDuplicado.length > 0) {
        resultadoFinal.avisos = [
          ...riesgosDuplicado.map(r => ({ texto: r.detalle, tipo: 'contenido-duplicado', canvasIdx: null })),
          ...(resultadoFinal.avisos ?? []),
        ]
      }

      // El análisis en sí (parseo + regex) es síncrono y suele tardar
      // milisegundos — sin este mínimo, el step de "analizando" podría
      // aparecer y desaparecer antes de que el ojo lo registre. No es
      // una espera artificial para simular trabajo que no existe: es
      // el piso de tiempo para que el feedback visual sea perceptible.
      // Va ANTES de setImportarResultado a propósito — si el resultado
      // se setea primero, el step 3 ya queda listo para mostrarse
      // mientras el delay sigue corriendo, y como importarCargando
      // todavía es true en ese momento, los dos steps llegan a
      // coexistir en pantalla (bug real: barra de progreso y resultado
      // superpuestos). Acá el resultado nunca se setea hasta que el
      // step 2 ya cumplió su tiempo mínimo.
      await new Promise(r => setTimeout(r, 450))
      setImportarResultado(resultadoFinal)
    } catch (err) {
      setImportarError(err.message || 'No se pudo procesar la pieza.')
    } finally {
      clearInterval(importarProgresoRef.current)
      setImportarProgreso(100)
      setImportarCargando(false)
    }
  }

  // Aplica el resultado ya analizado al estado real del editor —
  // pisa todo lo que hubiera armado antes, sin pedir una segunda
  // confirmación (el botón que llama a esta función ya es esa
  // confirmación). Mismo criterio de reseteo que nuevaPieza() para
  // los campos que el resultado importado no trae (legalesSeparados,
  // etc. sí vienen siempre en el resultado, pero por si alguna rama
  // futura dejara algo afuera, no queremos arrastrar datos viejos).
  function confirmarImportacion() {
    if (!importarResultado?.resultado) return
    const r = importarResultado.resultado
    setNombre('Pieza importada')
    setTema(r.tema)
    setBandaHeader(r.bandaHeader)
    // redesOrden viene calculado desde el HTML REAL de la pieza
    // importada (ver comentario en importarHeuristico/importarDesdeHtml)
    // — usar null acá dispararía el useEffect que rellena automático
    // desde el TEMPLATE del header, reintroduciendo redes que la pieza
    // original no tenía (bug real reportado: una pieza sin ningún
    // ícono de red social terminaba con las 4 redes del header
    // agregadas de la nada).
    setRedesOrden(r.redesOrden ?? [])
    setCanvas(r.canvas)
    setSelectedId(null)
    setImgPrincipal(r.imgPrincipal)
    setImgFooter(r.imgFooter)
    setLegalesAdicionales(r.legalesAdicionales)
    setLegalesSeparados(r.legalesSeparados)
    setFirmaInstitucional(r.firmaInstitucional ?? null)
    setIndicadores(r.indicadores)
    cerrarModalImportar()
  }

  const selectedBloque = canvas.find(b => b.instanceId === selectedId)
  const redesDetectadas = bandaHeader ? detectarRedesSociales(bandaHeader.html) : []

  // Inicializa redesOrden la primera vez que se carga un header con
  // redes reales — todas activas, en el orden en que aparecen en el
  // HTML original. Se vuelve a disparar cada vez que redesOrden se
  // resetea a null (cambio de header), no en cada render.
  useEffect(() => {
    if (redesOrden == null && redesDetectadas.length > 0) {
      setRedesOrden(redesDetectadas.map(key => ({ key, activa: true })))
    }
  }, [redesOrden, bandaHeader])

  const previewSrcdoc = showPreview
    ? `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#c8c8d0;border-radius:99px}</style></head><body style="margin:0;padding:0;">${generarExport({ bandaHeader, imgPrincipal, imgFooter, canvas, legalesAdicionales, legalesSeparados, firmaInstitucional, indicadores, tema, redesOrden })}</body></html>`
    : ''

  return (
    <div className="ep-root">

      {/* ── Barra superior — ancho completo, fuera de las 3 columnas ── */}
      <div className="ep-canvas-header">
        {/* Wrapper de ancho fijo — mismo ancho que ocupa ep-biblioteca
            (menos el padding lateral del header, que ep-biblioteca no
            tiene) para que el separador y el selector de Tema que
            siguen arranquen alineados justo donde empieza la columna
            del canvas, en vez de moverse según el largo del nombre. */}
        <div className="ep-nombre-pieza-wrap">
          {editandoNombre ? (
            <input ref={inputNombreRef} className="ep-nombre-pieza-input" autoComplete="off" value={nombre}
              onChange={e => setNombre(e.target.value)} onBlur={() => { if (!nombre.trim()) setNombre('Nueva pieza'); setEditandoNombre(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { if (!nombre.trim()) setNombre('Nueva pieza'); setEditandoNombre(false) } }} />
          ) : (
            <button className="ep-nombre-pieza-texto" onClick={() => setEditandoNombre(true)} title="Editar nombre">
              <span>{nombre}</span>
              <Pencil size={13} />
            </button>
          )}
        </div>

        <div className="ep-canvas-header-sep" />

        {/* Selector de Tema — antes era una segunda fila completa
            aparte ("Template" + pestañas grandes ICBC/Avisos/Mall);
            ahora es un botón compacto con dropdown, integrado en la
            misma fila que el nombre de la pieza, así toda la barra
            superior entra en una sola línea. */}
        <MenuDesplegable alinear="izquierda" popoverClassName="ep-menu-popover-tema" trigger={(toggle) => (
          <button className="ep-tema-selector" onClick={toggle}>
            <span className="ep-tema-selector-label">Tema</span>
            <span className="ep-tema-selector-swatch" style={{ background: TEMAS[tema].colorSwatch }} />
            <span className="ep-tema-selector-nombre">{TEMAS[tema].label}</span>
            <ChevronDown size={11} />
          </button>
        )}>
          {(cerrar) => (
            <>
              <div className="ep-menu-titulo">Tema visual</div>
              {Object.entries(TEMAS).map(([key, t]) => (
                <button key={key} className="ep-menu-item" onClick={() => { setTema(key); cerrar() }}>
                  <span className="ep-tema-selector-swatch" style={{ background: t.colorSwatch }} />
                  <span style={{ flex: 1 }}>{t.label}</span>
                  {tema === key && <Check size={14} className="ep-tema-check" />}
                </button>
              ))}
            </>
          )}
        </MenuDesplegable>

        <div className="ep-canvas-header-flex" />

        <div className="ep-canvas-actions">
          <button className="ep-btn ep-btn-ghost" onClick={() => setShowImportar(true)} title="Importar pieza desde HTML o link"><Link2 size={14} /> Importar</button>
          <button className="ep-btn ep-btn-ghost" onClick={() => setShowPreview(true)}><Eye size={14} /> Vista previa</button>

          {/* Exportar — split button: el botón principal descarga
              directo (acción más usada), la flecha abre el resto de
              las formas de exportación (copiar al portapapeles). */}
          <MenuDesplegable
            trigger={(toggle) => (
              <div className="ep-split-btn">
                <button className="ep-btn ep-btn-primary ep-split-btn-main" onClick={exportar}><Download size={14} /> Exportar HTML</button>
                <button className="ep-btn ep-btn-primary ep-split-btn-toggle" onClick={toggle} title="Más opciones de exportación"><ChevronDown size={13} /></button>
              </div>
            )}>
            {(cerrar) => (
              <>
                <div className="ep-menu-titulo">Exportación</div>
                <button className="ep-menu-item" onClick={() => { exportar(); cerrar() }}><Download size={14} /> Descargar .html</button>
                <button className="ep-menu-item" onClick={() => { copiar(); cerrar() }}>{copiado ? <ClipboardCheck size={14} /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar HTML al portapapeles'}</button>
              </>
            )}
          </MenuDesplegable>

          <button className="ep-btn ep-btn-ghost ep-btn-reiniciar" onClick={() => setShowConfirmReinicio(true)}><RotateCcw size={14} /> Reiniciar</button>
        </div>
      </div>

      <div className="ep-cuerpo">

      {/* ── Biblioteca ── */}
      <aside className="ep-biblioteca">
        <div className="ep-biblioteca-header">
          <span className="ep-biblioteca-titulo">Bloques disponibles</span>
          <input className="ep-search" autoComplete="off" placeholder="Buscar bloque…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          {/* Spacer — fila fija siempre visible (no dentro de una
              categoría colapsable ni escondido en un botón flotante):
              es de los elementos que más se usan al armar una pieza,
              así que queda a mano sin tener que buscarlo. Las 3
              opciones son arrastrables directo al canvas, mismo
              mecanismo de drag and drop que el resto de los bloques. */}
          {BLOQUE_ESPACIADOR && (
            <div className="ep-spacer-row">
              <span className="ep-spacer-row-label">Espaciador</span>
              <div className="ep-spacer-row-opciones">
                {[7, 14, 28].map(px => (
                  <button key={px} className="ep-spacer-chip-drag" draggable
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; setSpacerPxArrastrando(px) }}
                    onDragEnd={() => setSpacerPxArrastrando(null)}
                    title={`Arrastrá para ubicar un espaciador de ${px}px`}>
                    {px}px
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="ep-biblioteca-lista">

          {bloquesFiltradosHeader.length > 0 && (
            <CategoriaColapsable titulo="Header" count={bloquesFiltradosHeader.length}>
              {(() => {
                // Mismos colores que el selector de segmento de
                // Modulo_Doble_Con_Imagen_Punteada — así la pestaña activa
                // se identifica con el color real de cada marca.
                const GRUPOS_HEADER = [
                  { prefijo: 'CG', label: 'CG', color: '#c4161c' },
                  { prefijo: 'EB', label: 'EB', color: '#000000' },
                  { prefijo: 'Pay', label: 'Pay', color: '#635843' },
                ]
                const agrupados = GRUPOS_HEADER.map(g => ({
                  ...g,
                  bloques: bloquesFiltradosHeader.filter(b => b.slug.startsWith(g.prefijo + '_')),
                })).filter(g => g.bloques.length > 0)
                // Bloques que no matchean ningún prefijo conocido (por si se agregan nuevos)
                const prefijosConocidos = GRUPOS_HEADER.map(g => g.prefijo + '_')
                const sinGrupo = bloquesFiltradosHeader.filter(b => !prefijosConocidos.some(p => b.slug.startsWith(p)))
                // Si el grupo de la pestaña activa quedó vacío (por
                // búsqueda, por ejemplo), caemos al primer grupo que
                // sí tenga bloques para no mostrar una pestaña vacía.
                const grupoActivo = agrupados.find(g => g.prefijo === pestanaHeaderActiva) ?? agrupados[0] ?? null
                return (
                  <>
                    {agrupados.length > 1 && (
                      <SelectorPestanas
                        opciones={agrupados.map(g => ({ key: g.prefijo, label: g.label, color: g.color }))}
                        activa={grupoActivo?.prefijo}
                        onCambiar={setPestanaHeaderActiva}
                      />
                    )}
                    {grupoActivo?.bloques.map(bloque => (
                      <div key={bloque.id}
                        className={`ep-bloque-card ${draggingBibliotecaId === bloque.id ? 'dragging-source' : ''} ${bandaHeader?.id === bloque.id ? 'en-uso' : ''}`}
                        draggable onDragStart={e => onDragStartBiblioteca(e, bloque)} onDragEnd={() => setDraggingBibliotecaId(null)}>
                        <img src={generarThumbSVG(bloque)} alt={bloque.nombre} className="ep-bloque-thumb" />
                        <div className="ep-bloque-footer">
                          <span className="ep-bloque-nombre">{bloque.nombre}</span>
                          <button className="ep-bloque-add" onClick={() => { setBandaHeader(bloque); setRedesOrden(null) }}>
                            {bandaHeader?.id === bloque.id ? <Check size={12} /> : '+'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {sinGrupo.map(bloque => (
                      <div key={bloque.id}
                        className={`ep-bloque-card ${draggingBibliotecaId === bloque.id ? 'dragging-source' : ''} ${bandaHeader?.id === bloque.id ? 'en-uso' : ''}`}
                        draggable onDragStart={e => onDragStartBiblioteca(e, bloque)} onDragEnd={() => setDraggingBibliotecaId(null)}>
                        <img src={generarThumbSVG(bloque)} alt={bloque.nombre} className="ep-bloque-thumb" />
                        <div className="ep-bloque-footer">
                          <span className="ep-bloque-nombre">{bloque.nombre}</span>
                          <button className="ep-bloque-add" onClick={() => { setBandaHeader(bloque); setRedesOrden(null) }}>
                            {bandaHeader?.id === bloque.id ? <Check size={12} /> : '+'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )
              })()}
            </CategoriaColapsable>
          )}

          {(() => {
            const GRUPOS_CONTENIDO = [
              { label: 'Texto', slugs: ['Bloque_Texto_Base', 'Borde_Izq_Rojo_Texto'] },
              { label: 'Bullets', slugs: ['Bullet_Bull_Rojo', 'Bullet_Bull_Rojo_Margen', 'Bullet_Titular_Negro'] },
              { label: 'Módulos de imagen', slugs: ['Imagen_Libre', 'Modulo_Doble_Clasico', 'Modulo_Doble_Con_Imagen_Punteada'] },
              { label: 'Mix Texto + Imagen', slugs: ['Destacado_Icono_Texto', 'Icono_Separador_Rojo_Texto', 'Icono_Grande_Separador_Rojo_Texto', 'Destacado_Topes_Promo', 'Modulo_Canal_Feriado', 'CG_Modulo_Simple_Editable_PF', 'Destacado_GiftCard_BigBox'] },
              { label: 'Extras', slugs: ['Btn', 'Redes_Sociales_Invitaciones'] },
            ]
            return GRUPOS_CONTENIDO.map(g => {
              const bloques = g.slugs
                .map(slug => bloquesFiltradosContenido.find(b => b.slug === slug))
                .filter(Boolean)
              if (bloques.length === 0) return null
              return (
                <CategoriaColapsable key={g.label} titulo={g.label} count={bloques.length}>
                  {bloques.map(bloque => (
                    <div key={bloque.id}
                      className={`ep-bloque-card ${draggingBibliotecaId === bloque.id ? 'dragging-source' : ''}`}
                      draggable onDragStart={e => onDragStartBiblioteca(e, bloque)} onDragEnd={() => setDraggingBibliotecaId(null)}>
                      <img src={generarThumbSVG(bloque)} alt={bloque.nombre} className="ep-bloque-thumb" />
                      <div className="ep-bloque-footer">
                        <span className="ep-bloque-nombre">{bloque.nombre}</span>
                        <button className="ep-bloque-add" onClick={() => agregarAlCanvas(bloque)}>+</button>
                      </div>
                    </div>
                  ))}
                </CategoriaColapsable>
              )
            })
          })()}

          <CategoriaColapsable titulo="Personalizado">
            <div
              className={`ep-bloque-card ${arrastrandoCodigoPersonalizado ? 'dragging-source' : ''}`}
              style={{ cursor: 'pointer' }}
              draggable
              onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; setArrastrandoCodigoPersonalizado(true) }}
              onDragEnd={() => setArrastrandoCodigoPersonalizado(false)}
              onClick={agregarCodigo}
            >
              <div className="ep-bloque-thumb-placeholder"><Code size={18} /><span>HTML libre</span></div>
              <div className="ep-bloque-footer">
                <span className="ep-bloque-nombre">Código personalizado</span>
                <button className="ep-bloque-add" onClick={e => { e.stopPropagation(); agregarCodigo() }}>+</button>
              </div>
            </div>
          </CategoriaColapsable>
        </div>
      </aside>

      {/* ── Canvas ── */}
      <main className="ep-canvas-wrap">
        <div className="ep-canvas-body">

          {/* Banda Header — seleccionable igual que cualquier bloque del
              canvas (click abre su edición en el panel derecho, mismo
              patrón que PanelEditor para bloques normales). 'HEADER' es
              un id reservado: bandaHeader no vive en el array canvas,
              así que no puede compartir instanceId con nada real ahí. */}
          <div className={`ep-zona-fija ${dragOverHeader ? 'drag-over-header' : ''} ${selectedId === 'HEADER' ? 'selected' : ''}`}
            onClick={() => bandaHeader && setSelectedId('HEADER')}
            onDragOver={e => { e.preventDefault(); const b = BLOQUES.find(x => x.id === draggingBibliotecaId); if (b?.categoria === 'Header') setDragOverHeader(true) }}
            onDragLeave={() => setDragOverHeader(false)} onDrop={onDropHeader}>
            <div className="ep-zona-fija-header">
              <span className="ep-zona-fija-label"><Layout size={12} /> Banda Header</span>
              <span className="ep-zona-fija-badge">{bandaHeader?.nombre || 'Sin seleccionar'}</span>
            </div>
            {bandaHeader
              ? (
                <div className="ep-zona-fija-preview-wrap">
                  <AutoIframe className="ep-zona-fija-preview" srcDoc={wrapPreview(reordenarRedesSociales(bandaHeader.html, redesOrden), true)} title="Banda header" />
                  {/* Overlay transparente — un <iframe> tiene su propio
                      documento interno, y los eventos dragover/drop del
                      navegador se entregan a ESE documento cuando el
                      mouse está encima, no al documento padre de React.
                      Sin esta capa, soltar un bloque de Header sobre el
                      preview ya cargado no funcionaba (solo se podía
                      soltar sobre ep-zona-fija-header, que es texto
                      plano sin iframe de por medio). El overlay
                      reenvía los mismos handlers que ya tiene el
                      contenedor padre, así el comportamiento es
                      idéntico en toda la zona; también es la capa que
                      recibe el click de selección, ya que el iframe
                      tampoco entrega clicks normales al padre. */}
                  <div className="ep-zona-fija-preview-overlay"
                    onClick={() => setSelectedId('HEADER')}
                    onDragOver={e => { e.preventDefault(); const b = BLOQUES.find(x => x.id === draggingBibliotecaId); if (b?.categoria === 'Header') setDragOverHeader(true) }}
                    onDragLeave={() => setDragOverHeader(false)} onDrop={onDropHeader} />
                </div>
              )
              : <div className="ep-zona-drop-empty">Arrastrá un bloque de Header acá</div>}
          </div>

          {/* Imagen principal */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label"><Image size={12} /> Imagen principal</span>
              <button className={`ep-toggle-btn ${imgPrincipal.activo ? 'activo' : ''}`}
                onClick={() => setImgPrincipal(p => ({ ...p, activo: !p.activo }))}>
                {imgPrincipal.activo ? 'Incluida' : 'No incluida'}
              </button>
            </div>
            {imgPrincipal.activo && (
              <div className="ep-zona-toggle-body">
                <label className="ep-img-label">URL (600px de ancho)</label>
                <input className="ep-img-input" autoComplete="off" placeholder="https://cdn.ejemplo.com/imagen.png"
                  value={imgPrincipal.src} onChange={e => setImgPrincipal(p => ({ ...p, src: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Alt</label>
                <input className="ep-img-input" autoComplete="off" placeholder="Texto alternativo"
                  value={imgPrincipal.alt} onChange={e => setImgPrincipal(p => ({ ...p, alt: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Title</label>
                <input className="ep-img-input" autoComplete="off" placeholder="Título de la imagen"
                  value={imgPrincipal.title || ''} onChange={e => setImgPrincipal(p => ({ ...p, title: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Link (opcional)</label>
                <input className="ep-img-input" autoComplete="off" placeholder="https://... (dejar vacío si no tiene link)"
                  value={imgPrincipal.link || ''} onChange={e => setImgPrincipal(p => ({ ...p, link: e.target.value }))} />
                {imgPrincipal.src && (
                  <div style={{ marginTop: 8, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={imgPrincipal.src} alt={imgPrincipal.alt || ''} style={{ width: '100%', height: 'auto', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('imgPrincipal')} disabled={confirmando.imgPrincipal}>
                    {confirmando.imgPrincipal ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.imgPrincipal ? 'Confirmando…' : 'Confirmar imagen'}
                  </button>
                  <button className="ep-btn ep-btn-ghost" style={{ flex: 0 }} onClick={() => setImgPrincipal({ activo: true, src: '', alt: '', title: '', link: '' })} title="Reiniciar">
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Zona de contenido */}
          <div className="ep-zona-contenido">
            <div className="ep-zona-contenido-header">
              <span className="ep-zona-contenido-label"><FileText size={12} /> Contenido de la pieza</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{canvas.length} bloque{canvas.length !== 1 ? 's' : ''}</span>
            </div>
            <div className={`ep-zona-drop ${dragOverZona && !dragOverId ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); if (draggingBibliotecaId || spacerPxArrastrando != null || arrastrandoCodigoPersonalizado) setDragOverZona(true) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverZona(false) }}
              onDrop={e => { if (!dragOverId) onDropZona(e) }}>
              {canvas.length === 0 && <div className="ep-zona-drop-empty">Arrastrá bloques desde la biblioteca o usá el botón +</div>}
              {canvas.map(bloque => (
                <div key={bloque.instanceId}
                  className={`ep-canvas-bloque ${selectedId === bloque.instanceId ? 'selected' : ''} ${dragOverId?.id === bloque.instanceId ? `drag-over-bloque drag-over-${dragOverId.posicion}` : ''}`}
                  onClick={() => setSelectedId(bloque.instanceId)}
                  draggable
                  onDragStart={e => onDragStartCanvas(e, bloque.instanceId)}
                  onDragEnd={() => { setDraggingCanvasId(null); setDragOverId(null) }}
                  onDragOver={e => onDragOverBloque(e, bloque.instanceId)}
                  onDrop={e => onDropBloque(e, bloque.instanceId)}>
                  <div className="ep-canvas-bloque-handle"><GripVertical size={14} /></div>
                  <div className="ep-canvas-bloque-body">
                    <div className="ep-canvas-bloque-nombre">{bloque.nombre}</div>
                    <AutoIframe className="ep-canvas-bloque-iframe"
                      srcDoc={wrapPreview(bloque.htmlEditado || bloque.html)} title={bloque.nombre} />
                  </div>
                  <div className="ep-canvas-bloque-actions">
                    {bloque.slug !== 'Espaciador' && (
                      <button className="ep-canvas-bloque-espaciador" title="Agregar espaciador debajo"
                        onClick={e => { e.stopPropagation(); agregarEspaciadorDespues(bloque.instanceId) }}>
                        <Plus size={11} />
                      </button>
                    )}
                    <button className="ep-canvas-bloque-del"
                      onClick={e => { e.stopPropagation(); eliminarBloque(bloque.instanceId) }} title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Imagen footer */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label"><Image size={12} /> Imagen footer</span>
              <button className={`ep-toggle-btn ${imgFooter.activo ? 'activo' : ''}`}
                onClick={() => setImgFooter(p => ({ ...p, activo: !p.activo }))}>
                {imgFooter.activo ? 'Incluida' : 'No incluida'}
              </button>
            </div>
            {imgFooter.activo && (
              <div className="ep-zona-toggle-body">
                <label className="ep-img-label">URL de la imagen</label>
                <input className="ep-img-input" autoComplete="off" placeholder="https://cdn.ejemplo.com/footer.gif"
                  value={imgFooter.src} onChange={e => setImgFooter(p => ({ ...p, src: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Alt</label>
                <input className="ep-img-input" autoComplete="off" placeholder="Texto alternativo"
                  value={imgFooter.alt} onChange={e => setImgFooter(p => ({ ...p, alt: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Title</label>
                <input className="ep-img-input" autoComplete="off" placeholder="Título de la imagen"
                  value={imgFooter.title || ''} onChange={e => setImgFooter(p => ({ ...p, title: e.target.value }))} />
                <label className="ep-img-label" style={{ marginTop: 4 }}>Link (opcional)</label>
                <input className="ep-img-input" placeholder="https://... (dejar vacío si no tiene link)" autoComplete="off"
                  value={imgFooter.link} onChange={e => setImgFooter(p => ({ ...p, link: e.target.value }))} />
                {imgFooter.src && (
                  <div style={{ marginTop: 8, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={imgFooter.src} alt={imgFooter.alt || ''} style={{ width: '100%', height: 'auto', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('imgFooter')} disabled={confirmando.imgFooter}>
                    {confirmando.imgFooter ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.imgFooter ? 'Confirmando…' : 'Confirmar imagen'}
                  </button>
                  <button className="ep-btn ep-btn-ghost" style={{ flex: 0 }} onClick={() => setImgFooter({ activo: true, src: '', alt: '', title: '', link: '' })} title="Reiniciar">
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Legales adicionales */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label"><FileText size={12} /> Legales adicionales</span>
              <button className={`ep-toggle-btn ${legalesAdicionales.length > 0 ? 'activo' : ''}`} onClick={agregarLegalAdicional}>+ Agregar</button>
            </div>
            {legalesAdicionales.length > 0 && (
              <div className="ep-zona-toggle-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Default: texto corrido (igual que siempre). Activar
                    esto solo tiene sentido si se van a sumar varios
                    legales largos — separa cada uno en su propia
                    sección con un espacio entre cada una, para que
                    algunos proveedores de correo no detecten un bloque
                    de texto muy largo como sospechoso. */}
                <label className="ep-legales-separar-toggle">
                  <input type="checkbox" checked={legalesSeparados} onChange={e => setLegalesSeparados(e.target.checked)} />
                  <span>Separar cada legal en su propia sección</span>
                </label>
                <p className="ep-legales-hint">
                  {legalesSeparados
                    ? 'Cada legal va en su propia sección, separado por un espacio — recomendado solo si los textos son largos.'
                    : 'Los legales se concatenan seguidos, como texto corrido (comportamiento normal).'}
                </p>
                {legalesAdicionales.map((legal, i) => (
                  <div key={legal.id} className="ep-legal-adicional-item">
                    <div className="ep-legal-adicional-header">
                      <span className="ep-legal-adicional-label">Legal {i + 1}</span>
                      <button onClick={() => eliminarLegalAdicional(legal.id)} className="ep-legal-adicional-eliminar" title="Eliminar este legal">
                        <X size={14} />
                      </button>
                    </div>
                    <RichEditor key={`legal-${legal.id}`} value={legal.texto} onChange={v => actualizarLegalAdicional(legal.id, v)} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('legal')} disabled={confirmando.legal}>
                    {confirmando.legal ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.legal ? 'Confirmando…' : 'Confirmar legales'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Legal fijo — con estilos reales */}
          <div className="ep-zona-fija">
            <div className="ep-zona-fija-header">
              <span className="ep-zona-fija-label"><Lock size={12} /> Legal genérico</span>
              <span className="ep-zona-fija-badge ep-zona-fija-badge-lock"><Lock size={9} /> Siempre presente</span>
            </div>
            <div style={{
              padding: '0.625rem 0.875rem', background: '#fff',
              fontFamily: 'Arial, Helvetica, Open Sans, sans-serif',
              fontSize: 14, fontWeight: 'bold', lineHeight: '16px',
              color: '#333333', textAlign: 'justify', wordBreak: 'break-word',
              maxHeight: 120, overflowY: 'auto'
            }} dangerouslySetInnerHTML={{ __html: LEGAL_FIJO_HTML }} />
          </div>

          {/* Firma institucional (ICBC Investments / Sociedad Gerente-
              Depositaria) — estructura FIJA de 2 filas x 2 columnas,
              a diferencia de Legales adicionales/Indicadores (listas
              abiertas). Se activa/desactiva entera con un solo toggle;
              una vez activa, los 4 textos quedan editables por si el
              texto institucional cambia, pero no se pueden agregar o
              quitar filas/columnas — eso es intencional, ver
              FIRMA_INSTITUCIONAL_DEFAULT. Va siempre después del legal
              fijo y antes de los indicadores financieros. */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label"><FileText size={12} /> Firma institucional</span>
              <button className={`ep-toggle-btn ${firmaInstitucional ? 'activo' : ''}`} onClick={toggleFirmaInstitucional}>
                {firmaInstitucional ? 'Quitar' : '+ Agregar'}
              </button>
            </div>
            {firmaInstitucional && (
              <div className="ep-zona-toggle-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p className="ep-legales-hint">ICBC Investments / Sociedad Gerente-Depositaria — 2 filas fijas, izquierda y derecha.</p>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={firmaInstitucional.fila1Izq}
                    placeholder="ICBC Investments SAU SGFCI" onChange={e => actualizarFirmaInstitucional('fila1Izq', e.target.value)} />
                  <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={firmaInstitucional.fila1Der}
                    placeholder="Industrial and Commercial Bank of China (Argentina) SAU" onChange={e => actualizarFirmaInstitucional('fila1Der', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={firmaInstitucional.fila2Izq}
                    placeholder="Sociedad Gerente" onChange={e => actualizarFirmaInstitucional('fila2Izq', e.target.value)} />
                  <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={firmaInstitucional.fila2Der}
                    placeholder="Sociedad Depositaria" onChange={e => actualizarFirmaInstitucional('fila2Der', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('firmaInstitucional')} disabled={confirmando.firmaInstitucional}>
                    {confirmando.firmaInstitucional ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.firmaInstitucional ? 'Confirmando…' : 'Confirmar firma'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Indicadores financieros */}
          <div className="ep-zona-toggle">
            <div className="ep-zona-toggle-header">
              <span className="ep-zona-toggle-label">Indicadores financieros</span>
              <button className={`ep-toggle-btn ${indicadores.length > 0 ? 'activo' : ''}`} onClick={agregarIndicador}>+ Agregar</button>
            </div>
            {indicadores.length > 0 && (
              <div className="ep-zona-toggle-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {indicadores.map(ind => (
                  <div key={ind.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input className="ep-img-input" autoComplete="off" style={{ width: 52, flexShrink: 0 }} value={ind.ref} placeholder="(*)"
                      onChange={e => actualizarIndicador(ind.id, 'ref', e.target.value)} title="Referencia" />
                    <input className="ep-img-input" autoComplete="off" style={{ width: 80, flexShrink: 0 }} value={ind.sigla} placeholder="CFTNA"
                      onChange={e => actualizarIndicador(ind.id, 'sigla', e.target.value)} />
                    <input className="ep-img-input" autoComplete="off" style={{ flex: 1 }} value={ind.valor} placeholder="0,00%"
                      onChange={e => actualizarIndicador(ind.id, 'valor', e.target.value)} />
                    <button onClick={() => eliminarIndicador(ind.id)}
                      style={{ flexShrink: 0, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button className="ep-btn ep-btn-primary ep-btn-aplicar" style={{ flex: 1 }} onClick={() => confirmarSeccion('indicadores')} disabled={confirmando.indicadores}>
                    {confirmando.indicadores ? <Loader2 size={14} className="ep-spin" /> : <Check size={14} />}
                    {confirmando.indicadores ? 'Confirmando…' : 'Confirmar indicadores'}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── Panel editor ── */}
      <aside className="ep-editor">
        <div className="ep-editor-header">
          <span className="ep-editor-titulo">Panel de edición</span>
        </div>
        {/* Context card — antes lo único que indicaba qué bloque estabas
            editando era un nombre chico al lado del título "Panel de
            edición", fácil de pasar por alto. Ahora hay una tarjeta
            destacada con la miniatura real del bloque, su nombre, y un
            badge con la categoría — así queda claro de un vistazo qué
            estás editando antes de mirar el formulario de abajo. */}
        {(selectedId === 'HEADER' ? bandaHeader : selectedBloque) && (
          <ContextCardEditor bloque={selectedId === 'HEADER' ? bandaHeader : selectedBloque} />
        )}
        {selectedId === 'HEADER'
          ? <PanelEditorHeader bandaHeader={bandaHeader} redesOrden={redesOrden} onToggle={toggleRedActiva} onReordenar={reordenarPillRed} />
          : !selectedBloque
            ? <div className="ep-editor-empty"><FileText size={28} style={{ color: 'var(--border)' }} /><span>Seleccioná un bloque del canvas para editar su contenido</span></div>
            : <PanelEditor key={`${selectedBloque.instanceId}-${selectedBloque.slug}`} bloque={selectedBloque} onActualizar={actualizarBloque} onSwap={swapBloque} onActualizarEstilos={actualizarEstilosBloque} />}
      </aside>

      </div>

      {/* ── Modal preview ── */}
      {showPreview && (
        <div className="ep-preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="ep-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="ep-preview-header">
              <div className="ep-preview-titulo-wrap">
                <span className="ep-preview-titulo">Vista previa</span>
                <span className="ep-preview-subtitulo">{nombre}</span>
              </div>
              <div className="ep-tabs ep-preview-modo-tabs">
                <button className={previewModo === 'desktop' ? 'active' : ''} onClick={() => setPreviewModo('desktop')}>Desktop</button>
                <button className={previewModo === 'mobile' ? 'active' : ''} onClick={() => setPreviewModo('mobile')}>Mobile</button>
              </div>
              <button className="ep-preview-close" onClick={() => setShowPreview(false)}><X size={16} /></button>
            </div>
            <div className={`ep-preview-iframe-wrap ${previewModo === 'mobile' ? 'modo-mobile' : ''}`}>
              {previewModo === 'desktop'
                ? <AutoIframe className="ep-preview-iframe" srcDoc={previewSrcdoc} title="Vista previa completa" />
                : <iframe className="ep-preview-iframe" srcDoc={previewSrcdoc} title="Vista previa completa" style={{ width: '375px' }} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal importar ── */}
      {showImportar && (
        <div className="ep-preview-overlay" onClick={cerrarModalImportar}>
          <div className={`ep-importar-modal ${importarResultado?.resultado ? 'ep-importar-modal-ancho' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="ep-preview-header">
              <div className="ep-preview-titulo-wrap">
                <span className="ep-preview-titulo">Importar pieza</span>
                <span className="ep-preview-subtitulo">
                  {importarCargando
                    ? 'Procesando la estructura de la pieza…'
                    : !importarResultado ? 'Pegá el HTML o ingresá el link de la pieza' : 'Revisá el resultado antes de cargarlo'}
                </span>
              </div>
              {/* Switch Desktop/Mobile — mismo patrón que el modal de
                  Vista previa, pero con clases propias del modal de
                  importar. Solo tiene sentido mostrarlo una vez que
                  hay algo renderizado para previsualizar (resultado
                  con datos reales), no durante el paso de entrada ni
                  cuando resultado es null. */}
              {importarResultado?.resultado && (
                <div className="ep-importar-tabs ep-importar-modo-tabs">
                  <button className={importarModoPreview === 'desktop' ? 'active' : ''} onClick={() => setImportarModoPreview('desktop')}>Desktop</button>
                  <button className={importarModoPreview === 'mobile' ? 'active' : ''} onClick={() => setImportarModoPreview('mobile')}>Mobile</button>
                </div>
              )}
              <button className="ep-preview-close" onClick={cerrarModalImportar}><X size={16} /></button>
            </div>

            {/* Paso 1: entrada — tabs HTML/URL, mismo patrón que
                Revisión de envíos. Se reemplaza por el resumen en
                cuanto hay un resultado analizado. */}
            {!importarResultado && !importarCargando && (
              <div className="ep-importar-body">
                <div className="ep-importar-tabs">
                  <button className={importarModo === 'html' ? 'active' : ''} onClick={() => { setImportarModo('html'); setImportarError('') }}>HTML</button>
                  <button className={importarModo === 'url' ? 'active' : ''} onClick={() => { setImportarModo('url'); setImportarError('') }}>URL</button>
                </div>

                {importarModo === 'html' ? (
                  <textarea
                    className="ep-importar-input"
                    autoComplete="off"
                    placeholder="Pegá acá el HTML completo de la pieza…"
                    rows={10}
                    value={importarHtmlInput}
                    onChange={e => setImportarHtmlInput(e.target.value)}
                  />
                ) : (
                  <input
                    className="ep-importar-input ep-importar-input-url"
                    autoComplete="off"
                    placeholder="https://icbc-info.icommarketing.com/…"
                    value={importarUrlInput}
                    onChange={e => setImportarUrlInput(e.target.value)}
                  />
                )}

                {importarError && <div className="ep-importar-error">{importarError}</div>}

                <div className="ep-importar-footer">
                  <button className="ep-btn ep-btn-ghost" onClick={cerrarModalImportar}>Cancelar</button>
                  <button className="ep-btn ep-btn-primary" onClick={analizarImportacion}>Analizar</button>
                </div>
              </div>
            )}

            {/* Paso 2: analizando — mismo patrón de barra de progreso
                que ya usa Revisión de BBDD (.rb-processing en
                RevisionBase.css), clonado con clase propia
                (.ep-importar-processing) para que este editor siga
                sin depender implícitamente del CSS de otra
                herramienta — mismo criterio que .ep-tabs más arriba
                en este archivo. El porcentaje es una animación de
                avance (el análisis real es síncrono y no tiene etapas
                medibles con precisión), pero la etapa que muestra
                abajo SÍ es real: primero intenta vía marcadores, y
                solo pasa a vía heurística si la primera no encuentra
                nada. */}
            {importarCargando && !importarResultado && (
              <div className="ep-importar-body">
                <div className="ep-importar-processing">
                  <div className="ep-importar-processing-top">
                    <div className="ep-importar-processing-label">Analizando la pieza…</div>
                    <div className="ep-importar-processing-pct">{Math.round(importarProgreso)}%</div>
                  </div>
                  <div className="ep-importar-progress-track"><div className="ep-importar-progress-fill" style={{ width: `${importarProgreso}%` }} /></div>
                  <div className="ep-importar-processing-note">
                    {importarEtapa === 'marcadores'
                      ? 'Buscando marcadores de bloque del editor…'
                      : 'No se encontraron marcadores — analizando la estructura por heurística…'}
                  </div>
                </div>
              </div>
            )}

            {/* Paso 2/3: resumen + preview del resultado ya analizado.
                confianza 'baja' o resultado null nunca se muestran
                como un resultado parcial silencioso — el aviso queda
                arriba de todo, bien visible, y el botón final cambia
                de texto para dejar explícito que cargar igual no es
                lo recomendado. */}
            {importarResultado && (
              <>
                <div className="ep-importar-body ep-importar-body-resultado">
                  {!importarResultado.resultado ? (
                    <div className="ep-importar-aviso ep-importar-aviso-baja" style={{ margin: '1.25rem' }}>
                      <AlertCircle size={16} />
                      <span>{importarResultado.avisos?.[0]?.texto || 'No se pudo reconocer la estructura de esta pieza.'}</span>
                    </div>
                  ) : (
                    <div className="ep-importar-resultado-cols">
                      {/* Columna izquierda — confianza, métricas y avisos */}
                      <div className="ep-importar-resultado-izq">
                        <div className={`ep-importar-badge-confianza ep-importar-confianza-${importarResultado.confianza}`}>
                          <span className="ep-importar-badge-icono">
                            {importarResultado.viaMarcadores || importarResultado.confianza === 'alta' ? <Check size={16} /> : <AlertCircle size={16} />}
                          </span>
                          <div>
                            <div className="ep-importar-badge-titulo">
                              {importarResultado.viaMarcadores
                                ? 'Pieza reconocida por marcadores'
                                : importarResultado.confianza === 'alta'
                                  ? 'Confianza alta'
                                  : importarResultado.confianza === 'media'
                                    ? 'Confianza media'
                                    : 'Confianza baja'}
                            </div>
                            <div className="ep-importar-badge-subtitulo">
                              {importarResultado.viaMarcadores
                                ? 'Exportada por este mismo editor'
                                : importarResultado.confianza === 'alta'
                                  ? 'Reconstruida por heurística, alta certeza'
                                  : importarResultado.confianza === 'media'
                                    ? 'Reconstruida por heurística — revisá el resultado'
                                    : 'No se pudo reconocer con seguridad'}
                            </div>
                          </div>
                        </div>

                        <div className="ep-importar-metricas">
                          <div className="ep-importar-metrica">
                            <span className="ep-importar-metrica-valor">{importarResultado.resultado.canvas.length}</span>
                            <span className="ep-importar-metrica-label">Bloques</span>
                          </div>
                          <div className="ep-importar-metrica">
                            <span className="ep-importar-metrica-valor">{importarResultado.avisos?.length ?? 0}</span>
                            <span className="ep-importar-metrica-label">Avisos</span>
                          </div>
                          <div className="ep-importar-metrica">
                            <span className="ep-importar-metrica-valor ep-importar-metrica-valor-tema">{TEMAS[importarResultado.resultado.tema]?.label ?? 'ICBC'}</span>
                            <span className="ep-importar-metrica-label">Tema</span>
                          </div>
                        </div>

                        {importarResultado.avisos?.length > 0 && (
                          <>
                            <span className="ep-importar-avisos-titulo">Avisos del análisis</span>
                            <ul className="ep-importar-avisos-lista">
                              {importarResultado.avisos.map((a, i) => {
                                const { titulo, detalle } = tituloYDetalleDeAviso(a)
                                const { Icono, color } = AVISO_ICONO_POR_TIPO[a.tipo] ?? AVISO_ICONO_POR_TIPO.general
                                const esClickeable = a.canvasIdx != null || a.tipo === 'obsoleto'
                                function onClickAviso() {
                                  setAvisoActivo(i)
                                  if (a.canvasIdx != null) irABloqueEnPreview(a.canvasIdx)
                                  else if (a.tipo === 'obsoleto') irAObsoletoEnPreview()
                                }
                                return (
                                  <li
                                    key={i}
                                    className={`ep-importar-aviso-card ${avisoActivo === i ? 'activo' : ''}`}
                                    data-tipo={a.canvasIdx != null ? a.tipo : a.tipo === 'obsoleto' ? 'obsoleto' : undefined}
                                    onClick={esClickeable ? onClickAviso : undefined}
                                    title={esClickeable ? 'Ver en el preview' : undefined}
                                    style={a.tipo === 'obsoleto' ? { cursor: 'pointer' } : undefined}
                                  >
                                    <span className="ep-importar-aviso-icono" style={color ? { background: color, color: '#fff' } : undefined}>
                                      <Icono size={15} />
                                    </span>
                                    <div className="ep-importar-aviso-texto">
                                      <div className="ep-importar-aviso-titulo">{titulo}</div>
                                      {detalle && <div className="ep-importar-aviso-detalle">{detalle}</div>}
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          </>
                        )}
                      </div>

                      {/* Columna derecha — preview en vivo del resultado */}
                      <div className="ep-importar-resultado-der">
                        {(() => {
                          // El overlay (outline punteado + etiqueta "No
                          // reconocido") solo se inyecta en ESTE preview de
                          // importación, nunca en el HTML real que termina
                          // en el canvas — generarExport en sí queda
                          // intacto, marcarBloquesNoReconocidosParaPreview
                          // es un post-proceso aparte sobre el resultado.
                          //
                          // redesOrden: bug real reportado — este preview
                          // usaba `redesOrden: null` a propósito (forzado),
                          // lo cual hacía que reordenarRedesSociales usara
                          // el header TAL CUAL viene (con todas sus redes
                          // del template) — pero el canvas real, al
                          // confirmar la importación, sí usa el
                          // redesOrden REAL detectado de la pieza
                          // (puede ser []). Resultado: el preview mostraba
                          // redes que después desaparecían al confirmar,
                          // muy confuso. Ahora el preview usa el mismo
                          // redesOrden real que se va a aplicar de verdad.
                          const srcDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@keyframes ep-preview-pulso { 0%, 100% { box-shadow: none; } 50% { box-shadow: inset 0 0 0 9999px rgba(0,0,0,0.06); } }</style></head><body style="margin:0;padding:0;">${marcarEstructurasObsoletasParaPreview(marcarBloquesNoReconocidosParaPreview(generarExport({ ...importarResultado.resultado, redesOrden: importarResultado.resultado.redesOrden ?? [] })))}</body></html>`
                          return (
                            <div className={`ep-importar-preview-wrap ${importarModoPreview === 'mobile' ? 'modo-mobile' : ''}`}>
                              <AutoIframe ref={previewIframeRef} className="ep-importar-preview-iframe" title="Preview de la pieza importada" srcDoc={srcDoc} width={importarModoPreview === 'mobile' ? 375 : undefined} />
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="ep-importar-footer-wrap">
                  {importarError && <div className="ep-importar-error">{importarError}</div>}
                  <div className="ep-importar-footer">
                    <button className="ep-btn ep-btn-ghost" onClick={() => { setImportarResultado(null); setAvisoActivo(null) }}>Volver</button>
                    <button
                      className={`ep-btn ${importarResultado.confianza === 'baja' || !importarResultado.resultado ? 'ep-btn-ghost' : 'ep-btn-primary'}`}
                      onClick={confirmarImportacion}
                      disabled={!importarResultado.resultado}
                    >
                      {importarResultado.confianza === 'baja' ? 'Cargar igual (no recomendado)' : 'Cargar en el editor'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={showConfirmReinicio}
        variant="warning"
        title="¿Reiniciar la pieza?"
        message="Se van a eliminar todos los bloques, imágenes, legales e indicadores que cargaste. El borrador guardado también se va a borrar. Esta acción no se puede deshacer."
        confirmLabel="Sí, reiniciar"
        cancelLabel="Cancelar"
        onConfirm={() => { nuevaPieza(); setShowConfirmReinicio(false) }}
        onCancel={() => setShowConfirmReinicio(false)}
      />
    </div>
  )
}
