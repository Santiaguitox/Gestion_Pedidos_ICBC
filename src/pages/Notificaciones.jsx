import { useNotificaciones } from '@/hooks/useNotificaciones'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, CheckCheck } from 'lucide-react'

export default function Notificaciones() {
  const { notificaciones, marcarLeida, marcarTodasLeidas } = useNotificaciones()
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Notificaciones</h1>
        {notificaciones.some(n => !n.leida) && (
          <button onClick={marcarTodasLeidas} style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', color:'var(--text-secondary)', padding:'0.375rem 0.75rem', border:'1px solid var(--border)', borderRadius:'var(--radius-md)' }}>
            <CheckCheck size={15} />Marcar todas como leídas
          </button>
        )}
      </div>
      {notificaciones.length === 0 && <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem', padding:'3rem', color:'var(--text-muted)', fontSize:'0.875rem' }}><Bell size={32} /><p>No tenés notificaciones.</p></div>}
      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
        {notificaciones.map(n => (
          <div key={n.id} onClick={() => !n.leida && marcarLeida(n.id)} style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', padding:'0.875rem 1rem', background: n.leida ? 'var(--bg-surface)' : 'rgba(208,17,27,0.04)', border:`1px solid ${n.leida ? 'var(--border)' : 'rgba(208,17,27,0.25)'}`, borderRadius:'var(--radius-md)', cursor: n.leida ? 'default' : 'pointer' }}>
            {!n.leida && <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--icbc-red)', flexShrink:0, marginTop:'5px' }} />}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem', flex:1 }}>
              <p style={{ fontSize:'0.875rem' }}>{n.mensaje}</p>
              <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{formatDistanceToNow(new Date(n.created_at), { addSuffix:true, locale:es })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
