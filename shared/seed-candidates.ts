// Seed candidate records — ported from the design handoff's data.jsx.
// Used to populate the database on first run (see src/lib/db.ts ensureReady()).
// In production this table is populated by real intake submissions instead.

import { REQUIRED_DOCS, STATUS } from './reference';
import type { Candidate, DocState } from './types';

function baseDocs(overrides: Record<string, Partial<DocState>> = {}): Record<string, DocState> {
  const base: Record<string, DocState> = {};
  REQUIRED_DOCS.forEach((d) => {
    base[d.key] = { present: true, valid: true, note: null, file: null };
  });
  Object.entries(overrides).forEach(([k, v]) => {
    base[k] = { ...base[k], ...v };
  });
  return base;
}

const NAZHIR_FILES: Record<string, string> = {
  application: '/static/pdfs/2897040/Application.pdf',
  essay: '/static/pdfs/2897040/Essay.pdf',
  resume: '/static/pdfs/2897040/Resume.pdf',
  transcript: '/static/pdfs/2897040/Transcript.pdf',
  medical: '/static/pdfs/2897040/Medical.pdf',
  voter: '/static/pdfs/2897040/Voter.pdf',
  covidWaiver: '/static/pdfs/2897040/COVID_Waiver.pdf',
  covidVax: '/static/pdfs/2897040/COVID_Vaccination.pdf',
};

const genericLetter = (kind: 'sponsor' | 'recommender') =>
  kind === 'sponsor'
    ? "Brothers of the Committee, it is my honor to formally sponsor this candidate for membership in Alpha Phi Alpha Fraternity, Inc. I have known this candidate personally and take responsibility for their character and readiness. — [Full sponsor letter embedded in Section: Sponsor of the application PDF.]"
    : "Brothers of the Committee, I write in strong recommendation of this candidate. I have observed their scholarship, service, and comportment among men of substance. — [Full recommendation embedded in Section: Recommender of the application PDF.]";

const fullWorkflow = (overrides: Record<string, any> = {}) => ({
  pretest: { done: true },
  appSubmitted: { done: true },
  backgroundCheck: { done: true, value: 'Green' },
  membershipFees: { done: true, value: 'Balance: $0.00' },
  ddApproval: { done: true },
  hqApproval: { done: true },
  sponsorAssigned: { done: true },
  recommenderAssigned: { done: true },
  essayReceived: { done: true },
  resumeReceived: { done: true },
  medicalReceived: { done: true },
  voterReceived: { done: true },
  transcriptReceived: { done: true },
  ...overrides,
});

const NAZHIR: Candidate = {
  id: '2897040',
  fullId: 'TX-2025-2897040',
  name: 'Nazhir Dejean Carter',
  initials: 'NC',
  dob: '2002',
  email: 'carternazhir@gmail.com',
  phone: '(469) 980-6735',
  address: '5832 Stratford Ln, The Colony, TX 75056',
  school: 'Prairie View A&M University',
  major: 'Mass Communications',
  minor: 'Music',
  classification: 'Alumni',
  gpa: 3.5,
  gradDate: 'May 2024',
  submitted: '2025-09-07',
  lastUpdated: '2025-11-14',
  lastActivity: '2026-07-28',
  term: '2025 FALL',
  status: STATUS.REVIEW,
  chapterKey: 'rho-nu-lambda',
  chapterType: 'alumni',
  ddrvpDecision: 'approved-pending-fees',
  ddrvpComment: 'Approved pending payment of fees.',
  ddrvpBy: 'Bro. Mancil Carroll · Chief Administrator',
  workflow: {
    pretest: { done: true, value: '100% · took 16 minutes' },
    appSubmitted: { done: true },
    backgroundCheck: { done: true, value: 'Green' },
    membershipFees: { done: true, value: 'Balance: $0.00' },
    ddApproval: { done: true, value: 'Approved pending fees' },
    hqApproval: { done: true },
    sponsorAssigned: { done: true, value: 'Sibley, Roderick L.' },
    recommenderAssigned: { done: true, value: 'Johnson, Delbert C.' },
    essayReceived: { done: true },
    resumeReceived: { done: true },
    medicalReceived: { done: true },
    voterReceived: { done: true },
    transcriptReceived: { done: true },
  },
  sponsor: {
    name: 'Bro. Roderick L. Sibley',
    chapter: 'Rho Nu Lambda',
    initDate: 'unknown',
    role: 'Chapter Brother',
    email: 'r.sibley@rhonulambda.org',
    phone: '(214) 555-0140',
    relationship: 'Sponsor · Chapter Brother',
    letterLocation: 'Application PDF · Section: Sponsor (p. 5)',
    letter:
      "Greetings, Sponsorship is not just providing support. It's an investment into the promise of tomorrow and a belief in potential. I am Brother Roderick L. Sibley, and it is with great enthusiasm that I submit this letter, acknowledging my sponsorship of Mr. Nazhir D. Carter. My personal commitment to support Nazhir is influenced by the essence of our mission, supporting his ambitions to serve with others, promoting academic excellence, encouraging personal growth, and upholding the dignity of himself and other individuals. When I think about a young man who best exemplifies being an overcomer, when faced with obstacles and adversity, that is Nazhir Carter. One of the main compliments to this young man is that he hasn't allowed his disability to prevent him from accomplishing his goals and admirations in life. He excelled as a student athlete, while being an Honor student and has since continued to follow his dreams, leveraging his professional background to fuel his ambitions as a professional track and field athlete. He continues to impress me with his maturity, vision, and personal sense of responsibility towards making an impact on the world. His dedication to serving, passion for the arts, and his determination as an athlete is remarkable. Nazhir is a proud 2024 Cum Laude graduate of Prairie View A&M University (PVAMU) where he earned his B.A. in Mass Communications and a minor in Music. He achieved academic excellence as a Dean's List scholar and was inducted into multiple academic national honor societies within his area of study. Nazhir's academic achievements not only kept him on track to graduate on time but also graduated one hundred percent debt free, the first to achieve this status in his family. As an Academic Enrichment Specialist with Lewisville Independent School District, Nazhir has been responsible for developing engaging activities and innovative lesson plans that foster critical thinking and growth in middle school students.",
  },
  recommender: {
    name: 'Bro. Delbert C. Johnson',
    chapter: 'Rho Nu Lambda',
    initDate: 'unknown',
    role: 'Chairman, Scholarship Committee — Onward and Upward Empowerment Foundation',
    email: 'd.johnson@rhonulambda.org',
    phone: '(214) 555-0155',
    relationship: 'Recommender · Chapter Brother',
    letterLocation: 'Application PDF · Section: Recommender (p. 5)',
    letter:
      "Does the candidate possess the character and moral reputation desired of a member of Alpha Phi Alpha Fraternity, Inc? To my brothers of Alpha Phi Alpha Fraternity, Inc. It is with pride that I submit my recommendation of Nazhir Carter as he pursues membership into our great fraternity. I've had the opportunity to watch Nazhir's growth from a scholarship recipient from my chapters Foundation for his academic excellence in pursuit of his scholastic endeavors, to graduating and becoming a thriving young man with grit, tenacity and passion for serving others in his community. His character and heart for underserved people says to me without any doubt he possess the character and reputation desired of any man seeking membership into our esteemed fraternal organization. Does the candidate possess academic, and leadership qualities desired of a member of Alpha Phi Alpha Fraternity, Inc? Yes, Nazhir is a proud graduate of Prairie View A&M University, where he earned a B.A. in Mass Communications, displaying academic excellence as a Dean's List scholar and being selected to become a member of multiple national honor societies within his area of study. Along with his academic accolades, Nazhir achieved remarkable success as a track and field student athlete, securing three (3) SWAC Championships, representing a high standard of discipline, teamwork, and perseverance. As a professional, Nazhir carries a passion for youth development that is evident through his roles as an Athletic Development Specialist, Youth Coach, and his work with the Texas Legends G League in Frisco, Tx.",
  },
  checks: {
    gpaMin: { pass: true, value: '3.50 ≥ 2.50' },
    signatures: { pass: true, value: 'All required signatures present' },
    dates: { pass: true, value: 'All dates within window' },
  },
  docs: baseDocs({
    application: { file: NAZHIR_FILES.application },
    essay: { file: NAZHIR_FILES.essay },
    resume: { file: NAZHIR_FILES.resume },
    transcript: { file: NAZHIR_FILES.transcript },
    medical: { file: NAZHIR_FILES.medical },
    voter: { file: NAZHIR_FILES.voter },
    covidWaiver: { file: NAZHIR_FILES.covidWaiver },
    covidVax: { file: NAZHIR_FILES.covidVax },
    nda: { present: false, valid: false, note: 'Awaiting NDA execution', file: null },
    financial: { present: false, valid: false, note: 'Awaiting fee payment · Balance $0.00 (paid, awaiting form)', file: null },
    headshot: { present: true, valid: true, note: null, file: null },
  }),
  reviewer: 'Bro. C. Freeman',
  affiliations: [
    'National Association for the Advancement of Colored People (NAACP)',
    'National Association of Black Journalists (NABJ)',
    'Alpha Kappa Mu National Honor Society',
    'Lambda Pi Eta Communications National Honor Society',
    'Phi Eta Sigma National Honor Society',
    'Chevron Leadership Academy — Prairie View A&M',
    'Friendship Baptist Church — Audio/Video Ministry',
  ],
  awards: [
    'NAACP All-American Scholarship Award',
    '2022 SWAC Champion — Indoor Track & Field',
    '2021–22 SWAC Champion — Outdoor Track & Field',
    "SWAC Commissioner's Honor Roll",
    "PVAMU Dean's List & Honor Roll",
  ],
  employment: 'Olympic Fit Performance — Professional Track & Field Athlete',
  featured: true,
};

function person(overrides: Partial<Candidate> & { id: string; name: string }): Candidate {
  return {
    fullId: `TX-2026-${overrides.id}`,
    initials: overrides.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
    email: '',
    phone: '',
    address: '',
    dob: '',
    minor: '',
    gradDate: '',
    lastUpdated: overrides.submitted || '2026-07-01',
    lastActivity: overrides.lastActivity || '2026-07-01',
    term: '2026 FALL',
    sponsor: null,
    recommender: null,
    docs: baseDocs(),
    reviewer: 'Bro. C. Freeman',
    ...overrides,
  } as Candidate;
}

export const SEED_CANDIDATES: Candidate[] = [
  NAZHIR,
  person({
    id: '2897041', name: 'Marcus J. Whitfield', school: 'Prairie View A&M University',
    classification: 'Junior', major: 'Political Science', gpa: 3.68,
    submitted: '2026-07-12', status: STATUS.CLEARED, chapterKey: 'eta-gamma', chapterType: 'collegiate',
    sponsor: { name: 'Bro. Christopher Freeman', chapter: 'Delta Sigma Lambda', initDate: 'Spring 1995', role: 'District DoM', email: 'freeman@deltasigmalambda.org', phone: '(713) 555-0401', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Solomon Whitaker', chapter: 'Pi Theta Lambda', initDate: 'Fall 1992', role: 'Historian', email: 'whitaker@kappadeltalambda.org', phone: '(832) 555-0501', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.68 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow(), lastActivity: '2026-07-28',
  }),
  person({
    id: '2897042', name: 'Terrell A. Brooks', school: 'Texas Southern University',
    classification: 'Senior', major: 'Finance', gpa: 3.91,
    submitted: '2026-07-08', status: STATUS.COMPLETE, chapterKey: 'delta-theta', chapterType: 'collegiate',
    sponsor: { name: 'Bro. James O. Randolph', chapter: 'Alpha Sigma Lambda', initDate: 'Spring 2005', role: 'Treasurer', email: 'randolph@sigmalambda.org', phone: '(713) 555-0402', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Dr. Kwame Osei', chapter: 'Alpha Eta Lambda', initDate: 'Spring 1988', role: 'Past District Director', email: 'osei@alphaetalambda.org', phone: '(832) 555-0502', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.91 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow(), lastActivity: '2026-07-29',
  }),
  person({
    id: '2897043', name: 'Devon R. Carter', school: 'University of Houston',
    classification: 'Junior', major: 'Computer Science', gpa: 3.24,
    submitted: '2026-07-15', status: STATUS.MISSING, chapterKey: 'eta-mu', chapterType: 'collegiate',
    sponsor: { name: 'Bro. Anthony Reeves', chapter: 'Xi Kappa Lambda', initDate: 'Fall 1994', role: 'Financial Secretary', email: 'reeves@zetakappalambda.org', phone: '(713) 555-0403', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Damon T. Ellsworth', chapter: 'Beta Tau Lambda', initDate: 'Fall 1999', role: 'Chapter President', email: 'ellsworth@piiotalambda.org', phone: '(832) 555-0503', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.24 ≥ 2.50' }, signatures: { pass: false, value: 'Financial form missing signature on p.2' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow({ membershipFees: { done: false, value: 'Balance: $95.00' }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: '100%' } }),
    docs: baseDocs({
      nda: { present: false, valid: false, note: 'NDA not received', file: null },
      transcript: { present: false, valid: false, note: 'Not received from registrar', file: null },
      financial: { present: true, valid: false, note: 'Missing signature — page 2', file: null },
      covidVax: { present: false, valid: false, note: 'Not attached', file: null },
    }),
    lastActivity: '2026-07-30',
  }),
  person({
    id: '2897044', name: 'Jalen M. Simmons', school: 'UT Austin',
    classification: 'Sophomore', major: 'Business Administration', gpa: 2.87,
    submitted: '2026-07-18', status: STATUS.REVIEW, chapterKey: 'delta-theta', chapterType: 'collegiate',
    sponsor: { name: 'Bro. Malcolm Prescott', chapter: 'Eta Gamma', initDate: 'Spring 2018', role: 'Chapter Advisor', email: 'prescott@etagamma.org', phone: '(713) 555-0404', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Vernon Ashe', chapter: 'Delta Theta', initDate: 'Fall 2019', role: 'Chapter Advisor', email: 'ashe@zetagamma.org', phone: '(832) 555-0504', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '2.87 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow(), lastActivity: '2026-07-29',
  }),
  person({
    id: '2897045', name: 'Isaiah K. Bell', school: 'Texas Tech University',
    classification: 'Junior', major: 'Mechanical Engineering', gpa: 3.45,
    submitted: '2026-07-20', status: STATUS.MISSING, chapterKey: 'eta-upsilon', chapterType: 'collegiate',
    sponsor: { name: 'Bro. Dr. Nathaniel Boone', chapter: 'Delta Sigma Lambda', initDate: 'Spring 1985', role: 'Life Member', email: 'boone@deltasigmalambda.org', phone: '(713) 555-0405', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Reginald Hollis', chapter: 'Xi Kappa Lambda', initDate: 'Fall 2001', role: 'Dean of Members', email: 'hollis@zetakappalambda.org', phone: '(832) 555-0505', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.45 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: false, value: 'Medical form dated 2025-11-04 (>6mo old)' } },
    workflow: fullWorkflow({ membershipFees: { done: false, value: 'Balance: $95.00' }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: '100%' } }),
    docs: baseDocs({
      medical: { present: true, valid: false, note: 'Dated 2025-11-04 — exceeds 6-month window', file: null },
      covidWaiver: { present: false, valid: false, note: 'Not received', file: null },
    }),
    lastActivity: '2026-07-30',
  }),
  person({
    id: '2897046', name: 'Andre L. Whitmore', school: 'University of North Texas',
    classification: 'Senior', major: 'History', gpa: 3.72,
    submitted: '2026-07-05', status: STATUS.CLEARED, chapterKey: 'eta-epsilon', chapterType: 'collegiate',
    sponsor: { name: 'Bro. Marcus D. Alston', chapter: 'Alpha Eta Lambda', initDate: 'Spring 1998', role: 'Chapter President', email: 'alston@alphaetalambda.org', phone: '(713) 555-0406', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Dr. Terrence Baldwin', chapter: 'Gamma Eta Lambda', initDate: 'Fall 1989', role: 'Past Chapter President', email: 'baldwin@iotazetalambda.org', phone: '(832) 555-0506', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.72 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow(), lastActivity: '2026-07-27',
  }),
  person({
    id: '2897047', name: 'Cameron D. Prince', school: 'Sam Houston State University',
    classification: 'Junior', major: 'Electrical Engineering', gpa: 2.41,
    submitted: '2026-07-19', status: STATUS.MISSING, chapterKey: 'theta-mu', chapterType: 'collegiate',
    sponsor: { name: 'Bro. Christopher Freeman', chapter: 'Delta Sigma Lambda', initDate: 'Spring 1995', role: 'District DoM', email: 'freeman@deltasigmalambda.org', phone: '(713) 555-0407', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Solomon Whitaker', chapter: 'Pi Theta Lambda', initDate: 'Fall 1992', role: 'Historian', email: 'whitaker@kappadeltalambda.org', phone: '(832) 555-0507', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: false, value: '2.41 < 2.50 minimum' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow({ membershipFees: { done: false, value: 'Balance: $95.00' }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: '100%' } }),
    docs: baseDocs({
      nda: { present: true, valid: false, note: 'Missing initials on p.2', file: null },
      transcript: { present: true, valid: false, note: 'GPA 2.41 below 2.50 minimum', file: null },
      voter: { present: false, valid: false, note: 'Not submitted', file: null },
    }),
    lastActivity: '2026-07-30',
  }),
  person({
    id: '2897048', name: 'Malik R. Overton', school: 'Texas Southern University (2022)',
    classification: 'Alumni (Post-Grad)', major: 'Sociology · Grad 2022', gpa: 3.55,
    submitted: '2026-07-11', status: STATUS.COMPLETE, chapterKey: 'alpha-eta-lambda', chapterType: 'alumni',
    sponsor: { name: 'Bro. Christopher Freeman', chapter: 'Delta Sigma Lambda', initDate: 'Spring 1995', role: 'District DoM', email: 'freeman@deltasigmalambda.org', phone: '(713) 555-0412', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Marcus D. Alston', chapter: 'Alpha Eta Lambda', initDate: 'Spring 1998', role: 'Chapter President', email: 'alston@alphaetalambda.org', phone: '(832) 555-0512', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.55 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow(), lastActivity: '2026-07-28',
  }),
  person({
    id: '2897049', name: 'Trevor N. Ashford', school: 'UT Austin',
    classification: 'Junior', major: 'Psychology', gpa: 3.12,
    submitted: '2026-07-22', status: STATUS.REVIEW, chapterKey: 'delta-theta', chapterType: 'collegiate',
    sponsor: { name: 'Bro. James O. Randolph', chapter: 'Alpha Sigma Lambda', initDate: 'Spring 2005', role: 'Treasurer', email: 'randolph@sigmalambda.org', phone: '(713) 555-0408', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Dr. Kwame Osei', chapter: 'Alpha Eta Lambda', initDate: 'Spring 1988', role: 'Past District Director', email: 'osei@alphaetalambda.org', phone: '(832) 555-0508', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.12 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow(), lastActivity: '2026-07-30',
  }),
  person({
    id: '2897050', name: 'Justin E. Broussard', school: 'University of Houston (2023)',
    classification: 'Alumni (Post-Grad)', major: 'Accounting · Grad 2023', gpa: 3.83,
    submitted: '2026-07-09', status: STATUS.CLEARED, chapterKey: 'xi-kappa-lambda', chapterType: 'alumni',
    sponsor: { name: 'Bro. Reginald Hollis', chapter: 'Xi Kappa Lambda', initDate: 'Fall 2001', role: 'Dean of Members', email: 'hollis@zetakappalambda.org', phone: '(713) 555-0413', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. James O. Randolph', chapter: 'Alpha Sigma Lambda', initDate: 'Spring 2005', role: 'Treasurer', email: 'randolph@sigmalambda.org', phone: '(832) 555-0513', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.83 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow(), lastActivity: '2026-07-26',
  }),
  person({
    id: '2897051', name: 'Kendrick P. Lyles', school: 'Prairie View A&M University',
    classification: 'Junior', major: 'Biology', gpa: 3.28,
    submitted: '2026-07-24', status: STATUS.RECEIVED, chapterKey: 'eta-gamma', chapterType: 'collegiate',
    sponsor: { name: 'Bro. Anthony Reeves', chapter: 'Xi Kappa Lambda', initDate: 'Fall 1994', role: 'Financial Secretary', email: 'reeves@zetakappalambda.org', phone: '(713) 555-0409', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Damon T. Ellsworth', chapter: 'Beta Tau Lambda', initDate: 'Fall 1999', role: 'Chapter President', email: 'ellsworth@piiotalambda.org', phone: '(832) 555-0509', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.28 ≥ 2.50' }, signatures: { pass: null, value: 'Awaiting review' }, dates: { pass: null, value: 'Awaiting review' } },
    workflow: fullWorkflow({ backgroundCheck: { done: false, value: 'Pending' }, membershipFees: { done: false, value: 'Balance: $185.00' }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: '100%' } }),
    lastActivity: '2026-07-24', reviewer: '—',
  }),
  person({
    id: '2897052', name: 'Xavier T. Monroe', school: 'UT Austin (2024)',
    classification: 'Alumni (Post-Grad)', major: 'Chemistry · Grad 2024', gpa: 3.61,
    submitted: '2026-07-06', status: STATUS.COMPLETE, chapterKey: 'gamma-eta-lambda', chapterType: 'alumni',
    sponsor: { name: 'Bro. Dr. Terrence Baldwin', chapter: 'Gamma Eta Lambda', initDate: 'Fall 1989', role: 'Past Chapter President', email: 'baldwin@iotazetalambda.org', phone: '(713) 555-0414', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Damon T. Ellsworth', chapter: 'Beta Tau Lambda', initDate: 'Fall 1999', role: 'Chapter President', email: 'ellsworth@piiotalambda.org', phone: '(832) 555-0514', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.61 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow(), lastActivity: '2026-07-28',
  }),
  person({
    id: '2897053', name: 'Ronald S. Petit', school: 'Texas Southern University',
    classification: 'Junior', major: 'Pre-Med / Biology', gpa: 3.94,
    submitted: '2026-07-14', status: STATUS.MISSING, chapterKey: 'delta-theta', chapterType: 'collegiate',
    sponsor: { name: 'Bro. Malcolm Prescott', chapter: 'Eta Gamma', initDate: 'Spring 2018', role: 'Chapter Advisor', email: 'prescott@etagamma.org', phone: '(713) 555-0410', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Vernon Ashe', chapter: 'Delta Theta', initDate: 'Fall 2019', role: 'Chapter Advisor', email: 'ashe@zetagamma.org', phone: '(832) 555-0510', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.94 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow({ membershipFees: { done: false, value: 'Balance: $95.00' }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: '100%' } }),
    docs: baseDocs({
      nda: { present: false, valid: false, note: 'NDA pending', file: null },
      headshot: { present: false, valid: false, note: 'Not attached', file: null },
      voter: { present: true, valid: false, note: 'Expired — issue 2018', file: null },
    }),
    lastActivity: '2026-07-29',
  }),
  person({
    id: '2897054', name: 'Elijah W. Grantham', school: 'Sam Houston State (2025)',
    classification: 'Alumni (Post-Grad)', major: 'Communications · Grad 2025', gpa: 3.05,
    submitted: '2026-07-25', status: STATUS.RECEIVED, chapterKey: 'pi-theta-lambda', chapterType: 'alumni',
    sponsor: { name: 'Bro. Solomon Whitaker', chapter: 'Pi Theta Lambda', initDate: 'Fall 1992', role: 'Historian', email: 'whitaker@kappadeltalambda.org', phone: '(713) 555-0415', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Vernon Ashe', chapter: 'Delta Theta', initDate: 'Fall 2019', role: 'Chapter Advisor', email: 'ashe@zetagamma.org', phone: '(832) 555-0515', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.05 ≥ 2.50' }, signatures: { pass: null, value: 'Awaiting review' }, dates: { pass: null, value: 'Awaiting review' } },
    workflow: fullWorkflow({ backgroundCheck: { done: false, value: 'Pending' }, membershipFees: { done: false, value: 'Balance: $185.00' }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: '100%' } }),
    lastActivity: '2026-07-25', reviewer: '—',
  }),
  person({
    id: '2897055', name: 'Brandon O. Kincaid', school: 'University of North Texas',
    classification: 'Junior', major: 'Information Systems', gpa: 3.37,
    submitted: '2026-07-17', status: STATUS.REVIEW, chapterKey: 'eta-epsilon', chapterType: 'collegiate',
    sponsor: { name: 'Bro. Dr. Nathaniel Boone', chapter: 'Delta Sigma Lambda', initDate: 'Spring 1985', role: 'Life Member', email: 'boone@deltasigmalambda.org', phone: '(713) 555-0411', relationship: 'Sponsor · Chapter Brother', letterLocation: 'Application PDF · Section: Sponsor (p. 5)', letter: genericLetter('sponsor') },
    recommender: { name: 'Bro. Reginald Hollis', chapter: 'Xi Kappa Lambda', initDate: 'Fall 2001', role: 'Dean of Members', email: 'hollis@zetakappalambda.org', phone: '(832) 555-0511', relationship: 'Recommender · Regional Brother', letterLocation: 'Application PDF · Section: Recommender (p. 5)', letter: genericLetter('recommender') },
    checks: { gpaMin: { pass: true, value: '3.37 ≥ 2.50' }, signatures: { pass: true, value: 'All required signatures present' }, dates: { pass: true, value: 'All dates within window' } },
    workflow: fullWorkflow(), lastActivity: '2026-07-30',
  }),
];
