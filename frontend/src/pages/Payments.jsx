import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'
import { fmtDateShort, fmtCurrency } from '../utils/dates'
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

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [lumpSums, setLumpSums] = useState([])
  const [sessions, setSessions] = useState([])
  const [students, setStudents] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(null)        // session payment edit
  const [lumpModal, setLumpModal] = useState(null) // null | 'add' | object
  const [form, setForm] = useState({ amount: '', status: 'pending', received_date: '', notes: '' })
  const [lumpForm, setLumpForm] = useState({ student_id: '', amount: '', payment_date: new Date().toISOString().slice(0,10), notes: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [allocateModal, setAllocateModal] = useState(null) // student_id
  const [allocateSelected, setAllocateSelected] = useState([])

  useKeyboard({ Escape: () => { setModal(null); setLumpModal(null) }, n: () => openAddLump() })

  const { sortKey, sortDir, toggle, search, setSearch } = useSort([], 'date', 'desc')
  const lumpSort = useSort([], 'payment_date', 'desc')

  const sessionInfo = id => {
    const s = sessions.find(s => s.id === id)
    if (!s) return { date: '—', studentName: '—', studentIdx: 0, studentAvatar: null, studentId: null }
    const idx = students.findIndex(st => st.id === s.student_id)
    return { date: s.date, studentName: students[idx]?.name || '—', studentIdx: idx, studentAvatar: students[idx]?.avatar || null, studentId: s.student_id }
  }

  const load = () => {
    const params = filterStatus ? `?status=${filterStatus}` : ''
    Promise.all([api.get(`/payments${params}`), api.get('/lump-sum-payments'), api.get('/sessions'), api.get('/students')]).then(([p, ls, s, st]) => {
      setPayments(p.data); setLumpSums(ls.data); setSessions(s.data); setStudents(st.data.slice().sort((a,b) => a.name.localeCompare(b.name))); setLoading(false)
    })
  }
  useEffect(() => { load() }, [filterStatus])

  const visible = useMemo(() => {
    let rows = payments.map(p => ({ ...p, ...sessionInfo(p.session_id) }))
    
    if (startDate) rows = rows.filter(r => r.date >= startDate)
    if (endDate) rows = rows.filter(r => r.date <= endDate)

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.studentName?.toLowerCase().includes(q) || r.date?.includes(q))
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const av = sortKey === 'student' ? a.studentName : sortKey === 'date' ? a.date : sortKey === 'amount' ? a.amount : a[sortKey] || ''
        const bv = sortKey === 'student' ? b.studentName : sortKey === 'date' ? b.date : sortKey === 'amount' ? b.amount : b[sortKey] || ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [payments, sessions, students, search, sortKey, sortDir, startDate, endDate])

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

  const sortedLumpSums = useMemo(() => {
    let rows = [...lumpSums]
    
    if (startDate) rows = rows.filter(r => r.payment_date >= startDate)
    if (endDate) rows = rows.filter(r => r.payment_date <= endDate)

    if (lumpSort.sortKey) {
      rows.sort((a, b) => {
        const av = lumpSort.sortKey === 'student' ? (students.find(s => s.id === a.student_id)?.name || '') : a[lumpSort.sortKey] || ''
        const bv = lumpSort.sortKey === 'student' ? (students.find(s => s.id === b.student_id)?.name || '') : b[lumpSort.sortKey] || ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return lumpSort.sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [lumpSums, lumpSort.sortKey, lumpSort.sortDir, students])

  const lumpPagination = usePagination(sortedLumpSums)

  const saveLump = async e => {
    e.preventDefault(); setSaving(true)
    try {
      if (lumpModal === 'add') {
        await api.post('/lump-sum-payments', { ...lumpForm, student_id: Number(lumpForm.student_id), amount: Number(lumpForm.amount) })
        toast.success('💰 Lump sum recorded!')
      } else {
        await api.put(`/lump-sum-payments/${lumpModal.id}`, { amount: Number(lumpForm.amount), payment_date: lumpForm.payment_date, notes: lumpForm.notes || null })
        toast.success('✅ Updated!')
      }
      setLumpModal(null); load()
    } catch { toast.error('Something went wrong 😬') }
    finally { setSaving(false) }
  }

  const delLump = p => setConfirm({ message: 'Delete this lump sum payment?', onConfirm: async () => { await api.delete(`/lump-sum-payments/${p.id}`); toast.success('🗑️ Deleted'); load() } })

  const openAddLump = () => { setLumpForm({ student_id: '', amount: '', payment_date: new Date().toISOString().slice(0,10), notes: '' }); setLumpModal('add') }
  const openEditLump = p => { setLumpForm({ student_id: p.student_id, amount: p.amount, payment_date: p.payment_date, notes: p.notes || '' }); setLumpModal(p) }

  const openAllocate = studentId => {
    setAllocateSelected([])
    setAllocateModal(studentId)
  }

  const submitAllocate = async () => {
    if (!allocateSelected.length) return
    try {
      const r = await api.post(`/lump-sum-payments/allocate/student/${allocateModal}`, { payment_ids: allocateSelected })
      const msg = r.data.leftover > 0
        ? `✅ ${fmtCurrency(r.data.total_applied)} allocated across ${r.data.allocated} session${r.data.allocated !== 1 ? 's' : ''}. ${fmtCurrency(r.data.leftover)} credit remaining.`
        : `✅ ${fmtCurrency(r.data.total_applied)} fully allocated.`
      toast.success(msg)
      setAllocateModal(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Allocation failed')
    }
  }

  const markReceived = async p => {
    await api.put(`/payments/${p.id}`, { status: 'received', received_date: new Date().toISOString().slice(0, 10) })
    toast.success('💰 Payment received — cha-ching! 🎉')
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#7c3aed','#ec4899','#10b981','#f59e0b'] })
    load()
  }

  const sendReminder = async studentId => {
    try {
      const r = await api.post(`/payments/send-reminder/${studentId}`)
      toast.success(`📧 Reminder sent to ${r.data.to} — ${fmtCurrency(r.data.total)} across ${r.data.sessions} session${r.data.sessions !== 1 ? 's' : ''}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reminder')
    }
  }

  const sendReceipt = async p => {
    try {
      const r = await api.post(`/payments/${p.id}/send-receipt`)
      toast.success(`📧 Receipt sent to ${r.data.to}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send receipt')
    }
  }

  const openEdit = p => {
    setForm({ amount: p.amount, status: p.status, received_date: p.received_date || '', notes: p.notes || '' })
    setModal(p)
  }

  const save = async e => {
    e.preventDefault(); setSaving(true)
    try {
      await api.put(`/payments/${modal.id}`, { ...form, amount: Number(form.amount) })
      toast.success('✅ Payment updated!'); setModal(null); load()
    } catch { toast.error('Something went wrong 😬') }
    finally { setSaving(false) }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  const totalReceived = [
    ...payments.filter(p => p.status === 'received'),
    ...lumpSums.filter(p => p.status === 'received'),
  ].reduce((s, p) => s + p.amount, 0)

  return (
    <div className="page">
      <div className="page-header"><h1>💰 Payments</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={async () => {
            const r = await api.post('/sessions/backfill-payments')
            toast.success(`✅ ${r.data.created} missing payment${r.data.created !== 1 ? 's' : ''} created!`)
            load()
          }}>🔄 Sync Payments</button>
          <button className="btn btn-primary" onClick={openAddLump}>+ Lump Sum</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>⏳</div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b' }}>{fmtCurrency(totalPending)}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>✅</div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>{fmtCurrency(totalReceived)}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Received</div>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search payments…" />
        
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

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">💳 All payments</option>
          <option value="pending">⏳ Pending</option>
          <option value="received">✅ Received</option>
        </select>
      </div>

      {loading ? (
        <div className="table-wrap"><table><tbody><SkeletonRow cols={6} /><SkeletonRow cols={6} /><SkeletonRow cols={6} /></tbody></table></div>
      ) : payments.length === 0 ? (
        <EmptyState icon="💳" title="No payments yet" subtitle="Payments are created automatically when sessions are added" action="Sync Payments" onAction={async () => { const r = await api.post('/sessions/backfill-payments'); toast.success(`✅ ${r.data.created} payments created!`); load() }} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Student" col="student" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Session Date" col="date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Amount" col="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th>Received</th><th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(p => {
                const { date, studentName, studentIdx } = p
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Avatar avatar={p.studentAvatar} name={p.studentName} index={p.studentIdx} />
                        <span style={{ fontWeight: 800 }}>{studentName}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{fmtDateShort(date)}</td>
                    <td><span style={{ fontWeight: 900, color: '#0d9488', fontSize: '1rem' }}>{fmtCurrency(p.amount)}</span></td>
                    <td><span className={`badge badge-${p.status}`}>{p.status === 'pending' ? '⏳ pending' : '✅ received'}</span></td>
                    <td style={{ color: '#9ca3af', fontWeight: 700 }}>{p.received_date || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {p.status === 'pending' && <button className="btn btn-success btn-sm" onClick={() => markReceived(p)}>💰 Received</button>}
                        {p.status === 'pending' && <button className="btn btn-secondary btn-sm" title="Send payment reminder email" onClick={() => sendReminder(p.studentId)}>📧 Remind</button>}
                        {p.status === 'received' && <button className="btn btn-secondary btn-sm" title="Send payment receipt email" onClick={() => sendReceipt(p)}>📧 Receipt</button>}
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>✏️</button>
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
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>✏️ Edit Payment</h2>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group"><label>💰 Amount (£)</label><input type="number" step="0.01" value={form.amount} onChange={set('amount')} required /></div>
                <div className="form-group">
                  <label>🔖 Status</label>
                  <select value={form.status} onChange={set('status')}>
                    <option value="pending">⏳ Pending</option>
                    <option value="received">✅ Received</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>📅 Received Date</label><input type="date" value={form.received_date} onChange={set('received_date')} /></div>
                <div className="form-group"><label>📝 Notes</label><input value={form.notes} onChange={set('notes')} placeholder="Any notes…" /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '✨ Saving…' : '💾 Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lump Sum Payments */}
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e1b4b', margin: 0 }}>💵 Lump Sum Payments</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {students
              .filter(st => {
                const hasPending = visible.some(p => p.status === 'pending' && p.studentId === st.id)
                const hasLump = lumpSums.some(l => l.student_id === st.id && (l.amount - (l.allocated_amount || 0)) > 0)
                return hasPending && hasLump
              })
              .map(st => (
                <button key={st.id} className="btn btn-primary btn-sm" onClick={() => openAllocate(st.id)}>
                  📌 Allocate — {st.name.split(' ')[0]}
                </button>
              ))
            }
          </div>
        </div>

        {/* Per-student available credit summary */}
        {(() => {
          const creditByStudent = students
            .map(st => ({
              st,
              credit: lumpSums
                .filter(l => l.student_id === st.id)
                .reduce((sum, l) => sum + Math.max(0, l.amount - (l.allocated_amount || 0)), 0)
            }))
            .filter(({ credit }) => credit > 0)
          if (!creditByStudent.length) return null
          return (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {creditByStudent.map(({ st, credit }, i) => (
                <div key={st.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.3)',
                  borderRadius: 12, padding: '0.5rem 1rem'
                }}>
                  <Avatar avatar={st.avatar} name={st.name} index={i} size={28} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{st.name.split(' ')[0]}</div>
                    <div style={{ fontWeight: 900, color: '#d97706', fontSize: '1rem' }}>{fmtCurrency(credit)} available</div>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {lumpSums.length === 0 ? <div className="empty">No lump sum payments yet</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortTh label="Student" col="student" sortKey={lumpSort.sortKey} sortDir={lumpSort.sortDir} onSort={lumpSort.toggle} />
                  <SortTh label="Date" col="payment_date" sortKey={lumpSort.sortKey} sortDir={lumpSort.sortDir} onSort={lumpSort.toggle} />
                  <SortTh label="Amount" col="amount" sortKey={lumpSort.sortKey} sortDir={lumpSort.sortDir} onSort={lumpSort.toggle} />
                  <th>Notes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {lumpPagination.paginatedData.map(p => {
                  const idx = students.findIndex(s => s.id === p.student_id)
                  const studentName = students[idx]?.name || '—'
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Avatar avatar={students.find(s => s.id === p.student_id)?.avatar} name={studentName} index={idx} />
                          <span style={{ fontWeight: 800 }}>{studentName}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{fmtDateShort(p.payment_date)}</td>
                      <td><span style={{ fontWeight: 900, color: '#0d9488', fontSize: '1rem' }}>{fmtCurrency(p.amount)}</span></td>
                      <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{p.notes || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditLump(p)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => delLump(p)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination 
              currentPage={lumpPagination.currentPage}
              totalPages={lumpPagination.totalPages}
              pageSize={lumpPagination.pageSize}
              setPageSize={lumpPagination.setPageSize}
              nextPage={lumpPagination.nextPage}
              prevPage={lumpPagination.prevPage}
              goToPage={lumpPagination.goToPage}
              totalRecords={lumpPagination.totalRecords}
            />
          </div>
        )}
      </div>

      {confirm && <ConfirmModal message={confirm.message} onConfirm={() => { confirm.onConfirm(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
      {saving && <LoadingOverlay message="Saving…" />}

      {allocateModal && (() => {
        const studentId = allocateModal
        const studentName = students.find(s => s.id === studentId)?.name || '—'
        const pendingForStudent = visible.filter(p => p.status === 'pending' && p.studentId === studentId)
        const totalAvailable = lumpSums
          .filter(l => l.student_id === studentId)
          .reduce((sum, l) => sum + Math.max(0, l.amount - (l.allocated_amount || 0)), 0)
        const selectedTotal = allocateSelected.reduce((sum, id) => {
          const p = pendingForStudent.find(p => p.id === id)
          return sum + (p?.amount || 0)
        }, 0)
        const leftover = totalAvailable - selectedTotal
        const overBudget = selectedTotal > totalAvailable
        return (
          <div className="modal-overlay" onClick={() => setAllocateModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <h2>📌 Allocate — {studentName}</h2>
              <p style={{ color: '#6b7280', fontWeight: 600, marginBottom: '1rem' }}>
                Total available credit: <strong style={{ color: '#7c3aed' }}>{fmtCurrency(totalAvailable)}</strong>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginLeft: '0.5rem' }}>(drawn oldest-first across all lump sums)</span>
              </p>

              {pendingForStudent.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontWeight: 700 }}>🎉 No pending payments!</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', maxHeight: 300, overflowY: 'auto' }}>
                    {pendingForStudent.map(p => {
                      const checked = allocateSelected.includes(p.id)
                      const wouldExceed = !checked && (selectedTotal + p.amount) > totalAvailable
                      return (
                        <label key={p.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.65rem 0.85rem', borderRadius: 12,
                          cursor: wouldExceed ? 'not-allowed' : 'pointer',
                          background: checked ? 'rgba(124,58,237,0.08)' : '#f9fafb',
                          border: `1.5px solid ${checked ? '#7c3aed' : 'rgba(124,58,237,0.1)'}`,
                          opacity: wouldExceed ? 0.4 : 1, transition: 'all 0.15s',
                        }}>
                          <input type="checkbox" checked={checked} disabled={wouldExceed}
                            onChange={() => setAllocateSelected(sel => checked ? sel.filter(id => id !== p.id) : [...sel, p.id])}
                            style={{ accentColor: '#7c3aed', width: 16, height: 16 }}
                          />
                          <div style={{ flex: 1, fontWeight: 800, fontSize: '0.9rem' }}>{fmtDateShort(p.date)}</div>
                          <div style={{ fontWeight: 900, color: '#0d9488' }}>{fmtCurrency(p.amount)}</div>
                        </label>
                      )
                    })}
                  </div>

                  <div style={{ background: overBudget ? 'rgba(239,68,68,0.08)' : 'rgba(124,58,237,0.06)', borderRadius: 12, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6b7280' }}>
                      Selected: <strong style={{ color: overBudget ? '#ef4444' : '#7c3aed' }}>{fmtCurrency(selectedTotal)}</strong>
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {overBudget
                        ? <span style={{ color: '#ef4444' }}>⚠️ Exceeds available credit</span>
                        : leftover > 0
                          ? <span style={{ color: '#6b7280' }}>Credit remaining: <strong style={{ color: '#d97706' }}>{fmtCurrency(leftover)}</strong></span>
                          : <span style={{ color: '#10b981' }}>✅ Fully allocated</span>
                      }
                    </span>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setAllocateModal(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={!allocateSelected.length || overBudget} onClick={submitAllocate}>
                  📌 Allocate {allocateSelected.length > 0 ? `(${allocateSelected.length} session${allocateSelected.length !== 1 ? 's' : ''})` : ''}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Lump Sum Modal */}
      {lumpModal && (
        <div className="modal-overlay" onClick={() => setLumpModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{lumpModal === 'add' ? '💵 Record Lump Sum' : '✏️ Edit Lump Sum'}</h2>
            <form onSubmit={saveLump}>
              {lumpModal === 'add' && (
                <div className="form-group">
                  <label>🎓 Student *</label>
                  <select value={lumpForm.student_id} onChange={e => setLumpForm(f => ({ ...f, student_id: e.target.value }))} required>
                    <option value="">Select student…</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-row">
                <div className="form-group"><label>💰 Amount (£) *</label><input type="number" step="0.01" value={lumpForm.amount} onChange={e => setLumpForm(f => ({ ...f, amount: e.target.value }))} required /></div>
                <div className="form-group"><label>📅 Date *</label><input type="date" value={lumpForm.payment_date} onChange={e => setLumpForm(f => ({ ...f, payment_date: e.target.value }))} required /></div>
              </div>
              <div className="form-group"><label>📝 Notes</label><input value={lumpForm.notes} onChange={e => setLumpForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Half-term block payment" /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setLumpModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '✨ Saving…' : '💾 Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
