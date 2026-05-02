import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function WhatsAppSetup() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking')
  const [qr, setQr] = useState(null)

  const poll = async () => {
    try {
      const { data } = await api.get('/whatsapp/status')
      setStatus(data.status)
      if (data.status === 'qr_ready') {
        const qrRes = await api.get('/whatsapp/qr')
        setQr(qrRes.data.qr)
      } else {
        setQr(null)
      }
    } catch {
      setStatus('disconnected')
    }
  }

  useEffect(() => {
    poll()
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <h1>💬 WhatsApp Setup</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>← Back</button>
      </div>

      <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: '2.5rem' }}>
        {status === 'connected' && (
          <>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <div style={{ fontWeight: 900, fontSize: '1.3rem', color: '#10b981', marginBottom: '0.5rem' }}>WhatsApp Connected!</div>
            <div style={{ color: '#9ca3af', fontWeight: 600, marginBottom: '1.5rem' }}>Rochika's WhatsApp is linked. You can now chat with students and parents.</div>
            <button className="btn btn-primary" onClick={() => navigate('/students')}>🎓 Go to Students</button>
          </>
        )}

        {status === 'qr_ready' && qr && (
          <>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: '0.5rem', color: '#7c3aed' }}>📱 Scan with WhatsApp</div>
            <div style={{ color: '#9ca3af', fontWeight: 600, fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Open WhatsApp on Rochika's phone → Settings → Linked Devices → Link a Device
            </div>
            <img src={qr} alt="QR Code" style={{ width: 260, height: 260, borderRadius: 16, border: '3px solid rgba(124,58,237,0.2)' }} />
            <div style={{ marginTop: '1rem', color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600 }}>Waiting for scan… refreshing automatically</div>
          </>
        )}

        {(status === 'disconnected' || status === 'checking') && !qr && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ fontWeight: 800, color: '#7c3aed', marginBottom: '0.5rem' }}>
              {status === 'checking' ? 'Connecting to WhatsApp service…' : 'WhatsApp service starting up…'}
            </div>
            <div style={{ color: '#9ca3af', fontWeight: 600, fontSize: '0.875rem' }}>This may take 30–60 seconds on first run</div>
          </>
        )}
      </div>
    </div>
  )
}
