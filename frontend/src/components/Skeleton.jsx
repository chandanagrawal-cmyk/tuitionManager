export function SkeletonRow({ cols = 4 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><div className="skeleton" style={{ height: 18, borderRadius: 8, width: `${60 + (i * 13) % 30}%` }} /></td>
      ))}
    </tr>
  )
}

export function SkeletonCard() {
  return (
    <div className="stat-card">
      <div className="skeleton" style={{ height: 28, width: 40, borderRadius: 8, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 36, width: 70, borderRadius: 8, marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 14, width: 90, borderRadius: 6 }} />
    </div>
  )
}
