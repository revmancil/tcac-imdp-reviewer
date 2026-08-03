import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldMark } from '../components/Brand'
import { useApp } from '../context'

export default function SignIn() {
  const { signIn } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      navigate('/roster')
    } catch (err: any) {
      setError(err.message || 'Sign-in failed.')
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
                placeholder="you@apa-texas.org"
                autoComplete="email"
              />
            </div>
            <div className="signin-field">
              <label className="signin-label">Password</label>
              <input
                className="signin-input"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
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
            <div className="signin-directory-title">Lost your password?</div>
            <div className="signin-directory-sub">
              There's no self-service reset yet — ask your District Director, Chief Dean of Membership Intake, or
              Chief Administrator to issue you a one-time temporary password from the Officer Access admin screen.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
