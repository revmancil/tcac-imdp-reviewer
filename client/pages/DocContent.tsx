// Mock document renderer — shown when a required doc has no real PDF file
// attached (only candidate #2897040 / Nazhir has real reference PDFs).
// Ported from the design handoff's detail.jsx DocContent()/LetterOfRec()/Field().
import React from 'react'
import type { Candidate, Chapter } from '../../shared/types'

export function Field({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={`pf ${full ? 'pf-full' : ''}`}>
      <div className="pf-label">{label}</div>
      <div className="pf-value">{value}</div>
    </div>
  )
}

export function DocContent({ docKey, candidate, chapter }: { docKey: string; candidate: Candidate; chapter: Chapter }) {
  switch (docKey) {
    case 'application':
      return (
        <div className="paper">
          <div className="paper-header">
            <div className="paper-crest">ΑΦΑ</div>
            <div>
              <div className="paper-title">ALPHA PHI ALPHA FRATERNITY, INC.</div>
              <div className="paper-sub">{chapter.type === 'alumni' ? 'General Membership Intake Application' : 'Undergraduate Membership Intake Application'}</div>
              <div className="paper-sub-2">Cycle: 2026 · Applicant ID: #{candidate.id}</div>
            </div>
          </div>
          <div className="paper-hr" />
          <div className="paper-section">SECTION I — PERSONAL INFORMATION</div>
          <div className="paper-fields">
            <Field label="Full Legal Name" value={candidate.name} />
            <Field label="Applicant ID" value={candidate.id} />
            <Field label="Home Address" value="1906 Founders Ln, Houston, TX 77004" full />
            <Field label="Phone" value="(713) 555-0106" />
            <Field label="Email" value={`${candidate.name.split(' ')[0].toLowerCase()}.${candidate.name.split(' ').slice(-1)[0].toLowerCase()}@${candidate.school.split(' ')[0].toLowerCase()}.edu`} />
            <Field label="Date of Birth" value="03 / 14 / 2004" />
          </div>
          <div className="paper-section">SECTION II — CHAPTER SELECTION</div>
          <div className="paper-fields">
            <Field label="Region" value="Southwestern" />
            <Field label="District" value="Texas" />
            <Field label="Area" value={`Area ${chapter.area} · ${chapter.city}`} />
            <Field label="Chapter Type" value={chapter.type === 'alumni' ? 'Alumni Chapter' : 'Collegiate Chapter'} />
            <Field label="Applying To" value={chapter.name + (chapter.type === 'alumni' ? ' (Alumni)' : ' (Collegiate)')} full />
          </div>
          <div className="paper-section">SECTION III — ACADEMIC STANDING</div>
          <div className="paper-fields">
            <Field label="Institution" value={candidate.school} />
            <Field label="Classification" value={candidate.classification} />
            <Field label="Major" value={candidate.major} />
            <Field label="Cumulative GPA" value={candidate.gpa.toFixed(2)} />
          </div>
          <div className="paper-section">SECTION IV — ATTESTATION</div>
          <div className="paper-attest">
            I hereby affirm that the information provided in this application is true and complete to the best of my knowledge. I understand the Aims of Alpha Phi Alpha Fraternity, Inc., and if selected, I will conduct myself in a manner befitting a candidate for membership.
          </div>
          <div className="paper-sig-row">
            <div className="sig-field">
              <div className="sig-line"><span className="sig-mark">{candidate.name.split(' ').map((w) => w[0]).join('.')}</span></div>
              <div className="sig-caption">Candidate Signature</div>
            </div>
            <div className="sig-field">
              <div className="sig-line"><span className="sig-mark date">{candidate.submitted}</span></div>
              <div className="sig-caption">Date</div>
            </div>
          </div>
        </div>
      )

    case 'transcript':
      return (
        <div className="paper">
          <div className="paper-header transcript-header">
            <div>
              <div className="paper-title">{candidate.school.toUpperCase()}</div>
              <div className="paper-sub">Office of the Registrar · Official Transcript</div>
              <div className="paper-sub-2">Issued: 2026-06-30 · Recipient: Alpha Phi Alpha Fraternity, Inc.</div>
            </div>
            <div className="official-seal">OFFICIAL</div>
          </div>
          <div className="paper-hr" />
          <div className="transcript-meta">
            <div><span>Student:</span> <b>{candidate.name}</b></div>
            <div><span>Student ID:</span> <b>{candidate.id}</b></div>
            <div><span>Program:</span> <b>{candidate.major}</b></div>
            <div><span>Classification:</span> <b>{candidate.classification}</b></div>
          </div>
          <table className="transcript-table">
            <thead><tr><th>Term</th><th>Course</th><th>Title</th><th>Cr</th><th>Grade</th></tr></thead>
            <tbody>
              <tr><td>FA24</td><td>ENG 201</td><td>Advanced Composition</td><td>3.0</td><td>A</td></tr>
              <tr><td>FA24</td><td>MTH 220</td><td>Linear Algebra</td><td>4.0</td><td>A-</td></tr>
              <tr><td>FA24</td><td>{candidate.major.slice(0, 3).toUpperCase()} 310</td><td>Core Methods</td><td>3.0</td><td>B+</td></tr>
              <tr><td>SP25</td><td>HIS 240</td><td>African American History</td><td>3.0</td><td>A</td></tr>
              <tr><td>SP25</td><td>{candidate.major.slice(0, 3).toUpperCase()} 320</td><td>Advanced Topics</td><td>3.0</td><td>{candidate.gpa < 3 ? 'B-' : 'A'}</td></tr>
              <tr><td>FA25</td><td>{candidate.major.slice(0, 3).toUpperCase()} 401</td><td>Capstone I</td><td>4.0</td><td>{candidate.gpa < 3 ? 'C+' : 'A-'}</td></tr>
            </tbody>
          </table>
          <div className="transcript-gpa">
            <div><span>Term GPA:</span> <b>{(candidate.gpa + 0.04).toFixed(2)}</b></div>
            <div><span>Cumulative GPA:</span> <b className={candidate.gpa < 2.5 ? 'gpa-flag' : ''}>{candidate.gpa.toFixed(2)}</b></div>
            <div><span>Credits Earned:</span> <b>84</b></div>
          </div>
          <div className="paper-attest small">This transcript is official when it bears the raised seal of the Registrar and is transmitted directly from the institution.</div>
        </div>
      )

    case 'voter':
      return (
        <div className="paper">
          <div className="voter-card">
            <div className="voter-header">
              <div>
                <div className="voter-state">STATE OF TEXAS</div>
                <div className="voter-sub">Voter Registration Certificate</div>
              </div>
              <div className="voter-seal">★</div>
            </div>
            <div className="voter-body">
              <Field label="Registered Voter" value={candidate.name} />
              <Field label="Date of Birth" value="03 / 14 / 2004" />
              <Field label="VUID" value={`TX-${candidate.id}-2024`} />
              <Field label="County" value="Harris County" />
              <Field label="Precinct" value="0217" />
              <Field label="Effective Date" value="2023-06-05" />
              <Field label="Status" value="ACTIVE" full />
            </div>
          </div>
        </div>
      )

    case 'medical':
      return (
        <div className="paper">
          <div className="paper-header">
            <div>
              <div className="paper-title">MEDICAL / PHYSICAL EXAMINATION FORM</div>
              <div className="paper-sub">Alpha Phi Alpha Fraternity, Inc. · Intake Requirement</div>
            </div>
          </div>
          <div className="paper-hr" />
          <div className="paper-fields">
            <Field label="Patient Name" value={candidate.name} />
            <Field label="Date of Exam" value={candidate.docs.medical.valid ? '2026-05-18' : '2025-11-04'} />
            <Field label="Physician" value="Dr. Regina Halston, MD" />
            <Field label="License #" value="TX-MD-284019" />
          </div>
          <div className="paper-section">PHYSICAL ASSESSMENT</div>
          <div className="assess-grid">
            <div className="assess-row"><span>Blood Pressure</span><b>118 / 76 mmHg</b></div>
            <div className="assess-row"><span>Heart Rate</span><b>68 bpm</b></div>
            <div className="assess-row"><span>Respiratory</span><b>Normal</b></div>
            <div className="assess-row"><span>Vision</span><b>20/20</b></div>
            <div className="assess-row"><span>General Health</span><b>Excellent</b></div>
            <div className="assess-row"><span>Cleared for Program</span><b>YES</b></div>
          </div>
          <div className="paper-sig-row">
            <div className="sig-field">
              <div className="sig-line"><span className="sig-mark">R. Halston, MD</span></div>
              <div className="sig-caption">Physician Signature</div>
            </div>
            <div className="sig-field">
              <div className="sig-line"><span className="sig-mark date">{candidate.docs.medical.valid ? '2026-05-18' : '2025-11-04'}</span></div>
              <div className="sig-caption">Date</div>
            </div>
          </div>
        </div>
      )

    case 'resume':
      return (
        <div className="paper resume">
          <div className="resume-name">{candidate.name.toUpperCase()}</div>
          <div className="resume-contact">{candidate.name.split(' ')[0].toLowerCase()}@{candidate.school.split(' ')[0].toLowerCase()}.edu · (713) 555-0106</div>
          <div className="resume-hr" />
          <div className="resume-section">EDUCATION</div>
          <div className="resume-item">
            <div className="resume-item-head"><b>{candidate.school}</b> <span>2022 — Expected 2026</span></div>
            <div>B.A. / B.S. in {candidate.major} · GPA: {candidate.gpa.toFixed(2)}</div>
            <div className="resume-bul">• Dean's List, four semesters</div>
          </div>
          <div className="resume-section">LEADERSHIP &amp; SERVICE</div>
          <div className="resume-item">
            <div className="resume-item-head"><b>Student Government Association</b> <span>2024 — Present</span></div>
            <div>Chair, Community Outreach Committee</div>
            <div className="resume-bul">• Organized annual voter registration drive (620+ registrations)</div>
          </div>
        </div>
      )

    case 'essay':
      return (
        <div className="paper statement">
          <div className="statement-head">PERSONAL ESSAY</div>
          <div className="statement-sub">"Why I desire to be an Alpha man and the contributions that I would bring…"</div>
          <div className="paper-hr" />
          <p>
            My path toward Alpha Phi Alpha began long before I could articulate what the light of the Sphinx represents. It began at home, where I was taught that the measure of a man is not what he accumulates, but what he restores to others.
          </p>
          <p>
            At {candidate.school}, I have tried to live that lesson in small, disciplined ways. Through {candidate.major.toLowerCase()}, I have found the tools to examine questions that matter to my community — questions about opportunity, mobility, and how institutions either open or foreclose futures for young Black men.
          </p>
          <p>
            To seek membership in Alpha Phi Alpha is not to seek an accolade. It is to accept a discipline — to be first of all, servants of all, and to transcend the smaller versions of ourselves that comfort would allow.
          </p>
          <div className="statement-sign">— {candidate.name}</div>
        </div>
      )

    case 'covidWaiver':
      return (
        <div className="paper">
          <div className="paper-header">
            <div>
              <div className="paper-title">COVID-19 HEALTH &amp; LIABILITY WAIVER</div>
              <div className="paper-sub">Alpha Phi Alpha Fraternity, Inc. · Intake Cycle 2026</div>
            </div>
          </div>
          <div className="paper-hr" />
          <div className="paper-fields">
            <Field label="Candidate" value={candidate.name} />
            <Field label="Applicant ID" value={candidate.id} />
            <Field label="Chapter" value={chapter.name} full />
          </div>
          <div className="paper-attest">
            I acknowledge that COVID-19 is a contagious respiratory illness and that despite reasonable precautions taken by the Fraternity, participation in intake activities may involve exposure. I voluntarily assume this risk and agree to comply with all health protocols established by the chapter and district.
          </div>
          <div className="initials-block">
            <div className="init-row"><span>I have read and understand the health precautions.</span><span className="init-line">{candidate.name.split(' ').map((w) => w[0]).join('')}</span></div>
            <div className="init-row"><span>I agree to notify chapter leadership of exposure or symptoms.</span><span className="init-line">{candidate.name.split(' ').map((w) => w[0]).join('')}</span></div>
            <div className="init-row"><span>I release the Fraternity from liability associated with COVID-19.</span><span className="init-line">{candidate.name.split(' ').map((w) => w[0]).join('')}</span></div>
          </div>
          <div className="paper-sig-row">
            <div className="sig-field"><div className="sig-line"><span className="sig-mark">{candidate.name.split(' ').map((w) => w[0]).join('.')}</span></div><div className="sig-caption">Candidate Signature</div></div>
            <div className="sig-field"><div className="sig-line"><span className="sig-mark date">{candidate.submitted}</span></div><div className="sig-caption">Date</div></div>
          </div>
        </div>
      )

    case 'covidVax':
      return (
        <div className="paper">
          <div className="vax-card">
            <div className="vax-header">
              <div>
                <div className="vax-title">CDC · COVID-19 VACCINATION RECORD CARD</div>
                <div className="vax-sub">Please keep this record card, which includes medical information about the vaccines you have received.</div>
              </div>
              <div className="vax-logo">CDC</div>
            </div>
            <div className="vax-body">
              <div className="vax-name-row">
                <Field label="Last Name" value={candidate.name.split(' ').slice(-1)[0]} />
                <Field label="First Name" value={candidate.name.split(' ')[0]} />
                <Field label="MI" value={candidate.name.split(' ')[1]?.[0] || ''} />
              </div>
              <Field label="Date of Birth" value="03 / 14 / 2004" full />
              <table className="vax-table">
                <thead><tr><th>Product / Manufacturer</th><th>Lot #</th><th>Date</th><th>Clinic Site</th></tr></thead>
                <tbody>
                  <tr><td>Pfizer-BioNTech · 1st Dose</td><td>EK-9231</td><td>2021-04-08</td><td>Campus Health Ctr</td></tr>
                  <tr><td>Pfizer-BioNTech · 2nd Dose</td><td>ER-8834</td><td>2021-04-29</td><td>Campus Health Ctr</td></tr>
                  <tr><td>Pfizer · Booster</td><td>FA-2201</td><td>2022-01-15</td><td>Local Pharmacy</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )

    case 'financial':
      return (
        <div className="paper">
          <div className="paper-header">
            <div>
              <div className="paper-title">FINANCIAL COMMITMENT FORM</div>
              <div className="paper-sub">{chapter.type === 'alumni' ? 'Alumni Membership · Financial Obligations' : 'Undergraduate Intake · Financial Obligations'}</div>
            </div>
          </div>
          <div className="paper-hr" />
          <div className="paper-fields">
            <Field label="Candidate" value={candidate.name} />
            <Field label="Chapter" value={`${chapter.name} · Area ${chapter.area}`} />
          </div>
          <table className="fee-table">
            <thead><tr><th>Line Item</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>General Organization Fee</td><td>$525.00</td></tr>
              <tr><td>Southwestern Region Assessment</td><td>$185.00</td></tr>
              <tr><td>TCAC Assessment</td><td>$95.00</td></tr>
              <tr><td>Chapter Intake Fee</td><td>{chapter.type === 'alumni' ? '$550.00' : '$450.00'}</td></tr>
              <tr><td>First-Year Dues (prorated)</td><td>$240.00</td></tr>
              <tr className="fee-total"><td>Total Due Upon Selection</td><td>{chapter.type === 'alumni' ? '$1,595.00' : '$1,495.00'}</td></tr>
            </tbody>
          </table>
          <div className="paper-attest">
            I acknowledge the financial obligations above and affirm that I have the means to fulfill them by the schedule set forth by the chapter's Dean of Intake.
          </div>
          <div className="paper-sig-row">
            <div className="sig-field">
              <div className="sig-line">
                {candidate.docs.financial.valid ? (
                  <span className="sig-mark">{candidate.name.split(' ').map((w) => w[0]).join('.')}</span>
                ) : (
                  <span className="sig-mark missing">— missing signature —</span>
                )}
              </div>
              <div className="sig-caption">Candidate Signature (p. 2)</div>
            </div>
            <div className="sig-field"><div className="sig-line"><span className="sig-mark date">{candidate.submitted}</span></div><div className="sig-caption">Date</div></div>
          </div>
        </div>
      )

    case 'headshot':
      return (
        <div className="paper headshot-page">
          <div className="headshot-frame">
            <div className="headshot-placeholder">
              <div className="hs-initials">{candidate.initials}</div>
              <div className="hs-caption">Professional headshot on file</div>
              <div className="hs-meta">1200 × 1500 px · JPEG · {candidate.submitted}</div>
            </div>
          </div>
        </div>
      )

    case 'nda':
      return (
        <div className="paper">
          <div className="paper-header">
            <div className="paper-crest">ΑΦΑ</div>
            <div>
              <div className="paper-title">NON-DISCLOSURE AGREEMENT</div>
              <div className="paper-sub">Alpha Phi Alpha Fraternity, Inc. · Intake Confidentiality</div>
              <div className="paper-sub-2">Cycle 2026 · Applicant ID: #{candidate.id}</div>
            </div>
          </div>
          <div className="paper-hr" />
          <div className="paper-attest">
            This Non-Disclosure Agreement ("Agreement") is entered into between the undersigned candidate and Alpha Phi Alpha Fraternity, Inc. ("the Fraternity") in connection with the candidate's participation in the Membership Intake Process.
          </div>
          <div className="paper-section">1. CONFIDENTIAL INFORMATION</div>
          <div className="nda-clause">
            Candidate acknowledges that during the intake process, they may be exposed to proprietary information including, but not limited to, ritual procedures, chapter operations, financial records, membership lists, historical documents, and other confidential materials belonging to the Fraternity.
          </div>
          <div className="paper-section">2. OBLIGATIONS</div>
          <div className="nda-clause">
            Candidate agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose such information to any third party without prior written consent; (c) use such information solely for purposes of intake participation; and (d) return or destroy all Confidential Information upon request.
          </div>
          <div className="paper-section">3. TERM</div>
          <div className="nda-clause">The obligations of this Agreement shall survive the completion, withdrawal, or termination of the candidate's intake process indefinitely.</div>
          <div className="paper-section">4. ACKNOWLEDGMENT</div>
          <div className="initials-block">
            <div className="init-row"><span>I have read and understand this Agreement in its entirety.</span><span className="init-line">{candidate.name.split(' ').map((w) => w[0]).join('')}</span></div>
            <div className="init-row"><span>I understand that breach may result in immediate removal from consideration.</span><span className="init-line">{candidate.name.split(' ').map((w) => w[0]).join('')}</span></div>
            <div className="init-row"><span>I enter into this Agreement voluntarily and of my own free will.</span><span className="init-line">{candidate.name.split(' ').map((w) => w[0]).join('')}</span></div>
          </div>
          <div className="paper-sig-row">
            <div className="sig-field"><div className="sig-line"><span className="sig-mark">{candidate.name.split(' ').map((w) => w[0]).join('.')}</span></div><div className="sig-caption">Candidate Signature</div></div>
            <div className="sig-field"><div className="sig-line"><span className="sig-mark date">{candidate.submitted}</span></div><div className="sig-caption">Date</div></div>
          </div>
          <div className="paper-sig-row" style={{ marginTop: 10 }}>
            <div className="sig-field"><div className="sig-line"><span className="sig-mark">C. Freeman</span></div><div className="sig-caption">District DoM · Witness</div></div>
            <div className="sig-field"><div className="sig-line"><span className="sig-mark date">{candidate.submitted}</span></div><div className="sig-caption">Date</div></div>
          </div>
        </div>
      )

    default:
      return <div className="paper">Document preview unavailable.</div>
  }
}
