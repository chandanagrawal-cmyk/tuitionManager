import { useEffect, useState, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import ChatPanel from '../components/ChatPanel'
import { Avatar, AvatarPicker, STUDENT_AVATARS } from '../components/Avatar'
import { useSort, SortTh, SearchBar } from '../hooks/useSort'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'
import ConfirmModal from '../components/ConfirmModal'
import EmptyState from '../components/EmptyState'
import { SkeletonRow } from '../components/Skeleton'
import useKeyboard from '../hooks/useKeyboard'
import LoadingOverlay from '../components/LoadingOverlay'

import { fmtCurrency } from '../utils/dates'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const RELATIONSHIPS = ['Mother','Father','Sister','Brother','Guardian','Other']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const SCHOOL_YEARS = ['Year 1','Year 2','Year 3','Year 4','Year 5','Year 6','Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13','Other']

const emptyStudent = { name: '', subject: '', default_day: 0, default_time: '16:00', fee_per_session: 35, phone: '', email: '', birth_month: '', birth_year: '', school_year: '', avatar: '' }

export default function Students() {
  const [students, setStudents] = useState([])
  const [parents, setParents] = useState([])
  const [studentModal, setStudentModal] = useState(null)
  const [studentForm, setStudentForm] = useState(emptyStudent)
  const [guardianModal, setGuardianModal] = useState(null) // { student, link? }
  const [guardianForm, setGuardianForm] = useState({ parent_id: '', relationship_type: 'Guardian', is_primary: false })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(new Set())
  const [chatContacts, setChatContacts] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionCounts, setSessionCounts] = useState({})
  const [pendingBalances, setPendingBalances] = useState({})
  const [lumpCredits, setLumpCredits] = useState({})

  useKeyboard({ Escape: () => { setStudentModal(null); setGuardianModal(null) }, n: () => { setStudentForm(emptyStudent); setStudentModal('add') } })

  const navigate = useNavigate()
  const { sortKey, sortDir, toggle, search, setSearch } = useSort([], 'name', 'asc')

  const load = () => Promise.all([
    api.get('/students'), api.get('/parents'), api.get('/sessions'), api.get('/payments'), api.get('/lump-sum-payments')
  ]).then(([s, p, sess, pay, lumps]) => {
    setStudents(s.data.slice().sort((a,b) => a.name.localeCompare(b.name)))
    setParents(p.data.slice().sort((a,b) => a.name.localeCompare(b.name)))
    const counts = {}; const balances = {}; const credits = {}
    s.data.forEach(st => {
      const stSess = sess.data.filter(se => se.student_id === st.id)
      const total = stSess.length
      const completed = stSess.filter(se => se.status === 'completed').length
      counts[st.id] = total > 0 ? Math.round((completed / total) * 100) : null
      const stPay = pay.data.filter(pa => {
        const se = sess.data.find(se => se.id === pa.session_id)
        return se?.student_id === st.id && pa.status === 'pending'
      })
      balances[st.id] = stPay.reduce((sum, pa) => sum + pa.amount, 0)
      credits[st.id] = lumps.data
        .filter(l => l.student_id === st.id)
        .reduce((sum, l) => sum + Math.max(0, l.amount - (l.allocated_amount || 0)), 0)
    })
    setSessionCounts(counts); setPendingBalances(balances); setLumpCredits(credits); setLoading(false)
  })
  useEffect(() => { load() }, [])

  const visible = useMemo(() => {
    let rows = [...students]
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(s => s.name?.toLowerCase().includes(q) || s.subject?.toLowerCase().includes(q) || s.school_year?.toLowerCase().includes(q))
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const av = sortKey === 'fee' ? a.fee_per_session : sortKey === 'year' ? (a.school_year || '') : (a[sortKey] || '')
        const bv = sortKey === 'fee' ? b.fee_per_session : sortKey === 'year' ? (b.school_year || '') : (b[sortKey] || '')
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [students, search, sortKey, sortDir])

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

  // ── Student CRUD ──
  const openAddStudent = () => { setStudentForm(emptyStudent); setStudentModal('add') }
  const openEditStudent = s => {
    setStudentForm({ name: s.name, subject: s.subject || '', default_day: s.default_day, default_time: s.default_time, fee_per_session: s.fee_per_session, phone: s.phone || '', email: s.email || '', birth_month: s.birth_month || '', birth_year: s.birth_year || '', school_year: s.school_year || '', avatar: s.avatar || '' })
    setStudentModal(s)
  }
  const saveStudent = async e => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        name: studentForm.name,
        subject: studentForm.subject || null,
        default_day: Number(studentForm.default_day),
        default_time: studentForm.default_time,
        fee_per_session: Number(studentForm.fee_per_session),
        phone: studentForm.phone || null,
        email: studentForm.email || null,
        birth_month: studentForm.birth_month ? Number(studentForm.birth_month) : null,
        birth_year: studentForm.birth_year ? Number(studentForm.birth_year) : null,
        school_year: studentForm.school_year || null,
        avatar: studentForm.avatar || null,
      }
      if (studentModal === 'add') { await api.post('/students', payload); toast.success('🎓 Student added!') }
      else { await api.put(`/students/${studentModal.id}`, payload); toast.success('✅ Updated!') }
      setStudentModal(null); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Something went wrong 😬') }
    finally { setSaving(false) }
  }
  const delStudent = s => setConfirm({ message: `Remove ${s.name}? All their sessions will be removed too.`, onConfirm: async () => { await api.delete(`/students/${s.id}`); toast.success('🗑️ Removed'); load() } })

  // ── Guardian CRUD ──
  const openAddGuardian = s => {
    setGuardianForm({ parent_id: '', relationship_type: 'Guardian', is_primary: s.guardians.length === 0 })
    setGuardianModal({ student: s, link: null })
  }
  const openEditGuardian = (s, link) => {
    setGuardianForm({ parent_id: link.parent_id, relationship_type: link.relationship_type, is_primary: link.is_primary })
    setGuardianModal({ student: s, link })
  }
  const saveGuardian = async e => {
    e.preventDefault(); setSaving(true)
    try {
      const { student, link } = guardianModal
      const payload = { ...guardianForm, parent_id: Number(guardianForm.parent_id), is_primary: Boolean(guardianForm.is_primary) }
      if (!link) { await api.post(`/students/${student.id}/guardians`, payload); toast.success('👨👩👧 Guardian added!') }
      else { await api.put(`/students/${student.id}/guardians/${link.id}`, payload); toast.success('✅ Guardian updated!') }
      setGuardianModal(null); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Something went wrong 😬') }
    finally { setSaving(false) }
  }
  const delGuardian = (s, link) => setConfirm({ message: `Remove ${link.parent.name} as guardian of ${s.name}?`, onConfirm: async () => { try { await api.delete(`/students/${s.id}/guardians/${link.id}`); toast.success('🗑️ Guardian removed'); load() } catch (err) { toast.error(err.response?.data?.detail || 'Must keep at least one guardian') } } })
  const setPrimary = async (s, link) => {
    await api.put(`/students/${s.id}/guardians/${link.id}`, { is_primary: true })
    toast.success('⭐ Primary contact updated'); load()
  }

  const openChat = s => {
    const contacts = [
      ...(s.phone ? [{ name: s.name, number: s.phone, label: 'Student' }] : [{ name: s.name, number: null, label: 'Student' }]),
      ...s.guardians.map(g => ({ name: g.parent.name, number: g.parent.phone || null, label: g.relationship_type }))
    ]
    setChatContacts(contacts)
  }

  const toggleExpand = id => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const set = (form, setForm) => k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="page">
      <div className="page-header">
        <h1>🎓 Students</h1>
        <button className="btn btn-primary" onClick={openAddStudent}>+ Add Student</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search students…" />
      </div>

      {loading ? (
        <div className="table-wrap"><table><tbody><SkeletonRow cols={8} /><SkeletonRow cols={8} /><SkeletonRow cols={8} /></tbody></table></div>
      ) : visible.length === 0 ? (
        <EmptyState icon="🎓" title="No students yet" subtitle="Enrol your first student to get started!" action="+ Add Student" onAction={openAddStudent} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Student" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Subject" col="subject" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Year" col="year" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th>Schedule</th>
                <SortTh label="Fee" col="fee" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th>Attendance</th><th>Balance</th><th>Details</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((s, i) => {
                const primaryGuardian = s.guardians.find(g => g.is_primary) || s.guardians[0]
                const isExpanded = expanded.has(s.id)
                
                return (
                  <Fragment key={s.id}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid rgba(124,58,237,0.06)' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Avatar avatar={s.avatar} name={s.name} index={i} />
                          <span style={{ fontWeight: 800 }}>{s.name}</span>
                        </div>
                      </td>
                      <td>
                        {s.subject
                          ? <span style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', padding: '0.2rem 0.65rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 800 }}>{s.subject}</span>
                          : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{s.school_year || <span style={{ color: '#d1d5db' }}>—</span>}</div>
                        {(s.birth_month && s.birth_year) && <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{MONTHS[s.birth_month - 1]} {s.birth_year}</div>}
                      </td>
                      <td><span style={{ fontWeight: 700 }}>{DAYS[s.default_day]}</span> at {s.default_time}</td>
                      <td><span style={{ fontWeight: 800, color: '#0d9488' }}>{fmtCurrency(s.fee_per_session)}</span></td>
                      <td>
                        {sessionCounts[s.id] !== null && sessionCounts[s.id] !== undefined ? (
                          <span style={{
                            background: sessionCounts[s.id] >= 80 ? 'rgba(16,185,129,0.12)' : sessionCounts[s.id] >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                            color: sessionCounts[s.id] >= 80 ? '#059669' : sessionCounts[s.id] >= 50 ? '#d97706' : '#dc2626',
                            borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.8rem', fontWeight: 800
                          }}>{sessionCounts[s.id]}%</span>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td>
                        {(() => {
                          const pending = pendingBalances[s.id] || 0
                          const credit = lumpCredits[s.id] || 0
                          const net = pending - credit
                          if (pending === 0 && credit === 0)
                            return <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Clear</span>
                          if (credit >= pending)
                            return (
                              <div>
                                <span style={{ color: '#10b981', fontWeight: 700 }}>✅ Covered</span>
                                {credit > pending && <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 700 }}>{fmtCurrency((credit - pending))} credit left</div>}
                              </div>
                            )
                          return (
                            <div>
                              <span style={{ fontWeight: 800, color: '#f59e0b' }}>{fmtCurrency(net)}</span>
                              {credit > 0 && <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 700 }}>{fmtCurrency(credit)} credit held</div>}
                            </div>
                          )
                        })()}
                      </td>
                      <td>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => toggleExpand(s.id)}
                          style={{ fontWeight: 800, color: 'var(--purple)', fontSize: '0.7rem' }}
                        >
                          {isExpanded ? 'Collapse' : 'Manage'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderTop: 'none' }}>
                        <td colSpan={8} style={{ paddingTop: 0, paddingBottom: '1rem' }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '1rem',
                            background: 'rgba(0,0,0,0.015)', 
                            padding: '1rem', 
                            borderRadius: '0.75rem',
                            border: '1px solid rgba(0,0,0,0.03)'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Guardians</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                                  {s.guardians.slice().sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)).map(g => (
                                    <div key={g.id} style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      gap: '0.4rem', 
                                      background: 'white', 
                                      padding: '0.4rem 0.6rem', 
                                      borderRadius: '0.5rem',
                                      border: '1px solid rgba(0,0,0,0.05)',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                      width: '100%'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {g.is_primary && (
                                          <span style={{ fontSize: '0.65rem', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: 'white', borderRadius: 999, padding: '0.05rem 0.4rem', fontWeight: 800 }}>⭐</span>
                                        )}
                                        <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{g.parent.name}</span>
                                        {g.parent.phone && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>📞 {g.parent.phone}</span>}
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.15rem', marginLeft: '0.2rem' }}>
                                        {!g.is_primary && (
                                          <button className="btn btn-secondary btn-sm" style={{ padding: '0.1rem 0.3rem', fontSize: '0.6rem' }} onClick={() => setPrimary(s, g)} title="Set Primary">⭐</button>
                                        )}
                                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.1rem 0.3rem', fontSize: '0.6rem' }} onClick={() => openEditGuardian(s, g)}>✏️</button>
                                        <button className="btn btn-danger btn-sm" style={{ padding: '0.1rem 0.3rem', fontSize: '0.6rem' }} onClick={() => delGuardian(s, g)}>🗑️</button>
                                      </div>
                                    </div>
                                  ))}
                                  <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openAddGuardian(s)}>+ Add</button>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <button className="btn btn-secondary btn-sm" style={{ fontWeight: 700 }} onClick={() => navigate(`/students/${s.id}/ledger`)}>💳 Ledger</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openChat(s)}>💬 Chat</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openEditStudent(s)}>✏️ Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => delStudent(s)}>🗑️ Remove</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
      )}

      {chatContacts && <ChatPanel contacts={chatContacts} onClose={() => setChatContacts(null)} />}
      {confirm && <ConfirmModal message={confirm.message} onConfirm={() => { confirm.onConfirm(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
      {saving && <LoadingOverlay message="Saving…" />}

      {/* Student modal */}
      {studentModal && (
        <div className="modal-overlay" onClick={() => setStudentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{studentModal === 'add' ? '🎓 Add Student' : '✏️ Edit Student'}</h2>
            <form onSubmit={saveStudent}>
              <div className="form-group">
                <label>🖼️ Avatar</label>
                <AvatarPicker value={studentForm.avatar} onChange={v => setStudentForm(f => ({ ...f, avatar: v }))} avatars={STUDENT_AVATARS} />
              </div>
              <div className="form-row">
                <div className="form-group"><label>Full Name *</label><input value={studentForm.name} onChange={set(studentForm, setStudentForm)('name')} placeholder="e.g. Emma Smith" required /></div>
                <div className="form-group"><label>📚 Subject</label><input value={studentForm.subject} onChange={set(studentForm, setStudentForm)('subject')} placeholder="e.g. Maths" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>📞 Phone</label><input value={studentForm.phone} onChange={set(studentForm, setStudentForm)('phone')} placeholder="07700 000000" /></div>
                <div className="form-group"><label>📧 Email</label><input type="email" value={studentForm.email} onChange={set(studentForm, setStudentForm)('email')} placeholder="emma@email.com" /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>🎂 Birth Month</label>
                  <select value={studentForm.birth_month} onChange={set(studentForm, setStudentForm)('birth_month')}>
                    <option value="">Select month…</option>
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>📅 Birth Year</label><input type="number" min="1990" max={new Date().getFullYear()} value={studentForm.birth_year} onChange={set(studentForm, setStudentForm)('birth_year')} placeholder="e.g. 2015" /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>🏫 School Year</label>
                  <select value={studentForm.school_year} onChange={set(studentForm, setStudentForm)('school_year')}>
                    <option value="">Select year…</option>
                    {SCHOOL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>💰 Fee per Session (£)</label><input type="number" step="0.01" value={studentForm.fee_per_session} onChange={set(studentForm, setStudentForm)('fee_per_session')} /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>📅 Day *</label>
                  <select value={studentForm.default_day} onChange={set(studentForm, setStudentForm)('default_day')}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>🕐 Time *</label><input type="time" value={studentForm.default_time} onChange={set(studentForm, setStudentForm)('default_time')} required /></div>
              </div>
              {studentModal === 'add' && (
                <div style={{ background: 'rgba(124,58,237,0.06)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#7c3aed', fontWeight: 700 }}>
                  💡 A default Guardian will be auto-created. You can add more guardians after saving.
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setStudentModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '✨ Saving…' : '💾 Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guardian modal */}
      {guardianModal && (
        <div className="modal-overlay" onClick={() => setGuardianModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{guardianModal.link ? '✏️ Edit Guardian' : '👨👩👧 Add Guardian'}</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
              for {guardianModal.student.name}
            </p>
            <form onSubmit={saveGuardian}>
              {!guardianModal.link && (
                <div className="form-group">
                  <label>👤 Parent / Guardian *</label>
                  <select value={guardianForm.parent_id} onChange={e => setGuardianForm(f => ({ ...f, parent_id: e.target.value }))} required>
                    <option value="">Select from existing parents…</option>
                    {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.35rem', fontWeight: 600 }}>
                    Can't find them? <a href="/parents" style={{ color: '#7c3aed' }}>Add a new parent first →</a>
                  </div>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>🏷️ Relationship *</label>
                  <select value={guardianForm.relationship_type} onChange={e => setGuardianForm(f => ({ ...f, relationship_type: e.target.value }))}>
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'none', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked={guardianForm.is_primary}
                      onChange={e => setGuardianForm(f => ({ ...f, is_primary: e.target.checked }))}
                      style={{ width: 'auto', accentColor: '#7c3aed' }}
                    />
                    ⭐ Set as primary contact
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setGuardianModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '✨ Saving…' : '💾 Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
