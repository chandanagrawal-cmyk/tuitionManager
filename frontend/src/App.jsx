import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Nav from './components/Nav'
import Chatbot from './components/Chatbot'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Parents from './pages/Parents'
import Students from './pages/Students'
import Sessions from './pages/Sessions'
import Payments from './pages/Payments'
import StudentLedger from './pages/StudentLedger'
import CalendarImport from './pages/CalendarImport'
import WhatsAppSetup from './pages/WhatsAppSetup'
import Reports from './pages/Reports'
import AdminConsole from './pages/AdminConsole'
import { ROLE_ACCESS } from './utils/roles'

function Protected({ children, permission }) {
  const { user, loading, role } = useAuth()
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (permission && !ROLE_ACCESS[role]?.[permission]) {
    return (
      <div className="page">
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#1e1b4b', marginBottom: '0.5rem' }}>Access Denied</div>
          <div style={{ color: '#9ca3af', fontWeight: 600 }}>Your role doesn't have permission to view this page.</div>
        </div>
      </div>
    )
  }
  return children
}

export default function App() {
  const { user } = useAuth()
  return (
    <>
      <div className="blob-container">
        <div className="blob"></div>
        <div className="blob"></div>
      </div>
      {user && <Nav />}
      {user && <Chatbot />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected permission="dashboard"><Dashboard /></Protected>} />
        <Route path="/parents" element={<Protected permission="parents"><Parents /></Protected>} />
        <Route path="/students" element={<Protected permission="students"><Students /></Protected>} />
        <Route path="/sessions" element={<Protected permission="sessions"><Sessions /></Protected>} />
        <Route path="/payments" element={<Protected permission="payments"><Payments /></Protected>} />
        <Route path="/students/:id/ledger" element={<Protected permission="payments"><StudentLedger /></Protected>} />
        <Route path="/calendar-import" element={<Protected permission="calendar"><CalendarImport /></Protected>} />
        <Route path="/whatsapp-setup" element={<Protected permission="whatsapp"><WhatsAppSetup /></Protected>} />
        <Route path="/admin" element={<Protected permission="admin"><AdminConsole /></Protected>} />
        <Route path="/reports" element={<Protected permission="reports"><Reports /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
