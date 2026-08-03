// Server-only auth config. `shared/reference.ts` (OFFICERS) is bundled into
// BOTH the client and the Worker, so login emails and anything else
// credential-adjacent live here instead — this module is never imported by
// client/ code.

// Login email per officer id. Distinct per-id (not derived from surname) so
// two officers sharing a surname — e.g. `carroll` (Chief Administrator,
// district-tier) and `carroll-4041` (Assistant Area Director, area-tier) —
// never collide, which the old lastname-based `officerIdForEmail` lookup did.
//
// Real personal emails supplied by the district (2026-08-03). William Bernard
// intentionally has only one entry (`bernard`) — he holds both the
// district-wide Chief Dean seat and the Area 2 Director/Chief Dean seat under
// the same login, so there is no separate `bernard-4042` row.
export const OFFICER_EMAILS: Record<string, string> = {
  escalante: 'adrianescalante1906@gmail.com',
  bernard: 'Wbernard22@yahoo.com',
  carroll: 'revmancil@hotmail.com',

  'tanner-4041': 'Pharaoh87@tx.rr.com',
  'carroll-4041': 'icecoldrev06@outlook.com',

  'cathey-4042': 'victorcathey3@gmail.com',
  'corzine-4042': 'zine1906@yahoo.com',

  'norman-4043': 'briannorman2@yahoo.com',

  'wheaton-4044': 'james.wheaton@hotmail.com',

  'dixon-4045': 'threeddixon@hot.rr.com',

  'wooten-4046': 'kdw106@sbcglobal.net',

  'bishop-4047': 'president@drl1949.com',
  'renteria-4047': 'arenteria@humana.com',

  'neal-4048': 'fdn1906@att.net',
  'green-4048': 'dgreen_77071@yahoo.com',

  'carter-4049': 'Mradriancarter@gmail.com',

  'oliver-4050': 'wao1906@gmail.com',
  'bates-4050': 'cbates2003@gmail.com',

  'smith-4051': 'ronnies764@gmail.com',
  'love-4051': 'glovehy98@hotmail.com',
};

export function emailForOfficerId(id: string): string | null {
  return OFFICER_EMAILS[id] || null;
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 10;
