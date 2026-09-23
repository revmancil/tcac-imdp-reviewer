// Server-side candidate creation + CSV parsing.
// Ported from the design handoff's data.jsx (makeCandidate / parseCandidateCSV
// / buildCSVTemplate) — moved server-side per the README "Implementation
// Notes": "In production, upload to the server and validate row-by-row
// before commit."

import { CHAPTERS, requiredDocsFor, STATUS } from '../../shared/reference.js';
import type { Candidate, DocState } from '../../shared/types.js';

export interface ManualCandidateInput {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dob?: string;
  school: string;
  major?: string;
  minor?: string;
  classification?: string;
  gpa?: number | string;
  gradDate?: string;
  chapterKey: string;
  term?: string;
  sponsorName?: string;
  recommenderName?: string;
}

export function makeCandidate(input: ManualCandidateInput): Candidate {
  const chapter = CHAPTERS[input.chapterKey];
  const initials = (input.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '??';
  const today = new Date().toISOString().slice(0, 10);
  const term = input.term || '2026 FALL';
  const fullId = `TX-${term.split(' ')[0]}-${input.id}`;
  const gpa = typeof input.gpa === 'number' ? input.gpa : parseFloat(String(input.gpa)) || 0;

  const emptyDocs: Record<string, DocState> = {};
  requiredDocsFor(chapter.type).forEach((d) => {
    emptyDocs[d.key] = { present: false, valid: false, note: 'Not yet received', file: null };
  });

  const workflow: Candidate['workflow'] = {
    pretest: { done: false },
    appSubmitted: { done: true },
    backgroundCheck: { done: false, value: 'Pending' },
    membershipFees: { done: false, value: 'Balance pending' },
    ddApproval: { done: false },
    hqApproval: { done: false },
    sponsorAssigned: { done: !!input.sponsorName, value: input.sponsorName || undefined },
    recommenderAssigned: { done: !!input.recommenderName, value: input.recommenderName || undefined },
    essayReceived: { done: false },
    resumeReceived: { done: false },
    medicalReceived: { done: false },
    voterReceived: { done: false },
    transcriptReceived: { done: false },
  };

  return {
    id: String(input.id),
    fullId,
    name: input.name,
    initials,
    email: input.email || '',
    phone: input.phone || '',
    address: input.address || '',
    dob: input.dob || '',
    school: input.school || 'Not specified',
    major: input.major || 'Not specified',
    minor: input.minor || '',
    classification: input.classification || 'Undergraduate',
    gpa,
    gradDate: input.gradDate || '',
    submitted: today,
    lastUpdated: today,
    lastActivity: today,
    term,
    status: STATUS.RECEIVED,
    chapterKey: input.chapterKey,
    chapterType: chapter?.type || 'alumni',
    workflow,
    sponsor: input.sponsorName
      ? {
          name: input.sponsorName.startsWith('Bro.') ? input.sponsorName : `Bro. ${input.sponsorName}`,
          chapter: 'Pending confirmation',
          role: 'Chapter Brother',
          email: '',
          phone: '',
          relationship: 'Sponsor · Chapter Brother',
          letterLocation: 'Application PDF · Section: Sponsor (pending upload)',
          letter: '',
        }
      : null,
    recommender: input.recommenderName
      ? {
          name: input.recommenderName.startsWith('Bro.') ? input.recommenderName : `Bro. ${input.recommenderName}`,
          chapter: 'Pending confirmation',
          role: 'Chapter Brother',
          email: '',
          phone: '',
          relationship: 'Recommender · Chapter Brother',
          letterLocation: 'Application PDF · Section: Recommender (pending upload)',
          letter: '',
        }
      : null,
    checks: {
      gpaMin: { pass: gpa >= 2.5, value: gpa >= 2.5 ? `${gpa.toFixed(2)} ≥ 2.50` : `${gpa.toFixed(2)} < 2.50 minimum` },
      signatures: { pass: null, value: 'Awaiting document upload' },
      dates: { pass: null, value: 'Awaiting document upload' },
    },
    docs: emptyDocs,
    reviewer: '—',
    isNew: true,
  };
}

export interface CSVRow extends ManualCandidateInput {
  lineNumber: number;
}
export interface CSVParseResult {
  rows: CSVRow[];
  errors: { line: number; message: string }[];
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCandidateCSV(text: string): CSVParseResult {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], errors: [{ line: 0, message: 'CSV must have a header row and at least one data row.' }] };
  }

  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows: CSVRow[] = [];
  const errors: { line: number; message: string }[] = [];

  const required = ['candidateid', 'fullname', 'email', 'school', 'chapter'];
  const missing = required.filter((k) => !headers.includes(k));
  if (missing.length) {
    errors.push({ line: 0, message: `Missing required column(s): ${missing.join(', ')}` });
    return { rows: [], errors };
  }

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] || '';
    });

    if (!row.candidateid) { errors.push({ line: i + 1, message: 'Missing candidate ID' }); continue; }
    if (!row.fullname) { errors.push({ line: i + 1, message: 'Missing full name' }); continue; }
    if (!row.email || !row.email.includes('@')) { errors.push({ line: i + 1, message: 'Invalid email' }); continue; }
    if (!row.chapter) { errors.push({ line: i + 1, message: 'Missing chapter' }); continue; }

    const chapterKey = Object.keys(CHAPTERS).find(
      (k) =>
        CHAPTERS[k].name.toLowerCase() === row.chapter.toLowerCase() ||
        k === row.chapter.toLowerCase().replace(/\s+/g, '-')
    );
    if (!chapterKey) { errors.push({ line: i + 1, message: `Unknown chapter "${row.chapter}"` }); continue; }

    rows.push({
      lineNumber: i + 1,
      id: row.candidateid,
      name: row.fullname,
      email: row.email,
      phone: row.phone || '',
      address: row.address || '',
      dob: row.dob || '',
      school: row.school || '',
      major: row.major || '',
      minor: row.minor || '',
      classification: row.classification || (CHAPTERS[chapterKey].type === 'alumni' ? 'Alumni' : 'Undergraduate'),
      gpa: row.gpa || '0',
      gradDate: row.graduationdate || row.graddate || '',
      chapterKey,
      term: row.term || '2026 FALL',
      sponsorName: row.sponsor || row.sponsorname || '',
      recommenderName: row.recommender || row.recommendername || '',
    });
  }

  return { rows, errors };
}

export function buildCSVTemplate(): string {
  const headers = ['Candidate ID', 'Full Name', 'Email', 'Phone', 'Address', 'DOB', 'School', 'Major', 'Minor', 'Classification', 'GPA', 'Graduation Date', 'Chapter', 'Term', 'Sponsor', 'Recommender'];
  const example = [
    ['2897060', 'Example Candidate', 'example@student.edu', '(214) 555-0100', '123 Main St, Dallas TX', '2003', 'UT Austin', 'Business', '', 'Junior', '3.45', 'May 2027', 'Delta Theta', '2026 FALL', 'Bro. John Smith', 'Bro. James Wilson'],
    ['2897061', 'Alumni Applicant', 'alum@example.com', '(469) 555-0100', '456 Elm St, Dallas TX', '1998', 'Prairie View A&M University', 'Engineering', '', 'Alumni', '3.6', 'May 2020', 'Rho Nu Lambda', '2026 FALL', '', ''],
  ];
  return [headers, ...example]
    .map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
    .join('\n');
}
