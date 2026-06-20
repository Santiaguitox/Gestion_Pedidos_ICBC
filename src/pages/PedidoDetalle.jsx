import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePedidos } from '@/hooks/usePedidos'
import { useAuth } from '@/context/AuthContext'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { useInstancias } from '@/hooks/useInstancias'
import { Badge } from '@/components/ui/Badge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import PedidoForm from '@/components/pedidos/PedidoForm'
import { Section } from '@/components/pedidos/Section'
import { EstadoPopover } from '@/components/pedidos/EstadoPopover'
import { SubtareasTimeline } from '@/components/pedidos/SubtareasTimeline'
import { EntregablesSection } from '@/components/pedidos/EntregablesSection'
import { PedidoHistorial } from '@/components/pedidos/PedidoHistorial'
import { SheetModal } from '@/components/pedidos/SheetModal'
import { SuccessModal } from '@/components/pedidos/SuccessModal'
import { ArrowLeft, Edit, Trash2, Clock, FileSpreadsheet } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function PedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const backTo = state?.from ?? '/app/pedidos'
  const backLabel = backTo === '/app' ? 'Dashboard' : backTo === '/app/calendario' ? 'Calendario' : backTo === '/app/notificaciones' ? 'Notificaciones' : 'Pedidos'
  const { role, user } = useAuth()
  const { showSuccess, showError } = useNotificaciones()
  const { actualizarPedido, eliminarPedido } = usePedidos()
  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [usuariosConArea, setUsuariosConArea] = useState([])
  const [showSheet, setShowSheet] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const { estados } = useEstados()
  const { tipos } = useTipos()
  const { instancias } = useInstancias()

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, area_equipo').order('full_name').then(({ data }) => {
      setUsuarios(data ?? [])
      setUsuariosConArea(data ?? [])
    })
  }, [])

  const queryPedido = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_asignados(user_id, profiles(id,full_name)), subtareas(*, profiles:asignado_a(full_name)), entregable(*)')
      .eq('id', id).single()
    return data
  }, [id])

  // Wrapper con setState, usado por los handlers de abajo y pasado como
  // prop onUpdate a componentes hijos (EstadoPopover, etc.).
  async function fetchPedido() {
    const data = await queryPedido()
    setPedido(data)
    setLoading(false)
  }

  useEffect(() => {
    queryPedido().then(data => { setPedido(data); setLoading(false) })
  }, [queryPedido])

  async function handleEdit(data) { await actualizarPedido(id, data); setEditando(false); fetchPedido() }

  function handleDelete() {
    setConfirm({
      title: 'Eliminar pedido',
      message: 'El pedido se moverá a la papelera y podrás restaurarlo desde ahí.',
      onConfirm: async () => { setConfirm(null); await eliminarPedido(id); navigate(backTo) }
    })
  }

  async function agregarSubtarea(descripcion, asignadoA) {
    await supabase.from('subtareas').insert({ pedido_id: id, descripcion, asignado_a: asignadoA })
    if (asignadoA && asignadoA !== user?.id) {
      await supabase.from('notificaciones').insert({
        user_id: asignadoA, pedido_id: id,
        mensaje: `Te asignaron una subtarea en "${pedido.asunto}": ${descripcion}`,
        leida: false
      })
    }
    fetchPedido()
  }

  async function toggleSubtarea(subId, completada) {
    await supabase.from('subtareas').update({
      completada: !completada,
      completada_at: !completada ? new Date().toISOString() : null
    }).eq('id', subId)
    fetchPedido()
  }

  async function eliminarSubtarea(subId) {
    await supabase.from('subtareas').delete().eq('id', subId)
    fetchPedido()
  }

  async function handleRegistrarSheet(data) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escribir-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          hoja: 'pedidos',
          data: [data.nombre_campana, data.fecha_pedido, data.hora_pedido, data.descripcion, data.instancia, data.fecha_aprobacion, data.hora_aprobacion, data.cantidad_envios, data.aclaraciones, data.dia_programacion, data.hora_programacion]
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Error al registrar en Sheet')
      setShowSheet(false)
      setSuccessMsg('El pedido fue registrado en Google Sheets correctamente.')
    } catch (err) {
      showError(err.message || 'Error al registrar en Sheet')
    }
  }

  if (loading) return <div className="loading-text">Cargando…</div>
  if (!pedido) return <div className="loading-text">Pedido no encontrado.</div>

  const prio = PRIORIDADES.find(p => p.value === pedido.prioridad)
  const tipo = tipos.find(t => t.value === pedido.tipo)
  const estadosActivos = estados.filter(e => (pedido.estados ?? []).includes(e.value))
  const entregables = Array.isArray(pedido.entregable) ? pedido.entregable : pedido.entregable ? [pedido.entregable] : []
  const subtareas = pedido.subtareas ?? []
  const canEdit = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const canEditPedido = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN || role === ROLES.COLABORADOR
  const canDelete = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const canWrite = role !== ROLES.VIEWER
  const isSuperAdmin = role === ROLES.SUPER_ADMIN
  const subtareasCompletadas = subtareas.filter(s => s.completada).length

  return (
    <div className="detalle-root">
      <div className="detalle-topbar">
        <button onClick={() => navigate(backTo)} className="btn-back">
          <ArrowLeft size={16} />Volver a {backLabel}
        </button>
        {(canEditPedido || canDelete) && (
          <div className="detalle-topbar-actions">
            {canEditPedido && (
              <button onClick={() => setEditando(true)} className="btn-edit"><Edit size={15} />Editar</button>
            )}
            {canDelete && (
              <button onClick={handleDelete} className="btn-delete"><Trash2 size={15} />Eliminar</button>
            )}
          </div>
        )}
      </div>

      <div className="detalle-header">
        <div className="detalle-meta-row">
          {prio && <Badge label={prio.label} color={prio.color} />}
          {tipo && <span className="detalle-tipo">{tipo.label}</span>}
          <span className="detalle-fecha">
            {format(new Date(pedido.created_at), "d 'de' MMMM yyyy", { locale: es })}
          </span>
        </div>
        <h1 className="detalle-title">{pedido.asunto}</h1>
        {pedido.descripcion && <p className="detalle-descripcion">{pedido.descripcion}</p>}
        <div className="detalle-estados-row">
          {estadosActivos.length === 0
            ? <span className="detalle-sin-estado">Sin estado asignado</span>
            : estadosActivos.map(e => <Badge key={e.value} label={e.label} color={e.color} />)
          }
          <EstadoPopover pedido={pedido} id={id} role={role} user={user} onUpdate={fetchPedido} estados={estados} />
        </div>
      </div>

      <div className="detalle-info-grid">
        <div className="info-card">
          <p className="info-card-label">Asignados</p>
          {pedido.pedido_asignados?.length === 0
            ? <p className="info-card-empty">Nadie asignado</p>
            : pedido.pedido_asignados?.map(a => (
              <div key={a.user_id} className="asignado-row">
                <span className="avatar-sm">{a.profiles?.full_name?.[0]?.toUpperCase()}</span>
                {a.profiles?.full_name}
              </div>
            ))
          }
        </div>
        {pedido.fecha_limite && (
          <div className="info-card">
            <p className="info-card-label">Fecha límite</p>
            <p className="info-card-value">
              {format(new Date(pedido.fecha_limite + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
        )}
        {pedido.tags?.length > 0 && (
          <div className="info-card">
            <p className="info-card-label">Tags</p>
            <div className="flex flex-wrap gap-[0.375rem]">
              {pedido.tags.map(t => <span key={t} className="tag-item">{t}</span>)}
            </div>
          </div>
        )}
        {pedido.instancia && (
          <div className="info-card">
            <p className="info-card-label">Instancia</p>
            {(() => {
              const inst = instancias.find(i => i.value === pedido.instancia)
              return inst
                ? <div style={{ display: 'inline-flex' }}><Badge label={inst.label} color={inst.color} size="sm" /></div>
                : <p className="info-card-value">{pedido.instancia}</p>
            })()}
          </div>
        )}
        {pedido.tipo_envio && (
          <div className="info-card">
            <p className="info-card-label">Tipo de envío</p>
            <p className="info-card-value">
              {pedido.tipo_envio === 'otro' ? pedido.tipo_envio_otro || 'Otro' : pedido.tipo_envio === 'test' ? 'Test' : 'Real'}
            </p>
          </div>
        )}
        {pedido.cantidad_envios != null && (
          <div className="info-card">
            <p className="info-card-label">Cantidad de envíos</p>
            <p className="info-card-value">{pedido.cantidad_envios}</p>
          </div>
        )}
        {(pedido.fecha_programacion || pedido.hora_programacion) && (
          <div className="info-card">
            <p className="info-card-label">Programación</p>
            <p className="info-card-value">
              {pedido.fecha_programacion && format(new Date(pedido.fecha_programacion + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}
              {pedido.hora_programacion && ` a las ${pedido.hora_programacion}`}
            </p>
          </div>
        )}
      </div>

      <Section title="Subtareas" defaultOpen={true}
        badge={subtareas.length > 0 ? `${subtareasCompletadas}/${subtareas.length}` : null}>
        <SubtareasTimeline
          subtareas={subtareas} canWrite={canWrite} canEdit={canEdit}
          usuarios={usuarios} usuariosConArea={usuariosConArea}
          onToggle={toggleSubtarea} onEliminar={eliminarSubtarea} onAgregar={agregarSubtarea}
          pedido={pedido} showError={showError}
        />
      </Section>

      <Section title="Piezas entregables" defaultOpen={true}
        badge={entregables.length > 0 ? entregables.length : null}>
        <EntregablesSection pedidoId={id} entregables={entregables} canWrite={canWrite}
          isSuperAdmin={isSuperAdmin} onUpdate={fetchPedido} setConfirm={setConfirm} />
      </Section>

      <Section title="Historial de actividad" icon={<Clock size={15} />} defaultOpen={false}>
        <PedidoHistorial pedidoId={id} />
      </Section>

      {canEdit && pedido.estados?.includes('finalizado') && (
        <div className="flex justify-end">
          <button onClick={() => setShowSheet(true)}
            className="btn-primary flex items-center gap-2" style={{ width: 'auto' }}>
            <FileSpreadsheet size={16} />Registrar en Sheet
          </button>
        </div>
      )}

      {editando && <PedidoForm pedido={pedido} onSave={handleEdit} onCancel={() => setEditando(false)} />}
      {showSheet && <SheetModal pedido={pedido} entregables={entregables} onClose={() => setShowSheet(false)} onConfirm={handleRegistrarSheet} />}
      {successMsg && <SuccessModal message={successMsg} onClose={() => setSuccessMsg('')} />}
      {confirm && (
        <ConfirmModal open={true} title={confirm.title} message={confirm.message}
          confirmLabel="Eliminar" variant="danger"
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}
    </div>
  )
}
