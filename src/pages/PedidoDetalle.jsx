import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePedidos } from '@/hooks/usePedidos'
import { useAuth } from '@/context/AuthContext'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import { PRIORIDADES, ROLES } from '@/lib/constants'
import { useEstados } from '@/hooks/useEstados'
import { useTipos } from '@/hooks/useTipos'
import { useInstancias } from '@/hooks/useInstancias'
import { Badge } from '@/components/ui/Badge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import PedidoForm from '@/components/pedidos/PedidoForm'
import { DetalleAcordeon } from '@/components/pedidos/DetalleAcordeon'
import { DetalleInfoBloques } from '@/components/pedidos/DetalleInfoBloques'
import { EstadoPopover } from '@/components/pedidos/EstadoPopover'
import { SubtareasTimeline } from '@/components/pedidos/SubtareasTimeline'
import { EntregablesSection } from '@/components/pedidos/EntregablesSection'
import { BaseDatosSection } from '@/components/pedidos/BaseDatosSection'
import { PedidoHistorial } from '@/components/pedidos/PedidoHistorial'
import { SheetModal } from '@/components/pedidos/SheetModal'
import { SuccessModal } from '@/components/pedidos/SuccessModal'
import { ArrowLeft, Edit, Trash2, Clock, FileSpreadsheet, CheckSquare, FileText, Info, Database } from 'lucide-react'
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
  const isMobile = useIsMobile()
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
    // Viewer no puede aparecer en el selector de "asignar a" de subtareas
    // nuevas — no tiene lógica de negocio que se le asigne trabajo (ver
    // el mismo criterio ya aplicado en PedidoForm.jsx para "Asignar a"
    // del pedido, y por el que se ocultó Notificaciones para ese rol).
    // usuariosConArea SÍ mantiene la lista completa sin filtrar: resuelve
    // el área (chip de color) de gente YA asignada a subtareas viejas,
    // así que no debe perder a nadie que ya esté asignado de antes.
    supabase.from('profiles').select('id, full_name, area_equipo, role').order('full_name').then(({ data }) => {
      setUsuarios((data ?? []).filter(u => u.role !== ROLES.VIEWER))
      setUsuariosConArea(data ?? [])
    })
  }, [])

  const queryPedido = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      // avatar_color: agregado para que los avatares de "Asignados" usen
      // el color real configurado por cada usuario, igual criterio que
      // ya aplica en Calendario / PedidoCard / el buscador global —
      // antes esta query no lo traía y el avatar quedaba siempre con el
      // color de fallback.
      .select('*, pedido_asignados(user_id, profiles(id,full_name,avatar_color)), subtareas(*, profiles:asignado_a(id,full_name,avatar_color)), entregable(*), pedido_base(*)')
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

  async function handleRegistrarSheet(filas) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      // 'filas' es un array — 1 elemento en el caso normal (mismo día
      // para todo el pedido), o varios si se cargaron grupos con
      // días/horarios distintos por pieza. Se escribe una fila al
      // Sheet por cada una, secuencialmente (no en paralelo, para no
      // pisarse al determinar en qué número de fila quedó escrita cada
      // una dentro de la edge function).
      for (const data of filas) {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escribir-sheet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({
            hoja: 'pedidos',
            data: [data.nombre_campana, data.fecha_pedido, data.hora_pedido, data.descripcion, data.instancia, data.fecha_aprobacion, data.hora_aprobacion, data.cantidad_envios, data.aclaraciones, data.dia_programacion, data.hora_programacion],
            fueraDeHora: !!data.fueraDeHora,
          })
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error ?? 'Error al registrar en Sheet')
      }
      setShowSheet(false)
      setSuccessMsg(filas.length > 1
        ? `El pedido fue registrado en Google Sheets correctamente (${filas.length} filas).`
        : 'El pedido fue registrado en Google Sheets correctamente.')
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
  const bases = Array.isArray(pedido.pedido_base) ? pedido.pedido_base : pedido.pedido_base ? [pedido.pedido_base] : []
  const subtareas = pedido.subtareas ?? []
  const canEdit = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const canEditPedido = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN || role === ROLES.COLABORADOR
  const canDelete = role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
  const canWrite = role !== ROLES.VIEWER
  const isSuperAdmin = role === ROLES.SUPER_ADMIN
  const isViewer = role === ROLES.VIEWER
  const subtareasCompletadas = subtareas.filter(s => s.completada).length
  const pctSubtareas = subtareas.length > 0 ? Math.round((subtareasCompletadas / subtareas.length) * 100) : 0
  const pctCompleto = pctSubtareas === 100 && subtareas.length > 0

  // El botón "Registrar en Sheet" del pedido completo ahora vive en el
  // header (junto a "Actualizar estado"), no suelto al final de la
  // página como antes — el rediseño le da más protagonismo, ya que es
  // una acción importante del flujo de cierre de un pedido.
  //
  // Visible en 3 estados, no solo "Finalizado": el pedido puede llegar
  // a necesitar registrarse en el sheet un poco antes del cierre total
  // (mientras se está validando o ya fue aprobado el entregable), no
  // solo cuando ya está 100% cerrado. Slugs confirmados contra la tabla
  // 'estados' real de Supabase (no inferidos): 'validando_entregable' y
  // 'entregable_aprobado', junto al ya existente 'finalizado'.
  // 🔧 Si se crea un nuevo estado intermedio que también deba habilitar
  // el registro en Sheet, agregarlo a este array.
  const ESTADOS_CON_SHEET_HABILITADO = ['validando_entregable', 'entregable_aprobado', 'finalizado']
  const mostrarRegistrarSheet = canEdit && pedido.estados?.some(v => ESTADOS_CON_SHEET_HABILITADO.includes(v))

  return (
    <div className="det-root">
      <div className="det-topbar">
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

      {/* Header */}
      <div className="det-header">
        <div className="detalle-meta-row">
          {prio && <Badge label={prio.label} color={prio.color} />}
          {tipo && <span className="detalle-tipo">{tipo.label}</span>}
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span className="detalle-fecha">
            Creado el {format(new Date(pedido.created_at), "d 'de' MMMM yyyy", { locale: es })}
          </span>
        </div>
        <h1 className="det-title">{pedido.asunto}</h1>
        {pedido.descripcion && <p className="det-descripcion">{pedido.descripcion}</p>}
        <div className="det-estados-row">
          {estadosActivos.length === 0
            ? <span className="detalle-sin-estado">Sin estado asignado</span>
            : estadosActivos.map(e => <Badge key={e.value} label={e.label} color={e.color} />)
          }
          <EstadoPopover pedido={pedido} id={id} role={role} user={user} onUpdate={fetchPedido} estados={estados} />
          {mostrarRegistrarSheet && (
            <button onClick={() => setShowSheet(true)} className="det-btn-sheet">
              <FileSpreadsheet size={16} />Registrar pedido en Sheet
            </button>
          )}
        </div>
      </div>

      {/* Mobile: "Detalles del pedido" como 4to acordeón, primero — en
          desktop esta misma info va en el riel sticky de la derecha
          (ver más abajo), nunca se duplican los dos a la vez. */}
      {isMobile && (
        <DetalleAcordeon
          icon={<Info size={17} />} iconColor="var(--text-secondary)" iconBg="var(--bg-hover)"
          title="Detalles del pedido" defaultOpen={false}
        >
          <div className="det-info-mobile-grid">
            <DetalleInfoBloques pedido={pedido} instancias={instancias} bases={bases} entregables={entregables} isViewer={isViewer} />
          </div>
        </DetalleAcordeon>
      )}

      <div className="det-grid">
        <div className="det-tools">

          <DetalleAcordeon
            icon={<CheckSquare size={18} />} iconColor="var(--accent-primary)" iconBg="var(--red-bg)"
            title="Subtareas"
            badge={subtareas.length > 0 ? `${subtareasCompletadas}/${subtareas.length}` : null}
            badgeColor={pctCompleto ? '#10B981' : 'var(--text-secondary)'}
            badgeBg={pctCompleto ? 'var(--green-bg)' : 'var(--bg-hover)'}
            defaultOpen={true}
          >
            <SubtareasTimeline
              subtareas={subtareas} canWrite={canWrite} canEdit={canEdit}
              usuarios={usuarios} usuariosConArea={usuariosConArea}
              onToggle={toggleSubtarea} onEliminar={eliminarSubtarea} onAgregar={agregarSubtarea}
              pedido={pedido} showError={showError}
            />
          </DetalleAcordeon>

          <DetalleAcordeon
            icon={<FileText size={18} />} iconColor="#1A2EE6" iconBg="var(--badge-bg)"
            title="Piezas entregables"
            badge={entregables.length > 0 ? entregables.length : null}
            badgeColor="var(--text-secondary)" badgeBg="var(--bg-hover)"
            defaultOpen={true}
          >
            <EntregablesSection pedidoId={id} entregables={entregables} canWrite={canWrite}
              isSuperAdmin={isSuperAdmin} onUpdate={fetchPedido} setConfirm={setConfirm}
              nombrePedido={pedido.asunto || pedido.id} />
          </DetalleAcordeon>

          {!isViewer && (
            <DetalleAcordeon
              id="base-datos-acordeon"
              icon={<Database size={18} />} iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"
              title="Base de datos"
              badge={bases.length > 0 ? bases.length : null}
              badgeColor="var(--text-secondary)" badgeBg="var(--bg-hover)"
              // Abierto si ya hay bases cargadas (para ver el resultado),
              // o si el usuario puede escribir y ya hay al menos una
              // pieza (ahí cargar una base tiene sentido inmediato). No
              // se exige tener pieza para PODER cargar una base — ese es
              // un flujo válido (suele llegar la base desde el primer
              // mail del cliente, antes de tener el HTML armado) — solo
              // se exige para que el acordeón arranque ABIERTO por
              // default. Si las DOS (bases y piezas) están vacías, el
              // pedido recién se está armando: arranca cerrado para no
              // ocupar espacio con una sección sin nada todavía que hacer.
              defaultOpen={bases.length > 0 || (canWrite && entregables.length > 0)}
            >
              <BaseDatosSection
                pedidoId={id}
                bases={bases}
                canWrite={canWrite}
                onUpdate={fetchPedido}
                entregables={entregables}
              />
            </DetalleAcordeon>
          )}

          {!isViewer && (
            <DetalleAcordeon
              icon={<Clock size={18} />} iconColor="var(--text-secondary)" iconBg="var(--bg-hover)"
              title="Historial de actividad"
              defaultOpen={false}
            >
              <PedidoHistorial pedidoId={id} />
            </DetalleAcordeon>
          )}

        </div>

        {/* Riel de info — solo en desktop, sticky a la derecha. En
            mobile esta misma info ya se mostró arriba como acordeón. */}
        {!isMobile && (
          <div className="det-info-rail">
            <DetalleInfoBloques pedido={pedido} instancias={instancias} bases={bases} entregables={entregables} isViewer={isViewer} />
          </div>
        )}
      </div>

      {editando && <PedidoForm pedido={pedido} onSave={handleEdit} onCancel={() => setEditando(false)} />}
      {showSheet && <SheetModal pedido={pedido} entregables={entregables} onClose={() => setShowSheet(false)} onConfirm={handleRegistrarSheet} />}
      {successMsg && <SuccessModal message={successMsg} onClose={() => setSuccessMsg('')} />}
      {confirm && (
        <ConfirmModal open={true} title={confirm.title} message={confirm.message}
          confirmLabel={confirm.confirmLabel ?? 'Eliminar'} variant={confirm.variant ?? 'danger'}
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}
    </div>
  )
}
