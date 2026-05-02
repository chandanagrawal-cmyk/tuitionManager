import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { fmtDateWithDay, fmtTime, getLocalDate } from '../utils/dates'
import { useSort, SortTh, SearchBar } from '../hooks/useSort'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'
import { Avatar } from '../components/Avatar'
import ConfirmModal from '../components/ConfirmModal'
import EmptyState from '../components/EmptyState'
import { SkeletonRow } from '../components/Skeleton'
import useKeyboard from '../hooks/useKeyboard'
import LoadingOverlay from '../components/LoadingOverlay'

const COLORS = ['#7c3aed','#ec4899','#0d9488','#f59e0b','#3b82f6','#10b981','#f97316','#8b5cf6']
const initials = name => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?'
const STATUS_COLORS = { scheduled: '#3b82f6', completed: '#10b981', cancelled: '#ef4444' }
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ── Session colour based on status + RSVP ──
function sessionColor(s) {
  if (s.status === 'cancelled') return '#9ca3af'
  if (s.status === 'completed') return '#10b981'
  if (s.rsvp_status === 'accepted') return '#7c3aed'
  if (s.rsvp_status === 'declined') return '#ef4444'
  if (s.rsvp_status === 'tentative') return '#f59e0b'
  if (s.rsvp_status === 'needsAction') return '#3b82f6'
  return '#6b7280' // scheduled, no invite
}

function matchesLegend(s, key) {
  if (!key) return true
  if (key === 'cancelled') return s.status === 'cancelled'
  if (key === 'completed') return s.status === 'completed'
  if (key === 'accepted') return s.status !== 'cancelled' && s.status !== 'completed' && s.rsvp_status === 'accepted'
  if (key === 'declined') return s.status !== 'cancelled' && s.status !== 'completed' && s.rsvp_status === 'declined'
  if (key === 'tentative') return s.status !== 'cancelled' && s.status !== 'completed' && s.rsvp_status === 'tentative'
  if (key === 'needsAction') return s.status !== 'cancelled' && s.status !== 'completed' && s.rsvp_status === 'needsAction'
  if (key === 'scheduled') return s.status === 'scheduled' && !s.rsvp_status
  return true
}

// ── Calendar helpers ──
function startOfWeek(d) {
  const dt = new Date(d)
  const day = dt.getDay() === 0 ? 6 : dt.getDay() - 1
  dt.setDate(dt.getDate() - day)
  dt.setHours(0,0,0,0)
  return dt
}
function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt }
function toYMD(d) { 
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}
function daysInMonth(year, month) { return new Date(year, month+1, 0).getDate() }
function firstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

// ── Weekly Calendar ──
function WeekView({ sessions, students, weekStart, onSessionClick, onDayClick }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const studentMap = Object.fromEntries(students.map(s => [s.id, s.name]))
  const todayYMD = getLocalDate()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
      {days.map((day, i) => {
        const ymd = toYMD(day)
        const isToday = ymd === todayYMD
        const daySessions = sessions.filter(s => s.date === ymd).sort((a,b) => a.time.localeCompare(b.time))
        return (
          <div key={i} style={{
            background: isToday ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.7)',
            border: isToday ? '2px solid rgba(124,58,237,0.3)' : '1px solid rgba(124,58,237,0.1)',
            borderRadius: 14, padding: '0.75rem 0.6rem', minHeight: 120,
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontWeight: 800, fontSize: '0.75rem', color: isToday ? '#7c3aed' : '#9ca3af', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {DAY_NAMES[i]}
            </div>
            <div 
              onClick={() => onDayClick(ymd)}
              style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--purple)', marginBottom: '0.5rem', cursor: 'pointer', textDecoration: 'underline' }}
              title="Add session on this day"
            >
              {day.getDate()}
            </div>
            {daySessions.map(s => {
              const name = studentMap[s.student_id]
              return (
                <div key={s.id} onClick={e => { e.stopPropagation(); onSessionClick(s) }} style={{
                  background: sessionColor(s), color: 'white',
                  borderRadius: 8, padding: '0.25rem 0.5rem', marginBottom: '0.3rem',
                  fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                  opacity: s.status === 'cancelled' ? 0.6 : 1,
                  textDecoration: s.status === 'cancelled' ? 'line-through' : 'none',
                  transition: 'transform 0.15s',
                }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
                   onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                  {fmtTime(s.time)} {name?.split(' ')[0]}
                  {s.status === 'completed' && ' ✓'}
                  {s.rsvp_status === 'declined' && ' ❌'}
                  {s.rsvp_status === 'accepted' && ' ✅'}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Monthly Calendar ──
function MonthView({ sessions, students, year, month, onSessionClick, onDayClick }) {
  const studentMap = Object.fromEntries(students.map(s => [s.id, s.name]))
  const firstDay = firstDayOfMonth(year, month)
  const totalDays = daysInMonth(year, month)
  const cells = Array.from({ length: firstDay + totalDays }, (_, i) => i < firstDay ? null : i - firstDay + 1)
  while (cells.length % 7 !== 0) cells.push(null)
  const today = getLocalDate()
  const [popup, setPopup] = useState(null) // { ymd, sessions }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.25rem' }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.4rem 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const ymd = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = ymd === today
          const daySessions = sessions.filter(s => s.date === ymd).sort((a,b) => a.time.localeCompare(b.time))
          return (
            <div key={i} style={{
              background: isToday ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.7)',
              border: isToday ? '2px solid rgba(124,58,237,0.35)' : '1px solid rgba(124,58,237,0.08)',
              borderRadius: 10, padding: '0.4rem', minHeight: 80,
              backdropFilter: 'blur(8px)',
            }}>
              <div
                onClick={() => onDayClick(ymd)}
                style={{ fontWeight: 900, fontSize: '0.85rem', color: 'var(--purple)', marginBottom: '0.3rem', cursor: 'pointer', textDecoration: 'underline', display: 'inline-block' }}
                title="Add session on this day"
              >{day}</div>
              {daySessions.slice(0,3).map(s => {
                const name = studentMap[s.student_id]
                return (
                  <div key={s.id} onClick={e => { e.stopPropagation(); onSessionClick(s) }} style={{
                    background: sessionColor(s), color: 'white',
                    borderRadius: 5, padding: '0.15rem 0.4rem', marginBottom: '0.2rem',
                    fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
                    opacity: s.status === 'cancelled' ? 0.6 : 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {fmtTime(s.time)} {name?.split(' ')[0]}
                    {s.status === 'completed' ? ' ✓' : ''}
                    {s.rsvp_status === 'declined' ? ' ❌' : ''}
                    {s.rsvp_status === 'accepted' ? ' ✅' : ''}
                  </div>
                )
              })}
              {daySessions.length > 3 && (
                <div
                  onClick={e => { e.stopPropagation(); setPopup({ ymd, sessions: daySessions }) }}
                  style={{ fontSize: '0.6rem', color: 'var(--purple)', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                >+{daySessions.length - 3} more</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Day popup */}
      {popup && (
        <div className="modal-overlay" onClick={() => setPopup(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2 style={{ marginBottom: '1rem' }}>📅 {new Date(popup.ymd + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {popup.sessions.map(s => {
                const st = studentMap[s.student_id]
                return (
                  <div key={s.id} onClick={() => { onSessionClick(s); setPopup(null) }} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.65rem 0.85rem', borderRadius: 12, cursor: 'pointer',
                    background: sessionColor(s) + '18',
                    border: `1px solid ${sessionColor(s)}40`,
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: sessionColor(s), flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{studentMap[s.student_id] || '—'}</div>
                      <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600 }}>{fmtTime(s.time)}</div>
                    </div>
                    <span className={`badge badge-${s.status}`} style={{ fontSize: '0.68rem' }}>{s.status}</span>
                  </div>
                )
              })}
            </div>
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setPopup(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [filterStudent, setFilterStudent] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [view, setView] = useState('list') // list | week | month
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/London' }).format(new Date()));
    return startOfWeek(now);
  })
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/London' }).format(new Date()));
    return { year: now.getFullYear(), month: now.getMonth() };
  })
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ student_id: '', date: '', time: '16:00', notes: '', teacher_id: '' })
  const [addTab, setAddTab] = useState('single')
  const [recurForm, setRecurForm] = useState({ student_id: '', day_of_week: '0', time: '16:00', start_date: '', end_date: '', notes: '' })
  const [seriesAction, setSeriesAction] = useState(null)
  const [seriesEdit, setSeriesEdit] = useState(null) // pending edit payload for series picker
  const [saving, setSaving] = useState(false)
  const [savingMsg, setSavingMsg] = useState('Saving…')
  const [confirm, setConfirm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterLegend, setFilterLegend] = useState(null)

  useKeyboard({ Escape: () => { setModal(null); setSeriesAction(null) }, n: () => { setForm({ student_id: '', date: '', time: '16:00', notes: '' }); setRecurForm({ student_id: '', day_of_week: '0', time: '16:00', start_date: '', end_date: '', notes: '' }); setAddTab('single'); setModal('add') } })

  const { sorted, sortKey, sortDir, toggle, search, setSearch } = useSort([], 'date', 'asc')

  const load = () => {
    let params = []
    if (filterStudent) params.push(`student_id=${filterStudent}`)
    if (startDate) params.push(`start_date=${startDate}`)
    if (endDate) params.push(`end_date=${endDate}`)
    const query = params.length ? `?${params.join('&')}` : ''
    
    return Promise.all([api.get(`/sessions${query}`), api.get('/students'), api.get('/auth/users')]).then(([s, st, u]) => {
      setSessions(s.data)
      setStudents(st.data.slice().sort((a,b) => a.name.localeCompare(b.name)))
      setTeachers(u.data.filter(u => ['admin','teacher'].includes(u.role)).sort((a,b) => (a.full_name||a.username).localeCompare(b.full_name||b.username)))
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [filterStudent, startDate, endDate])

  const studentFor = id => students.find(s => s.id === id)
  const studentIdx = id => students.findIndex(s => s.id === id)

  // Apply search + status filter + sort
  const visible = useMemo(() => {
    let rows = sessions.filter(s => {
      const matchStatus = (!filterStatus || s.status === filterStatus) && matchesLegend(s, filterLegend)
      const matchStart = !startDate || s.date >= startDate
      const matchEnd = !endDate || s.date <= endDate
      return matchStatus && matchStart && matchEnd
    })
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(s => {
        const st = studentFor(s.student_id)
        return st?.name?.toLowerCase().includes(q) || s.date.includes(q) || s.status.includes(q) || (s.notes || '').toLowerCase().includes(q)
      })
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        let av = sortKey === 'student' ? (studentFor(a.student_id)?.name || '') : a[sortKey] || ''
        let bv = sortKey === 'student' ? (studentFor(b.student_id)?.name || '') : b[sortKey] || ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [sessions, filterStatus, filterLegend, search, sortKey, sortDir, students, startDate, endDate])

  const { 
    paginatedData, 
    currentPage, 
    pageSize, 
    setPageSize, 
    totalPages, 
    nextPage, 
    prevPage, 
    goToPage, 
    totalRecords 
  } = usePagination(visible)

  const updateStatus = async (session, status) => {
    await api.put(`/sessions/${session.id}`, { status })
    toast.success(status === 'completed' ? '✅ Session completed!' : '❌ Session cancelled')
    load()
  }

  const cancelSession = s => {
    if (s.series_id) { setSeriesAction({ type: 'cancel', session: s }); setModal(null) }
    else { setConfirm({ message: `Cancel this session for ${studentFor(s.student_id)?.name} on ${fmtDateWithDay(s.date)}?`, onConfirm: () => { updateStatus(s, 'cancelled'); setModal(null) } }) }
  }

  const deleteSession = s => {
    if (s.series_id) { setSeriesAction({ type: 'delete', session: s }); setModal(null) }
    else { setModal(null); setConfirm({ message: 'Delete this session? This cannot be undone.', onConfirm: () => api.delete(`/sessions/${s.id}`).then(() => { toast.success('🗑️ Deleted'); load() }) }) }
  }

  const applySeriesEdit = async scope => {
    const { session, payload } = seriesEdit
    setSeriesEdit(null); setSaving(true)
    try {
      if (scope === 'this') {
        await api.put(`/sessions/${session.id}`, payload)
        toast.success('✅ Session updated!')
      } else {
        await api.put(`/sessions/${session.id}`, payload)
        await api.put(`/sessions/series/${session.series_id}/update-from?from_date=${session.date}`, payload)
        toast.success('✅ This & all future sessions updated!')
      }
    } catch { toast.error('Something went wrong 😬') }
    finally { setSaving(false) }
    load()
  }

  const applySeriesAction = async scope => {
    const { type, session } = seriesAction
    setSeriesAction(null)
    try {
      if (scope === 'this') {
        if (type === 'cancel') {
          await api.put(`/sessions/${session.id}`, { status: 'cancelled' })
          toast.success('❌ Session cancelled')
        } else {
          await api.delete(`/sessions/${session.id}`)
          toast.success('🗑️ Session deleted')
        }
      } else {
        if (type === 'cancel') {
          await api.post(`/sessions/series/${session.series_id}/cancel-from?from_date=${session.date}`)
          toast.success('❌ This & all future sessions cancelled')
        } else {
          await api.delete(`/sessions/series/${session.series_id}?future_only=true`)
          toast.success('🗑️ This & all future sessions deleted')
        }
      }
    } catch { toast.error('Something went wrong 😬') }
    load()
  }

  const save = async e => {
    e.preventDefault()
    setSavingMsg(addTab === 'recurring' ? 'Creating recurring sessions…' : modal === 'add' ? 'Adding session…' : 'Saving changes…')
    setSaving(true)
    try {
      if (modal === 'add') {
        if (addTab === 'recurring') {
          await api.post('/sessions/series', {
            student_id: Number(recurForm.student_id),
            day_of_week: Number(recurForm.day_of_week),
            time: recurForm.time,
            start_date: recurForm.start_date,
            end_date: recurForm.end_date || null,
            notes: recurForm.notes || null,
            teacher_id: recurForm.teacher_id ? Number(recurForm.teacher_id) : null,
          })
          toast.success('🔁 Recurring sessions created!')
        } else {
          await api.post('/sessions', { student_id: Number(form.student_id), date: form.date, time: form.time, notes: form.notes || null, teacher_id: form.teacher_id ? Number(form.teacher_id) : null })
          toast.success('📅 Session added!')
        }
      } else {
        const payload = { date: form.date, time: form.time, notes: form.notes || null, teacher_id: form.teacher_id ? Number(form.teacher_id) : null }
        if (modal.series_id) {
          // Ask user: just this one or all future?
          setSeriesEdit({ session: modal, payload })
          setModal(null)
          setSaving(false)
          return
        }
        await api.put(`/sessions/${modal.id}`, payload)
        toast.success('✅ Session updated!')
      }
      setModal(null); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Something went wrong 😬') }
    finally { setSaving(false) }
  }

  const del = s => setConfirm({ message: 'Delete this session? This cannot be undone.', onConfirm: () => api.delete(`/sessions/${s.id}`).then(() => { toast.success('🗑️ Deleted'); load() }) })

  const chargeCancel = async s => {
    await api.post(`/payments/charge-cancelled/${s.id}`)
    toast.success('💰 Charge added!')
    load()
  }

  const waiveCharge = async s => {
    await api.post(`/payments/waive/${s.id}`)
    toast.success('✅ Charge waived')
    load()
  }

  const openAdd = () => { setForm({ student_id: '', date: '', time: '16:00', notes: '', teacher_id: '' }); setRecurForm({ student_id: '', day_of_week: '0', time: '16:00', start_date: '', end_date: '', notes: '' }); setAddTab('single'); setModal('add') }
  const openAddOnDate = date => { setForm({ student_id: '', date, time: '16:00', notes: '', teacher_id: '' }); setRecurForm({ student_id: '', day_of_week: '0', time: '16:00', start_date: date, end_date: '', notes: '' }); setAddTab('single'); setModal('add') }
  const openEdit = s => { setForm({ student_id: s.student_id, date: s.date, time: s.time, notes: s.notes || '', teacher_id: s.teacher_id || '' }); setModal(s) }
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const onSessionClick = s => openEdit(s)

  // Calendar nav
  const prevWeek = () => setWeekStart(d => addDays(d, -7))
  const nextWeek = () => setWeekStart(d => addDays(d, 7))
  const todayWeek = () => setWeekStart(startOfWeek(new Date()))
  const prevMonth = () => setCalMonth(({ year, month }) => month === 0 ? { year: year-1, month: 11 } : { year, month: month-1 })
  const nextMonth = () => setCalMonth(({ year, month }) => month === 11 ? { year: year+1, month: 0 } : { year, month: month+1 })
  const todayMonth = () => setCalMonth({ year: new Date().getFullYear(), month: new Date().getMonth() })

  const weekEnd = addDays(weekStart, 6)
  const weekLabel = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()].slice(0,3)} – ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()].slice(0,3)} ${weekEnd.getFullYear()}`

  return (
    <div className="page">
      <div className="page-header">
        <h1>📅 Sessions</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'rgba(124,58,237,0.08)', borderRadius: 999, padding: '0.2rem' }}>
            {[['list','☰ List'],['week','📅 Week'],['month','🗓️ Month']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                background: view === v ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'transparent',
                color: view === v ? 'white' : '#7c3aed', border: 'none', borderRadius: 999,
                padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
              }}>{label}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Session</button>
          <button className="btn btn-secondary" title="Sync RSVP from Google Calendar" onClick={async () => {
            setSavingMsg('Syncing RSVP statuses…')
            setSaving(true)
            try {
              await api.post('/sessions/sync-rsvp')
              toast.success('🗓️ RSVP statuses refreshed!')
              await load()
            } finally { setSaving(false) }
          }}>🗓️ Sync RSVP</button>
        </div>
      </div>

      {/* Colour legend — clickable filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
        {[
          { key: 'accepted',   color: '#7c3aed', label: 'Invite accepted' },
          { key: 'needsAction',color: '#3b82f6', label: 'Invite pending' },
          { key: 'tentative',  color: '#f59e0b', label: 'Tentative' },
          { key: 'declined',   color: '#ef4444', label: 'Invite declined' },
          { key: 'completed',  color: '#10b981', label: 'Completed' },
          { key: 'cancelled',  color: '#9ca3af', label: 'Cancelled' },
          { key: 'scheduled',  color: '#6b7280', label: 'Scheduled' },
        ].map(({ key, color, label }) => {
          const active = filterLegend === key
          return (
            <div key={key} onClick={() => setFilterLegend(active ? null : key)} style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              cursor: 'pointer', padding: '0.25rem 0.6rem', borderRadius: 999,
              background: active ? color + '22' : 'transparent',
              border: `1.5px solid ${active ? color : 'transparent'}`,
              transition: 'all 0.15s',
              opacity: filterLegend && !active ? 0.45 : 1,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: active ? color : '#6b7280' }}>{label}</span>
            </div>
          )
        })}
        {filterLegend && (
          <div onClick={() => setFilterLegend(null)} style={{
            cursor: 'pointer', padding: '0.25rem 0.6rem', borderRadius: 999,
            fontSize: '0.72rem', color: '#9ca3af', fontWeight: 700,
            border: '1.5px solid rgba(156,163,175,0.3)',
          }}>✕ clear</div>
        )}
      </div>
      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        {view === 'list' && <SearchBar value={search} onChange={setSearch} placeholder="Search sessions…" />}
        
        {view === 'list' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--glass)', padding: '0.3rem 0.75rem', borderRadius: 999, border: '2px solid rgba(124,58,237,0.15)', flexWrap: 'nowrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase' }}>From</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', outline: 'none', color: '#1e1b4b', width: 'auto' }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase' }}>To</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', outline: 'none', color: '#1e1b4b', width: 'auto' }}
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate('') }}
                style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 900 }}
                title="Clear dates"
              >✕</button>
            )}
          </div>
        )}

        <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
          <option value="">👤 All students</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {view === 'list' && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">🔖 All statuses</option>
            <option value="scheduled">📅 Scheduled</option>
            <option value="completed">✅ Completed</option>
            <option value="cancelled">❌ Cancelled</option>
          </select>
        )}
      </div>

      {/* Calendar nav */}
      {view === 'week' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevWeek}>‹</button>
          <button className="btn btn-secondary btn-sm" onClick={todayWeek}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={nextWeek}>›</button>
          <span style={{ fontWeight: 800, color: '#374151' }}>{weekLabel}</span>
        </div>
      )}
      {view === 'month' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}>‹</button>
          <button className="btn btn-secondary btn-sm" onClick={todayMonth}>Today</button>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}>›</button>
          <span style={{ fontWeight: 800, color: '#374151', fontSize: '1.1rem' }}>{MONTH_NAMES[calMonth.month]} {calMonth.year}</span>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        loading ? (
          <div className="table-wrap"><table><tbody><SkeletonRow cols={6} /><SkeletonRow cols={6} /><SkeletonRow cols={6} /></tbody></table></div>
        ) : visible.length === 0 ? (
          <EmptyState icon="📅" title="No sessions found" subtitle="Add your first session or adjust the filters" action="+ Add Session" onAction={openAdd} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortTh label="Student" col="student" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortTh label="Date" col="date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortTh label="Time" col="time" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortTh label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <th>Notes</th>
                  <th>RSVP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(s => {
                  const st = studentFor(s.student_id)
                  const idx = studentIdx(s.student_id)
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Avatar avatar={st?.avatar} name={st?.name} index={idx} />
                          <span style={{ fontWeight: 800 }}>{st?.name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{fmtDateWithDay(s.date)}</td>
                      <td>{fmtTime(s.time)}</td>
                      <td>
                        {s.status === 'scheduled' && <span className="badge badge-scheduled">📅 scheduled</span>}
                        {s.status === 'completed' && <span className="badge badge-completed">✅ completed</span>}
                        {s.status === 'cancelled' && !s.charge_status && <span className="badge badge-cancelled">❌ cancelled</span>}
                        {s.status === 'cancelled' && s.charge_status === 'charged' && <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>💰 charged</span>}
                        {s.status === 'cancelled' && s.charge_status === 'waived' && <span className="badge" style={{ background: 'rgba(107,114,128,0.12)', color: '#6b7280' }}>🚫 waived</span>}
                      </td>
                      <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{s.notes || '—'}</td>
                      <td>{
                        s.rsvp_status === 'accepted'    ? <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>✅ Accepted</span> :
                        s.rsvp_status === 'declined'    ? <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>❌ Declined</span> :
                        s.rsvp_status === 'tentative'   ? <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>❓ Tentative</span> :
                        s.rsvp_status === 'needsAction' ? <span className="badge" style={{ background: 'rgba(107,114,128,0.1)', color: '#6b7280' }}>📩 Pending</span> :
                        s.google_event_id ? <span style={{ color: '#d1d5db', fontSize: '0.78rem' }}>No invite</span> :
                        <span style={{ color: '#d1d5db' }}>—</span>
                      }</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {s.status === 'scheduled' && (
                            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(16,185,129,0.08)', padding: '0.2rem', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.15)' }}>
                              <button className="btn btn-success btn-sm" style={{ padding: '0.25rem 0.6rem' }} onClick={() => updateStatus(s, 'completed')}>✓ Done</button>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.6rem' }} onClick={() => cancelSession(s)}>✕</button>
                            </div>
                          )}
                          
                          {s.status === 'cancelled' && (
                            <div style={{ display: 'flex', gap: '0.2rem', background: '#fff7ed', padding: '0.15rem', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                              {!s.charge_status && (
                                <>
                                  <button className="btn btn-sm" style={{ background: 'white', color: '#d97706', fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', border: '1px solid #ffedd5', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onClick={() => chargeCancel(s)}>💰 Charge</button>
                                  <button className="btn btn-sm" style={{ background: 'white', color: '#6b7280', fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', border: '1px solid #ffedd5', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onClick={() => waiveCharge(s)}>🚫 Waive</button>
                                </>
                              )}
                              {s.charge_status === 'charged' && s.payment_status !== 'received' && (
                                <button className="btn btn-sm" style={{ background: 'white', color: '#6b7280', fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', border: '1px solid #ffedd5', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onClick={() => waiveCharge(s)}>🚫 Waive Charge</button>
                              )}
                              {s.charge_status === 'waived' && (
                                <button className="btn btn-sm" style={{ background: 'white', color: '#d97706', fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', border: '1px solid #ffedd5', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onClick={() => chargeCancel(s)}>💰 Charge instead</button>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto' }}>
                            <button className="btn btn-secondary btn-sm" style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center' }} onClick={() => openEdit(s)}>✏️</button>
                            <button className="btn btn-danger btn-sm" style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center' }} onClick={() => deleteSession(s)}>🗑️</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              setPageSize={setPageSize}
              nextPage={nextPage}
              prevPage={prevPage}
              goToPage={goToPage}
              totalRecords={totalRecords}
            />
          </div>
        )
      )}

      {/* Week view */}
      {view === 'week' && <WeekView sessions={sessions.filter(s => matchesLegend(s, filterLegend))} students={students} weekStart={weekStart} onSessionClick={onSessionClick} onDayClick={openAddOnDate} />}

      {/* Month view */}
      {view === 'month' && <MonthView sessions={sessions.filter(s => matchesLegend(s, filterLegend))} students={students} year={calMonth.year} month={calMonth.month} onSessionClick={onSessionClick} onDayClick={openAddOnDate} />}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'add' ? '📅 Add Session' : '✏️ Edit Session'}</h2>
            <form onSubmit={save}>
              {/* Tab toggle — only when adding */}
              {modal === 'add' && (
                <div style={{ display: 'flex', background: 'rgba(124,58,237,0.08)', borderRadius: 999, padding: '0.2rem', marginBottom: '1.25rem', alignSelf: 'flex-start', width: 'fit-content' }}>
                  {[['single', '📅 Single'], ['recurring', '🔁 Recurring']].map(([tab, label]) => (
                    <button key={tab} type="button" onClick={() => setAddTab(tab)} style={{
                      background: addTab === tab ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'transparent',
                      color: addTab === tab ? 'white' : '#7c3aed', border: 'none', borderRadius: 999,
                      padding: '0.35rem 1rem', fontSize: '0.82rem', fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                    }}>{label}</button>
                  ))}
                </div>
              )}

              {/* Single session fields */}
              {(modal !== 'add' || addTab === 'single') && (
                <>
                  {modal === 'add' && (
                    <div className="form-group">
                      <label>🎓 Student *</label>
                      <select value={form.student_id} onChange={set('student_id')} required>
                        <option value="">Select student…</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="form-row">
                    <div className="form-group"><label>📅 Date *</label><input type="date" value={form.date} onChange={set('date')} required /></div>
                    <div className="form-group"><label>🕐 Time *</label><input type="time" value={form.time} onChange={set('time')} required /></div>
                  </div>
                  <div className="form-group">
                    <label>👨🏫 Teacher</label>
                    <select value={form.teacher_id} onChange={set('teacher_id')}>
                      <option value="">Select teacher…</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.username}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>📝 Notes</label><textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Any notes…" /></div>
                </>
              )}

              {/* Recurring series fields */}
              {modal === 'add' && addTab === 'recurring' && (
                <>
                  <div className="form-group">
                    <label>🎓 Student *</label>
                    <select value={recurForm.student_id} onChange={e => setRecurForm(f => ({ ...f, student_id: e.target.value }))} required>
                      <option value="">Select student…</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>📆 Day of week *</label>
                      <select value={recurForm.day_of_week} onChange={e => setRecurForm(f => ({ ...f, day_of_week: e.target.value }))} required>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d, i) => (
                          <option key={i} value={i}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group"><label>🕐 Time *</label><input type="time" value={recurForm.time} onChange={e => setRecurForm(f => ({ ...f, time: e.target.value }))} required /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>📅 Start Date *</label><input type="date" value={recurForm.start_date} onChange={e => setRecurForm(f => ({ ...f, start_date: e.target.value }))} required /></div>
                    <div className="form-group"><label>📅 End Date <span style={{fontWeight:500,opacity:0.6}}>(optional)</span></label><input type="date" value={recurForm.end_date} onChange={e => setRecurForm(f => ({ ...f, end_date: e.target.value }))} /></div>
                  </div>
                  <div className="form-group"><label>📝 Notes</label><textarea rows={2} value={recurForm.notes} onChange={e => setRecurForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes…" /></div>
                  <div className="form-group">
                    <label>👨🏫 Teacher</label>
                    <select value={recurForm.teacher_id || ''} onChange={e => setRecurForm(f => ({ ...f, teacher_id: e.target.value }))}>
                      <option value="">Select teacher…</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.username}</option>)}
                    </select>
                  </div>
                  <div style={{ background: 'rgba(124,58,237,0.06)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#7c3aed', fontWeight: 700, marginBottom: '0.5rem' }}>
                    💡 Sessions will be created every week on the chosen day. If no end date is set, sessions will be generated up to 1 year ahead.
                  </div>
                </>
              )}

              {modal !== 'add' && (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {modal.status === 'scheduled' && (
                    <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(16,185,129,0.08)', padding: '0.25rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)' }}>
                      <button type="button" className="btn btn-success btn-sm" onClick={() => { updateStatus(modal, 'completed'); setModal(null) }}>✓ Mark Done</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => cancelSession(modal)}>✕ Cancel</button>
                    </div>
                  )}
                  
                  {modal.status === 'cancelled' && (
                    <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(245,158,11,0.08)', padding: '0.25rem', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.15)' }}>
                      {!modal.charge_status && (
                        <>
                          <button type="button" className="btn btn-secondary btn-sm" style={{ color: '#f59e0b', borderColor: 'transparent', background: 'transparent' }} onClick={() => { chargeCancel(modal); setModal(null) }}>💰 Charge</button>
                          <button type="button" className="btn btn-secondary btn-sm" style={{ color: '#6b7280', borderColor: 'transparent', background: 'transparent' }} onClick={() => { waiveCharge(modal); setModal(null) }}>🚫 Waive</button>
                        </>
                      )}
                      {modal.charge_status === 'charged' && modal.payment_status !== 'received' && (
                        <button type="button" className="btn btn-secondary btn-sm" style={{ color: '#6b7280', borderColor: 'transparent', background: 'transparent' }} onClick={() => { waiveCharge(modal, true); setModal(null) }}>🚫 Waive Charge</button>
                      )}
                      {modal.charge_status === 'waived' && (
                        <button type="button" className="btn btn-secondary btn-sm" style={{ color: '#f59e0b', borderColor: 'transparent', background: 'transparent' }} onClick={() => { chargeCancel(modal); setModal(null) }}>💰 Charge instead</button>
                      )}
                    </div>
                  )}

                  {modal.status === 'cancelled' && modal.payment_status === 'received' && (
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, padding: '0.35rem 0.85rem', background: 'rgba(16,185,129,0.1)', borderRadius: 999 }}>✅ Already paid</span>
                  )}
                  
                  <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => deleteSession(modal)}>🗑️ Delete</button>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '✨ Saving…' : '💾 Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Series scope picker modal */}
      {seriesEdit && (
        <div className="modal-overlay" onClick={() => setSeriesEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2>✏️ Edit Session</h2>
            <p style={{ color: '#6b7280', fontWeight: 600, marginBottom: '1.5rem' }}>
              This session is part of a recurring series. What would you like to update?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ textAlign: 'left', padding: '0.85rem 1.1rem' }} onClick={() => applySeriesEdit('this')}>
                <div style={{ fontWeight: 800 }}>This occurrence only</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.2rem' }}>Only {seriesEdit.session.date} will be changed</div>
              </button>
              <button className="btn btn-primary" style={{ textAlign: 'left', padding: '0.85rem 1.1rem' }} onClick={() => applySeriesEdit('future')}>
                <div style={{ fontWeight: 800 }}>This & all future occurrences</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '0.2rem' }}>All scheduled sessions from {seriesEdit.session.date} onwards will be updated</div>
              </button>
            </div>
            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setSeriesEdit(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {seriesAction && (
        <div className="modal-overlay" onClick={() => setSeriesAction(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2>{seriesAction.type === 'cancel' ? '❌ Cancel Session' : '🗑️ Delete Session'}</h2>
            <p style={{ color: '#6b7280', fontWeight: 600, marginBottom: '1.5rem' }}>
              This session is part of a recurring series. What would you like to {seriesAction.type}?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ textAlign: 'left', padding: '0.85rem 1.1rem' }} onClick={() => applySeriesAction('this')}>
                <div style={{ fontWeight: 800 }}>This occurrence</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.2rem' }}>Only {seriesAction.session.date} will be affected</div>
              </button>
              <button className={`btn ${seriesAction.type === 'delete' ? 'btn-danger' : 'btn-secondary'}`} style={{ textAlign: 'left', padding: '0.85rem 1.1rem' }} onClick={() => applySeriesAction('future')}>
                <div style={{ fontWeight: 800 }}>This & all future occurrences</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '0.2rem' }}>All scheduled sessions from {seriesAction.session.date} onwards will be {seriesAction.type === 'cancel' ? 'cancelled' : 'deleted'}</div>
              </button>
            </div>
            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setSeriesAction(null)}>Back</button>
            </div>
          </div>
        </div>
      )}
      {confirm && <ConfirmModal message={confirm.message} onConfirm={() => { confirm.onConfirm(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
      {saving && <LoadingOverlay message={savingMsg} />}
    </div>
  )
}
