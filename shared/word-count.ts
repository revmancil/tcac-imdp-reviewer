// Word counting for the sponsor letter, recommender letter, and candidate
// essay — each must run at least MIN_ESSAY_WORDS words per the district's
// intake requirements.

export const MIN_ESSAY_WORDS = 300;

export function countWords(text: string | null | undefined): number {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
