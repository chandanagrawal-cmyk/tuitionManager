export default function EmptyState({ icon, title, subtitle, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'float 3s ease-in-out infinite' }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e1b4b', marginBottom: '0.4rem' }}>{title}</div>
      {subtitle && <div style={{ color: '#9ca3af', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1.5rem' }}>{subtitle}</div>}
      {action && <button className="btn btn-primary" onClick={onAction}>{action}</button>}
    </div>
  )
}
