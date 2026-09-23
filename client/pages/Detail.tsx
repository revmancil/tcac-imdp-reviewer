import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, DocStateDot, Icon, StatusPill } from '../components/Brand'
import { useApp } from '../context'
import { api } from '../api'
import { DocContent, mockEssayParagraphs } from './DocContent'
import { requiredDocsFor } from '../../shared/reference'
import { countWords, MIN_ESSAY_WORDS } from '../../shared/word-count'
import type { Brother, Candidate, DocState, RequiredDocDef } from '../../shared/types'

export default function Detail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { reference } = useApp()
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [accessDenied, setAccessDenied] = useState<{ chapter: any; areaName: string } | null>(null)
  const [activeDoc, setActiveDoc] = useState<string>('application')
  const [replacingKey, setReplacingKey] = useState<string | null>(null)
  const [letterOverlay, setLetterOverlay] = useState<{ role: string; brother: Brother } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [flagging, setFlagging] = useState(false)
  const [togglingFees, setTogglingFees] = useState(false)

  const load = () => {
    if (!id) return
    setAccessDenied(null)
    api
      .getCandidate(id)
      .then((r) => {
        setCandidate(r.candidate)
        setActiveDoc(reference?.requiredDocs[0]?.key || 'application')
      })
      .catch((err) => {
        if (err.status === 403 && err.data) setAccessDenied({ chapter: err.data.chapter, areaName: err.data.areaName })
        else if (err.status === 404) setCandidate(null)
      })
  }
  useEffect(() => { load() }, [id])

  const handleUpload = async (docKey: string, file: File) => {
    if (!id) return
    setUploading(true)
    try {
      const { candidate: updated } = await api.uploadDoc(id, docKey, file)
      setCandidate(updated)
      setReplacingKey(null)
    } finally {
      setUploading(false)
    }
  }

  const handleFlag = async (docKey: string, valid: boolean, note?: string) => {
    if (!id) return
    setFlagging(true)
    try {
      const { candidate: updated } = await api.flagDoc(id, docKey, valid, note)
      setCandidate(updated)
    } finally {
      setFlagging(false)
    }
  }

  const handleToggleFees = async (paid: boolean) => {
    if (!id) return
    setTogglingFees(true)
    try {
      const { candidate: updated } = await api.setMembershipFeesPaid(id, paid)
      setCandidate(updated)
    } finally {
      setTogglingFees(false)
    }
  }

  if (accessDenied) {
    return (
      <div className="detail v-classic">
        <div className="detail-crumb">
          <button className="link-btn" onClick={() => navigate('/roster')}><Icon name="chevron-left" size={14} /> Back to Roster</button>
        </div>
        <div className="access-denied">
          <div className="access-denied-icon"><Icon name="warn" size={48} /></div>
          <div className="access-denied-title">Access Restricted</div>
          <div className="access-denied-body">
            This candidate belongs to <b>Area {accessDenied.chapter.area}</b> ({accessDenied.areaName}) and is outside your area of responsibility.
          </div>
          <div className="access-denied-body">
            Only the District Director, Chief Dean of Membership Intake, Chief Administrator, or the responsible Area Director / Assistant Area Director for Area {accessDenied.chapter.area} may review this candidate.
          </div>
          <button className="btn-primary" onClick={() => navigate('/roster')}><Icon name="chevron-left" size={13} /> Return to Roster</button>
        </div>
      </div>
    )
  }

  if (!candidate || !reference) return <div className="app-loading">Loading candidate…</div>

  const chapter = reference.chapters[candidate.chapterKey]
  const applicableDocs = requiredDocsFor(candidate.chapterType)
  const comp = (() => {
    const valid = applicableDocs.filter((d) => candidate.docs[d.key]?.present && candidate.docs[d.key]?.valid).length
    return { valid, total: applicableDocs.length }
  })()

  const hasApplication = !!candidate.docs.application?.present

  return (
    <div className="detail v-classic">
      <div className="detail-crumb">
        <button className="link-btn" onClick={() => navigate('/roster')}><Icon name="chevron-left" size={14} /> Back to Roster</button>
        <span className="crumb-sep">/</span>
        <span className="crumb-cur">#{candidate.id}</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-cur-2">{chapter?.name} · Area {chapter?.area}</span>
      </div>

      <div className="detail-header">
        <div className="detail-header-left">
          <Avatar initials={candidate.initials} size={72} />
          <div>
            <div className="detail-id">
              #{candidate.id} · {candidate.fullId}
              {candidate.featured && <span className="detail-featured">Real submission</span>}
            </div>
            <h1 className="detail-name">{candidate.name}</h1>
            <div className="detail-meta">
              <b>{chapter?.name}</b>
              <span className="meta-dot">•</span>
              <span>{chapter?.type === 'alumni' ? 'Alumni Chapter' : 'Collegiate Chapter'}</span>
              <span className="meta-dot">•</span>
              <span>Area {chapter?.area} · {chapter?.city}</span>
            </div>
            <div className="detail-meta detail-meta-2">
              <span>{candidate.school}</span>
              <span className="meta-dot">•</span>
              <span>{candidate.major}</span>
              <span className="meta-dot">•</span>
              <span>{candidate.classification}</span>
              <span className="meta-dot">•</span>
              <span>GPA {candidate.gpa.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="detail-header-right">
          <StatusPill status={candidate.status} />
          <div className="detail-actions">
            <button className="btn-secondary sm"><Icon name="mail" size={13} /> Request Docs</button>
            <button className="btn-primary sm"><Icon name="check" size={13} /> Mark Complete</button>
          </div>
        </div>
      </div>

      {(candidate.sponsor || candidate.recommender) && (
        <div className="sponsor-row">
          {candidate.sponsor && (
            <SponsorCard
              role="Sponsor"
              brother={candidate.sponsor}
              hasApplication={hasApplication}
              onReadLetter={() => setActiveDoc('application')}
              onShowLetterText={() => setLetterOverlay({ role: 'Sponsor', brother: candidate.sponsor! })}
            />
          )}
          {candidate.recommender && (
            <SponsorCard
              role="Recommender"
              brother={candidate.recommender}
              hasApplication={hasApplication}
              onReadLetter={() => setActiveDoc('application')}
              onShowLetterText={() => setLetterOverlay({ role: 'Recommender', brother: candidate.recommender! })}
            />
          )}
        </div>
      )}

      <WorkflowTimeline candidate={candidate} onToggleFees={handleToggleFees} togglingFees={togglingFees} />

      {letterOverlay && <LetterTextOverlay role={letterOverlay.role} brother={letterOverlay.brother} onClose={() => setLetterOverlay(null)} />}

      <div className="checkstrip">
        <div className="checkstrip-title">Automated Review</div>
        <div className="checkstrip-items">
          <CheckItem label="Doc Completeness" pass={comp.valid === comp.total} value={`${comp.valid}/${comp.total} documents valid`} />
          <CheckItem label="GPA Minimum (2.50)" pass={candidate.checks.gpaMin.pass} value={candidate.checks.gpaMin.value} />
          <CheckItem label="Required Signatures" pass={candidate.checks.signatures.pass} value={candidate.checks.signatures.value} />
          <CheckItem label="Date Validity" pass={candidate.checks.dates.pass} value={candidate.checks.dates.value} />
          <CheckItem label="Sponsor & Recommender" state={candidate.checks.sponsorRecommender.state} value={candidate.checks.sponsorRecommender.value} />
        </div>
      </div>

      <div className="split">
        <div className="viewer">
          <div className="viewer-tabs">
            {applicableDocs.map((d) => {
              const doc = candidate.docs[d.key]
              const active = activeDoc === d.key
              return (
                <button key={d.key} className={`vtab ${active ? 'vtab-active' : ''} ${!doc?.present ? 'vtab-missing' : ''}`} onClick={() => setActiveDoc(d.key)}>
                  <DocStateDot doc={doc} /> <span>{d.short}</span>
                </button>
              )
            })}
          </div>
          <div className="viewer-body">
            <DocPreview
              docKey={activeDoc}
              doc={candidate.docs[activeDoc]}
              candidate={candidate}
              chapter={chapter}
              onUpload={(file) => handleUpload(activeDoc, file)}
              uploading={uploading}
              replacing={replacingKey === activeDoc}
              onStartReplace={() => setReplacingKey(activeDoc)}
              onCancelReplace={() => setReplacingKey(null)}
              onFlag={(valid, note) => handleFlag(activeDoc, valid, note)}
              flagging={flagging}
            />
          </div>
        </div>

        <aside className="checklist">
          <div className="checklist-section">
            <div className="section-title">Document Checklist</div>
            {applicableDocs.map((d) => {
              const doc = candidate.docs[d.key]
              const state = !doc?.present ? 'missing' : !doc.valid ? 'flagged' : 'valid'
              return (
                <div key={d.key} className={`checkrow checkrow-${state} ${activeDoc === d.key ? 'checkrow-active' : ''}`} onClick={() => setActiveDoc(d.key)}>
                  <DocStateDot doc={doc} />
                  <div className="checkrow-main">
                    <div className="checkrow-label">{d.label}</div>
                    {doc?.note && <div className="checkrow-note">{doc.note}</div>}
                    {!doc?.note && doc?.present && doc.valid && <div className="checkrow-note">{d.pages} pg · Validated{doc.file ? ' · PDF attached' : ''}</div>}
                    {!doc?.note && !doc?.present && <div className="checkrow-note">Not received</div>}
                    {d.key === 'essay' && <EssayChecklistWordCount candidate={candidate} />}
                    {d.signaturePolicy && (
                      <div className="checkrow-policy"><Icon name="flag" size={10} /> {d.signaturePolicy}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="checklist-section">
            <div className="section-title">Reviewer Notes</div>
            <div className="notes-body">
              <div className="note-item">
                <div className="note-head">
                  <span className="note-author">{candidate.reviewer}</span>
                  <span className="note-time">{candidate.lastActivity}</span>
                </div>
                <div className="note-text">
                  {candidate.status.key === 'cleared' && 'All materials verified. Recommended to advance to the intake process.'}
                  {candidate.status.key === 'complete' && 'Documents complete. Awaiting committee sign-off.'}
                  {candidate.status.key === 'missing' && 'Follow up with candidate re: outstanding items flagged above.'}
                  {candidate.status.key === 'review' && 'Documents received, working through completeness pass.'}
                  {candidate.status.key === 'received' && 'New application in queue for initial review.'}
                </div>
              </div>
            </div>
            <textarea className="note-input" placeholder="Add a note for the committee…" />
            <button className="btn-primary sm full"><Icon name="send" size={13} /> Post Note</button>
          </div>

          <div className="checklist-section">
            <div className="section-title">Activity</div>
            <div className="activity">
              <ActivityLine label="Application received" who="System" when={candidate.submitted} />
              <ActivityLine label="Auto-parse complete" who="System" when={candidate.submitted} />
              <ActivityLine label={`Assigned to ${candidate.reviewer}`} who="District DoM" when={candidate.submitted} />
              {candidate.status.key !== 'received' && <ActivityLine label="Review started" who={candidate.reviewer} when={candidate.lastActivity} />}
              {candidate.status.key === 'cleared' && <ActivityLine label="Cleared for intake" who="District Committee" when={candidate.lastActivity} highlight />}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function CheckItem({ label, pass, state: stateProp, value }: { label: string; pass?: boolean | null; state?: 'ok' | 'warn' | 'flag' | 'pending'; value: string }) {
  const state = stateProp ?? (pass === null || pass === undefined ? 'pending' : pass ? 'ok' : 'flag')
  return (
    <div className={`check-item check-item-${state}`}>
      <div className="check-item-top">
        <span className="check-item-icon">
          {state === 'ok' && <Icon name="check" size={13} />}
          {(state === 'flag' || state === 'warn') && <Icon name="warn" size={13} />}
          {state === 'pending' && <Icon name="clock" size={13} />}
        </span>
        <span className="check-item-label">{label}</span>
      </div>
      <div className="check-item-value">{value}</div>
    </div>
  )
}

function ActivityLine({ label, who, when, highlight }: { label: string; who: string; when: string; highlight?: boolean }) {
  return (
    <div className={`activity-line ${highlight ? 'activity-highlight' : ''}`}>
      <div className="activity-dot" />
      <div className="activity-body">
        <div className="activity-label">{label}</div>
        <div className="activity-meta">{who} · {when}</div>
      </div>
    </div>
  )
}

function DocPreview({
  docKey, doc, candidate, chapter, onUpload, uploading, replacing, onStartReplace, onCancelReplace, onFlag, flagging,
}: {
  docKey: string
  doc: DocState | undefined
  candidate: Candidate
  chapter: any
  onUpload: (file: File) => void
  uploading: boolean
  replacing: boolean
  onStartReplace: () => void
  onCancelReplace: () => void
  onFlag: (valid: boolean, note?: string) => void
  flagging: boolean
}) {
  const { reference } = useApp()
  const meta = reference?.requiredDocs.find((d) => d.key === docKey)
  if (!meta) return null

  if (!doc?.present) {
    return (
      <div>
        <SignaturePolicyNote meta={meta} />
        <UploadDropzone docKey={docKey} docLabel={meta.label} note={doc?.note} uploadedBy={candidate.name} onUpload={onUpload} uploading={uploading} />
      </div>
    )
  }

  if (replacing) {
    return (
      <div>
        <div className="replace-banner">
          <div><b>Replacing {meta.label}</b> — the existing file will be superseded by the new upload. History is preserved.</div>
          <button className="btn-secondary sm" onClick={onCancelReplace}>Cancel</button>
        </div>
        <SignaturePolicyNote meta={meta} />
        <UploadDropzone docKey={docKey} docLabel={meta.label + ' (new version)'} note="Drop the replacement file below" uploadedBy={candidate.name} onUpload={onUpload} uploading={uploading} isReplace />
      </div>
    )
  }

  if (doc.file) {
    return (
      <div className="doc-canvas">
        <div className="doc-pdf-wrap">
          <div className="doc-pdf-header">
            <div>
              <div className="pdf-title">{meta.label}</div>
              <div className="pdf-sub"><Icon name="file" size={11} /> {doc.file.split('/').pop() || 'attached file'} · {docKey === 'headshot' ? 'Photo attached' : 'PDF attached'}</div>
            </div>
            <div className="doc-tools">
              <button className="tool-btn tool-btn-replace" onClick={onStartReplace}><Icon name="download" size={13} /> Replace file</button>
              <a href={doc.file} target="_blank" rel="noopener" className="tool-btn"><Icon name="download" size={13} /> Open in New Tab</a>
            </div>
          </div>
          <SignaturePolicyNote meta={meta} />
          <FlagControl doc={doc} onFlag={onFlag} busy={flagging} />
          {docKey === 'essay' && <EssayWordCount candidate={candidate} />}
          {docKey === 'headshot' ? (
            <div className="headshot-page">
              <div className="headshot-frame">
                <img src={doc.file} alt={`${candidate.name} headshot`} className="headshot-photo" />
              </div>
            </div>
          ) : (
            <iframe src={doc.file} className="doc-pdf-frame" title={meta.label} />
          )}
          {!doc.valid && doc.note && (
            <div className="doc-flag-annot doc-flag-inline"><Icon name="warn" size={14} /><span>Flagged: {doc.note}</span></div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="doc-canvas">
      <SignaturePolicyNote meta={meta} />
      <FlagControl doc={doc} onFlag={onFlag} busy={flagging} />
      {docKey === 'essay' && <EssayWordCount candidate={candidate} />}
      <div className="doc-page">
        <DocContent docKey={docKey} candidate={candidate} chapter={chapter} />
        {!doc.valid && doc.note && <div className="doc-flag-annot"><Icon name="warn" size={14} /><span>Flagged: {doc.note}</span></div>}
      </div>
      <div className="doc-toolbar">
        <span>Page 1 of {meta.pages} · Preview (mock — no PDF attached)</span>
        <div className="doc-tools">
          <button className="tool-btn tool-btn-replace" onClick={onStartReplace}><Icon name="download" size={13} /> Upload real PDF</button>
          <button className="tool-btn"><Icon name="download" size={13} /> Download PDF</button>
        </div>
      </div>
    </div>
  )
}

function FlagControl({ doc, onFlag, busy }: { doc: DocState | undefined; onFlag: (valid: boolean, note?: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!doc?.present) return null

  if (doc.valid === false && doc.note) {
    return (
      <div className="flag-control flag-control-active">
        <div className="flag-control-note"><Icon name="warn" size={13} /> Flagged for review: {doc.note}</div>
        <button className="tool-btn" disabled={busy} onClick={() => onFlag(true)}>Clear Flag</button>
      </div>
    )
  }

  if (open) {
    return (
      <div className="flag-control">
        <textarea
          className="flag-control-input"
          placeholder="What's wrong with this document? (e.g. signature appears typed/electronic, not handwritten)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          autoFocus
        />
        <div className="flag-control-actions">
          <button className="btn-secondary sm" onClick={() => { setOpen(false); setReason('') }}>Cancel</button>
          <button
            className="btn-primary sm"
            disabled={busy || !reason.trim()}
            onClick={() => { onFlag(false, reason.trim()); setOpen(false); setReason('') }}
          >
            Flag for Review
          </button>
        </div>
      </div>
    )
  }

  return (
    <button className="tool-btn tool-btn-flag" onClick={() => setOpen(true)}><Icon name="warn" size={13} /> Flag for Review</button>
  )
}

function SignaturePolicyNote({ meta }: { meta: RequiredDocDef }) {
  if (!meta.signaturePolicy) return null
  return (
    <div className="doc-flag-annot doc-flag-inline doc-policy-note">
      <Icon name="flag" size={14} />
      <span>{meta.signaturePolicy}</span>
    </div>
  )
}

function UploadDropzone({
  docKey, docLabel, note, uploadedBy, onUpload, uploading, isReplace,
}: {
  docKey: string
  docLabel: string
  note?: string | null
  uploadedBy: string
  onUpload: (file: File) => void
  uploading: boolean
  isReplace?: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) onUpload(files[0])
  }

  return (
    <div className="upload-dropzone-wrap">
      <div
        className={`upload-dropzone ${dragOver ? 'upload-dropzone-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
        <div className="dz-icon"><Icon name="download" size={40} /></div>
        <div className="dz-title">{uploading ? 'Uploading…' : isReplace ? `Upload replacement for ${docLabel}` : `${docLabel} — not received`}</div>
        {note && <div className="dz-note">{note}</div>}
        <div className="dz-drop-line">Drag &amp; drop a PDF here, or <b>click to browse</b></div>
        <div className="dz-role">{isReplace ? 'Version history is preserved — the current file will remain accessible' : `To be submitted by the candidate: ${uploadedBy}`}</div>
      </div>

      {!isReplace && (
        <div className="upload-actions">
          <button className="btn-secondary"><Icon name="mail" size={13} /> Email upload link to candidate</button>
          <button className="btn-secondary"><Icon name="send" size={13} /> Copy secure upload link</button>
        </div>
      )}

      <div className="upload-help">
        <div className="upload-help-title">Accepted formats</div>
        <ul>
          <li>PDF (preferred) — signed and dated, all pages combined</li>
          <li>Scanned images (JPG/PNG) — legible, 300 DPI minimum</li>
          <li>Maximum 25 MB per file</li>
          <li>Files are encrypted at rest and only visible to authorized District intake officers</li>
        </ul>
      </div>
    </div>
  )
}

// null = no text available yet to count (real essay file uploaded, but not
// through the OCR-extracting upload path yet).
function essayWordSource(candidate: Candidate): string | null {
  return candidate.essayText ?? (candidate.docs.essay?.file ? null : mockEssayParagraphs(candidate).join(' '))
}

function EssayChecklistWordCount({ candidate }: { candidate: Candidate }) {
  const source = essayWordSource(candidate)
  if (source === null) return null
  const words = countWords(source)
  const meetsMin = words >= MIN_ESSAY_WORDS
  return (
    <div className={`checkrow-note ${meetsMin ? 'wordcount-ok' : 'wordcount-warn'}`}>
      {words} words {meetsMin ? `· meets ${MIN_ESSAY_WORDS}-word minimum` : `· below ${MIN_ESSAY_WORDS}-word minimum`}
    </div>
  )
}

function EssayWordCount({ candidate }: { candidate: Candidate }) {
  const source = essayWordSource(candidate)
  if (source === null) {
    return <div className="doc-flag-annot doc-flag-inline"><Icon name="clock" size={14} /><span>Word count pending — re-upload the essay to compute it</span></div>
  }
  const words = countWords(source)
  const meetsMin = words >= MIN_ESSAY_WORDS
  return (
    <div className={`doc-flag-annot doc-flag-inline ${meetsMin ? 'doc-flag-ok' : ''}`}>
      <Icon name={meetsMin ? 'check' : 'warn'} size={14} />
      <span>{words} words {meetsMin ? `· meets ${MIN_ESSAY_WORDS}-word minimum` : `· below ${MIN_ESSAY_WORDS}-word minimum`}</span>
    </div>
  )
}

function SponsorCard({ role, brother, hasApplication, onReadLetter, onShowLetterText }: { role: string; brother: Brother; hasApplication: boolean; onReadLetter: () => void; onShowLetterText: () => void }) {
  const initials = brother.name.split(' ').filter((w) => w.length > 1 && !w.endsWith('.')).slice(-2).map((w) => w[0]).join('')
  const state = hasApplication ? 'valid' : 'missing'
  const words = countWords(brother.letter)
  const meetsMin = words >= MIN_ESSAY_WORDS
  return (
    <div className={`sponsor-card sponsor-card-${state}`}>
      <div className="sponsor-card-head">
        <Avatar initials={initials || 'AB'} size={44} />
        <div className="sponsor-card-info">
          <div className="sponsor-role">{role}</div>
          <div className="sponsor-name">{brother.name}</div>
          <div className="sponsor-meta">{brother.chapter} · {brother.role}</div>
        </div>
      </div>
      <div className="sponsor-contact">
        <div className="sponsor-contact-item"><Icon name="mail" size={11} /> {brother.email || '—'}</div>
        <div className="sponsor-contact-item"><Icon name="user" size={11} /> {brother.phone || '—'}</div>
      </div>
      <div className={`sponsor-letter sponsor-letter-${state}`}>
        <div className="sponsor-letter-icon">{state === 'valid' ? <Icon name="check" size={14} /> : <Icon name="warn" size={14} />}</div>
        <div className="sponsor-letter-main">
          <div className="sponsor-letter-title">{role === 'Sponsor' ? 'Letter of Sponsorship' : 'Letter of Recommendation'}</div>
          <div className="sponsor-letter-sub">
            {state === 'valid' ? <>Embedded in <b>{brother.letterLocation || 'Application PDF'}</b></> : 'Application PDF not yet uploaded — letter cannot be surfaced'}
          </div>
          {brother.letter && (
            <div className={`sponsor-letter-wordcount ${meetsMin ? 'wordcount-ok' : 'wordcount-warn'}`}>
              {words} words {meetsMin ? `· meets ${MIN_ESSAY_WORDS}-word minimum` : `· below ${MIN_ESSAY_WORDS}-word minimum`}
            </div>
          )}
        </div>
        {state === 'valid' && brother.letter && (
          <button className="sponsor-letter-btn sponsor-letter-btn-alt" onClick={onShowLetterText}>Preview <Icon name="chevron-right" size={12} /></button>
        )}
        <button className="sponsor-letter-btn" onClick={onReadLetter} disabled={!hasApplication}>Open in App <Icon name="chevron-right" size={12} /></button>
      </div>
    </div>
  )
}

function LetterTextOverlay({ role, brother, onClose }: { role: string; brother: Brother; onClose: () => void }) {
  const words = countWords(brother.letter)
  const meetsMin = words >= MIN_ESSAY_WORDS
  return (
    <div className="letter-overlay-backdrop" onClick={onClose}>
      <div className="letter-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="letter-overlay-head">
          <div>
            <div className="letter-overlay-eyebrow">Parsed from Application · Section: {role}</div>
            <div className="letter-overlay-title">{role === 'Sponsor' ? 'Letter of Sponsorship' : 'Letter of Recommendation'}</div>
            <div className="letter-overlay-sub">{brother.name} · {brother.chapter} · {brother.role}</div>
            <div className={`letter-overlay-wordcount ${meetsMin ? 'wordcount-ok' : 'wordcount-warn'}`}>
              {words} words {meetsMin ? `· meets ${MIN_ESSAY_WORDS}-word minimum` : `· below ${MIN_ESSAY_WORDS}-word minimum`}
            </div>
          </div>
          <button className="letter-overlay-close" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="letter-overlay-body">
          {(brother.letter || '').split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="letter-overlay-foot">
          <span>Extracted from Application PDF · {brother.letterLocation}</span>
          <button className="btn-secondary sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function WorkflowTimeline({ candidate, onToggleFees, togglingFees }: { candidate: Candidate; onToggleFees: (paid: boolean) => void; togglingFees: boolean }) {
  const { reference } = useApp()
  const steps = reference?.workflowSteps || []
  const wf = candidate.workflow || {}
  const doneCount = steps.filter((s) => wf[s.key]?.done).length
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0

  return (
    <div className="workflow-panel">
      <div className="workflow-head">
        <div>
          <div className="workflow-eyebrow">Application Workflow · {candidate.term || 'Current Cycle'}</div>
          <div className="workflow-title">
            {doneCount}/{steps.length} steps complete
            {candidate.ddrvpDecision && (
              <span className={`workflow-decision workflow-decision-${candidate.ddrvpDecision.startsWith('approved') ? 'ok' : 'warn'}`}>
                {candidate.ddrvpDecision === 'approved-pending-fees' ? 'Approved · Pending Fees' : candidate.ddrvpDecision === 'approved' ? 'Approved' : candidate.ddrvpDecision === 'rejected' ? 'Rejected' : 'In Review'}
              </span>
            )}
          </div>
          {candidate.ddrvpComment && (
            <div className="workflow-comment"><b>DD/RVP:</b> {candidate.ddrvpComment}{candidate.ddrvpBy && <span className="workflow-comment-by"> — {candidate.ddrvpBy}</span>}</div>
          )}
        </div>
        <div className="workflow-progress">
          <div className="workflow-progress-bar"><div className="workflow-progress-fill" style={{ width: pct + '%' }} /></div>
          <div className="workflow-progress-pct">{pct}%</div>
        </div>
      </div>
      <div className="workflow-steps">
        {steps.map((step) => {
          const s = wf[step.key] || { done: false }
          return (
            <div key={step.key} className={`wf-step ${s.done ? 'wf-step-done' : 'wf-step-todo'}`}>
              <div className="wf-step-check">{s.done ? <Icon name="check" size={11} /> : <span className="wf-step-empty" />}</div>
              <div className="wf-step-body">
                <div className="wf-step-label">{step.label}</div>
                {s.value && <div className="wf-step-value">{s.value}</div>}
                {step.key === 'membershipFees' && (
                  <FeesToggle paid={s.done} busy={togglingFees} onToggle={onToggleFees} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FeesToggle({ paid, busy, onToggle }: { paid: boolean; busy: boolean; onToggle: (paid: boolean) => void }) {
  return (
    <div className="fees-toggle" onClick={(e) => e.stopPropagation()}>
      <button
        className={`fees-toggle-btn ${!paid ? 'fees-toggle-btn-active' : ''}`}
        disabled={busy || !paid}
        onClick={() => onToggle(false)}
      >
        Unpaid
      </button>
      <button
        className={`fees-toggle-btn ${paid ? 'fees-toggle-btn-active' : ''}`}
        disabled={busy || paid}
        onClick={() => onToggle(true)}
      >
        Paid
      </button>
    </div>
  )
}
