import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CopyBtn } from '@/components/pedidos/CopyBtn'
import { ExternalLink, Plus, Trash2, Lock, Unlock, Copy, Check } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

function EntregableItem({ ent, canWrite, isSuperAdmin, onUpdate, onEliminar, otrosEntregables, setConfirm }) {
  const [form, setForm] = useState({ nombre_pieza: ent.nombre_pieza ?? '', link_online: ent.link_online ?? '' })
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState('')
  const bloqueado = ent.aprobado && !isSuperAdmin

  async function guardarCambios() {
    setSaving(true)
    await supabase.from('entregable').update(form).eq('id', ent.id)
    setSaving(false); setEditando(false); setError(''); onUpdate()
  }

  function guardar() {
    setError('')
    const nombre = form.nombre_pieza.trim()
    const link = form.link_online.trim()

    // Misma regla que al cargar una pieza nueva (ver EntregablesSection):
    // el link debe ser único dentro del pedido, comparado contra el
    // resto de las piezas (no contra sí misma).
    if (link && otrosEntregables.some(e => e.link_online?.trim() === link)) {
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
            <div className="entregable-field-row">
              <span className="entregable-field-key">Link:</span>
              <span className="entregable-field-link">{ent.link_online}</span>
              <CopyBtn text={ent.link_online} />
              <a href={ent.link_online} target="_blank" rel="noopener" className="entregable-link-icon">
                <ExternalLink size={13} />
              </a>
            </div>
          )}
          {ent.aprobado && ent.aprobado_at && (
            <span className="entregable-aprobado-fecha">
              Aprobada el {format(new Date(ent.aprobado_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
            </span>
          )}
          {bloqueado && <span className="entregable-bloqueado-msg">Aprobada — para modificar generá una nueva versión</span>}
        </div>
      )}
    </div>
  )
}

export function EntregablesSection({ pedidoId, entregables, canWrite, isSuperAdmin, onUpdate, setConfirm }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre_pieza: '', link_online: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function insertarPieza() {
    setSaving(true)
    await supabase.from('entregable').insert({ ...form, pedido_id: pedidoId })
    setForm({ nombre_pieza: '', link_online: '' }); setShowForm(false); setSaving(false); setError(''); onUpdate()
  }

  function agregar() {
    const nombre = form.nombre_pieza.trim()
    if (!nombre) return
    setError('')

    // El LINK debe ser único dentro del mismo pedido — no tiene sentido
    // de negocio que dos piezas distintas apunten al mismo recurso
    // publicado, así que esto se bloquea directamente, sin posibilidad
    // de continuar.
    const link = form.link_online.trim()
    if (link && entregables.some(e => e.link_online?.trim() === link)) {
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

  return (
    <div className="flex flex-col gap-3">
      {entregables.length === 0 && !showForm && <p className="text-muted-sm">No hay piezas cargadas.</p>}
      {entregables.map(ent => (
        <EntregableItem key={ent.id} ent={ent} canWrite={canWrite} isSuperAdmin={isSuperAdmin} onUpdate={onUpdate} onEliminar={eliminar}
          otrosEntregables={entregables.filter(e => e.id !== ent.id)} setConfirm={setConfirm} />
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
