/**
 * "Report a problem": a link to the developer's Google Form, which emails each report
 * to the developer. It is only a link (opened in a new tab by ExternalLink), so the
 * portal itself still makes no requests to anyone else.
 *
 * The link fills in the portal version and some details (an error message, the
 * browser), so the student only has to say what happened. Nothing about their cards
 * is included.
 */

const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeyk6fKvt7Az2SUZRzh38GrWqStvaYPSydJOLmSWW9RGmfQSw/viewform';
const FIELD_DETAILS = 'entry.2015925771';
const FIELD_VERSION = 'entry.1650357924';

/** ExternalLink refuses URLs longer than this (see safeHttpsUrl). */
const MAX_URL = 2048;

function build(details: string, version: string): string {
  const url = new URL(FORM_URL);
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(FIELD_DETAILS, details);
  url.searchParams.set(FIELD_VERSION, version);
  return url.href;
}

/** The form link, with `details` (shortened if needed to fit in a link) filled in. */
export function reportProblemUrl(details = '', version = __APP_VERSION__): string {
  const browser = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  let text = [details.trim(), browser && `Browser: ${browser}`].filter(Boolean).join('\n\n');
  let url = build(text, version);
  while (url.length > MAX_URL && text.length > 0) {
    text = `${text.slice(0, Math.floor(text.length * 0.8)).trimEnd()}…`;
    url = build(text, version);
  }
  return url;
}
