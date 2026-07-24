import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/useAuth'
import { useNotificaciones } from '@/context/useNotificaciones'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { useInstancias } from '@/hooks/useInstancias'
import { useTagsDisponibles } from '@/hooks/useTagsDisponibles'
import { X, Check, Plus } from 'lucide-react'
import { DatePicker } from '@/components/ui/DatePicker'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { HelpPopover } from '@/components/ui/HelpPopover'
import { colorAvatar, iniciales } from '@/lib/avatares'

const TIPOS_ENVIO = [
  { value: 'test', label: 'Test' },
  { value: 'real', label: 'Real' },
  { value: 'otro', label: 'Otro' },
]


// A nivel de MÓDULO a propósito: definido adentro del componente (como
// estaba), React lo veía como un componente NUEVO en cada render y
// desmontaba/remontaba cada label — inofensivo acá porque no tiene
// estado, pero es el anti-patrón que react-hooks/static-components
// marca, y con razón: el día que un helper así gane un input adentro,
// pierde el foco en cada tecla. No cierra sobre nada del form: children
// y done entran por props.
function FieldLabel({ children, done }) {
  return (
    <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      {children}
      {done && <Check size={12} style={{ color: '#10B981', strokeWidth: 2.5 }} />}
    </label>
  )
}

export default function PedidoForm({ pedido, onSave, onCancel }) {
  const isEdit = !!pedido
  const { user } = useAuth()
  const { showSuccess, showError } = useNotificaciones()
  const [form, setForm] = useState({
    asunto:             pedido?.asunto ?? '',
    descripcion:        pedido?.descripcion ?? '',
    prioridad:          pedido?.prioridad ?? 'media',
    tipo:               pedido?.tipo ?? 'creacion_email',
    fecha_limite:       pedido?.fecha_limite ?? '',
    tags:               pedido?.tags ?? [],
    estados:            pedido?.estados ?? [],
    asignados:          pedido?.pedido_asignados?.map(a => a.user_id) ?? (user?.id ? [user.id] : []),
    instancia:          pedido?.instancia ?? '',
    tipo_envio:         pedido?.tipo_envio ?? '',
    tipo_envio_otro:    pedido?.tipo_envio_otro ?? '',
    cantidad_envios:    pedido?.cantidad_envios ?? '',
    fecha_programacion: pedido?.fecha_programacion ?? '',
    hora_programacion:  pedido?.hora_programacion ?? '',
    fecha_pedido_cliente: pedido?.fecha_pedido_cliente ?? '',
    hora_pedido_cliente:  pedido?.hora_pedido_cliente ?? '',
    // Token del lock optimista: el updated_at del pedido TAL COMO
    // ESTABA cuando este form se abrió (useState inicializa una sola
    // vez, así que aunque el prop se refresque con el detalle, este
    // valor queda congelado — que es exactamente la gracia). Viaja con
    // el submit y actualizarPedido lo compara en el UPDATE: si otra
    // persona guardó en el medio, matchea 0 filas y avisa en vez de
    // pisar. No es un campo editable: limpiarCampos lo saca antes de
    // tocar la base.
    updated_at:         pedido?.updated_at ?? null,
  })
  const [usuarios, setUsuarios] = useState([])
  // Arranca tildado si el pedido ya tenía cargada la fecha/hora real
  // del cliente (editando uno existente) — si no, apagado por defecto,
  // que es el caso normal (pedido cargado apenas llega).
  const [cargarFechaCliente, setCargarFechaCliente] = useState(!!pedido?.fecha_pedido_cliente)
  const [tagInput, setTagInput] = useState('')
  const [tagSugerenciasAbiertas, setTagSugerenciasAbiertas] = useState(false)
  // Se abre cuando se aprieta Guardar/Crear con texto tipeado en el
  // campo de tags que nunca se confirmó con el + ni con Enter — ver
  // handleSubmit.
  const [tagPendienteAbierto, setTagPendienteAbierto] = useState(false)
  const tagFieldRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const { estados } = useEstados()
  // Tags YA cargados en cualquier pedido de la base — se usan para
  // autocompletar mientras se escribe. Así el que está cargando ve que
  // "Plazo Fijo" ya existe en vez de escribir "plazo fijo" a ciegas y
  // crear una variante nueva que después el filtro de tags no puede
  // unificar. Ver addTag: si lo que se escribió matchea alguno de estos
  // ignorando mayúsculas, se usa la ortografía ya cargada, no la tipeada.
  const { tags: tagsExistentes } = useTagsDisponibles()
  const { tipos } = useTipos()
  const { instancias } = useInstancias()
  const [error, setError] = useState('')

  useEffect(() => {
    // Viewer no puede aparecer como opción en "Asignar a" — no tiene
    // lógica de negocio que se le asigne un pedido (mismo criterio por
    // el que se ocultó Notificaciones para ese rol).
    supabase.from('profiles').select('id,full_name,role,avatar_color').then(({ data }) => setUsuarios((data ?? []).filter(u => u.role !== ROLES.VIEWER)))
  }, [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // Lógica real de guardado, separada de handleSubmit para poder
  // dispararla también después de resolver el aviso de "tag sin
  // agregar" (ver handleSubmit y el modal de tagPendienteAbierto más
  // abajo) — ahí necesitamos guardar con un array de tags ya corregido
  // ANTES de que la actualización de estado de React se refleje, así
  // que se recibe por parámetro en vez de leer form.tags directo.
  async function ejecutarGuardado(formAGuardar) {
    if (!formAGuardar.asunto.trim()) { setError('El asunto es obligatorio.'); return }
    // Si el checkbox de "fecha real del cliente" está activo, fecha Y
    // hora son obligatorias las dos — un dato a medias sería peor que
    // no tenerlo (el modal de Sheet no sabría si completar la hora
    // faltante con la de creación o dejarla vacía). Si el checkbox está
    // apagado, se guardan vacías aunque hayan quedado valores cargados
    // de cuando estuvo prendido — no tiene sentido persistir un dato
    // que el usuario decidió que no aplica.
    const fechaClienteFinal = cargarFechaCliente ? formAGuardar.fecha_pedido_cliente : ''
    const horaClienteFinal = cargarFechaCliente ? formAGuardar.hora_pedido_cliente : ''
    if (cargarFechaCliente && (!fechaClienteFinal || !horaClienteFinal.trim())) {
      setError('Si activás la fecha real del pedido, completá fecha y hora.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ ...formAGuardar, fecha_pedido_cliente: fechaClienteFinal, hora_pedido_cliente: horaClienteFinal })
      showSuccess(isEdit ? 'Pedido actualizado correctamente' : 'Pedido creado correctamente')
    } catch (err) {
      setError(err.message)
      showError(err.message || 'No se pudo guardar el pedido')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // Si queda texto tipeado en el campo de tags sin confirmar (se
    // olvidó de tocar el +), no guardamos directo — primero
    // preguntamos. Es un descuido fácil porque el botón + queda muy
    // cerca del de guardar.
    if (tagInput.trim()) {
      setTagPendienteAbierto(true)
      return
    }
    ejecutarGuardado(form)
  }

  // Calcula qué tag final correspondería para un texto tipeado, reusando
  // la ortografía ya cargada si matchea alguno existente ignorando
  // mayúsculas/minúsculas (misma regla que addTag).
  function calcularTagFinal(t) {
    const existente = tagsExistentes.find(et => et.toLowerCase() === t.toLowerCase())
    return existente ?? t
  }

  // Opción "Sí, agregarlo" del aviso: agrega el tag pendiente y recién
  // ahí guarda, pasando el array de tags YA actualizado a mano (no se
  // puede confiar en que form.tags refleje el set() en el mismo tick).
  function confirmarAgregarTagYGuardar() {
    const t = tagInput.trim()
    const final = calcularTagFinal(t)
    const yaEstaba = form.tags.some(x => x.toLowerCase() === final.toLowerCase())
    const tagsFinal = yaEstaba ? form.tags : [...form.tags, final]
    set('tags', tagsFinal)
    setTagInput('')
    setTagPendienteAbierto(false)
    ejecutarGuardado({ ...form, tags: tagsFinal })
  }

  // Opción "No, descartarlo" del aviso: guarda tal cual estaba, sin
  // sumar lo que quedó tipeado.
  function guardarSinAgregarTag() {
    setTagPendienteAbierto(false)
    ejecutarGuardado(form)
  }

  // Cierres implícitos del aviso (Escape, click en el backdrop, X del
  // header): vuelven al formulario SIN guardar nada. Acá "Cancelar" no
  // es un simple cerrar — guarda el pedido sin el tag — así que estos
  // cierres no pueden caer ahí: apretar Escape esperando descartar el
  // aviso terminaba guardando el pedido igual. Va como onDismiss del
  // ConfirmModal (prop nueva, opcional, ver ConfirmModal.jsx).
  function cerrarAvisoTagPendiente() {
    setTagPendienteAbierto(false)
  }

  function addTag(valorForzado) {
    const t = (valorForzado ?? tagInput).trim()
    if (!t) return
    // Si ya existe un tag igual ignorando mayúsculas/minúsculas, se
    // reusa la ortografía YA CARGADA en vez de la recién tipeada — esto
    // es lo que evita que "plazo fijo" y "Plazo Fijo" terminen siendo
    // dos tags distintos en la base.
    const final = calcularTagFinal(t)
    if (!form.tags.some(x => x.toLowerCase() === final.toLowerCase())) set('tags', [...form.tags, final])
    setTagInput('')
    setTagSugerenciasAbiertas(false)
  }

  // Sugerencias del autocompletado: tags existentes que contienen lo
  // tipeado (ignorando mayúsculas/minúsculas) y que todavía no están
  // agregados a este pedido. Tope de 6 para no tapar el formulario.
  const tagSugerencias = tagInput.trim()
    ? tagsExistentes
        .filter(et =>
          et.toLowerCase().includes(tagInput.trim().toLowerCase()) &&
          !form.tags.some(x => x.toLowerCase() === et.toLowerCase())
        )
        .slice(0, 6)
    : []

  useEffect(() => {
    function handleClickAfuera(e) {
      if (tagFieldRef.current && !tagFieldRef.current.contains(e.target)) setTagSugerenciasAbiertas(false)
    }
    document.addEventListener('mousedown', handleClickAfuera)
    return () => document.removeEventListener('mousedown', handleClickAfuera)
  }, [])

  function chipStyle(color, active) {
    if (active) return { color, borderColor: `${color}60`, background: `${color}20` }
    return { color }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">

        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Editar pedido' : 'Nuevo pedido'}</h2>
          <button onClick={onCancel} className="modal-close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">

          <div className="flex flex-col gap-8">

            <div className="flex flex-col gap-3">
              <div className="pf-section-header">
                <span className="pf-section-badge">1</span>
                <span className="pf-section-title">Datos del pedido</span>
              </div>

              <div className="pf-required-card">
                <div className="pf-required-card-header">
                  <FieldLabel done={!!form.asunto.trim()}>Asunto / origen del mail</FieldLabel>
                  <span className="pf-required-pill">Obligatorio</span>
                </div>
                <input value={form.asunto} onChange={e => set('asunto', e.target.value)}
                  placeholder="Ej: Campaña Día del Padre - ICBC" />
              </div>

              <div className="field">
                <FieldLabel done={!!form.descripcion.trim()}>
                  Descripción <span className="field-label-optional">opcional</span>
                </FieldLabel>
                <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                  rows={3} placeholder="Detalles del pedido…" />
              </div>
            </div>


            <div className="flex flex-col gap-5">
              <div className="pf-section-header">
                <span className="pf-section-badge">2</span>
                <span className="pf-section-title">Clasificación</span>
              </div>

              <div>
                <div className="pf-category-header">
                  <span className="pf-category-icon" style={{ background: 'rgba(26,46,230,0.12)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#1A2EE6' }} />
                  </span>
                  <span className="pf-category-label">Tipo</span>
                </div>
                <div className="chip-group">
                  {tipos.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => set('tipo', t.value)}
                      className="chip" style={chipStyle(t.color, form.tipo === t.value)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="pf-category-header">
                  <span className="pf-category-icon" style={{ background: 'rgba(208,17,27,0.12)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="6" width="2" height="5" fill="#D0111B" /><rect x="5" y="3" width="2" height="8" fill="#D0111B" /><rect x="9" y="0" width="2" height="11" fill="#D0111B" /></svg>
                  </span>
                  <span className="pf-category-label">Prioridad</span>
                </div>
                <div className="chip-group">
                  {PRIORIDADES.map(p => (
                    <button key={p.value} type="button"
                      onClick={() => set('prioridad', p.value)}
                      className="chip" style={chipStyle(p.color, form.prioridad === p.value)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="pf-category-header">
                  <span className="pf-category-icon" style={{ background: 'rgba(91,78,232,0.12)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #5B4EE8' }} />
                  </span>
                  <span className="pf-category-label">Estado inicial <span className="pf-category-label-suffix">· múltiple</span></span>
                </div>
                <div className="chip-group">
                  {estados.map(e => {
                    const active = form.estados.includes(e.value)
                    return (
                      <button key={e.value} type="button"
                        onClick={() => set('estados', active
                          ? form.estados.filter(x => x !== e.value)
                          : [...form.estados, e.value]
                        )}
                        className="chip" style={chipStyle(e.color, active)}>
                        {e.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="pf-category-header">
                  <span className="pf-category-icon" style={{ background: 'rgba(14,165,233,0.12)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: '#0EA5E9' }} />
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: '#0EA5E9', opacity: 0.5, marginLeft: -2 }} />
                  </span>
                  <span className="pf-category-label">Instancia <span className="pf-category-label-suffix">opcional</span></span>
                </div>
                <div className="chip-group">
                  {instancias.map(i => (
                    <button key={i.value} type="button"
                      onClick={() => set('instancia', form.instancia === i.value ? '' : i.value)}
                      className="chip" style={chipStyle(i.color, form.instancia === i.value)}>
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="pf-category-header">
                  <span className="pf-category-icon" style={{ background: 'var(--bg-hover)' }}>
                    <span style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid var(--text-muted)' }} />
                  </span>
                  <span className="pf-category-label">Tipo de envío <span className="pf-category-label-suffix">opcional</span></span>
                </div>
                <div className="chip-group">
                  {TIPOS_ENVIO.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => set('tipo_envio', form.tipo_envio === t.value ? '' : t.value)}
                      className="chip"
                      style={form.tipo_envio === t.value ? { background: 'rgba(91,78,232,0.1)', borderColor: 'rgba(91,78,232,0.4)', color: 'var(--icomm-violet)' } : {}}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {form.tipo_envio === 'otro' && (
                  <input value={form.tipo_envio_otro}
                    onChange={e => set('tipo_envio_otro', e.target.value)}
                    placeholder="Especificá el tipo de envío…"
                    style={{ marginTop: '0.5rem' }} />
                )}
              </div>
            </div>


            <div className="flex flex-col gap-3">
              <div className="pf-section-header">
                <span className="pf-section-badge">3</span>
                <span className="pf-section-title">Fechas</span>
              </div>

              <div className="field">
                <FieldLabel done={!!form.fecha_limite}>
                  Fecha límite <span className="field-label-optional">opcional</span>
                </FieldLabel>
                <DatePicker value={form.fecha_limite} onChange={val => set('fecha_limite', val)} />
              </div>

              <div className={`pf-fecha-real-card${cargarFechaCliente ? ' activo' : ''}`}>
                <label className="pf-fecha-real-checkbox-row">
                  <input type="checkbox" checked={cargarFechaCliente}
                    onChange={e => setCargarFechaCliente(e.target.checked)} />
                  <span className="pf-fecha-real-label">
                    Registrar fecha y hora efectiva del pedido
                    <HelpPopover>
                      La fecha y hora ingresadas se utilizarán para registrar el pedido en Google Sheets, en lugar de la fecha y hora de carga en la aplicación. Usá esta opción cuando el pedido se haya realizado antes de ser cargado en el sistema.
                    </HelpPopover>
                  </span>
                </label>
                {cargarFechaCliente && (
                  <div className="pf-fecha-real-fields">
                    <div>
                      <label>Fecha real *</label>
                      <DatePicker value={form.fecha_pedido_cliente} onChange={val => set('fecha_pedido_cliente', val)} placeholder="Fecha del pedido…" />
                    </div>
                    <div>
                      <label>Hora real *</label>
                      <input value={form.hora_pedido_cliente} onChange={e => set('hora_pedido_cliente', e.target.value)}
                        placeholder="HH:MM" maxLength={5} />
                    </div>
                  </div>
                )}
              </div>
            </div>


            <div className="flex flex-col gap-5">
              <div className="pf-section-header">
                <span className="pf-section-badge">4</span>
                <span className="pf-section-title">Equipo y tags</span>
              </div>

              <div>
                <div className="pf-category-header">
                  <span className="pf-category-icon" style={{ background: 'rgba(13,148,136,0.12)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#0D9488' }} />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#0D9488', opacity: 0.5, marginLeft: -4 }} />
                  </span>
                  <span className="pf-category-label">Asignar a</span>
                </div>
                <div className="chip-group">
                  {usuarios.map(u => {
                    const active = form.asignados.includes(u.id)
                    return (
                      <button key={u.id} type="button"
                        onClick={() => set('asignados', active
                          ? form.asignados.filter(x => x !== u.id)
                          : [...form.asignados, u.id]
                        )}
                        className="chip"
                        style={active ? { background: 'rgba(208,17,27,0.1)', borderColor: 'rgba(208,17,27,0.4)', color: 'var(--icbc-red)' } : {}}>
                        <span className="avatar-xs" style={{ background: u.avatar_color || colorAvatar(u.id) }}>{iniciales(u.full_name)}</span>
                        {u.full_name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="field">
                <FieldLabel done={form.tags.length > 0}>
                  Tags <span className="field-label-optional">opcional</span>
                </FieldLabel>
                <div className="tag-input-row" ref={tagFieldRef} style={{ position:'relative' }}>
                  <input value={tagInput}
                    onChange={e => { setTagInput(e.target.value); setTagSugerenciasAbiertas(true) }}
                    onFocus={() => setTagSugerenciasAbiertas(true)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                    placeholder="Escribí y presioná Enter…" />
                  <button type="button" onClick={() => addTag()} className="btn-add-tag" aria-label="Agregar tag"><Plus size={16} strokeWidth={2.4} /></button>

                  {tagSugerenciasAbiertas && tagSugerencias.length > 0 && (
                    <div className="tag-sugerencias">
                      {tagSugerencias.map(s => (
                        <button key={s} type="button" className="tag-sugerencia-item" onClick={() => addTag(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.tags.length > 0 && (
                  <div className="tag-list">
                    {form.tags.map(t => (
                      <span key={t} className="tag-item">
                        {t}
                        <button type="button" onClick={() => set('tags', form.tags.filter(x => x !== t))}
                          className="tag-item-remove">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {error && <p className="msg-error" style={{ marginTop: '1rem' }}>{error}</p>}

          <div className="modal-footer">
            <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary"
              style={{ width: 'auto', minWidth: '9.5rem', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear pedido'}
            </button>
          </div>

        </form>
      </div>

      <ConfirmModal
        open={tagPendienteAbierto}
        variant="warning"
        title="Tenés un tag sin agregar"
        message={`Escribiste "${tagInput.trim()}" en Tags pero no lo agregaste con Enter o el +. ¿Lo sumamos antes de guardar?`}
        confirmLabel="Sí, agregarlo y guardar"
        cancelLabel="No, guardar sin agregarlo"
        onConfirm={confirmarAgregarTagYGuardar}
        onCancel={guardarSinAgregarTag}
        onDismiss={cerrarAvisoTagPendiente}
      />
    </div>
  )
}