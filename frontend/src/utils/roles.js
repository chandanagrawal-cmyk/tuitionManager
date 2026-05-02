export const ROLE_ACCESS = {
  admin:        { dashboard: true, students: true, parents: true, sessions: true, payments: true, calendar: true, whatsapp: true, admin: true,  reports: true },
  teacher:      { dashboard: true, students: true, parents: true, sessions: true, payments: false, calendar: true, whatsapp: true, admin: false, reports: true },
  ledger_keeper:{ dashboard: true, students: true, parents: false, sessions: true, payments: true, calendar: false, whatsapp: false, admin: false, reports: true },
  receptionist: { dashboard: true, students: true, parents: true, sessions: true, payments: false, calendar: false, whatsapp: false, admin: false, reports: false },
}
