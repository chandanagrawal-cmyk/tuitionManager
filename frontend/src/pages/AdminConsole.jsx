import { useEffect, useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import ConfirmModal from '../components/ConfirmModal'
import useKeyboard from '../hooks/useKeyboard'

const ROLES = ['admin', 'teacher', 'ledger_keeper', 'receptionist']
const ROLE_LABELS = {
  admin: { label: '🔑 Admin', color: '#7c3aed', desc: 'Full access + user management' },
  teacher: { label: '🎓 Teacher', color: '#3b82f6', desc: 'Students, sessions, calendar, WhatsApp' },
  ledger_keeper: { label: '📒 Ledger Keeper', color: '#0d9488', desc: 'Payments & ledger only' },
  receptionist: { label: '📋 Receptionist', color: '#f59e0b', desc: 'Students & parents, view sessions' },
}

const initials = name => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?'
const COLORS = ['#7c3aed','#ec4899','#0d9488','#f59e0b','#3b82f6','#10b981','#f97316','#8b5cf6']

const emptyForm = { username: '', password: '', email: '', full_name: '', role: 'teacher' }

export default function AdminConsole() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [students, setStudents] = useState([])
  const [dangerStudent, setDangerStudent] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | user object
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)

  useKeyboard({ Escape: () => setModal(null), n: () => { setForm(emptyForm); setModal('add') } })

  const load = () => Promise.all([api.get('/auth/users'), api.get('/students')]).then(([u, s]) => {
    setUsers(u.data)
    setStudents(s.data.slice().sort((a, b) => a.name.localeCompare(b.name)))
  })
  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(emptyForm); setModal('add') }
  const openEdit = u => { setForm({ username: u.username, password: '', email: u.email || '', full_name: u.full_name || '', role: u.role }); setModal(u) }

  const save = async e => {
    e.preventDefault(); setSaving(true)
    try {
      if (modal === 'add') {
        await api.post('/auth/users', form)
        toast.success('👤 User created!')
      } else {
        const payload = { role: form.role, full_name: form.full_name || null, email: form.email || null, is_active: modal.is_active }
        if (form.password) payload.password = form.password
        await api.put(`/auth/users/${modal.id}`, payload)
        toast.success('✅ User updated!')
      }
      setModal(null); load()
    } catch (err) { toast.error(err.response?.data?.detail || 'Something went wrong 😬') }
    finally { setSaving(false) }
  }

  const toggleActive = async u => {
    if (u.id === me.id) return toast.error("Can't deactivate your own account")
    await api.put(`/auth/users/${u.id}`, { is_active: !u.is_active })
    toast.success(u.is_active ? '🔒 User deactivated' : '✅ User activated')
    load()
  }

  const del = u => {
    if (u.id === me.id) return toast.error("Can't delete your own account")
    setConfirm({ message: `Delete user "${u.username}"? This cannot be undone.`, onConfirm: async () => { await api.delete(`/auth/users/${u.id}`); toast.success('🗑️ User deleted'); load() } })
  }

  const sendSummary = async u => {
    if (!u.email) return toast.error("User has no email address")
    const loading = toast.loading(`Sending schedule to ${u.username}…`)
    try {
      await api.post(`/auth/users/${u.id}/send-summary`)
      toast.success(`📨 Schedule sent to ${u.email}`, { id: loading })
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send email", { id: loading })
    }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="page">
      <div className="page-header">
        <h1>🔑 Admin Console</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add User</button>
      </div>

      {/* Role legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {ROLES.map(r => {
          const { label, color, desc } = ROLE_LABELS[r]
          return (
            <div key={r} className="card" style={{ padding: '0.85rem 1rem', borderLeft: `4px solid ${color}` }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color }}>{label}</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem', fontWeight: 600 }}>{desc}</div>
            </div>
          )
        })}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>User</th><th>Role</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const { label, color } = ROLE_LABELS[u.role] || {}
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div className="avatar" style={{ background: COLORS[i % COLORS.length] }}>{initials(u.username)}</div>
                      <div>
                        <div style={{ fontWeight: 800 }}>{u.full_name || u.username}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>@{u.username}{u.id === me.id ? ' · You' : ''}</div>
                        {u.email && <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 600 }}>{u.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ background: `${color}18`, color, borderRadius: 999, padding: '0.2rem 0.75rem', fontSize: '0.8rem', fontWeight: 800 }}>{label}</span>
                  </td>
                  <td>
                    {u.is_active
                      ? <span className="badge badge-completed">✅ Active</span>
                      : <span className="badge badge-cancelled">🔒 Inactive</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)} title="Edit User">✏️ Edit</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => sendSummary(u)} title="Send Daily Schedule" disabled={!u.email}>📨</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(u)} title={u.is_active ? 'Deactivate' : 'Activate'}>{u.is_active ? '🔒' : '✅'}</button>
                      {u.id !== me.id && <button className="btn btn-danger btn-sm" onClick={() => del(u)} title="Delete User">🗑️</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {confirm && <ConfirmModal message={confirm.message} onConfirm={() => { confirm.onConfirm(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}

      {/* Danger Zone */}
      <div style={{ marginTop: '2.5rem', border: '2px solid rgba(239,68,68,0.3)', borderRadius: 18, padding: '1.5rem' }}>
        <div style={{ fontWeight: 900, fontSize: '1rem', color: '#ef4444', marginBottom: '0.4rem' }}>⚠️ Danger Zone</div>
        <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontWeight: 600, marginBottom: '1.25rem' }}>These actions are irreversible. Use only during initial setup or testing.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#374151', marginBottom: '0.4rem' }}>🗑️ Delete All Sessions for a Student</div>
            <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, marginBottom: '0.75rem' }}>Removes all sessions, recurring series and associated payments for the selected student</div>
            <select
              value={dangerStudent}
              onChange={e => setDangerStudent(e.target.value)}
              style={{ padding: '0.5rem 1rem', borderRadius: 10, border: '2px solid rgba(239,68,68,0.3)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', outline: 'none', background: 'white', minWidth: 220 }}
            >
              <option value="">Select a student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button
            className="btn btn-danger"
            disabled={!dangerStudent}
            onClick={() => {
              const st = students.find(s => s.id === Number(dangerStudent))
              setConfirm({
                message: `Delete ALL sessions for ${st?.name}? This removes every session, series and payment for this student. This cannot be undone.`,
                onConfirm: async () => {
                  const r = await api.delete(`/sessions/all?student_id=${dangerStudent}`)
                  toast.success(`🗑️ Deleted ${r.data.deleted} sessions for ${st?.name}`)
                  setDangerStudent('')
                }
              })
            }}
          >Delete Sessions</button>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'add' ? '👤 Add User' : `✏️ Edit ${modal.username}`}</h2>
            <form onSubmit={save}>
              {modal === 'add' && (
                <div className="form-group">
                  <label>👤 Username *</label>
                  <input value={form.username} onChange={set('username')} placeholder="e.g. jsmith" required />
                </div>
              )}
              <div className="form-group">
                <label>🙋 Full Name</label>
                <input value={form.full_name} onChange={set('full_name')} placeholder="e.g. John Smith" />
              </div>
              <div className="form-group">
                <label>📧 Email Address</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="e.g. john@example.com" />
              </div>
              <div className="form-group">
                <label>🔒 Password {modal !== 'add' && <span style={{ fontWeight: 500, opacity: 0.6 }}>(leave blank to keep current)</span>}</label>
                <input type="password" value={form.password} onChange={set('password')} placeholder={modal === 'add' ? 'Set a password' : 'New password…'} required={modal === 'add'} />
              </div>
              <div className="form-group">
                <label>🏷️ Role *</label>
                <select value={form.role} onChange={set('role')}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r].label} — {ROLE_LABELS[r].desc}</option>)}
                </select>
              </div>
              <div style={{ background: `${ROLE_LABELS[form.role]?.color}12`, borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.82rem', color: ROLE_LABELS[form.role]?.color, fontWeight: 700, marginBottom: '0.5rem' }}>
                {ROLE_LABELS[form.role]?.label}: {ROLE_LABELS[form.role]?.desc}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '✨ Saving…' : '💾 Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
