import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePedidosMutations } from '@/hooks/usePedidosMutations'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { PRIORIDADES } from '@/lib/constants'
import { useTipos } from '@/hooks/useTipos'
import { Badge } from '@/components/ui/Badge'
import { Trash2, RotateCcw } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Papelera() {
  useDocumentTitle('Papelera')

  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const { tipos } = useTipos()
  const { restaurarPedido, eliminarPedidoDefinitivo } = usePedidosMutations()
  // Pedido pendiente de confirmación de borrado definitivo (o null).
  const [confirmDefinitivo, setConfirmDefinitivo] = useState(null)
  const { showSuccess, showError } = useNotificaciones()

  async function queryEliminados() {
    const { data } = await supabase
      .from('pedidos')
      .select('*, deleted_by_profile:profiles!pedidos_deleted_by_fkey(full_name)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    return data ?? []
  }

  async function fetchEliminados() {
    setLoading(true)
    setPedidos(await queryEliminados())
    setLoading(false)
  }

  useEffect(() => {
    queryEliminados().then(data => { setPedidos(data); setLoading(false) })
  }, [])

  async function handleRestaurar(id) {
    try {
      await restaurarPedido(id)
      showSuccess('Pedido restaurado correctamente')
      fetchEliminados()
    } catch (err) {
      showError(err.message || 'No se pudo restaurar el pedido')
    }
  }

  // La ruta ya es solo super_admin, pero el permiso REAL vive en la
  // RPC (security definer): si algún día la ruta se abre a admin, el
  // botón fallará con el mensaje del server en vez de borrar.
  async function handleEliminarDefinitivo() {
    const pedido = confirmDefinitivo
    setConfirmDefinitivo(null)
    try {
      await eliminarPedidoDefinitivo(pedido.id)
      showSuccess('Pedido eliminado definitivamente')
      fetchEliminados()
    } catch (err) {
      showError(err.message || 'No se pudo eliminar el pedido')
    }
  }

  return (
    <div className="page-root">

      <div>
        <h1 className="page-title">Papelera</h1>
        <p className="page-subtitle">Pedidos eliminados — solo visible para super admin</p>
      </div>

      {loading && <p className="loading-text">Cargando…</p>}

      {!loading && pedidos.length === 0 && (
        <div className="empty-state">
          <Trash2 size={32} />
          <p>La papelera está vacía.</p>
        </div>
      )}

      <div className="flex flex-col gap-[0.625rem]">
        {pedidos.map(p => {
          const prio = PRIORIDADES.find(x => x.value === p.prioridad)
          const tipo = tipos.find(t => t.value === p.tipo)
          return (
            <div key={p.id} className="papelera-item">
              <div className="papelera-item-info">
                <div className="flex items-center gap-2">
                  {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
                  {tipo && <span className="tipo-label" style={{ color: tipo.color }}>{tipo.label}</span>}
                </div>
                <span className="papelera-item-title">{p.asunto}</span>
                <span className="papelera-item-meta">
                  Eliminado por <strong style={{ color: 'var(--icbc-red)' }}>{p.deleted_by_profile?.full_name ?? 'usuario desconocido'}</strong>{' '}
                  el {format(new Date(p.deleted_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                </span>
              </div>
              <div className="papelera-item-acciones">
                <button onClick={() => handleRestaurar(p.id)} className="btn-restaurar">
                  <RotateCcw size={14} />Restaurar
                </button>
                <button onClick={() => setConfirmDefinitivo(p)} className="btn-eliminar-definitivo">
                  <Trash2 size={14} />Eliminar definitivamente
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmModal
        open={!!confirmDefinitivo}
        title="Eliminar definitivamente"
        message={confirmDefinitivo ? `"${confirmDefinitivo.asunto}" se va a borrar de forma PERMANENTE, junto con sus subtareas, entregables, comentarios y todo su historial. Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar para siempre"
        variant="danger"
        onConfirm={handleEliminarDefinitivo}
        onCancel={() => setConfirmDefinitivo(null)}
      />

    </div>
  )
}