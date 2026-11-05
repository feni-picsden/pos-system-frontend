// Promotion revision rows: a criteria row carries { summary, items[] }; the view
// prints the items table in From and the sentence in To (reference 05/11/2026).
export const revisionSentence = (value) =>
  value && typeof value === 'object' && typeof value.summary === 'string' ? value.summary : null;
