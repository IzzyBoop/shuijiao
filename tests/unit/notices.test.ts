import { afterEach, describe, expect, it, vi } from 'vitest';
import { backupReminderAfterMs, erasesIdleSites, isFirefox } from '../../src/core/notices';

const DAY = 86_400_000;
const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
};

function browser(userAgent: string, { installed = false, touch = 0 } = {}) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints: touch });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: installed }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('keeping cards safe in each browser', () => {
  it('Safari on iPhone and Mac can delete the cards of a site not used for a week', () => {
    browser(UA.iphone, { touch: 5 });
    expect(erasesIdleSites()).toBe(true);
    browser(UA.macSafari);
    expect(erasesIdleSites()).toBe(true);
    browser(UA.macChrome);
    expect(erasesIdleSites()).toBe(false);
    browser(UA.firefox);
    expect(erasesIdleSites()).toBe(false);
    expect(isFirefox()).toBe(true);
  });

  it('reminds about backups after 3 days in Safari, unless installed; otherwise after 14', () => {
    browser(UA.iphone, { touch: 5 });
    expect(backupReminderAfterMs()).toBe(3 * DAY);
    browser(UA.iphone, { touch: 5, installed: true });
    expect(backupReminderAfterMs()).toBe(14 * DAY);
    browser(UA.macChrome);
    expect(backupReminderAfterMs()).toBe(14 * DAY);
  });
});
