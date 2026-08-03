import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon } from '../components/Brand'
import { useApp } from '../context'
import { api } from '../api'

interface MissingRow {
  candidateId: string
  candidateName: string
  candidateInitials: string
  chapterKey: string
  school: string
  doc: { key: string; label: string }
  state: 'missing' | 'flagged'
  note: string
}

export default function Missing() {
  const navigate = useNavigate()
  const { reference } = useApp()
  const [rows, setRows] = useState<MissingRow[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => { api.missingReport().then((r) => setRows(r.rows)) }, [])

  const byDoc = useMemo(() => {
    if (!rows) return []
    const groups: Record<string, { doc: any; items: MissingRow[] }> = {}
    rows.forEach((r) => {
      const k = r.doc.key
      if (!groups[k]) groups[k] = { doc: r.doc, items: [] }
      groups[k].items.push(r)
    })
    return Object.values(groups).sort((a, b) => b.items.length - a.items.length)
  }, [rows])

  const stats = useMemo(() => {
    const list = rows || []
    return {
      totalItems: list.length,
      affectedCandidates: new Set(list.map((r) => r.candidateId)).size,
      missing: list.filter((r) => r.state === 'missing').length,
      flagged: list.filter((r) => r.state === 'flagged').length,
    }
  }, [rows])

  const toggle = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  if (!rows || !reference) return <div className="app-loading">Loading missing items report…</div>

  return (
    <div className="missing v-classic">
      <div className="detail-crumb">
        <button className="link-btn" onClick={() => navigate('/roster')}>
          <Icon name="chevron-left" size={14} /> Back to Roster
        </button>
        <span className="crumb-sep">/</span>
        <span className="crumb-cur">Missing Items Report</span>
      </div>

      <div className="missing-hero">
        <div>
          <div className="eyebrow">Cycle Report</div>
          <h1 className="missing-title">Outstanding Items</h1>
          <div className="missing-sub">
            {stats.totalItems} outstanding item{stats.totalItems === 1 ? '' : 's'} across {stats.affectedCandidates} candidate{stats.affectedCandidates === 1 ? '' : 's'} in TCAC. Send batch reminders or work through candidates individually.
          </div>
        </div>
        <div className="missing-actions">
          <button className="btn-secondary"><Icon name="download" size={14} /> Export CSV</button>
          <button className="btn-primary"><Icon name="mail" size={14} /> Send Reminders ({selected.size || 'all'})</button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card stat-accent"><div className="stat-value">{stats.totalItems}</div><div className="stat-label">Outstanding Items</div></div>
        <div className="stat-card stat-warn"><div className="stat-value">{stats.missing}</div><div className="stat-label">Not Received</div></div>
        <div className="stat-card stat-warn"><div className="stat-value">{stats.flagged}</div><div className="stat-label">Flagged / Invalid</div></div>
        <div className="stat-card"><div className="stat-value">{stats.affectedCandidates}</div><div className="stat-label">Affected Candidates</div></div>
      </div>

      <div className="grouped-list">
        {byDoc.map((g) => (
          <div key={g.doc.key} className="group-block">
            <div className="group-head">
              <div className="group-title">{g.doc.label}</div>
              <div className="group-count">{g.items.length} outstanding</div>
            </div>
            <div className="group-table">
              {g.items.map((it, i) => (
                <div key={i} className="group-row">
                  <input
                    type="checkbox"
                    className="group-check"
                    checked={selected.has(`${it.candidateId}:${g.doc.key}`)}
                    onChange={() => toggle(`${it.candidateId}:${g.doc.key}`)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Avatar initials={it.candidateInitials} size={28} />
                  <div className="group-cand">
                    <div className="group-cand-name">{it.candidateName}</div>
                    <div className="group-cand-id">#{it.candidateId} · {reference.chapters[it.chapterKey]?.name} · {it.school}</div>
                  </div>
                  <div className={`group-state group-state-${it.state}`}>{it.state === 'missing' ? 'Not received' : 'Flagged'}</div>
                  <div className="group-note">{it.note}</div>
                  <button className="group-open" onClick={() => navigate(`/candidates/${it.candidateId}`)}>
                    Open <Icon name="chevron-right" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {byDoc.length === 0 && <div className="empty-state">No outstanding items — every candidate in scope is fully documented.</div>}
      </div>
    </div>
  )
}
