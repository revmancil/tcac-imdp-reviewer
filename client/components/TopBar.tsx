import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, ShieldMark } from './Brand'
import { useApp } from '../context'

export function TopBar() {
  const { officer, signOut } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!officer) return null

  const scopeText = officer.scope === 'all' ? 'District-wide access' : `Area ${officer.area} only`

  return (
    <div className="topbar">
      <div className="topbar-brand">
        <ShieldMark size={26} />
        <div>
          <div className="topbar-app">TCAC Intake</div>
          <div className="topbar-sub">Cycle 2026 · Southwestern Region</div>
        </div>
      </div>
      <div className="user-chip-wrap" ref={ref}>
        <button className="user-chip-btn" onClick={() => setOpen((o) => !o)}>
          <Avatar initials={officer.initials} size={30} />
          <div className="user-chip-text">
            <div className="user-chip-name">{officer.name.replace('Bro. ', '')}</div>
            <div className="user-chip-role">
              {officer.title}
              {officer.area ? ` · Area ${officer.area}` : ''}
            </div>
          </div>
          <div className="user-chip-arrow">
            <Icon name="chevron-down" size={14} />
          </div>
        </button>

        {open && (
          <div className="user-menu">
            <div className="user-menu-head">
              <Avatar initials={officer.initials} size={44} />
              <div>
                <div className="user-menu-name">{officer.name}</div>
                <div className="user-menu-title">{officer.title}</div>
                {officer.area && <div className="user-menu-area">Area {officer.area}</div>}
              </div>
            </div>
            <div className="user-menu-scope">
              <Icon name="check" size={12} />
              <span>{scopeText}</span>
            </div>
            <div className="user-menu-divider" />
            <button
              className="user-menu-item"
              onClick={() => {
                setOpen(false)
                signOut().then(() => navigate('/signin'))
              }}
            >
              <Icon name="user" size={14} /> Switch account
            </button>
            <button
              className="user-menu-item user-menu-item-danger"
              onClick={() => {
                setOpen(false)
                signOut().then(() => navigate('/signin'))
              }}
            >
              <Icon name="x" size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
