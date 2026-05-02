export const fmtDateShort = dateStr => {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric'
  })
}

export const fmtDateWithDay = dateStr => {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })
}

export const fmtTime = timeStr => {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: true })
}
