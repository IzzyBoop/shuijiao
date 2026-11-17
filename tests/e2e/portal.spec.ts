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

test('the word / sentence switch changes pinyin style, card size, and the Cards filter', async ({ page }) => {
  await page.goto('./#/add');
  await page.getByLabel('Word or sentence in Chinese').fill('我们去银行。');
  await page.getByRole('button', { name: 'Fill in details' }).click();
  const pinyin = page.locator('#field-pinyin');
  await expect(pinyin).toHaveValue('Wǒmen qù yínháng.', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Sentence', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Switching to Word re-formats the auto-filled pinyin and asks you to check it again.
  const pinyinCheck = page.locator('.confirm-field').filter({ has: pinyin }).getByRole('checkbox');
  await pinyinCheck.check();
  await page.getByRole('button', { name: 'Word', exact: true }).click();
  await expect(pinyin).toHaveValue('wǒmen qù yínháng.');
  await expect(pinyinCheck).not.toBeChecked();
  await page.getByRole('button', { name: 'Sentence', exact: true }).click();
  await expect(pinyin).toHaveValue('Wǒmen qù yínháng.');

  // Pinyin you typed yourself is never changed.
  await pinyin.fill('my own pinyin');
  await page.getByRole('button', { name: 'Word', exact: true }).click();
  await expect(pinyin).toHaveValue('my own pinyin');
  await page.getByRole('button', { name: 'Sentence', exact: true }).click();

  await page.locator('#field-meaning').fill('We go to the bank.');
  for (const box of await page.getByRole('checkbox', { name: 'Looks right' }).all()) await box.check();
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await addCard(page, '你好');

  // Sentences are shown smaller when studying.
  await page.goto('./#/browse');
  await page.getByRole('button', { name: 'Shuffle' }).isVisible();
  const sentenceShown = page.locator('.face-traditional.long', { hasText: '我們去銀行。' });
  const wordShown = page.locator('.face-traditional:not(.long)', { hasText: '你好' });
  await expect(sentenceShown.or(wordShown)).toBeVisible();

  // The Cards page can show just sentences or just words.
  await page.goto('./#/cards');
  await page.getByLabel('Words or sentences').selectOption('sentence');
  await expect(page.locator('.card-list > li')).toHaveCount(1);
  await expect(page.getByText('我們去銀行。')).toBeVisible();
  await page.getByLabel('Words or sentences').selectOption('word');
  await expect(page.getByText('你好')).toBeVisible();
  await expect(page.locator('.card-list > li')).toHaveCount(1);
});

test('an info tooltip explains word vs sentence', async ({ page }) => {
  await page.goto('./#/add');
  await page.getByLabel('Word or sentence in Chinese').fill('银行');
  await page.getByRole('button', { name: 'Fill in details' }).click();
  await expect(page.locator('#field-traditional')).toHaveValue('銀行', { timeout: 30_000 });
  const info = page.getByRole('button', { name: /difference between a word and a sentence/ });
  const tip = page.getByRole('tooltip');

  await info.hover();
  await expect(tip).toContainText('Pinyin word by word');
  await expect(tip).toContainText('Pinyin as a sentence');
  await expect(info).toHaveAttribute('aria-describedby', /.+/);
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();

  // Keyboard: focus opens it, Escape closes it.
  await info.focus();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();

  // A click (tap on phones) keeps it open until you click elsewhere.
  await info.click();
  await page.mouse.move(0, 0);
  await expect(tip).toBeVisible();
  await page.getByRole('heading', { name: 'Add a card' }).click();
  await expect(tip).toBeHidden();
});

test('a new deck can be created while adding a card', async ({ page }) => {
  await page.goto('./#/add');
  await page.getByLabel('Word or sentence in Chinese').fill('谢谢');
  await page.getByRole('button', { name: 'Fill in details' }).click();
  await expect(page.locator('#field-traditional')).toHaveValue('謝謝', { timeout: 30_000 });

  await page.getByRole('button', { name: 'New deck' }).click();
  await expect(page.getByLabel('New deck name')).toBeFocused();
  await page.getByLabel('New deck name').fill('Lesson 4');
  await page.keyboard.press('Enter');
  await expect(page.locator('#card-deck')).toHaveValue(/.+/);
  await expect(page.locator('#card-deck option:checked')).toHaveText('Lesson 4');

  // Typing a name you already have just selects that deck.
  await page.getByRole('button', { name: 'New deck' }).click();
  await page.getByLabel('New deck name').fill('my CARDS');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('#card-deck option:checked')).toHaveText('My cards');
  await page.locator('#card-deck').selectOption({ label: 'Lesson 4' });

  for (const box of await page.getByRole('checkbox', { name: 'Looks right' }).all()) await box.check();
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.goto('./#/decks');
  await expect(page.getByRole('link', { name: 'Lesson 4' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lesson 4' }).locator('..')).toContainText('1 card');
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

test('pressing Again does not bring the same card straight back', async ({ page }, testInfo) => {
  const now = 1_763_287_200_000;
  const chars = ['一', '二', '三', '四', '五', '六'];
  const file = testInfo.outputPath('six.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [],
      cards: chars.map((c, i) => ({
        id: `c${i}`,
        deckId: 'default-deck',
        kind: 'word',
        traditional: c,
        simplified: c,
        pinyin: 'x',
        meaning: `number ${i + 1}`,
        notes: '',
        tags: [],
        createdAt: now + i,
        updatedAt: now + i,
        deleted: 0,
      })),
      templates: [],
      reviewStates: [],
      reviewLogs: [],
      links: [],
    }),
  );
  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();

  await page.goto('./#/review');
  const face = page.locator('.flashcard .face-traditional');
  await expect(face).toBeVisible();
  // Press Again on every card, several times: the next card must always be a different one.
  for (let round = 0; round < 5; round++) {
    const previous = (await face.textContent())?.trim() ?? '';
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: /Again/ }).click();
    await expect(face, `round ${round}: "${previous}" came straight back`).not.toHaveText(previous);
  }
});

test('after clicking a rating, Space reveals the next answer without rating it', async ({ page }) => {
  await addCard(page, '你好');
  await addCard(page, '谢谢');
  await page.goto('./#/review');
  const card = page.locator('.flashcard');
  await expect(card.locator('.face-traditional')).toBeVisible();
  await page.getByRole('button', { name: /Show answer/ }).click();
  await page.getByRole('button', { name: /Good/ }).click(); // mouse: focus would stay on a button
  await expect(page.getByText(/^1 left/)).toBeVisible();
  await page.keyboard.press('Space');
  // The answer is shown and the card is still waiting for a rating (not rated "Again").
  await expect(page.getByRole('button', { name: /Easy/ })).toBeVisible();
  await expect(page.getByText(/^1 left/)).toBeVisible();
});

test('"All fields look right" ticks every field at once', async ({ page }) => {
  await page.goto('./#/add');
  await page.getByLabel('Word or sentence in Chinese').fill('银行');
  await page.getByRole('button', { name: 'Fill in details' }).click();
  await expect(page.locator('#field-traditional')).toHaveValue('銀行', { timeout: 30_000 });
  const all = page.getByLabel('All fields look right');
  const save = page.getByRole('button', { name: 'Save card' });
  await expect(save).toBeDisabled();
  await all.check();
  await expect(page.getByRole('checkbox', { name: 'Looks right' })).toHaveCount(4);
  for (const box of await page.getByRole('checkbox', { name: 'Looks right' }).all())
    await expect(box).toBeChecked();
  await expect(save).toBeEnabled();
  await all.uncheck();
  await expect(save).toBeDisabled();

  // With the meaning empty, the others are ticked and you're told what's missing.
  await page.locator('#field-meaning').fill('');
  await all.click();
  await expect(all).not.toBeChecked();
  await expect(page.getByText(/Fill in the meaning first \(3\/4 checked\)/)).toBeVisible();
  await page.locator('#field-meaning').fill('bank');
  await expect(all).toBeChecked();
  await save.click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
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

test('cards can be edited mid-session in study and flip through', async ({ page }) => {
  await addCard(page, '银行');

  // Study: open the editor with E, while the answer is still hidden.
  await page.goto('./#/review');
  const card = page.locator('.flashcard');
  await expect(card).toContainText('銀行');
  await page.keyboard.press('e');
  const dialog = page.getByRole('dialog', { name: 'Edit card' });
  await expect(dialog).toBeVisible();
  // Typing a space in the form must not reveal or rate the card underneath.
  await dialog.getByLabel('Meaning').fill('bank (the place for money)');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(card).not.toContainText('yínháng');
  await page.keyboard.press('Space');
  await expect(card).toContainText('bank (the place for money)');
  await expect(page.getByText('1 left')).toBeVisible();

  // Flip through: the Edit button works the same way.
  await page.goto('./#/browse');
  await page.getByRole('button', { name: /Edit card/ }).click();
  await dialog.getByLabel('Notes').fill('Measure word: 家');
  await dialog.getByRole('button', { name: /Save/ }).click();
  await expect(dialog).toBeHidden();
  await page.keyboard.press('Space');
  await expect(card).toContainText('Measure word: 家');

  // Escape cancels without saving.
  await page.keyboard.press('e');
  await dialog.getByLabel('Meaning').fill('changed my mind');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card).not.toContainText('changed my mind');
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

test('imports go into your existing deck with the same name, and same-name decks can be merged', async ({
  page,
}, testInfo) => {
  const now = 1_763_287_200_000;
  // You made "Lesson 1" yourself…
  await page.goto('./#/decks');
  await page.getByLabel('New deck name').fill('Lesson 1');
  await page.getByRole('button', { name: 'Add deck' }).click();
  await expect(page.getByRole('link', { name: 'Lesson 1' })).toBeVisible();
  // …and a classmate's backup has its own "Lesson 1" (a different deck id).
  const file = testInfo.outputPath('classmate.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [{ id: 'their-lesson-1', name: 'Lesson 1', createdAt: now, updatedAt: now, deleted: 0 }],
      cards: [
        {
          id: 'c1',
          deckId: 'their-lesson-1',
          kind: 'word',
          traditional: '謝謝',
          simplified: '谢谢',
          pinyin: 'xièxie',
          meaning: 'thanks',
          notes: '',
          tags: [],
          createdAt: now,
          updatedAt: now,
          deleted: 0,
        },
      ],
      templates: [],
      reviewStates: [],
      reviewLogs: [],
      links: [],
    }),
  );
  await page.goto('./#/settings');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('No new decks are created.')).toBeVisible();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();
  await page.goto('./#/decks');
  await expect(page.getByRole('link', { name: 'Lesson 1' })).toHaveCount(1);

  // A name you already use is refused.
  await page.getByLabel('New deck name').fill('lesson 1');
  await page.getByRole('button', { name: 'Add deck' }).click();
  await expect(page.getByRole('alert')).toContainText('You already have a deck called “Lesson 1”');

  // Decks with the same name left over from before can be merged in one click.
  await page.evaluate(
    (t) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('shuijiao');
        open.onsuccess = () => {
          const tx = open.result.transaction('decks', 'readwrite');
          tx.objectStore('decks').put({
            id: 'old-dupe',
            name: 'Lesson 1',
            createdAt: t,
            updatedAt: t,
            deleted: 0,
          });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => {
            reject(new Error('write failed'));
          };
        };
      }),
    now,
  );
  await page.reload();
  await expect(page.getByText('You have 2 decks called “Lesson 1”')).toBeVisible();
  await page.getByRole('button', { name: 'Merge into one' }).click();
  await expect(page.getByText(/You have 2 decks called/)).toBeHidden();
  await expect(page.getByRole('link', { name: 'Lesson 1' })).toHaveCount(1);
  await page.getByRole('link', { name: 'Lesson 1' }).click();
  await expect(page.getByText('謝謝')).toBeVisible();
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
  // The exact differences are highlighted: added text and tags on the backup's side.
  await expect(pairs.nth(0).locator('ins')).toHaveText('test');
  await expect(pairs.nth(0).locator('.dup-card').first()).toContainText('(no tags)');
  await expect(pairs.nth(1).locator('ins')).toHaveText('. test');
  await expect(pairs.nth(1).locator('del')).toHaveCount(0);

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

test.describe('backup file names', () => {
  // 20:00 UTC on 16 Nov is already 10:00 on 17 Nov on Kiritimati (UTC+14).
  test.use({ timezoneId: 'Pacific/Kiritimati' });

  test('use the local date, not the UTC date', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-16T20:00:00Z'));
    await page.goto('./#/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download backup' }).click();
    expect((await download).suggestedFilename()).toBe('shuijiao-backup-2026-11-17.json');
  });
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
  await page.getByLabel(/^Select all \d+/).check();
  await page.getByLabel('Move selected cards to deck').selectOption('l2');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(page.getByText('This deck has no cards yet.')).toBeVisible();
  await page.getByRole('link', { name: /Lesson 2/ }).click();
  await expect(page.locator('.card-list > li')).toHaveCount(3);
});

test('bulk edit: filter by length, select all, change type and tags, and undo', async ({
  page,
}, testInfo) => {
  const now = 1_763_287_200_000;
  const card = (id: string, t: string, kind: string) => ({
    id,
    deckId: 'default-deck',
    kind,
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
  const file = testInfo.outputPath('mixed.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [],
      cards: [
        card('a', '好', 'sentence'),
        card('b', '我', 'sentence'),
        card('c', '你好', 'word'),
        card('d', '對（了）', 'word'),
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
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();

  await page.goto('./#/cards');
  const rows = page.locator('.card-list > li');
  const lengthFilter = page.getByLabel('Number of characters');
  const kindFilter = page.getByLabel('Words or sentences');

  // 1 character → words.
  await lengthFilter.selectOption('one');
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByLabel(/^Select all \d+/).check();
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Make words' }).click();
  await expect(page.getByText('2 cards set to word.')).toBeVisible();

  // 2+ characters → sentences ("對（了）" counts 2 Chinese characters).
  await lengthFilter.selectOption('many');
  await page.getByLabel(/^Select all \d+/).uncheck();
  await page.getByLabel(/^Select all \d+/).check();
  await page.getByRole('button', { name: 'Make sentences' }).click();
  await expect(page.getByText('2 cards set to sentence.')).toBeVisible();

  await lengthFilter.selectOption('any');
  await kindFilter.selectOption('word');
  await expect(rows).toHaveCount(2);
  await kindFilter.selectOption('sentence');
  await expect(rows).toHaveCount(2);
  await expect(page.getByText('你好')).toBeVisible();

  // Undo the last change.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(rows).toHaveCount(0);
  await kindFilter.selectOption('all');

  // Tags in bulk.
  await page.getByLabel(/^Select all \d+/).uncheck();
  await page.getByLabel(/^Select all \d+/).check();
  await page.getByLabel('Tags to add or remove').fill('lesson-1');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await expect(page.getByText('4 cards tagged lesson-1.')).toBeVisible();
  await page.getByRole('button', { name: 'Done selecting' }).click();
  await page.getByLabel('Search cards').fill('lesson-1');
  await expect(rows).toHaveCount(4);
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
