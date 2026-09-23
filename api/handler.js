// server/vercel-app.ts
import { handle } from "hono/vercel";

// src/index.tsx
import { Hono } from "hono";
import { cors } from "hono/cors";

// shared/reference.ts
var REQUIRED_DOCS = [
  { key: "application", label: "Membership Application", short: "Application", pages: 6 },
  { key: "essay", label: "Candidate Essay", short: "Essay", pages: 3 },
  { key: "resume", label: "Candidate Resume", short: "Resume", pages: 2 },
  { key: "transcript", label: "Official Transcript", short: "Transcript", pages: 3 },
  {
    key: "enrollmentLetter",
    label: "Enrollment / Academic Standing Letter",
    short: "Enrollment",
    pages: 1,
    collegiateOnly: true,
    signaturePolicy: "Must bear a handwritten signature from the Office of the Registrar \u2014 a typed or electronic signature is not accepted."
  },
  {
    key: "medical",
    label: "Medical Release",
    short: "Medical",
    pages: 2,
    signaturePolicy: "Requires the candidate\u2019s handwritten signature \u2014 a typed or electronic signature is not accepted."
  },
  { key: "voter", label: "Voter Registration", short: "Voter", pages: 1 },
  {
    key: "nda",
    label: "Non-Disclosure Agreement",
    short: "NDA",
    pages: 2,
    signaturePolicy: "Requires the candidate\u2019s handwritten signature \u2014 a typed or electronic signature is not accepted."
  },
  { key: "headshot", label: "Headshot", short: "Photo", pages: 1 }
];
function requiredDocsFor(chapterType) {
  return REQUIRED_DOCS.filter((d) => !d.collegiateOnly || chapterType === "collegiate");
}
var WORKFLOW_STEPS = [
  { key: "pretest", label: "Pretest 100%" },
  { key: "appSubmitted", label: "Application Submitted" },
  { key: "backgroundCheck", label: "Background Check" },
  { key: "membershipFees", label: "Membership Fees" },
  { key: "ddApproval", label: "DD/RVP Approval" },
  { key: "hqApproval", label: "HQ Approval" },
  { key: "sponsorAssigned", label: "Sponsor Assigned" },
  { key: "recommenderAssigned", label: "Recommender Assigned" },
  { key: "essayReceived", label: "Essay Submitted" },
  { key: "resumeReceived", label: "Candidate Resume Uploaded" },
  { key: "medicalReceived", label: "Medical Release Uploaded" },
  { key: "voterReceived", label: "Voter Registration Uploaded" },
  { key: "transcriptReceived", label: "University Documents Received" }
];
var STATUS = {
  RECEIVED: { key: "received", label: "Received", tone: "neutral" },
  REVIEW: { key: "review", label: "Under Review", tone: "info" },
  MISSING: { key: "missing", label: "Missing Docs", tone: "warn" },
  COMPLETE: { key: "complete", label: "Complete", tone: "ok" },
  CLEARED: { key: "cleared", label: "Cleared for Intake", tone: "gold" }
};
var STATUS_LIST = Object.values(STATUS);
function statusByKey(key) {
  return STATUS_LIST.find((s) => s.key === key) || STATUS.RECEIVED;
}
var CHAPTERS = {
  "alpha-sigma": { key: "alpha-sigma", name: "Alpha Sigma", type: "collegiate", school: "Wiley College", area: 4043, city: "Marshall" },
  "delta": { key: "delta", name: "Delta", type: "collegiate", school: "Huston-Tillotson University", area: 4046, city: "Austin" },
  "delta-theta": { key: "delta-theta", name: "Delta Theta", type: "collegiate", school: "Texas Southern University", area: 4048, city: "Houston" },
  "epsilon-iota": { key: "epsilon-iota", name: "Epsilon Iota", type: "collegiate", school: "University of Texas at Austin", area: 4046, city: "Austin" },
  "epsilon-rho": { key: "epsilon-rho", name: "Epsilon Rho", type: "collegiate", school: "Lamar University", area: 4050, city: "Beaumont" },
  "epsilon-sigma": { key: "epsilon-sigma", name: "Epsilon Sigma", type: "collegiate", school: "University of Texas at San Antonio", area: 4047, city: "San Antonio", inactive: true },
  "eta-epsilon": { key: "eta-epsilon", name: "Eta Epsilon", type: "collegiate", school: "University of North Texas", area: 4041, city: "Denton" },
  "eta-gamma": { key: "eta-gamma", name: "Eta Gamma", type: "collegiate", school: "Prairie View A&M University", area: 4049, city: "Prairie View" },
  "eta-mu": { key: "eta-mu", name: "Eta Mu", type: "collegiate", school: "University of Houston", area: 4048, city: "Houston" },
  "eta-psi": { key: "eta-psi", name: "Eta Psi", type: "collegiate", school: "Texas Christian University", area: 4042, city: "Fort Worth", inactive: true },
  "eta-upsilon": { key: "eta-upsilon", name: "Eta Upsilon", type: "collegiate", school: "Texas Tech University", area: 4051, city: "Lubbock" },
  "gamma-alpha": { key: "gamma-alpha", name: "Gamma Alpha", type: "collegiate", school: "Texas College", area: 4043, city: "Tyler", inactive: true },
  "iota-kappa": { key: "iota-kappa", name: "Iota Kappa", type: "collegiate", school: "Paul Quinn College", area: 4041, city: "Dallas" },
  "iota-mu": { key: "iota-mu", name: "Iota Mu", type: "collegiate", school: "Stephen F. Austin State University", area: 4043, city: "Nacogdoches" },
  "mu-nu": { key: "mu-nu", name: "Mu Nu", type: "collegiate", school: "Texas State University", area: 4046, city: "San Marcos" },
  "pi-omicron": { key: "pi-omicron", name: "Pi Omicron", type: "collegiate", school: "Texas A&M University", area: 4049, city: "College Station" },
  "sigma-epsilon": { key: "sigma-epsilon", name: "Sigma Epsilon", type: "collegiate", school: "Tarleton State University", area: 4042, city: "Stephenville" },
  "tau-alpha": { key: "tau-alpha", name: "Tau Alpha", type: "collegiate", school: "Baylor University", area: 4045, city: "Waco" },
  "tau-tau": { key: "tau-tau", name: "Tau Tau", type: "collegiate", school: "Houston Christian University", area: 4050, city: "Houston" },
  "tau-xi": { key: "tau-xi", name: "Tau Xi", type: "collegiate", school: "University of Texas at Dallas", area: 4041, city: "Richardson", inactive: true },
  "theta-alpha": { key: "theta-alpha", name: "Theta Alpha", type: "collegiate", school: "Jarvis Christian College", area: 4043, city: "Hawkins", inactive: true },
  "theta-mu": { key: "theta-mu", name: "Theta Mu", type: "collegiate", school: "Sam Houston State University", area: 4050, city: "Huntsville" },
  "upsilon-mu": { key: "upsilon-mu", name: "Upsilon Mu", type: "collegiate", school: "Southern Methodist University", area: 4041, city: "Dallas" },
  "zeta-chi": { key: "zeta-chi", name: "Zeta Chi", type: "collegiate", school: "University of Texas at Arlington", area: 4042, city: "Arlington" },
  "zeta-tau": { key: "zeta-tau", name: "Zeta Tau", type: "collegiate", school: "Texas A&M University-Commerce", area: 4041, city: "Commerce" },
  "alpha-eta-lambda": { key: "alpha-eta-lambda", name: "Alpha Eta Lambda", type: "alumni", school: null, area: 4048, city: "Houston" },
  "alpha-sigma-lambda": { key: "alpha-sigma-lambda", name: "Alpha Sigma Lambda", type: "alumni", school: null, area: 4041, city: "Dallas" },
  "beta-tau-lambda": { key: "beta-tau-lambda", name: "Beta Tau Lambda", type: "alumni", school: null, area: 4042, city: "Fort Worth" },
  "delta-rho-lambda": { key: "delta-rho-lambda", name: "Delta Rho Lambda", type: "alumni", school: null, area: 4047, city: "San Antonio" },
  "epsilon-epsilon-lambda": { key: "epsilon-epsilon-lambda", name: "Epsilon Epsilon Lambda", type: "alumni", school: null, area: 4045, city: "Waco" },
  "epsilon-phi-lambda": { key: "epsilon-phi-lambda", name: "Epsilon Phi Lambda", type: "alumni", school: null, area: 4042, city: "Grapevine" },
  "epsilon-tau-lambda": { key: "epsilon-tau-lambda", name: "Epsilon Tau Lambda", type: "alumni", school: null, area: 4049, city: "Prairie View" },
  "gamma-eta-lambda": { key: "gamma-eta-lambda", name: "Gamma Eta Lambda", type: "alumni", school: null, area: 4046, city: "Austin" },
  "gamma-pi-lambda": { key: "gamma-pi-lambda", name: "Gamma Pi Lambda", type: "alumni", school: null, area: 4048, city: "Galveston" },
  "gamma-tau-lambda": { key: "gamma-tau-lambda", name: "Gamma Tau Lambda", type: "alumni", school: null, area: 4050, city: "Port Arthur" },
  "gamma-upsilon-lambda": { key: "gamma-upsilon-lambda", name: "Gamma Upsilon Lambda", type: "alumni", school: null, area: 4041, city: "Desoto" },
  "kappa-sigma-lambda": { key: "kappa-sigma-lambda", name: "Kappa Sigma Lambda", type: "alumni", school: null, area: 4045, city: "Killeen" },
  "mu-rho-lambda": { key: "mu-rho-lambda", name: "Mu Rho Lambda", type: "alumni", school: null, area: 4043, city: "Longview" },
  "nu-pi-lambda": { key: "nu-pi-lambda", name: "Nu Pi Lambda", type: "alumni", school: null, area: 4042, city: "Arlington" },
  "nu-sigma-lambda": { key: "nu-sigma-lambda", name: "Nu Sigma Lambda", type: "alumni", school: null, area: 4043, city: "Tyler" },
  "omicron-epsilon-lambda": { key: "omicron-epsilon-lambda", name: "Omicron Epsilon Lambda", type: "alumni", school: null, area: 4051, city: "Amarillo" },
  "pi-alpha-lambda": { key: "pi-alpha-lambda", name: "Pi Alpha Lambda", type: "alumni", school: null, area: 4049, city: "College Station" },
  "pi-theta-lambda": { key: "pi-theta-lambda", name: "Pi Theta Lambda", type: "alumni", school: null, area: 4047, city: "San Antonio" },
  "rho-nu-lambda": { key: "rho-nu-lambda", name: "Rho Nu Lambda", type: "alumni", school: null, area: 4041, city: "Carrollton" },
  "sigma-gamma-lambda": { key: "sigma-gamma-lambda", name: "Sigma Gamma Lambda", type: "alumni", school: null, area: 4050, city: "Cypress" },
  "tau-omicron-lambda": { key: "tau-omicron-lambda", name: "Tau Omicron Lambda", type: "alumni", school: null, area: 4048, city: "Rosharon" },
  "tau-pi-lambda": { key: "tau-pi-lambda", name: "Tau Pi Lambda", type: "alumni", school: null, area: 4043, city: "Mount Pleasant" },
  "theta-delta-lambda": { key: "theta-delta-lambda", name: "Theta Delta Lambda", type: "alumni", school: null, area: 4044, city: "El Paso" },
  "xi-eta-lambda": { key: "xi-eta-lambda", name: "Xi Eta Lambda", type: "alumni", school: null, area: 4050, city: "Houston" },
  "xi-kappa-lambda": { key: "xi-kappa-lambda", name: "Xi Kappa Lambda", type: "alumni", school: null, area: 4048, city: "Houston" },
  "xi-tau-lambda": { key: "xi-tau-lambda", name: "Xi Tau Lambda", type: "alumni", school: null, area: 4041, city: "Richardson" },
  "zeta-tau-lambda": { key: "zeta-tau-lambda", name: "Zeta Tau Lambda", type: "alumni", school: null, area: 4048, city: "League City" }
};
var DISTRICT = {
  name: "Texas Council of Alpha Chapters",
  region: "Southwestern",
  areaNames: {
    "4041": "Area 4041 \xB7 Dallas / Metroplex",
    "4042": "Area 4042 \xB7 Fort Worth / Arlington",
    "4043": "Area 4043 \xB7 East Texas",
    "4044": "Area 4044 \xB7 West Texas / El Paso",
    "4045": "Area 4045 \xB7 Central Texas / Waco",
    "4046": "Area 4046 \xB7 Austin",
    "4047": "Area 4047 \xB7 San Antonio",
    "4048": "Area 4048 \xB7 Houston",
    "4049": "Area 4049 \xB7 Prairie View / Bryan-College Station",
    "4050": "Area 4050 \xB7 Gulf Coast / Beaumont",
    "4051": "Area 4051 \xB7 Panhandle / Lubbock"
  }
};
var OFFICERS = {
  escalante: { id: "escalante", name: "Bro. Adrian Escalante", title: "District Director", initials: "AE", scope: "all", tier: "district" },
  bernard: { id: "bernard", name: "Bro. William Bernard", title: "Chief Dean of Membership Intake \xB7 Area 2 Director", initials: "WB", scope: "all", tier: "district" },
  carroll: { id: "carroll", name: "Bro. Mancil Carroll", title: "Chief Administrator", initials: "MC", scope: "all", tier: "district" },
  // Area 1 · Dallas
  "tanner-4041": { id: "tanner-4041", name: "Bro. Theo Tanner", title: "Area Director / Chief Dean", area: 4041, initials: "TT", scope: [4041], tier: "area" },
  "carroll-4041": { id: "carroll-4041", name: "Bro. Mancil Carroll", title: "Assistant Area Director", area: 4041, initials: "MC", scope: [4041], tier: "area" },
  // Area 2 · Arlington / Fort Worth / Grapevine — Director/Chief Dean is Bernard (district account above)
  "cathey-4042": { id: "cathey-4042", name: "Bro. Victor Cathey", title: "Assistant Area Director", area: 4042, initials: "VC", scope: [4042], tier: "area" },
  "corzine-4042": { id: "corzine-4042", name: "Bro. Jay Corzine", title: "Assistant Area Director", area: 4042, initials: "JC", scope: [4042], tier: "area" },
  // Area 3 · Longview / Tyler / Northeast TX
  "norman-4043": { id: "norman-4043", name: "Bro. Shiro Norman", title: "Area Director / Chief Dean", area: 4043, initials: "SN", scope: [4043], tier: "area" },
  // Area 4 · El Paso
  "wheaton-4044": { id: "wheaton-4044", name: "Bro. James Wheaton", title: "Area Director / Chief Dean", area: 4044, initials: "JW", scope: [4044], tier: "area" },
  // Area 5 · Central TX
  "dixon-4045": { id: "dixon-4045", name: "Bro. Dwight Dixon", title: "Area Director / Chief Dean", area: 4045, initials: "DD", scope: [4045], tier: "area" },
  // Area 6 · Austin / San Marcos
  "wooten-4046": { id: "wooten-4046", name: "Bro. Keith Wooten", title: "Area Director / Chief Dean", area: 4046, initials: "KW", scope: [4046], tier: "area" },
  // Area 7 · San Antonio — Bishop holds both Area Director and Chief Dean
  "bishop-4047": { id: "bishop-4047", name: "Bro. Trent Bishop", title: "Area Director / Chief Dean", area: 4047, initials: "TB", scope: [4047], tier: "area" },
  "renteria-4047": { id: "renteria-4047", name: "Bro. Anthony Renteria", title: "Assistant Area Director", area: 4047, initials: "AR", scope: [4047], tier: "area" },
  // Area 8 · Houston
  "neal-4048": { id: "neal-4048", name: "Bro. Frank Neal", title: "Area Director / Chief Dean", area: 4048, initials: "FN", scope: [4048], tier: "area" },
  "green-4048": { id: "green-4048", name: "Bro. Darryl Green", title: "Assistant Area Director", area: 4048, initials: "DG", scope: [4048], tier: "area" },
  // Area 9 · College Station / Prairie View
  "carter-4049": { id: "carter-4049", name: "Bro. Adrian Carter", title: "Area Director / Chief Dean", area: 4049, initials: "AC", scope: [4049], tier: "area" },
  // Area 10 · Southeastern TX
  "oliver-4050": { id: "oliver-4050", name: "Bro. Wayne Oliver", title: "Area Director / Chief Dean", area: 4050, initials: "WO", scope: [4050], tier: "area" },
  "bates-4050": { id: "bates-4050", name: "Bro. Christopher Bates", title: "Assistant Area Director", area: 4050, initials: "CB", scope: [4050], tier: "area" },
  // Area 11 · Lubbock / Amarillo — Director and Chief Dean are two different officers
  "smith-4051": { id: "smith-4051", name: "Bro. Ron Smith", title: "Area Director", area: 4051, initials: "RS", scope: [4051], tier: "area" },
  "love-4051": { id: "love-4051", name: "Bro. George Love", title: "Chief Dean", area: 4051, initials: "GL", scope: [4051], tier: "area" }
};
function officerCanSeeArea(officer, area) {
  if (!officer) return true;
  if (officer.scope === "all") return true;
  return Array.isArray(officer.scope) && officer.scope.includes(area);
}
function officerCanSeeChapterKey(officer, chapterKey) {
  const ch = CHAPTERS[chapterKey];
  if (!ch) return true;
  return officerCanSeeArea(officer, ch.area);
}
function getChapter(chapterKey) {
  return CHAPTERS[chapterKey] || {
    key: chapterKey,
    name: "Unassigned",
    type: "alumni",
    school: null,
    area: 0,
    city: ""
  };
}

// src/lib/session.ts
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
var COOKIE_NAME = "apa_session";
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function setSession(c, secret, officerId) {
  const sig = await hmac(secret, officerId);
  setCookie(c, COOKIE_NAME, `${officerId}.${sig}`, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}
async function readSession(c, secret) {
  const raw = getCookie(c, COOKIE_NAME);
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const officerId = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = await hmac(secret, officerId);
  if (expected !== sig) return null;
  return officerId;
}
function clearSession(c) {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

// src/lib/db.ts
import postgres from "postgres";

// shared/word-count.ts
var MIN_ESSAY_WORDS = 300;
function countWords(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
function normalizeForCompare(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}
function lettersAreDuplicate(a, b) {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = (/* @__PURE__ */ new Set([...wordsA, ...wordsB])).size;
  return union > 0 && intersection / union >= 0.85;
}
function computeSponsorRecommenderCheck(sponsor, recommender) {
  const sponsorLetter = sponsor?.letter?.trim() || "";
  const recommenderLetter = recommender?.letter?.trim() || "";
  if (!sponsor && !recommender) {
    return { state: "flag", value: "Neither a sponsor nor a recommender has been assigned" };
  }
  if (!sponsor || !sponsorLetter) {
    return { state: "flag", value: "Sponsor letter has not been submitted" };
  }
  if (!recommender || !recommenderLetter) {
    return { state: "flag", value: "Recommender letter has not been submitted" };
  }
  const sponsorWords = countWords(sponsorLetter);
  const recommenderWords = countWords(recommenderLetter);
  const sponsorShort = sponsorWords < MIN_ESSAY_WORDS;
  const recommenderShort = recommenderWords < MIN_ESSAY_WORDS;
  if (sponsorShort && recommenderShort) {
    return { state: "warn", value: `Both letters are under ${MIN_ESSAY_WORDS} words (sponsor: ${sponsorWords}, recommender: ${recommenderWords})` };
  }
  if (sponsorShort) {
    return { state: "warn", value: `Sponsor letter is ${sponsorWords} words \u2014 below the ${MIN_ESSAY_WORDS}-word minimum` };
  }
  if (recommenderShort) {
    return { state: "warn", value: `Recommender letter is ${recommenderWords} words \u2014 below the ${MIN_ESSAY_WORDS}-word minimum` };
  }
  if (lettersAreDuplicate(sponsorLetter, recommenderLetter)) {
    return { state: "warn", value: "Sponsor and recommender letters appear to be the same text \u2014 they must be distinct" };
  }
  return { state: "ok", value: `Sponsor ${sponsorWords} words \xB7 Recommender ${recommenderWords} words \xB7 both distinct` };
}

// shared/seed-candidates.ts
function baseDocs(chapterType, overrides = {}) {
  const base = {};
  requiredDocsFor(chapterType).forEach((d) => {
    base[d.key] = { present: true, valid: true, note: null, file: null };
  });
  Object.entries(overrides).forEach(([k, v]) => {
    base[k] = { ...base[k], ...v };
  });
  return base;
}
var NAZHIR_FILES = {
  application: "/static/pdfs/2897040/Application.pdf",
  essay: "/static/pdfs/2897040/Essay.pdf",
  resume: "/static/pdfs/2897040/Resume.pdf",
  transcript: "/static/pdfs/2897040/Transcript.pdf",
  medical: "/static/pdfs/2897040/Medical.pdf",
  voter: "/static/pdfs/2897040/Voter.pdf"
};
var genericLetter = (kind) => kind === "sponsor" ? "Brothers of the Committee, it is my honor to formally sponsor this candidate for membership in Alpha Phi Alpha Fraternity, Inc. I have known this candidate personally and take responsibility for their character and readiness. \u2014 [Full sponsor letter embedded in Section: Sponsor of the application PDF.]" : "Brothers of the Committee, I write in strong recommendation of this candidate. I have observed their scholarship, service, and comportment among men of substance. \u2014 [Full recommendation embedded in Section: Recommender of the application PDF.]";
var GENERIC_SPONSOR_RECOMMENDER_CHECK = computeSponsorRecommenderCheck(
  { name: "", chapter: "", role: "", email: "", phone: "", relationship: "", letter: genericLetter("sponsor") },
  { name: "", chapter: "", role: "", email: "", phone: "", relationship: "", letter: genericLetter("recommender") }
);
var fullWorkflow = (overrides = {}) => ({
  pretest: { done: true },
  appSubmitted: { done: true },
  backgroundCheck: { done: true, value: "Green" },
  membershipFees: { done: true, value: "Balance: $0.00" },
  ddApproval: { done: true },
  hqApproval: { done: true },
  sponsorAssigned: { done: true },
  recommenderAssigned: { done: true },
  essayReceived: { done: true },
  resumeReceived: { done: true },
  medicalReceived: { done: true },
  voterReceived: { done: true },
  transcriptReceived: { done: true },
  ...overrides
});
var NAZHIR = {
  id: "2897040",
  fullId: "TX-2025-2897040",
  name: "Nazhir Dejean Carter",
  initials: "NC",
  dob: "2002",
  email: "carternazhir@gmail.com",
  phone: "(469) 980-6735",
  address: "5832 Stratford Ln, The Colony, TX 75056",
  school: "Prairie View A&M University",
  major: "Mass Communications",
  minor: "Music",
  classification: "Alumni",
  gpa: 3.5,
  gradDate: "May 2024",
  submitted: "2025-09-07",
  lastUpdated: "2025-11-14",
  lastActivity: "2026-07-28",
  term: "2025 FALL",
  status: STATUS.REVIEW,
  chapterKey: "rho-nu-lambda",
  chapterType: "alumni",
  ddrvpDecision: "approved-pending-fees",
  ddrvpComment: "Approved pending payment of fees.",
  ddrvpBy: "Bro. Mancil Carroll \xB7 Chief Administrator",
  workflow: {
    pretest: { done: true, value: "100% \xB7 took 16 minutes" },
    appSubmitted: { done: true },
    backgroundCheck: { done: true, value: "Green" },
    membershipFees: { done: true, value: "Balance: $0.00" },
    ddApproval: { done: true, value: "Approved pending fees" },
    hqApproval: { done: true },
    sponsorAssigned: { done: true, value: "Sibley, Roderick L." },
    recommenderAssigned: { done: true, value: "Johnson, Delbert C." },
    essayReceived: { done: true },
    resumeReceived: { done: true },
    medicalReceived: { done: true },
    voterReceived: { done: true },
    transcriptReceived: { done: true }
  },
  sponsor: {
    name: "Bro. Roderick L. Sibley",
    chapter: "Rho Nu Lambda",
    initDate: "unknown",
    role: "Chapter Brother",
    email: "r.sibley@rhonulambda.org",
    phone: "(214) 555-0140",
    relationship: "Sponsor \xB7 Chapter Brother",
    letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)",
    letter: `Greetings, Sponsorship is not just providing support. It's an investment into the promise of tomorrow and a belief in potential. I am Brother Roderick L. Sibley, and it is with great enthusiasm that I submit this letter, acknowledging my sponsorship of Mr. Nazhir D. Carter. My personal commitment to support Nazhir is influenced by the essence of our mission, supporting his ambitions to serve with others, promoting academic excellence, encouraging personal growth, and upholding the dignity of himself and other individuals. When I think about a young man who best exemplifies being an overcomer, when faced with obstacles and adversity, that is Nazhir Carter. One of the main compliments to this young man is that he hasn't allowed his disability to prevent him from accomplishing his goals and admirations in life. He excelled as a student athlete, while being an Honor student and has since continued to follow his dreams, leveraging his professional background to fuel his ambitions as a professional track and field athlete. He continues to impress me with his maturity, vision, and personal sense of responsibility towards making an impact on the world. His dedication to serving, passion for the arts, and his determination as an athlete is remarkable. Nazhir is a proud 2024 Cum Laude graduate of Prairie View A&M University (PVAMU) where he earned his B.A. in Mass Communications and a minor in Music. He achieved academic excellence as a Dean's List scholar and was inducted into multiple academic national honor societies within his area of study. Nazhir's academic achievements not only kept him on track to graduate on time but also graduated one hundred percent debt free, the first to achieve this status in his family. As an Academic Enrichment Specialist with Lewisville Independent School District, Nazhir has been responsible for developing engaging activities and innovative lesson plans that foster critical thinking and growth in middle school students. However, his dedication to our youth extends beyond his commitment to the academic community. As a professional athlete, Nazhir carries a passion for youth development, which is evident through his roles as an Athletic Development Specialist, Youth Coach, and his work with the Texas Legends G League in Frisco, Tx. He has implemented programs that enhance performance while instilling confidence, leadership, and resilience in young athletes. Having the examples of his father, myself as his stepfather, and other influential men in his life who are members of Alpha Phi Alpha Fraternity, Inc. set the tone for his ambitions. He is a former member of Rho Nu Lambda's Alpha Scholars Mentoring Program, where he developed life skills and learned the importance of brotherhood. While at PVAMU, Nazhir was a member of the NAACP, National Association of Black Journalists (NABJ), and supported several community service initiatives, both on and off campus within the greater Houston area. Nazhir currently provides technical experience in audio/visual production and event coordination through active service in his church's media ministry. He's also worked with elementary school students within Carrollton/Farmers Branch ISD, has volunteered with the Karen Hands Foundation providing clothing and meals for underserved families within the Dallas area, and supported the G.I.F.T.4.S. Academy, affiliated with the Michael Finley Foundation. Nazhir is the epitome of the kind of young man that this world will need as a future leader and role model for his generation. His courageous approach to life and his faith will continue to allow him to excel. I have witnessed Nazhir's journey, maturing and preparing himself for greater opportunities. This is a young man who decided, "Faith without works is dead" and has pushed himself in areas where others have quit. I am honored to have the opportunity to serve as a sponsor for Mr. Nazhir Carter. Thank you for your time and consideration with this matter.`
  },
  recommender: {
    name: "Bro. Delbert C. Johnson",
    chapter: "Rho Nu Lambda",
    initDate: "unknown",
    role: "Chairman, Scholarship Committee \u2014 Onward and Upward Empowerment Foundation",
    email: "d.johnson@rhonulambda.org",
    phone: "(214) 555-0155",
    relationship: "Recommender \xB7 Chapter Brother",
    letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)",
    letter: "Does the candidate possess the character and moral reputation desired of a member of Alpha Phi Alpha Fraternity, Inc? To my brothers of Alpha Phi Alpha Fraternity, Inc. It is with pride that I submit my recommendation of Nazhir Carter as he pursues membership into our great fraternity. I've had the opportunity to watch Nazhir's growth from a scholarship recipient from my chapters Foundation for his academic excellence in pursuit of his scholastic endeavors, to graduating and becoming a thriving young man with grit, tenacity and passion for serving others in his community. His character and heart for underserved people says to me without any doubt he possess the character and reputation desired of any man seeking membership into our esteemed fraternal organization. Does the candidate possess academic, and leadership qualities desired of a member of Alpha Phi Alpha Fraternity, Inc? Yes, Nazhir is a proud graduate of Prairie View A&M University, where he earned a B.A. in Mass Communications, displaying academic excellence as a Dean's List scholar and being selected to become a member of multiple national honor societies within his area of study. Along with his academic accolades, Nazhir achieved remarkable success as a track and field student athlete, securing three (3) SWAC Championships, representing a high standard of discipline, teamwork, and perseverance. As a professional, Nazhir carries a passion for youth development that is evident through his roles as an Athletic Development Specialist, Youth Coach, and his work with the Texas Legends G League in Frisco, Tx. He has implemented programs that enhance performance while instilling confidence, leadership and resilience in young athletes. In all, I do believe Nazhir possess the character, and leadership capabilities of an Alpha man. How are you acquainted with the candidate and describe the candidate's involvement in school/community? I became acquainted with Nazhir Carter in 2020 when he applied for a scholarship funded by The Onward and Upward Empowerment Foundation which is the 501c3 of the Rho Nu Lambda Chapter. During this time, I served as the chairman of the Scholarship Committee. His impressive academic record and essay awarded him a scholarship to pursue his education at Prairie View A&M University. After graduating, Nazhir returned to the DFW area has involved himself in the support of the very Foundation that awarded him through volunteerism and service to some of our Foundations partnerships. I've come to admire Nazhir's commitment to service to others and dedication to making positive changes in society. The core values of Nazhir I've come to know align with the aims of our fraternity, Manly Deeds, Scholarship and Love for all mankind."
  },
  // OCR'd from the real Essay.pdf on file for this candidate (see
  // extractPdfText in src/lib/pdf-parse.ts) -- future uploads populate this
  // field automatically; this one predates that upload path.
  essayText: `"Why I desire to be an Alpha man and the contributions that I would bring to Alpha Phi Alpha."

It is with great respect and fortitude that I express my sincere interest in becoming a member of Alpha Phi Alpha Fraternity, Inc., an organization that is dedicated to developing leaders, promoting brotherhood and academic excellence, while providing service and advocacy for their communities.

Growing up in The Colony, Texas, the values of humility, integrity, and persistence were instilled in me. That sense of purpose shaped my identity, and today, I seek to align myself with like-minded men who hold themselves to a high standard of scholarly excellence and service. Now, I am a proud 2024 Cum Laude graduate of Prairie View A&M University (PVAMU), where I earned my B.A. in Mass Communications and a minor in Music in the spring of 2024. After leaving PVAMU, I held the position of Academic Enrichment Specialist, with Lewisville Independent School District, where I was responsible for preparing lesson plans that promote engagement and growth for middle school students. This opportunity helped develop my competency in creating curriculum materials, a skill I can leverage when working with youth programs. With my understanding of the organization's commitment to mentoring through programs such as Go to High School, Go to College and Project Alpha, I aspire to integrate myself into supporting these agendas.

My passion for developing our youth extends beyond my background within the academic community. I am currently pursuing an opportunity as a professional track and field athlete, while holding a position as an Athletic Development Specialist and Youth Coach with the Texas Legends G League in Frisco, Tx. Again, this is another platform where I have implemented programs that enhance performance while instilling confidence, leadership, and resilience in young athletes. I envision not only leveraging my skills of program development that connect with youth, but to also support and develop a broader scoped program that promotes health and wellness, both physically and mentally for adults. I have come to notice how Alpha Phi Alpha Fraternity, Inc. has refocused efforts and resources to become a more vocal advocate for health and wellness initiatives. The African American community needs more of our community leaders driving initiatives such as this. Given my network within the track and field space and professional connections with athletic programs, this is an area where I can contribute to the organization and bridge access.

When asked the question, why do I want to be a member of Alpha Phi Alpha Fraternity, Inc., my answer includes examples of legacy, inspiration, and heartfelt support. I was introduced to the organization by way of the examples set by my father, stepfather, and other influential men in my life, men I deeply respect and admire. As a young man, I once asked my father, "What do those letters on your shirt mean?" He replied, "Son, one day when you are ready, you will find out for yourself." That moment left a lasting impression, igniting a curiosity that eventually progressed into intentional action. Eventually, during my senior year of high school, I joined the Alpha Scholars Mentoring Program, sponsored by the Rho Nu Lambda Chapter, in Carrollton, Tx. This experience left a lasting impact on my pursuit of education, providing me with life skills that would help carry me through. In both instances, there were countless Alpha men that I respected that shared common traits: a commitment to excellence, a presence that commands respect, and an ability to lead with conviction. These are qualities I have worked to cultivate within myself through my collegiate, professional, and civic experiences. As I continue to give back through community service, fundraising, and partnerships with organizations like the Karen's Hands Foundation and the NAACP, continuing to align with such efforts illustrates my larger commitment to service, making an impact, and continuing to build upon the legacy that came before me.

I believe I possess the strengths, humility, and drive to grow alongside the distinguished men of Alpha Phi Alpha Fraternity, Inc, and I am committed to refining my weaknesses to become a better servant, leader, and brother. I understand that life will challenge us all but knowing that I could have a brother beside me, and be that brother for someone else, is a powerful source of strength and purpose. To me, brotherhood means loyalty without condition, empathy without judgment, and showing up when it matters most. That is the kind of man I strive to be, and the kind of presence I hope to bring to this esteemed fraternity. Thank you for your time, consideration, and for the opportunity to pursue membership in an organization that represents the very best of who I aspire to become.`,
  checks: {
    gpaMin: { pass: true, value: "3.50 > 2.50" },
    signatures: { pass: true, value: "All required signatures present" },
    dates: { pass: true, value: "All dates within window" },
    sponsorRecommender: { state: "ok", value: "Sponsor 627 words \xB7 Recommender 432 words \xB7 both distinct" }
  },
  docs: baseDocs("alumni", {
    application: { file: NAZHIR_FILES.application },
    essay: { file: NAZHIR_FILES.essay },
    resume: { file: NAZHIR_FILES.resume },
    transcript: { file: NAZHIR_FILES.transcript },
    medical: { file: NAZHIR_FILES.medical },
    voter: { file: NAZHIR_FILES.voter },
    nda: { present: false, valid: false, note: "Awaiting NDA execution", file: null },
    headshot: { present: true, valid: true, note: null, file: null }
  }),
  reviewer: "Bro. C. Freeman",
  affiliations: [
    "National Association for the Advancement of Colored People (NAACP)",
    "National Association of Black Journalists (NABJ)",
    "Alpha Kappa Mu National Honor Society",
    "Lambda Pi Eta Communications National Honor Society",
    "Phi Eta Sigma National Honor Society",
    "Chevron Leadership Academy \u2014 Prairie View A&M",
    "Friendship Baptist Church \u2014 Audio/Video Ministry"
  ],
  awards: [
    "NAACP All-American Scholarship Award",
    "2022 SWAC Champion \u2014 Indoor Track & Field",
    "2021\u201322 SWAC Champion \u2014 Outdoor Track & Field",
    "SWAC Commissioner's Honor Roll",
    "PVAMU Dean's List & Honor Roll"
  ],
  employment: "Olympic Fit Performance \u2014 Professional Track & Field Athlete",
  featured: true
};
function person(overrides) {
  const candidate = {
    fullId: `TX-2026-${overrides.id}`,
    initials: overrides.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(""),
    email: "",
    phone: "",
    address: "",
    dob: "",
    minor: "",
    gradDate: "",
    lastUpdated: overrides.submitted || "2026-07-01",
    lastActivity: overrides.lastActivity || "2026-07-01",
    term: "2026 FALL",
    sponsor: null,
    recommender: null,
    docs: baseDocs(overrides.chapterType || "collegiate"),
    reviewer: "Bro. C. Freeman",
    ...overrides
  };
  candidate.checks = {
    ...candidate.checks,
    sponsorRecommender: computeSponsorRecommenderCheck(candidate.sponsor, candidate.recommender)
  };
  return candidate;
}
var SEED_CANDIDATES = [
  NAZHIR,
  person({
    id: "2897041",
    name: "Marcus J. Whitfield",
    school: "Prairie View A&M University",
    classification: "Junior",
    major: "Political Science",
    gpa: 3.68,
    submitted: "2026-07-12",
    status: STATUS.CLEARED,
    chapterKey: "eta-gamma",
    chapterType: "collegiate",
    sponsor: { name: "Bro. Christopher Freeman", chapter: "Delta Sigma Lambda", initDate: "Spring 1995", role: "District DoM", email: "freeman@deltasigmalambda.org", phone: "(713) 555-0401", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Solomon Whitaker", chapter: "Pi Theta Lambda", initDate: "Fall 1992", role: "Historian", email: "whitaker@kappadeltalambda.org", phone: "(832) 555-0501", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.68 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow(),
    lastActivity: "2026-07-28"
  }),
  person({
    id: "2897042",
    name: "Terrell A. Brooks",
    school: "Texas Southern University",
    classification: "Senior",
    major: "Finance",
    gpa: 3.91,
    submitted: "2026-07-08",
    status: STATUS.COMPLETE,
    chapterKey: "delta-theta",
    chapterType: "collegiate",
    sponsor: { name: "Bro. James O. Randolph", chapter: "Alpha Sigma Lambda", initDate: "Spring 2005", role: "Treasurer", email: "randolph@sigmalambda.org", phone: "(713) 555-0402", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Dr. Kwame Osei", chapter: "Alpha Eta Lambda", initDate: "Spring 1988", role: "Past District Director", email: "osei@alphaetalambda.org", phone: "(832) 555-0502", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.91 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow(),
    lastActivity: "2026-07-29"
  }),
  person({
    id: "2897043",
    name: "Devon R. Carter",
    school: "University of Houston",
    classification: "Junior",
    major: "Computer Science",
    gpa: 3.24,
    submitted: "2026-07-15",
    status: STATUS.MISSING,
    chapterKey: "eta-mu",
    chapterType: "collegiate",
    sponsor: { name: "Bro. Anthony Reeves", chapter: "Xi Kappa Lambda", initDate: "Fall 1994", role: "Financial Secretary", email: "reeves@zetakappalambda.org", phone: "(713) 555-0403", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Damon T. Ellsworth", chapter: "Beta Tau Lambda", initDate: "Fall 1999", role: "Chapter President", email: "ellsworth@piiotalambda.org", phone: "(832) 555-0503", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.24 \u2265 2.50" }, signatures: { pass: false, value: "Signature verification pending on outstanding documents" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow({ membershipFees: { done: false, value: "Balance: $95.00" }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: "100%" } }),
    docs: baseDocs("collegiate", {
      nda: { present: false, valid: false, note: "NDA not received", file: null },
      transcript: { present: false, valid: false, note: "Not received from registrar", file: null }
    }),
    lastActivity: "2026-07-30"
  }),
  person({
    id: "2897044",
    name: "Jalen M. Simmons",
    school: "UT Austin",
    classification: "Sophomore",
    major: "Business Administration",
    gpa: 2.87,
    submitted: "2026-07-18",
    status: STATUS.REVIEW,
    chapterKey: "delta-theta",
    chapterType: "collegiate",
    sponsor: { name: "Bro. Malcolm Prescott", chapter: "Eta Gamma", initDate: "Spring 2018", role: "Chapter Advisor", email: "prescott@etagamma.org", phone: "(713) 555-0404", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Vernon Ashe", chapter: "Delta Theta", initDate: "Fall 2019", role: "Chapter Advisor", email: "ashe@zetagamma.org", phone: "(832) 555-0504", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "2.87 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow(),
    lastActivity: "2026-07-29"
  }),
  person({
    id: "2897045",
    name: "Isaiah K. Bell",
    school: "Texas Tech University",
    classification: "Junior",
    major: "Mechanical Engineering",
    gpa: 3.45,
    submitted: "2026-07-20",
    status: STATUS.MISSING,
    chapterKey: "eta-upsilon",
    chapterType: "collegiate",
    sponsor: { name: "Bro. Dr. Nathaniel Boone", chapter: "Delta Sigma Lambda", initDate: "Spring 1985", role: "Life Member", email: "boone@deltasigmalambda.org", phone: "(713) 555-0405", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Reginald Hollis", chapter: "Xi Kappa Lambda", initDate: "Fall 2001", role: "Dean of Members", email: "hollis@zetakappalambda.org", phone: "(832) 555-0505", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.45 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: false, value: "Medical form dated 2025-11-04 (>6mo old)" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow({ membershipFees: { done: false, value: "Balance: $95.00" }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: "100%" } }),
    docs: baseDocs("collegiate", {
      medical: { present: true, valid: false, note: "Dated 2025-11-04 \u2014 exceeds 6-month window", file: null },
      enrollmentLetter: { present: false, valid: false, note: "Not received", file: null }
    }),
    lastActivity: "2026-07-30"
  }),
  person({
    id: "2897046",
    name: "Andre L. Whitmore",
    school: "University of North Texas",
    classification: "Senior",
    major: "History",
    gpa: 3.72,
    submitted: "2026-07-05",
    status: STATUS.CLEARED,
    chapterKey: "eta-epsilon",
    chapterType: "collegiate",
    sponsor: { name: "Bro. Marcus D. Alston", chapter: "Alpha Eta Lambda", initDate: "Spring 1998", role: "Chapter President", email: "alston@alphaetalambda.org", phone: "(713) 555-0406", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Dr. Terrence Baldwin", chapter: "Gamma Eta Lambda", initDate: "Fall 1989", role: "Past Chapter President", email: "baldwin@iotazetalambda.org", phone: "(832) 555-0506", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.72 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow(),
    lastActivity: "2026-07-27"
  }),
  person({
    id: "2897047",
    name: "Cameron D. Prince",
    school: "Sam Houston State University",
    classification: "Junior",
    major: "Electrical Engineering",
    gpa: 2.41,
    submitted: "2026-07-19",
    status: STATUS.MISSING,
    chapterKey: "theta-mu",
    chapterType: "collegiate",
    sponsor: { name: "Bro. Christopher Freeman", chapter: "Delta Sigma Lambda", initDate: "Spring 1995", role: "District DoM", email: "freeman@deltasigmalambda.org", phone: "(713) 555-0407", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Solomon Whitaker", chapter: "Pi Theta Lambda", initDate: "Fall 1992", role: "Historian", email: "whitaker@kappadeltalambda.org", phone: "(832) 555-0507", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: false, value: "2.41 < 2.50 minimum" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow({ membershipFees: { done: false, value: "Balance: $95.00" }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: "100%" } }),
    docs: baseDocs("collegiate", {
      nda: { present: true, valid: false, note: "Missing initials on p.2", file: null },
      transcript: { present: true, valid: false, note: "GPA 2.41 below 2.50 minimum", file: null },
      voter: { present: false, valid: false, note: "Not submitted", file: null }
    }),
    lastActivity: "2026-07-30"
  }),
  person({
    id: "2897048",
    name: "Malik R. Overton",
    school: "Texas Southern University (2022)",
    classification: "Alumni (Post-Grad)",
    major: "Sociology \xB7 Grad 2022",
    gpa: 3.55,
    submitted: "2026-07-11",
    status: STATUS.COMPLETE,
    chapterKey: "alpha-eta-lambda",
    chapterType: "alumni",
    sponsor: { name: "Bro. Christopher Freeman", chapter: "Delta Sigma Lambda", initDate: "Spring 1995", role: "District DoM", email: "freeman@deltasigmalambda.org", phone: "(713) 555-0412", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Marcus D. Alston", chapter: "Alpha Eta Lambda", initDate: "Spring 1998", role: "Chapter President", email: "alston@alphaetalambda.org", phone: "(832) 555-0512", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.55 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow(),
    lastActivity: "2026-07-28"
  }),
  person({
    id: "2897049",
    name: "Trevor N. Ashford",
    school: "UT Austin",
    classification: "Junior",
    major: "Psychology",
    gpa: 3.12,
    submitted: "2026-07-22",
    status: STATUS.REVIEW,
    chapterKey: "delta-theta",
    chapterType: "collegiate",
    sponsor: { name: "Bro. James O. Randolph", chapter: "Alpha Sigma Lambda", initDate: "Spring 2005", role: "Treasurer", email: "randolph@sigmalambda.org", phone: "(713) 555-0408", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Dr. Kwame Osei", chapter: "Alpha Eta Lambda", initDate: "Spring 1988", role: "Past District Director", email: "osei@alphaetalambda.org", phone: "(832) 555-0508", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.12 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow(),
    lastActivity: "2026-07-30"
  }),
  person({
    id: "2897050",
    name: "Justin E. Broussard",
    school: "University of Houston (2023)",
    classification: "Alumni (Post-Grad)",
    major: "Accounting \xB7 Grad 2023",
    gpa: 3.83,
    submitted: "2026-07-09",
    status: STATUS.CLEARED,
    chapterKey: "xi-kappa-lambda",
    chapterType: "alumni",
    sponsor: { name: "Bro. Reginald Hollis", chapter: "Xi Kappa Lambda", initDate: "Fall 2001", role: "Dean of Members", email: "hollis@zetakappalambda.org", phone: "(713) 555-0413", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. James O. Randolph", chapter: "Alpha Sigma Lambda", initDate: "Spring 2005", role: "Treasurer", email: "randolph@sigmalambda.org", phone: "(832) 555-0513", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.83 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow(),
    lastActivity: "2026-07-26"
  }),
  person({
    id: "2897051",
    name: "Kendrick P. Lyles",
    school: "Prairie View A&M University",
    classification: "Junior",
    major: "Biology",
    gpa: 3.28,
    submitted: "2026-07-24",
    status: STATUS.RECEIVED,
    chapterKey: "eta-gamma",
    chapterType: "collegiate",
    sponsor: { name: "Bro. Anthony Reeves", chapter: "Xi Kappa Lambda", initDate: "Fall 1994", role: "Financial Secretary", email: "reeves@zetakappalambda.org", phone: "(713) 555-0409", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Damon T. Ellsworth", chapter: "Beta Tau Lambda", initDate: "Fall 1999", role: "Chapter President", email: "ellsworth@piiotalambda.org", phone: "(832) 555-0509", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.28 \u2265 2.50" }, signatures: { pass: null, value: "Awaiting review" }, dates: { pass: null, value: "Awaiting review" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow({ backgroundCheck: { done: false, value: "Pending" }, membershipFees: { done: false, value: "Balance: $185.00" }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: "100%" } }),
    lastActivity: "2026-07-24",
    reviewer: "\u2014"
  }),
  person({
    id: "2897052",
    name: "Xavier T. Monroe",
    school: "UT Austin (2024)",
    classification: "Alumni (Post-Grad)",
    major: "Chemistry \xB7 Grad 2024",
    gpa: 3.61,
    submitted: "2026-07-06",
    status: STATUS.COMPLETE,
    chapterKey: "gamma-eta-lambda",
    chapterType: "alumni",
    sponsor: { name: "Bro. Dr. Terrence Baldwin", chapter: "Gamma Eta Lambda", initDate: "Fall 1989", role: "Past Chapter President", email: "baldwin@iotazetalambda.org", phone: "(713) 555-0414", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Damon T. Ellsworth", chapter: "Beta Tau Lambda", initDate: "Fall 1999", role: "Chapter President", email: "ellsworth@piiotalambda.org", phone: "(832) 555-0514", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.61 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow(),
    lastActivity: "2026-07-28"
  }),
  person({
    id: "2897053",
    name: "Ronald S. Petit",
    school: "Texas Southern University",
    classification: "Junior",
    major: "Pre-Med / Biology",
    gpa: 3.94,
    submitted: "2026-07-14",
    status: STATUS.MISSING,
    chapterKey: "delta-theta",
    chapterType: "collegiate",
    sponsor: { name: "Bro. Malcolm Prescott", chapter: "Eta Gamma", initDate: "Spring 2018", role: "Chapter Advisor", email: "prescott@etagamma.org", phone: "(713) 555-0410", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Vernon Ashe", chapter: "Delta Theta", initDate: "Fall 2019", role: "Chapter Advisor", email: "ashe@zetagamma.org", phone: "(832) 555-0510", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.94 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow({ membershipFees: { done: false, value: "Balance: $95.00" }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: "100%" } }),
    docs: baseDocs("collegiate", {
      nda: { present: false, valid: false, note: "NDA pending", file: null },
      headshot: { present: false, valid: false, note: "Not attached", file: null },
      voter: { present: true, valid: false, note: "Expired \u2014 issue 2018", file: null }
    }),
    lastActivity: "2026-07-29"
  }),
  person({
    id: "2897054",
    name: "Elijah W. Grantham",
    school: "Sam Houston State (2025)",
    classification: "Alumni (Post-Grad)",
    major: "Communications \xB7 Grad 2025",
    gpa: 3.05,
    submitted: "2026-07-25",
    status: STATUS.RECEIVED,
    chapterKey: "pi-theta-lambda",
    chapterType: "alumni",
    sponsor: { name: "Bro. Solomon Whitaker", chapter: "Pi Theta Lambda", initDate: "Fall 1992", role: "Historian", email: "whitaker@kappadeltalambda.org", phone: "(713) 555-0415", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Vernon Ashe", chapter: "Delta Theta", initDate: "Fall 2019", role: "Chapter Advisor", email: "ashe@zetagamma.org", phone: "(832) 555-0515", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.05 \u2265 2.50" }, signatures: { pass: null, value: "Awaiting review" }, dates: { pass: null, value: "Awaiting review" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow({ backgroundCheck: { done: false, value: "Pending" }, membershipFees: { done: false, value: "Balance: $185.00" }, ddApproval: { done: false }, hqApproval: { done: false }, medicalReceived: { done: false }, transcriptReceived: { done: false }, pretest: { done: true, value: "100%" } }),
    lastActivity: "2026-07-25",
    reviewer: "\u2014"
  }),
  person({
    id: "2897055",
    name: "Brandon O. Kincaid",
    school: "University of North Texas",
    classification: "Junior",
    major: "Information Systems",
    gpa: 3.37,
    submitted: "2026-07-17",
    status: STATUS.REVIEW,
    chapterKey: "eta-epsilon",
    chapterType: "collegiate",
    sponsor: { name: "Bro. Dr. Nathaniel Boone", chapter: "Delta Sigma Lambda", initDate: "Spring 1985", role: "Life Member", email: "boone@deltasigmalambda.org", phone: "(713) 555-0411", relationship: "Sponsor \xB7 Chapter Brother", letterLocation: "Application PDF \xB7 Section: Sponsor (p. 5)", letter: genericLetter("sponsor") },
    recommender: { name: "Bro. Reginald Hollis", chapter: "Xi Kappa Lambda", initDate: "Fall 2001", role: "Dean of Members", email: "hollis@zetakappalambda.org", phone: "(832) 555-0511", relationship: "Recommender \xB7 Regional Brother", letterLocation: "Application PDF \xB7 Section: Recommender (p. 5)", letter: genericLetter("recommender") },
    checks: { gpaMin: { pass: true, value: "3.37 \u2265 2.50" }, signatures: { pass: true, value: "All required signatures present" }, dates: { pass: true, value: "All dates within window" }, sponsorRecommender: GENERIC_SPONSOR_RECOMMENDER_CHECK },
    workflow: fullWorkflow(),
    lastActivity: "2026-07-30"
  })
];

// src/lib/db.ts
var sql = postgres(process.env.DATABASE_URL || "", {
  prepare: false,
  ssl: "require"
});
var SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS candidates (
  id              TEXT PRIMARY KEY,
  full_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  initials        TEXT NOT NULL,
  chapter_key     TEXT NOT NULL,
  chapter_type    TEXT NOT NULL,
  school          TEXT NOT NULL DEFAULT '',
  gpa             REAL NOT NULL DEFAULT 0,
  status_key      TEXT NOT NULL DEFAULT 'received',
  submitted       TEXT NOT NULL,
  last_activity   TEXT NOT NULL,
  is_new          INTEGER NOT NULL DEFAULT 0,
  data            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidates_chapter ON candidates(chapter_key);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status_key);
CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL PRIMARY KEY,
  candidate_id  TEXT NOT NULL,
  officer_id    TEXT NOT NULL,
  action        TEXT NOT NULL,
  detail        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS officer_credentials (
  officer_id       TEXT PRIMARY KEY,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  password_salt    TEXT NOT NULL,
  iterations       INTEGER NOT NULL DEFAULT 100000,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  must_change      INTEGER NOT NULL DEFAULT 1,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_officer_credentials_email ON officer_credentials(email);
`;
var schemaReady = false;
async function ensureReady() {
  if (!schemaReady) {
    await sql.unsafe(SCHEMA_SQL);
    schemaReady = true;
  }
}
async function upsertCandidateRow(c, db = sql) {
  const rest = { ...c };
  await db`
    INSERT INTO candidates
      (id, full_id, name, initials, chapter_key, chapter_type, school, gpa, status_key, submitted, last_activity, is_new, data)
    VALUES
      (${c.id}, ${c.fullId}, ${c.name}, ${c.initials}, ${c.chapterKey}, ${c.chapterType}, ${c.school}, ${c.gpa}, ${c.status.key}, ${c.submitted}, ${c.lastActivity}, ${c.isNew ? 1 : 0}, ${JSON.stringify(rest)})
    ON CONFLICT (id) DO UPDATE SET
      full_id = EXCLUDED.full_id,
      name = EXCLUDED.name,
      initials = EXCLUDED.initials,
      chapter_key = EXCLUDED.chapter_key,
      chapter_type = EXCLUDED.chapter_type,
      school = EXCLUDED.school,
      gpa = EXCLUDED.gpa,
      status_key = EXCLUDED.status_key,
      submitted = EXCLUDED.submitted,
      last_activity = EXCLUDED.last_activity,
      is_new = EXCLUDED.is_new,
      data = EXCLUDED.data
  `;
}
function withCompleteDocs(docs) {
  const complete = { ...docs || {} };
  for (const d of REQUIRED_DOCS) {
    if (!complete[d.key]) complete[d.key] = { present: false, valid: false, note: null, file: null };
  }
  return complete;
}
function rowToCandidate(row) {
  const data = JSON.parse(row.data);
  return {
    ...data,
    id: row.id,
    fullId: row.full_id,
    name: row.name,
    initials: row.initials,
    chapterKey: row.chapter_key,
    chapterType: row.chapter_type,
    school: row.school,
    gpa: row.gpa,
    status: statusByKey(row.status_key),
    submitted: row.submitted,
    lastActivity: row.last_activity,
    isNew: !!row.is_new,
    docs: withCompleteDocs(data.docs),
    // Recomputed on every read rather than trusted from storage -- the
    // sponsor/recommender letters can change independently of when this
    // check was last saved (e.g. a letter gets extracted from a later
    // application upload), so a stored value would go stale.
    checks: {
      ...data.checks,
      sponsorRecommender: computeSponsorRecommenderCheck(data.sponsor ?? null, data.recommender ?? null)
    }
  };
}
var SORT_MAP = {
  name: "name ASC",
  school: "school ASC",
  gpa: "gpa DESC",
  submitted: "submitted DESC",
  id: "id ASC"
};
async function listCandidates(opts) {
  await ensureReady();
  if (opts.allowedChapterKeys && opts.allowedChapterKeys !== "all" && opts.allowedChapterKeys.length === 0) {
    return [];
  }
  const allowed = opts.allowedChapterKeys && opts.allowedChapterKeys !== "all" ? opts.allowedChapterKeys : null;
  const status = opts.status && opts.status !== "all" ? opts.status : null;
  const type = opts.type && opts.type !== "all" ? opts.type : null;
  const chapterKey = opts.chapterKey && opts.chapterKey !== "all" ? opts.chapterKey : null;
  const like = opts.q ? `%${opts.q}%` : null;
  const orderBy = SORT_MAP[opts.sort || "id"] || SORT_MAP.id;
  const rows = await sql`
    SELECT * FROM candidates
    WHERE (${allowed}::text[] IS NULL OR chapter_key = ANY(${allowed}::text[]))
      AND (${status}::text IS NULL OR status_key = ${status})
      AND (${type}::text IS NULL OR chapter_type = ${type})
      AND (${chapterKey}::text IS NULL OR chapter_key = ${chapterKey})
      AND (${like}::text IS NULL OR name ILIKE ${like} OR school ILIKE ${like} OR id ILIKE ${like} OR full_id ILIKE ${like})
    ORDER BY is_new DESC, ${sql.unsafe(orderBy)}
  `;
  return rows.map(rowToCandidate);
}
async function getCandidate(id) {
  await ensureReady();
  const rows = await sql`SELECT * FROM candidates WHERE id = ${id}`;
  return rows.length ? rowToCandidate(rows[0]) : null;
}
async function candidateExists(id) {
  await ensureReady();
  const rows = await sql`SELECT 1 AS x FROM candidates WHERE id = ${id}`;
  return rows.length > 0;
}
async function insertCandidate(c) {
  await ensureReady();
  await upsertCandidateRow(c);
}
async function insertCandidates(list) {
  await ensureReady();
  if (list.length === 0) return;
  await sql.begin((tx) => Promise.all(list.map((c) => upsertCandidateRow(c, tx))));
}
async function updateCandidateDoc(id, docKey, doc) {
  await ensureReady();
  const existing = await getCandidate(id);
  if (!existing) return null;
  existing.docs = { ...existing.docs, [docKey]: doc };
  existing.lastActivity = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  await upsertCandidateRow(existing);
  return existing;
}
async function updateCandidateFields(id, fields) {
  await ensureReady();
  const existing = await getCandidate(id);
  if (!existing) return null;
  Object.assign(existing, fields);
  await upsertCandidateRow(existing);
  return existing;
}
async function logAudit(candidateId, officerId, action, detail) {
  await ensureReady();
  await sql`INSERT INTO audit_log (candidate_id, officer_id, action, detail) VALUES (${candidateId}, ${officerId}, ${action}, ${detail || null})`;
}
async function getCredentialByOfficerId(officerId) {
  await ensureReady();
  const rows = await sql`SELECT * FROM officer_credentials WHERE officer_id = ${officerId}`;
  return rows[0] || null;
}
async function getCredentialByEmail(email) {
  await ensureReady();
  const rows = await sql`SELECT * FROM officer_credentials WHERE LOWER(email) = LOWER(${email.trim()})`;
  return rows[0] || null;
}
async function listCredentialsMeta() {
  await ensureReady();
  const rows = await sql`
    SELECT officer_id, email, iterations, failed_attempts, locked_until, must_change, updated_at
    FROM officer_credentials
  `;
  return rows;
}
async function upsertCredential(officerId, email, hash, salt, iterations, mustChange) {
  await ensureReady();
  await sql`
    INSERT INTO officer_credentials (officer_id, email, password_hash, password_salt, iterations, failed_attempts, locked_until, must_change, updated_at)
    VALUES (${officerId}, ${email.trim()}, ${hash}, ${salt}, ${iterations}, 0, NULL, ${mustChange ? 1 : 0}, now())
    ON CONFLICT (officer_id) DO UPDATE SET
      email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      iterations = EXCLUDED.iterations,
      failed_attempts = 0,
      locked_until = NULL,
      must_change = EXCLUDED.must_change,
      updated_at = now()
  `;
}
async function recordFailedLogin(officerId, maxAttempts, lockoutMinutes) {
  await ensureReady();
  const row = await getCredentialByOfficerId(officerId);
  if (!row) return;
  const attempts = row.failed_attempts + 1;
  const lockUntil = attempts >= maxAttempts ? new Date(Date.now() + lockoutMinutes * 6e4).toISOString() : null;
  await sql`
    UPDATE officer_credentials
    SET failed_attempts = ${attempts}, locked_until = ${lockUntil}, updated_at = now()
    WHERE officer_id = ${officerId}
  `;
}
async function resetFailedLogins(officerId) {
  await ensureReady();
  await sql`
    UPDATE officer_credentials
    SET failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE officer_id = ${officerId}
  `;
}
async function setPassword(officerId, hash, salt, iterations, mustChange) {
  await ensureReady();
  await sql`
    UPDATE officer_credentials
    SET password_hash = ${hash}, password_salt = ${salt}, iterations = ${iterations}, must_change = ${mustChange ? 1 : 0}, failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE officer_id = ${officerId}
  `;
}

// src/lib/storage.ts
import { createClient } from "@supabase/supabase-js";
var BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
var supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { persistSession: false } }
);
async function putFile(key, data, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(key, data, {
    contentType,
    upsert: true
  });
  if (error) throw error;
}
async function getFile(key) {
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return { body: data, contentType: data.type || "application/octet-stream" };
}

// src/lib/candidate-factory.ts
function makeCandidate(input) {
  const chapter = CHAPTERS[input.chapterKey];
  const initials = (input.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "??";
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const term = input.term || "2026 FALL";
  const fullId = `TX-${term.split(" ")[0]}-${input.id}`;
  const gpa = typeof input.gpa === "number" ? input.gpa : parseFloat(String(input.gpa)) || 0;
  const emptyDocs = {};
  requiredDocsFor(chapter.type).forEach((d) => {
    emptyDocs[d.key] = { present: false, valid: false, note: "Not yet received", file: null };
  });
  const sponsor = input.sponsorName ? {
    name: input.sponsorName.startsWith("Bro.") ? input.sponsorName : `Bro. ${input.sponsorName}`,
    chapter: "Pending confirmation",
    role: "Chapter Brother",
    email: "",
    phone: "",
    relationship: "Sponsor \xB7 Chapter Brother",
    letterLocation: "Application PDF \xB7 Section: Sponsor (pending upload)",
    letter: ""
  } : null;
  const recommender = input.recommenderName ? {
    name: input.recommenderName.startsWith("Bro.") ? input.recommenderName : `Bro. ${input.recommenderName}`,
    chapter: "Pending confirmation",
    role: "Chapter Brother",
    email: "",
    phone: "",
    relationship: "Recommender \xB7 Chapter Brother",
    letterLocation: "Application PDF \xB7 Section: Recommender (pending upload)",
    letter: ""
  } : null;
  const workflow = {
    pretest: { done: false },
    // Only flips true once the Application PDF is actually uploaded (see
    // WORKFLOW_STEP_FOR_DOC in src/index.tsx) -- a bare candidate record
    // (CSV import, manual add) hasn't submitted anything yet.
    appSubmitted: { done: false },
    backgroundCheck: { done: false, value: "Pending" },
    membershipFees: { done: false, value: "Balance pending" },
    ddApproval: { done: false },
    hqApproval: { done: false },
    // Having a name on file isn't the same as having received the actual
    // letter -- this only flips true once a letter is extracted from an
    // uploaded application (see the docKey === 'application' branch in
    // src/index.tsx). A name-only assignment shows as pending, not done.
    sponsorAssigned: { done: false, value: sponsor ? `${sponsor.name} \xB7 awaiting letter` : void 0 },
    recommenderAssigned: { done: false, value: recommender ? `${recommender.name} \xB7 awaiting letter` : void 0 },
    essayReceived: { done: false },
    resumeReceived: { done: false },
    medicalReceived: { done: false },
    voterReceived: { done: false },
    transcriptReceived: { done: false }
  };
  return {
    id: String(input.id),
    fullId,
    name: input.name,
    initials,
    email: input.email || "",
    phone: input.phone || "",
    address: input.address || "",
    dob: input.dob || "",
    school: input.school || "Not specified",
    major: input.major || "Not specified",
    minor: input.minor || "",
    classification: input.classification || "Undergraduate",
    gpa,
    gradDate: input.gradDate || "",
    submitted: today,
    lastUpdated: today,
    lastActivity: today,
    term,
    status: STATUS.RECEIVED,
    chapterKey: input.chapterKey,
    chapterType: chapter?.type || "alumni",
    workflow,
    sponsor,
    recommender,
    checks: {
      gpaMin: { pass: gpa > 2.5, value: gpa > 2.5 ? `${gpa.toFixed(2)} > 2.50` : `${gpa.toFixed(2)} does not exceed the 2.50 minimum` },
      signatures: { pass: null, value: "Awaiting document upload" },
      dates: { pass: null, value: "Awaiting document upload" },
      sponsorRecommender: computeSponsorRecommenderCheck(sponsor, recommender)
    },
    docs: emptyDocs,
    reviewer: "\u2014",
    isNew: true
  };
}
function splitCSVLine(line) {
  const out = [];
  let cur = "";
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
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
function parseCandidateCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], errors: [{ line: 0, message: "CSV must have a header row and at least one data row." }] };
  }
  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  const rows = [];
  const errors = [];
  const required = ["candidateid", "fullname", "email", "school", "chapter"];
  const missing = required.filter((k) => !headers.includes(k));
  if (missing.length) {
    errors.push({ line: 0, message: `Missing required column(s): ${missing.join(", ")}` });
    return { rows: [], errors };
  }
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] || "";
    });
    if (!row.candidateid) {
      errors.push({ line: i + 1, message: "Missing candidate ID" });
      continue;
    }
    if (!row.fullname) {
      errors.push({ line: i + 1, message: "Missing full name" });
      continue;
    }
    if (!row.email || !row.email.includes("@")) {
      errors.push({ line: i + 1, message: "Invalid email" });
      continue;
    }
    if (!row.chapter) {
      errors.push({ line: i + 1, message: "Missing chapter" });
      continue;
    }
    const chapterKey = Object.keys(CHAPTERS).find(
      (k) => CHAPTERS[k].name.toLowerCase() === row.chapter.toLowerCase() || k === row.chapter.toLowerCase().replace(/\s+/g, "-")
    );
    if (!chapterKey) {
      errors.push({ line: i + 1, message: `Unknown chapter "${row.chapter}"` });
      continue;
    }
    rows.push({
      lineNumber: i + 1,
      id: row.candidateid,
      name: row.fullname,
      email: row.email,
      phone: row.phone || "",
      address: row.address || "",
      dob: row.dob || "",
      school: row.school || "",
      major: row.major || "",
      minor: row.minor || "",
      classification: row.classification || (CHAPTERS[chapterKey].type === "alumni" ? "Alumni" : "Undergraduate"),
      gpa: row.gpa || "0",
      gradDate: row.graduationdate || row.graddate || "",
      chapterKey,
      term: row.term || "2026 FALL",
      sponsorName: row.sponsor || row.sponsorname || "",
      recommenderName: row.recommender || row.recommendername || ""
    });
  }
  return { rows, errors };
}
function buildCSVTemplate() {
  const headers = ["Candidate ID", "Full Name", "Email", "Phone", "Address", "DOB", "School", "Major", "Minor", "Classification", "GPA", "Graduation Date", "Chapter", "Term", "Sponsor", "Recommender"];
  const example = [
    ["2897060", "Example Candidate", "example@student.edu", "(214) 555-0100", "123 Main St, Dallas TX", "2003", "UT Austin", "Business", "", "Junior", "3.45", "May 2027", "Delta Theta", "2026 FALL", "Bro. John Smith", "Bro. James Wilson"],
    ["2897061", "Alumni Applicant", "alum@example.com", "(469) 555-0100", "456 Elm St, Dallas TX", "1998", "Prairie View A&M University", "Engineering", "", "Alumni", "3.6", "May 2020", "Rho Nu Lambda", "2026 FALL", "", ""]
  ];
  return [headers, ...example].map((row) => row.map((cell) => /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell).join(",")).join("\n");
}

// src/lib/password.ts
var ITERATIONS = 1e5;
var HASH_BITS = 256;
function toHex(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toHex(arr);
}
var TEMP_PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function randomTempPassword(length = 12) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TEMP_PASSWORD_CHARS[b % TEMP_PASSWORD_CHARS.length]).join("");
}
async function pbkdf2(password, saltHex, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations, hash: "SHA-256" },
    keyMaterial,
    HASH_BITS
  );
  return toHex(bits);
}
async function hashPassword(password) {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return { hash, salt, iterations: ITERATIONS };
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyPassword(password, storedHash, storedSalt, iterations = ITERATIONS) {
  const candidate = await pbkdf2(password, storedSalt, iterations);
  return timingSafeEqual(candidate, storedHash);
}

// src/lib/auth.ts
var OFFICER_EMAILS = {
  escalante: "adrianescalante1906@gmail.com",
  bernard: "Wbernard22@yahoo.com",
  carroll: "revmancil@hotmail.com",
  "tanner-4041": "Pharaoh87@tx.rr.com",
  "carroll-4041": "icecoldrev06@outlook.com",
  "cathey-4042": "victorcathey3@gmail.com",
  "corzine-4042": "zine1906@yahoo.com",
  "norman-4043": "briannorman2@yahoo.com",
  "wheaton-4044": "james.wheaton@hotmail.com",
  "dixon-4045": "threeddixon@hot.rr.com",
  "wooten-4046": "kdw106@sbcglobal.net",
  "bishop-4047": "president@drl1949.com",
  "renteria-4047": "arenteria@humana.com",
  "neal-4048": "fdn1906@att.net",
  "green-4048": "dgreen_77071@yahoo.com",
  "carter-4049": "Mradriancarter@gmail.com",
  "oliver-4050": "wao1906@gmail.com",
  "bates-4050": "cbates2003@gmail.com",
  "smith-4051": "ronnies764@gmail.com",
  "love-4051": "glovehy98@hotmail.com"
};
var MAX_LOGIN_ATTEMPTS = 5;
var LOCKOUT_MINUTES = 15;
var MIN_PASSWORD_LENGTH = 10;

// src/lib/pdf-parse.ts
import * as mupdf from "mupdf";
import { createWorker } from "tesseract.js";
function findHeadshotOnPage(page) {
  const resources = page.getObject().get("Resources");
  const xobjects = resources.get("XObject");
  if (xobjects.isNull()) return null;
  const candidates = [];
  xobjects.forEach((val) => {
    if (!val.isStream()) return;
    if (val.get("Subtype").asName() !== "Image") return;
    const width = val.get("Width").asNumber();
    const height = val.get("Height").asNumber();
    if (!width || !height) return;
    const ratio = width / height;
    if (width < 80 || height < 80 || ratio < 0.6 || ratio > 1.8) return;
    candidates.push({ obj: val, width, height });
  });
  const best = candidates.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!best) return null;
  const filter = best.obj.get("Filter");
  if (!filter.isName() || filter.asName() !== "DCTDecode") return null;
  const raw = best.obj.readRawStream();
  return { bytes: raw.asUint8Array(), contentType: "image/jpeg" };
}
function extractHeadshot(pdfBytes) {
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  const pageCount = Math.min(doc.countPages(), 3);
  for (let i = 0; i < pageCount; i++) {
    const found = findHeadshotOnPage(doc.loadPage(i));
    if (found) return found;
  }
  return null;
}
async function renderPageToPNG(doc, pageIndex, gamma) {
  const page = doc.loadPage(pageIndex);
  const matrix = mupdf.Matrix.scale(2, 2);
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
  if (gamma) pixmap.gamma(gamma);
  return pixmap.asPNG();
}
async function ocrLines(worker, png) {
  const { data } = await worker.recognize(Buffer.from(png));
  return data.text.split("\n").map((l) => l.trim()).filter(Boolean);
}
var LABEL_SETTERS = [
  ["First Name", (f, v) => f.firstName = v],
  ["Middle Name", (f, v) => f.middleName = v],
  ["Last Name", (f, v) => f.lastName = v],
  ["Email", (f, v) => f.email = v],
  ["Mobile/Primary", (f, v) => f.phone = v],
  ["Class", (f, v) => f.classification = /alum/i.test(v) ? "Alumni" : "Undergraduate"],
  ["GPA", (f, v) => f.gpa = normalizeGPA(v)],
  ["Bachelor University", (f, v) => f.school = v],
  ["College Major", (f, v) => f.major = v.replace(/\s*\(Minor\)\s*$/i, "")],
  ["Graduation Year", (f, v) => f.gradDate = v]
];
function normalizeGPA(raw) {
  if (/^\d{3}$/.test(raw)) {
    const asHundredths = parseInt(raw, 10);
    if (asHundredths >= 150 && asHundredths <= 450) return (asHundredths / 100).toFixed(2);
  }
  return raw;
}
var norm = (s) => s.trim().toLowerCase();
function parseLabelValueLines(lines, fields) {
  const labelTexts = new Set(LABEL_SETTERS.map(([label]) => norm(label)));
  for (let i = 0; i < lines.length; i++) {
    const match = LABEL_SETTERS.find(([label]) => norm(lines[i]) === norm(label));
    if (!match) continue;
    const next = lines[i + 1];
    if (next && !labelTexts.has(norm(next))) match[1](fields, next);
  }
}
function parseAddressLines(lines, fields) {
  const valueAfter = (label) => {
    const i = lines.findIndex((l) => norm(l) === norm(label));
    return i >= 0 && lines[i + 1] ? lines[i + 1] : "";
  };
  const street = valueAfter("Street Address");
  const city = valueAfter("City");
  const rawState = valueAfter("State");
  const state = /^[A-Z]{2}$/i.test(rawState.trim()) ? rawState.trim().toUpperCase() : "";
  const zip = valueAfter("Zip Code");
  if (street || city || state || zip) {
    fields.address = [street, [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  }
}
function parseHeaderBlock(fullText, fields, chapters) {
  const idMatch = fullText.match(/\bCandidate\s+(\d{4,})\b/i);
  if (idMatch) fields.id = idMatch[1];
  const bornMatch = fullText.match(/Born in (\d{4})/i);
  if (bornMatch) fields.dob = bornMatch[1];
  const sponsorMatch = fullText.match(/Sponsor:\s*([^\n]+)/i);
  if (sponsorMatch) fields.sponsorName = reverseNameToDisplay(sponsorMatch[1]);
  const recommenderMatch = fullText.match(/Recommender:\s*([^\n]+)/i);
  if (recommenderMatch) fields.recommenderName = reverseNameToDisplay(recommenderMatch[1]);
  const byNameLength = Object.values(chapters).sort((a, b) => b.name.length - a.name.length);
  for (const ch of byNameLength) {
    if (ch.name.length < 4) continue;
    const re = new RegExp(`\\b${ch.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(fullText)) {
      fields.chapterKey = ch.key;
      break;
    }
  }
}
function reverseNameToDisplay(raw) {
  const clean2 = raw.trim().replace(/\s+/g, " ");
  const [last, rest] = clean2.split(",").map((s) => s.trim());
  if (!last || !rest) return clean2.startsWith("Bro.") ? clean2 : `Bro. ${clean2}`;
  return `Bro. ${rest} ${last}`;
}
var clean = (s) => s.trim().replace(/\s+/g, " ");
async function extractLetterTexts(pdfBytes) {
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  const pageCount = doc.countPages();
  const pageIndex = 4;
  if (pageIndex >= pageCount) return {};
  const langPath = process.env.TESSERACT_LANG_PATH;
  const worker = await createWorker("eng", 1, langPath ? { langPath, cachePath: langPath, gzip: true } : void 0);
  try {
    const png = await renderPageToPNG(doc, pageIndex);
    const { data } = await worker.recognize(Buffer.from(png));
    const text = data.text;
    const sponsorMatch = text.match(/Sponsor:\s*([^\n]*)\n/i);
    const recommenderMatch = text.match(/Recommender:\s*([^\n]*)\n/i);
    const result = {};
    if (sponsorMatch) {
      const start = sponsorMatch.index + sponsorMatch[0].length;
      const end = recommenderMatch ? recommenderMatch.index : text.length;
      const body = clean(text.slice(start, end));
      if (body) result.sponsorLetter = body;
      if (sponsorMatch[1].trim()) result.sponsorName = reverseNameToDisplay(sponsorMatch[1]);
    }
    if (recommenderMatch) {
      const start = recommenderMatch.index + recommenderMatch[0].length;
      const body = clean(text.slice(start));
      if (body) result.recommenderLetter = body;
      if (recommenderMatch[1].trim()) result.recommenderName = reverseNameToDisplay(recommenderMatch[1]);
    }
    return result;
  } finally {
    await worker.terminate();
  }
}
var MEMBERSHIP_FEES_RE = /Membership Fees\s*\(?\s*Bal(?:ance)?:?\s*\$?\s*([\d,]+\.\d{2})\)?/i;
async function extractMembershipFeesBalance(pdfBytes) {
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  const langPath = process.env.TESSERACT_LANG_PATH;
  const worker = await createWorker("eng", 1, langPath ? { langPath, cachePath: langPath, gzip: true } : void 0);
  try {
    const png = await renderPageToPNG(doc, 0);
    const { data } = await worker.recognize(Buffer.from(png));
    const match = data.text.match(MEMBERSHIP_FEES_RE);
    return match ? parseFloat(match[1].replace(/,/g, "")) : void 0;
  } finally {
    await worker.terminate();
  }
}
async function extractPdfText(pdfBytes) {
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  const pageCount = doc.countPages();
  const langPath = process.env.TESSERACT_LANG_PATH;
  const worker = await createWorker("eng", 1, langPath ? { langPath, cachePath: langPath, gzip: true } : void 0);
  try {
    const parts = [];
    for (let i = 0; i < pageCount; i++) {
      const png = await renderPageToPNG(doc, i);
      const { data } = await worker.recognize(Buffer.from(png));
      const text = data.text.trim();
      if (text) parts.push(text);
    }
    return parts.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
async function parseApplicationFields(pdfBytes, chapters) {
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  const pageCount = Math.min(doc.countPages(), 2);
  const langPath = process.env.TESSERACT_LANG_PATH;
  const worker = await createWorker("eng", 1, langPath ? { langPath, cachePath: langPath, gzip: true } : void 0);
  try {
    const fields = {};
    let combinedText = "";
    for (let i = 0; i < pageCount; i++) {
      const png = await renderPageToPNG(doc, i);
      const lines = await ocrLines(worker, png);
      combinedText += "\n" + lines.join("\n");
      parseLabelValueLines(lines, fields);
      parseAddressLines(lines, fields);
    }
    parseHeaderBlock(combinedText, fields, chapters);
    if (!fields.id) {
      const boostedPng = await renderPageToPNG(doc, 0, 2.5);
      const boostedLines = await ocrLines(worker, boostedPng);
      const idMatch = boostedLines.join("\n").match(/\bCandidate\s+(\d{4,})\b/i);
      if (idMatch) fields.id = idMatch[1];
    }
    return fields;
  } finally {
    await worker.terminate();
  }
}

// src/lib/redact.ts
import * as mupdf2 from "mupdf";
import { createWorker as createWorker2 } from "tesseract.js";
var STRICT_SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
var LOOSE_SSN = /\b(\d{3}[\s-]\d{2}[\s-]\d{4}|\d{9})\b/g;
var SSN_LABEL = /\bSSN\b|\bSocial Security\b/i;
function findSensitiveSpans(lineText) {
  const matches = [];
  for (const m of lineText.matchAll(STRICT_SSN)) {
    matches.push({ start: m.index, end: m.index + m[0].length });
  }
  if (SSN_LABEL.test(lineText)) {
    for (const m of lineText.matchAll(LOOSE_SSN)) {
      const start = m.index;
      const end = start + m[0].length;
      if (!matches.some((x) => start < x.end && end > x.start)) matches.push({ start, end });
    }
  }
  return matches;
}
function unionBoxForSpan(words, span) {
  let cursor = 0;
  let box = null;
  for (const w of words) {
    const start = cursor;
    const end = start + w.text.length;
    cursor = end + 1;
    if (start < span.end && end > span.start) {
      box = box ? { text: "", x0: Math.min(box.x0, w.x0), y0: Math.min(box.y0, w.y0), x1: Math.max(box.x1, w.x1), y1: Math.max(box.y1, w.y1) } : { ...w };
    }
  }
  return box;
}
var RENDER_SCALE = 2;
var PAD_PT = 2;
async function redactPage(doc, pageIndex, worker) {
  const page = doc.loadPage(pageIndex);
  const bounds = page.getBounds();
  const pageHeight = bounds[3] - bounds[1];
  const matrix = mupdf2.Matrix.scale(RENDER_SCALE, RENDER_SCALE);
  const pixmap = page.toPixmap(matrix, mupdf2.ColorSpace.DeviceRGB, false, true);
  const png = pixmap.asPNG();
  const { data } = await worker.recognize(Buffer.from(png), {}, { blocks: true });
  let found = false;
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const words = (line.words || []).map((w) => ({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }));
        if (!words.length) continue;
        const lineText = words.map((w) => w.text).join(" ");
        const spans = findSensitiveSpans(lineText);
        for (const span of spans) {
          const box = unionBoxForSpan(words, span);
          if (!box) continue;
          found = true;
          const rect = [
            box.x0 / RENDER_SCALE - PAD_PT,
            pageHeight - box.y1 / RENDER_SCALE - PAD_PT,
            box.x1 / RENDER_SCALE + PAD_PT,
            pageHeight - box.y0 / RENDER_SCALE + PAD_PT
          ];
          const annot = page.createAnnotation("Redact");
          annot.setRect(rect);
          const quadPoints = doc.newArray();
          for (const v of [rect[0], rect[3], rect[2], rect[3], rect[0], rect[1], rect[2], rect[1]]) {
            quadPoints.push(v);
          }
          annot.getObject().put("QuadPoints", quadPoints);
          annot.update();
        }
      }
    }
  }
  if (found) {
    page.applyRedactions(true, mupdf2.PDFPage.REDACT_IMAGE_PIXELS, mupdf2.PDFPage.REDACT_LINE_ART_REMOVE_IF_TOUCHED, mupdf2.PDFPage.REDACT_TEXT_REMOVE);
  }
  return found;
}
async function redactSensitiveInfo(pdfBytes) {
  const doc = mupdf2.Document.openDocument(pdfBytes, "application/pdf");
  const pageCount = doc.countPages();
  const langPath = process.env.TESSERACT_LANG_PATH;
  const worker = await createWorker2("eng", 1, langPath ? { langPath, cachePath: langPath, gzip: true } : void 0);
  let redactedCount = 0;
  try {
    for (let i = 0; i < pageCount; i++) {
      if (await redactPage(doc, i, worker)) redactedCount++;
    }
  } finally {
    await worker.terminate();
  }
  const buffer = doc.saveToBuffer("");
  return { bytes: buffer.asUint8Array(), redactedCount };
}

// src/index.tsx
var app = new Hono().basePath("/api");
var NEEDS_VERIFICATION_NOTES = {
  transcript: "Needs officer verification: must include a signature or the school seal.",
  enrollmentLetter: "Needs officer verification: must be signed by the Office of the Registrar.",
  medical: "Needs officer verification: must be signed by both the candidate and the physician.",
  nda: "Needs officer verification: must be signed by the candidate, and by a parent/guardian if the candidate is under 18."
};
var WORKFLOW_STEP_FOR_DOC = {
  application: "appSubmitted",
  essay: "essayReceived",
  resume: "resumeReceived",
  medical: "medicalReceived",
  voter: "voterReceived",
  transcript: "transcriptReceived"
};
app.use("*", cors());
function secretOf() {
  return process.env.SESSION_SECRET || "dev-secret-tcac-intake-do-not-use-in-real-prod";
}
async function currentOfficer(c) {
  const id = await readSession(c, secretOf());
  if (!id) return null;
  const officer = OFFICERS[id];
  if (!officer) return null;
  const cred = await getCredentialByOfficerId(id);
  return { ...officer, mustChangePassword: cred ? cred.must_change === 1 : false };
}
function allowedChapterKeysFor(officer) {
  if (!officer || officer.scope === "all") return "all";
  return Object.values(CHAPTERS).filter((ch) => officer.scope !== "all" && officer.scope.includes(ch.area)).map((ch) => ch.key);
}
app.post("/auth/signin", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || "").trim();
  const password = body.password || "";
  const genericError = "Incorrect email or password.";
  if (!email || !password) return c.json({ error: genericError }, 401);
  const cred = await getCredentialByEmail(email);
  if (!cred) return c.json({ error: genericError }, 401);
  const officer = OFFICERS[cred.officer_id];
  if (!officer) return c.json({ error: genericError }, 401);
  if (cred.locked_until && new Date(cred.locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(cred.locked_until).getTime() - Date.now()) / 6e4);
    return c.json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.` }, 423);
  }
  const ok = await verifyPassword(password, cred.password_hash, cred.password_salt, cred.iterations);
  if (!ok) {
    await recordFailedLogin(cred.officer_id, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES);
    const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - (cred.failed_attempts + 1));
    if (remaining <= 0) {
      return c.json({ error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` }, 423);
    }
    return c.json({ error: `${genericError} ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.` }, 401);
  }
  await resetFailedLogins(cred.officer_id);
  await setSession(c, secretOf(), officer.id);
  return c.json({ officer: { ...officer, mustChangePassword: cred.must_change === 1 } });
});
app.post("/auth/signout", async (c) => {
  clearSession(c);
  return c.json({ ok: true });
});
app.get("/auth/me", async (c) => {
  const officer = await currentOfficer(c);
  return c.json({ officer });
});
function requireOfficer(c, officer) {
  if (!officer) {
    return c.json({ error: "Not signed in" }, 401);
  }
  return null;
}
app.post("/auth/change-password", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const body = await c.req.json().catch(() => ({}));
  const currentPassword = body.currentPassword || "";
  const newPassword = body.newPassword || "";
  const cred = await getCredentialByOfficerId(officer.id);
  if (!cred) return c.json({ error: "No credential record found for this officer." }, 400);
  const ok = await verifyPassword(currentPassword, cred.password_hash, cred.password_salt, cred.iterations);
  if (!ok) return c.json({ error: "Current password is incorrect." }, 401);
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return c.json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, 422);
  }
  if (newPassword === currentPassword) {
    return c.json({ error: "New password must be different from your current password." }, 422);
  }
  const { hash, salt, iterations } = await hashPassword(newPassword);
  await setPassword(officer.id, hash, salt, iterations, false);
  return c.json({ ok: true });
});
function requireDistrictTier(c, officer) {
  if (!officer) return c.json({ error: "Not signed in" }, 401);
  if (officer.tier !== "district") return c.json({ error: "District-tier officers only." }, 403);
  return null;
}
app.get("/auth/admin/officers", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireDistrictTier(c, officer);
  if (denied) return denied;
  const metas = await listCredentialsMeta();
  const byId = new Map(metas.map((m) => [m.officer_id, m]));
  const rows = Object.values(OFFICERS).map((o) => {
    const meta = byId.get(o.id);
    return {
      officer: o,
      email: meta?.email || OFFICER_EMAILS[o.id] || null,
      hasCredential: !!meta,
      mustChangePassword: meta ? meta.must_change === 1 : false,
      lockedUntil: meta?.locked_until || null,
      failedAttempts: meta?.failed_attempts || 0
    };
  });
  return c.json({ rows });
});
app.post("/auth/admin/reset-password", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireDistrictTier(c, officer);
  if (denied) return denied;
  const body = await c.req.json().catch(() => ({}));
  const targetId = body.officerId || "";
  const target = OFFICERS[targetId];
  if (!target) return c.json({ error: "Unknown officer" }, 400);
  const email = OFFICER_EMAILS[targetId];
  if (!email) return c.json({ error: "No login email is configured for that officer." }, 400);
  const tempPassword = randomTempPassword();
  const { hash, salt, iterations } = await hashPassword(tempPassword);
  await upsertCredential(targetId, email, hash, salt, iterations, true);
  await logAudit("system", officer.id, "password_reset", `${officer.name} reset the password for ${target.name}`);
  return c.json({ officerId: targetId, email, tempPassword });
});
app.post("/auth/bootstrap", async (c) => {
  const configured = process.env.AUTH_BOOTSTRAP_SECRET;
  if (!configured) return c.json({ error: "Bootstrap is not enabled on this deployment." }, 403);
  const body = await c.req.json().catch(() => ({}));
  if (body.secret !== configured) return c.json({ error: "Invalid bootstrap secret." }, 403);
  const existing = await listCredentialsMeta();
  const existingIds = new Set(existing.map((m) => m.officer_id));
  const toSeed = Object.values(OFFICERS).filter((o) => !existingIds.has(o.id));
  if (toSeed.length === 0) {
    return c.json({ error: "All officers already have credentials. Use /api/auth/admin/reset-password instead." }, 409);
  }
  const results = [];
  for (const o of toSeed) {
    const email = OFFICER_EMAILS[o.id];
    if (!email) continue;
    const tempPassword = randomTempPassword();
    const { hash, salt, iterations } = await hashPassword(tempPassword);
    await upsertCredential(o.id, email, hash, salt, iterations, true);
    results.push({ officerId: o.id, name: o.name, email, tempPassword });
  }
  return c.json({ seeded: results.length, officers: results });
});
app.get("/reference", (c) => {
  return c.json({
    chapters: CHAPTERS,
    officers: Object.values(OFFICERS),
    district: DISTRICT,
    statuses: STATUS_LIST,
    workflowSteps: WORKFLOW_STEPS,
    requiredDocs: REQUIRED_DOCS
  });
});
app.get("/candidates", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const { q, status, type, chapter, sort } = c.req.query();
  const allowed = allowedChapterKeysFor(officer);
  const list = await listCandidates({
    q,
    status,
    type,
    chapterKey: chapter,
    sort,
    allowedChapterKeys: allowed
  });
  return c.json({ candidates: list });
});
app.get("/candidates/missing-report", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const allowed = allowedChapterKeysFor(officer);
  const list = await listCandidates({ allowedChapterKeys: allowed, sort: "id" });
  const rows = [];
  list.forEach((cand) => {
    requiredDocsFor(cand.chapterType).forEach((d) => {
      const doc = cand.docs[d.key];
      if (!doc || !doc.present || !doc.valid) {
        rows.push({
          candidateId: cand.id,
          candidateName: cand.name,
          candidateInitials: cand.initials,
          chapterKey: cand.chapterKey,
          school: cand.school,
          doc: d,
          state: !doc?.present ? "missing" : "flagged",
          note: doc?.note || "Not received"
        });
      }
    });
  });
  return c.json({ rows });
});
app.get("/candidates/csv-template", (c) => {
  const csv = buildCSVTemplate();
  return c.body(csv, 200, {
    "Content-Type": "text/csv",
    "Content-Disposition": 'attachment; filename="apa_intake_template.csv"'
  });
});
app.post("/candidates/csv/preview", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const { csv } = await c.req.json().catch(() => ({ csv: "" }));
  const parsed = parseCandidateCSV(csv || "");
  const existing = await Promise.all(parsed.rows.map((r) => candidateExists(String(r.id))));
  const annotated = parsed.rows.map((r, i) => {
    const chapter = CHAPTERS[r.chapterKey];
    const inScope = officerCanSeeArea(officer, chapter?.area ?? -1);
    return {
      ...r,
      chapterName: chapter?.name,
      duplicate: existing[i],
      outOfScope: !inScope,
      willImport: !existing[i] && inScope
    };
  });
  return c.json({ rows: annotated, errors: parsed.errors });
});
app.post("/candidates/csv/commit", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const { csv } = await c.req.json().catch(() => ({ csv: "" }));
  const parsed = parseCandidateCSV(csv || "");
  const toInsert = [];
  for (const r of parsed.rows) {
    const chapter = CHAPTERS[r.chapterKey];
    if (!chapter) continue;
    if (!officerCanSeeArea(officer, chapter.area)) continue;
    if (await candidateExists(String(r.id))) continue;
    toInsert.push(makeCandidate(r));
  }
  await insertCandidates(toInsert);
  for (const cand of toInsert) {
    await logAudit(cand.id, officer.id, "csv_import", `Imported via CSV by ${officer.name}`);
  }
  return c.json({ inserted: toInsert.length });
});
app.post("/candidates/parse-application", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "No file provided" }, 400);
  if (file.size > 25 * 1024 * 1024) return c.json({ error: "File exceeds 25 MB limit" }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let fields = {};
  try {
    fields = await parseApplicationFields(bytes, CHAPTERS);
  } catch (err) {
    console.error("parse-application: field extraction failed", err);
  }
  let headshotDataUrl = null;
  try {
    const headshot = extractHeadshot(bytes);
    if (headshot) {
      headshotDataUrl = `data:${headshot.contentType};base64,${Buffer.from(headshot.bytes).toString("base64")}`;
    }
  } catch (err) {
    console.error("parse-application: headshot extraction failed", err);
  }
  return c.json({ fields, headshotDataUrl });
});
app.post("/candidates", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const errors = {};
  if (!body.id || !String(body.id).trim()) errors.id = "Required";
  if (!body.firstName || !String(body.firstName).trim()) errors.firstName = "Required";
  if (!body.lastName || !String(body.lastName).trim()) errors.lastName = "Required";
  if (!body.email || !String(body.email).includes("@")) errors.email = "Valid email required";
  if (!body.school || !String(body.school).trim()) errors.school = "Required";
  if (!body.chapterKey || !CHAPTERS[body.chapterKey]) errors.chapterKey = "Chapter selection required";
  const gpaNum = parseFloat(body.gpa);
  if (body.gpa && (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4.5)) errors.gpa = "GPA must be 0.00\u20134.50";
  if (!errors.id && await candidateExists(String(body.id).trim())) {
    errors.id = `Candidate #${body.id} already exists`;
  }
  if (!errors.chapterKey && officer && !officerCanSeeChapterKey(officer, body.chapterKey)) {
    errors.chapterKey = "That chapter is outside your area of responsibility";
  }
  if (Object.keys(errors).length) return c.json({ errors }, 422);
  const fullName = [body.firstName, body.middleName, body.lastName].filter(Boolean).join(" ");
  const candidate = makeCandidate({
    id: String(body.id).trim(),
    name: fullName,
    email: String(body.email).trim(),
    phone: (body.phone || "").trim(),
    address: (body.address || "").trim(),
    dob: (body.dob || "").trim(),
    school: String(body.school).trim(),
    major: (body.major || "").trim(),
    minor: (body.minor || "").trim(),
    classification: body.classification || "Undergraduate",
    gpa: gpaNum || 0,
    gradDate: (body.gradDate || "").trim(),
    chapterKey: body.chapterKey,
    term: body.term || "2026 FALL",
    sponsorName: (body.sponsorName || "").trim(),
    recommenderName: (body.recommenderName || "").trim()
  });
  await insertCandidate(candidate);
  await logAudit(candidate.id, officer.id, "create", `Manually added by ${officer.name}`);
  return c.json({ candidate });
});
app.get("/candidates/:id", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const candidate = await getCandidate(c.req.param("id"));
  if (!candidate) return c.json({ error: "Not found" }, 404);
  if (!officerCanSeeChapterKey(officer, candidate.chapterKey)) {
    const chapter = getChapter(candidate.chapterKey);
    return c.json({
      error: "access_denied",
      chapter,
      areaName: DISTRICT.areaNames[String(chapter.area)]
    }, 403);
  }
  return c.json({ candidate });
});
app.post("/candidates/:id/docs/:docKey", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const { id, docKey } = c.req.param();
  const candidate = await getCandidate(id);
  if (!candidate) return c.json({ error: "Not found" }, 404);
  if (!officerCanSeeChapterKey(officer, candidate.chapterKey)) return c.json({ error: "access_denied" }, 403);
  if (!REQUIRED_DOCS.some((d) => d.key === docKey)) return c.json({ error: "Unknown document type" }, 400);
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "No file provided" }, 400);
  if (file.size > 25 * 1024 * 1024) return c.json({ error: "File exceeds 25 MB limit" }, 413);
  const originalBytes = await file.arrayBuffer();
  let bytes = originalBytes;
  let contentType = file.type || "application/octet-stream";
  let redactedCount = 0;
  if (contentType === "application/pdf") {
    try {
      const result = await redactSensitiveInfo(new Uint8Array(bytes));
      bytes = result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength);
      redactedCount = result.redactedCount;
    } catch (err) {
      console.error("SSN redaction failed, storing original file", err);
    }
  }
  const key = `candidates/${id}/${docKey}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  await putFile(key, bytes, contentType);
  const wasReplaced = !!candidate.docs[docKey]?.file;
  const uploadNote = wasReplaced ? `Replaced \xB7 ${file.name} \xB7 ${(file.size / 1024).toFixed(0)} KB` : `Uploaded ${file.name} \xB7 ${(file.size / 1024).toFixed(0)} KB`;
  const needsVerification = NEEDS_VERIFICATION_NOTES[docKey];
  const doc = {
    present: true,
    valid: !needsVerification,
    note: needsVerification || uploadNote,
    file: `/api/files/${key}`,
    uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  let updated = await updateCandidateDoc(id, docKey, doc);
  const workflowStepKey = WORKFLOW_STEP_FOR_DOC[docKey];
  if (workflowStepKey && updated) {
    updated = await updateCandidateFields(id, {
      workflow: { ...updated.workflow, [workflowStepKey]: { ...updated.workflow[workflowStepKey] || {}, done: true } }
    }) || updated;
  }
  if (contentType === "application/pdf" && updated) {
    const current = updated;
    try {
      if (docKey === "application") {
        const [{ sponsorName, sponsorLetter, recommenderName, recommenderLetter }, feesBalance] = await Promise.all([
          extractLetterTexts(new Uint8Array(originalBytes)),
          extractMembershipFeesBalance(new Uint8Array(originalBytes))
        ]);
        const fields = {};
        const attachLetter = (existing, name, letter, role) => {
          if (!letter) return void 0;
          if (existing) return { ...existing, letter };
          if (!name) return void 0;
          return { name, chapter: "Pending confirmation", role: "Chapter Brother", email: "", phone: "", relationship: `${role} \xB7 Chapter Brother`, letter };
        };
        const sponsor = attachLetter(current.sponsor, sponsorName, sponsorLetter, "Sponsor");
        const recommender = attachLetter(current.recommender, recommenderName, recommenderLetter, "Recommender");
        const workflowUpdates = {};
        if (sponsor) {
          fields.sponsor = sponsor;
          workflowUpdates.sponsorAssigned = { done: true, value: `${sponsor.name} \xB7 ${countWords(sponsor.letter)} words` };
        }
        if (recommender) {
          fields.recommender = recommender;
          workflowUpdates.recommenderAssigned = { done: true, value: `${recommender.name} \xB7 ${countWords(recommender.letter)} words` };
        }
        if (feesBalance !== void 0) {
          workflowUpdates.membershipFees = { done: feesBalance === 0, value: `Balance: $${feesBalance.toFixed(2)}` };
        }
        if (Object.keys(workflowUpdates).length) fields.workflow = { ...current.workflow, ...workflowUpdates };
        if (Object.keys(fields).length) updated = await updateCandidateFields(id, fields) || updated;
      } else if (docKey === "essay") {
        const essayText = await extractPdfText(new Uint8Array(originalBytes));
        if (essayText.trim()) updated = await updateCandidateFields(id, { essayText }) || updated;
        const words = countWords(essayText);
        const meetsMin = !!essayText.trim() && words >= MIN_ESSAY_WORDS;
        const essayNote = essayText.trim() ? meetsMin ? `${words} words` : `Essay is ${words} words \u2014 below the ${MIN_ESSAY_WORDS}-word minimum` : "Could not read the essay text automatically \u2014 please confirm it meets the 300-word minimum manually";
        const essayDoc = updated?.docs.essay || current.docs.essay;
        updated = await updateCandidateDoc(id, docKey, { ...essayDoc, valid: meetsMin, note: essayNote }) || updated;
      }
    } catch (err) {
      console.error("Letter/essay/fees extraction failed", err);
    }
  }
  await logAudit(
    id,
    officer.id,
    wasReplaced ? "doc_replace" : "doc_upload",
    redactedCount > 0 ? `${docKey} by ${officer.name} \xB7 ${redactedCount} page(s) redacted for sensitive info` : `${docKey} by ${officer.name}`
  );
  return c.json({ candidate: updated });
});
app.post("/candidates/:id/docs/:docKey/flag", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const { id, docKey } = c.req.param();
  const candidate = await getCandidate(id);
  if (!candidate) return c.json({ error: "Not found" }, 404);
  if (!officerCanSeeChapterKey(officer, candidate.chapterKey)) return c.json({ error: "access_denied" }, 403);
  if (!REQUIRED_DOCS.some((d) => d.key === docKey)) return c.json({ error: "Unknown document type" }, 400);
  const existing = candidate.docs[docKey];
  if (!existing?.present) return c.json({ error: "Document has not been submitted yet" }, 400);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.valid !== "boolean") return c.json({ error: "valid (boolean) is required" }, 400);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!body.valid && !note) return c.json({ error: "A reason is required to flag a document" }, 400);
  const doc = {
    ...existing,
    valid: body.valid,
    note: body.valid ? null : note
  };
  const updated = await updateCandidateDoc(id, docKey, doc);
  await logAudit(
    id,
    officer.id,
    body.valid ? "doc_unflag" : "doc_flag",
    body.valid ? `${docKey} cleared by ${officer.name}` : `${docKey} flagged by ${officer.name} \xB7 ${note}`
  );
  return c.json({ candidate: updated });
});
app.post("/candidates/:id/workflow/membership-fees", async (c) => {
  const officer = await currentOfficer(c);
  const denied = requireOfficer(c, officer);
  if (denied) return denied;
  const { id } = c.req.param();
  const candidate = await getCandidate(id);
  if (!candidate) return c.json({ error: "Not found" }, 404);
  if (!officerCanSeeChapterKey(officer, candidate.chapterKey)) return c.json({ error: "access_denied" }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.paid !== "boolean") return c.json({ error: "paid (boolean) is required" }, 400);
  const updated = await updateCandidateFields(id, {
    workflow: {
      ...candidate.workflow,
      membershipFees: { done: body.paid, value: body.paid ? `Paid \xB7 marked by ${officer.name}` : "Not yet paid" }
    }
  });
  await logAudit(id, officer.id, body.paid ? "fees_paid" : "fees_unpaid", `Membership fees marked ${body.paid ? "paid" : "unpaid"} by ${officer.name}`);
  return c.json({ candidate: updated });
});
app.get("/files/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/files\//, "");
  const file = await getFile(key);
  if (!file) return c.notFound();
  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600"
    }
  });
});
var src_default = app;

// server/vercel-app.ts
var config = {
  runtime: "nodejs",
  // Default function timeout (10s on Hobby, 15s on Pro) is too short for a
  // cold-start OCR request on /api/candidates/parse-application -- it needs
  // to download tesseract.js's language model on first use, then render and
  // OCR two PDF pages. 60s is the maximum allowed on the Hobby plan; raise
  // it further if the account is on Pro/Enterprise and cold starts still run
  // long.
  maxDuration: 60
};
var fetch = handle(src_default);
export {
  config,
  fetch
};
