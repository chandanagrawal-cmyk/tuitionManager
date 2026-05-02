export default function LoadingOverlay({ message = 'Please wait…' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '1.25rem',
    }}>
      <div style={{
        background: 'var(--glass)', backdropFilter: 'blur(16px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 20, padding: '2rem 2.5rem',
        boxShadow: 'var(--shadow)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
        minWidth: 260,
      }}>
        <div style={{ fontSize: '2.5rem', animation: 'float 1.2s ease-in-out infinite' }}>✨</div>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--purple)' }}>{message}</div>
        <div style={{ width: '100%', height: 6, background: 'rgba(124,58,237,0.12)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999,
            background: 'linear-gradient(90deg, var(--purple), var(--pink))',
            animation: 'progressSlide 1.4s ease-in-out infinite',
          }} />
        </div>
      </div>
    </div>
  )
}
