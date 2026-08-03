import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, ShieldMark } from '../components/Brand'
import { useApp } from '../context'
import type { OfficerPublic } from '../../shared/types'

export default function SignIn() {
  const { reference, signIn, quickSignIn } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const officers = reference?.officers || []
  const districtOfficers = officers.filter((o) => o.tier === 'district')
  const areaOfficers = officers.filter((o) => o.tier === 'area')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email)
      navigate('/roster')
    } catch (err: any) {
      setError(err.message || 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const clickOfficer = async (o: OfficerPublic) => {
    setBusy(true)
    try {
      await quickSignIn(o.id)
      navigate('/roster')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="signin-page v-classic">
      <div className="signin-container">
        <div className="signin-brand">
          <ShieldMark size={80} />
          <div className="signin-brand-district">Texas Council of<br />Alpha Chapters</div>
          <div className="signin-brand-org">ALPHA PHI ALPHA</div>
          <div className="signin-brand-org">FRATERNITY, INC.</div>
          <div className="signin-brand-founded">Founded 1906 · Cornell University</div>
          <div className="signin-brand-motto">"First of All, Servants of All, We Shall Transcend All."</div>
          <div className="signin-brand-tool">
            <div className="signin-brand-tool-title">Intake Membership Review</div>
            <div className="signin-brand-tool-sub">Cycle 2026 · Southwestern Region</div>
          </div>
        </div>

        <div className="signin-form-panel">
          <div className="signin-header">
            <div className="signin-eyebrow">Officer Sign-In</div>
            <h1 className="signin-title">Welcome, Brother</h1>
            <div className="signin-sub">Sign in with your TCAC officer credentials to access the intake review tool.</div>
          </div>

          <form className="signin-form" onSubmit={handleSubmit}>
            <div className="signin-field">
              <label className="signin-label">Officer Email</label>
              <input
                className="signin-input"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="lastname@apa-texas.org"
                autoComplete="email"
              />
            </div>
            <div className="signin-field">
              <label className="signin-label">
                Password
                <a href="#" className="signin-forgot" onClick={(e) => e.preventDefault()}>Forgot?</a>
              </label>
              <input
                className="signin-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && <div className="signin-error">{error}</div>}
            <button type="submit" className="btn-primary signin-submit" disabled={busy}>
              Sign In
            </button>
            <div className="signin-sso">
              <div className="signin-sso-divider"><span>or</span></div>
              <button type="button" className="btn-secondary signin-sso-btn" disabled>
                Sign in with Alpha Member Portal
              </button>
            </div>
          </form>

          <div className="signin-directory">
            <div className="signin-directory-title">TCAC Intake Committee</div>
            <div className="signin-directory-sub">Click any officer below to sign in as them (prototype demonstration).</div>

            <div className="signin-tier-label">District Officers · All Areas</div>
            <div className="signin-officer-list">
              {districtOfficers.map((o) => (
                <OfficerCard key={o.id} officer={o} onClick={() => clickOfficer(o)} />
              ))}
            </div>

            <div className="signin-tier-label">Area Directors · Scoped by Area</div>
            <div className="signin-officer-list">
              {areaOfficers.map((o) => (
                <OfficerCard key={o.id} officer={o} onClick={() => clickOfficer(o)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OfficerCard({ officer, onClick }: { officer: OfficerPublic; onClick: () => void }) {
  return (
    <button className={`officer-card officer-card-${officer.tier}`} onClick={onClick} type="button">
      <Avatar initials={officer.initials} size={36} />
      <div className="officer-card-body">
        <div className="officer-card-name">{officer.name}</div>
        <div className="officer-card-title">
          {officer.title}
          {officer.area && <span className="officer-card-area"> · Area {officer.area}</span>}
        </div>
      </div>
      <div className="officer-card-scope">{officer.scope === 'all' ? 'All Areas' : `Area ${officer.area}`}</div>
    </button>
  )
}
