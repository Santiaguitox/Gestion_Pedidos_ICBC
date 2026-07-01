import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SuccessModal } from '@/components/pedidos/SuccessModal'
import { SheetDisenoModal } from '@/components/pedidos/SheetDisenoModal'
import { colorAvatar, iniciales } from '@/components/pedidos/PedidoCard'
import { Plus, Trash2, Check, FileSpreadsheet } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function SubtareasTimeline({ subtareas, canWrite, canEdit, usuarios, usuariosConArea, onToggle, onEliminar, onAgregar, pedido, showError }) {
  const [descripcion, setDescripcion] = useState('')
  const [asignadoA, setAsignadoA] = useState('')
  const [sheetDiseno, setSheetDiseno] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Color por área de equipo — las áreas reales son las definidas en
  // Usuarios.jsx (AREAS_EQUIPO): PM, Diseño, Programación, Comercial,
  // Otro/sin área. Mismo criterio visual que ya usa el resto de la app
  // (chip con fondo tintado al 12% + texto del color sólido).
  function colorArea(area) {
    if (area === 'Diseño') return { fg: '#1A2EE6', bg: 'rgba(26,46,230,0.1)' }
    if (area === 'Programación') return { fg: '#5B4EE8', bg: 'rgba(91,78,232,0.1)' }
    if (area === 'PM') return { fg: '#10B981', bg: 'rgba(16,185,129,0.1)' }
    if (area === 'Comercial') return { fg: '#F59E0B', bg: 'rgba(245,158,11,0.1)' }
    return { fg: '#6B7080', bg: 'rgba(107,112,128,0.1)' }
  }

  function handleAgregar() {
    if (!descripcion.trim()) return
    onAgregar(descripcion.trim(), asignadoA || null)
    setDescripcion(''); setAsignadoA('')
  }

  const completadas = subtareas.filter(s => s.completada).length
  const total = subtareas.length
  const progreso = total > 0 ? Math.round((completadas / total) * 100) : 0

  function esDiseno(userId) {
    return usuariosConArea.find(x => x.id === userId)?.area_equipo === 'Diseño'
  }

  async function handleRegistrarDiseno(data, subtarea) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escribir-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          hoja: 'diseno',
          data: [data.nombre_campana, data.fecha_pedido, data.hora_pedido, data.descripcion, data.fecha_entrega, data.hora_entrega, data.aclaraciones],
          fueraDeHora: !!data.fueraDeHora,
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Error al registrar')
      await supabase.from('subtareas').update({ registrado_sheet: true, registrado_sheet_at: new Date().toISOString() }).eq('id', subtarea.id)
      setSheetDiseno(null)
      setSuccessMsg('La tarea de diseño fue registrada en Google Sheets.')
    } catch (err) {
      showError(err.message || 'Error al registrar en Sheet')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {total > 0 && (
        <div className="subtareas-progreso">
          <div className="subtareas-progreso-header">
            <span className="subtareas-progreso-label">{completadas} de {total} completadas</span>
            <span className="subtareas-progreso-pct" style={{ color: progreso === 100 ? '#10B981' : 'var(--text-secondary)' }}>{progreso}%</span>
          </div>
          <div className="subtareas-progreso-bar">
            <div className="subtareas-progreso-fill" style={{ width: `${progreso}%`, background: progreso === 100 ? '#10B981' : 'var(--accent-primary)' }} />
          </div>
        </div>
      )}

      {subtareas.length === 0 && <p className="text-muted-sm">No hay subtareas.</p>}

      <div className="subtarea-list">
        {subtareas.map((s, i) => (
          <div key={s.id} className="subtarea-item">
            <div className="subtarea-timeline">
              <button onClick={() => canWrite && onToggle(s.id, s.completada)}
                disabled={!canWrite}
                className="subtarea-check"
                style={{ border: `2px solid ${s.completada ? '#10B981' : 'var(--border-strong)'}`, background: s.completada ? '#10B981' : 'var(--bg-elevated)', cursor: canWrite ? 'pointer' : 'default', opacity: canWrite ? 1 : 0.7 }}>
                {s.completada && <Check size={10} color="#fff" strokeWidth={3} />}
              </button>
              {i < subtareas.length - 1 && <div className="subtarea-line" />}
            </div>
            <div className="subtarea-content" style={{ paddingBottom: i < subtareas.length - 1 ? '0.75rem' : 0 }}>
              <div className="flex items-start gap-2">
                <span className={`subtarea-text ${s.completada ? 'subtarea-text-done' : ''}`}>{s.descripcion}</span>
                {canEdit && (
                  <button onClick={() => onEliminar(s.id)}
                    className="flex items-center shrink-0 text-[var(--text-muted)]"
                    style={{ opacity: 0.5, transition: 'opacity 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {s.profiles && (
                <div className="subtarea-asignado">
                  <span
                    className="avatar-xs-secondary"
                    style={{ background: s.profiles.avatar_color || colorAvatar(s.profiles.id) }}
                  >
                    {iniciales(s.profiles.full_name)}
                  </span>
                  <span className="subtarea-asignado-nombre">{s.profiles.full_name}</span>
                  {(() => {
                    const area = usuariosConArea.find(u => u.id === s.asignado_a)?.area_equipo
                    if (!area) return null
                    const c = colorArea(area)
                    return <span className="subtarea-area-chip" style={{ color: c.fg, background: c.bg }}>{area}</span>
                  })()}
                </div>
              )}
              {canEdit && s.asignado_a && esDiseno(s.asignado_a) && s.completada && (
                s.registrado_sheet ? (
                  <div className="flex items-center gap-1" style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#10B981' }}>
                    <Check size={12} strokeWidth={2.5} />
                    Registrado en Sheet
                    {s.registrado_sheet_at && ` · ${format(new Date(s.registrado_sheet_at), "d MMM HH:mm", { locale: es })}`}
                  </div>
                ) : (
                  <button onClick={() => setSheetDiseno(s)}
                    className="flex items-center gap-1"
                    style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--icomm-violet)', fontWeight: 500 }}>
                    <FileSpreadsheet size={13} />Registrar en Sheet
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="subtarea-add-form">
          <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAgregar()} placeholder="Nueva subtarea…" />
          <div className="subtarea-add-row">
            <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)} style={{ flex: 1, fontSize: '0.8125rem' }}>
              <option value="">Sin asignar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <button onClick={handleAgregar} className="btn-agregar-subtarea">
              <Plus size={15} />Agregar
            </button>
          </div>
        </div>
      )}

      {sheetDiseno && (
        <SheetDisenoModal
          pedido={pedido}
          subtarea={sheetDiseno}
          onClose={() => setSheetDiseno(null)}
          onConfirm={(data) => handleRegistrarDiseno(data, sheetDiseno)}
        />
      )}
      {successMsg && <SuccessModal message={successMsg} onClose={() => setSuccessMsg('')} />}
    </div>
  )
}
