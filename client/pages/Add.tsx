import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Brand'
import { useApp } from '../context'
import { api } from '../api'
import type { PdfBatchRow } from '../../shared/types'

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/data:(.*);base64/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

export default function Add() {
  const { officer } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'manual' | 'csv' | 'pdf-batch'>('manual')

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
          <div className="add-sub">Enter one candidate manually, upload a CSV, or upload several applications combined into one PDF to onboard a full line at once.</div>
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
        <button className={`add-mode-tab ${mode === 'pdf-batch' ? 'add-mode-tab-active' : ''}`} onClick={() => setMode('pdf-batch')}>
          <div className="add-mode-icon"><Icon name="inbox" size={20} /></div>
          <div className="add-mode-body">
            <div className="add-mode-label">Bulk Application Upload</div>
            <div className="add-mode-sub">One PDF with several applications combined</div>
          </div>
        </button>
      </div>

      {officer && officer.scope !== 'all' && (
        <div className="scope-banner scope-banner-info">
          <Icon name="warn" size={14} />
          <span>You are signed in as <b>{officer.name}</b>. New candidates will be scoped to <b>Area {officer.area}</b> — the chapter list below shows only chapters in that area.</span>
        </div>
      )}

      {mode === 'manual' && <ManualForm onCandidateAdded={(id) => (id ? navigate(`/candidates/${id}`) : navigate('/roster'))} />}
      {mode === 'csv' && <CSVUpload onCandidateAdded={() => navigate('/roster')} />}
      {mode === 'pdf-batch' && <PDFBatchUpload onDone={() => navigate('/roster')} />}
    </div>
  )
}

function FormField({ label, required, error, span = 2, hint, children }: { label: string; required?: boolean; error?: string; span?: number; hint?: string; children: React.ReactNode }) {
  return (
    <div className={`ff ff-span-${span}`}>
      <label className="ff-label">{label}{required && <span className="ff-req">*</span>}</label>
      {children}
      {hint && !error && <div className="ff-hint">{hint}</div>}
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

  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedFrom, setParsedFrom] = useState<{ fileName: string; file: File; headshotDataUrl: string | null } | null>(null)
  // Candidate ID is the record's primary key, and OCR can misread a single
  // digit in it without the result looking obviously wrong (unlike a garbled
  // name or address) -- so an auto-filled ID gets a standing warning until
  // the officer actually edits the field, rather than blending in with every
  // other pre-filled field under the general "review before submitting" note.
  const [idNeedsVerification, setIdNeedsVerification] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (k === 'id') setIdNeedsVerification(false)
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }
  const setVal = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // The school is a fixed fact of a collegiate chapter, not something an
  // officer should be typing independently -- selecting one fills (and
  // locks) School to match, same as the server does regardless of what's
  // submitted. Alumni chapters have no fixed school, so that field stays a
  // normal, editable input for them.
  const setChapter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chapterKey = e.target.value
    const chapter = reference?.chapters[chapterKey]
    setForm((f) => ({
      ...f,
      chapterKey,
      school: chapter?.type === 'collegiate' && chapter.school ? chapter.school : f.school,
    }))
  }
  const selectedChapter = form.chapterKey ? reference?.chapters[form.chapterKey] : undefined
  const schoolLockedByChapter = selectedChapter?.type === 'collegiate' && !!selectedChapter.school

  const handleParseUpload = async (file: File | null | undefined) => {
    if (!file) return
    setParsing(true)
    setParseError(null)
    try {
      const { fields, headshotDataUrl } = await api.parseApplication(file)
      setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) }))
      setParsedFrom({ fileName: file.name, file, headshotDataUrl })
      setIdNeedsVerification(!!fields.id)
    } catch (err: any) {
      setParseError(err.message || 'Could not read that PDF.')
    } finally {
      setParsing(false)
    }
  }

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

      if (parsedFrom) {
        try {
          await api.uploadDoc(candidate.id, 'application', parsedFrom.file)
          if (parsedFrom.headshotDataUrl) {
            const ext = parsedFrom.headshotDataUrl.startsWith('data:image/png') ? 'png' : 'jpg'
            await api.uploadDoc(candidate.id, 'headshot', dataUrlToFile(parsedFrom.headshotDataUrl, `headshot.${ext}`))
          }
        } catch {
          // Non-fatal -- the candidate record already exists; the officer can
          // attach these documents manually from the detail page instead.
        }
      }

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
          <button className="btn-secondary" onClick={() => {
            setConfirmedNew(null)
            setForm((f) => ({ ...f, id: '', firstName: '', middleName: '', lastName: '', email: '', phone: '', address: '', dob: '', school: '', major: '', minor: '', gpa: '', gradDate: '', sponsorName: '', recommenderName: '' }))
            setParsedFrom(null)
            setParseError(null)
            setIdNeedsVerification(false)
          }}>
            + Add another
          </button>
          <button className="btn-primary" onClick={() => onCandidateAdded(confirmedNew.id)}>Open Candidate Record <Icon name="chevron-right" size={12} /></button>
        </div>
      </div>
    )
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <ApplicationUpload
        parsing={parsing}
        parseError={parseError}
        parsedFrom={parsedFrom}
        onUpload={handleParseUpload}
        onClear={() => { setParsedFrom(null); setParseError(null) }}
      />

      <div className="add-form-section">
        <div className="add-form-section-head">
          <div className="add-form-section-num">1</div>
          <div><div className="add-form-section-title">Candidate Identity</div><div className="add-form-section-sub">Basic information on file for this applicant</div></div>
        </div>
        <div className="add-form-grid">
          <FormField label="Candidate ID" required error={errors.id} span={1}>
            <input className="add-input" value={form.id} onChange={set('id')} placeholder="e.g. 2897060" />
            {idNeedsVerification && (
              <div className="ff-warn"><Icon name="warn" size={11} /> Auto-read from the PDF — double-check this number against the source document.</div>
            )}
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
            <select className="add-select" value={form.chapterKey} onChange={setChapter}>
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
          <FormField label="School / University" required error={errors.school} span={3} hint={schoolLockedByChapter ? 'Set by the selected chapter' : undefined}>
            <input
              className="add-input"
              value={form.school}
              onChange={set('school')}
              placeholder="Prairie View A&M University"
              disabled={schoolLockedByChapter}
            />
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

function ApplicationUpload({
  parsing, parseError, parsedFrom, onUpload, onClear,
}: {
  parsing: boolean
  parseError: string | null
  parsedFrom: { fileName: string; file: File; headshotDataUrl: string | null } | null
  onUpload: (file: File | null | undefined) => void
  onClear: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (parsedFrom) {
    return (
      <div className="add-form-section application-upload-done">
        <div className="add-form-section-head">
          <div className="add-form-section-num"><Icon name="check" size={14} /></div>
          <div>
            <div className="add-form-section-title">Application Uploaded</div>
            <div className="add-form-section-sub">
              Parsed <b>{parsedFrom.fileName}</b> — the fields below were auto-filled. Review and correct anything before submitting.
              {parsedFrom.headshotDataUrl ? ' A headshot was also found and will be attached.' : ' No headshot photo was found in the PDF — you can attach one after the candidate is created.'}
            </div>
          </div>
        </div>
        <div className="application-upload-preview">
          {parsedFrom.headshotDataUrl && <img src={parsedFrom.headshotDataUrl} alt="Extracted headshot" className="application-upload-thumb" />}
          <button type="button" className="btn-secondary sm" onClick={onClear}>Upload a different file</button>
        </div>
      </div>
    )
  }

  return (
    <div className="add-form-section">
      <div className="add-form-section-head">
        <div className="add-form-section-num"><Icon name="file" size={14} /></div>
        <div>
          <div className="add-form-section-title">Upload Application <span className="optional-tag">Optional</span></div>
          <div className="add-form-section-sub">Upload the candidate's Application PDF to auto-fill the fields below, including the headshot photo — or skip this and fill out the form manually.</div>
        </div>
      </div>
      <div
        className={`upload-dropzone ${dragOver ? 'upload-dropzone-over' : ''} ${parsing ? 'upload-dropzone-busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!parsing) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!parsing) onUpload(e.dataTransfer.files[0]) }}
        onClick={() => { if (!parsing) inputRef.current?.click() }}
      >
        <input ref={inputRef} type="file" accept="application/pdf" style={{ display: 'none' }} disabled={parsing} onChange={(e) => onUpload(e.target.files?.[0])} />
        <div className="dz-icon">{parsing ? <span className="dz-spinner" /> : <Icon name="file" size={40} />}</div>
        <div className="dz-title">{parsing ? 'Reading application…' : 'Upload Application PDF'}</div>
        <div className="dz-drop-line">{parsing ? 'This can take up to a minute on the first upload' : <>Drag &amp; drop a PDF here, or <b>click to browse</b></>}</div>
        <div className="dz-role">Fields are parsed automatically — you'll review everything before the record is created</div>
      </div>
      {parseError && <div className="ff-error" style={{ marginTop: 10 }}>{parseError}</div>}
    </div>
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

const MAX_BATCH = 10

function PDFBatchUpload({ onDone }: { onDone: () => void }) {
  const [subMode, setSubMode] = useState<'one-at-a-time' | 'combined'>('one-at-a-time')
  return (
    <div>
      <div className="add-mode-tabs" style={{ marginBottom: 16 }}>
        <button className={`add-mode-tab ${subMode === 'one-at-a-time' ? 'add-mode-tab-active' : ''}`} onClick={() => setSubMode('one-at-a-time')}>
          <div className="add-mode-icon"><Icon name="user" size={18} /></div>
          <div className="add-mode-body">
            <div className="add-mode-label">Add One at a Time</div>
            <div className="add-mode-sub">Upload each application separately, then submit the group together</div>
          </div>
        </button>
        <button className={`add-mode-tab ${subMode === 'combined' ? 'add-mode-tab-active' : ''}`} onClick={() => setSubMode('combined')}>
          <div className="add-mode-icon"><Icon name="file" size={18} /></div>
          <div className="add-mode-body">
            <div className="add-mode-label">One Combined PDF</div>
            <div className="add-mode-sub">You've already merged several applications into a single file</div>
          </div>
        </button>
      </div>
      {subMode === 'one-at-a-time' ? <OneAtATimeUpload onDone={onDone} /> : <CombinedPdfUpload onDone={onDone} />}
    </div>
  )
}

interface TrayItem {
  id: number
  file: File
  fields: Record<string, string>
  headshotDataUrl: string | null
  status: 'parsing' | 'ready' | 'parse-error' | 'creating' | 'created' | 'create-error'
  message?: string
}

let trayItemSeq = 0

function OneAtATimeUpload({ onDone }: { onDone: () => void }) {
  const { reference } = useApp()
  const [items, setItems] = useState<TrayItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState<{ created: number; failed: number } | null>(null)
  const [addError, setAddError] = useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Items are matched by a stable id (not array position) on every update
  // below, so an add/remove elsewhere in the tray can never land on the
  // wrong row -- array indices shift whenever something is removed, but ids
  // don't.
  const updateItem = (id: number, patch: Partial<TrayItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const addFiles = (fileList: FileList | File[] | null | undefined) => {
    if (!fileList) return
    setAddError('')
    const all = Array.from(fileList)
    // file.type comes from the browser sniffing the file and is unreliable
    // for PDFs from some scanners/exports/cloud downloads (often comes back
    // empty) -- the extension is a far more reliable signal, so only fall
    // back to rejecting on MIME type if the name itself isn't a .pdf.
    const incoming = all.filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf')
    const notPdf = all.length - incoming.length
    const room = MAX_BATCH - items.length
    const toAdd = incoming.slice(0, room)
    const overCapacity = incoming.length - toAdd.length

    if (notPdf > 0 || overCapacity > 0) {
      const parts: string[] = []
      if (notPdf > 0) parts.push(`${notPdf} file${notPdf === 1 ? " wasn't" : 's were'} not a PDF`)
      if (overCapacity > 0) parts.push(`${overCapacity} skipped -- batch limit is ${MAX_BATCH}`)
      setAddError(parts.join('; ') + '.')
    }
    if (toAdd.length === 0) return

    const newItems: TrayItem[] = toAdd.map((file) => ({ id: ++trayItemSeq, file, fields: {}, headshotDataUrl: null, status: 'parsing' }))
    setItems((prev) => [...prev, ...newItems])

    newItems.forEach(({ id, file }) => {
      api
        .parseApplication(file)
        .then(({ fields, headshotDataUrl }) => updateItem(id, { fields, headshotDataUrl, status: 'ready' }))
        .catch((err: any) => updateItem(id, { status: 'parse-error', message: err.message || 'Could not read this file' }))
    })
  }

  const removeItem = (id: number) => setItems((prev) => prev.filter((it) => it.id !== id))

  const submitAll = async () => {
    setSubmitting(true)
    let created = 0
    let failed = 0
    for (const item of items) {
      if (item.status !== 'ready') continue
      updateItem(item.id, { status: 'creating' })
      try {
        const name = [item.fields.firstName, item.fields.middleName, item.fields.lastName].filter(Boolean).join(' ')
        const { candidate, errors } = await api.createCandidate({ ...item.fields, name })
        if (errors) throw Object.assign(new Error(Object.values(errors)[0] as string), { data: { errors } })
        await api.uploadDoc(candidate.id, 'application', item.file)
        if (item.headshotDataUrl) {
          const ext = item.headshotDataUrl.startsWith('data:image/png') ? 'png' : 'jpg'
          await api.uploadDoc(candidate.id, 'headshot', dataUrlToFile(item.headshotDataUrl, `headshot.${ext}`))
        }
        created++
        updateItem(item.id, { status: 'created' })
      } catch (err: any) {
        failed++
        const message = err.data?.errors ? Object.values(err.data.errors)[0] as string : err.message || 'Could not create this candidate'
        updateItem(item.id, { status: 'create-error', message })
      }
    }
    setSubmitting(false)
    setSummary({ created, failed })
  }

  if (summary) {
    return (
      <div className="add-success">
        <div className="add-success-icon"><Icon name="check" size={40} /></div>
        <div className="add-success-title">Bulk Upload Complete</div>
        <div className="add-success-name">{summary.created} candidate{summary.created === 1 ? '' : 's'} added</div>
        {summary.failed > 0 && (
          <div className="csv-errors" style={{ textAlign: 'left', marginTop: 16 }}>
            <div className="csv-errors-title">{summary.failed} couldn't be created</div>
            <ul>
              {items.filter((it) => it.status === 'create-error').map((it, i) => <li key={i}><b>{it.file.name}:</b> {it.message}</li>)}
            </ul>
          </div>
        )}
        <div className="add-success-actions">
          <button className="btn-secondary" onClick={() => { setSummary(null); setItems([]) }}>Upload another batch</button>
          <button className="btn-primary" onClick={onDone}>Return to Roster <Icon name="chevron-right" size={12} /></button>
        </div>
      </div>
    )
  }

  const readyCount = items.filter((it) => it.status === 'ready').length
  const atCapacity = items.length >= MAX_BATCH || submitting

  return (
    <div className="csv-panel">
      <div className="csv-instructions">
        <div className="csv-inst-title">How one-at-a-time upload works</div>
        <ol className="csv-inst-list">
          <li>Upload each candidate's Application PDF separately — drop one, it's added to the list below, then drop the next.</li>
          <li>Keep going until everyone in this batch is listed (up to {MAX_BATCH}).</li>
          <li>Review the list, remove anything wrong, then submit the whole group at once.</li>
        </ol>
      </div>

      <div
        className={`csv-dropzone ${dragOver ? 'csv-dropzone-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!atCapacity) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!atCapacity) addFiles(e.dataTransfer.files) }}
        onClick={() => { if (!atCapacity) inputRef.current?.click() }}
        style={atCapacity ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      >
        <input ref={inputRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }} disabled={atCapacity} onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        <div className="dz-icon"><Icon name="inbox" size={40} /></div>
        <div className="dz-title">{atCapacity ? `Batch full (${MAX_BATCH} of ${MAX_BATCH})` : 'Add an Application PDF'}</div>
        <div className="dz-drop-line">{atCapacity ? 'Submit or remove one to add another' : <>Drag &amp; drop one or more PDFs, or <b>click to browse</b></>}</div>
        <div className="dz-role">{items.length} of {MAX_BATCH} added</div>
      </div>

      {addError && <div className="ff-error" style={{ marginTop: 10 }}>{addError}</div>}

      {items.length > 0 && (
        <div className="csv-preview">
          <div className="csv-table-wrap">
            <table className="csv-table">
              <thead><tr><th>File</th><th>ID</th><th>Name</th><th>Chapter</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {items.map((it) => {
                  const name = [it.fields.firstName, it.fields.middleName, it.fields.lastName].filter(Boolean).join(' ')
                  const chapterName = it.fields.chapterKey ? reference?.chapters[it.fields.chapterKey]?.name : undefined
                  return (
                    <tr key={it.id}>
                      <td className="csv-cell-sub">{it.file.name}</td>
                      <td className="mono">{it.fields.id || '—'}</td>
                      <td>{name || '—'}</td>
                      <td>{chapterName || <span className="csv-cell-empty">— not detected —</span>}</td>
                      <td>
                        {it.status === 'parsing' && <span className="check-flag"><Icon name="clock" size={12} /> Reading…</span>}
                        {it.status === 'ready' && <span className="check-ok"><Icon name="check" size={12} /> Ready</span>}
                        {it.status === 'parse-error' && <span className="check-flag" title={it.message}><Icon name="warn" size={12} /> Couldn't read</span>}
                        {it.status === 'creating' && <span className="check-flag"><Icon name="clock" size={12} /> Creating…</span>}
                        {it.status === 'created' && <span className="check-ok"><Icon name="check" size={12} /> Created</span>}
                        {it.status === 'create-error' && <span className="check-flag" title={it.message}><Icon name="warn" size={12} /> Failed</span>}
                      </td>
                      <td>
                        {!submitting && (it.status === 'ready' || it.status === 'parse-error') && (
                          <button className="link-btn" onClick={() => removeItem(it.id)}><Icon name="x" size={12} /></button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="csv-preview-actions">
            <button className="btn-secondary" onClick={() => setItems([])} disabled={submitting}>Clear All</button>
            <button className="btn-primary" onClick={submitAll} disabled={readyCount === 0 || submitting}>
              <Icon name="check" size={13} /> {submitting ? 'Creating…' : `Submit ${readyCount} candidate${readyCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CombinedPdfUpload({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<PdfBatchRow[] | null>(null)
  const [pagesPerApplication, setPagesPerApplication] = useState(6)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ created: number; skipped: { startPage: number; reason: string }[] } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (f: File | null | undefined) => {
    if (!f) return
    setError('')
    setFile(f)
    setBusy(true)
    try {
      const res = await api.pdfBatchPreview(f)
      setRows(res.rows)
      setPagesPerApplication(res.pagesPerApplication)
    } catch (e: any) {
      setError(e.message || 'Could not process this file.')
      setFile(null)
    } finally {
      setBusy(false)
    }
  }

  const createAll = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const res = await api.pdfBatchCommit(file)
      setResult(res)
    } catch (e: any) {
      setError(e.message || 'Could not create candidates from this file.')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="add-success">
        <div className="add-success-icon"><Icon name="check" size={40} /></div>
        <div className="add-success-title">Bulk Upload Complete</div>
        <div className="add-success-name">{result.created} candidate{result.created === 1 ? '' : 's'} added</div>
        <div className="add-success-msg">
          Each one has its own split application attached, with sponsor/recommender letters and fees balance parsed the same as a single upload.
        </div>
        {result.skipped.length > 0 && (
          <div className="csv-errors" style={{ textAlign: 'left', marginTop: 16 }}>
            <div className="csv-errors-title">{result.skipped.length} packet{result.skipped.length === 1 ? '' : 's'} skipped</div>
            <ul>
              {result.skipped.map((s, i) => <li key={i}><b>Page {s.startPage + 1}:</b> {s.reason}</li>)}
            </ul>
          </div>
        )}
        <div className="add-success-actions">
          <button className="btn-secondary" onClick={() => { setResult(null); setRows(null); setFile(null) }}>Upload another batch</button>
          <button className="btn-primary" onClick={onDone}>Return to Roster <Icon name="chevron-right" size={12} /></button>
        </div>
      </div>
    )
  }

  const willImport = rows?.filter((r) => r.willImport) || []
  const duplicates = rows?.filter((r) => r.duplicate) || []
  const outOfScope = rows?.filter((r) => r.outOfScope && !r.duplicate) || []
  const errored = rows?.filter((r) => r.error) || []

  return (
    <div className="csv-panel">
      <div className="csv-instructions">
        <div className="csv-inst-title">How bulk application upload works</div>
        <ol className="csv-inst-list">
          <li>Combine several candidates' applications into one PDF, each one right after the other (e.g. merge the individual {pagesPerApplication}-page application PDFs in order).</li>
          <li>Upload the combined file here — it's split back into one application per candidate automatically.</li>
          <li>Review the preview below before anything is created.</li>
        </ol>
        <div className="csv-inst-fields">
          Each application is assumed to be exactly <b>{pagesPerApplication} pages</b>, same as a single Application PDF upload. A packet the parser can't read (wrong page count, unrecognized layout) is flagged rather than guessed — add it individually afterward instead.
        </div>
      </div>

      <div
        className={`csv-dropzone ${dragOver ? 'csv-dropzone-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) handleFile(e.dataTransfer.files[0]) }}
        onClick={() => { if (!busy) inputRef.current?.click() }}
      >
        <input ref={inputRef} type="file" accept="application/pdf" style={{ display: 'none' }} disabled={busy} onChange={(e) => handleFile(e.target.files?.[0])} />
        <div className="dz-icon">{busy ? <span className="dz-spinner" /> : <Icon name="inbox" size={40} />}</div>
        <div className="dz-title">{busy ? 'Processing…' : 'Upload Combined Application PDF'}</div>
        <div className="dz-drop-line">{busy ? 'This can take a while for a large batch' : <>Drag &amp; drop a PDF here, or <b>click to browse</b></>}</div>
        <div className="dz-role">Preview shown before anything is created · Existing candidate IDs are skipped</div>
      </div>

      {error && <div className="ff-error" style={{ marginTop: 10 }}>{error}</div>}

      {rows && (
        <div className="csv-preview">
          <div className="csv-preview-summary">
            <div className="csv-summary-item csv-summary-ok"><div className="csv-summary-num">{willImport.length}</div><div className="csv-summary-label">Ready to import</div></div>
            {duplicates.length > 0 && <div className="csv-summary-item csv-summary-warn"><div className="csv-summary-num">{duplicates.length}</div><div className="csv-summary-label">Duplicate IDs · skipped</div></div>}
            {outOfScope.length > 0 && <div className="csv-summary-item csv-summary-warn"><div className="csv-summary-num">{outOfScope.length}</div><div className="csv-summary-label">Outside your area · skipped</div></div>}
            {errored.length > 0 && <div className="csv-summary-item csv-summary-error"><div className="csv-summary-num">{errored.length}</div><div className="csv-summary-label">Couldn't be read</div></div>}
          </div>

          {errored.length > 0 && (
            <div className="csv-errors">
              <div className="csv-errors-title">Packets that couldn't be read</div>
              <ul>
                {errored.map((r, i) => <li key={i}><b>Page {r.startPage + 1}:</b> {r.error}</li>)}
              </ul>
            </div>
          )}

          {willImport.length > 0 && (
            <div className="csv-table-wrap">
              <table className="csv-table">
                <thead><tr><th>ID</th><th>Name</th><th>Chapter</th><th>School</th><th>GPA</th><th>Headshot</th></tr></thead>
                <tbody>
                  {willImport.map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{r.id}</td>
                      <td><b>{r.name}</b><div className="csv-cell-sub">{r.email}</div></td>
                      <td><b>{r.chapterName}</b></td>
                      <td>{r.school}</td>
                      <td className="mono">{r.gpa}</td>
                      <td>{r.hasHeadshot ? <Icon name="check" size={14} /> : <span className="csv-cell-empty">— none found —</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="csv-preview-actions">
            <button className="btn-secondary" onClick={() => { setRows(null); setFile(null) }}>Cancel</button>
            <button className="btn-primary" onClick={createAll} disabled={willImport.length === 0 || busy}>
              <Icon name="check" size={13} /> {busy ? 'Creating…' : `Create ${willImport.length} candidate${willImport.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
