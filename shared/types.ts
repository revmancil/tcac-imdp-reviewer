// Shared type definitions used by both the Hono backend (src/) and the
// React frontend (client/). Mirrors the shape described in the design
// handoff README ("State Management" + "Design Tokens" sections).

export type ChapterType = 'collegiate' | 'alumni';

export interface Chapter {
  key: string;
  name: string;
  type: ChapterType;
  school: string | null;
  area: number;
  city: string;
  inactive?: boolean;
}

export interface OfficerPublic {
  id: string;
  name: string;
  title: string;
  initials: string;
  area?: number;
  tier: 'district' | 'area';
  scope: 'all' | number[];
  // Only present on the signed-in session officer (set by /api/auth/*),
  // never in the /api/reference officer directory.
  mustChangePassword?: boolean;
}

// Row shape returned by /api/auth/admin/officers (district-tier only).
export interface AdminOfficerRow {
  officer: OfficerPublic;
  email: string | null;
  hasCredential: boolean;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
}

export type StatusKey = 'received' | 'review' | 'missing' | 'complete' | 'cleared';
export type StatusTone = 'neutral' | 'info' | 'warn' | 'ok' | 'gold';

export interface StatusDef {
  key: StatusKey;
  label: string;
  tone: StatusTone;
}

export interface WorkflowStepDef {
  key: string;
  label: string;
}

export interface RequiredDocDef {
  key: string;
  label: string;
  short: string;
  pages: number;
  // When set, this document only applies to candidates of that chapter type
  // (e.g. the enrollment letter only makes sense for active students).
  // Absent means it applies to everyone.
  collegiateOnly?: boolean;
  // Shown as a persistent reminder wherever this document is reviewed or
  // uploaded (e.g. "must be hand-signed, not typed/electronic"). There's no
  // reliable automated way to tell a real signature from a typed/electronic
  // one on a scanned form, so this is a policy note for the reviewing
  // officer, not an automated check.
  signaturePolicy?: string;
}

export interface DocState {
  present: boolean;
  valid: boolean;
  note: string | null;
  file: string | null;
  uploadedAt?: string | null;
}

export interface WorkflowStepState {
  done: boolean;
  value?: string;
}

export interface Brother {
  name: string;
  chapter: string;
  initDate?: string;
  role: string;
  email: string;
  phone: string;
  relationship: string;
  letterLocation?: string;
  letter?: string;
}

export interface CheckItemState {
  pass: boolean | null;
  value: string;
}

// A three-way version of CheckItemState for checks where "received but
// wrong" (warn, yellow) needs to read differently from "not received at all
// / fails outright" (flag, red) -- CheckItemState's boolean pass can't tell
// those apart.
export type CheckState = 'ok' | 'warn' | 'flag' | 'pending';
export interface TriCheckState {
  state: CheckState;
  value: string;
}

export interface Candidate {
  id: string;
  fullId: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  address: string;
  dob: string;
  school: string;
  major: string;
  minor: string;
  classification: string;
  gpa: number;
  gradDate: string;
  submitted: string;
  lastUpdated: string;
  lastActivity: string;
  term: string;
  status: StatusDef;
  chapterKey: string;
  chapterType: ChapterType;
  workflow: Record<string, WorkflowStepState>;
  sponsor: Brother | null;
  recommender: Brother | null;
  checks: {
    gpaMin: CheckItemState;
    signatures: CheckItemState;
    dates: CheckItemState;
    sponsorRecommender: TriCheckState;
  };
  docs: Record<string, DocState>;
  reviewer: string;
  featured?: boolean;
  isNew?: boolean;
  ddrvpDecision?: string;
  ddrvpComment?: string;
  ddrvpBy?: string;
  affiliations?: string[];
  awards?: string[];
  employment?: string;
  // OCR'd text of the candidate's uploaded essay (docs.essay.file), used for
  // the 300-word minimum check. Absent until a real essay PDF has been
  // uploaded and successfully parsed.
  essayText?: string;
}

export interface CompletenessResult {
  valid: number;
  total: number;
  pct: number;
}

export interface ReferenceData {
  chapters: Record<string, Chapter>;
  officers: OfficerPublic[];
  district: { name: string; region: string; areaNames: Record<string, string> };
  statuses: StatusDef[];
  workflowSteps: WorkflowStepDef[];
  requiredDocs: RequiredDocDef[];
}
