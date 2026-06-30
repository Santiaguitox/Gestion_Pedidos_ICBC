import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DatePicker } from '@/components/ui/DatePicker'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function SheetDisenoModal({ pedido, subtarea, onClose, onConfirm }) {
  const [data, setData] = useState({
    nombre_campana: pedido.asunto ?? '',
    fecha_pedido:   format(new Date(subtarea.created_at), "dd/MM/yyyy", { locale: es }),
    hora_pedido:    format(new Date(subtarea.created_at), "HH:mm", { locale: es }),
    descripcion:    subtarea.descripcion ?? '',
    fecha_entrega:  subtarea.completada_at ? format(new Date(subtarea.completada_at), "yyyy-MM-dd") : '',
    hora_entrega:   subtarea.completada_at ? format(new Date(subtarea.completada_at), "HH:mm") : '',
    aclaraciones:   '',
    fueraDeHora:    false,
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  async function handleConfirm() {
    setSaving(true)
    const fechaFmt = data.fecha_entrega ? format(new Date(data.fecha_entrega + 'T00:00:00'), "dd/MM/yyyy") : ''
    await onConfirm({ ...data, fecha_entrega: fechaFmt })
    setSaving(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Registrar tarea de diseño</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="text-muted-sm" style={{ marginBottom: '0.75rem' }}>Revisá y editá los datos antes de confirmar.</p>
          <div className="flex flex-col gap-2">
            <div className="sheet-field">
              <label className="field-label">Nombre de campaña</label>
              <input value={data.nombre_campana} onChange={e => set('nombre_campana', e.target.value)} placeholder="Nombre de campaña…" />
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
            <div className="sheet-field">
              <label className="field-label">Descripción</label>
              <input value={data.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción…" />
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Fecha entrega</label>
                <DatePicker value={data.fecha_entrega} onChange={val => set('fecha_entrega', val)} placeholder="Seleccionar fecha…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora entrega</label>
                <input value={data.hora_entrega} onChange={e => set('hora_entrega', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
            <div className="sheet-field">
              <label className="field-label">Aclaraciones</label>
              <input value={data.aclaraciones} onChange={e => set('aclaraciones', e.target.value)} placeholder="Aclaraciones…" />
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
