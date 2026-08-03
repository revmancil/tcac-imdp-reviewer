import React, { useState } from 'react'
import { Icon } from './Brand'
import { useApp } from '../context'

// Forced password-change gate. Shown whenever the signed-in officer's
// mustChangePassword flag is set (first login after admin reset / bootstrap
// seed). Reuses the "letter-overlay" modal chrome already styled for the
// sponsor/recommender letter viewer (see Detail.tsx) so no new visual
// language is introduced.
export default function ChangePasswordModal({ onDismiss }: { onDismiss?: () => void }) {
  const { changePassword } = useApp()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 10) {
      setError('New password must be at least 10 characters.')
      return
    }
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
    } catch (err: any) {
      setError(err.message || 'Could not change password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="letter-overlay-backdrop">
      <div className="letter-overlay" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="letter-overlay-head">
          <div>
            <div className="letter-overlay-eyebrow">Required Before Continuing</div>
            <div className="letter-overlay-title">Set a New Password</div>
            <div className="letter-overlay-sub">Your temporary password must be changed before you can use the intake tool.</div>
          </div>
          {onDismiss && (
            <button className="letter-overlay-close" onClick={onDismiss} aria-label="Close"><Icon name="x" size={16} /></button>
          )}
        </div>
        <form className="letter-overlay-body signin-form" onSubmit={handleSubmit}>
          <div className="signin-field">
            <label className="signin-label">Temporary / Current Password</label>
            <input
              className="signin-input"
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setError('') }}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <div className="signin-field">
            <label className="signin-label">New Password</label>
            <input
              className="signin-input"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError('') }}
              placeholder="At least 10 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="signin-field">
            <label className="signin-label">Confirm New Password</label>
            <input
              className="signin-input"
              type="password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError('') }}
              autoComplete="new-password"
            />
          </div>
          {error && <div className="signin-error">{error}</div>}
          <button type="submit" className="btn-primary full" disabled={busy}>
            {busy ? 'Saving…' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
