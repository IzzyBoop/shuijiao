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

test('adding a duplicate card asks for confirmation first', async ({ page }) => {
  await addCard(page, '银行');

  // Same word again, typed in traditional this time.
  await page.goto('./#/add');
  await page.getByLabel('Word or sentence in Chinese').fill('銀行');
  await page.getByRole('button', { name: 'Fill in details' }).click();
  await expect(page.getByText(/You already have a card for/)).toBeVisible({ timeout: 30_000 });
  for (const box of await page.getByRole('checkbox', { name: 'Looks right' }).all()) await box.check();

  const dialog = page.getByRole('dialog', { name: 'You already have this card' });
  const save = page.getByRole('button', { name: 'Save card' });

  // "Don't add" is the default and keeps you on the form.
  await save.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('yínháng');
  await expect(dialog.getByRole('button', { name: 'Don’t add' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();

  // Escape also cancels.
  await save.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.goto('./#/cards');
  await expect(page.locator('.card-list > li')).toHaveCount(1);

  // "Add anyway" really adds a second copy.
  await page.goBack();
  await page.goto('./#/add');
  await page.getByLabel('Word or sentence in Chinese').fill('銀行');
  await page.getByRole('button', { name: 'Fill in details' }).click();
  await expect(page.getByText(/You already have a card for/)).toBeVisible({ timeout: 30_000 });
  for (const box of await page.getByRole('checkbox', { name: 'Looks right' }).all()) await box.check();
  await save.click();
  await dialog.getByRole('button', { name: 'Add anyway' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.goto('./#/cards');
  await expect(page.locator('.card-list > li')).toHaveCount(2);
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

test('with nothing due, a session can be studied anyway', async ({ page }) => {
  await addCard(page, '你好');
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Study now' }).click();
  await expect(page.locator('.flashcard')).toContainText('你好');
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /Easy/ }).click();
  await expect(page.getByRole('heading', { name: /Session complete/ })).toBeVisible();

  // Nothing is due now: the home page says so and offers a session all the same.
  await page.goto('./#/');
  await expect(page.getByText('All done for today')).toBeVisible();
  await page.getByRole('link', { name: 'Study anyway' }).click();
  await expect(page.getByText('Studying ahead')).toBeVisible();
  await expect(page.locator('.flashcard')).toContainText('你好');
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /Good/ }).click();
  await expect(page.getByRole('heading', { name: /Session complete/ })).toBeVisible();

  // The ordinary session has nothing, and offers the same.
  await page.goto('./#/review');
  await expect(page.getByRole('heading', { name: /Nothing to study/ })).toBeVisible();
  await page.getByRole('link', { name: 'Study anyway' }).click();
  await expect(page.locator('.flashcard')).toContainText('你好');
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
  await expect(page.getByText(/Imported: 1 new card\b/)).toBeVisible();
  await page.goto('./#/cards');
  await expect(page.getByText('銀行')).toBeVisible();
});

test('import lets you keep the original decks or put everything in My cards', async ({ page }, testInfo) => {
  const now = 1_763_287_200_000;
  const deck = (id: string, name: string) => ({ id, name, createdAt: now, updatedAt: now, deleted: 0 });
  const card = (id: string, deckId: string, t: string) => ({
    id,
    deckId,
    kind: 'word',
    traditional: t,
    simplified: t,
    pinyin: 'x',
    meaning: 'y',
    notes: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  });
  const file = testInfo.outputPath('decks.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [deck('l1', 'Lesson 1'), deck('l2', 'Lesson 2')],
      cards: [card('a', 'l1', '你'), card('b', 'l2', '好')],
      templates: [],
      reviewStates: [],
      reviewLogs: [],
      links: [],
    }),
  );
  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByLabel(/The decks they were in/)).toBeChecked();
  await expect(page.getByText('This creates decks: “Lesson 1” and “Lesson 2”.')).toBeVisible();

  await page.getByLabel(/All into “My cards”/).check();
  await expect(page.getByText('No new decks are created.')).toBeVisible();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported: 2 new cards/)).toBeVisible();

  await page.goto('./#/cards');
  await expect(page.getByRole('link', { name: /Lesson/ })).toHaveCount(0);
  await expect(page.locator('.card-list .badge', { hasText: 'My cards' })).toHaveCount(2);
});

test('duplicates on import: keep old, keep new, or choose card by card', async ({ page }, testInfo) => {
  const now = 1_763_287_200_000;
  const card = (id: string, t: string, meaning: string, updatedAt = now) => ({
    id,
    deckId: 'default-deck',
    kind: 'word',
    traditional: t,
    simplified: t,
    pinyin: 'x',
    meaning,
    notes: '',
    tags: [],
    createdAt: now,
    updatedAt,
    deleted: 0,
  });
  // 25 characters you already have, so the side-by-side list needs two pages.
  const chars = [...'一二三四五六七八九十百千万上下左右大小中山水火木金'];
  const mine = chars.map((c, i) => card(`mine-${i}`, c, `mine ${c}`));
  const theirs = chars.map((c, i) => card(`theirs-${i}`, c, `theirs ${c}`, now + 1));
  const file = (name: string, cards: unknown[]) => {
    const path = testInfo.outputPath(name);
    return writeFile(
      path,
      JSON.stringify({
        format: 'shuijiao-backup',
        version: 1,
        exportedAt: now,
        decks: [],
        cards,
        templates: [],
        reviewStates: [],
        reviewLogs: [],
        links: [],
      }),
    ).then(() => path);
  };

  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(await file('mine.json', mine));
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported: 25 new cards/)).toBeVisible();

  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(await file('theirs.json', theirs));
  await expect(
    page.getByText('25 cards in this backup are different cards with the same characters as yours.'),
  ).toBeVisible();
  await expect(page.getByLabel(/Keep old/)).toBeChecked();

  await page.getByLabel('Choose for each card').check();
  const pairs = page.locator('.dup-pair');
  await expect(pairs).toHaveCount(20);
  await expect(page.getByText('Page 1 of 2').first()).toBeVisible();
  await expect(pairs.first()).toContainText('mine 一');
  await expect(pairs.first()).toContainText('theirs 一');

  // Keep the new card for 一 (page 1) and for 金 (page 2); everything else stays old.
  await pairs
    .first()
    .getByRole('button', { name: /Keep new/ })
    .click();
  await expect(pairs.first().getByRole('button', { name: /Keep new/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Next →' }).first().click();
  await expect(pairs).toHaveCount(5);
  await pairs
    .last()
    .getByRole('button', { name: /Keep new/ })
    .click();
  await expect(page.getByText('Keeping 23 old · 2 new')).toBeVisible();
  await expect(page.getByText(/Duplicates: 23 kept as you have them, 2 replaced/)).toBeVisible();

  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();
  await expect(page.getByText(/2 replaced/)).toBeVisible();

  await page.goto('./#/cards');
  await page.getByLabel('Search cards').fill('theirs');
  await expect(page.locator('.card-list > li')).toHaveCount(2);
  await page.getByLabel('Search cards').fill('');
  await expect(page.locator('.card-list > li')).toHaveCount(25);
});

test('re-importing an edited backup from the same device asks about each edited card', async ({
  page,
}, testInfo) => {
  const now = 1_763_287_200_000;
  const card = (id: string, t: string, meaning: string, extra: Record<string, unknown> = {}) => ({
    id,
    deckId: 'default-deck',
    kind: 'word',
    traditional: t,
    simplified: t,
    pinyin: 'x',
    meaning,
    notes: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    deleted: 0,
    ...extra,
  });
  const before = [
    card('teacher', '老師', 'teacher'),
    card('bye', '再見', 'goodbye'),
    card('good', '好', 'good'),
  ];
  const after = [
    card('teacher', '老師', 'teacher', { tags: ['test'], updatedAt: now + 60_000 }),
    card('bye', '再見', 'goodbye. test', { updatedAt: now + 60_000 }),
    card('good', '好', 'good'),
  ];
  const write = async (name: string, cards: unknown[]) => {
    const path = testInfo.outputPath(name);
    await writeFile(
      path,
      JSON.stringify({
        format: 'shuijiao-backup',
        version: 1,
        exportedAt: now,
        decks: [],
        cards,
        templates: [],
        reviewStates: [],
        reviewLogs: [],
        links: [],
      }),
    );
    return path;
  };

  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(await write('before.json', before));
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();

  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(await write('after.json', after));
  await expect(page.getByText('2 cards in this backup are edited versions of cards you have.')).toBeVisible();
  await page.getByLabel('Choose for each card').check();
  const pairs = page.locator('.dup-pair');
  await expect(pairs).toHaveCount(2);
  await expect(pairs.nth(0)).toContainText('Edited copy of the same card · Differs in tags');
  await expect(pairs.nth(0)).toContainText('Tags: test');
  await expect(pairs.nth(1)).toContainText('Differs in meaning');
  await expect(pairs.nth(1).locator('.dup-card').nth(1)).toContainText('Newer');

  // Take the edited meaning, keep your version of the tags.
  await pairs
    .nth(1)
    .getByRole('button', { name: /Keep new/ })
    .click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();

  await page.goto('./#/cards');
  await expect(page.getByText('goodbye. test')).toBeVisible();
  await expect(page.locator('.card-list > li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Edit 老師' }).click();
  await expect(page.getByLabel('Tags')).toHaveValue('');
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

test('"My cards" can be deleted, moving its cards to another deck', async ({ page }) => {
  await addCard(page, '你好');
  await page.goto('./#/decks');
  // With only one deck, it can't be deleted.
  await expect(page.getByRole('button', { name: 'Delete My cards' })).toBeDisabled();

  await page.getByLabel('New deck name').fill('Lesson 1');
  await page.getByRole('button', { name: 'Add deck' }).click();
  await page.getByRole('button', { name: 'Delete My cards' }).click();

  const dialog = page.getByRole('dialog', { name: 'Delete “My cards”?' });
  await expect(dialog).toContainText('It has 1 card');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(dialog.getByLabel('Deck to move the cards to')).toHaveValue(/.+/);
  await dialog.getByRole('button', { name: 'Delete deck' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('link', { name: 'My cards' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Lesson 1' }).click();
  await expect(page.getByText('你好')).toBeVisible();

  // New cards now default to a deck that exists.
  await addCard(page, '谢谢');
  await page.goto('./#/cards');
  await expect(page.getByText('謝謝')).toBeVisible();
  await expect(page.locator('.card-list .badge', { hasText: 'Lesson 1' })).toHaveCount(2);
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
