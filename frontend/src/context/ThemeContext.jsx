import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'
import { THEMES } from '../utils/themes'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKeyState] = useState(() => localStorage.getItem('theme') || 'violet')

  const applyTheme = (key) => {
    const theme = THEMES[key] || THEMES.violet
    const root = document.documentElement
    Object.entries(theme).forEach(([k, v]) => {
      if (k.startsWith('--')) root.style.setProperty(k, v)
    })
    root.style.setProperty('--purple', theme['--primary'])
    root.style.setProperty('--purple-light', theme['--primary-light'])
    root.style.setProperty('--pink', theme['--secondary'])
    root.style.setProperty('--body-text', theme['--text'])
    document.body.style.color = theme['--text']
    document.body.style.background = theme['--bg']
    localStorage.setItem('theme', key)
  }

  useEffect(() => { applyTheme(themeKey) }, [themeKey])

  const setThemeKey = async (key) => {
    setThemeKeyState(key)
    try { await api.patch(`/auth/me/theme?theme=${key}`) } catch {}
  }

  // Listen for theme from AuthContext instead of making our own API call
  useEffect(() => {
    const handler = e => {
      setThemeKeyState(e.detail)
      applyTheme(e.detail)
    }
    window.addEventListener('theme-loaded', handler)
    return () => window.removeEventListener('theme-loaded', handler)
  }, [])

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
