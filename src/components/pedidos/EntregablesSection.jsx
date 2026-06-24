import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CopyBtn } from '@/components/pedidos/CopyBtn'
import { ExternalLink, Plus, Trash2, Lock, Unlock, Copy, Check, RefreshCw, Loader2, Download } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { correrRevisionCompleta, resumirResultados, identificadorPieza } from '@/lib/revision/ejecutarRevision'
import { descargarPiezaIndividual } from '@/lib/descargarPiezas'

function CopyAllBtn({ entregables }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    const texto = entregables.filter(e => e.nombre_pieza)
      .map(e => e.link_online ? `${e.nombre_pieza} || ${e.link_online}` : e.nombre_pieza).join('\n')
    navigator.clipboard.writeText(texto)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="entregables-copy-all"
      style={{ color: copied ? '#10B981' : 'var(--text-secondary)', border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, background: copied ? 'rgba(16,185,129,0.06)' : 'transparent' }}>
      {copied ? <><Check size={13} />¡Copiado!</> : <><Copy size={13} />Copiar todo</>}
    </button>
  )
}

function EntregableItem({ ent, canWrite, isSuperAdmin, onUpdate, onEliminar, otrosEntregables, setConfirm, revisionEnCurso, onVerDetalle, dispararRevision }) {
  const [form, setForm] = useState({ nombre_pieza: ent.nombre_pieza ?? '', link_online: ent.link_online ?? '' })
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState('')
  const bloqueado = ent.aprobado && !isSuperAdmin

  async function guardarCambios() {
    setSaving(true)
    const linkNuevo = form.link_online.trim()
    // Se compara contra revision_link (el identificador de la ÚLTIMA
    // revisión guardada), no contra ent.link_online directo — si la
    // pieza nunca se revisó (revision_link es null), cualquier link
    // presente dispara la primera revisión.
    const idNuevo = identificadorPieza(linkNuevo)
    const idAnterior = ent.revision_link ?? ''
    const cambioElLink = idNuevo !== idAnterior

    // Si el link se borró (queda vacío) y antes había una revisión
    // guardada, se limpia el resumen — ya no aplica a nada, mostrar un
    // resultado de un link que ya no existe sería confuso/erróneo.
    const limpiarRevision = !linkNuevo && ent.revision_pruebas_total != null
    const updatePayload = limpiarRevision
      ? { ...form, revision_pruebas_ok: null, revision_pruebas_total: null, revision_severidad: null, revision_link: null, revision_at: null }
      : form

    const { error: errorSupabase } = await supabase.from('entregable').update(updatePayload).eq('id', ent.id)
    setSaving(false)
    if (errorSupabase) {
      setError(errorSupabase.message || 'No se pudo guardar la pieza. Intentá de nuevo.')
      return
    }
    setEditando(false); setError(''); onUpdate()
    if (linkNuevo && cambioElLink) dispararRevision(ent.id, linkNuevo)
  }

  function guardar() {
    setError('')
    const nombre = form.nombre_pieza.trim()
    const link = form.link_online.trim()

    // Misma regla que al cargar una pieza nueva (ver EntregablesSection):
    // el link debe ser único dentro del pedido, comparado contra el
    // resto de las piezas (no contra sí misma) — usando el query string
    // real (identificadorPieza), no el string completo, para detectar
    // la misma pieza aunque el dominio visible sea distinto.
    if (link && otrosEntregables.some(e => identificadorPieza(e.link_online) === identificadorPieza(link))) {
      setError('Ya hay otra pieza con ese link en este pedido. El link debe ser único.')
      return
    }

    if (nombre && otrosEntregables.some(e => e.nombre_pieza?.trim() === nombre)) {
      setConfirm({
        title: 'Nombre de pieza repetido',
        message: `Ya hay otra pieza llamada "${nombre}" en este pedido. ¿Querés guardarla igual?`,
        confirmLabel: 'Guardar igual',
        variant: 'warning',
        onConfirm: async () => { setConfirm(null); await guardarCambios() }
      })
      return
    }

    guardarCambios()
  }

  async function toggleAprobado() {
    await supabase.from('entregable').update({
      aprobado: !ent.aprobado,
      aprobado_at: !ent.aprobado ? new Date().toISOString() : null
    }).eq('id', ent.id)
    onUpdate()
  }

  return (
    <div className={`entregable-item ${ent.aprobado ? 'entregable-item-aprobado' : ''}`}>
      <div className="entregable-actions">
        {ent.aprobado && <span className="entregable-badge-aprobada">Aprobada</span>}
        <div style={{ flex: 1 }} />
        {canWrite && (
          <button onClick={toggleAprobado} title={ent.aprobado ? 'Desaprobar' : 'Aprobar'}
            className={`btn-aprobar ${ent.aprobado ? 'btn-aprobar-active' : ''}`}>
            {ent.aprobado ? <><Unlock size={12} />Desaprobar</> : <><Lock size={12} />Aprobar</>}
          </button>
        )}
        {!bloqueado && canWrite && !editando && (
          <button onClick={() => setEditando(true)} className="btn-editar-ent">Editar</button>
        )}
        {canWrite && (
          <button onClick={() => onEliminar(ent.id)}
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', opacity: 0.5, transition: 'opacity 150ms' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {editando && !bloqueado ? (
        <div className="entregable-edit-form">
          <input value={form.nombre_pieza} onChange={e => setForm(f => ({ ...f, nombre_pieza: e.target.value }))} placeholder="Nombre de la pieza" />
          <input value={form.link_online} onChange={e => setForm(f => ({ ...f, link_online: e.target.value }))} placeholder="https://…" />
          {error && <p className="msg-error">{error}</p>}
          <div className="entregable-edit-actions">
            <button onClick={() => { setEditando(false); setError('') }} className="btn-secondary">Cancelar</button>
            <button onClick={guardar} disabled={saving} className="btn-primary" style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[0.375rem]">
          <div className="entregable-field-row">
            <span className="entregable-field-key">Pieza:</span>
            <span className="entregable-field-val">{ent.nombre_pieza}</span>
            <CopyBtn text={ent.nombre_pieza} />
          </div>
          {ent.link_online && (
            <div className="entregable-link-box">
              <a href={ent.link_online} target="_blank" rel="noopener" className="entregable-link-box-text">
                {ent.link_online}
              </a>
              <CopyBtn text={ent.link_online} />
              <a href={ent.link_online} target="_blank" rel="noopener" className="entregable-link-icon">
                <ExternalLink size={13} />
              </a>
              <button
                onClick={() => descargarPiezaIndividual(ent)}
                className="entregable-link-icon"
                title="Descargar HTML"
              >
                <Download size={13} />
              </button>
            </div>
          )}
          {ent.aprobado && ent.aprobado_at && (
            <span className="entregable-aprobado-fecha">
              Aprobada el {format(new Date(ent.aprobado_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
            </span>
          )}
          {bloqueado && <span className="entregable-bloqueado-msg">Aprobada — para modificar generá una nueva versión</span>}
          {revisionEnCurso && (
            <div className="entregable-revision-processing">
              <div className="entregable-revision-processing-top">
                <Loader2 size={13} className="entregable-revision-processing-spinner" />
                <div className="entregable-revision-processing-label">
                  {revisionEnCurso.mensaje || 'Revisando pieza…'}
                </div>
                <div className="entregable-revision-processing-pct">{revisionEnCurso.porcentaje}%</div>
              </div>
              <div className="entregable-revision-progress-track">
                <div className="entregable-revision-progress-fill" style={{ width: `${revisionEnCurso.porcentaje}%` }} />
              </div>
            </div>
          )}
          {!revisionEnCurso && ent.revision_pruebas_total != null && (
            <div className="entregable-revision-resultado-fila">
              <button
                onClick={() => onVerDetalle(ent.link_online, ent.id)}
                className={`entregable-revision-resumen entregable-revision-${ent.revision_severidad}`}
              >
                {ent.revision_pruebas_ok}/{ent.revision_pruebas_total} pruebas superadas — Ver detalle
              </button>
              {/* Re-verificar — mismo ícono y criterio que ya usa
                  BaseDatosSection.jsx: solo aparece después de que ya
                  hubo un resultado, nunca mientras nunca se corrió. */}
              <button
                onClick={() => dispararRevision(ent.id, ent.link_online)}
                className="entregable-reverificar-btn"
                title="Volver a revisar"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function EntregablesSection({ pedidoId, entregables, canWrite, isSuperAdmin, onUpdate, setConfirm, nombrePedido }) {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre_pieza: '', link_online: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Revisiones automáticas en curso, indexadas por id de entregable —
  // { [entregableId]: { porcentaje, mensaje } }. Vive en el padre (no en
  // cada EntregableItem) porque el indicador GLOBAL necesita ver el
  // estado de TODAS las piezas a la vez, no solo la suya.
  const [revisionesEnCurso, setRevisionesEnCurso] = useState({})
  // Token por pieza — cada llamada a dispararRevision se identifica con
  // un número creciente. Antes de GUARDAR su resultado, cada revisión
  // chequea si su token sigue siendo el más reciente para esa pieza; si
  // alguien disparó una revisión más nueva mientras la vieja corría
  // (ej: editó el link dos veces seguidas), la vieja descarta su
  // resultado en silencio — la más reciente en DISPARARSE siempre es la
  // que efectivamente persiste, sin importar cuál termine primero.
  const tokensRevision = useRef({})

  // Navega a "Revisión de emails" con el link ya cargado, para ver el
  // detalle completo de qué falló — esa pantalla vuelve a correr la
  // revisión en vivo (no se persiste el detalle pesado en la base, ver
  // migración 20260621000000) y, si la pieza sigue siendo la misma al
  // terminar, actualiza el resumen guardado con el resultado nuevo.
  function verDetalle(link, entregableId) {
    navigate('/app/revision', { state: { url: link, entregableId } })
  }

  // Corre la revisión completa para una pieza puntual, actualizando su
  // progreso individual a medida que avanza, y guardando el resumen
  // liviano al terminar (sin el jsonb pesado, ver ejecutarRevision.js).
  // No bloquea nada del formulario — se dispara "en segundo plano" y el
  // resultado aparece en la tarjeta cuando esté listo, aunque la persona
  // ya haya seguido trabajando en otra cosa del pedido.
  async function dispararRevision(entregableId, link) {
    const miToken = (tokensRevision.current[entregableId] ?? 0) + 1
    tokensRevision.current[entregableId] = miToken

    setRevisionesEnCurso(prev => ({ ...prev, [entregableId]: { porcentaje: 0, mensaje: '' } }))
    try {
      const { resultados } = await correrRevisionCompleta({
        modo: 'url',
        url: link,
        onProgreso: (mensaje, porcentaje) => {
          // Si ya no soy el token vigente para esta pieza (alguien
          // disparó una revisión más nueva), no actualizo el progreso
          // visual — dejo que se vea el avance de la revisión nueva,
          // no una mezcla confusa entre la vieja y la nueva.
          if (tokensRevision.current[entregableId] !== miToken) return
          setRevisionesEnCurso(prev => ({ ...prev, [entregableId]: { porcentaje, mensaje } }))
        },
      })
      const resumen = resumirResultados(resultados)
      // Solo persiste el resultado si sigo siendo el token vigente — si
      // no, alguien disparó una revisión más nueva mientras yo corría,
      // y esa es la que debe quedar guardada, no la mía (que ya está
      // desactualizada respecto al link actual).
      if (tokensRevision.current[entregableId] === miToken) {
        await supabase.from('entregable').update({
          revision_pruebas_ok: resumen.ok,
          revision_pruebas_total: resumen.total,
          revision_severidad: resumen.severidad,
          revision_link: identificadorPieza(link),
          revision_at: new Date().toISOString(),
        }).eq('id', entregableId)
      }
    } catch {
      // Si falla (proxy caído, HTML inaccesible, etc.) se deja la
      // pieza sin resultado de revisión — no se bloquea ni se rompe
      // nada del resto del pedido, simplemente no queda el resumen.
    } finally {
      // Solo limpio el indicador "en curso" si sigo siendo el vigente —
      // si ya no lo soy, la revisión nueva ya se está mostrando con su
      // propio progreso, y limpiar acá borraría ESE indicador por error.
      if (tokensRevision.current[entregableId] === miToken) {
        setRevisionesEnCurso(prev => {
          const next = { ...prev }
          delete next[entregableId]
          return next
        })
      }
      onUpdate()
    }
  }

  const cantidadEnCurso = Object.keys(revisionesEnCurso).length

  async function insertarPieza() {
    setSaving(true)
    const { data, error: errorSupabase } = await supabase
      .from('entregable')
      .insert({ ...form, pedido_id: pedidoId })
      .select()
      .single()
    setSaving(false)
    if (errorSupabase) {
      setError(errorSupabase.message || 'No se pudo guardar la pieza. Intentá de nuevo.')
      return
    }
    setForm({ nombre_pieza: '', link_online: '' }); setShowForm(false); setError(''); onUpdate()
    // Una pieza recién creada nunca tuvo revisión — si trae link, se
    // dispara directo, sin necesitar comparar contra nada anterior.
    if (data?.link_online) dispararRevision(data.id, data.link_online)
  }

  function agregar() {
    const nombre = form.nombre_pieza.trim()
    if (!nombre) return
    setError('')

    // El LINK debe ser único dentro del mismo pedido — no tiene sentido
    // de negocio que dos piezas distintas apunten al mismo recurso
    // publicado, así que esto se bloquea directamente, sin posibilidad
    // de continuar. Se compara por identificadorPieza (el query string
    // real), no el string completo — dos personas pueden ver la misma
    // pieza con dominios distintos (con/sin "-ai", por ejemplo).
    const link = form.link_online.trim()
    if (link && entregables.some(e => identificadorPieza(e.link_online) === identificadorPieza(link))) {
      setError('Ya hay una pieza con ese link en este pedido. El link debe ser único.')
      return
    }

    // El NOMBRE sí puede repetirse legítimamente (la misma pieza puede
    // llamarse igual en distintas campañas) — solo se avisa por si fue
    // un error de tipeo, pero se permite seguir si la persona confirma.
    if (entregables.some(e => e.nombre_pieza?.trim() === nombre)) {
      setConfirm({
        title: 'Nombre de pieza repetido',
        message: `Ya hay una pieza llamada "${nombre}" en este pedido. ¿Querés cargarla igual?`,
        confirmLabel: 'Cargar igual',
        variant: 'warning',
        onConfirm: async () => { setConfirm(null); await insertarPieza() }
      })
      return
    }

    insertarPieza()
  }

  function eliminar(id) {
    setConfirm({
      title: 'Eliminar pieza',
      message: '¿Querés eliminar esta pieza? Esta acción no se puede deshacer.',
      onConfirm: async () => { setConfirm(null); await supabase.from('entregable').delete().eq('id', id); onUpdate() }
    })
  }

  const piezasConLink = entregables.filter(e => e.link_online)

  return (
    <div className="flex flex-col gap-3">
      {cantidadEnCurso > 0 && (
        <div className="entregables-revision-global">
          Revisando {cantidadEnCurso} pieza{cantidadEnCurso !== 1 ? 's' : ''}…
        </div>
      )}
      {piezasConLink.length > 0 && (
        <div className="entregables-descarga-bar">
          <button
            className="btn-descargar-piezas"
            onClick={() => descargarTodasLasPiezas(entregables, nombrePedido)}
          >
            <Download size={14} />
            {piezasConLink.length === 1
              ? 'Descargar HTML'
              : `Descargar todas (${piezasConLink.length})`}
          </button>
        </div>
      )}
      {entregables.length === 0 && !showForm && <p className="text-muted-sm">No hay piezas cargadas.</p>}
      {entregables.map(ent => (
        <EntregableItem key={ent.id} ent={ent} canWrite={canWrite} isSuperAdmin={isSuperAdmin} onUpdate={onUpdate} onEliminar={eliminar}
          otrosEntregables={entregables.filter(e => e.id !== ent.id)} setConfirm={setConfirm}
          revisionEnCurso={revisionesEnCurso[ent.id]} onVerDetalle={verDetalle} dispararRevision={dispararRevision} />
      ))}
      {showForm && (
        <div className="entregable-item">
          <input value={form.nombre_pieza} onChange={e => setForm(f => ({ ...f, nombre_pieza: e.target.value }))} placeholder="Nombre de la pieza *" autoFocus />
          <input value={form.link_online} onChange={e => setForm(f => ({ ...f, link_online: e.target.value }))} placeholder="Link versión online (opcional)" />
          {error && <p className="msg-error">{error}</p>}
          <div className="entregable-edit-actions">
            <button onClick={() => { setShowForm(false); setForm({ nombre_pieza: '', link_online: '' }); setError('') }} className="btn-secondary">Cancelar</button>
            <button onClick={agregar} disabled={saving || !form.nombre_pieza.trim()}
              className="btn-primary" style={{ width: 'auto', opacity: saving || !form.nombre_pieza.trim() ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar pieza'}
            </button>
          </div>
        </div>
      )}
      {canWrite && !showForm && (
        <button onClick={() => setShowForm(true)} className="btn-add-dashed">
          <Plus size={14} />{entregables.length === 0 ? 'Cargar pieza' : 'Agregar otra pieza'}
        </button>
      )}
      {entregables.length > 1 && <CopyAllBtn entregables={entregables} />}
    </div>
  )
}
