import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePedidos } from '@/hooks/usePedidos'
import { PRIORIDADES, TIPOS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Trash2, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Papelera() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const { restaurarPedido } = usePedidos()

  async function fetchEliminados() {
    setLoading(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*, profiles!pedidos_deleted_by_fkey(full_name)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setPedidos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchEliminados() }, [])

  async function handleRestaurar(id) {
    await restaurarPedido(id)
    fetchEliminados()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Papelera</h1>
        <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:'0.125rem' }}>Pedidos eliminados — solo visible para super admin</p>
      </div>

      {loading && <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>Cargando…</p>}
      {!loading && pedidos.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', padding:'3rem', color:'var(--text-muted)' }}>
          <Trash2 size={32} />
          <p style={{ fontSize:'0.875rem' }}>La papelera está vacía.</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
        {pedidos.map(p => {
          const prio = PRIORIDADES.find(x => x.value === p.prioridad)
          return (
            <div key={p.id} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', opacity:0.8 }}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.25rem', overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  {prio && <Badge label={prio.label} color={prio.color} size="sm" />}
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{TIPOS.find(t => t.value === p.tipo)?.label}</span>
                </div>
                <span style={{ fontFamily:'var(--font-display)', fontSize:'0.9375rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.asunto}</span>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                  Eliminado {format(new Date(p.deleted_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale:es })}
                  {p.profiles?.full_name ? ` por ${p.profiles.full_name}` : ''}
                </span>
              </div>
              <button onClick={() => handleRestaurar(p.id)}
                style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', fontWeight:500, padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', border:'1px solid var(--border)', color:'var(--text-secondary)', flexShrink:0, whiteSpace:'nowrap' }}>
                <RotateCcw size={14} />Restaurar
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}