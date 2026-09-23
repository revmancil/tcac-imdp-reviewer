// Word counting for the sponsor letter, recommender letter, and candidate
// essay — each must run at least MIN_ESSAY_WORDS words per the district's
// intake requirements.
import type { Brother, TriCheckState } from './types.js';

export const MIN_ESSAY_WORDS = 300;

export function countWords(text: string | null | undefined): number {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// Strips case/punctuation/whitespace differences so a copy-pasted letter is
// caught even with minor edits -- not just a byte-for-byte match.
function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// True if two letters are essentially the same text -- exact match, or
// share the large majority of their words (Jaccard similarity over word
// sets). A sponsor and recommender letter that are the same text (one
// copy-pasted for both roles) doesn't satisfy the requirement that they be
// two distinct people's endorsements.
export function lettersAreDuplicate(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 && intersection / union >= 0.85;
}

// The sponsor and recommender letters must both be submitted, both meet the
// 300-word minimum, and be distinct from each other. "flag" (red) covers
// nothing submitted yet; "warn" (yellow) covers something submitted but not
// meeting the requirement -- matching the document checklist's red/yellow
// split ("not received" vs. "received but needs correction").
export function computeSponsorRecommenderCheck(sponsor: Brother | null, recommender: Brother | null): TriCheckState {
  const sponsorLetter = sponsor?.letter?.trim() || '';
  const recommenderLetter = recommender?.letter?.trim() || '';

  if (!sponsor && !recommender) {
    return { state: 'flag', value: 'Neither a sponsor nor a recommender has been assigned' };
  }
  if (!sponsor || !sponsorLetter) {
    return { state: 'flag', value: 'Sponsor letter has not been submitted' };
  }
  if (!recommender || !recommenderLetter) {
    return { state: 'flag', value: 'Recommender letter has not been submitted' };
  }

  const sponsorWords = countWords(sponsorLetter);
  const recommenderWords = countWords(recommenderLetter);
  const sponsorShort = sponsorWords < MIN_ESSAY_WORDS;
  const recommenderShort = recommenderWords < MIN_ESSAY_WORDS;

  if (sponsorShort && recommenderShort) {
    return { state: 'warn', value: `Both letters are under ${MIN_ESSAY_WORDS} words (sponsor: ${sponsorWords}, recommender: ${recommenderWords})` };
  }
  if (sponsorShort) {
    return { state: 'warn', value: `Sponsor letter is ${sponsorWords} words — below the ${MIN_ESSAY_WORDS}-word minimum` };
  }
  if (recommenderShort) {
    return { state: 'warn', value: `Recommender letter is ${recommenderWords} words — below the ${MIN_ESSAY_WORDS}-word minimum` };
  }
  if (lettersAreDuplicate(sponsorLetter, recommenderLetter)) {
    return { state: 'warn', value: 'Sponsor and recommender letters appear to be the same text — they must be distinct' };
  }
  return { state: 'ok', value: `Sponsor ${sponsorWords} words · Recommender ${recommenderWords} words · both distinct` };
}
