import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Brand'
import { useApp } from '../context'
import { api } from '../api'

export default function Add() {
  const { officer } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'manual' | 'csv'>('manual')

  return (
    <div className="add-screen v-classic">
      <div className="detail-crumb">
        <button className="link-btn" onClick={() => navigate('/roster')}><Icon name="chevron-left" size={14} /> Back to Roster</button>
        <span className="crumb-sep">/</span>
        <span className="crumb-cur">Add Candidate</span>
      </div>

      <div className="add-hero">
        <div>
          <div className="eyebrow">TCAC · Intake Committee</div>
          <h1 className="add-title">Add Candidate to Intake</h1>
          <div className="add-sub">Enter one candidate manually or upload a CSV to onboard a full line at once. Uploaded documents can be attached after the record is created.</div>
        </div>
      </div>

      <div className="add-mode-tabs">
        <button className={`add-mode-tab ${mode === 'manual' ? 'add-mode-tab-active' : ''}`} onClick={() => setMode('manual')}>
          <div className="add-mode-icon"><Icon name="user" size={20} /></div>
          <div className="add-mode-body">
            <div className="add-mode-label">Manual Entry</div>
            <div className="add-mode-sub">Add a single candidate by hand</div>
          </div>
        </button>
        <button className={`add-mode-tab ${mode === 'csv' ? 'add-mode-tab-active' : ''}`} onClick={() => setMode('csv')}>
          <div className="add-mode-icon"><Icon name="file" size={20} /></div>
          <div className="add-mode-body">
            <div className="add-mode-label">CSV Upload</div>
            <div className="add-mode-sub">Bulk-add candidates from a spreadsheet</div>
          </div>
        </button>
      </div>

      {officer && officer.scope !== 'all' && (
        <div className="scope-banner scope-banner-info">
          <Icon name="warn" size={14} />
          <span>You are signed in as <b>{officer.name}</b>. New candidates will be scoped to <b>Area {officer.area}</b> — the chapter list below shows only chapters in that area.</span>
        </div>
      )}

      {mode === 'manual' ? <ManualForm onCandidateAdded={(id) => (id ? navigate(`/candidates/${id}`) : navigate('/roster'))} /> : <CSVUpload onCandidateAdded={() => navigate('/roster')} />}
    </div>
  )
}

function FormField({ label, required, error, span = 2, children }: { label: string; required?: boolean; error?: string; span?: number; children: React.ReactNode }) {
  return (
    <div className={`ff ff-span-${span}`}>
      <label className="ff-label">{label}{required && <span className="ff-req">*</span>}</label>
      {children}
      {error && <div className="ff-error">{error}</div>}
    </div>
  )
}

function ManualForm({ onCandidateAdded }: { onCandidateAdded: (id: string | null) => void }) {
  const { officer, reference } = useApp()
  const [form, setForm] = useState({
    id: '', firstName: '', middleName: '', lastName: '', email: '', phone: '', address: '', dob: '',
    school: '', major: '', minor: '', classification: 'Undergraduate', gpa: '', gradDate: '',
    chapterKey: '', term: '2026 FALL', sponsorName: '', recommenderName: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmedNew, setConfirmedNew] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setVal = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const chapterOptions = useMemo(() => {
    if (!reference) return []
    let entries = Object.values(reference.chapters)
    if (officer && officer.scope !== 'all') entries = entries.filter((c) => (officer.scope as number[]).includes(c.area))
    return [...entries].sort((a, b) => (a.type !== b.type ? (a.type === 'collegiate' ? -1 : 1) : a.name.localeCompare(b.name)))
  }, [reference, officer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})
    try {
      const fullName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ')
      const { candidate, errors: serverErrors } = await api.createCandidate({ ...form, name: fullName })
      if (serverErrors) { setErrors(serverErrors); return }
      setConfirmedNew(candidate)
    } catch (err: any) {
      if (err.data?.errors) setErrors(err.data.errors)
      else setErrors({ id: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmedNew) {
    const chapterName = reference?.chapters[confirmedNew.chapterKey]?.name
    return (
      <div className="add-success">
        <div className="add-success-icon"><Icon name="check" size={40} /></div>
        <div className="add-success-title">Candidate Added</div>
        <div className="add-success-name">{confirmedNew.name}</div>
        <div className="add-success-id">#{confirmedNew.id} · {chapterName} · {confirmedNew.term}</div>
        <div className="add-success-msg">
          The record is now in the roster with status <b>Received</b>. Documents will need to be uploaded — the sponsor and recommender will be notified once contact info is confirmed.
        </div>
        <div className="add-success-actions">
          <button className="btn-secondary" onClick={() => { setConfirmedNew(null); setForm((f) => ({ ...f, id: '', firstName: '', middleName: '', lastName: '', email: '', phone: '', address: '', dob: '', school: '', major: '', minor: '', gpa: '', gradDate: '', sponsorName: '', recommenderName: '' })) }}>
            + Add another
          </button>
          <button className="btn-primary" onClick={() => onCandidateAdded(confirmedNew.id)}>Open Candidate Record <Icon name="chevron-right" size={12} /></button>
        </div>
      </div>
    )
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <div className="add-form-section">
        <div className="add-form-section-head">
          <div className="add-form-section-num">1</div>
          <div><div className="add-form-section-title">Candidate Identity</div><div className="add-form-section-sub">Basic information on file for this applicant</div></div>
        </div>
        <div className="add-form-grid">
          <FormField label="Candidate ID" required error={errors.id} span={1}>
            <input className="add-input" value={form.id} onChange={set('id')} placeholder="e.g. 2897060" />
          </FormField>
          <FormField label="Term" span={1}>
            <select className="add-select" value={form.term} onChange={set('term')}>
              <option>2026 FALL</option><option>2026 SPRING</option><option>2025 FALL</option><option>2025 SPRING</option>
            </select>
          </FormField>
          <FormField label="Classification" span={2}>
            <div className="segmented">
              {['Undergraduate', 'Alumni'].map((c) => (
                <button key={c} type="button" className={`segmented-btn ${form.classification === c ? 'segmented-btn-active' : ''}`} onClick={() => setVal('classification', c)}>{c}</button>
              ))}
            </div>
          </FormField>
          <FormField label="First Name" required error={errors.firstName} span={2}>
            <input className="add-input" value={form.firstName} onChange={set('firstName')} placeholder="Nazhir" />
          </FormField>
          <FormField label="Middle Name" span={2}>
            <input className="add-input" value={form.middleName} onChange={set('middleName')} placeholder="Dejean" />
          </FormField>
          <FormField label="Last Name" required error={errors.lastName} span={2}>
            <input className="add-input" value={form.lastName} onChange={set('lastName')} placeholder="Carter" />
          </FormField>
          <FormField label="Date of Birth (Year)" span={2}>
            <input className="add-input" value={form.dob} onChange={set('dob')} placeholder="2002" />
          </FormField>
          <FormField label="Email" required error={errors.email} span={2}>
            <input className="add-input" type="email" value={form.email} onChange={set('email')} placeholder="candidate@example.com" />
          </FormField>
          <FormField label="Phone" span={2}>
            <input className="add-input" value={form.phone} onChange={set('phone')} placeholder="(214) 555-0100" />
          </FormField>
          <FormField label="Address" span={4}>
            <input className="add-input" value={form.address} onChange={set('address')} placeholder="5832 Stratford Ln, The Colony, TX 75056" />
          </FormField>
        </div>
      </div>

      <div className="add-form-section">
        <div className="add-form-section-head">
          <div className="add-form-section-num">2</div>
          <div><div className="add-form-section-title">Chapter Selection</div><div className="add-form-section-sub">Which TCAC chapter is the candidate applying to?</div></div>
        </div>
        <div className="add-form-grid">
          <FormField label="Chapter" required error={errors.chapterKey} span={4}>
            <select className="add-select" value={form.chapterKey} onChange={set('chapterKey')}>
              <option value="">— Select a chapter —</option>
              <optgroup label="Collegiate Chapters">
                {chapterOptions.filter((c) => c.type === 'collegiate').map((c) => (
                  <option key={c.key} value={c.key}>{c.name} · {c.school} · Area {c.area} · {c.city}</option>
                ))}
              </optgroup>
              <optgroup label="Alumni Chapters">
                {chapterOptions.filter((c) => c.type === 'alumni').map((c) => (
                  <option key={c.key} value={c.key}>{c.name} · Area {c.area} · {c.city}</option>
                ))}
              </optgroup>
            </select>
          </FormField>
          {form.chapterKey && reference?.chapters[form.chapterKey] && (
            <div className="add-chapter-preview">
              <div className="chapter-preview-eyebrow">Chapter Details</div>
              <div className="chapter-preview-body">
                <b>{reference.chapters[form.chapterKey].name}</b>
                <span className="meta-dot">•</span>
                <span>{reference.chapters[form.chapterKey].type === 'alumni' ? 'Alumni Chapter' : 'Collegiate Chapter'}</span>
                <span className="meta-dot">•</span>
                <span>Area {reference.chapters[form.chapterKey].area} · {reference.chapters[form.chapterKey].city}</span>
                {reference.chapters[form.chapterKey].school && (<><span className="meta-dot">•</span><span>{reference.chapters[form.chapterKey].school}</span></>)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="add-form-section">
        <div className="add-form-section-head">
          <div className="add-form-section-num">3</div>
          <div><div className="add-form-section-title">Academic Standing</div><div className="add-form-section-sub">Confirms the candidate meets the 2.50 GPA minimum</div></div>
        </div>
        <div className="add-form-grid">
          <FormField label="School / University" required error={errors.school} span={3}>
            <input className="add-input" value={form.school} onChange={set('school')} placeholder="Prairie View A&M University" />
          </FormField>
          <FormField label="Cumulative GPA" error={errors.gpa} span={1}>
            <input className="add-input" value={form.gpa} onChange={set('gpa')} placeholder="3.50" />
          </FormField>
          <FormField label="Major" span={2}>
            <input className="add-input" value={form.major} onChange={set('major')} placeholder="Mass Communications" />
          </FormField>
          <FormField label="Minor" span={2}>
            <input className="add-input" value={form.minor} onChange={set('minor')} placeholder="Music" />
          </FormField>
          <FormField label="Graduation Date (or Expected)" span={4}>
            <input className="add-input" value={form.gradDate} onChange={set('gradDate')} placeholder="May 2024" />
          </FormField>
        </div>
      </div>

      <div className="add-form-section">
        <div className="add-form-section-head">
          <div className="add-form-section-num">4</div>
          <div><div className="add-form-section-title">Sponsor &amp; Recommender <span className="optional-tag">Optional</span></div><div className="add-form-section-sub">Names of the brothers sponsoring and recommending the candidate — can be added later</div></div>
        </div>
        <div className="add-form-grid">
          <FormField label="Sponsor (Bro. Firstname Lastname)" span={2}>
            <input className="add-input" value={form.sponsorName} onChange={set('sponsorName')} placeholder="Bro. Roderick L. Sibley" />
          </FormField>
          <FormField label="Recommender (Bro. Firstname Lastname)" span={2}>
            <input className="add-input" value={form.recommenderName} onChange={set('recommenderName')} placeholder="Bro. Delbert C. Johnson" />
          </FormField>
        </div>
      </div>

      <div className="add-form-footer">
        <button type="button" className="btn-secondary" onClick={() => onCandidateAdded(null)}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={submitting}><Icon name="check" size={13} /> Create Candidate Record</button>
      </div>
    </form>
  )
}

function CSVUpload({ onCandidateAdded }: { onCandidateAdded: () => void }) {
  const [csvText, setCsvText] = useState('')
  const [parsed, setParsed] = useState<{ rows: any[]; errors: any[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setBusy(true)
    try {
      const res = await api.csvPreview(text)
      setParsed(res)
    } finally {
      setBusy(false)
    }
  }

  const downloadTemplate = () => window.open('/api/candidates/csv-template', '_blank')

  const importAll = async () => {
    if (!csvText) return
    setBusy(true)
    try {
      const { inserted } = await api.csvCommit(csvText)
      setConfirmedCount(inserted)
    } finally {
      setBusy(false)
    }
  }

  if (confirmedCount > 0) {
    return (
      <div className="add-success">
        <div className="add-success-icon"><Icon name="check" size={40} /></div>
        <div className="add-success-title">Import Complete</div>
        <div className="add-success-name">{confirmedCount} candidate{confirmedCount === 1 ? '' : 's'} added</div>
        <div className="add-success-msg">All records are now in the roster with status <b>Received</b>. Sponsor and recommender contact info can be finalized on each candidate's detail view.</div>
        <div className="add-success-actions">
          <button className="btn-secondary" onClick={() => { setConfirmedCount(0); setParsed(null); setCsvText('') }}>Import another CSV</button>
          <button className="btn-primary" onClick={onCandidateAdded}>Return to Roster <Icon name="chevron-right" size={12} /></button>
        </div>
      </div>
    )
  }

  const willImport = parsed?.rows.filter((r) => r.willImport) || []
  const skipped = parsed?.rows.filter((r) => r.duplicate) || []
  const outOfScope = parsed?.rows.filter((r) => r.outOfScope && !r.duplicate) || []

  return (
    <div className="csv-panel">
      <div className="csv-instructions">
        <div className="csv-inst-title">How to bulk-add candidates</div>
        <ol className="csv-inst-list">
          <li>Download the CSV template below.</li>
          <li>Fill in one candidate per row using the header columns provided.</li>
          <li>Save as CSV (comma-separated values).</li>
          <li>Drag &amp; drop it here or click to upload — we'll show you a preview before anything is imported.</li>
        </ol>
        <div className="csv-inst-fields">
          <b>Required columns:</b> Candidate ID · Full Name · Email · School · Chapter
          <br />
          <b>Optional columns:</b> Phone · Address · DOB · Major · Minor · Classification · GPA · Graduation Date · Term · Sponsor · Recommender
        </div>
        <button className="btn-secondary" onClick={downloadTemplate}><Icon name="download" size={13} /> Download CSV Template</button>
      </div>

      <div
        className={`csv-dropzone ${dragOver ? 'csv-dropzone-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
        <div className="dz-icon"><Icon name="download" size={40} /></div>
        <div className="dz-title">{busy ? 'Processing…' : 'Upload CSV of Candidates'}</div>
        <div className="dz-drop-line">Drag &amp; drop a .csv file, or <b>click to browse</b></div>
        <div className="dz-role">Preview shown before import · Existing candidate IDs are skipped</div>
      </div>

      {parsed && (
        <div className="csv-preview">
          <div className="csv-preview-summary">
            <div className="csv-summary-item csv-summary-ok"><div className="csv-summary-num">{willImport.length}</div><div className="csv-summary-label">Ready to import</div></div>
            {skipped.length > 0 && <div className="csv-summary-item csv-summary-warn"><div className="csv-summary-num">{skipped.length}</div><div className="csv-summary-label">Duplicate IDs · skipped</div></div>}
            {outOfScope.length > 0 && <div className="csv-summary-item csv-summary-warn"><div className="csv-summary-num">{outOfScope.length}</div><div className="csv-summary-label">Outside your area · skipped</div></div>}
            {parsed.errors.length > 0 && <div className="csv-summary-item csv-summary-error"><div className="csv-summary-num">{parsed.errors.length}</div><div className="csv-summary-label">Rows with errors</div></div>}
          </div>

          {parsed.errors.length > 0 && (
            <div className="csv-errors">
              <div className="csv-errors-title">Errors in file</div>
              <ul>
                {parsed.errors.slice(0, 8).map((e: any, i: number) => <li key={i}><b>Line {e.line}:</b> {e.message}</li>)}
                {parsed.errors.length > 8 && <li>…and {parsed.errors.length - 8} more</li>}
              </ul>
            </div>
          )}

          {willImport.length > 0 && (
            <div className="csv-table-wrap">
              <table className="csv-table">
                <thead><tr><th>ID</th><th>Name</th><th>Chapter</th><th>School</th><th>GPA</th><th>Sponsor / Recommender</th></tr></thead>
                <tbody>
                  {willImport.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="mono">{r.id}</td>
                      <td><b>{r.name}</b><div className="csv-cell-sub">{r.email}</div></td>
                      <td><b>{r.chapterName}</b></td>
                      <td>{r.school}<div className="csv-cell-sub">{r.major}{r.classification ? ` · ${r.classification}` : ''}</div></td>
                      <td className="mono">{r.gpa}</td>
                      <td>
                        {r.sponsorName ? <div>{r.sponsorName}</div> : <div className="csv-cell-empty">— no sponsor —</div>}
                        {r.recommenderName ? <div>{r.recommenderName}</div> : <div className="csv-cell-empty">— no recommender —</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="csv-preview-actions">
            <button className="btn-secondary" onClick={() => { setParsed(null); setCsvText('') }}>Cancel</button>
            <button className="btn-primary" onClick={importAll} disabled={willImport.length === 0 || busy}>
              <Icon name="check" size={13} /> Import {willImport.length} candidate{willImport.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
