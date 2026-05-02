import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { fmtDateWithDay, fmtTime } from '../utils/dates'
import { Avatar } from '../components/Avatar'
import { SkeletonRow } from '../components/Skeleton'
import useCountUp from '../hooks/useCountUp'

const COLORS = ['#7c3aed','#ec4899','#0d9488','#f59e0b','#3b82f6','#10b981','#f97316','#8b5cf6']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const greet = () => {
  const h = new Date().getHours()
  if (h < 12) return '☀️ Good morning'
  if (h < 17) return '🌤️ Good afternoon'
  return '🌙 Good evening'
}

// StatCard always renders (never conditional) so hooks rules are satisfied
function StatCard({ icon, value, label, color, prefix = '' }) {
  const animated = useCountUp(Math.round(value))
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="value" style={{ color }}>{prefix}{animated}</div>
      <div className="label">{label}</div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.full_name || user?.username || 'there'
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ parents: 0, students: 0, upcoming: 0, pendingAmount: 0 })
  const [upcoming, setUpcoming] = useState([])
  const [studentMap, setStudentMap] = useState({})
  const [birthdays, setBirthdays] = useState([])
  const [streak, setStreak] = useState(0)
  const [chartData, setChartData] = useState([])
  const [todaySessions, setTodaySessions] = useState([])
  const [todayTotal, setTodayTotal] = useState(0)
  const [todayCompleted, setTodayCompleted] = useState(0)

  useEffect(() => {
    Promise.all([
      api.get('/parents'),
      api.get('/students'),
      api.get('/sessions'),
      api.get('/payments?status=pending'),
      api.get('/payments'),
    ]).then(([p, s, sess, pendingPay, allPay]) => {
      const today = new Date().toISOString().slice(0, 10)
      const map = Object.fromEntries(s.data.map(st => [st.id, st]))
      setStudentMap(map)

      const upcomingSessions = sess.data
        .filter(s => s.status === 'scheduled' && s.date >= today)
        .slice(0, 8)
        .map(s => ({ ...s, studentName: map[s.student_id]?.name || '—' }))
      setUpcoming(upcomingSessions)

      const todaySessionsList = sess.data.filter(s => s.date === today && s.status !== 'cancelled')
      setTodaySessions(todaySessionsList.filter(s => s.status === 'scheduled'))
      setTodayTotal(todaySessionsList.length)
      setTodayCompleted(todaySessionsList.filter(s => s.status === 'completed').length)

      const pendingAmount = pendingPay.data.reduce((sum, p) => sum + p.amount, 0)
      setStats({ parents: p.data.length, students: s.data.length, upcoming: upcomingSessions.length, pendingAmount })

      const thisMonth = new Date().getMonth() + 1
      setBirthdays(s.data.filter(st => st.birth_month === thisMonth))

      // Streak — consecutive weeks with completed sessions
      const completed = sess.data.filter(s => s.status === 'completed').map(s => s.date).sort().reverse()
      let weeks = 0
      if (completed.length) {
        const weekOf = d => { const dt = new Date(d); const day = dt.getDay() === 0 ? 6 : dt.getDay() - 1; dt.setDate(dt.getDate() - day); return dt.toISOString().slice(0,10) }
        const uniqueWeeks = [...new Set(completed.map(weekOf))]
        const todayWeek = weekOf(today)
        for (let i = 0; i < uniqueWeeks.length; i++) {
          const expected = new Date(todayWeek); expected.setDate(expected.getDate() - i * 7)
          if (uniqueWeeks[i] === expected.toISOString().slice(0,10)) weeks++
          else break
        }
      }
      setStreak(weeks)

      // Earnings chart — last 6 months
      const sessionMap = Object.fromEntries(sess.data.map(s => [s.id, s]))
      const monthTotals = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i)
        monthTotals[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = 0
      }
      allPay.data.filter(p => p.status === 'received').forEach(p => {
        const se = sessionMap[p.session_id]
        if (!se) return
        const key = se.date.slice(0, 7)
        if (key in monthTotals) monthTotals[key] += p.amount
      })
      setChartData(Object.entries(monthTotals).map(([k, v]) => ({ month: MONTHS[parseInt(k.slice(5,7))-1], amount: Math.round(v) })))

      setLoading(false)
    })
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{greet()}, {displayName}! 🎉</h1>
          <p style={{ color: '#9ca3af', fontWeight: 700, marginTop: '0.25rem', fontSize: '0.9rem' }}>Here's what's happening today</p>
        </div>
      </div>

      {/* Stat cards — always rendered so StatCard hooks are never conditional */}
      <div className="stats">
        <StatCard icon="👨👩👧" value={stats.parents} label="Families" color="var(--purple)" />
        <StatCard icon="🎓" value={stats.students} label="Students" color="var(--pink)" />
        <StatCard icon="📅" value={stats.upcoming} label="Upcoming Sessions" color="var(--teal)" />
        <StatCard icon="💰" value={Math.round(stats.pendingAmount)} label="Pending (£)" color="var(--amber)" prefix="£" />
      </div>

      {/* Streak + Today + Birthdays */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', animation: 'slideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' }}>
          <div style={{ fontSize: '2.5rem', animation: 'float 2s ease-in-out infinite' }}>🔥</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.5rem', color: '#f97316' }}>{streak} week{streak !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teaching streak</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', animation: 'slideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.4s both' }}>
          <div style={{ fontSize: '2.5rem', animation: 'float 2.4s ease-in-out infinite' }}>📋</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--purple)' }}>{todaySessions.length}</span>
              {todayTotal > todaySessions.length && <span style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 700 }}>/ {todayTotal}</span>}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {todayTotal === 0 ? 'No sessions today' : 
               todaySessions.length === 0 ? 'All sessions done 🎉' :
               `Session${todaySessions.length > 1 ? 's' : ''} today`}
            </div>
            {todayTotal > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '0.4rem', marginBottom: '0.4rem' }}>
                {Array.from({ length: todayTotal }).map((_, i) => (
                  <div key={i} style={{ 
                    flex: 1,
                    minWidth: '10px',
                    maxWidth: '20px',
                    height: '5px', 
                    borderRadius: '4px',
                    background: i < todayCompleted ? '#10b981' : (i < (todayCompleted + todaySessions.length) ? 'var(--purple)' : 'rgba(124,58,237,0.1)'),
                    transition: 'all 0.3s ease'
                  }} />
                ))}
              </div>
            )}
            {todaySessions.length > 0 && (
              <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {todaySessions.map(s => (
                  <div key={s.id} style={{ fontSize: '0.78rem', color: 'var(--purple)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: 'var(--pink)' }}>•</span>
                    {studentMap[s.student_id]?.name} <span style={{ color: '#9ca3af', fontWeight: 600 }}>@ {fmtTime(s.time)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', animation: 'slideUp 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.5s both' }}>
          <div style={{ fontSize: '2.5rem', animation: 'float 2.8s ease-in-out infinite' }}>🎂</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--pink)' }}>{birthdays.length}</div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {birthdays.length === 0 ? 'No birthdays this month' : `Birthday${birthdays.length > 1 ? 's' : ''} this month 🎉`}
            </div>
            {birthdays.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--pink)', fontWeight: 700, marginTop: '0.2rem' }}>
                {birthdays.map(s => s.name).join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Earnings chart */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">💰 Earnings — Last 6 Months</div>
        {loading ? <div className="skeleton" style={{ height: 160, borderRadius: 12 }} /> : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
              <Tooltip formatter={v => [`£${v}`, 'Received']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(124,58,237,0.15)', fontWeight: 700 }} />
              <Bar dataKey="amount" radius={[6,6,0,0]}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Upcoming sessions */}
      <div className="section-title">📅 Upcoming Sessions</div>
      {loading ? (
        <div className="table-wrap"><table><tbody><SkeletonRow cols={4} /><SkeletonRow cols={4} /><SkeletonRow cols={4} /></tbody></table></div>
      ) : upcoming.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontWeight: 700 }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          No upcoming sessions — <span style={{ color: 'var(--purple)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/sessions')}>add one now</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Date</th><th>Time</th><th>Status</th></tr>
            </thead>
            <tbody>
              {upcoming.map((s, i) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/sessions')}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Avatar avatar={studentMap[s.student_id]?.avatar} name={s.studentName} index={i} />
                      {s.studentName}
                    </div>
                  </td>
                  <td>{fmtDateWithDay(s.date)}</td>
                  <td>{fmtTime(s.time)}</td>
                  <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
