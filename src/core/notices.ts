import { isBoolean, isNumberIn, readPref, writePref } from './safe/prefs';

/**
 * Messages a student can close. What they closed is remembered in this browser only
 * (localStorage), like the other display preferences.
 */

/** Closing the backup reminder hides it for this long. */
export const BACKUP_REMINDER_SNOOZE_MS = 7 * 86_400_000;
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
