// Server-only auth config. `shared/reference.ts` (OFFICERS) is bundled into
// BOTH the client and the Worker, so login emails and anything else
// credential-adjacent live here instead — this module is never imported by
// client/ code.

// Login email per officer id. Distinct per-id (not derived from surname) so
// two officers sharing a surname — e.g. `carroll` (Chief Administrator,
// district-tier) and `carroll-4041` (Assistant Area Director, area-tier) —
// never collide, which the old lastname-based `officerIdForEmail` lookup did.
export const OFFICER_EMAILS: Record<string, string> = {
  escalante: 'escalante@apa-texas.org',
  bernard: 'bernard@apa-texas.org',
  carroll: 'carroll@apa-texas.org',
  'tanner-4041': 'tanner@apa-texas.org',
  'carroll-4041': 'mcarroll@apa-texas.org',
  'ad-4042': 'ad-4042@apa-texas.org',
  'ad-4043': 'ad-4043@apa-texas.org',
  'ad-4044': 'ad-4044@apa-texas.org',
  'ad-4045': 'ad-4045@apa-texas.org',
  'ad-4046': 'ad-4046@apa-texas.org',
  'ad-4047': 'ad-4047@apa-texas.org',
  'ad-4048': 'ad-4048@apa-texas.org',
  'ad-4049': 'ad-4049@apa-texas.org',
  'ad-4050': 'ad-4050@apa-texas.org',
  'ad-4051': 'ad-4051@apa-texas.org',
};

export function emailForOfficerId(id: string): string | null {
  return OFFICER_EMAILS[id] || null;
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 10;
