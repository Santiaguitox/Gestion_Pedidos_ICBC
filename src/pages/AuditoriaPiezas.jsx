import { useState, useRef, useEffect, useMemo } from 'react'
import {
  ScanSearch, Plus, X, RotateCcw, AlertTriangle, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, ExternalLink, Download, Type, Link2, Image as ImageIcon,
  Star, Table2, ClipboardList,
} from 'lucide-react'
import {
  parsearPiezasSimple, parsearTabla, construirPiezasDesdeTabla,
  nuevaRegla, reglaEsValida, ejecutarAuditoria,
  generarReporteTexto, generarReporteCsv, descargarArchivo, TIPOS_REGLA,
} from '@/lib/auditoria/ejecutarAuditoria'
import '@/styles/AuditoriaPiezas.css'

const PLACEHOLDER_PIEZAS_SIMPLE = `Cumple CG | https://icbc-info.icommarketing.com/pieza-1
Bienvenida EB, https://icbc-info.icommarketing.com/pieza-2
https://icbc-avisos-ai.icommarketing.com/pieza-3`

const PLACEHOLDER_TABLA = `Pegá acá la tabla copiada directo de Excel o Google Sheets (con encabezados en la primera fila)…`

const ICONO_TIPO = { texto: Type, link: Link2, imagen: ImageIcon }

// Mismo patrón de auto-resize que RevisionEnvios — el textarea crece
// con el contenido en vez de quedar fijo con scroll interno.
function useAutoResize(value, maxHeightPx = 200) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const needed = el.scrollHeight
    el.style.height = `${Math.min(needed, maxHeightPx)}px`
  }, [value, maxHeightPx])
  return ref
}

// ============================================================================
// Reglas de búsqueda (sin cambios respecto a la v1)
// ============================================================================

function FilaRegla({ regla, onChange, onEliminar, puedeEliminar }) {
  const Icono = ICONO_TIPO[regla.tipo]
  return (
    <div className="ap-regla-fila">
      <select
        className="ap-regla-tipo"
        value={regla.tipo}
        onChange={e => onChange({ ...regla, tipo: e.target.value })}
      >
        {Object.entries(TIPOS_REGLA).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <div className="ap-regla-valor-wrap">
        <Icono size={14} className="ap-regla-valor-icon" />
        <input
          type="text"
          className="ap-regla-valor"
          placeholder={
            regla.tipo === 'texto' ? 'Ej: ICBC Access Banking' :
            regla.tipo === 'link' ? 'Ej: /app-icbc-old' :
            'Ej: icono-viejo.png'
          }
          value={regla.valor}
          onChange={e => onChange({ ...regla, valor: e.target.value })}
        />
      </div>
      {regla.tipo === 'texto' && (
        <button
          type="button"
          className={`ap-toggle-aa${regla.ignorarMayus ? ' active' : ''}`}
          title="Ignorar mayúsculas/minúsculas"
          onClick={() => onChange({ ...regla, ignorarMayus: !regla.ignorarMayus })}
        >
          Aa
        </button>
      )}
      <button
        type="button"
        className="ap-regla-eliminar"
        onClick={onEliminar}
        disabled={!puedeEliminar}
        title="Eliminar regla"
      >
        <X size={15} />
      </button>
    </div>
  )
}

// ============================================================================
// Modo "Pegar tabla" — pegado + selección de columnas
// ============================================================================

// Chip toggle de columna para el multi-select de "identificador". Si
// está seleccionada, muestra además la estrellita para marcarla como
// principal.
function ChipColumna({ header, idx, seleccionada, esPrincipal, onToggle, onMarcarPrincipal }) {
  return (
    <div className={`ap-chip-columna${seleccionada ? ' seleccionada' : ''}`}>
      <button type="button" className="ap-chip-columna-toggle" onClick={() => onToggle(idx)}>
        {header || `Columna ${idx + 1}`}
      </button>
      {seleccionada && (
        <button
          type="button"
          className={`ap-chip-columna-estrella${esPrincipal ? ' activa' : ''}`}
          title={esPrincipal ? 'Identificador principal' : 'Marcar como identificador principal'}
          onClick={() => onMarcarPrincipal(idx)}
        >
          <Star size={12} fill={esPrincipal ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  )
}

function SelectorTabla({ textoTabla, setTextoTabla, seleccion, setSeleccion }) {
  const tablaRef = useAutoResize(textoTabla, 150)
  const { headers, filas, tieneHeaders } = useMemo(() => parsearTabla(textoTabla), [textoTabla])

  function toggleColumnaNombre(idx) {
    setSeleccion(s => {
      const yaEsta = s.columnasNombre.includes(idx)
      const columnasNombre = yaEsta ? s.columnasNombre.filter(c => c !== idx) : [...s.columnasNombre, idx]
      // Si se deselecciona la que era principal, la principal pasa a ser
      // la primera que quede (o null si no queda ninguna).
      const columnaPrincipal = columnasNombre.includes(s.columnaPrincipal) ? s.columnaPrincipal : (columnasNombre[0] ?? null)
      return { ...s, columnasNombre, columnaPrincipal }
    })
  }

  function marcarPrincipal(idx) {
    setSeleccion(s => ({ ...s, columnaPrincipal: idx }))
  }

  function setColumnaLink(idx) {
    setSeleccion(s => ({ ...s, columnaLink: idx === '' ? null : Number(idx) }))
  }

  const piezasPreview = useMemo(() => {
    if (!tieneHeaders || seleccion.columnaLink == null) return []
    return construirPiezasDesdeTabla({ headers, filas }, seleccion)
  }, [headers, filas, tieneHeaders, seleccion])

  return (
    <>
      <textarea
        ref={tablaRef}
        className="ap-textarea ap-textarea-tabla"
        placeholder={PLACEHOLDER_TABLA}
        value={textoTabla}
        onChange={e => setTextoTabla(e.target.value)}
      />
      <p className="ap-hint">
        Copiá el rango directo de Excel o Google Sheets (Ctrl+C) e pegalo acá — se detectan las columnas automáticamente por la primera fila.
      </p>

      {textoTabla.trim() !== '' && !tieneHeaders && (
        <div className="ap-aviso-tabla">
          <AlertTriangle size={14} />
          No se detectó una fila de encabezados. Asegurate de incluir los títulos de columna (ENVIO, LINK, etc.) en la primera línea pegada.
        </div>
      )}

      {tieneHeaders && (
        <div className="ap-selector-columnas">
          <div className="ap-selector-bloque">
            <span className="ap-selector-titulo">
              Columnas para identificar la pieza
              <span className="ap-selector-subtitulo">tocá la estrella para elegir cuál usar como título principal</span>
            </span>
            <div className="ap-chips-columnas">
              {headers.map((h, idx) => (
                <ChipColumna
                  key={idx}
                  header={h}
                  idx={idx}
                  seleccionada={seleccion.columnasNombre.includes(idx)}
                  esPrincipal={seleccion.columnaPrincipal === idx}
                  onToggle={toggleColumnaNombre}
                  onMarcarPrincipal={marcarPrincipal}
                />
              ))}
            </div>
          </div>

          <div className="ap-selector-bloque">
            <span className="ap-selector-titulo">
              Columna con el link a escanear <span className="ap-selector-obligatorio">obligatorio</span>
            </span>
            <select
              className="ap-select-link"
              value={seleccion.columnaLink ?? ''}
              onChange={e => setColumnaLink(e.target.value)}
            >
              <option value="">Seleccionar columna…</option>
              {headers.map((h, idx) => (
                <option key={idx} value={idx}>{h || `Columna ${idx + 1}`}</option>
              ))}
            </select>
          </div>

          <div className="ap-preview-tabla">
            {seleccion.columnaLink == null ? (
              <span className="ap-preview-tabla-aviso">Elegí la columna de link para ver la vista previa.</span>
            ) : (
              <>
                <span className="ap-preview-tabla-contador">
                  {piezasPreview.filter(p => p.valida).length} pieza{piezasPreview.filter(p => p.valida).length !== 1 ? 's' : ''} detectada{piezasPreview.filter(p => p.valida).length !== 1 ? 's' : ''}
                  {piezasPreview.some(p => !p.valida) && <span className="ap-label-contador-error"> · {piezasPreview.filter(p => !p.valida).length} con error</span>}
                </span>
                {piezasPreview.slice(0, 3).map(p => (
                  <div key={p.id} className="ap-preview-tabla-fila">
                    {p.campos.map(c => c.valor).join(' · ') || p.nombre}
                  </div>
                ))}
                {piezasPreview.length > 3 && <div className="ap-preview-tabla-mas">…y {piezasPreview.length - 3} más</div>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================================
// Resultado: ocurrencias, cards, filas
// ============================================================================

function Ocurrencia({ ocurrencia, tipo }) {
  if (tipo === 'texto') {
    return (
      <div className="ap-ocurrencia">
        <span className="ap-ocurrencia-ctx">{ocurrencia.antes}</span>
        <span className="ap-ocurrencia-match">{ocurrencia.match}</span>
        <span className="ap-ocurrencia-ctx">{ocurrencia.despues}</span>
      </div>
    )
  }
  return (
    <div className="ap-ocurrencia ap-ocurrencia-url">
      <span className="ap-ocurrencia-match">{ocurrencia.match}</span>
    </div>
  )
}

// Campos secundarios de una pieza (todos menos el primero, que ya se
// usa como título de la card) — se muestran como una fila compacta de
// "Etiqueta: valor", sin importar cuántos sean.
function CamposSecundarios({ campos }) {
  const secundarios = campos.slice(1)
  if (secundarios.length === 0) return null
  return (
    <div className="ap-campos-secundarios">
      {secundarios.map((c, i) => (
        <span key={i} className="ap-campo-secundario">
          <span className="ap-campo-secundario-etiqueta">{c.etiqueta}:</span> {c.valor}
        </span>
      ))}
    </div>
  )
}

function CardPiezaConMatch({ item }) {
  const [open, setOpen] = useState(true)
  const totalOcurrencias = item.hallazgos.reduce((acc, h) => acc + h.ocurrencias.length, 0)
  const { pieza } = item

  return (
    <div className="ap-card-pieza ap-card-con-match">
      <button type="button" className="ap-card-header" onClick={() => setOpen(v => !v)}>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <div className="ap-card-titulo-wrap">
          <span className="ap-card-nombre">{pieza.nombre}</span>
          <CamposSecundarios campos={pieza.campos} />
          <a
            href={pieza.url}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="ap-card-link"
          >
            {pieza.url} <ExternalLink size={11} />
          </a>
        </div>
        <span className="ap-badge-matches">{totalOcurrencias} coincidencia{totalOcurrencias !== 1 ? 's' : ''}</span>
      </button>

      {open && (
        <div className="ap-card-body">
          {item.hallazgos.map((h, i) => {
            const Icono = ICONO_TIPO[h.regla.tipo]
            return (
              <div key={i} className="ap-hallazgo">
                <div className="ap-hallazgo-head">
                  <Icono size={13} />
                  <span className="ap-hallazgo-tipo">{TIPOS_REGLA[h.regla.tipo]}</span>
                  <span className="ap-hallazgo-valor">"{h.regla.valor}"</span>
                  <span className="ap-hallazgo-count">{h.ocurrencias.length}×</span>
                </div>
                <div className="ap-hallazgo-ocurrencias">
                  {h.ocurrencias.slice(0, 8).map((o, j) => (
                    <Ocurrencia key={j} ocurrencia={o} tipo={h.regla.tipo} />
                  ))}
                  {h.ocurrencias.length > 8 && (
                    <div className="ap-ocurrencia-mas">…y {h.ocurrencias.length - 8} más</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilaPiezaSimple({ pieza, error }) {
  return (
    <div className="ap-fila-simple">
      <div className="ap-fila-nombre-wrap">
        <span className="ap-fila-nombre">{pieza.nombre}</span>
        <CamposSecundarios campos={pieza.campos} />
      </div>
      <a href={pieza.url} target="_blank" rel="noreferrer" className="ap-fila-link">
        {pieza.url} <ExternalLink size={11} />
      </a>
      {error && <span className="ap-fila-error">{error}</span>}
    </div>
  )
}

function SeccionColapsable({ titulo, icono, count, tono, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen)
  if (count === 0) return null
  return (
    <div className={`ap-seccion-colapsable ap-tono-${tono}`}>
      <button type="button" className="ap-seccion-colapsable-header" onClick={() => setOpen(v => !v)}>
        {icono}
        <span>{titulo} ({count})</span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && <div className="ap-seccion-colapsable-body">{children}</div>}
    </div>
  )
}

// ============================================================================
// Página
// ============================================================================

const SELECCION_TABLA_INICIAL = { columnasNombre: [], columnaPrincipal: null, columnaLink: null }

export default function AuditoriaPiezas() {
  const [modoCarga, setModoCarga] = useState('simple') // 'simple' | 'tabla'

  // Modo simple
  const [textoPiezas, setTextoPiezas] = useState('')
  const piezasTextareaRef = useAutoResize(textoPiezas, 180)

  // Modo tabla
  const [textoTabla, setTextoTabla] = useState('')
  const [seleccionTabla, setSeleccionTabla] = useState(SELECCION_TABLA_INICIAL)

  const [reglas, setReglas] = useState([nuevaRegla()])
  const [cargando, setCargando] = useState(false)
  const [progresoActual, setProgresoActual] = useState(null) // { pieza, indice, total }
  const [resultado, setResultado] = useState(null)
  const [soloConCoincidencias, setSoloConCoincidencias] = useState(true)

  const tablaParseada = useMemo(() => parsearTabla(textoTabla), [textoTabla])

  // Piezas finales según el modo activo — esto es lo único que el resto
  // de la página necesita, no le importa de qué modo vinieron.
  const piezasParseadas = useMemo(() => {
    if (modoCarga === 'simple') return parsearPiezasSimple(textoPiezas)
    if (!tablaParseada.tieneHeaders || seleccionTabla.columnaLink == null) return []
    return construirPiezasDesdeTabla(tablaParseada, seleccionTabla)
  }, [modoCarga, textoPiezas, tablaParseada, seleccionTabla])

  const piezasValidas = piezasParseadas.filter(p => p.valida)
  const piezasInvalidas = piezasParseadas.filter(p => !p.valida)
  const reglasValidas = reglas.filter(reglaEsValida)

  const puedeAuditar = piezasValidas.length > 0 && reglasValidas.length > 0 && !cargando

  function actualizarRegla(id, nueva) {
    setReglas(rs => rs.map(r => r.id === id ? nueva : r))
  }

  function eliminarRegla(id) {
    setReglas(rs => rs.filter(r => r.id !== id))
  }

  function agregarRegla() {
    setReglas(rs => [...rs, nuevaRegla()])
  }

  async function handleAuditar() {
    if (!puedeAuditar) return
    setCargando(true)
    setResultado(null)
    setProgresoActual({ pieza: null, indice: 0, total: piezasValidas.length })

    try {
      const res = await ejecutarAuditoria({
        piezas: piezasParseadas,
        reglas: reglasValidas,
        onProgreso: (pieza, indice, total) => setProgresoActual({ pieza, indice, total }),
      })
      setResultado(res)
    } finally {
      setCargando(false)
      setProgresoActual(null)
    }
  }

  function handleReiniciar() {
    setTextoPiezas('')
    setTextoTabla('')
    setSeleccionTabla(SELECCION_TABLA_INICIAL)
    setReglas([nuevaRegla()])
    setResultado(null)
    setSoloConCoincidencias(true)
  }

  function handleExportar(formato) {
    if (!resultado) return
    const fecha = new Date().toISOString().slice(0, 10)
    if (formato === 'txt') {
      descargarArchivo(generarReporteTexto(resultado), `auditoria-piezas-${fecha}.txt`, 'text/plain;charset=utf-8')
    } else {
      descargarArchivo(generarReporteCsv(resultado), `auditoria-piezas-${fecha}.csv`, 'text/csv;charset=utf-8')
    }
  }

  const totalAuditadas = resultado
    ? resultado.conCoincidencias.length + resultado.sinCoincidencias.length + resultado.conError.length
    : 0

  return (
    <div className="ap-root">
      <div className="ap-header">
        <div className="ap-header-titulo">
          <ScanSearch size={22} />
          <div>
            <h1>Auditoría de Piezas</h1>
            <p>Escaneá muchas piezas a la vez en busca de textos, links o imágenes puntuales.</p>
          </div>
        </div>
      </div>

      {!resultado && !cargando && (
        <div className="ap-form">
          <div className="ap-bloque">
            <div className="ap-tabs-modo">
              <button
                type="button"
                className={`ap-tab-modo${modoCarga === 'simple' ? ' active' : ''}`}
                onClick={() => setModoCarga('simple')}
              >
                <ClipboardList size={14} /> Pegado simple
              </button>
              <button
                type="button"
                className={`ap-tab-modo${modoCarga === 'tabla' ? ' active' : ''}`}
                onClick={() => setModoCarga('tabla')}
              >
                <Table2 size={14} /> Pegar tabla
              </button>
            </div>

            <div className="ap-label">
              Piezas a auditar
              <span className="ap-label-contador">
                {piezasValidas.length} pieza{piezasValidas.length !== 1 ? 's' : ''} detectada{piezasValidas.length !== 1 ? 's' : ''}
                {piezasInvalidas.length > 0 && <span className="ap-label-contador-error"> · {piezasInvalidas.length} con error</span>}
              </span>
            </div>

            {modoCarga === 'simple' ? (
              <>
                <textarea
                  ref={piezasTextareaRef}
                  className="ap-textarea"
                  placeholder={PLACEHOLDER_PIEZAS_SIMPLE}
                  value={textoPiezas}
                  onChange={e => setTextoPiezas(e.target.value)}
                />
                <p className="ap-hint">
                  Una pieza por línea. Formatos aceptados: <code>Nombre | URL</code>, <code>Nombre, URL</code> (CSV pegado) o solo la URL.
                </p>
              </>
            ) : (
              <SelectorTabla
                textoTabla={textoTabla}
                setTextoTabla={setTextoTabla}
                seleccion={seleccionTabla}
                setSeleccion={setSeleccionTabla}
              />
            )}

            {piezasInvalidas.length > 0 && (
              <div className="ap-piezas-invalidas">
                {piezasInvalidas.map(p => (
                  <div key={p.id} className="ap-pieza-invalida">
                    <AlertTriangle size={13} />
                    <span>{p.nombre || p.url}</span>
                    <span className="ap-pieza-invalida-motivo">{p.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ap-bloque">
            <label className="ap-label">Reglas de búsqueda</label>
            <div className="ap-reglas-lista">
              {reglas.map(regla => (
                <FilaRegla
                  key={regla.id}
                  regla={regla}
                  onChange={nueva => actualizarRegla(regla.id, nueva)}
                  onEliminar={() => eliminarRegla(regla.id)}
                  puedeEliminar={reglas.length > 1}
                />
              ))}
            </div>
            <button type="button" className="ap-btn-agregar-regla" onClick={agregarRegla}>
              <Plus size={14} /> Agregar regla
            </button>
          </div>

          <div className="ap-acciones-form">
            <button type="button" className="ap-btn-auditar" onClick={handleAuditar} disabled={!puedeAuditar}>
              <ScanSearch size={16} /> Auditar piezas
            </button>
          </div>
        </div>
      )}

      {cargando && progresoActual && (
        <div className="ap-processing">
          <div className="ap-processing-top">
            <span className="ap-processing-label">
              {progresoActual.pieza
                ? <>Analizando: <b>{progresoActual.pieza.nombre}</b></>
                : 'Preparando…'}
            </span>
            <span className="ap-processing-count">{progresoActual.indice + 1} / {progresoActual.total}</span>
          </div>
          <div className="ap-progress-track">
            <div
              className="ap-progress-fill"
              style={{ width: `${Math.round(((progresoActual.indice) / Math.max(progresoActual.total, 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {resultado && (
        <div className="ap-resultado">
          <div className="ap-resumen">
            <div className="ap-resumen-card">
              <span className="ap-resumen-num">{totalAuditadas}</span>
              <span className="ap-resumen-label">Piezas auditadas</span>
            </div>
            <div className="ap-resumen-card ap-resumen-rojo">
              <span className="ap-resumen-num">{resultado.conCoincidencias.length}</span>
              <span className="ap-resumen-label">Con coincidencias</span>
            </div>
            <div className="ap-resumen-card ap-resumen-verde">
              <span className="ap-resumen-num">{resultado.sinCoincidencias.length}</span>
              <span className="ap-resumen-label">Sin coincidencias</span>
            </div>
            <div className="ap-resumen-card ap-resumen-gris">
              <span className="ap-resumen-num">{resultado.conError.length}</span>
              <span className="ap-resumen-label">No analizadas</span>
            </div>
          </div>

          <div className="ap-resultado-toolbar">
            <label className="ap-checkbox-filtro">
              <input
                type="checkbox"
                checked={soloConCoincidencias}
                onChange={e => setSoloConCoincidencias(e.target.checked)}
              />
              Mostrar solo piezas con coincidencias
            </label>
            <div className="ap-toolbar-derecha">
              <button type="button" className="ap-btn-secundario" onClick={() => handleExportar('csv')}>
                <Download size={14} /> CSV
              </button>
              <button type="button" className="ap-btn-secundario" onClick={() => handleExportar('txt')}>
                <Download size={14} /> TXT
              </button>
              <button type="button" className="ap-btn-secundario" onClick={handleReiniciar}>
                <RotateCcw size={14} /> Nueva auditoría
              </button>
            </div>
          </div>

          <div className="ap-resultado-lista">
            {resultado.conCoincidencias.length === 0 && (
              <div className="ap-sin-resultados">
                <CheckCircle2 size={18} />
                No se encontraron coincidencias en ninguna pieza analizada.
              </div>
            )}
            {resultado.conCoincidencias.map(item => (
              <CardPiezaConMatch key={item.pieza.id} item={item} />
            ))}
          </div>

          {!soloConCoincidencias && (
            <>
              <SeccionColapsable
                titulo="Sin coincidencias"
                icono={<CheckCircle2 size={15} />}
                count={resultado.sinCoincidencias.length}
                tono="verde"
                defaultOpen={false}
              >
                {resultado.sinCoincidencias.map(item => (
                  <FilaPiezaSimple key={item.pieza.id} pieza={item.pieza} />
                ))}
              </SeccionColapsable>

              <SeccionColapsable
                titulo="No se pudieron analizar"
                icono={<XCircle size={15} />}
                count={resultado.conError.length}
                tono="gris"
                defaultOpen={false}
              >
                {resultado.conError.map(item => (
                  <FilaPiezaSimple key={item.pieza.id} pieza={item.pieza} error={item.error} />
                ))}
              </SeccionColapsable>
            </>
          )}
        </div>
      )}
    </div>
  )
}
