import { isBoolean, isNumberIn, readPref, writePref } from './safe/prefs';

/**
 * Messages a student can close. What they closed is remembered in this browser only
 * (localStorage), like the other display preferences.
 */

const DAY = 86_400_000;

/** Closing the backup reminder hides it for this long. */
export const BACKUP_REMINDER_SNOOZE_MS = 7 * DAY;
const MAX_TIME = 4_102_444_800_000; // year 2100

/** Whether the student closed the backup reminder less than a week ago. */
export function backupReminderSnoozed(now = Date.now()): boolean {
  const closedAt = readPref('notice.backupClosedAt', 0, isNumberIn(0, MAX_TIME));
  // A time in the future (the clock was changed) doesn't count.
  return closedAt <= now && now - closedAt < BACKUP_REMINDER_SNOOZE_MS;
}

export function snoozeBackupReminder(now = Date.now()): void {
  writePref('notice.backupClosedAt', now);
}

/** The "works best in Chrome" message, once closed, stays closed. */
export function chromeNoticeClosed(): boolean {
  return readPref('notice.chromeClosed', false, isBoolean);
}

export function closeChromeNotice(): void {
  writePref('notice.chromeClosed', true);
}

interface UserAgentData {
  brands?: readonly { brand: string }[];
}

/** Google Chrome (not other Chromium browsers), including Chrome on iPhone and iPad. */
export function isGoogleChrome(): boolean {
  const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (data?.brands) return data.brands.some((b) => b.brand === 'Google Chrome');
  return navigator.userAgent.includes('CriOS/');
}

/** Closing a tip about keeping cards safe hides it for this long. */
export const STORAGE_TIP_SNOOZE_MS = 30 * DAY;

export function storageTipSnoozed(now = Date.now()): boolean {
  const closedAt = readPref('notice.storageClosedAt', 0, isNumberIn(0, MAX_TIME));
  return closedAt <= now && now - closedAt < STORAGE_TIP_SNOOZE_MS;
}

export function snoozeStorageTip(now = Date.now()): void {
  writePref('notice.storageClosedAt', now);
}

/** An iPhone or iPad (iPads can report themselves as a Mac with a touch screen). */
export function isAppleTouch(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** Safari on a Mac (not Chrome, Edge, Firefox, … which say "Safari" too). */
export function isMacSafari(): boolean {
  const ua = navigator.userAgent;
  return (
    ua.includes('Macintosh') &&
    navigator.maxTouchPoints <= 1 &&
    /Version\/[\d.]+.*Safari\//.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)
  );
}

/**
 * Safari's engine (every browser on iPhone and iPad, and Safari on a Mac) deletes a
 * website's stored data when the site isn't used for 7 days. Sites added to the Home
 * Screen or the Dock are exempt.
 */
export function erasesIdleSites(): boolean {
  return isAppleTouch() || isMacSafari();
}

/** Opened as an installed app (Home Screen, Dock, or "Install app"), not in a browser tab. */
export function isInstalled(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia('(display-mode: standalone)').matches;
}

export function isFirefox(): boolean {
  return /Firefox\/|FxiOS\//.test(navigator.userAgent);
}

/**
 * How long after the last backup the Study page reminds you to make one: sooner where
 * the browser may delete the cards after a week without a visit.
 */
export function backupReminderAfterMs(): number {
  return erasesIdleSites() && !isInstalled() ? 3 * DAY : 14 * DAY;
}
