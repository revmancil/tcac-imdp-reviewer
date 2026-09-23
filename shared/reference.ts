// Reference data for the TCAC (Texas Council of Alpha Chapters) Intake Review Tool.
// Ported from the design handoff's data.jsx — chapters, officers, district,
// required docs, workflow steps, and the status enum. This is data that
// rarely changes and is loaded once by the client (see README.md).

import type {
  Chapter,
  ChapterType,
  OfficerPublic,
  RequiredDocDef,
  StatusDef,
  StatusKey,
  WorkflowStepDef,
} from './types.js';

export const REQUIRED_DOCS: RequiredDocDef[] = [
  { key: 'application', label: 'Membership Application', short: 'Application', pages: 6 },
  { key: 'essay', label: 'Candidate Essay', short: 'Essay', pages: 3 },
  { key: 'resume', label: 'Candidate Resume', short: 'Resume', pages: 2 },
  { key: 'transcript', label: 'Official Transcript', short: 'Transcript', pages: 3 },
  { key: 'enrollmentLetter', label: 'Enrollment / Academic Standing Letter', short: 'Enrollment', pages: 1, collegiateOnly: true },
  { key: 'medical', label: 'Medical Release', short: 'Medical', pages: 2 },
  { key: 'voter', label: 'Voter Registration', short: 'Voter', pages: 1 },
  { key: 'financial', label: 'Financial Commitment Form', short: 'Financial', pages: 2 },
  { key: 'nda', label: 'Non-Disclosure Agreement', short: 'NDA', pages: 2 },
  { key: 'headshot', label: 'Headshot', short: 'Photo', pages: 1 },
];

// Filters the master document list down to what actually applies to a given
// candidate's chapter type -- e.g. the enrollment letter only makes sense
// for active students, not alumni. Use this everywhere a checklist, viewer,
// or completeness count needs "the docs THIS candidate needs," rather than
// iterating REQUIRED_DOCS directly.
export function requiredDocsFor(chapterType: ChapterType): RequiredDocDef[] {
  return REQUIRED_DOCS.filter((d) => !d.collegiateOnly || chapterType === 'collegiate');
}

export const WORKFLOW_STEPS: WorkflowStepDef[] = [
  { key: 'pretest', label: 'Pretest 100%' },
  { key: 'appSubmitted', label: 'Application Submitted' },
  { key: 'backgroundCheck', label: 'Background Check' },
  { key: 'membershipFees', label: 'Membership Fees' },
  { key: 'ddApproval', label: 'DD/RVP Approval' },
  { key: 'hqApproval', label: 'HQ Approval' },
  { key: 'sponsorAssigned', label: 'Sponsor Assigned' },
  { key: 'recommenderAssigned', label: 'Recommender Assigned' },
  { key: 'essayReceived', label: 'Essay Submitted' },
  { key: 'resumeReceived', label: 'Candidate Resume Uploaded' },
  { key: 'medicalReceived', label: 'Medical Release Uploaded' },
  { key: 'voterReceived', label: 'Voter Registration Uploaded' },
  { key: 'transcriptReceived', label: 'University Documents Received' },
];

export const STATUS: Record<string, StatusDef> = {
  RECEIVED: { key: 'received', label: 'Received', tone: 'neutral' },
  REVIEW: { key: 'review', label: 'Under Review', tone: 'info' },
  MISSING: { key: 'missing', label: 'Missing Docs', tone: 'warn' },
  COMPLETE: { key: 'complete', label: 'Complete', tone: 'ok' },
  CLEARED: { key: 'cleared', label: 'Cleared for Intake', tone: 'gold' },
};

export const STATUS_LIST: StatusDef[] = Object.values(STATUS);

export function statusByKey(key: StatusKey): StatusDef {
  return STATUS_LIST.find((s) => s.key === key) || STATUS.RECEIVED;
}

export const CHAPTERS: Record<string, Chapter> = {
  'alpha-sigma': { key: 'alpha-sigma', name: 'Alpha Sigma', type: 'collegiate', school: 'Wiley College', area: 4043, city: 'Marshall' },
  'delta': { key: 'delta', name: 'Delta', type: 'collegiate', school: 'Huston-Tillotson University', area: 4046, city: 'Austin' },
  'delta-theta': { key: 'delta-theta', name: 'Delta Theta', type: 'collegiate', school: 'Texas Southern University', area: 4048, city: 'Houston' },
  'epsilon-iota': { key: 'epsilon-iota', name: 'Epsilon Iota', type: 'collegiate', school: 'University of Texas at Austin', area: 4046, city: 'Austin' },
  'epsilon-rho': { key: 'epsilon-rho', name: 'Epsilon Rho', type: 'collegiate', school: 'Lamar University', area: 4050, city: 'Beaumont' },
  'epsilon-sigma': { key: 'epsilon-sigma', name: 'Epsilon Sigma', type: 'collegiate', school: 'University of Texas at San Antonio', area: 4047, city: 'San Antonio', inactive: true },
  'eta-epsilon': { key: 'eta-epsilon', name: 'Eta Epsilon', type: 'collegiate', school: 'University of North Texas', area: 4041, city: 'Denton' },
  'eta-gamma': { key: 'eta-gamma', name: 'Eta Gamma', type: 'collegiate', school: 'Prairie View A&M University', area: 4049, city: 'Prairie View' },
  'eta-mu': { key: 'eta-mu', name: 'Eta Mu', type: 'collegiate', school: 'University of Houston', area: 4048, city: 'Houston' },
  'eta-psi': { key: 'eta-psi', name: 'Eta Psi', type: 'collegiate', school: 'Texas Christian University', area: 4042, city: 'Fort Worth', inactive: true },
  'eta-upsilon': { key: 'eta-upsilon', name: 'Eta Upsilon', type: 'collegiate', school: 'Texas Tech University', area: 4051, city: 'Lubbock' },
  'gamma-alpha': { key: 'gamma-alpha', name: 'Gamma Alpha', type: 'collegiate', school: 'Texas College', area: 4043, city: 'Tyler', inactive: true },
  'iota-kappa': { key: 'iota-kappa', name: 'Iota Kappa', type: 'collegiate', school: 'Paul Quinn College', area: 4041, city: 'Dallas' },
  'iota-mu': { key: 'iota-mu', name: 'Iota Mu', type: 'collegiate', school: 'Stephen F. Austin State University', area: 4043, city: 'Nacogdoches' },
  'mu-nu': { key: 'mu-nu', name: 'Mu Nu', type: 'collegiate', school: 'Texas State University', area: 4046, city: 'San Marcos' },
  'pi-omicron': { key: 'pi-omicron', name: 'Pi Omicron', type: 'collegiate', school: 'Texas A&M University', area: 4049, city: 'College Station' },
  'sigma-epsilon': { key: 'sigma-epsilon', name: 'Sigma Epsilon', type: 'collegiate', school: 'Tarleton State University', area: 4042, city: 'Stephenville' },
  'tau-alpha': { key: 'tau-alpha', name: 'Tau Alpha', type: 'collegiate', school: 'Baylor University', area: 4045, city: 'Waco' },
  'tau-tau': { key: 'tau-tau', name: 'Tau Tau', type: 'collegiate', school: 'Houston Christian University', area: 4050, city: 'Houston' },
  'tau-xi': { key: 'tau-xi', name: 'Tau Xi', type: 'collegiate', school: 'University of Texas at Dallas', area: 4041, city: 'Richardson', inactive: true },
  'theta-alpha': { key: 'theta-alpha', name: 'Theta Alpha', type: 'collegiate', school: 'Jarvis Christian College', area: 4043, city: 'Hawkins', inactive: true },
  'theta-mu': { key: 'theta-mu', name: 'Theta Mu', type: 'collegiate', school: 'Sam Houston State University', area: 4050, city: 'Huntsville' },
  'upsilon-mu': { key: 'upsilon-mu', name: 'Upsilon Mu', type: 'collegiate', school: 'Southern Methodist University', area: 4041, city: 'Dallas' },
  'zeta-chi': { key: 'zeta-chi', name: 'Zeta Chi', type: 'collegiate', school: 'University of Texas at Arlington', area: 4042, city: 'Arlington' },
  'zeta-tau': { key: 'zeta-tau', name: 'Zeta Tau', type: 'collegiate', school: 'Texas A&M University-Commerce', area: 4041, city: 'Commerce' },

  'alpha-eta-lambda': { key: 'alpha-eta-lambda', name: 'Alpha Eta Lambda', type: 'alumni', school: null, area: 4048, city: 'Houston' },
  'alpha-sigma-lambda': { key: 'alpha-sigma-lambda', name: 'Alpha Sigma Lambda', type: 'alumni', school: null, area: 4041, city: 'Dallas' },
  'beta-tau-lambda': { key: 'beta-tau-lambda', name: 'Beta Tau Lambda', type: 'alumni', school: null, area: 4042, city: 'Fort Worth' },
  'delta-rho-lambda': { key: 'delta-rho-lambda', name: 'Delta Rho Lambda', type: 'alumni', school: null, area: 4047, city: 'San Antonio' },
  'epsilon-epsilon-lambda': { key: 'epsilon-epsilon-lambda', name: 'Epsilon Epsilon Lambda', type: 'alumni', school: null, area: 4045, city: 'Waco' },
  'epsilon-phi-lambda': { key: 'epsilon-phi-lambda', name: 'Epsilon Phi Lambda', type: 'alumni', school: null, area: 4042, city: 'Grapevine' },
  'epsilon-tau-lambda': { key: 'epsilon-tau-lambda', name: 'Epsilon Tau Lambda', type: 'alumni', school: null, area: 4049, city: 'Prairie View' },
  'gamma-eta-lambda': { key: 'gamma-eta-lambda', name: 'Gamma Eta Lambda', type: 'alumni', school: null, area: 4046, city: 'Austin' },
  'gamma-pi-lambda': { key: 'gamma-pi-lambda', name: 'Gamma Pi Lambda', type: 'alumni', school: null, area: 4048, city: 'Galveston' },
  'gamma-tau-lambda': { key: 'gamma-tau-lambda', name: 'Gamma Tau Lambda', type: 'alumni', school: null, area: 4050, city: 'Port Arthur' },
  'gamma-upsilon-lambda': { key: 'gamma-upsilon-lambda', name: 'Gamma Upsilon Lambda', type: 'alumni', school: null, area: 4041, city: 'Desoto' },
  'kappa-sigma-lambda': { key: 'kappa-sigma-lambda', name: 'Kappa Sigma Lambda', type: 'alumni', school: null, area: 4045, city: 'Killeen' },
  'mu-rho-lambda': { key: 'mu-rho-lambda', name: 'Mu Rho Lambda', type: 'alumni', school: null, area: 4043, city: 'Longview' },
  'nu-pi-lambda': { key: 'nu-pi-lambda', name: 'Nu Pi Lambda', type: 'alumni', school: null, area: 4042, city: 'Arlington' },
  'nu-sigma-lambda': { key: 'nu-sigma-lambda', name: 'Nu Sigma Lambda', type: 'alumni', school: null, area: 4043, city: 'Tyler' },
  'omicron-epsilon-lambda': { key: 'omicron-epsilon-lambda', name: 'Omicron Epsilon Lambda', type: 'alumni', school: null, area: 4051, city: 'Amarillo' },
  'pi-alpha-lambda': { key: 'pi-alpha-lambda', name: 'Pi Alpha Lambda', type: 'alumni', school: null, area: 4049, city: 'College Station' },
  'pi-theta-lambda': { key: 'pi-theta-lambda', name: 'Pi Theta Lambda', type: 'alumni', school: null, area: 4047, city: 'San Antonio' },
  'rho-nu-lambda': { key: 'rho-nu-lambda', name: 'Rho Nu Lambda', type: 'alumni', school: null, area: 4041, city: 'Carrollton' },
  'sigma-gamma-lambda': { key: 'sigma-gamma-lambda', name: 'Sigma Gamma Lambda', type: 'alumni', school: null, area: 4050, city: 'Cypress' },
  'tau-omicron-lambda': { key: 'tau-omicron-lambda', name: 'Tau Omicron Lambda', type: 'alumni', school: null, area: 4048, city: 'Rosharon' },
  'tau-pi-lambda': { key: 'tau-pi-lambda', name: 'Tau Pi Lambda', type: 'alumni', school: null, area: 4043, city: 'Mount Pleasant' },
  'theta-delta-lambda': { key: 'theta-delta-lambda', name: 'Theta Delta Lambda', type: 'alumni', school: null, area: 4044, city: 'El Paso' },
  'xi-eta-lambda': { key: 'xi-eta-lambda', name: 'Xi Eta Lambda', type: 'alumni', school: null, area: 4050, city: 'Houston' },
  'xi-kappa-lambda': { key: 'xi-kappa-lambda', name: 'Xi Kappa Lambda', type: 'alumni', school: null, area: 4048, city: 'Houston' },
  'xi-tau-lambda': { key: 'xi-tau-lambda', name: 'Xi Tau Lambda', type: 'alumni', school: null, area: 4041, city: 'Richardson' },
  'zeta-tau-lambda': { key: 'zeta-tau-lambda', name: 'Zeta Tau Lambda', type: 'alumni', school: null, area: 4048, city: 'League City' },
};

export const DISTRICT = {
  name: 'Texas Council of Alpha Chapters',
  region: 'Southwestern',
  areaNames: {
    '4041': 'Area 4041 · Dallas / Metroplex',
    '4042': 'Area 4042 · Fort Worth / Arlington',
    '4043': 'Area 4043 · East Texas',
    '4044': 'Area 4044 · West Texas / El Paso',
    '4045': 'Area 4045 · Central Texas / Waco',
    '4046': 'Area 4046 · Austin',
    '4047': 'Area 4047 · San Antonio',
    '4048': 'Area 4048 · Houston',
    '4049': 'Area 4049 · Prairie View / Bryan-College Station',
    '4050': 'Area 4050 · Gulf Coast / Beaumont',
    '4051': 'Area 4051 · Panhandle / Lubbock',
  } as Record<string, string>,
};

// Officers + role-based access. `scope: 'all'` => sees every area.
// `scope: [4041]` => sees only that area's candidates.
//
// Bro. William Bernard holds both the district-wide "Chief Dean of Membership
// Intake" seat AND the Area 2 (4042) Area Director / Chief Dean seat. Since
// his district account already has scope: 'all' (covers every area,
// including 4042), he is intentionally NOT given a second area-scoped login —
// unlike the tanner-4041 / carroll-4041 split, a second row would need a
// distinct email, and he uses one email for both roles.
export const OFFICERS: Record<string, OfficerPublic> = {
  escalante: { id: 'escalante', name: 'Bro. Adrian Escalante', title: 'District Director', initials: 'AE', scope: 'all', tier: 'district' },
  bernard: { id: 'bernard', name: 'Bro. William Bernard', title: 'Chief Dean of Membership Intake · Area 2 Director', initials: 'WB', scope: 'all', tier: 'district' },
  carroll: { id: 'carroll', name: 'Bro. Mancil Carroll', title: 'Chief Administrator', initials: 'MC', scope: 'all', tier: 'district' },

  // Area 1 · Dallas
  'tanner-4041': { id: 'tanner-4041', name: 'Bro. Theo Tanner', title: 'Area Director / Chief Dean', area: 4041, initials: 'TT', scope: [4041], tier: 'area' },
  'carroll-4041': { id: 'carroll-4041', name: 'Bro. Mancil Carroll', title: 'Assistant Area Director', area: 4041, initials: 'MC', scope: [4041], tier: 'area' },

  // Area 2 · Arlington / Fort Worth / Grapevine — Director/Chief Dean is Bernard (district account above)
  'cathey-4042': { id: 'cathey-4042', name: 'Bro. Victor Cathey', title: 'Assistant Area Director', area: 4042, initials: 'VC', scope: [4042], tier: 'area' },
  'corzine-4042': { id: 'corzine-4042', name: 'Bro. Jay Corzine', title: 'Assistant Area Director', area: 4042, initials: 'JC', scope: [4042], tier: 'area' },

  // Area 3 · Longview / Tyler / Northeast TX
  'norman-4043': { id: 'norman-4043', name: 'Bro. Shiro Norman', title: 'Area Director / Chief Dean', area: 4043, initials: 'SN', scope: [4043], tier: 'area' },

  // Area 4 · El Paso
  'wheaton-4044': { id: 'wheaton-4044', name: 'Bro. James Wheaton', title: 'Area Director / Chief Dean', area: 4044, initials: 'JW', scope: [4044], tier: 'area' },

  // Area 5 · Central TX
  'dixon-4045': { id: 'dixon-4045', name: 'Bro. Dwight Dixon', title: 'Area Director / Chief Dean', area: 4045, initials: 'DD', scope: [4045], tier: 'area' },

  // Area 6 · Austin / San Marcos
  'wooten-4046': { id: 'wooten-4046', name: 'Bro. Keith Wooten', title: 'Area Director / Chief Dean', area: 4046, initials: 'KW', scope: [4046], tier: 'area' },

  // Area 7 · San Antonio — Bishop holds both Area Director and Chief Dean
  'bishop-4047': { id: 'bishop-4047', name: 'Bro. Trent Bishop', title: 'Area Director / Chief Dean', area: 4047, initials: 'TB', scope: [4047], tier: 'area' },
  'renteria-4047': { id: 'renteria-4047', name: 'Bro. Anthony Renteria', title: 'Assistant Area Director', area: 4047, initials: 'AR', scope: [4047], tier: 'area' },

  // Area 8 · Houston
  'neal-4048': { id: 'neal-4048', name: 'Bro. Frank Neal', title: 'Area Director / Chief Dean', area: 4048, initials: 'FN', scope: [4048], tier: 'area' },
  'green-4048': { id: 'green-4048', name: 'Bro. Darryl Green', title: 'Assistant Area Director', area: 4048, initials: 'DG', scope: [4048], tier: 'area' },

  // Area 9 · College Station / Prairie View
  'carter-4049': { id: 'carter-4049', name: 'Bro. Adrian Carter', title: 'Area Director / Chief Dean', area: 4049, initials: 'AC', scope: [4049], tier: 'area' },

  // Area 10 · Southeastern TX
  'oliver-4050': { id: 'oliver-4050', name: 'Bro. Wayne Oliver', title: 'Area Director / Chief Dean', area: 4050, initials: 'WO', scope: [4050], tier: 'area' },
  'bates-4050': { id: 'bates-4050', name: 'Bro. Christopher Bates', title: 'Assistant Area Director', area: 4050, initials: 'CB', scope: [4050], tier: 'area' },

  // Area 11 · Lubbock / Amarillo — Director and Chief Dean are two different officers
  'smith-4051': { id: 'smith-4051', name: 'Bro. Ron Smith', title: 'Area Director', area: 4051, initials: 'RS', scope: [4051], tier: 'area' },
  'love-4051': { id: 'love-4051', name: 'Bro. George Love', title: 'Chief Dean', area: 4051, initials: 'GL', scope: [4051], tier: 'area' },
};

export function officerCanSeeArea(officer: OfficerPublic | null | undefined, area: number): boolean {
  if (!officer) return true;
  if (officer.scope === 'all') return true;
  return Array.isArray(officer.scope) && officer.scope.includes(area);
}

export function officerCanSeeChapterKey(officer: OfficerPublic | null | undefined, chapterKey: string): boolean {
  const ch = CHAPTERS[chapterKey];
  if (!ch) return true;
  return officerCanSeeArea(officer, ch.area);
}

export function officerScopeLabel(officer: OfficerPublic): string {
  if (officer.scope === 'all') return 'All TCAC Areas';
  return officer.scope.map((a) => `Area ${a}`).join(' · ');
}

export function getChapter(chapterKey: string): Chapter {
  return (
    CHAPTERS[chapterKey] || {
      key: chapterKey,
      name: 'Unassigned',
      type: 'alumni',
      school: null,
      area: 0,
      city: '',
    }
  );
}
