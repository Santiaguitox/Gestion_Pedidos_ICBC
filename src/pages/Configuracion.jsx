import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/useAuth'
import { ROLES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { useInstancias } from '@/hooks/useInstancias'
import { useNotificaciones } from '@/context/useNotificaciones'
import { Plus, Trash2, Check, X, ChevronDown, ChevronUp, Tag, Search } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useLocalStorage } from '@/hooks/useLocalStorage'

const COLORES_SUGERIDOS = [
  '#8B5CF6','#3B82F6','#F59E0B','#EC4899','#10B981','#059669',
  '#EF4444','#F97316','#6B7280','#0EA5E9','#D0111B','#5B4EE8',
]

function ColorPicker({ value, onChange }) {
  const [custom, setCustom] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <div className="color-swatches">
        {COLORES_SUGERIDOS.map(c => (
          <button key={c} onClick={() => { onChange(c); setCustom(false) }}
            className="color-swatch"
            style={{ background: c, border: value === c ? '2px solid var(--text-primary)' : '2px solid transparent' }} />
        ))}
        <button onClick={() => setCustom(v => !v)}
          className="color-swatch-custom"
          style={{ background: COLORES_SUGERIDOS.includes(value) ? 'var(--bg-hover)' : value }}>
          {COLORES_SUGERIDOS.includes(value) ? '+' : ''}
        </button>
      </div>
      {custom && (
        <div className="color-input-row">
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="color-input-native" />
          <span className="text-muted-sm" style={{ fontFamily: 'monospace' }}>{value}</span>
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, tabla, onSave, onDelete, showSuccess, showError }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ label: item.label, color: item.color })
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!form.label.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from(tabla).update({ label: form.label.trim(), color: form.color }).eq('id', item.id)
      if (error) throw error
      setEditando(false)
      onSave()
      showSuccess('Cambios guardados')
    } catch (err) {
      showError(err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  function cancelar() { setForm({ label: item.label, color: item.color }); setEditando(false) }

  return (
    <div className="panel" style={{ padding: '0.875rem 1rem' }}>
      {editando ? (
        <div className="flex flex-col gap-3">
          <div className="config-item-row">
            <div className="config-color-dot" style={{ background: form.color }} />
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              style={{ flex: 1, fontSize: '0.875rem' }} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') cancelar() }} />
            <button onClick={guardar} disabled={saving} className="btn-primary"
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.75rem', fontSize: '0.8125rem', opacity: saving ? 0.6 : 1 }}>
              <Check size={13} />Guardar
            </button>
            <button onClick={cancelar} className="modal-close"><X size={15} /></button>
          </div>
          <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
        </div>
      ) : (
        <div className="config-item-row">
          <div className="config-color-dot" style={{ background: item.color }} />
          <span className="config-item-label">{item.label}</span>
          <span className="config-item-hex">{item.color}</span>
          <button onClick={() => setEditando(true)} className="btn-editar-ent">Editar</button>
          <button onClick={() => onDelete(item.id)}
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', opacity: 0.5, transition: 'opacity 150ms' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function SeccionConfig({ titulo, descripcion, items, tabla, loading, refetch, nombreItem, storageKey, defaultColor = '#6B7280' }) {
  const [open, setOpen] = useLocalStorage(storageKey, true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ value: '', label: '', color: defaultColor })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const { showSuccess, showError } = useNotificaciones()

  async function agregar() {
    setError('')
    if (!form.label.trim() || !form.value.trim()) { setError('Completá nombre y clave.'); return }
    setSaving(true)
    try {
      const { error: err } = await supabase.from(tabla).insert({
        value: form.value.trim().toLowerCase().replace(/\s+/g, '_'),
        label: form.label.trim(), color: form.color, orden: items.length,
      })
      if (err) throw err
      setForm({ value: '', label: '', color: defaultColor })
      setShowForm(false)
      refetch()
      showSuccess(`${nombreItem} creado correctamente`)
    } catch (err) {
      setError(err.message)
      showError(err.message || `No se pudo crear el ${nombreItem.toLowerCase()}`)
    } finally {
      setSaving(false)
    }
  }

  function eliminar(id) { setConfirmEliminar(id) }

  async function confirmarEliminar() {
    try {
      const { error } = await supabase.from(tabla).delete().eq('id', confirmEliminar)
      if (error) throw error
      setConfirmEliminar(null)
      refetch()
      showSuccess(`${nombreItem} eliminado`)
    } catch (err) {
      setConfirmEliminar(null)
      showError(err.message || `No se pudo eliminar el ${nombreItem.toLowerCase()}`)
    }
  }

  function handleLabel(val) {
    setForm(f => ({
      ...f, label: val,
      value: val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    }))
  }

  return (
    <>
      <div className="config-section">
        <div className="config-section-header" onClick={() => setOpen(v => !v)}>
          <div>
            <h2 className="config-section-title">{titulo}</h2>
            {descripcion && <p className="config-section-desc">{descripcion}</p>}
          </div>
          <div className="flex items-center gap-[0.625rem]">
            <span className="config-section-count">{items.length}</span>
            {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
          </div>
        </div>

        <div className={`acordeon-anim${open ? ' abierto' : ''}`}>
        <div className="acordeon-anim-clip">
          <div className="config-section-body">
            <div className="config-section-toolbar">
              <button onClick={() => { setShowForm(v => !v); setError('') }} className="btn-header-action">
                <Plus size={14} />Nuevo {nombreItem.toLowerCase()}
              </button>
            </div>

            {showForm && (
              <div className="config-add-form">
                <div className="field-grid-2">
                  <div className="field">
                    <label className="field-label">Nombre <span style={{ color: 'var(--icbc-red)' }}>*</span></label>
                    <input value={form.label} onChange={e => handleLabel(e.target.value)}
                      placeholder={`Ej: Nuevo ${nombreItem.toLowerCase()}`} autoFocus />
                  </div>
                  <div className="field">
                    <label className="field-label">Clave interna <span style={{ color: 'var(--icbc-red)' }}>*</span></label>
                    <input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="clave_interna" />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Color</label>
                  <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
                </div>
                {error && <p className="msg-error">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowForm(false); setError('') }} className="btn-secondary">Cancelar</button>
                  <button onClick={agregar} disabled={saving} className="btn-primary"
                    style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Guardando…' : `Guardar ${nombreItem.toLowerCase()}`}
                  </button>
                </div>
              </div>
            )}

            {loading && <p className="text-muted-sm">Cargando…</p>}
            <div className="flex flex-col gap-2">
              {items.map(item => (
                <ItemRow
                  key={item.id} item={item} tabla={tabla}
                  onSave={refetch} onDelete={eliminar}
                  showSuccess={showSuccess} showError={showError}
                />
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>

      {confirmEliminar && (
        <ConfirmModal
          open={true}
          title={`¿Eliminar este ${nombreItem.toLowerCase()}?`}
          message="Los pedidos que lo tengan asignado lo perderán."
          onConfirm={confirmarEliminar}
          onCancel={() => setConfirmEliminar(null)}
        />
      )}
    </>
  )
}

// Fetch puro a nivel de módulo: trae los tags únicos de TODOS los
// pedidos (papelera incluida, ver comentario de SeccionTags) y devuelve
// la lista procesada, o null si falló. Vive afuera del componente para
// que el efecto de montaje pueda consumirlo vía .then sin disparar la
// regla react-hooks/set-state-in-effect — esa regla rastrea el grafo de
// llamadas: cualquier función del componente que haga setState, invocada
// desde el cuerpo del efecto, cuenta como setState sincrónico aunque
// esté detrás de un await (lección React 19 del proyecto).
async function fetchTagsUnicos() {
  const { data, error } = await supabase.from('pedidos').select('tags, deleted_at')
  if (error) return null
  const mapa = new Map()
  for (const p of data ?? []) {
    for (const t of p.tags ?? []) {
      const e = mapa.get(t) ?? { nombre: t, cantidad: 0, activos: 0 }
      e.cantidad += 1
      if (!p.deleted_at) e.activos += 1
      mapa.set(t, e)
    }
  }
  return [...mapa.values()]
    .map(({ nombre, cantidad, activos }) => ({ nombre, cantidad, soloPapelera: activos === 0 }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}


// ─── Tags: unificar / renombrar (solo super_admin) ──────────────────────────
// Los tags no viven en una tabla propia: son un text[] adentro de cada
// pedido, así que no hay ItemRow/tabla que editar — la edición es una
// operación masiva sobre pedidos y va por la RPC unificar_tags
// (migración 20260711030000, security definer con gate de super_admin).
//
// Un solo flujo cubre los dos casos: seleccionar 1 tag = renombrarlo;
// seleccionar 2+ = unificarlos bajo el nombre final (ej. "Prestamos" +
// "Préstamos" → "Préstamos"). El nombre final puede ser uno de los
// seleccionados (click en su chip) o algo nuevo tipeado.
//
// La lista incluye tags que solo existen en pedidos de la PAPELERA
// (marcados con un badge): son justamente los que conviene limpiar antes
// de que una restauración los reintroduzca al selector.
function SeccionTags() {
  const [open, setOpen] = useLocalStorage('config:tagsOpen', true)
  const [tags, setTags] = useState([])           // [{ nombre, cantidad, soloPapelera }]
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [seleccion, setSeleccion] = useState([]) // nombres, en orden de selección
  const [nombreFinal, setNombreFinal] = useState('')
  const [confirmAbierto, setConfirmAbierto] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const { showSuccess, showError } = useNotificaciones()

  async function cargarTags() {
    // Refetch silencioso post-aplicar (se llama desde un event handler,
    // acá la regla de efectos no aplica): la lista queda visible y se
    // actualiza sola, sin flash de "Cargando…".
    const lista = await fetchTagsUnicos()
    if (lista === null) { showError('No se pudieron cargar los tags'); return }
    setTags(lista)
  }

  // Carga inicial: setState únicamente adentro del callback .then (no en
  // el cuerpo del efecto ni en una función del componente llamada desde
  // él) — es el único patrón de fetch-on-mount que pasa la regla
  // react-hooks/set-state-in-effect de React 19.
  useEffect(() => {
    let cancelado = false
    fetchTagsUnicos().then(lista => {
      if (cancelado) return
      if (lista === null) { setLoading(false); showError('No se pudieron cargar los tags'); return }
      setTags(lista)
      setLoading(false)
    })
    return () => { cancelado = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTag(nombre) {
    setSeleccion(sel => sel.includes(nombre) ? sel.filter(t => t !== nombre) : [...sel, nombre])
  }

  function limpiarSeleccion() {
    setSeleccion([])
    setNombreFinal('')
  }

  const filtrados = buscar.trim()
    ? tags.filter(t => t.nombre.toLowerCase().includes(buscar.trim().toLowerCase()))
    : tags

  const final = nombreFinal.trim()
  // Renombrar un tag a su mismo nombre exacto es un no-op — el botón no
  // se habilita. Con 2+ seleccionados el final SÍ puede (y suele) ser
  // uno de ellos: la RPC lo excluye de la lista de viejos y no toca los
  // pedidos que solo tienen ese.
  const esNoOp = seleccion.length === 1 && final === seleccion[0]
  const puedeAplicar = seleccion.length > 0 && final !== '' && !esNoOp && !aplicando

  async function aplicar() {
    setAplicando(true)
    try {
      const { data, error } = await supabase.rpc('unificar_tags', {
        p_tags_viejos: seleccion,
        p_tag_nuevo: final,
      })
      if (error) throw error
      showSuccess(
        data === 0
          ? 'No había pedidos para actualizar'
          : `Listo: ${data} pedido${data === 1 ? '' : 's'} actualizado${data === 1 ? '' : 's'}`
      )
      limpiarSeleccion()
      setBuscar('')
      cargarTags()
    } catch (err) {
      showError(err.message || 'No se pudo aplicar el cambio')
    } finally {
      setAplicando(false)
      setConfirmAbierto(false)
    }
  }

  const esRenombre = seleccion.length === 1

  return (
    <>
      <div className="config-section">
        <div className="config-section-header" onClick={() => setOpen(v => !v)}>
          <div>
            <h2 className="config-section-title">Tags</h2>
            <p className="config-section-desc">Renombrá un tag o unificá varios bajo un mismo nombre, en todos los pedidos</p>
          </div>
          <div className="flex items-center gap-[0.625rem]">
            <span className="config-section-count">{tags.length}</span>
            {open ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
          </div>
        </div>

        <div className={`acordeon-anim${open ? ' abierto' : ''}`}>
        <div className="acordeon-anim-clip">
          <div className="config-section-body">
            <div className="field" style={{ paddingTop: '0.75rem' }}>
              <div className="flex items-center gap-2" style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.625rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input value={buscar} onChange={e => setBuscar(e.target.value)}
                  placeholder="Buscar tag…" style={{ flex: 1, paddingLeft: '2rem' }} />
              </div>
            </div>

            {loading && <p className="text-muted-sm">Cargando…</p>}

            {!loading && (
              <div className="tags-admin-list">
                {filtrados.length === 0 && (
                  <p className="text-muted-sm" style={{ padding: '0.5rem 0.625rem' }}>
                    {tags.length === 0 ? 'No hay tags cargados en ningún pedido.' : 'Sin resultados para la búsqueda.'}
                  </p>
                )}
                {filtrados.map(t => {
                  const sel = seleccion.includes(t.nombre)
                  return (
                    <button key={t.nombre} type="button" onClick={() => toggleTag(t.nombre)}
                      className={`tags-admin-row${sel ? ' sel' : ''}`}>
                      <span className="tags-admin-check">{sel && <Check size={11} strokeWidth={3} />}</span>
                      <Tag size={11} style={{ flexShrink: 0, color: sel ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span>
                      {t.soloPapelera && <span className="tags-admin-papelera">solo papelera</span>}
                      <span className="tags-admin-count">{t.cantidad} pedido{t.cantidad === 1 ? '' : 's'}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {seleccion.length > 0 && (
              <div className="tags-admin-panel">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {esRenombre ? 'Renombrar tag' : `Unificar ${seleccion.length} tags`}
                  </span>
                  <button type="button" onClick={limpiarSeleccion} className="modal-close" aria-label="Limpiar selección"><X size={14} /></button>
                </div>

                <div className="tags-admin-chips">
                  {seleccion.map(t => (
                    <button key={t} type="button" title="Usar como nombre final"
                      onClick={() => setNombreFinal(t)}
                      className={`tags-admin-chip${final === t ? ' es-final' : ''}`}>
                      <Tag size={10} />{t}
                    </button>
                  ))}
                </div>

                <div className="field">
                  <label className="field-label">Nombre final <span style={{ color: 'var(--icbc-red)' }}>*</span></label>
                  <input value={nombreFinal} onChange={e => setNombreFinal(e.target.value)}
                    placeholder={esRenombre ? 'Nuevo nombre del tag' : 'Tocá un chip o escribí el nombre final'}
                    onKeyDown={e => { if (e.key === 'Enter' && puedeAplicar) setConfirmAbierto(true) }} />
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={() => setConfirmAbierto(true)} disabled={!puedeAplicar}
                    className="btn-primary" style={{ width: 'auto', opacity: puedeAplicar ? 1 : 0.5 }}>
                    {aplicando ? 'Aplicando…' : esRenombre ? 'Renombrar' : 'Unificar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmAbierto}
        variant="warning"
        title={esRenombre ? '¿Renombrar este tag?' : `¿Unificar estos ${seleccion.length} tags?`}
        message={`${seleccion.map(t => `"${t}"`).join(', ')} → "${final}". Se aplica a todos los pedidos que los tengan, incluidos los de la papelera. Esta acción no se puede deshacer.`}
        confirmLabel={esRenombre ? 'Sí, renombrar' : 'Sí, unificar'}
        cancelLabel="Cancelar"
        onConfirm={aplicar}
        onCancel={() => setConfirmAbierto(false)}
      />
    </>
  )
}

export default function Configuracion() {
  useDocumentTitle('Configuración')

  const { estados, loading: loadingEstados, refetch: refetchEstados } = useEstados()
  const { tipos, loading: loadingTipos, refetch: refetchTipos } = useTipos()
  const { instancias, loading: loadingInstancias, refetch: refetchInstancias } = useInstancias()
  const { role } = useAuth()

  return (
    <div className="page-root" style={{ maxWidth: '600px' }}>
      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">Gestioná los estados, tipos e instancias disponibles para los pedidos</p>
      </div>
      <SeccionConfig titulo="Estados de pedidos" descripcion="Estados que se pueden asignar a un pedido" items={estados} tabla="estados" loading={loadingEstados} refetch={refetchEstados} nombreItem="Estado" storageKey="config:estadosOpen" defaultColor="#6B7280" />
      <SeccionConfig titulo="Tipos de pedido" descripcion="Tipos disponibles al crear un pedido" items={tipos} tabla="tipos" loading={loadingTipos} refetch={refetchTipos} nombreItem="Tipo" storageKey="config:tiposOpen" defaultColor="#6B7280" />
      <SeccionConfig titulo="Instancias" descripcion="Plataformas de envío disponibles" items={instancias} tabla="instancias" loading={loadingInstancias} refetch={refetchInstancias} nombreItem="Instancia" storageKey="config:instanciasOpen" defaultColor="#6B7280" />
      {role === ROLES.SUPER_ADMIN && <SeccionTags />}
    </div>
  )
}