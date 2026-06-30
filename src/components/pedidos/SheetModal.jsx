import { useState } from 'react'
import { DatePicker } from '@/components/ui/DatePicker'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPOS_ENVIO_LABELS = { test: 'Test', real: 'Real', otro: 'Otro' }

export function SheetModal({ pedido, entregables, onClose, onConfirm }) {
  const primeraAprobacion = entregables.find(e => e.aprobado_at)
  const fechaAprobRef = primeraAprobacion ? new Date(primeraAprobacion.aprobado_at) : new Date()

  const [data, setData] = useState({
    nombre_campana:    pedido.asunto ?? '',
    fecha_pedido:      format(new Date(pedido.created_at), "dd/MM/yyyy", { locale: es }),
    hora_pedido:       format(new Date(pedido.created_at), "HH:mm", { locale: es }),
    descripcion:       pedido.descripcion ?? '',
    instancia:         pedido.instancia ?? '',
    fecha_aprobacion:  format(fechaAprobRef, "yyyy-MM-dd"),
    hora_aprobacion:   format(fechaAprobRef, "HH:mm", { locale: es }),
    cantidad_envios:   String(pedido.cantidad_envios ?? entregables.filter(e => e.nombre_pieza).length),
    aclaraciones:      pedido.tipo_envio === 'otro' ? (pedido.tipo_envio_otro ?? '') : (TIPOS_ENVIO_LABELS[pedido.tipo_envio] ?? ''),
    dia_programacion:  pedido.fecha_programacion ?? '',
    hora_programacion: pedido.hora_programacion ?? '',
    fueraDeHora:       false,
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  async function handleConfirm() {
    setSaving(true)
    const diaFmt        = data.dia_programacion ? format(new Date(data.dia_programacion + 'T00:00:00'), "dd/MM/yyyy") : ''
    const fechaAprobFmt = data.fecha_aprobacion ? format(new Date(data.fecha_aprobacion + 'T00:00:00'), "dd/MM/yyyy") : ''
    await onConfirm({ ...data, dia_programacion: diaFmt, fecha_aprobacion: fechaAprobFmt })
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
    </div>
  )
}
