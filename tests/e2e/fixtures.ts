import { test as base, expect, type Page } from '@playwright/test';

/**
 * Every test page records CSP / Trusted Types violations, uncaught errors, and
 * dialogs (an alert() would mean injected script ran). Each test fails if any occur.
 */
export const test = base.extend<{ guard: undefined }>({
  guard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      await page.addInitScript(() => {
        const w = window as unknown as { __violations: string[] };
        w.__violations = [];
        document.addEventListener('securitypolicyviolation', (e) => {
          w.__violations.push(`${e.violatedDirective} ${e.blockedURI}`);
        });
      });
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
      page.on('dialog', (d) => {
        if (d.type() === 'alert') problems.push(`alert dialog: ${d.message()}`);
        void d.accept();
      });
      await use(undefined);
      const violations = await page
        .evaluate(() => (window as unknown as { __violations?: string[] }).__violations ?? [])
        .catch(() => []);
      expect([...problems, ...violations.map((v) => `CSP: ${v}`)]).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function addCard(page: Page, text: string, meaning?: string): Promise<void> {
  await page.goto('./#/add');
  await page.getByLabel('Word or sentence in Chinese').fill(text);
  await page.getByRole('button', { name: 'Fill in details' }).click();
  await expect(page.getByRole('heading', { name: 'Check each field' })).toBeVisible({ timeout: 30_000 });
  if (meaning !== undefined) await page.locator('#field-meaning').fill(meaning);
  for (const box of await page.getByRole('checkbox', { name: 'Looks right' }).all()) {
    if (!(await box.isChecked())) await box.check();
  }
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
}
