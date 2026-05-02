import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, PieChart, Pie, Legend } from 'recharts'
import api from '../api/client'
import { Avatar } from '../components/Avatar'
import { SkeletonCard } from '../components/Skeleton'

const COLORS = ['#7c3aed','#ec4899','#0d9488','#f59e0b','#3b82f6','#10b981','#f97316','#8b5cf6']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="section-title" style={{ marginBottom: '1.25rem' }}>{title}</div>
      {children}
    </div>
  )
}

function KPI({ icon, label, value, sub, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '1rem' }}>
      <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: '1.6rem', color }}>{value}</div>
      <div style={{ fontWeight: 800, fontSize: '0.78rem', color: '#374151', marginTop: '0.1rem' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, marginTop: '0.1rem' }}>{sub}</div>}
    </div>
  )
}

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('financial')
  const [data, setData] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/students'),
      api.get('/parents'),
      api.get('/sessions'),
      api.get('/payments'),
      api.get('/lump-sum-payments'),
    ]).then(([students, parents, sessions, payments, lumpSums]) => {
      setData({ students: students.data, parents: parents.data, sessions: sessions.data, payments: payments.data, lumpSums: lumpSums.data })
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="page">
      <div className="page-header"><h1>📊 Reports</h1></div>
      <div className="stats"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
    </div>
  )

  const { students, parents, sessions, payments, lumpSums } = data
  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]))
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]))

  // ── Financial ──
  const received = payments.filter(p => p.status === 'received')
  const pending = payments.filter(p => p.status === 'pending')
  const totalReceived = received.reduce((s, p) => s + p.amount, 0) + lumpSums.reduce((s, p) => s + p.amount, 0)
  const totalPending = pending.reduce((s, p) => s + p.amount, 0)
  const avgPerSession = received.length ? received.reduce((s, p) => s + p.amount, 0) / received.length : 0

  // Monthly earnings — last 12 months
  const monthlyEarnings = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    monthlyEarnings[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = 0
  }
  received.forEach(p => {
    const se = sessionMap[p.session_id]; if (!se) return
    const key = se.date.slice(0, 7)
    if (key in monthlyEarnings) monthlyEarnings[key] += p.amount
  })
  const earningsChart = Object.entries(monthlyEarnings).map(([k, v]) => ({ month: MONTHS[parseInt(k.slice(5,7))-1], amount: Math.round(v) }))

  // Revenue by student
  const revenueByStudent = students.map((st, i) => {
    const stPay = received.filter(p => { const se = sessionMap[p.session_id]; return se?.student_id === st.id })
    return { name: st.name.split(' ')[0], amount: Math.round(stPay.reduce((s, p) => s + p.amount, 0)), avatar: st.avatar, index: i }
  }).sort((a, b) => b.amount - a.amount).slice(0, 8)

  // ── Sessions ──
  const completed = sessions.filter(s => s.status === 'completed')
  const cancelled = sessions.filter(s => s.status === 'cancelled')
  const scheduled = sessions.filter(s => s.status === 'scheduled')
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = scheduled.filter(s => s.date >= today)

  // Sessions by day of week
  const byDay = Array(7).fill(0)
  sessions.forEach(s => { const d = new Date(s.date + 'T00:00:00').getDay(); byDay[d === 0 ? 6 : d - 1]++ })
  const dayChart = DAYS.map((d, i) => ({ day: d, sessions: byDay[i] }))

  // Sessions per month — last 12
  const monthlySessions = { ...monthlyEarnings }
  Object.keys(monthlySessions).forEach(k => monthlySessions[k] = 0)
  sessions.forEach(s => { const key = s.date.slice(0, 7); if (key in monthlySessions) monthlySessions[key]++ })
  const sessionChart = Object.entries(monthlySessions).map(([k, v]) => ({ month: MONTHS[parseInt(k.slice(5,7))-1], sessions: v }))

  // Status breakdown for pie
  const statusPie = [
    { name: 'Completed', value: completed.length, color: '#10b981' },
    { name: 'Scheduled', value: scheduled.length, color: '#3b82f6' },
    { name: 'Cancelled', value: cancelled.length, color: '#ef4444' },
  ].filter(s => s.value > 0)

  // ── Students ──
  // Attendance rate per student
  const attendanceData = students.map((st, i) => {
    const stSess = sessions.filter(s => s.student_id === st.id)
    const done = stSess.filter(s => s.status === 'completed').length
    const total = stSess.filter(s => s.status !== 'scheduled').length
    const rate = total > 0 ? Math.round((done / total) * 100) : null
    const outstanding = pending.filter(p => { const se = sessionMap[p.session_id]; return se?.student_id === st.id }).reduce((s, p) => s + p.amount, 0)
    return { ...st, rate, done, total: stSess.length, outstanding, index: i }
  }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))

  // Sessions per student
  const sessionsPerStudent = students.map((st, i) => ({
    name: st.name.split(' ')[0],
    sessions: sessions.filter(s => s.student_id === st.id).length,
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => b.sessions - a.sessions).slice(0, 10)

  // ── Insights ──
  const busiestDay = dayChart.reduce((a, b) => b.sessions > a.sessions ? b : a, dayChart[0])
  const topStudent = revenueByStudent[0]
  const cancellationRate = sessions.length ? Math.round((cancelled.length / sessions.length) * 100) : 0
  const collectionRate = (received.length + pending.length) > 0 ? Math.round((received.length / (received.length + pending.length)) * 100) : 0

  const tabs = [
    { id: 'financial', label: '💰 Financial' },
    { id: 'sessions', label: '📅 Sessions' },
    { id: 'students', label: '🎓 Students' },
    { id: 'insights', label: '✨ Insights' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h1>📊 Reports</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'rgba(124,58,237,0.08)', borderRadius: 999, padding: '0.2rem', marginBottom: '1.5rem', width: 'fit-content', flexWrap: 'wrap', gap: '0.1rem' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'transparent',
            color: tab === t.id ? 'white' : '#7c3aed', border: 'none', borderRadius: 999,
            padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── FINANCIAL ── */}
      {tab === 'financial' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '✅', label: 'Total Received', value: `£${totalReceived.toFixed(0)}`, sub: `${received.length + lumpSums.length} payments`, color: '#10b981' },
            { icon: '⏳', label: 'Outstanding', value: `£${totalPending.toFixed(0)}`, sub: `${pending.length} unpaid`, color: '#f59e0b' },
            { icon: '📈', label: 'Avg per Session', value: `£${avgPerSession.toFixed(0)}`, sub: 'received sessions', color: '#7c3aed' },
            { icon: '💳', label: 'Collection Rate', value: `${collectionRate}%`, sub: 'payments received', color: '#0d9488' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '0.5rem' }}>
              <KPI {...k} />
            </div>
          ))}
        </div>

        <Section title="📈 Monthly Earnings — Last 12 Months">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={earningsChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
              <Tooltip formatter={v => [`£${v}`, 'Earned']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(124,58,237,0.15)', fontWeight: 700 }} />
              <Bar dataKey="amount" radius={[6,6,0,0]}>
                {earningsChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="🏆 Revenue by Student">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {revenueByStudent.map((st, i) => (
              <div key={st.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Avatar avatar={st.avatar} name={st.name} index={st.index} size={30} />
                <div style={{ fontWeight: 800, fontSize: '0.9rem', width: 80, flexShrink: 0 }}>{st.name}</div>
                <div style={{ flex: 1, background: 'rgba(124,58,237,0.08)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${revenueByStudent[0].amount ? (st.amount / revenueByStudent[0].amount) * 100 : 0}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 999, transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ fontWeight: 900, color: '#0d9488', width: 60, textAlign: 'right', fontSize: '0.9rem' }}>£{st.amount}</div>
              </div>
            ))}
          </div>
        </Section>
      </>}

      {/* ── SESSIONS ── */}
      {tab === 'sessions' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '✅', label: 'Completed', value: completed.length, sub: `${sessions.length ? Math.round(completed.length/sessions.length*100) : 0}% of all`, color: '#10b981' },
            { icon: '📅', label: 'Upcoming', value: upcoming.length, sub: 'scheduled ahead', color: '#3b82f6' },
            { icon: '❌', label: 'Cancelled', value: cancelled.length, sub: `${cancellationRate}% rate`, color: '#ef4444' },
            { icon: '📊', label: 'Total Sessions', value: sessions.length, sub: 'all time', color: '#7c3aed' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '0.5rem' }}>
              <KPI {...k} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <Section title="📅 Sessions per Month">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={sessionChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(124,58,237,0.15)', fontWeight: 700 }} />
                <Line type="monotone" dataKey="sessions" stroke="#7c3aed" strokeWidth={3} dot={{ fill: '#7c3aed', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Section>

          <Section title="🥧 Session Status Breakdown">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 12, border: 'none', fontWeight: 700 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.78rem', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </Section>
        </div>

        <Section title="📆 Busiest Days of the Week">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dayChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 12, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontWeight: 700 }} />
              <Bar dataKey="sessions" radius={[6,6,0,0]}>
                {dayChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </>}

      {/* ── STUDENTS ── */}
      {tab === 'students' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '🎓', label: 'Total Students', value: students.length, sub: `${parents.length} families`, color: '#7c3aed' },
            { icon: '📊', label: 'Avg Attendance', value: `${attendanceData.filter(s => s.rate !== null).length ? Math.round(attendanceData.filter(s => s.rate !== null).reduce((a, s) => a + s.rate, 0) / attendanceData.filter(s => s.rate !== null).length) : 0}%`, sub: 'across all students', color: '#10b981' },
            { icon: '⚠️', label: 'Outstanding', value: students.filter((_, i) => attendanceData[i]?.outstanding > 0).length, sub: 'students with balance', color: '#f59e0b' },
            { icon: '📅', label: 'Avg Sessions', value: students.length ? Math.round(sessions.length / students.length) : 0, sub: 'per student', color: '#ec4899' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '0.5rem' }}>
              <KPI {...k} />
            </div>
          ))}
        </div>

        <Section title="📊 Sessions per Student">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sessionsPerStudent} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontWeight: 700 }} />
              <Bar dataKey="sessions" radius={[6,6,0,0]}>
                {sessionsPerStudent.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="🏅 Attendance & Balance per Student">
          <div className="table-wrap" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>
            <table>
              <thead>
                <tr><th>Student</th><th>Sessions</th><th>Attendance</th><th>Outstanding</th></tr>
              </thead>
              <tbody>
                {attendanceData.map((st, i) => (
                  <tr key={st.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Avatar avatar={st.avatar} name={st.name} index={st.index} size={28} />
                        <span style={{ fontWeight: 800 }}>{st.name}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{st.total}</td>
                    <td>
                      {st.rate !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, background: 'rgba(124,58,237,0.08)', borderRadius: 999, height: 8, overflow: 'hidden', minWidth: 60 }}>
                            <div style={{ width: `${st.rate}%`, height: '100%', background: st.rate >= 80 ? '#10b981' : st.rate >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 999 }} />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: st.rate >= 80 ? '#059669' : st.rate >= 50 ? '#d97706' : '#dc2626' }}>{st.rate}%</span>
                        </div>
                      ) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td>
                      {st.outstanding > 0
                        ? <span style={{ fontWeight: 800, color: '#f59e0b' }}>£{st.outstanding.toFixed(2)}</span>
                        : <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Clear</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </>}

      {/* ── INSIGHTS ── */}
      {tab === 'insights' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

          <div className="card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔥</div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1e1b4b', marginBottom: '0.25rem' }}>Busiest Day</div>
            <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#7c3aed' }}>{busiestDay?.day}</div>
            <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600 }}>{busiestDay?.sessions} sessions scheduled on this day</div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏆</div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1e1b4b', marginBottom: '0.25rem' }}>Top Earning Student</div>
            <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#10b981' }}>{topStudent?.name || '—'}</div>
            <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600 }}>£{topStudent?.amount || 0} received to date</div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💳</div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1e1b4b', marginBottom: '0.25rem' }}>Collection Rate</div>
            <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#f59e0b' }}>{collectionRate}%</div>
            <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600 }}>{received.length} of {received.length + pending.length} payments collected</div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1e1b4b', marginBottom: '0.25rem' }}>Cancellation Rate</div>
            <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#ef4444' }}>{cancellationRate}%</div>
            <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600 }}>{cancelled.length} of {sessions.length} sessions cancelled</div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid #ec4899' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1e1b4b', marginBottom: '0.25rem' }}>Avg Session Value</div>
            <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#ec4899' }}>£{avgPerSession.toFixed(2)}</div>
            <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600 }}>across {received.length} received payments</div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid #0d9488' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1e1b4b', marginBottom: '0.25rem' }}>Students with Balance</div>
            <div style={{ fontWeight: 900, fontSize: '1.8rem', color: '#0d9488' }}>
              {attendanceData.filter(s => s.outstanding > 0).length}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600 }}>
              {attendanceData.filter(s => s.outstanding > 0).map(s => s.name.split(' ')[0]).join(', ') || 'None — all clear! 🎉'}
            </div>
          </div>

        </div>
      </>}
    </div>
  )
}
