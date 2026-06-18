import { CheckCircle } from 'lucide-react'

export function SuccessModal({ message, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '380px' }}>
        <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <CheckCircle size={26} color="#10B981" />
          </div>
          <div>
            <h2 className="modal-title" style={{ marginBottom: '0.25rem' }}>¡Registrado!</h2>
            <p className="text-muted-sm">{message}</p>
          </div>
          <button onClick={onClose} className="btn-primary" style={{ width: 'auto', marginTop: '0.25rem' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
