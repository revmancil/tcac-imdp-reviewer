// Roster spreadsheets and application PDFs commonly list names as
// "Last, First Middle" -- normalizes that to "First Middle Last", the
// order used everywhere else in the app. Leaves an already "First Last"
// name (no comma) alone. Only the first comma reverses the name; anything
// after a second comma (e.g. a suffix someone wrote as "Smith, John, Jr.")
// is preserved rather than silently dropped.
export function normalizeName(raw: string): string {
  const clean = raw.trim().replace(/\s+/g, ' ');
  const commaIdx = clean.indexOf(',');
  if (commaIdx === -1) return clean;
  const last = clean.slice(0, commaIdx).trim();
  const rest = clean.slice(commaIdx + 1).trim();
  if (!last || !rest) return clean;
  return `${rest} ${last}`;
}
