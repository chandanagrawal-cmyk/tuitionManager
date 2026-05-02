import { useState, useMemo } from 'react'

export function useSort(data, defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState(defaultDir)
  const [search, setSearch] = useState('')

  const toggle = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = sortKey.split('.').reduce((o, k) => o?.[k] ?? '', a)
      const bv = sortKey.split('.').reduce((o, k) => o?.[k] ?? '', b)
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, toggle, search, setSearch }
}

export function SortTh({ label, col, sortKey, sortDir, onSort, style }) {
  const active = sortKey === col
  return (
    <th onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        {label}
        <span style={{ fontSize: '0.65rem', opacity: active ? 1 : 0.25, color: active ? '#7c3aed' : 'inherit', transition: 'opacity 0.15s' }}>
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  )
}

export function SearchBar({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '0.85rem' }}>🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '0.5rem 0.75rem 0.5rem 2.1rem',
          border: '2px solid rgba(124,58,237,0.15)', borderRadius: 999,
          fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 600,
          outline: 'none', background: 'rgba(255,255,255,0.85)', minWidth: 220,
        }}
        onFocus={e => e.target.style.borderColor = '#7c3aed'}
        onBlur={e => e.target.style.borderColor = 'rgba(124,58,237,0.15)'}
      />
    </div>
  )
}
