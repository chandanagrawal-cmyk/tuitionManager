import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { fmtDateShort, fmtDateWithDay, fmtTime } from '../utils/dates'
import { Avatar } from '../components/Avatar'

function StatCard({ emoji, label, value, color }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ fontSize: '2rem' }}>{emoji}</div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{value}</div>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      </div>
    </div>
  )
}

export default function StudentLedger() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [sessions, setSessions] = useState([])
  const [payments, setPayments] = useState([])
  const [lumpSums, setLumpSums] = useState([])
  const [lumpModal, setLumpModal] = useState(null)
  const [lumpForm, setLumpForm] = useState({ amount: '', payment_date: new Date().toISOString().slice(0,10), notes: '' })
  const [saving, setSaving] = useState(false)
  const [allStudents, setAllStudents] = useState([])

  const load = () => Promise.all([
    api.get(`/students`),
    api.get(`/sessions?student_id=${id}`),
    api.get(`/payments`),
    api.get(`/lump-sum-payments`),
  ]).then(([sts, sess, pays, lumps]) => {
    const st = sts.data.find(s => s.id === Number(id))
    if (!st) { navigate('/students'); return }
    setAllStudents(sts.data)
    setStudent(st)
    setSessions(sess.data)
    setPayments(pays.data.filter(p => {
      const s = sess.data.find(s => s.id === p.session_id)
      return s?.student_id === Number(id)
    }))
    setLumpSums(lumps.data.filter(l => l.student_id === Number(id)))
  })

  useEffect(() => { load() }, [id])

  const markReceived = async p => {
    await api.put(`/payments/${p.id}`, { status: 'received', received_date: new Date().toISOString().slice(0,10) })
    toast.success('💰 Payment received!')
    load()
  }

  const saveLump = async e => {
    e.preventDefault(); setSaving(true)
    try {
      if (lumpModal === 'add') {
        await api.post('/lump-sum-payments', { student_id: Number(id), amount: Number(lumpForm.amount), payment_date: lumpForm.payment_date, notes: lumpForm.notes || null })
        toast.success('💰 Lump sum recorded!')
      } else {
        await api.put(`/lump-sum-payments/${lumpModal.id}`, { amount: Number(lumpForm.amount), payment_date: lumpForm.payment_date, notes: lumpForm.notes || null })
        toast.success('✅ Updated!')
      }
      setLumpModal(null); load()
    } catch { toast.error('Something went wrong 😬') }
    finally { setSaving(false) }
  }

  const delLump = async p => {
    if (!confirm('Delete this lump sum?')) return
    await api.delete(`/lump-sum-payments/${p.id}`); toast.success('🗑️ Deleted'); load()
  }

  const openAddLump = () => { setLumpForm({ amount: '', payment_date: new Date().toISOString().slice(0,10), notes: '' }); setLumpModal('add') }
  const openEditLump = p => { setLumpForm({ amount: p.amount, payment_date: p.payment_date, notes: p.notes || '' }); setLumpModal(p) }

  // Build a unified timeline sorted by date
  const timeline = useMemo(() => {
    const rows = []
    sessions.forEach(s => {
      const pay = payments.find(p => p.session_id === s.id)
      rows.push({
        date: s.date,
        type: 'session',
        label: `Session — ${fmtDateWithDay(s.date)} at ${fmtTime(s.time)}`,
        billed: s.status === 'cancelled' ? 0 : (pay?.amount ?? (s.status === 'completed' ? student?.fee_per_session ?? 0 : 0)),
        received: pay?.status === 'received' ? pay.amount : 0,
        status: s.status,
        payStatus: pay?.status,
        pay,
        session: s,
      })
    })
    lumpSums.forEach(l => {
      rows.push({
        date: l.payment_date,
        type: 'lump',
        label: l.notes || 'Lump sum payment',
        billed: 0,
        received: l.amount,
        lump: l,
      })
    })
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [sessions, payments, lumpSums, student])

  const totalBilled = timeline.reduce((s, r) => s + r.billed, 0)
  const totalReceived = timeline.reduce((s, r) => s + r.received, 0)
  const outstanding = totalBilled - totalReceived

  const studentIdx = allStudents.findIndex(s => s.id === Number(id))

  if (!student) return null

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/students')}>← Back</button>
          <Avatar avatar={student.avatar} name={student.name} index={studentIdx} size={40} />
          <div>
            <h1 style={{ margin: 0 }}>{student.name}</h1>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 700 }}>{student.subject || 'No subject'} · £{student.fee_per_session.toFixed(2)}/session</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAddLump}>+ Lump Sum</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard emoji="📋" label="Total Billed" value={`£${totalBilled.toFixed(2)}`} color="#7c3aed" />
        <StatCard emoji="✅" label="Total Received" value={`£${totalReceived.toFixed(2)}`} color="#10b981" />
        <StatCard emoji={outstanding > 0 ? '⏳' : '🎉'} label="Outstanding" value={`£${outstanding.toFixed(2)}`} color={outstanding > 0 ? '#f59e0b' : '#10b981'} />
      </div>

      {/* Timeline */}
      <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1e1b4b', marginBottom: '0.75rem' }}>📒 Payment Ledger</div>
      {timeline.length === 0 ? <div className="empty">No sessions or payments yet</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Billed</th>
                <th>Received</th>
                <th>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let running = 0
                return timeline.map((row, i) => {
                  running += row.received - row.billed
                  const isLump = row.type === 'lump'
                  return (
                    <tr key={i} style={{ opacity: row.status === 'cancelled' ? 0.45 : 1 }}>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDateShort(row.date)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{isLump ? '💵' : row.status === 'completed' ? '✅' : row.status === 'cancelled' ? '❌' : '📅'}</span>
                          <span style={{ fontWeight: 600 }}>{row.label}</span>
                          {!isLump && row.payStatus === 'pending' && <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>⏳ unpaid</span>}
                          {!isLump && row.payStatus === 'received' && <span className="badge badge-completed" style={{ fontSize: '0.65rem' }}>✅ paid</span>}
                          {isLump && <span style={{ background: 'rgba(13,148,136,0.1)', color: '#0d9488', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.65rem', fontWeight: 800 }}>lump sum</span>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: '#ef4444' }}>{row.billed > 0 ? `£${row.billed.toFixed(2)}` : '—'}</td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>{row.received > 0 ? `£${row.received.toFixed(2)}` : '—'}</td>
                      <td>
                        <span style={{ fontWeight: 900, color: running < 0 ? '#f59e0b' : '#10b981' }}>
                          {running < 0 ? `-£${Math.abs(running).toFixed(2)}` : running === 0 ? '£0.00' : `+£${running.toFixed(2)}`}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          {!isLump && row.payStatus === 'pending' && row.status === 'completed' && (
                            <button className="btn btn-success btn-sm" onClick={() => markReceived(row.pay)}>💰 Paid</button>
                          )}
                          {isLump && <>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEditLump(row.lump)}>✏️</button>
                            <button className="btn btn-danger btn-sm" onClick={() => delLump(row.lump)}>🗑️</button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Lump sum modal */}
      {lumpModal && (
        <div className="modal-overlay" onClick={() => setLumpModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{lumpModal === 'add' ? '💵 Record Lump Sum' : '✏️ Edit Lump Sum'}</h2>
            <form onSubmit={saveLump}>
              <div className="form-row">
                <div className="form-group"><label>💰 Amount (£) *</label><input type="number" step="0.01" min="0.01" value={lumpForm.amount} onChange={e => setLumpForm(f => ({ ...f, amount: e.target.value }))} required /></div>
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
