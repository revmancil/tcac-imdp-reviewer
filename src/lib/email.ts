// Transactional email via Resend's REST API. No SDK dependency -- this is a
// single POST, so a plain fetch call matches how the rest of this codebase
// avoids heavy client libraries for simple HTTP calls.
//
// Best-effort by design: a failed/unconfigured send is logged and swallowed
// rather than thrown. Nothing that triggers an email (a password reset, a
// status change) should ever fail *because* the email didn't go out -- the
// underlying action already succeeded in the database by the time we try to
// notify anyone about it.

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error('Email not configured (RESEND_API_KEY/RESEND_FROM_EMAIL) -- skipping:', input.subject);
    return { ok: false, error: 'Email is not configured on this deployment.' };
  }
  if (input.to.length === 0) return { ok: true };

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Resend send failed:', res.status, body);
      return { ok: false, error: `Resend returned ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('Resend send threw:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const WRAP = (body: string) => `
  <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #1a1a1a; max-width: 520px;">
    ${body}
    <p style="margin-top: 24px; font-size: 12px; color: #888;">TCAC Intake Review Tool — Texas Council of Alpha Chapters</p>
  </div>
`;

export function tempPasswordEmailHtml(officerName: string, tempPassword: string): string {
  return WRAP(`
    <p>Hi ${officerName},</p>
    <p>A temporary password has been issued for your TCAC Intake Review Tool account:</p>
    <p style="font-family: monospace; font-size: 18px; background: #f4f4f4; padding: 10px 14px; border-radius: 4px; display: inline-block;">${tempPassword}</p>
    <p>You'll be asked to set a new password the first time you sign in with it.</p>
    <p>If you weren't expecting this, contact your District Administrator.</p>
  `);
}

export function statusChangeEmailHtml(candidateName: string, candidateId: string, fromLabel: string, toLabel: string, changedBy: string): string {
  return WRAP(`
    <p>Candidate <b>${candidateName}</b> (#${candidateId}) changed status:</p>
    <p style="font-size: 16px;">${fromLabel} → <b>${toLabel}</b></p>
    <p>Changed by ${changedBy}.</p>
  `);
}
