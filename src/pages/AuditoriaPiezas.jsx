import { useState, useRef, useEffect, useMemo } from 'react'
import {
  ScanSearch, Plus, X, RotateCcw, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, ExternalLink, Download, Type, Link2, Image as ImageIcon,
  Star, Table2, ClipboardList, Pencil,
} from 'lucide-react'
import {
  parsearPiezasSimple, parsearTabla, construirPiezasDesdeTabla,
  nuevaRegla, reglaEsValida, ejecutarAuditoria,
  generarListadoConCoincidenciasTexto, generarListadoSinCoincidenciasTexto, descargarArchivo, TIPOS_REGLA,
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
          title={regla.ignorarMayus
            ? 'Ignora mayúsculas/minúsculas — tocá para hacer la búsqueda exacta (sensible a mayúsculas)'
            : 'Búsqueda exacta (sensible a mayúsculas) — tocá para ignorar mayúsculas/minúsculas'}
          aria-pressed={regla.ignorarMayus}
          onClick={() => onChange({ ...regla, ignorarMayus: !regla.ignorarMayus })}
        >
          <span className="ap-toggle-aa-texto">Aa</span>
          <span className="ap-toggle-aa-estado">{regla.ignorarMayus ? 'Ignora mayúsculas' : 'Exacto'}</span>
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

// Renderiza la tabla pegada como una tabla HTML real (en vez del texto
// crudo tab-separated, ilegible cuando las celdas traen contenido largo
// como JSON de filtros). Muestra hasta 6 filas por default con opción
// de expandir, y scroll horizontal si hay muchas columnas.
function TablaPegada({ headers, filas, onEditar }) {
  const [verTodas, setVerTodas] = useState(false)
  const filasVisibles = verTodas ? filas : filas.slice(0, 6)

  return (
    <div className="ap-tabla-pegada-wrap">
      <div className="ap-tabla-pegada-toolbar">
        <span className="ap-tabla-pegada-info">{filas.length} fila{filas.length !== 1 ? 's' : ''} · {headers.length} columna{headers.length !== 1 ? 's' : ''}</span>
        <button type="button" className="ap-btn-editar-pegado" onClick={onEditar}>Editar pegado</button>
      </div>
      <div className="ap-tabla-pegada-scroll">
        <table className="ap-tabla-pegada">
          <thead>
            <tr>
              {headers.map((h, i) => <th key={i}>{h || `Columna ${i + 1}`}</th>)}
            </tr>
          </thead>
          <tbody>
            {filasVisibles.map((fila, i) => (
              <tr key={i}>
                {headers.map((_, j) => <td key={j} title={fila[j]}>{fila[j] || '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filas.length > 6 && (
        <button type="button" className="ap-btn-ver-mas-tabla" onClick={() => setVerTodas(v => !v)}>
          {verTodas ? 'Ver menos' : `Ver las ${filas.length} filas`}
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

  const [editandoPegado, setEditandoPegado] = useState(true)

  // En cuanto se detectan headers válidos, se pasa automáticamente a
  // vista de tabla — el textarea crudo (una sola línea gigante por
  // fila, ilegible con datos reales tipo JSON de filtros) queda oculto
  // detrás de un botón "Editar pegado" por si hace falta repegar.
  useEffect(() => {
    if (tieneHeaders) setEditandoPegado(false)
  }, [tieneHeaders])

  return (
    <>
      {editandoPegado || !tieneHeaders ? (
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
        </>
      ) : (
        <TablaPegada headers={headers} filas={filas} onEditar={() => setEditandoPegado(true)} />
      )}

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
            <span className="ap-selector-titulo ap-selector-titulo-inline">
              Columna con el link a escanear <span className="ap-selector-obligatorio">*</span>
            </span>
            <select
              className={`ap-select-link${seleccion.columnaLink == null ? ' ap-select-link-pendiente' : ''}`}
              value={seleccion.columnaLink ?? ''}
              onChange={e => setColumnaLink(e.target.value)}
            >
              <option value="">Seleccionar columna…</option>
              {headers.map((h, idx) => (
                <option key={idx} value={idx}>{h || `Columna ${idx + 1}`}</option>
              ))}
            </select>
            {seleccion.columnaLink == null && (
              <span className="ap-selector-obligatorio-aviso">* Obligatorio para poder auditar</span>
            )}
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

function CardPiezaConMatch({ item, abiertaPorDefault }) {
  const [open, setOpen] = useState(abiertaPorDefault)
  const totalOcurrencias = item.hallazgos.reduce((acc, h) => acc + h.ocurrencias.length, 0)
  const { pieza } = item

  return (
    <div className="ap-card-pieza">
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
      <div className="ap-fila-contenido">
        <span className="ap-fila-nombre">{pieza.nombre}</span>
        <CamposSecundarios campos={pieza.campos} />
        <a href={pieza.url} target="_blank" rel="noreferrer" className="ap-fila-link">
          {pieza.url} <ExternalLink size={11} />
        </a>
      </div>
      {error && <span className="ap-fila-error">{error}</span>}
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
  const [filtroActivo, setFiltroActivo] = useState('conMatch') // 'todas' | 'conMatch' | 'sinMatch' | 'conError'
  const [filtroRegla, setFiltroRegla] = useState('todas') // 'todas' | regla.id

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
    setFiltroRegla('todas')
    setProgresoActual({ pieza: null, indice: 0, total: piezasValidas.length, acumulado: { conMatch: 0, sinMatch: 0 } })

    try {
      const res = await ejecutarAuditoria({
        piezas: piezasParseadas,
        reglas: reglasValidas,
        onProgreso: (pieza, indice, total, acumulado) => setProgresoActual({ pieza, indice, total, acumulado }),
      })
      // Se guardan las reglas usadas en ESTA corrida junto al resultado
      // (no se lee 'reglas' del estado en vivo al renderizar) — así el
      // filtro por regla queda estable aunque el usuario edite o borre
      // reglas en el formulario después, sin haber vuelto a auditar.
      setResultado({ ...res, reglasUsadas: reglasValidas })
    } finally {
      setCargando(false)
      setProgresoActual(null)
    }
  }

  // Vuelve al formulario para ajustar piezas o reglas, SIN perder lo ya
  // cargado — a diferencia de handleReiniciar, que borra todo. Solo
  // limpia el resultado en pantalla (se vuelve a generar al re-auditar).
  function handleVolverAEditar() {
    setResultado(null)
    setFiltroActivo('conMatch')
    setFiltroRegla('todas')
  }

  function handleReiniciar() {
    setTextoPiezas('')
    setTextoTabla('')
    setSeleccionTabla(SELECCION_TABLA_INICIAL)
    setReglas([nuevaRegla()])
    setResultado(null)
    setFiltroActivo('conMatch')
    setFiltroRegla('todas')
  }

  function handleExportarConCoincidencias() {
    if (!resultado) return
    const fecha = new Date().toISOString().slice(0, 10)
    descargarArchivo(generarListadoConCoincidenciasTexto(resultado), `piezas-con-coincidencias-${fecha}.txt`, 'text/plain;charset=utf-8')
  }

  function handleExportarSinCoincidencias() {
    if (!resultado) return
    const fecha = new Date().toISOString().slice(0, 10)
    descargarArchivo(generarListadoSinCoincidenciasTexto(resultado), `piezas-sin-coincidencias-${fecha}.txt`, 'text/plain;charset=utf-8')
  }

  const totalAuditadas = resultado
    ? resultado.conCoincidencias.length + resultado.sinCoincidencias.length + resultado.conError.length
    : 0

  // Filtro por regla: solo aplica al listado "con coincidencias" (las
  // otras dos categorías nunca tuvieron match de ninguna regla, así que
  // filtrar por regla ahí no tiene sentido). Cuando hay una regla
  // seleccionada, además de filtrar QUÉ piezas se muestran, se recorta
  // 'hallazgos' de cada item a solo el hallazgo de esa regla — así la
  // card no muestra de nuevo los matches de las otras reglas que el
  // usuario ya no está mirando.
  const conCoincidenciasFiltradas = useMemo(() => {
    if (!resultado) return []
    if (filtroRegla === 'todas') return resultado.conCoincidencias
    return resultado.conCoincidencias
      .map(item => ({ ...item, hallazgos: item.hallazgos.filter(h => h.regla.id === filtroRegla) }))
      .filter(item => item.hallazgos.length > 0)
  }, [resultado, filtroRegla])


  return (
    <div className="ap-root">
      <div className="ap-header">
        <div className="ap-header-titulo">
          <h1>Auditoría de Piezas</h1>
          <p>Escaneá muchas piezas a la vez en busca de textos, links o imágenes puntuales.</p>
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
          <div className="ap-processing-icono">
            <ScanSearch size={18} />
          </div>
          <div className="ap-processing-cuerpo">
            <div className="ap-processing-top">
              <span className="ap-processing-label">
                {progresoActual.pieza
                  ? <>Analizando<br /><b>{progresoActual.pieza.nombre}</b></>
                  : 'Preparando…'}
              </span>
              <span className="ap-processing-contador">
                <span className="ap-processing-count">{progresoActual.indice + 1} / {progresoActual.total}</span>
                <span className="ap-processing-pct">{Math.round((progresoActual.indice / Math.max(progresoActual.total, 1)) * 100)}% completado</span>
              </span>
            </div>
            <div className="ap-progress-track">
              <div
                className="ap-progress-fill"
                style={{ width: `${Math.round(((progresoActual.indice) / Math.max(progresoActual.total, 1)) * 100)}%` }}
              />
            </div>
            <div className="ap-processing-acumulado">
              <span className="ap-processing-acumulado-rojo">{progresoActual.acumulado.conMatch} con coincidencias</span>
              <span className="ap-processing-acumulado-verde">{progresoActual.acumulado.sinMatch} sin coincidencias</span>
            </div>
          </div>
        </div>
      )}


      {resultado && (
        <div className="ap-resultado">
          <div className="ap-resumen ap-resumen-clickeable">
            <button
              type="button"
              className={`stat-card-clickeable${filtroActivo === 'todas' ? ' stat-card-clickeable-activo' : ''}`}
              style={{ '--stat-card-color': 'var(--text-secondary)', ...(filtroActivo === 'todas' ? { background: 'var(--text-secondary)', borderColor: 'var(--text-secondary)' } : {}) }}
              onClick={() => setFiltroActivo('todas')}
            >
              <span className="stat-card-clickeable-fila-superior">
                <span className="stat-card-clickeable-dot" style={{ background: filtroActivo === 'todas' ? '#fff' : 'var(--text-secondary)' }} />
                <span className="stat-card-clickeable-label" style={filtroActivo === 'todas' ? { color: '#fff' } : undefined}>Piezas auditadas</span>
              </span>
              <span className="stat-card-clickeable-valor" style={{ color: filtroActivo === 'todas' ? '#fff' : 'var(--text-secondary)' }}>{totalAuditadas}</span>
            </button>

            <button
              type="button"
              className={`stat-card-clickeable${filtroActivo === 'conMatch' ? ' stat-card-clickeable-activo' : ''}`}
              style={{ '--stat-card-color': 'var(--icbc-red)', ...(filtroActivo === 'conMatch' ? { background: 'var(--icbc-red)', borderColor: 'var(--icbc-red)' } : {}) }}
              onClick={() => setFiltroActivo('conMatch')}
            >
              <span className="stat-card-clickeable-fila-superior">
                <span className="stat-card-clickeable-dot" style={{ background: filtroActivo === 'conMatch' ? '#fff' : 'var(--icbc-red)' }} />
                <span className="stat-card-clickeable-label" style={filtroActivo === 'conMatch' ? { color: '#fff' } : undefined}>Con coincidencias</span>
              </span>
              <span className="stat-card-clickeable-valor" style={{ color: filtroActivo === 'conMatch' ? '#fff' : 'var(--icbc-red)' }}>{resultado.conCoincidencias.length}</span>
            </button>

            <button
              type="button"
              className={`stat-card-clickeable${filtroActivo === 'sinMatch' ? ' stat-card-clickeable-activo' : ''}`}
              style={{ '--stat-card-color': 'var(--green-text)', ...(filtroActivo === 'sinMatch' ? { background: 'var(--green-text)', borderColor: 'var(--green-text)' } : {}) }}
              onClick={() => setFiltroActivo('sinMatch')}
            >
              <span className="stat-card-clickeable-fila-superior">
                <span className="stat-card-clickeable-dot" style={{ background: filtroActivo === 'sinMatch' ? '#fff' : 'var(--green-text)' }} />
                <span className="stat-card-clickeable-label" style={filtroActivo === 'sinMatch' ? { color: '#fff' } : undefined}>Sin coincidencias</span>
              </span>
              <span className="stat-card-clickeable-valor" style={{ color: filtroActivo === 'sinMatch' ? '#fff' : 'var(--green-text)' }}>{resultado.sinCoincidencias.length}</span>
            </button>

            <button
              type="button"
              className={`stat-card-clickeable${filtroActivo === 'conError' ? ' stat-card-clickeable-activo' : ''}`}
              style={{ '--stat-card-color': 'var(--text-muted)', ...(filtroActivo === 'conError' ? { background: 'var(--text-muted)', borderColor: 'var(--text-muted)' } : {}) }}
              onClick={() => setFiltroActivo('conError')}
            >
              <span className="stat-card-clickeable-fila-superior">
                <span className="stat-card-clickeable-dot" style={{ background: filtroActivo === 'conError' ? '#fff' : 'var(--text-muted)' }} />
                <span className="stat-card-clickeable-label" style={filtroActivo === 'conError' ? { color: '#fff' } : undefined}>No analizadas</span>
              </span>
              <span className="stat-card-clickeable-valor" style={{ color: filtroActivo === 'conError' ? '#fff' : 'var(--text-muted)' }}>{resultado.conError.length}</span>
            </button>
          </div>

          <div className="ap-resultado-toolbar">
            <span className="ap-resultado-toolbar-titulo">
              {filtroActivo === 'todas' && 'Mostrando todas las piezas'}
              {filtroActivo === 'conMatch' && 'Mostrando piezas con coincidencias'}
              {filtroActivo === 'sinMatch' && 'Mostrando piezas sin coincidencias'}
              {filtroActivo === 'conError' && 'Mostrando piezas no analizadas'}
            </span>
            <div className="ap-toolbar-derecha">
              {resultado.conCoincidencias.length > 0 && (
                <button type="button" className="ap-btn-secundario" onClick={handleExportarConCoincidencias}>
                  <Download size={14} /> TXT con coincidencias
                </button>
              )}
              {resultado.sinCoincidencias.length > 0 && (
                <button type="button" className="ap-btn-secundario" onClick={handleExportarSinCoincidencias}>
                  <Download size={14} /> TXT sin coincidencias
                </button>
              )}
              <button type="button" className="ap-btn-secundario" onClick={handleVolverAEditar}>
                <Pencil size={14} /> Editar piezas o reglas
              </button>
              <button type="button" className="ap-btn-secundario" onClick={handleReiniciar}>
                <RotateCcw size={14} /> Nueva auditoría
              </button>
            </div>
          </div>

          {(filtroActivo === 'todas' || filtroActivo === 'conMatch') && resultado.reglasUsadas?.length > 1 && (
            <div className="ap-chips-filtro-regla">
              <span className="ap-chips-filtro-regla-label">Filtrar por regla:</span>
              <button
                type="button"
                className={`ap-chip-filtro-regla${filtroRegla === 'todas' ? ' activo' : ''}`}
                onClick={() => setFiltroRegla('todas')}
              >
                Todas
              </button>
              {resultado.reglasUsadas.map(regla => (
                <button
                  key={regla.id}
                  type="button"
                  className={`ap-chip-filtro-regla${filtroRegla === regla.id ? ' activo' : ''}`}
                  onClick={() => setFiltroRegla(regla.id)}
                >
                  {TIPOS_REGLA[regla.tipo]}: "{regla.valor}"
                </button>
              ))}
            </div>
          )}

          {(filtroActivo === 'todas' || filtroActivo === 'conMatch') && (
            <div className="ap-resultado-lista">
              {conCoincidenciasFiltradas.length > 0 && (
                <span className="ap-resultado-sublabel ap-resultado-sublabel-alerta">
                  <AlertTriangle size={14} /> Con coincidencias {conCoincidenciasFiltradas.length}
                </span>
              )}
              {conCoincidenciasFiltradas.length === 0 && (
                <div className="ap-sin-resultados">
                  <CheckCircle2 size={18} />
                  {filtroRegla === 'todas'
                    ? 'No se encontraron coincidencias en ninguna pieza analizada.'
                    : 'Ninguna pieza tuvo coincidencias con esta regla.'}
                </div>
              )}
              {conCoincidenciasFiltradas.map(item => (
                <CardPiezaConMatch key={item.pieza.id} item={item} abiertaPorDefault={filtroRegla !== 'todas'} />
              ))}
            </div>
          )}

          {(filtroActivo === 'todas' || filtroActivo === 'sinMatch') && resultado.sinCoincidencias.length > 0 && (
            <div className="ap-resultado-lista-simple">
              {filtroActivo === 'todas' && <span className="ap-resultado-sublabel">Sin coincidencias</span>}
              {resultado.sinCoincidencias.map(item => (
                <FilaPiezaSimple key={item.pieza.id} pieza={item.pieza} />
              ))}
            </div>
          )}

          {(filtroActivo === 'todas' || filtroActivo === 'conError') && resultado.conError.length > 0 && (
            <div className="ap-resultado-lista-simple">
              {filtroActivo === 'todas' && <span className="ap-resultado-sublabel">No se pudieron analizar</span>}
              {resultado.conError.map(item => (
                <FilaPiezaSimple key={item.pieza.id} pieza={item.pieza} error={item.error} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
