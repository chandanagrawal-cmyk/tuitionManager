const COLORS = ['#7c3aed','#ec4899','#0d9488','#f59e0b','#3b82f6','#10b981','#f97316','#8b5cf6']

export const STUDENT_AVATARS = [
  '🧒','👦','👧','🧑','👨','👩','🧔','👱','👴','👵',
  '🧑‍🎓','👨‍🎓','👩‍🎓','🧑‍💻','👨‍💻','👩‍💻','🧑‍🎨','👨‍🎨','👩‍🎨','🧑‍🔬',
  '🦸','🦹','🧙','🧝','🐱','🐶','🦊','🐼','🐨','🦁',
  '🐸','🐯','🦄','🐙','🦋','🌟','⭐','🎯','🚀','🎸',
]

export const PARENT_AVATARS = [
  '👨','👩','🧔','👱','👴','👵','🧑','👨‍👩‍👧','👨‍👩‍👦','👪',
  '🧑‍💼','👨‍💼','👩‍💼','🧑‍🏫','👨‍🏫','👩‍🏫','🧑‍⚕️','👨‍⚕️','👩‍⚕️','🧑‍🍳',
  '🦸','🧙','🌟','⭐','🎯','🏆','💎','🌈','🌺','🌸',
]

export function Avatar({ avatar, name, index = 0, size = 34 }) {
  const color = COLORS[index % COLORS.length]
  const initials = name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatar ? 'rgba(124,58,237,0.1)' : color,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: avatar ? size * 0.55 : size * 0.35,
      fontWeight: 900, color: 'white', flexShrink: 0,
      border: avatar ? '2px solid rgba(124,58,237,0.2)' : 'none',
    }}>
      {avatar || initials}
    </div>
  )
}

export function AvatarPicker({ value, onChange, avatars }) {
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
        gap: '0.4rem', maxHeight: 180, overflowY: 'auto',
        padding: '0.5rem', background: 'rgba(124,58,237,0.04)',
        borderRadius: 12, border: '2px solid rgba(124,58,237,0.1)',
      }}>
        {/* No avatar option */}
        <div
          onClick={() => onChange('')}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800,
            background: !value ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'rgba(124,58,237,0.08)',
            color: !value ? 'white' : '#9ca3af',
            border: !value ? '2px solid #7c3aed' : '2px solid transparent',
          }}
          title="Use initials"
        >A B</div>
        {avatars.map(emoji => (
          <div
            key={emoji}
            onClick={() => onChange(emoji)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem', cursor: 'pointer',
              background: value === emoji ? 'rgba(124,58,237,0.15)' : 'transparent',
              border: value === emoji ? '2px solid #7c3aed' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >{emoji}</div>
        ))}
      </div>
      {value && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#7c3aed', fontWeight: 700 }}>
          Selected: {value} — <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onChange('')}>clear</span>
        </div>
      )}
    </div>
  )
}
