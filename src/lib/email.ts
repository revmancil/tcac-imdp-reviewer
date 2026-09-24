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

// Matches the app's own "classic" brand look (public/static/styles.css --
// same gold/ink/cream palette and the same dark banner-with-gold-rule
// treatment used on every page header), reimplemented with inline styles
// and a table-based layout since email clients don't load stylesheets or
// reliably support modern CSS. Fraunces (the app's serif) isn't safe to
// rely on in email, so headings fall back to a plain serif stack instead.
const GOLD = '#C99A3B';
const GOLD_LIGHT = '#E5C46A';
const INK = '#0E0E0E';
const CREAM = '#F5EBD6';
const CREAM_3 = '#F9F3E0';

const STATUS_TONE_COLORS: Record<string, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: '#F5EBD6', fg: '#5C4A22', bd: '#D9C79A' },
  info: { bg: '#EDE3CE', fg: '#3B3222', bd: '#C99A3B' },
  warn: { bg: '#F5E4C2', fg: '#7A4A0F', bd: '#B37516' },
  ok: { bg: '#E5EBDD', fg: '#3A4A25', bd: '#8AA365' },
  gold: { bg: '#0E0E0E', fg: '#EBC66A', bd: '#C99A3B' },
};

function statusBadge(label: string, tone: string): string {
  const c = STATUS_TONE_COLORS[tone] || STATUS_TONE_COLORS.neutral;
  return `<span style="display: inline-block; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; font-weight: bold; letter-spacing: 0.04em; text-transform: uppercase; color: ${c.fg}; background: ${c.bg}; border: 1px solid ${c.bd}; border-radius: 2px; padding: 4px 10px;">${label}</span>`;
}

function emailShell(preheader: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 24px 12px; background: ${CREAM}; font-family: Georgia, 'Times New Roman', serif;">
    <span style="display: none; max-height: 0; overflow: hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; border-collapse: collapse;">
      <tr>
        <td style="background: ${INK}; border: 1px solid ${GOLD}; border-bottom: none; padding: 22px 28px; border-radius: 2px 2px 0 0;">
          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: ${GOLD}; margin-bottom: 4px;">
            Texas Council of Alpha Chapters
          </div>
          <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; color: ${CREAM}; font-style: italic;">
            TCAC Intake Review Tool
          </div>
        </td>
      </tr>
      <tr>
        <td style="height: 3px; background: ${GOLD}; font-size: 0; line-height: 0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="background: ${CREAM_3}; border: 1px solid ${GOLD}; border-top: none; border-bottom: none; padding: 28px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #2A2620;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="background: ${INK}; border: 1px solid ${GOLD}; border-top: none; padding: 14px 28px; border-radius: 0 0 2px 2px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #A08A5A;">
          TCAC Intake Review Tool — an internal tool for TCAC officers.
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

export function tempPasswordEmailHtml(officerName: string, tempPassword: string): string {
  return emailShell(
    `Your temporary password: ${tempPassword}`,
    `
      <p style="margin: 0 0 16px;">Hi ${officerName},</p>
      <p style="margin: 0 0 16px;">A temporary password has been issued for your TCAC Intake Review Tool account:</p>
      <p style="margin: 0 0 20px;">
        <span style="display: inline-block; font-family: 'Courier New', monospace; font-size: 20px; letter-spacing: 0.06em; color: ${GOLD_LIGHT}; background: ${INK}; border: 1px solid ${GOLD}; border-radius: 2px; padding: 10px 18px;">${tempPassword}</span>
      </p>
      <p style="margin: 0 0 16px;">You'll be asked to set a new password the first time you sign in with it.</p>
      <p style="margin: 0; font-size: 13px; color: #6b5f4a;">If you weren't expecting this, contact your District Administrator.</p>
    `
  );
}

export function statusChangeEmailHtml(
  candidateName: string,
  candidateId: string,
  fromLabel: string,
  toLabel: string,
  toTone: string,
  changedBy: string
): string {
  return emailShell(
    `${candidateName} moved to ${toLabel}`,
    `
      <p style="margin: 0 0 4px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #8a7a52;">Candidate Status Update</p>
      <p style="margin: 0 0 18px; font-size: 19px; font-weight: bold; color: ${INK};">${candidateName} <span style="font-weight: normal; color: #6b5f4a;">#${candidateId}</span></p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 20px;">
        <tr>
          <td style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6b5f4a; padding-right: 12px;">${fromLabel}</td>
          <td style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6b5f4a; padding-right: 12px;">→</td>
          <td>${statusBadge(toLabel, toTone)}</td>
        </tr>
      </table>
      <p style="margin: 0; font-size: 13px; color: #6b5f4a;">Changed by ${changedBy}.</p>
    `
  );
}
