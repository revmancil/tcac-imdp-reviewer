import React, { useEffect, useState } from 'react'
import { Avatar, Icon, ShieldMark } from '../components/Brand'
import { api } from '../api'
import type { AdminOfficerRow } from '../../shared/types'

// District-tier-only screen (District Director / Chief Dean of Membership
// Intake / Chief Administrator) for issuing one-time temporary passwords.
// There's no email/SSO service wired up, so the admin relays the generated
// temp password to the officer directly (phone/text/in person); the officer
// is forced to change it on next sign-in (see ChangePasswordModal).
export default function Admin() {
  const [rows, setRows] = useState<AdminOfficerRow[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ officerId: string; email: string; tempPassword: string } | null>(null)

  const load = () => {
    api.adminListOfficers().then((r) => setRows(r.rows)).catch((e) => setError(e.message))
  }
  useEffect(() => { load() }, [])

  const reset = async (officerId: string) => {
    setBusyId(officerId)
    setError('')
    try {
      const res = await api.adminResetPassword(officerId)
      setIssued(res)
      load()
    } catch (e: any) {
      setError(e.message || 'Could not reset password.')
    } finally {
      setBusyId(null)
    }
  }

  if (!rows) return <div className="app-loading">Loading officer access…</div>

  return (
    <div className="roster v-classic">
      <header className="banner-classic">
        <div className="banner-inner">
          <div className="banner-left">
            <ShieldMark size={56} />
            <div>
              <div className="eyebrow">TCAC · District Administration</div>
              <h1 className="banner-title">Officer Access</h1>
              <div className="banner-sub">Issue one-time temporary passwords for officers who are locked out or new to the roster.</div>
            </div>
          </div>
        </div>
        <div className="banner-rule" />
      </header>

      {error && <div className="signin-error">{error}</div>}

      {issued && (
        <div className="scope-banner" style={{ alignItems: 'flex-start' }}>
          <Icon name="check" size={14} />
          <span>
            Temporary password issued for <b>{issued.officerId}</b> ({issued.email}): {' '}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", background: '#0E0E0E', color: '#EBC66A', padding: '2px 8px', borderRadius: 2 }}>
              {issued.tempPassword}
            </code>{' '}
            — relay this to the officer directly (phone/text/in person). They'll be required to set a new password on next sign-in.
            <button className="letter-overlay-close" style={{ marginLeft: 12, width: 22, height: 22 }} onClick={() => setIssued(null)} aria-label="Dismiss">
              <Icon name="x" size={12} />
            </button>
          </span>
        </div>
      )}

      <div className="table-wrap">
        <table className="roster-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Officer</th>
              <th>Login Email</th>
              <th style={{ width: 140 }}>Status</th>
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const locked = row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now()
              return (
                <tr key={row.officer.id} className="row">
                  <td><Avatar initials={row.officer.initials} size={32} /></td>
                  <td>
                    <div className="cand-name">{row.officer.name}</div>
                    <div className="cand-id">
                      {row.officer.title}{row.officer.area ? ` · Area ${row.officer.area}` : ''}
                    </div>
                  </td>
                  <td className="submitted">{row.email || '—'}</td>
                  <td>
                    {!row.hasCredential && <span className="check-flag"><Icon name="warn" size={12} /> No credential</span>}
                    {row.hasCredential && locked && <span className="check-flag"><Icon name="warn" size={12} /> Locked ({row.failedAttempts} attempts)</span>}
                    {row.hasCredential && !locked && row.mustChangePassword && <span className="check-flag"><Icon name="clock" size={12} /> Must change password</span>}
                    {row.hasCredential && !locked && !row.mustChangePassword && <span className="check-ok"><Icon name="check" size={12} /> Active</span>}
                  </td>
                  <td>
                    <button
                      className="btn-secondary sm"
                      disabled={busyId === row.officer.id || !row.email}
                      onClick={() => reset(row.officer.id)}
                    >
                      {row.hasCredential ? 'Reset Password' : 'Issue Password'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="roster-footer">
        {rows.length} officers in the TCAC directory · Only District Director, Chief Dean of Membership Intake, and Chief Administrator can access this screen.
      </div>
    </div>
  )
}
