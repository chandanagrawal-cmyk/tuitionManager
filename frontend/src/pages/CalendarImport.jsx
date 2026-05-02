import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { fmtDateShort } from '../utils/dates'

const COLORS = ['#7c3aed','#ec4899','#0d9488','#f59e0b','#3b82f6','#10b981','#f97316','#8b5cf6']
const initials = name => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?'

export default function CalendarImport() {
  const navigate = useNavigate()
  const [connected, setConnected] = useState(false)
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)

  useEffect(() => {
    api.get('/calendar/status').then(r => {
      setConnected(r.data.connected)
      if (r.data.connected) loadPreview()
    })
  }, [])

  const connect = async () => {
    const { data } = await api.get('/calendar/auth')
    window.location.href = data.auth_url
  }

  const loadPreview = async () => {
    setLoading(true)
    setPreview(null)
    setSelected(new Set())
    try {
      const { data } = await api.get('/calendar/preview')
      setPreview(data)
      if (data.students.length === 0) {
        toast('🤔 No weekly repeating sessions found', { icon: '📅' })
      } else {
        toast.success(`Found ${data.students.length} weekly recurring events!`)
      }
    } catch {
      toast.error('Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }

  const toggle = name => setSelected(s => {
    const n = new Set(s)
    n.has(name) ? n.delete(name) : n.add(name)
    return n
  })

  const toggleAll = () => {
    if (!preview) return
    if (selected.size === preview.students.length) setSelected(new Set())
    else setSelected(new Set(preview.students.map(s => s.student_name)))
  }

  const doImport = async () => {
    if (!selected.size) return toast.error('Please select at least one student')
    setImporting(true)
    try {
      const { data } = await api.post('/calendar/import-all', { selected: [...selected] })
      setResults(data.results)
      const total = data.results.reduce((s, r) => s + r.imported, 0)
      toast.success(`🎉 Imported ${total} sessions for ${data.total_students} students!`)
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  const selectedSessions = preview
    ? preview.students.filter(s => selected.has(s.student_name)).reduce((sum, s) => sum + s.session_count, 0)
    : 0

  return (
    <div className="page">
      <div className="page-header">
        <h1>📅 Import from Google Calendar</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/sessions')}>← Back to Sessions</button>
      </div>

      {/* Connect bar */}
      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: `4px solid ${connected ? '#10b981' : '#7c3aed'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '0.25rem' }}>
              {connected ? '✅ Connected to Google Calendar' : '1️⃣ Connect your Google Calendar'}
            </div>
            <div style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: 600 }}>
              {connected ? 'rochika.agrawal@gmail.com — Google Calendar is the master source' : 'Authorise access to read your calendar events'}
            </div>
          </div>
          {!connected
            ? <button className="btn btn-primary" onClick={connect}>🔗 Connect Google Calendar</button>
            : <button className="btn btn-secondary" onClick={loadPreview} disabled={loading}>{loading ? '⏳ Scanning…' : '🔄 Re-scan Calendar'}</button>
          }
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
          <div style={{ fontWeight: 800, color: '#7c3aed', fontSize: '1.1rem' }}>Scanning your calendar…</div>
          <div style={{ color: '#9ca3af', marginTop: '0.5rem', fontWeight: 600 }}>Looking for weekly repeating events</div>
        </div>
      )}

      {/* Preview with checkboxes */}
      {preview && !results && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>
                Found {preview.students.length} weekly recurring event{preview.students.length !== 1 ? 's' : ''} — tick the ones that are tuition sessions
              </div>
              <div style={{ color: '#9ca3af', fontWeight: 600, fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Google Calendar is the master — sessions will always sync from there
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
                {selected.size === preview.students.length ? 'Deselect All' : 'Select All'}
              </button>
              <button className="btn btn-primary" onClick={doImport} disabled={importing || !selected.size}>
                {importing ? '⏳ Importing…' : `🚀 Import ${selectedSessions} Session${selectedSessions !== 1 ? 's' : ''} for ${selected.size} Student${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {preview.students.length === 0
            ? <div className="empty">No weekly repeating events found in your calendar</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {preview.students.map((st, i) => {
                  const isSelected = selected.has(st.student_name)
                  return (
                    <div
                      key={st.student_name}
                      className="card"
                      onClick={() => toggle(st.student_name)}
                      style={{
                        borderLeft: `4px solid ${COLORS[i % COLORS.length]}`,
                        cursor: 'pointer',
                        outline: isSelected ? `2px solid ${COLORS[i % COLORS.length]}` : '2px solid transparent',
                        transition: 'all 0.15s',
                        background: isSelected ? `${COLORS[i % COLORS.length]}08` : 'var(--glass)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {/* Checkbox */}
                        <div style={{
                          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                          border: `2px solid ${isSelected ? COLORS[i % COLORS.length] : '#d1d5db'}`,
                          background: isSelected ? COLORS[i % COLORS.length] : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '0.85rem', fontWeight: 900,
                          transition: 'all 0.15s',
                        }}>
                          {isSelected ? '✓' : ''}
                        </div>

                        {/* Avatar */}
                        <div className="avatar" style={{ background: COLORS[i % COLORS.length], width: 42, height: 42, fontSize: '1rem', flexShrink: 0 }}>
                          {initials(st.student_name)}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, fontSize: '1rem' }}>{st.student_name}</div>
                          <div style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600 }}>
                            Every {st.default_day_name} at {st.default_time} · {st.session_count} sessions found
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                            {st.events.slice(0, 10).map(e => (
                              <span key={e.id} style={{
                                background: `${COLORS[i % COLORS.length]}15`,
                                color: COLORS[i % COLORS.length],
                                border: `1px solid ${COLORS[i % COLORS.length]}30`,
                                borderRadius: 999, padding: '0.15rem 0.6rem',
                                fontSize: '0.72rem', fontWeight: 700,
                              }}>
                                {new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' })}
                              </span>
                            ))}
                            {st.events.length > 10 && (
                              <span style={{ color: '#9ca3af', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.4rem' }}>
                                +{st.events.length - 10} more
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Session count badge */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 900, color: COLORS[i % COLORS.length], fontSize: '1.3rem' }}>{st.session_count}</div>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 700 }}>sessions</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }
        </>
      )}

      {/* Results */}
      {results && (
        <div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: '1rem', color: '#10b981' }}>🎉 Import complete!</div>
          <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
            <table>
              <thead><tr><th>Student</th><th>Parent Created</th><th>Sessions Imported</th><th>Previous Sessions Cleared</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.student}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div className="avatar" style={{ background: COLORS[i % COLORS.length] }}>{initials(r.student)}</div>
                        <span style={{ fontWeight: 800 }}>{r.student}</span>
                      </div>
                    </td>
                    <td style={{ color: '#6b7280', fontWeight: 600 }}>{r.parent}</td>
                    <td><span style={{ fontWeight: 900, color: '#10b981' }}>✅ {r.imported}</span></td>
                    <td><span style={{ fontWeight: 700, color: '#9ca3af' }}>{r.deleted ?? r.skipped}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/sessions')}>📅 View Sessions</button>
            <button className="btn btn-secondary" onClick={() => navigate('/students')}>🎓 View Students</button>
            <button className="btn btn-secondary" onClick={() => { setResults(null); loadPreview() }}>🔄 Re-scan & Sync Again</button>
          </div>
        </div>
      )}
    </div>
  )
}
