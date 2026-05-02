export default function ConfirmModal({ message, onConfirm, onCancel, danger = true }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '0.75rem' }}>{danger ? '🗑️' : '⚠️'}</div>
        <p style={{ textAlign: 'center', fontWeight: 700, color: '#374151', marginBottom: '1.5rem', lineHeight: 1.5 }}>{message}</p>
        <div className="modal-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  )
}
