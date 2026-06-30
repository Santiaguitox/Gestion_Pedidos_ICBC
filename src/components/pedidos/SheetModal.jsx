import { useState } from 'react'
import { DatePicker } from '@/components/ui/DatePicker'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { X, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPOS_ENVIO_LABELS = { test: 'Test', real: 'Real', otro: 'Otro' }

function nuevoGrupo() {
  return { id: `grupo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, dia: '', hora: '', piezaIds: [] }
}

// Selector de día/hora + multi-select de piezas para UN grupo. Las
// piezas ya asignadas a OTRO grupo no aparecen como opción acá — cada
// pieza solo puede pertenecer a un grupo a la vez.
function FilaGrupo({ grupo, piezasDisponibles, onChange, onEliminar, puedeEliminar }) {
  function togglePieza(id) {
    const yaEsta = grupo.piezaIds.includes(id)
    onChange({ ...grupo, piezaIds: yaEsta ? grupo.piezaIds.filter(p => p !== id) : [...grupo.piezaIds, id] })
  }

  return (
    <div className="sheet-grupo-card">
      <div className="sheet-grupo-header">
        <div className="sheet-grid-2" style={{ flex: 1 }}>
          <div className="sheet-field">
            <label className="field-label">Día</label>
            <DatePicker value={grupo.dia} onChange={val => onChange({ ...grupo, dia: val })} placeholder="Seleccionar fecha…" />
          </div>
          <div className="sheet-field">
            <label className="field-label">Hora</label>
            <input value={grupo.hora} onChange={e => onChange({ ...grupo, hora: e.target.value })} placeholder="HH:MM" maxLength={5} />
          </div>
        </div>
        <button type="button" className="sheet-grupo-eliminar" onClick={onEliminar} disabled={!puedeEliminar} title="Eliminar grupo">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="sheet-field">
        <label className="field-label">
          {grupo.piezaIds.length > 0 ? 'Piezas en este grupo' : 'Elegí cuáles van en este grupo'}
        </label>
        {grupo.piezaIds.length === 0 && piezasDisponibles.length > 0 && (
          <span className="sheet-grupo-piezas-hint">Ninguna pieza está asignada todavía — tocá para sumarlas a este grupo.</span>
        )}
        <div className="sheet-grupo-piezas">
          {piezasDisponibles.length === 0 && grupo.piezaIds.length === 0 && (
            <span className="sheet-grupo-piezas-vacio">No quedan piezas libres para asignar.</span>
          )}
          {piezasDisponibles.map(p => (
            <label key={p.id} className="sheet-grupo-pieza-chip">
              <input type="checkbox" checked={grupo.piezaIds.includes(p.id)} onChange={() => togglePieza(p.id)} />
              {p.nombre_pieza}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SheetModal({ pedido, entregables, onClose, onConfirm }) {
  const primeraAprobacion = entregables.find(e => e.aprobado_at)
  const fechaAprobRef = primeraAprobacion ? new Date(primeraAprobacion.aprobado_at) : new Date()
  const piezasConNombre = entregables.filter(e => e.nombre_pieza)
  const tieneMultiplesPiezas = piezasConNombre.length > 1

  const [data, setData] = useState({
    nombre_campana:    pedido.asunto ?? '',
    fecha_pedido:      format(new Date(pedido.created_at), "dd/MM/yyyy", { locale: es }),
    hora_pedido:       format(new Date(pedido.created_at), "HH:mm", { locale: es }),
    descripcion:       pedido.descripcion ?? '',
    instancia:         pedido.instancia ?? '',
    fecha_aprobacion:  format(fechaAprobRef, "yyyy-MM-dd"),
    hora_aprobacion:   format(fechaAprobRef, "HH:mm", { locale: es }),
    cantidad_envios:   String(pedido.cantidad_envios ?? piezasConNombre.length),
    aclaraciones:      pedido.tipo_envio === 'otro' ? (pedido.tipo_envio_otro ?? '') : (TIPOS_ENVIO_LABELS[pedido.tipo_envio] ?? ''),
    dia_programacion:  pedido.fecha_programacion ?? '',
    hora_programacion: pedido.hora_programacion ?? '',
    fueraDeHora:       false,
  })
  // Solo relevante si hay 2+ piezas: 'mismo' (comportamiento de
  // siempre, 1 día/hora para todo el pedido) o 'distinto' (editor de
  // grupos, 1 fila al Sheet por grupo).
  const [modoProgramacion, setModoProgramacion] = useState('mismo')
  const [grupos, setGrupos] = useState([nuevoGrupo()])
  const [confirmHuerfanas, setConfirmHuerfanas] = useState(null) // array de nombres de piezas sin grupo, o null
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  function actualizarGrupo(id, nuevo) {
    setGrupos(gs => gs.map(g => g.id === id ? nuevo : g))
  }
  function eliminarGrupo(id) {
    setGrupos(gs => gs.filter(g => g.id !== id))
  }
  function agregarGrupo() {
    setGrupos(gs => [...gs, nuevoGrupo()])
  }

  function piezasAsignadasEnOtroGrupo(grupoId) {
    return new Set(grupos.filter(g => g.id !== grupoId).flatMap(g => g.piezaIds))
  }

  function piezasSinAsignar() {
    const asignadas = new Set(grupos.flatMap(g => g.piezaIds))
    return piezasConNombre.filter(p => !asignadas.has(p.id))
  }

  // Arma el array de "filas" a registrar — 1 elemento si es el mismo
  // día para todo el pedido (comportamiento de siempre), o 1 elemento
  // por grupo si se cargaron días distintos. Todos los campos del
  // formulario se repiten igual entre filas, solo cambia
  // dia_programacion/hora_programacion según el grupo.
  //
  // Si quedaron piezas sin asignar a ningún grupo (el usuario decidió
  // continuar igual ante el aviso), 'cantidad_envios' se ajusta a la
  // cantidad REAL de piezas que terminan programadas (no el total del
  // pedido), y 'aclaraciones' suma un aviso de qué piezas quedaron
  // afuera — concatenado al final de lo que el usuario ya haya escrito
  // ahí, para no perder ese texto.
  function armarFilas() {
    const fechaAprobFmt = data.fecha_aprobacion ? format(new Date(data.fecha_aprobacion + 'T00:00:00'), "dd/MM/yyyy") : ''
    const base = { ...data, fecha_aprobacion: fechaAprobFmt }

    if (modoProgramacion === 'mismo' || !tieneMultiplesPiezas) {
      const diaFmt = data.dia_programacion ? format(new Date(data.dia_programacion + 'T00:00:00'), "dd/MM/yyyy") : ''
      return [{ ...base, dia_programacion: diaFmt }]
    }

    const huerfanas = piezasSinAsignar()
    const cantidadEfectiva = String(piezasConNombre.length - huerfanas.length)
    const avisoHuerfanas = huerfanas.length > 0
      ? `No se mandó: ${huerfanas.map(p => p.nombre_pieza).join(', ')}`
      : null
    const aclaracionesFinal = avisoHuerfanas
      ? (base.aclaraciones?.trim() ? `${base.aclaraciones.trim()} — ${avisoHuerfanas}` : avisoHuerfanas)
      : base.aclaraciones

    return grupos
      .filter(g => g.piezaIds.length > 0)
      .map(g => ({
        ...base,
        cantidad_envios: avisoHuerfanas ? cantidadEfectiva : base.cantidad_envios,
        aclaraciones: aclaracionesFinal,
        dia_programacion: g.dia ? format(new Date(g.dia + 'T00:00:00'), "dd/MM/yyyy") : '',
        hora_programacion: g.hora,
      }))
  }

  async function handleConfirm() {
    if (modoProgramacion === 'distinto' && tieneMultiplesPiezas) {
      const huerfanas = piezasSinAsignar()
      if (huerfanas.length > 0) {
        setConfirmHuerfanas(huerfanas.map(p => p.nombre_pieza))
        return
      }
    }
    await ejecutarConfirm()
  }

  async function ejecutarConfirm() {
    setSaving(true)
    setConfirmHuerfanas(null)
    await onConfirm(armarFilas())
    setSaving(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Registrar en Google Sheets</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="text-muted-sm" style={{ marginBottom: '0.75rem' }}>Revisá y editá los datos antes de confirmar el registro.</p>
          <div className="flex flex-col gap-2">
            <div className="sheet-field">
              <label className="field-label">Nombre de campaña</label>
              <input value={data.nombre_campana} onChange={e => set('nombre_campana', e.target.value)} placeholder="Nombre de campaña…" />
            </div>
            <div className="sheet-field">
              <label className="field-label">Descripción</label>
              <input value={data.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción…" />
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Fecha pedido</label>
                <input value={data.fecha_pedido} onChange={e => set('fecha_pedido', e.target.value)} placeholder="Fecha pedido…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora pedido</label>
                <input value={data.hora_pedido} onChange={e => set('hora_pedido', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Instancia</label>
                <input value={data.instancia} onChange={e => set('instancia', e.target.value)} placeholder="Instancia…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Cantidad envíos</label>
                <input value={data.cantidad_envios} onChange={e => set('cantidad_envios', e.target.value)} placeholder="Cantidad…" />
              </div>
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Fecha aprobación</label>
                <DatePicker value={data.fecha_aprobacion} onChange={val => set('fecha_aprobacion', val)} placeholder="Seleccionar fecha…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora aprobación</label>
                <input value={data.hora_aprobacion} onChange={e => set('hora_aprobacion', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
            <div className="sheet-field">
              <label className="field-label">Aclaraciones</label>
              <input value={data.aclaraciones} onChange={e => set('aclaraciones', e.target.value)} placeholder="Aclaraciones…" />
            </div>

            {tieneMultiplesPiezas && (
              <div className="sheet-field">
                <label className="field-label">¿Todas las piezas se configuran el mismo día y horario?</label>
                <div className="sheet-toggle-mismo-dia">
                  <button type="button"
                    className={`sheet-toggle-opcion${modoProgramacion === 'mismo' ? ' activo' : ''}`}
                    onClick={() => setModoProgramacion('mismo')}>
                    Sí, mismo día y horario
                  </button>
                  <button type="button"
                    className={`sheet-toggle-opcion${modoProgramacion === 'distinto' ? ' activo' : ''}`}
                    onClick={() => setModoProgramacion('distinto')}>
                    No, varía por pieza
                  </button>
                </div>
              </div>
            )}

            {modoProgramacion === 'mismo' || !tieneMultiplesPiezas ? (
              <div className="sheet-grid-2">
                <div className="sheet-field">
                  <label className="field-label">Día de programación</label>
                  <DatePicker value={data.dia_programacion} onChange={val => set('dia_programacion', val)} placeholder="Seleccionar fecha…" />
                </div>
                <div className="sheet-field">
                  <label className="field-label">Hora programación</label>
                  <input value={data.hora_programacion} onChange={e => set('hora_programacion', e.target.value)} placeholder="HH:MM" maxLength={5} />
                </div>
              </div>
            ) : (
              <div className="sheet-grupos-wrap">
                {grupos.map(grupo => (
                  <FilaGrupo
                    key={grupo.id}
                    grupo={grupo}
                    piezasDisponibles={piezasConNombre.filter(p => !piezasAsignadasEnOtroGrupo(grupo.id).has(p.id))}
                    onChange={nuevo => actualizarGrupo(grupo.id, nuevo)}
                    onEliminar={() => eliminarGrupo(grupo.id)}
                    puedeEliminar={grupos.length > 1}
                  />
                ))}
                <button type="button" className="sheet-btn-agregar-grupo" onClick={agregarGrupo}>
                  <Plus size={14} /> Agregar grupo
                </button>
                <p className="ap-hint" style={{ margin: 0 }}>
                  Se va a registrar una fila en el Sheet por cada grupo con piezas asignadas — el resto de los datos del pedido se repite igual en todas.
                </p>
              </div>
            )}

            <label className="sheet-checkbox-fuera-hora">
              <input type="checkbox" checked={data.fueraDeHora} onChange={e => set('fueraDeHora', e.target.checked)} />
              Pedido fuera de hora
            </label>
          </div>
          <div className="modal-footer" style={{ marginTop: '1.25rem' }}>
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={handleConfirm} disabled={saving} className="btn-primary"
              style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Registrando…' : 'Confirmar y registrar'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!confirmHuerfanas}
        variant="warning"
        title="Hay piezas sin grupo asignado"
        message={confirmHuerfanas ? `Vas a dejar sin registrar: ${confirmHuerfanas.join(', ')}. ¿Continuar igual?` : ''}
        confirmLabel="Continuar igual"
        cancelLabel="Volver a asignarlas"
        onConfirm={ejecutarConfirm}
        onCancel={() => setConfirmHuerfanas(null)}
      />
    </div>
  )
}
