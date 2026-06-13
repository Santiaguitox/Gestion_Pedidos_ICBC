import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '@/hooks/useNotificaciones'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, CheckCheck, ExternalLink } from 'lucide-react'

export default function Notificaciones() {
  const navigate = useNavigate()
  const { notificaciones, marcarLeida, marcarTodasLeidas } = useNotificaciones()

  const noLeidas = notificaciones.filter(n => !n.leida)
  const leidas = notificaciones.filter(n => n.leida)

  function handleClick(n) {
    if (!n.leida) marcarLeida(n.id)
    if (n.pedido_id) navigate(`/app/pedidos/${n.pedido_id}`)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', maxWidth:'680px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.5rem', fontWeight:700 }}>Notificaciones</h1>
          {noLeidas.length > 0 && (
            <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:'0.125rem' }}>
              {noLeidas.length} sin leer
            </p>
          )}
        </div>
        {noLeidas.length > 0 && (
          <button onClick={marcarTodasLeidas}
            style={{ display:'flex', alignItems:'center', gap:'0.375rem', fontSize:'0.8125rem', color:'var(--text-secondary)', padding:'0.375rem 0.875rem', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', fontWeight:500 }}>
            <CheckCheck size={15} />Marcar todas como leídas
          </button>
        )}
      </div>

      {notificaciones.length === 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', padding:'4rem', color:'var(--text-muted)', fontSize:'0.875rem', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)' }}>
          <Bell size={36} style={{ opacity:0.4 }} />
          <p style={{ fontWeight:500 }}>No tenés notificaciones</p>
          <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', textAlign:'center' }}>Te avisaremos cuando haya actividad en tus pedidos</p>
        </div>
      )}

      {/* No leídas */}
      {noLeidas.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <p style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>Nuevas</p>
          {noLeidas.map(n => (
            <div key={n.id}
              onClick={() => handleClick(n)}
              style={{ display:'flex', alignItems:'flex-start', gap:'0.875rem', padding:'1rem', background:'rgba(208,17,27,0.04)', border:'1px solid rgba(208,17,27,0.2)', borderRadius:'var(--radius-md)', cursor:'pointer', transition:'background 150ms' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(208,17,27,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(208,17,27,0.04)'}>
              <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--icbc-red)', flexShrink:0, marginTop:'5px' }} />
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                <p style={{ fontSize:'0.875rem', fontWeight:500 }}>{n.mensaje}</p>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix:true, locale:es })}
                </span>
              </div>
              {n.pedido_id && <ExternalLink size={14} style={{ color:'var(--text-muted)', flexShrink:0, marginTop:'3px' }} />}
            </div>
          ))}
        </div>
      )}

      {/* Leídas */}
      {leidas.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {noLeidas.length > 0 && (
            <p style={{ fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>Anteriores</p>
          )}
          {leidas.map(n => (
            <div key={n.id}
              onClick={() => n.pedido_id && navigate(`/app/pedidos/${n.pedido_id}`)}
              style={{ display:'flex', alignItems:'flex-start', gap:'0.875rem', padding:'0.875rem 1rem', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', cursor: n.pedido_id ? 'pointer' : 'default', opacity:0.7, transition:'opacity 150ms' }}
              onMouseEnter={e => { if (n.pedido_id) e.currentTarget.style.opacity = '1' }}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                <p style={{ fontSize:'0.875rem' }}>{n.mensaje}</p>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix:true, locale:es })}
                </span>
              </div>
              {n.pedido_id && <ExternalLink size={14} style={{ color:'var(--text-muted)', flexShrink:0, marginTop:'3px' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}