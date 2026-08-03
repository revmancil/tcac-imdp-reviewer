// Alpha Phi Alpha brand components — shield mark + icon set + small UI atoms.
// Ported 1:1 from the design handoff's brand.jsx (React 18, TSX).
import React from 'react'
import type { StatusDef, DocState } from '../../shared/types'

const GOLD = '#C99A3B'
const DARK = '#0E0E0E'

export function ShieldMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/static/tcac-seal.png"
      alt="Texas Council of Alpha Chapters seal"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

const ICON_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', ...ICON_PROPS }
  switch (name) {
    case 'check': return <svg {...props}><path d="M4 12 L10 18 L20 6" /></svg>
    case 'x': return <svg {...props}><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
    case 'warn': return <svg {...props}><path d="M12 3 L22 20 H2 Z M12 10 V14 M12 17 V17.5" /></svg>
    case 'file': return <svg {...props}><path d="M6 3 H14 L18 7 V21 H6 Z M14 3 V7 H18" /></svg>
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="M20 20 L16 16" /></svg>
    case 'filter': return <svg {...props}><path d="M3 5 H21 M6 12 H18 M10 19 H14" /></svg>
    case 'download': return <svg {...props}><path d="M12 4 V16 M6 12 L12 18 L18 12 M4 20 H20" /></svg>
    case 'mail': return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 6 L12 13 L21 6" /></svg>
    case 'chevron-right': return <svg {...props}><path d="M9 6 L15 12 L9 18" /></svg>
    case 'chevron-left': return <svg {...props}><path d="M15 6 L9 12 L15 18" /></svg>
    case 'chevron-down': return <svg {...props}><path d="M6 9 L12 15 L18 9" /></svg>
    case 'flag': return <svg {...props}><path d="M5 3 V21 M5 4 H17 L14 8 L17 12 H5" /></svg>
    case 'inbox': return <svg {...props}><path d="M3 12 H8 L10 15 H14 L16 12 H21 M3 12 L5 5 H19 L21 12 V19 H3 Z" /></svg>
    case 'user': return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" /></svg>
    case 'send': return <svg {...props}><path d="M4 4 L20 12 L4 20 L7 12 Z M7 12 H14" /></svg>
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7 V12 L15 14" /></svg>
    default: return null
  }
}

const TONES: Record<string, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: '#F5EBD6', fg: '#5C4A22', bd: '#D9C79A' },
  info: { bg: '#EDE3CE', fg: '#3B3222', bd: '#C99A3B' },
  warn: { bg: '#F5E4C2', fg: '#7A4A0F', bd: '#B37516' },
  ok: { bg: '#E5EBDD', fg: '#3A4A25', bd: '#8AA365' },
  gold: { bg: '#0E0E0E', fg: '#EBC66A', bd: '#C99A3B' },
}

export function StatusPill({ status }: { status: StatusDef }) {
  const t = TONES[status.tone] || TONES.neutral
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
        fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, borderRadius: 2, whiteSpace: 'nowrap',
        fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
      }}
    >
      {status.label}
    </span>
  )
}

export function DocStateDot({ doc }: { doc: DocState }) {
  let color: string, symbol: string
  if (!doc.present) { color = '#A54428'; symbol = '×' }
  else if (!doc.valid) { color = '#C99A3B'; symbol = '!' }
  else { color = '#5C7A3A'; symbol = '✓' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 2, background: color, color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'system-ui' }}>
      {symbol}
    </span>
  )
}

export function CompletenessBar({ valid, total }: { valid: number; total: number }) {
  const pct = Math.round((valid / total) * 100)
  let color = '#C99A3B'
  if (pct === 100) color = '#5C7A3A'
  else if (pct < 70) color = '#A54428'
  else if (pct < 100) color = '#B37516'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 4, background: '#D9C79A', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "'Cormorant Garamond', serif", color: '#5C4A22', fontWeight: 600, minWidth: 34, textAlign: 'right' }}>
        {valid}/{total}
      </span>
    </div>
  )
}

export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 2, background: '#0E0E0E', color: '#C99A3B',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: size * 0.42, letterSpacing: '0.04em',
        border: '1.5px solid #C99A3B', boxShadow: 'inset 0 0 0 2px #0E0E0E, inset 0 0 0 3px #C99A3B', flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
