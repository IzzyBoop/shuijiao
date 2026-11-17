// English list formatting with the Oxford (serial) comma: "a, b, and c".
// Intl.ListFormat's US-English rules always include it.
const and = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });
const or = new Intl.ListFormat('en-US', { style: 'long', type: 'disjunction' });

/** "a", "a and b", "a, b, and c" */
export function andList(items: readonly string[]): string {
  return and.format(items);
}

/** "a", "a or b", "a, b, or c" */
export function orList(items: readonly string[]): string {
  return or.format(items);
}

/**
 * The date on the user's own clock as YYYY-MM-DD (for file names). Unlike
 * toISOString(), which gives the UTC date, this matches the user's calendar.
 */
export function localDateStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
