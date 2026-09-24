import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, ShieldMark } from '../components/Brand'
import { api } from '../api'
import type { AdminOfficerRow } from '../../shared/types'

const EMPTY_NEW_OFFICER = { name: '', title: '', initials: '', tier: 'area' as 'district' | 'area', area: '', email: '' }

// District-tier-only screen (District Director / Chief Dean of Membership
// Intake / Chief Administrator) for issuing one-time temporary passwords.
// There's no email/SSO service wired up, so the admin relays the generated
// temp password to the officer directly (phone/text/in person); the officer
// is forced to change it on next sign-in (see ChangePasswordModal).
const CLEAR_ROSTER_CONFIRM_PHRASE = 'DELETE ALL CANDIDATES'

export default function Admin() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<AdminOfficerRow[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ officerId: string; email: string; tempPassword: string; emailSent: boolean } | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')
  const [clearedCount, setClearedCount] = useState<number | null>(null)

  const [areaNames, setAreaNames] = useState<Record<string, string>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [newOfficer, setNewOfficer] = useState(EMPTY_NEW_OFFICER)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null)

  const load = () => {
    api.adminListOfficers().then((r) => setRows(r.rows)).catch((e) => setError(e.message))
  }
  useEffect(() => {
    load()
    api.reference().then((r) => setAreaNames(r.district.areaNames)).catch(() => {})
  }, [])

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

  const addOfficer = async () => {
    setAddError('')
    if (!newOfficer.name.trim() || !newOfficer.title.trim() || !newOfficer.initials.trim() || !newOfficer.email.trim()) {
      setAddError('Name, title, initials, and email are all required.')
      return
    }
    if (newOfficer.tier === 'area' && !newOfficer.area) {
      setAddError('Pick an area for an area-tier officer.')
      return
    }
    setAdding(true)
    try {
      await api.adminCreateOfficer({
        name: newOfficer.name.trim(),
        title: newOfficer.title.trim(),
        initials: newOfficer.initials.trim(),
        tier: newOfficer.tier,
        area: newOfficer.area ? Number(newOfficer.area) : undefined,
        email: newOfficer.email.trim(),
      })
      setNewOfficer(EMPTY_NEW_OFFICER)
      setAddOpen(false)
      load()
    } catch (e: any) {
      setAddError(e.message || 'Could not add officer.')
    } finally {
      setAdding(false)
    }
  }

  const removeOfficer = async (officerId: string, name: string) => {
    if (!confirm(`Remove ${name} from the TCAC officer directory? They'll no longer be able to sign in. This can be undone by reactivating them.`)) return
    setRemoveBusyId(officerId)
    setError('')
    try {
      await api.adminRemoveOfficer(officerId)
      load()
    } catch (e: any) {
      setError(e.message || 'Could not remove officer.')
    } finally {
      setRemoveBusyId(null)
    }
  }

  const reactivateOfficer = async (officerId: string) => {
    setRemoveBusyId(officerId)
    setError('')
    try {
      await api.adminUpdateOfficer(officerId, { active: true })
      load()
    } catch (e: any) {
      setError(e.message || 'Could not reactivate officer.')
    } finally {
      setRemoveBusyId(null)
    }
  }

  const clearRoster = async () => {
    setClearError('')
    if (clearConfirmText !== CLEAR_ROSTER_CONFIRM_PHRASE) {
      setClearError(`Type "${CLEAR_ROSTER_CONFIRM_PHRASE}" exactly to confirm.`)
      return
    }
    setClearing(true)
    try {
      const res = await api.clearRoster(clearConfirmText)
      setClearedCount(res.cleared)
      setClearOpen(false)
      setClearConfirmText('')
    } catch (e: any) {
      setClearError(e.message || 'Could not clear the roster.')
    } finally {
      setClearing(false)
    }
  }

  if (!rows) return <div className="app-loading">Loading officer access…</div>

  return (
    <div className="roster v-classic">
      <div className="detail-crumb">
        <button className="link-btn" onClick={() => navigate('/roster')}>
          <Icon name="chevron-left" size={14} /> Back to Roster
        </button>
        <span className="crumb-sep">/</span>
        <span className="crumb-cur">Officer Access</span>
      </div>

      <header className="banner-classic">
        <div className="banner-inner">
          <div className="banner-left">
            <ShieldMark size={56} />
            <div>
              <div className="eyebrow">TCAC · District Administration</div>
              <h1 className="banner-title">Officer Access</h1>
              <div className="banner-sub">Add, remove, and issue one-time temporary passwords for TCAC officers.</div>
            </div>
          </div>
          <button className="btn-secondary sm" onClick={() => { setAddOpen((v) => !v); setAddError('') }}>
            <Icon name="plus" size={13} /> {addOpen ? 'Cancel' : 'Add Officer'}
          </button>
        </div>
        <div className="banner-rule" />
      </header>

      {error && <div className="signin-error">{error}</div>}

      {addOpen && (
        <div className="danger-zone-confirm" style={{ marginBottom: 16 }}>
          {addError && <div className="signin-error">{addError}</div>}
          <div className="add-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <input className="add-input" placeholder="Full name (e.g. Bro. John Smith)" value={newOfficer.name} onChange={(e) => setNewOfficer((f) => ({ ...f, name: e.target.value }))} />
            <input className="add-input" placeholder="Title (e.g. Assistant Area Director)" value={newOfficer.title} onChange={(e) => setNewOfficer((f) => ({ ...f, title: e.target.value }))} />
            <input className="add-input" placeholder="Initials" maxLength={3} value={newOfficer.initials} onChange={(e) => setNewOfficer((f) => ({ ...f, initials: e.target.value }))} />
            <select className="add-select" value={newOfficer.tier} onChange={(e) => setNewOfficer((f) => ({ ...f, tier: e.target.value as 'district' | 'area', area: e.target.value === 'district' ? '' : f.area }))}>
              <option value="area">Area-tier</option>
              <option value="district">District-tier</option>
            </select>
            {newOfficer.tier === 'area' && (
              <select className="add-select" value={newOfficer.area} onChange={(e) => setNewOfficer((f) => ({ ...f, area: e.target.value }))}>
                <option value="">Select area…</option>
                {Object.entries(areaNames).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            )}
            <input className="add-input" placeholder="Login email" value={newOfficer.email} onChange={(e) => setNewOfficer((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="danger-zone-confirm-row" style={{ marginTop: 10 }}>
            <button className="btn-primary sm" disabled={adding} onClick={addOfficer}>{adding ? 'Adding…' : 'Add Officer'}</button>
          </div>
        </div>
      )}

      {issued && (
        <div className="scope-banner" style={{ alignItems: 'flex-start' }}>
          <Icon name="check" size={14} />
          <span>
            Temporary password issued for <b>{issued.officerId}</b> ({issued.email}): {' '}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", background: '#0E0E0E', color: '#EBC66A', padding: '2px 8px', borderRadius: 2 }}>
              {issued.tempPassword}
            </code>{' '}
            {issued.emailSent
              ? `— also emailed to ${issued.email}.`
              : '— email could not be sent (Resend not configured or the send failed); relay this to the officer directly (phone/text/in person).'}
            {' '}They'll be required to set a new password on next sign-in.
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
              <th style={{ width: 240 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const locked = row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now()
              return (
                <tr key={row.officer.id} className="row" style={row.active ? undefined : { opacity: 0.5 }}>
                  <td><Avatar initials={row.officer.initials} size={32} /></td>
                  <td>
                    <div className="cand-name">{row.officer.name}</div>
                    <div className="cand-id">
                      {row.officer.title}{row.officer.area ? ` · Area ${row.officer.area}` : ''}
                    </div>
                  </td>
                  <td className="submitted">{row.email || '—'}</td>
                  <td>
                    {!row.active && <span className="check-flag"><Icon name="x" size={12} /> Removed</span>}
                    {row.active && !row.hasCredential && <span className="check-flag"><Icon name="warn" size={12} /> No credential</span>}
                    {row.active && row.hasCredential && locked && <span className="check-flag"><Icon name="warn" size={12} /> Locked ({row.failedAttempts} attempts)</span>}
                    {row.active && row.hasCredential && !locked && row.mustChangePassword && <span className="check-flag"><Icon name="clock" size={12} /> Must change password</span>}
                    {row.active && row.hasCredential && !locked && !row.mustChangePassword && <span className="check-ok"><Icon name="check" size={12} /> Active</span>}
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    {row.active ? (
                      <>
                        <button
                          className="btn-secondary sm"
                          disabled={busyId === row.officer.id || !row.email}
                          onClick={() => reset(row.officer.id)}
                        >
                          {row.hasCredential ? 'Reset Password' : 'Issue Password'}
                        </button>
                        <button
                          className="btn-danger sm"
                          disabled={removeBusyId === row.officer.id}
                          onClick={() => removeOfficer(row.officer.id, row.officer.name)}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-secondary sm"
                        disabled={removeBusyId === row.officer.id}
                        onClick={() => reactivateOfficer(row.officer.id)}
                      >
                        Reactivate
                      </button>
                    )}
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

      <div className="danger-zone">
        <div className="danger-zone-title"><Icon name="warn" size={14} /> Danger Zone</div>

        {clearedCount !== null && (
          <div className="scope-banner" style={{ alignItems: 'flex-start' }}>
            <Icon name="check" size={14} />
            <span>
              Cleared {clearedCount} candidate{clearedCount === 1 ? '' : 's'} from the roster.
              <button className="letter-overlay-close" style={{ marginLeft: 12, width: 22, height: 22 }} onClick={() => setClearedCount(null)} aria-label="Dismiss">
                <Icon name="x" size={12} />
              </button>
            </span>
          </div>
        )}

        {!clearOpen ? (
          <div className="danger-zone-row">
            <div>
              <div className="danger-zone-label">Clear Roster</div>
              <div className="danger-zone-desc">Permanently deletes every candidate record and their document/audit history — for starting fresh before a bulk import. This cannot be undone.</div>
            </div>
            <button className="btn-danger sm" onClick={() => { setClearOpen(true); setClearError(''); setClearConfirmText('') }}>
              <Icon name="warn" size={13} /> Clear Roster…
            </button>
          </div>
        ) : (
          <div className="danger-zone-confirm">
            <div className="danger-zone-desc">
              This permanently deletes <b>every candidate</b> and their uploaded-document history. Officer accounts and passwords are not affected. Uploaded files already in storage are not deleted.
              Type <code>{CLEAR_ROSTER_CONFIRM_PHRASE}</code> to confirm.
            </div>
            {clearError && <div className="signin-error">{clearError}</div>}
            <div className="danger-zone-confirm-row">
              <input
                className="add-input"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder={CLEAR_ROSTER_CONFIRM_PHRASE}
                autoFocus
              />
              <button className="btn-secondary sm" disabled={clearing} onClick={() => { setClearOpen(false); setClearError(''); setClearConfirmText('') }}>Cancel</button>
              <button className="btn-danger sm" disabled={clearing || clearConfirmText !== CLEAR_ROSTER_CONFIRM_PHRASE} onClick={clearRoster}>
                {clearing ? 'Clearing…' : 'Permanently Clear Roster'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
