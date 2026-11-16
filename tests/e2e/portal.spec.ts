import { readFile, writeFile } from 'node:fs/promises';
import { addCard, expect, test } from './fixtures.ts';

test('the page ships a strict CSP with Trusted Types', async ({ page }) => {
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("require-trusted-types-for 'script'");
  await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
});

test('add a card: auto-fill, confirm every field, save', async ({ page }) => {
  await page.goto('./#/add');
  await page.getByLabel('Word or sentence in Chinese').fill('银行');
  await page.getByRole('button', { name: 'Fill in details' }).click();
  await expect(page.locator('#field-traditional')).toHaveValue('銀行', { timeout: 30_000 });
  await expect(page.locator('#field-simplified')).toHaveValue('银行');
  await expect(page.locator('#field-pinyin')).toHaveValue('yínháng');
  await expect(page.locator('#field-meaning')).toHaveValue(/bank/);

  const save = page.getByRole('button', { name: 'Save card' });
  await expect(save).toBeDisabled();
  const boxes = page.getByRole('checkbox', { name: 'Looks right' });
  await expect(boxes).toHaveCount(4);
  for (const box of await boxes.all()) await box.check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();

  await page.goto('./#/cards');
  await expect(page.getByText('銀行')).toBeVisible();
});

test('a sentence gets word-by-word hints and needs a written meaning', async ({ page }) => {
  await page.goto('./#/add');
  await page.getByLabel('Word or sentence in Chinese').fill('我们去银行。');
  await page.getByRole('button', { name: 'Fill in details' }).click();
  await expect(page.locator('#field-pinyin')).toHaveValue('Wǒmen qù yínháng.', { timeout: 30_000 });
  await expect(page.locator('#field-meaning')).toHaveValue('');
  await expect(page.getByText('Word-by-word dictionary hints')).toBeVisible();
});

test('review a card with spaced repetition', async ({ page }) => {
  await addCard(page, '你好');
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Study now' }).click();
  await expect(page.locator('.flashcard')).toContainText('你好');
  await page.keyboard.press('Space');
  await expect(page.locator('.flashcard')).toContainText('nǐhǎo');
  await page.getByRole('button', { name: /Easy/ }).click();
  await expect(page.getByRole('heading', { name: /Session complete/ })).toBeVisible();
});

test('flip through keeps the front visible and shows the back below it', async ({ page }) => {
  await addCard(page, '银行');
  await page.goto('./#/browse');
  const card = page.locator('.flashcard');
  await expect(card).toContainText('銀行');
  await expect(card).not.toContainText('yínháng');
  await page.keyboard.press('Space');
  await expect(card).toContainText('銀行');
  await expect(card).toContainText('yínháng');
  await expect(card.locator('hr')).toHaveCount(1);
  await page.getByRole('button', { name: /Hide answer/ }).click();
  await expect(card).not.toContainText('yínháng');
});

test('markup in card text is shown as text, never executed', async ({ page }) => {
  const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  await addCard(page, '书', payload);
  await page.goto('./#/cards');
  await expect(page.getByText(payload)).toBeVisible();
  expect(await page.locator('img[src="x"]').count()).toBe(0);
});

test('theme toggle and theme picker', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('catppuccin');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'catppuccin-macchiato');
  await page.getByLabel('Dark variant').selectOption('catppuccin-mocha');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'catppuccin-mocha');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'catppuccin-latte');
  // The choice survives a reload (applied before first paint by theme-init.js).
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'catppuccin-latte');
});

test('backup: export, erase, import restores cards', async ({ page }, testInfo) => {
  await addCard(page, '银行');
  await page.goto('./#/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const file = testInfo.outputPath('backup.json');
  await (await download).saveAs(file);

  await page.getByText('Erase all study data').click();
  await page.getByLabel('Type ERASE to confirm').fill('ERASE');
  await page.getByRole('button', { name: 'Erase everything' }).click();
  await expect(page.getByText('All study data on this device was erased.')).toBeVisible();

  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported: 1 new cards/)).toBeVisible();
  await page.goto('./#/cards');
  await expect(page.getByText('銀行')).toBeVisible();
});

test('a hostile backup file is rejected', async ({ page }, testInfo) => {
  const file = testInfo.outputPath('evil.json');
  await writeFile(
    file,
    '{"__proto__":{"isAdmin":true},"format":"shuijiao-backup","version":1,"exportedAt":1,"decks":[],"cards":[],"templates":[],"reviewStates":[],"reviewLogs":[]}',
  );
  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText(/can't be imported/)).toBeVisible();
  expect(await page.evaluate(() => ({}))).not.toHaveProperty('isAdmin');
});

test('resource links are https and open safely', async ({ page }) => {
  await page.goto('./#/resources');
  const links = page.locator('main a[target="_blank"]');
  expect(await links.count()).toBeGreaterThan(0);
  for (const link of await links.all()) {
    expect(await link.getAttribute('href')).toMatch(/^https:\/\//);
    expect(await link.getAttribute('rel')).toBe('noopener noreferrer');
  }
});

test('browse cards by deck, quick-edit, delete with undo, and move in bulk', async ({ page }, testInfo) => {
  const now = 1_763_287_200_000;
  const deck = (id: string, name: string) => ({ id, name, createdAt: now, updatedAt: now, deleted: 0 });
  const card = (id: string, deckId: string, t: string, s: string, p: string, m: string) => ({
    id,
    deckId,
    kind: 'word',
    traditional: t,
    simplified: s,
    pinyin: p,
    meaning: m,
    notes: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  });
  const file = testInfo.outputPath('sample.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [deck('l1', 'Lesson 1'), deck('l2', 'Lesson 2')],
      cards: [
        card('a', 'l1', '銀行', '银行', 'yínháng', 'bank'),
        card('b', 'l1', '你好', '你好', 'nǐhǎo', 'hello'),
        card('c', 'l2', '老師', '老师', 'lǎoshī', 'teacher'),
      ],
      templates: [],
      reviewStates: [],
      reviewLogs: [],
      links: [],
    }),
  );
  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported: 3 new cards/)).toBeVisible();

  // Deck tabs filter the list and have their own address.
  await page.goto('./#/cards');
  await page.getByRole('link', { name: /Lesson 2/ }).click();
  await expect(page).toHaveURL(/#\/cards\/deck\/l2$/);
  await expect(page.locator('.card-list > li')).toHaveCount(1);
  await expect(page.getByText('老師')).toBeVisible();

  // Quick edit in place: Enter saves without leaving the page.
  await page.getByRole('button', { name: 'Edit 老師' }).click();
  await page.getByLabel('Meaning').fill('teacher (polite)');
  await page.keyboard.press('Enter');
  await expect(page.getByText('teacher (polite)')).toBeVisible();
  await expect(page).toHaveURL(/#\/cards\/deck\/l2$/);

  // Delete is instant and can be undone.
  await page.getByRole('button', { name: 'Delete 老師' }).click();
  await expect(page.getByText('This deck has no cards yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('老師')).toBeVisible();

  // Select several cards and move them to another deck.
  await page.getByRole('link', { name: /Lesson 1/ }).click();
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByLabel('Select all shown').check();
  await page.getByLabel('Move selected cards to deck').selectOption('l2');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(page.getByText('This deck has no cards yet.')).toBeVisible();
  await page.getByRole('link', { name: /Lesson 2/ }).click();
  await expect(page.locator('.card-list > li')).toHaveCount(3);
});

test('students can add their own links, safely', async ({ page }) => {
  await page.goto('./#/resources');
  const address = page.getByLabel('Web address');

  await address.fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Add link' }).click();
  await expect(page.getByRole('alert')).toContainText('https');

  await address.fill('www.example.com/grammar');
  await page.getByLabel('Title').fill('<b>Grammar</b> videos');
  await page.getByRole('button', { name: 'Add link' }).click();
  const added = page.getByRole('link', { name: /<b>Grammar<\/b> videos/ });
  await expect(added).toHaveAttribute('href', 'https://www.example.com/grammar');
  await expect(added).toHaveAttribute('rel', 'noopener noreferrer');

  await page.reload();
  await expect(page.getByRole('link', { name: /Grammar/ })).toBeVisible();
});

test('unknown routes and hostile hashes show "not found"', async ({ page }) => {
  await page.goto('./#/cards/<img src=x onerror=alert(1)>');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.goto('./#javascript:alert(1)');
  await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
});

test('the app refuses to render inside a frame', async ({ page, baseURL }) => {
  // Simulate an attacker's page (without our CSP) that frames the portal.
  await page.route('**/attacker.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: `<iframe id="victim" src="${baseURL ?? ''}"></iframe>` }),
  );
  await page.goto('./attacker.html');
  const frame = page.frameLocator('#victim');
  await expect(frame.locator('html')).toHaveAttribute('data-framed');
  await expect(frame.locator('#app')).toBeEmpty();
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
  await context.setOffline(false);
});

test('the built files contain no personal paths', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  expect(html).not.toMatch(/\/Users\//);
});
