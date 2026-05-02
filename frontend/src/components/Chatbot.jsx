import { useState, useRef, useEffect } from 'react'
import api from '../api/client'

const SUGGESTIONS = [
  "Who hasn't paid yet?",
  "How many sessions this week?",
  "What's my total earnings?",
  "List all my students",
  "Any sessions today?",
]

async function fetchAll() {
  const [students, parents, sessions, payments] = await Promise.all([
    api.get('/students').then(r => r.data),
    api.get('/parents').then(r => r.data),
    api.get('/sessions').then(r => r.data),
    api.get('/payments').then(r => r.data),
  ])
  return { students, parents, sessions, payments }
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function weekRange() {
  const now = new Date()
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1
  const mon = new Date(now); mon.setDate(now.getDate() - day)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return [mon.toISOString().slice(0,10), sun.toISOString().slice(0,10)]
}
function monthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)
  const end = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)
  return [start, end]
}
function fmt(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) }

async function answer(q) {
  const text = q.toLowerCase()
  const { students, parents, sessions, payments } = await fetchAll()

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]))
  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]))

  // ── UNPAID / PENDING ──
  if (text.match(/unpaid|not paid|pending|owe|outstanding/)) {
    const pending = payments.filter(p => p.status === 'pending')
    if (!pending.length) return "🎉 Great news — no pending payments! Everyone's paid up!"
    const lines = pending.map(p => {
      const sess = sessionMap[p.session_id]
      const st = sess ? studentMap[sess.student_id] : null
      return `• ${st?.name || 'Unknown'} — £${p.amount.toFixed(2)} (session ${sess ? fmt(sess.date) : '?'})`
    })
    return `⏳ ${pending.length} unpaid payment${pending.length > 1 ? 's' : ''}:\n${lines.join('\n')}\n\nTotal outstanding: £${pending.reduce((s,p)=>s+p.amount,0).toFixed(2)}`
  }

  // ── TODAY ──
  if (text.match(/today/)) {
    const today = todayStr()
    const todays = sessions.filter(s => s.date === today && s.status === 'scheduled')
    if (!todays.length) return `📅 No sessions scheduled for today (${fmt(today)}). Enjoy the break! ☕`
    const lines = todays.map(s => `• ${studentMap[s.student_id]?.name || '?'} at ${s.time}`)
    return `📅 ${todays.length} session${todays.length > 1 ? 's' : ''} today (${fmt(today)}):\n${lines.join('\n')}`
  }

  // ── THIS WEEK ──
  if (text.match(/this week|week/)) {
    const [mon, sun] = weekRange()
    const week = sessions.filter(s => s.date >= mon && s.date <= sun && s.status === 'scheduled')
    if (!week.length) return `📅 No sessions scheduled this week (${fmt(mon)} – ${fmt(sun)}).`
    const lines = week.map(s => `• ${fmt(s.date)} — ${studentMap[s.student_id]?.name || '?'} at ${s.time}`)
    return `📅 ${week.length} session${week.length > 1 ? 's' : ''} this week:\n${lines.join('\n')}`
  }

  // ── EARNINGS / INCOME ──
  if (text.match(/earn|income|revenue|total|money|made|profit/)) {
    const received = payments.filter(p => p.status === 'received')
    const pending = payments.filter(p => p.status === 'pending')
    const [ms, me] = monthRange()
    const thisMonth = received.filter(p => {
      const sess = sessionMap[p.session_id]
      return sess && sess.date >= ms && sess.date <= me
    })
    return `💰 Earnings summary:\n• Total received: £${received.reduce((s,p)=>s+p.amount,0).toFixed(2)}\n• This month: £${thisMonth.reduce((s,p)=>s+p.amount,0).toFixed(2)}\n• Still pending: £${pending.reduce((s,p)=>s+p.amount,0).toFixed(2)}`
  }

  // ── LIST STUDENTS ──
  if (text.match(/student|pupil|who do (i|you) teach/)) {
    if (!students.length) return "🎓 You don't have any students yet. Add your first one!"
    const lines = students.map(s => `• ${s.name}${s.subject ? ` (${s.subject})` : ''} — ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][s.default_day]}s at ${s.default_time}, £${s.fee_per_session}/session`)
    return `🎓 You have ${students.length} student${students.length > 1 ? 's' : ''}:\n${lines.join('\n')}`
  }

  // ── LIST PARENTS ──
  if (text.match(/parent|famil|mum|dad/)) {
    if (!parents.length) return "👨👩👧 No parents added yet."
    const lines = parents.map(p => `• ${p.name}${p.phone ? ` — 📞 ${p.phone}` : ''}${p.email ? ` — 📧 ${p.email}` : ''}`)
    return `👨👩👧 ${parents.length} famil${parents.length > 1 ? 'ies' : 'y'}:\n${lines.join('\n')}`
  }

  // ── SPECIFIC STUDENT ──
  const matchedStudent = students.find(s => text.includes(s.name.toLowerCase().split(' ')[0].toLowerCase()))
  if (matchedStudent) {
    const st = matchedStudent
    const stSessions = sessions.filter(s => s.student_id === st.id)
    const upcoming = stSessions.filter(s => s.status === 'scheduled' && s.date >= todayStr())
    const completed = stSessions.filter(s => s.status === 'completed')
    const stPayments = payments.filter(p => {
      const sess = sessionMap[p.session_id]
      return sess && sess.student_id === st.id
    })
    const pendingPay = stPayments.filter(p => p.status === 'pending')
    return `🎓 ${st.name}:\n• Subject: ${st.subject || 'Not set'}\n• Schedule: ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][st.default_day]}s at ${st.default_time}\n• Fee: £${st.fee_per_session}/session\n• Upcoming sessions: ${upcoming.length}\n• Completed sessions: ${completed.length}\n• Pending payments: £${pendingPay.reduce((s,p)=>s+p.amount,0).toFixed(2)}`
  }

  // ── NEXT SESSION ──
  if (text.match(/next session|upcoming|schedule/)) {
    const upcoming = sessions.filter(s => s.status === 'scheduled' && s.date >= todayStr()).slice(0, 5)
    if (!upcoming.length) return "📅 No upcoming sessions scheduled yet!"
    const lines = upcoming.map(s => `• ${fmt(s.date)} at ${s.time} — ${studentMap[s.student_id]?.name || '?'}`)
    return `📅 Next ${upcoming.length} upcoming session${upcoming.length > 1 ? 's' : ''}:\n${lines.join('\n')}`
  }

  // ── STATS / SUMMARY ──
  if (text.match(/summary|overview|stats|how many|count/)) {
    const pending = payments.filter(p => p.status === 'pending')
    const upcoming = sessions.filter(s => s.status === 'scheduled' && s.date >= todayStr())
    return `📊 Quick summary:\n• 👨👩👧 ${parents.length} families\n• 🎓 ${students.length} students\n• 📅 ${upcoming.length} upcoming sessions\n• 💰 £${pending.reduce((s,p)=>s+p.amount,0).toFixed(2)} pending payments`
  }

  // ── HELP ──
  if (text.match(/help|what can|how|hi|hello|hey/)) {
    return `👋 Hi! I'm your TuitionDesk assistant! Here's what I can help with:\n\n• "Who hasn't paid?" — unpaid payments\n• "Sessions today/this week" — your schedule\n• "Tell me about Emma" — student details\n• "What are my earnings?" — income summary\n• "List all students" — your student roster\n• "Any sessions today?" — today's schedule`
  }

  return `🤔 I'm not sure about that one! Try asking:\n• "Who hasn't paid?"\n• "Sessions this week"\n• "What are my earnings?"\n• "Tell me about [student name]"`
}

export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'bot', text: "👋 Hi! I'm your TuitionDesk assistant! Ask me anything about your students, sessions, or payments! 🎓" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text) => {
    const q = text || input.trim()
    if (!q) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const reply = await answer(q)
      setMessages(m => [...m, { role: 'bot', text: reply }])
    } catch {
      setMessages(m => [...m, { role: 'bot', text: "😬 Oops, something went wrong. Try again!" }])
    } finally {
      setLoading(false)
    }
  }

  const onKey = e => { if (e.key === 'Enter') send() }

  return (
    <>
      {open && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-avatar">🤖</div>
            <div>
              <div className="chat-title">TuitionDesk Assistant</div>
              <div className="chat-subtitle">✨ Ask me anything!</div>
            </div>
            <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`} style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
            ))}
            {loading && <div className="chat-msg bot typing">✨ Thinking…</div>}
            <div ref={bottomRef} />
          </div>

          <div className="chat-suggestions">
            {SUGGESTIONS.map(s => (
              <button key={s} className="chat-suggestion" onClick={() => send(s)}>{s}</button>
            ))}
          </div>

          <div className="chat-input-row">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask me anything…"
              disabled={loading}
            />
            <button onClick={() => send()} disabled={loading}>➤</button>
          </div>
        </div>
      )}

      <button className="chat-bubble" onClick={() => setOpen(o => !o)}>
        {open ? '✕' : '💬'}
      </button>
    </>
  )
}
