import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import api from '../api/client'
import { ROLE_ACCESS } from '../utils/roles'

import ThemePicker from './ThemePicker'

export default function Nav() {
  const { logout, user, role } = useAuth()
  const [waStatus, setWaStatus] = useState('disconnected')
  const [open, setOpen] = useState(false)
  const access = ROLE_ACCESS[role] || {}

  useEffect(() => {
    if (!access.whatsapp) return
    const check = () => api.get('/whatsapp/status').then(r => setWaStatus(r.data.status)).catch(() => setWaStatus('disconnected'))
    check()
    const t = setInterval(check, 10000)
    return () => clearInterval(t)
  }, [access.whatsapp])

  const close = () => setOpen(false)

  return (
    <nav className={open ? 'open' : ''}>
      <div className="nav-top-row">
        <NavLink to="/" onClick={close} className="brand">✨ TuitionDesk</NavLink>
        <button className="nav-toggle" onClick={() => setOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>
      <div className="nav-dropdown">
        {access.parents      && <NavLink to="/parents" onClick={close}>👨‍👩‍👧 Parents</NavLink>}
        {access.students     && <NavLink to="/students" onClick={close}>🎓 Students</NavLink>}
        {access.sessions     && <NavLink to="/sessions" onClick={close}>🕐 Sessions</NavLink>}
        {access.payments     && <NavLink to="/payments" onClick={close}>💰 Payments</NavLink>}
        {access.calendar     && <NavLink to="/calendar-import" onClick={close}>📅 Calendar</NavLink>}
        {access.whatsapp     && (
          <NavLink to="/whatsapp-setup" onClick={close} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            💬 WhatsApp
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: waStatus === 'connected' ? '#10b981' : waStatus === 'qr_ready' ? '#f59e0b' : '#ef4444',
              display: 'inline-block', flexShrink: 0,
            }} />
          </NavLink>
        )}
        {access.admin        && <NavLink to="/admin" onClick={close}>🔑 Admin</NavLink>}
        {access.reports      && <NavLink to="/reports" onClick={close}>📊 Reports</NavLink>}
        <ThemePicker />
        <button className="logout" onClick={() => { logout(); close() }}>👤 {user?.full_name || user?.username} · Logout</button>
      </div>
    </nav>
  )
}
