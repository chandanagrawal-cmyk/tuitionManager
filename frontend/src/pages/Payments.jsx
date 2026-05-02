import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'
import { fmtDateShort } from '../utils/dates'
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

  useKeyboard({ Escape: () => { setModal(null); setLumpModal(null) }, n: () => openAddLump() })

  const { sortKey, sortDir, toggle, search, setSearch } = useSort([], 'date', 'desc')

  const sessionInfo = id => {
    const s = sessions.find(s => s.id === id)
    if (!s) return { date: '—', studentName: '—', studentIdx: 0, studentAvatar: null }
    const idx = students.findIndex(st => st.id === s.student_id)
    return { date: s.date, studentName: students[idx]?.name || '—', studentIdx: idx, studentAvatar: students[idx]?.avatar || null }
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

  const markReceived = async p => {
    await api.put(`/payments/${p.id}`, { status: 'received', received_date: new Date().toISOString().slice(0, 10) })
    toast.success('💰 Payment received — cha-ching! 🎉')
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#7c3aed','#ec4899','#10b981','#f59e0b'] })
    load()
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
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b' }}>£{totalPending.toFixed(2)}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>✅</div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>£{totalReceived.toFixed(2)}</div>
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
                    <td><span style={{ fontWeight: 900, color: '#0d9488', fontSize: '1rem' }}>£{p.amount.toFixed(2)}</span></td>
                    <td><span className={`badge badge-${p.status}`}>{p.status === 'pending' ? '⏳ pending' : '✅ received'}</span></td>
                    <td style={{ color: '#9ca3af', fontWeight: 700 }}>{p.received_date || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {p.status === 'pending' && <button className="btn btn-success btn-sm" onClick={() => markReceived(p)}>💰 Received</button>}
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
        <h2 style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e1b4b', marginBottom: '1rem' }}>💵 Lump Sum Payments</h2>
        {lumpSums.length === 0 ? <div className="empty">No lump sum payments yet</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Student</th><th>Date</th><th>Amount</th><th>Notes</th><th></th></tr>
              </thead>
              <tbody>
                {lumpSums.map(p => {
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
                      <td><span style={{ fontWeight: 900, color: '#0d9488', fontSize: '1rem' }}>£{p.amount.toFixed(2)}</span></td>
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
          </div>
        )}
      </div>

      {confirm && <ConfirmModal message={confirm.message} onConfirm={() => { confirm.onConfirm(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
      {saving && <LoadingOverlay message="Saving…" />}

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
