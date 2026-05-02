import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import ChatPanel from '../components/ChatPanel'
import { Avatar, AvatarPicker, PARENT_AVATARS } from '../components/Avatar'
import { useSort, SortTh, SearchBar } from '../hooks/useSort'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'
import ConfirmModal from '../components/ConfirmModal'
import EmptyState from '../components/EmptyState'
import { SkeletonRow } from '../components/Skeleton'
import useKeyboard from '../hooks/useKeyboard'
import LoadingOverlay from '../components/LoadingOverlay'

const empty = { name: '', phone: '', email: '', notes: '', receive_calendar_invites: false, avatar: '' }

export default function Parents() {
  const [parents, setParents] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [chatContacts, setChatContacts] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [loading, setLoading] = useState(true)

  useKeyboard({ Escape: () => setModal(null), n: () => { setForm(empty); setModal('add') } })

  const { sortKey, sortDir, toggle, search, setSearch } = useSort([], 'name', 'asc')

  const load = () => api.get('/parents').then(r => { setParents(r.data.slice().sort((a,b) => a.name.localeCompare(b.name))); setLoading(false) })
  useEffect(() => { load() }, [])

  const visible = useMemo(() => {
    let rows = [...parents]
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(p => p.name?.toLowerCase().includes(q) || p.phone?.includes(q) || p.email?.toLowerCase().includes(q))
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const av = a[sortKey] || ''
        const bv = b[sortKey] || ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [parents, search, sortKey, sortDir])

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

  const openAdd = () => { setForm(empty); setModal('add') }
  const openEdit = p => { setForm({ name: p.name, phone: p.phone || '', email: p.email || '', notes: p.notes || '', receive_calendar_invites: p.receive_calendar_invites || false, avatar: p.avatar || '' }); setModal(p) }

  const save = async e => {
    e.preventDefault(); setSaving(true)
    try {
      if (modal === 'add') { await api.post('/parents', form); toast.success('👨‍👩‍👧 Parent added!') }
      else { await api.put(`/parents/${modal.id}`, form); toast.success('✅ Parent updated!') }
      setModal(null); load()
    } catch { toast.error('Something went wrong 😬') }
    finally { setSaving(false) }
  }

  const del = p => setConfirm({ message: `Remove ${p.name}? This will also remove their students and sessions.`, onConfirm: async () => { await api.delete(`/parents/${p.id}`); toast.success('🗑️ Removed'); load() } })

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="page">
      <div className="page-header">
        <h1>👨‍👩‍👧 Parents</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Parent</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search parents…" />
      </div>

      {loading ? (
        <div className="table-wrap"><table><tbody><SkeletonRow cols={6} /><SkeletonRow cols={6} /><SkeletonRow cols={6} /></tbody></table></div>
      ) : visible.length === 0 ? (
        <EmptyState icon="👨👩👧" title="No parents yet" subtitle="Add your first family to get started!" action="+ Add Parent" onAction={openAdd} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh label="Name" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Phone" col="phone" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Email" col="email" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th>Calendar Invites</th><th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Avatar avatar={p.avatar} name={p.name} index={i} />
                      <span style={{ fontWeight: 800 }}>{p.name}</span>
                    </div>
                  </td>
                  <td>{p.phone || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td>{p.email || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td>{p.receive_calendar_invites
                    ? <span className="badge badge-scheduled">📅 Yes{!p.email && ' ⚠️'}</span>
                    : <span style={{ color: '#d1d5db', fontWeight: 600 }}>No</span>}
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setChatContacts([{ name: p.name, number: p.phone || null, label: 'Parent' }])}>💬</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>✏️ Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(p)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'add' ? '👨‍👩‍👧 Add Parent' : '✏️ Edit Parent'}</h2>
            <form onSubmit={save}>
              <div className="form-group">
                <label>🖼️ Avatar</label>
                <AvatarPicker value={form.avatar} onChange={v => setForm(f => ({ ...f, avatar: v }))} avatars={PARENT_AVATARS} />
              </div>
              <div className="form-group"><label>Full Name *</label><input value={form.name} onChange={set('name')} placeholder="e.g. Sarah Johnson" required /></div>
              <div className="form-row">
                <div className="form-group"><label>📞 Phone</label><input value={form.phone} onChange={set('phone')} placeholder="07700 000000" /></div>
                <div className="form-group"><label>📧 Email</label><input type="email" value={form.email} onChange={set('email')} placeholder="sarah@email.com" /></div>
              </div>
              <div className="form-group"><label>📝 Notes</label><textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Any useful notes…" /></div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'none', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={form.receive_calendar_invites} onChange={e => setForm(f => ({ ...f, receive_calendar_invites: e.target.checked }))} style={{ width: 'auto', accentColor: '#7c3aed' }} />
                  📅 Send Google Calendar invites to this parent
                </label>
                {form.receive_calendar_invites && !form.email && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>⚠️ Please add an email address to send invites</div>
                )}
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
