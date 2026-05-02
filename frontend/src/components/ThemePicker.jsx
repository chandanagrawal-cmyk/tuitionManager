import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { THEMES } from '../utils/themes'

export default function ThemePicker() {
  const { themeKey, setThemeKey } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '1.2rem', padding: '0.3rem', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        title="Change theme"
        onMouseEnter={e => e.currentTarget.style.transform = 'rotate(30deg)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'rotate(0deg)'}
      >🎨</button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%',
          background: 'var(--glass)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 16, padding: '0.75rem',
          boxShadow: 'var(--shadow)',
          display: 'flex', flexDirection: 'column', gap: '0.4rem',
          minWidth: 180, zIndex: 200,
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem', paddingLeft: '0.25rem' }}>Choose Theme</div>
          {Object.entries(THEMES).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => { setThemeKey(key); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.5rem 0.75rem', borderRadius: 10, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                fontSize: '0.875rem', textAlign: 'left', transition: 'all 0.15s',
                background: themeKey === key ? 'linear-gradient(135deg, var(--purple), var(--pink))' : 'transparent',
                color: themeKey === key ? 'white' : 'var(--body-text, #1e1b4b)',
              }}
              onMouseEnter={e => { if (themeKey !== key) e.currentTarget.style.background = 'rgba(124,58,237,0.08)' }}
              onMouseLeave={e => { if (themeKey !== key) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '1.1rem' }}>{theme.emoji}</span>
              {theme.name}
              {themeKey === key && <span style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
