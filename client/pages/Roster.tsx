import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, CompletenessBar, Icon, ShieldMark, StatusPill } from '../components/Brand'
import { useApp } from '../context'
import { api } from '../api'
import { requiredDocsFor } from '../../shared/reference'
import type { Candidate } from '../../shared/types'

function completeness(c: Candidate) {
  const applicable = requiredDocsFor(c.chapterType)
  const valid = applicable.filter((d) => c.docs[d.key]?.present && c.docs[d.key]?.valid).length
  return { valid, total: applicable.length, pct: applicable.length ? Math.round((valid / applicable.length) * 100) : 100 }
}

export default function Roster() {
  const { officer, reference } = useApp()
  const navigate = useNavigate()
  const [all, setAll] = useState<Candidate[] | null>(null)
  const [query, setQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterChapter, setFilterChapter] = useState('all')
  const [sortBy, setSortBy] = useState('id')
  const [error, setError] = useState('')

  const reload = () => {
    api.listCandidates({}).then((r) => setAll(r.candidates)).catch((e) => setError(e.message))
  }
  useEffect(() => { reload() }, [])

  const filtered = useMemo(() => {
    if (!all) return []
    let list = all.filter((c) => {
      if (filterStatus !== 'all' && c.status.key !== filterStatus) return false
      if (filterType !== 'all' && c.chapterType !== filterType) return false
      if (filterChapter !== 'all' && c.chapterKey !== filterChapter) return false
      if (query) {
        const q = query.toLowerCase()
        const ch = reference?.chapters[c.chapterKey]
        if (
          !c.name.toLowerCase().includes(q) &&
          !c.school.toLowerCase().includes(q) &&
          !c.id.toLowerCase().includes(q) &&
          !c.fullId.toLowerCase().includes(q) &&
          !(ch?.name.toLowerCase().includes(q))
        ) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      if (a.isNew && !b.isNew) return -1
      if (!a.isNew && b.isNew) return 1
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'school') return a.school.localeCompare(b.school)
      if (sortBy === 'chapter') return (reference?.chapters[a.chapterKey]?.name || '').localeCompare(reference?.chapters[b.chapterKey]?.name || '')
      if (sortBy === 'gpa') return b.gpa - a.gpa
      if (sortBy === 'submitted') return b.submitted.localeCompare(a.submitted)
      return a.id.localeCompare(b.id)
    })
    return list
  }, [all, query, filterStatus, filterType, filterChapter, sortBy, reference])

  const stats = useMemo(() => {
    const list = all || []
    const total = list.length
    const byStatus: Record<string, number> = {}
    reference?.statuses.forEach((s) => (byStatus[s.key] = 0))
    list.forEach((c) => (byStatus[c.status.key] = (byStatus[c.status.key] || 0) + 1))
    const missingCount = list.filter((c) => Object.values(c.docs).some((d) => !d.present || !d.valid)).length
    const collegiate = list.filter((c) => c.chapterType === 'collegiate').length
    const alumni = list.filter((c) => c.chapterType === 'alumni').length
    return { total, byStatus, missingCount, collegiate, alumni }
  }, [all, reference])

  const chapterOptions = useMemo(() => {
    if (!reference) return []
    let chapters = Object.values(reference.chapters)
    if (officer && officer.scope !== 'all') {
      chapters = chapters.filter((c) => (officer.scope as number[]).includes(c.area))
    }
    if (filterType !== 'all') chapters = chapters.filter((c) => c.type === filterType)
    return chapters
  }, [reference, officer, filterType])

  if (!all || !reference) {
    return <div className="app-loading">Loading roster…</div>
  }

  const scopeText = officer?.scope === 'all' ? 'District-Wide Access · All Areas' : `Area Access · Area ${officer?.area}`

  return (
    <div className="roster v-classic">
      <header className="banner-classic">
        <div className="banner-inner">
          <div className="banner-left">
            <ShieldMark size={56} />
            <div>
              <div className="eyebrow">ΑΛΦΑ ΦΙ ΑΛΦΑ · Founded 1906 · Cornell University</div>
              <h1 className="banner-title">Texas Council of Alpha Chapters — Intake Review</h1>
              <div className="banner-sub">Southwestern Region · Cycle 2026 · Bro. Adrian Escalante, District Director</div>
            </div>
          </div>
          <div className="banner-right">
            <div className="banner-meta">
              <div className="meta-label">Reviewing as</div>
              <div className="meta-value">{officer?.name}</div>
              <div className="meta-role">{officer?.title}{officer?.area ? ` · Area ${officer.area}` : ''}</div>
              <div className="meta-scope">{scopeText}</div>
            </div>
          </div>
        </div>
        <div className="banner-rule" />
        <div className="banner-motto">"First of All, Servants of All, We Shall Transcend All."</div>
      </header>

      {officer?.scope !== 'all' && (
        <div className="scope-banner">
          <Icon name="warn" size={14} />
          <span>
            Viewing only <b>Area {officer?.area}</b> · {reference.district.areaNames[String(officer?.area)]}. Candidates in other areas are hidden by your role scope.
          </span>
        </div>
      )}

      {error && <div className="signin-error">{error}</div>}

      <div className="stat-row stat-row-7">
        <StatCard label="Total Candidates" value={stats.total} accent />
        <StatCard label="Collegiate" value={stats.collegiate} />
        <StatCard label="Alumni" value={stats.alumni} />
        <StatCard label="Received" value={stats.byStatus.received || 0} />
        <StatCard label="Under Review" value={stats.byStatus.review || 0} />
        <StatCard label="Missing Docs" value={stats.byStatus.missing || 0} warn />
        <StatCard label="Cleared for Intake" value={stats.byStatus.cleared || 0} gold />
      </div>

      <div className="toolbar">
        <div className="search-wrap">
          <Icon name="search" size={14} />
          <input
            className="search-input"
            placeholder="Search by name, chapter, school, or candidate ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Type</label>
          <select className="filter-select" value={filterType} onChange={(e) => { setFilterType(e.target.value); setFilterChapter('all') }}>
            <option value="all">All ({stats.total})</option>
            <option value="collegiate">Collegiate ({stats.collegiate})</option>
            <option value="alumni">Alumni ({stats.alumni})</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Chapter</label>
          <select className="filter-select" value={filterChapter} onChange={(e) => setFilterChapter(e.target.value)}>
            <option value="all">All chapters</option>
            {chapterOptions.map((c) => (
              <option key={c.key} value={c.key}>{c.name}{c.school ? ` · ${c.school}` : ` · ${c.city}`}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Status</label>
          <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All</option>
            {reference.statuses.map((s) => (
              <option key={s.key} value={s.key}>{s.label} ({stats.byStatus[s.key] || 0})</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Sort</label>
          <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="id">Candidate ID</option>
            <option value="name">Name (A–Z)</option>
            <option value="chapter">Chapter</option>
            <option value="school">School (A–Z)</option>
            <option value="gpa">GPA (high → low)</option>
            <option value="submitted">Submitted (recent)</option>
          </select>
        </div>

        <button className="btn-secondary" onClick={() => navigate('/missing')}>
          <Icon name="flag" size={14} />
          <span>Missing Items</span>
          <span className="badge-count">{stats.missingCount}</span>
        </button>

        <button className="btn-secondary" onClick={() => window.open('/api/candidates/csv-template', '_blank')}>
          <Icon name="download" size={14} />
          <span>Export</span>
        </button>

        <button className="btn-primary btn-add" onClick={() => navigate('/add')}>
          <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 700, marginRight: 4 }}>+</span>
          <span>Add Candidate</span>
        </button>
      </div>

      <div className="table-wrap">
        <table className="roster-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Candidate</th>
              <th>Chapter</th>
              <th style={{ width: 60 }}>GPA</th>
              <th style={{ width: 170 }}>Doc Completeness</th>
              <th style={{ width: 110 }}>Auto-Check</th>
              <th style={{ width: 140 }}>Status</th>
              <th style={{ width: 100 }}>Submitted</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const comp = completeness(c)
              const flags = [c.chapterType === 'collegiate' ? c.checks.gpaMin : null, c.checks.signatures, c.checks.dates].filter((x) => x?.pass === false).length
                + (c.checks.sponsorRecommender.state === 'warn' || c.checks.sponsorRecommender.state === 'flag' ? 1 : 0)
              const ch = reference.chapters[c.chapterKey]
              return (
                <tr key={c.id} onClick={() => navigate(`/candidates/${c.id}`)} className="row">
                  <td><Avatar initials={c.initials} size={32} /></td>
                  <td>
                    <div className="cand-name">
                      {c.name}
                      {c.featured && <span className="featured-star" title="Featured example — real submission">★</span>}
                      {c.isNew && <span className="new-badge" title="Recently added">NEW</span>}
                    </div>
                    <div className="cand-id">#{c.id} · {c.school}</div>
                  </td>
                  <td>
                    <div className="cand-chapter">
                      <span className="chapter-name">{ch?.name}</span>
                      <span className={`chapter-type-mini chapter-type-${ch?.type}`}>{ch?.type === 'alumni' ? 'Alumni' : 'Collegiate'}</span>
                    </div>
                    <div className="cand-area">Area {ch?.area} · {ch?.city}</div>
                  </td>
                  <td><span className={`gpa ${c.gpa <= 2.5 ? 'gpa-fail' : ''}`}>{c.gpa.toFixed(2)}</span></td>
                  <td><CompletenessBar valid={comp.valid} total={comp.total} /></td>
                  <td>
                    {flags === 0 ? (
                      <span className="check-ok"><Icon name="check" size={12} /> Pass</span>
                    ) : (
                      <span className="check-flag"><Icon name="warn" size={12} /> {flags} flag{flags > 1 ? 's' : ''}</span>
                    )}
                  </td>
                  <td><StatusPill status={c.status} /></td>
                  <td className="submitted">{c.submitted}</td>
                  <td><Icon name="chevron-right" size={16} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">No candidates match your filters.</div>}
      </div>

      <div className="roster-footer">
        Showing {filtered.length} of {stats.total} candidates in scope · {officer?.scope === 'all' ? 'All Texas Areas' : `Area ${officer?.area}`} · Cycle 2026
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, warn, gold }: { label: string; value: number; accent?: boolean; warn?: boolean; gold?: boolean }) {
  const cls = ['stat-card']
  if (accent) cls.push('stat-accent')
  if (warn) cls.push('stat-warn')
  if (gold) cls.push('stat-gold')
  return (
    <div className={cls.join(' ')}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
