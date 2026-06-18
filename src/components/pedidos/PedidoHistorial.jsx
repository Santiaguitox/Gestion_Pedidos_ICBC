import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { labelActividad } from '@/hooks/useActividad'
import { User } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function PedidoHistorial({ pedidoId }) {
  const [actividad, setActividad] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const LIMITE = 5

  useEffect(() => {
    supabase.from('actividad').select('*, profiles(full_name)').eq('pedido_id', pedidoId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setActividad(data ?? []); setLoading(false) })
  }, [pedidoId])

  if (loading) return <p className="text-muted-sm">Cargando historial…</p>
  if (actividad.length === 0) return <p className="text-muted-sm">Sin actividad registrada.</p>

  const visible = mostrarTodos ? actividad : actividad.slice(0, LIMITE)

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
      {actividad.length > LIMITE && (
        <button onClick={() => setMostrarTodos(v => !v)} className="btn-ver-mas">
          {mostrarTodos ? 'Ver menos' : `Ver ${actividad.length - LIMITE} más`}
        </button>
      )}
    </div>
  )
}
