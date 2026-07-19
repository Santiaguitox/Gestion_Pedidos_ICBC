import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { labelActividad } from '@/hooks/useActividad'
import { User, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// LIMITE_QUERY: tope real contra la base (antes no existía — se traía
// TODA la actividad del pedido solo para mostrar 5 y un "ver más" local).
// 100 cubre por lejos el caso normal; un pedido con más de 100 entradas
// de actividad es un caso extremo no contemplado hoy por este
// componente (no tiene paginación real), mismo límite implícito que ya
// acepta el resto de la pantalla.
const LIMITE_QUERY = 100
const LIMITE_VISIBLE = 5

export function PedidoHistorial({ pedidoId, version = 0 }) {
  const [actividad, setActividad] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    let cancelado = false
    supabase.from('actividad').select('*, profiles(full_name)').eq('pedido_id', pedidoId)
      .order('created_at', { ascending: false })
      .limit(LIMITE_QUERY)
      .then(({ data, error: err }) => {
        if (cancelado) return
        if (err) {
          setError(true)
        } else {
          setError(false)
          setActividad(data ?? [])
        }
        setLoading(false)
      })
    // Se refetchea cada vez que `version` cambia — PedidoDetalle la
    // incrementa después de CUALQUIER acción que dispare fetchPedido()
    // (subtareas, estados, aprobaciones, edición, etc.), así el
    // historial ya no queda viejo hasta recargar la página entera.
    // retryTick solo existe para el botón "Reintentar" de abajo.
    return () => { cancelado = true }
  }, [pedidoId, version, retryTick])

  if (loading) return <p className="text-muted-sm">Cargando historial…</p>
  if (error) return (
    <div className="flex items-center gap-2">
      <p className="text-muted-sm" style={{ margin: 0 }}>No se pudo cargar el historial.</p>
      <button type="button" className="coment-btn-cancelar" onClick={() => setRetryTick(t => t + 1)}>
        <RotateCcw size={12} />Reintentar
      </button>
    </div>
  )
  if (actividad.length === 0) return <p className="text-muted-sm">Sin actividad registrada.</p>

  const visible = mostrarTodos ? actividad : actividad.slice(0, LIMITE_VISIBLE)

  return (
    <div className="flex flex-col gap-3">
      <div className="historial-list">
        {visible.map((item, i) => (
          <div key={item.id} className="historial-item" style={{ paddingBottom: i < visible.length - 1 ? '1rem' : 0 }}>
            <div className="historial-timeline">
              <div className="historial-dot" />
              {i < visible.length - 1 && <div className="historial-line" />}
            </div>
            <div className="historial-content" style={{ paddingBottom: i < visible.length - 1 ? '0.5rem' : 0 }}>
              <span className="historial-text">{labelActividad(item)}</span>
              <div className="historial-meta">
                {item.profiles?.full_name && (
                  <span className="historial-meta-item"><User size={11} />{item.profiles.full_name}</span>
                )}
                <span className="historial-meta-item">
                  {format(new Date(item.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {actividad.length > LIMITE_VISIBLE && (
        <button onClick={() => setMostrarTodos(v => !v)} className="btn-ver-mas">
          {mostrarTodos ? 'Ver menos' : `Ver ${actividad.length - LIMITE_VISIBLE} más`}
        </button>
      )}
    </div>
  )
}
