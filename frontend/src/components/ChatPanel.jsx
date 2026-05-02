import { useEffect, useRef, useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'

function normalise(n) {
  return n ? n.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '') : ''
}

export default function ChatPanel({ contacts, onClose }) {
  // contacts = [{ name, number, label }]  e.g. [{name:'Emma', number:'+447...', label:'Student'}, {name:'Sarah', number:'+447...', label:'Mother'}]
  const [selected, setSelected] = useState(contacts.length === 1 ? contacts[0] : null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [waStatus, setWaStatus] = useState('checking')
  const bottomRef = useRef(null)

  const loadMessages = async (contact) => {
    if (!contact?.number) return
    try {
      const { data } = await api.get(`/whatsapp/chat/${normalise(contact.number)}`)
      setMessages(data)
    } catch { setMessages([]) }
  }

  useEffect(() => {
    api.get('/whatsapp/status').then(r => setWaStatus(r.data.status)).catch(() => setWaStatus('disconnected'))
  }, [])

  useEffect(() => {
    if (!selected) return
    loadMessages(selected)
    const t = setInterval(() => loadMessages(selected), 3000)
    return () => clearInterval(t)
  }, [selected])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || !selected) return
    if (waStatus !== 'connected') return toast.error('WhatsApp not connected — go to WhatsApp Setup first')
    if (!selected.number) return toast.error('No phone number for this contact')
    setSending(true)
    try {
      await api.post('/whatsapp/send', { number: normalise(selected.number), message: input.trim(), contact_name: selected.name })
      setInput('')
      await loadMessages(selected)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send message')
    } finally { setSending(false) }
  }

  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const fmtTime = ts => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const fmtDate = ts => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  // Group messages by date
  const grouped = messages.reduce((acc, m) => {
    const d = fmtDate(m.timestamp)
    if (!acc[d]) acc[d] = []
    acc[d].push(m)
    return acc
  }, {})

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
      background: 'white', boxShadow: '-8px 0 40px rgba(124,58,237,0.15)',
      display: 'flex', flexDirection: 'column', zIndex: 300,
      animation: 'slideInRight 0.25s ease',
    }}>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', padding: '1rem 1.25rem', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: contacts.length > 1 ? '0.75rem' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>💬</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>{selected ? selected.name : 'WhatsApp Chat'}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                {waStatus === 'connected' ? '🟢 Connected' : '🔴 Not connected'}
                {selected?.number && ` · ${selected.number}`}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Contact picker */}
        {contacts.length > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {contacts.map(c => (
              <button key={c.number || c.name} onClick={() => setSelected(c)} style={{
                background: selected?.number === c.number ? 'white' : 'rgba(255,255,255,0.2)',
                color: selected?.number === c.number ? '#7c3aed' : 'white',
                border: 'none', borderRadius: 999, padding: '0.3rem 0.85rem',
                fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {c.label}: {c.name} {!c.number && '⚠️'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* No number warning */}
      {selected && !selected.number && (
        <div style={{ background: '#fef3c7', padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#92400e', borderBottom: '1px solid #fde68a' }}>
          ⚠️ No phone number saved for {selected.name}. Add one on the {selected.label === 'Student' ? 'Students' : 'Parents'} page.
        </div>
      )}

      {/* No contact selected */}
      {!selected && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '2.5rem' }}>👆</div>
          <div style={{ fontWeight: 700 }}>Select who to chat with above</div>
        </div>
      )}

      {/* Messages */}
      {selected && selected.number && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8f7ff' }}>
          {Object.keys(grouped).length === 0 && (
            <div style={{ textAlign: 'center', color: '#c4b5fd', fontWeight: 700, marginTop: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
              No messages yet — say hello!
            </div>
          )}
          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                <span style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', borderRadius: 999, padding: '0.2rem 0.75rem', fontSize: '0.72rem', fontWeight: 800 }}>{date}</span>
              </div>
              {msgs.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start', marginBottom: '0.4rem' }}>
                  <div style={{
                    maxWidth: '78%', padding: '0.55rem 0.85rem', borderRadius: 16,
                    borderBottomRightRadius: m.direction === 'outbound' ? 4 : 16,
                    borderBottomLeftRadius: m.direction === 'inbound' ? 4 : 16,
                    background: m.direction === 'outbound' ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'white',
                    color: m.direction === 'outbound' ? 'white' : '#1e1b4b',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5,
                  }}>
                    <div>{m.body}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: '0.2rem', textAlign: 'right' }}>{fmtTime(m.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      {selected && selected.number && (
        <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(124,58,237,0.1)', display: 'flex', gap: '0.5rem', background: 'white' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type a message… (Enter to send)"
            rows={2}
            disabled={sending || waStatus !== 'connected'}
            style={{ flex: 1, padding: '0.6rem 0.85rem', border: '2px solid rgba(124,58,237,0.15)', borderRadius: 12, fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 600, outline: 'none', resize: 'none' }}
          />
          <button onClick={send} disabled={sending || !input.trim() || waStatus !== 'connected'} style={{
            background: 'linear-gradient(135deg,#7c3aed,#ec4899)', border: 'none', color: 'white',
            width: 44, borderRadius: 12, cursor: 'pointer', fontSize: '1.2rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: (!input.trim() || sending) ? 0.5 : 1,
          }}>➤</button>
        </div>
      )}
    </div>
  )
}
