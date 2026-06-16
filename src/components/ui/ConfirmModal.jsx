import { useEffect } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

/**
 * ConfirmModal — modal de confirmación reutilizable
 * Props: open, title, message, confirmLabel, cancelLabel, variant ('danger'|'warning'|'default'), onConfirm, onCancel
 */
export function ConfirmModal({
  open,
  title = '¿Estás seguro?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return
    function handleKey(e) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  const colors = {
    danger:  { icon: '#D0111B', bg: 'rgba(208,17,27,0.08)',   border: 'rgba(208,17,27,0.2)',   btn: '#D0111B' },
    warning: { icon: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  btn: '#F59E0B' },
    default: { icon: 'var(--icomm-violet)', bg: 'rgba(91,78,232,0.08)', border: 'rgba(91,78,232,0.2)', btn: 'var(--icomm-violet)' },
  }[variant]

  const Icon = variant === 'warning' ? AlertTriangle : Trash2

  return (
    <div className="modal-overlay" style={{ zIndex: 9998 }} onClick={onCancel}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div className="flex items-center gap-[0.625rem]">
            <div className="confirm-icon-wrap"
              style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
              <Icon size={16} color={colors.icon} />
            </div>
            <h2 className="modal-title">{title}</h2>
          </div>
          <button onClick={onCancel} className="modal-close"><X size={18} /></button>
        </div>

        {message && (
          <div className="confirm-body">
            <p className="confirm-message">{message}</p>
          </div>
        )}

        <div className="confirm-footer">
          <button onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
          <button onClick={onConfirm} className="btn-confirm" style={{ background: colors.btn }}>
            {confirmLabel}
          </button>
        </div>

      </div>
    </div>
  )
}