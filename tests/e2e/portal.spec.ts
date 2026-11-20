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

test('a quick second press or a held-down key never rates a card twice', async ({ page }) => {
  await addCard(page, '你好');
  await page.goto('./#/review');
  await expect(page.locator('.flashcard .face-traditional')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: /Good/ })).toBeVisible();
  // A held-down key only repeats: it rates nothing.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', repeat: true }));
  });
  await expect(page.getByRole('button', { name: /Good/ })).toBeVisible();
  // Two presses in the same moment, before the first rating is saved: only one counts.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
  });
  await expect(page.getByRole('heading', { name: /Session complete/ })).toBeVisible();
  await expect(page.getByText('You reviewed 1 card.')).toBeVisible();
});

test('the Study page shows your progress below the decks', async ({ page }) => {
  await addCard(page, '銀行');
  await page.goto('./#/');
  const progress = page.locator('section.progress');
  await expect(progress).toContainText("Your progress shows up here once you've studied a few cards.");

  await page.getByRole('link', { name: 'Study now' }).click();
  await expect(page.locator('.flashcard')).toContainText('銀行');
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /Good/ }).click();
  await expect(page.getByRole('heading', { name: /Session complete/ })).toBeVisible();

  await page.goto('./#/');
  await expect(progress.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(progress.locator('.stat-tile').first()).toContainText('1day in a row');
  await expect(progress.getByRole('img', { name: /you studied on 1 day\./ })).toBeVisible();
  await expect(progress.getByRole('img', { name: /^Cards due: Today/ })).toBeVisible();
  await expect(progress).toContainText('Good or Easy, of 1 answer');
  await expect(progress).toContainText('None so far');
});

test('you can study or flip through just the cards with one tag', async ({ page }, testInfo) => {
  const now = 1_763_287_200_000;
  const tagged = (id: string, t: string, tags: string[]) => ({
    id,
    deckId: 'default-deck',
    kind: 'word',
    traditional: t,
    simplified: t,
    pinyin: 'x',
    meaning: `meaning of ${t}`,
    notes: '',
    tags,
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  });
  const file = testInfo.outputPath('tagged.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [],
      cards: [tagged('a', '一', ['quiz Friday']), tagged('b', '二', ['量詞']), tagged('c', '三', [])],
      templates: [],
      reviewStates: [],
      reviewLogs: [],
      links: [],
    }),
  );
  await page.goto('./#/settings');
  await page.getByLabel('Import a backup…').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();

  await page.goto('./#/');
  const tags = page.locator('section.panel', { has: page.getByRole('heading', { name: 'Tags' }) });
  await expect(tags).toContainText('#quiz Friday');
  await expect(tags).toContainText('#量詞');

  await tags.getByRole('link', { name: 'Study #quiz Friday' }).click();
  await expect(page.locator('.flashcard')).toContainText('一');
  await expect(page.getByText(/^1 left/)).toBeVisible();
  await page.reload(); // the tag is in the address, so it survives a reload
  await expect(page.getByText(/^1 left/)).toBeVisible();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /Good/ }).click();
  await expect(page.getByRole('heading', { name: /Session complete/ })).toBeVisible();

  await page.goto('./#/');
  await tags.getByRole('link', { name: 'Flip through #量詞' }).click();
  await expect(page.getByRole('heading', { name: 'Flip through: #量詞' })).toBeVisible();
  await expect(page.locator('.flashcard')).toContainText('二');
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
  await page.getByLabel('Import a backup…').setInputFiles(file);
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
  await page.getByRole('link', { name: 'Study ahead' }).click();
  await expect(page.getByText('Studying ahead')).toBeVisible();
  await expect(page.locator('.flashcard')).toContainText('你好');
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /Good/ }).click();
  await expect(page.getByRole('heading', { name: /Session complete/ })).toBeVisible();

  // The ordinary session has nothing, and offers the same.
  await page.goto('./#/review');
  await expect(page.getByRole('heading', { name: /Nothing to study/ })).toBeVisible();
  await page.getByRole('link', { name: 'Study ahead' }).click();
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
  const file = testInfo.outputPath('backup.json.gz');
  await (await download).saveAs(file);

  await page.getByText('Erase all study data').click();
  await page.getByLabel('Type ERASE to confirm').fill('ERASE');
  await page.getByRole('button', { name: 'Erase everything' }).click();
  await expect(page.getByText('All study data in this browser was erased.')).toBeVisible();

  await page.getByLabel('Import a backup…').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported: 1 new card\b/)).toBeVisible();
  await page.goto('./#/cards');
  await expect(page.getByText('銀行')).toBeVisible();
});

test('an import or an erase can be undone', async ({ page }, testInfo) => {
  await addCard(page, '银行');
  const now = 1_763_287_200_000;
  const file = testInfo.outputPath('other.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [],
      cards: [
        {
          id: 'other-card',
          deckId: 'default-deck',
          kind: 'word',
          traditional: '頭髮',
          simplified: '头发',
          pinyin: 'tóufa',
          meaning: 'hair',
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
  await page.getByLabel('Import a backup…').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();
  // Right away, on the results screen.
  await page.getByRole('button', { name: 'Undo this import' }).click();
  await expect(page.getByRole('heading', { name: 'Import undone' })).toBeVisible();
  await page.goto('./#/cards');
  await expect(page.getByText('銀行')).toBeVisible();
  await expect(page.getByText('頭髮')).toBeHidden();

  // Later, from Settings: undo an erase.
  await page.goto('./#/settings');
  await page.getByText('Erase all study data').click();
  await page.getByLabel('Type ERASE to confirm').fill('ERASE');
  await page.getByRole('button', { name: 'Erase everything' }).click();
  await expect(page.getByText('You can still undo this below.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo the last erase…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Undo the erase' }).click();
  await expect(page.getByText('Everything is back as it was before.')).toBeVisible();
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
  await page.getByLabel('Import a backup…').setInputFiles(file);
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
  await page.getByLabel('Import a backup…').setInputFiles(file);
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
  await page.getByLabel('Import a backup…').setInputFiles(await file('mine.json', mine));
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported: 25 new cards/)).toBeVisible();

  await page.goto('./#/settings');
  await page.getByLabel('Import a backup…').setInputFiles(await file('theirs.json', theirs));
  await expect(
    page.getByText(
      '25 cards in this backup are different cards with the same characters and pinyin as yours.',
    ),
  ).toBeVisible();
  await expect(page.getByLabel(/Keep old/)).toBeChecked();

  await page.getByLabel('Choose for each card').check();
  const pairs = page.locator('.dup-pair');
  await expect(pairs).toHaveCount(25);
  await page
    .getByRole('navigation', { name: 'Duplicate pages', exact: true })
    .getByRole('combobox')
    .selectOption('10');
  await expect(pairs).toHaveCount(10);
  await expect(page.getByText('Page 1 of 3').first()).toBeVisible();
  await expect(pairs.first()).toContainText('mine 一');
  await expect(pairs.first()).toContainText('theirs 一');

  // Keep the new card for 一 (page 1) and for 金 (page 3); everything else stays old.
  await pairs
    .first()
    .getByRole('button', { name: /Keep new/ })
    .click();
  await expect(pairs.first().getByRole('button', { name: /Keep new/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Next →' }).first().click();
  await page.getByRole('button', { name: 'Next →' }).first().click();
  await expect(pairs).toHaveCount(5);
  await pairs
    .last()
    .getByRole('button', { name: /Keep new/ })
    .click();
  await expect(page.getByText('Keeping 23 old · 2 new')).toBeVisible();
  await expect(page.getByText(/Duplicates: 23 kept as you have them, 2 updated/)).toBeVisible();

  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();
  await expect(page.getByText(/2 cards of yours updated/)).toBeVisible();

  await page.goto('./#/cards');
  await page.getByLabel('Search cards').fill('theirs');
  await expect(page.locator('.card-list > li')).toHaveCount(2);
  await page.getByLabel('Search cards').fill('');
  // The page size picked for duplicates (10) applies to every card list.
  await expect(page.locator('.card-list > li')).toHaveCount(10);
  await expect(page.getByText('1–10 of 25').first()).toBeVisible();
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
  await page.getByLabel('Import a backup…').setInputFiles(await write('before.json', before));
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();

  await page.goto('./#/settings');
  await page.getByLabel('Import a backup…').setInputFiles(await write('after.json', after));
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
    expect((await download).suggestedFilename()).toBe('shuijiao-backup-2026-11-17.json.gz');
  });
});

test('a new student can import a backup straight from the Study page', async ({ page }, testInfo) => {
  const now = 1_763_287_200_000;
  const file = testInfo.outputPath('first.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [{ id: 'l1', name: 'Lesson 1', createdAt: now, updatedAt: now, deleted: 0 }],
      cards: [
        {
          id: 'a',
          deckId: 'l1',
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
  await page.goto('./#/');
  await expect(page.getByRole('heading', { name: 'Welcome! 歡迎!' })).toBeVisible();
  await page.getByLabel('Import a backup…').setInputFiles(file);
  await expect(page.getByRole('heading', { name: 'Import a backup' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome! 歡迎!' })).toBeVisible();

  await page.getByLabel('Import a backup…').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported: 1 new card\b/)).toBeVisible();
  await page.getByRole('link', { name: 'Back to Study' }).click();
  await expect(page.getByText('1 card total')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome! 歡迎!' })).toHaveCount(0);
});

test.describe('course cards', () => {
  // Requests the service worker makes can't be faked with page.route.
  test.use({ serviceWorkers: 'block' });
  const now = 1_763_287_200_000;
  const card = (id: string, deckId: string, t: string, kind = 'word') => ({
    id,
    deckId,
    kind,
    traditional: t,
    simplified: t,
    pinyin: 'x',
    meaning: `meaning of ${t}`,
    notes: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  });
  const course = {
    format: 'shuijiao-backup',
    version: 1,
    exportedAt: now,
    decks: [
      { id: 'l1', name: 'Lesson 1', createdAt: now, updatedAt: now, deleted: 0 },
      { id: 'l2', name: 'Lesson 2', createdAt: now, updatedAt: now, deleted: 0 },
    ],
    cards: [card('a', 'l1', '你'), card('b', 'l1', '我是學生', 'sentence'), card('c', 'l2', '好')],
    templates: [],
    reviewStates: [],
    reviewLogs: [],
    links: [],
  };

  test('the course banner comes back when you lose course cards, e.g. by restoring an older backup', async ({
    page,
  }) => {
    await addCard(page, '銀行');
    await page.route('**/course/course-deck.json', (route) => route.fulfill({ json: course }));
    // Take every course card.
    await page.goto('./#/course');
    await page.getByRole('button', { name: 'Import these cards' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();
    await page.goto('./#/');
    await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
    const banner = page.locator('.notice', { hasText: 'The course cards' });
    await expect(page.locator('.stat')).toBeVisible();
    await expect(banner).toHaveCount(0);

    // One of them disappears, as when an older backup is restored.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const open = indexedDB.open('shuijiao');
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('cards', 'readwrite');
            const get = tx.objectStore('cards').get('a');
            get.onsuccess = () => {
              tx.objectStore('cards').put({ ...(get.result as object), deleted: 1 });
            };
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        }),
    );
    await page.reload();
    await expect(banner).toContainText("The course cards have 1 card you don't have yet.");
    await expect(banner).not.toContainText('updated on');
  });

  test('the Study page says when the course cards change, until you look', async ({ page }) => {
    await addCard(page, '銀行'); // a card of your own (none of the course cards)
    await page.route('**/course/course-deck.json', (route) => route.fulfill({ json: course }));
    await page.goto('./#/');
    const banner = page.locator('.notice', { hasText: 'The course cards' });
    await expect(banner).toContainText("The course cards have 3 cards you don't have yet.");
    await banner.getByRole('link', { name: 'See the course cards' }).click();
    await expect(page.getByRole('button', { name: 'Import these cards' })).toBeVisible(); // loaded
    await page.goto('./#/');
    await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
    await expect(banner).toHaveCount(0);

    // A new version with one more card: the banner is back, and closing it hides it for good.
    const updated = {
      ...course,
      exportedAt: now + 86_400_000,
      cards: [...course.cards, card('d', 'l2', '書')],
    };
    await page.unroute('**/course/course-deck.json');
    await page.route('**/course/course-deck.json', (route) => route.fulfill({ json: updated }));
    await page.reload();
    await expect(banner).toContainText('updated on');
    await expect(banner).toContainText("4 cards you don't have yet");
    await banner.getByRole('button', { name: 'Hide until the course cards change again' }).click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
    await expect(page.locator('section.panel').first()).toBeVisible();
    await expect(banner).toHaveCount(0);
  });
  test('shows what is in them and imports them through the usual import steps', async ({ page }) => {
    await page.route('**/course/course-deck.json', (route) => route.fulfill({ json: course }));
    await page.goto('./#/');
    await page.getByRole('link', { name: 'Course cards' }).first().click();
    await expect(page.getByRole('heading', { name: 'Course cards' })).toBeVisible();
    await expect(page.getByText('2 words and 1 sentence')).toBeVisible();
    await expect(page.getByText('last updated')).toBeVisible();
    await page.getByText('Lesson 1').click();
    await expect(page.getByText('meaning of 我是學生')).toBeVisible();
    await expect(page.getByText('Lesson 2')).toBeVisible();

    await page.getByRole('button', { name: 'Import these cards' }).click();
    await expect(page.getByRole('heading', { name: 'Import the course cards' })).toBeVisible();
    await expect(page.getByText('This creates decks: “Lesson 1” and “Lesson 2”.')).toBeVisible();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByText(/Imported: 3 new cards/)).toBeVisible();

    await page.getByRole('link', { name: 'Back to Course cards' }).click();
    await expect(page.getByText('You already have all of these cards.')).toBeVisible();
  });

  test('marks which cards are new to a student who already has some', async ({ page }) => {
    await page.route('**/course/course-deck.json', (route) => route.fulfill({ json: course }));
    await page.goto('./#/course');
    await page.getByRole('button', { name: 'Import these cards' }).click();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByText(/Imported: 3 new cards/)).toBeVisible();

    const updated = {
      ...course,
      exportedAt: now + 86_400_000,
      cards: [...course.cards, card('d', 'l2', '他')],
    };
    await page.unroute('**/course/course-deck.json');
    await page.route('**/course/course-deck.json', (route) => route.fulfill({ json: updated }));
    await page.goto('./#/course');
    await expect(
      page.getByText(/Compared with your cards: 1 new to you and 3 you already have/),
    ).toBeVisible();
    await page.getByText('Lesson 2').click();
    await expect(page.locator('.course-deck li', { hasText: '他' }).getByText('New to you')).toBeVisible();
  });

  test('says so when none have been published', async ({ page }) => {
    await page.route('**/course/course-deck.json', (route) =>
      route.fulfill({ status: 404, body: 'Not found' }),
    );
    await page.goto('./#/course');
    await expect(page.getByText('There are no course cards yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import these cards' })).toHaveCount(0);
  });

  test('refuses a course file that fails the backup checks', async ({ page }) => {
    await page.route('**/course/course-deck.json', (route) =>
      route.fulfill({
        json: { ...course, cards: [{ ...card('a', 'l1', '你'), evil: '<img src=x onerror=alert(1)>' }] },
      }),
    );
    await page.goto('./#/course');
    await expect(page.getByText(/can't be read/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import these cards' })).toHaveCount(0);
  });
});

test('card lists are paged, and you can select a page or every card', async ({ page }, testInfo) => {
  const now = 1_763_287_200_000;
  const hanzi = [...'一二三四五六七八九十人大小山水火木金土日月中上下口手心女子天'];
  const file = testInfo.outputPath('many.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [{ id: 'l1', name: 'Lesson 1', createdAt: now, updatedAt: now, deleted: 0 }],
      cards: hanzi.map((t, i) => ({
        id: `c${i}`,
        deckId: 'l1',
        kind: 'word',
        traditional: t,
        simplified: t,
        pinyin: 'x',
        meaning: `m${i}`,
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
  await page.getByLabel('Import a backup…').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported: 30 new cards/)).toBeVisible();

  await page.goto('./#/cards');
  const pager = page.getByRole('navigation', { name: 'Card pages', exact: true });
  await expect(pager.getByText('1–30 of 30')).toBeVisible();
  await pager.getByRole('combobox').selectOption('10');
  await expect(pager.getByText('1–10 of 30')).toBeVisible();
  await expect(pager.getByText('Page 1 of 3')).toBeVisible();
  await expect(page.locator('.card-list > li')).toHaveCount(10);
  await page
    .getByRole('navigation', { name: 'Card pages, bottom' })
    .getByRole('button', { name: 'Next →' })
    .click();
  await expect(pager.getByText('11–20 of 30')).toBeVisible();

  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByLabel('Select all on this page (10)').check();
  await expect(page.getByText('10 selected')).toBeVisible();
  await pager.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByText('(10 not on this page)')).toBeVisible();
  await expect(page.getByLabel('Select all on this page (10)')).not.toBeChecked();
  await page.getByRole('button', { name: 'Select all 30 cards' }).click();
  await expect(page.getByText('30 selected')).toBeVisible();
  await expect(page.getByLabel('Select all on this page (10)')).toBeChecked();
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.getByText('0 selected')).toBeVisible();

  // The chosen page size is remembered.
  await page.reload();
  await expect(pager.getByText('1–10 of 30')).toBeVisible();
  await pager.getByRole('combobox').selectOption({ label: 'All' });
  await expect(page.locator('.card-list > li')).toHaveCount(30);
  await expect(pager.getByText(/Page \d/)).toHaveCount(0);
});

test('a hostile backup file is rejected', async ({ page }, testInfo) => {
  const file = testInfo.outputPath('evil.json');
  await writeFile(
    file,
    '{"__proto__":{"isAdmin":true},"format":"shuijiao-backup","version":1,"exportedAt":1,"decks":[],"cards":[],"templates":[],"reviewStates":[],"reviewLogs":[]}',
  );
  await page.goto('./#/settings');
  await page.getByLabel('Import a backup…').setInputFiles(file);
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
  await page.getByLabel('Import a backup…').setInputFiles(file);
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
  await page.getByLabel('Import a backup…').setInputFiles(file);
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

test('clicking the version number sends a dumpling flying, then it goes away', async ({ page }) => {
  await page.goto('./#/');
  await page.locator('footer button.version').click();
  const dumpling = page.locator('.dumpling-fly');
  await expect(dumpling).toHaveCount(1);
  await expect(dumpling).toHaveText('🥟');
  await expect(dumpling).toHaveAttribute('aria-hidden', 'true');
  await expect(dumpling).toHaveCount(0, { timeout: 5_000 });
});

test('the "works best in Chrome" message can be closed for good', async ({ page }) => {
  await page.goto('./#/');
  const notice = page.locator('.site-notice');
  await expect(notice).toContainText('works best in Google Chrome');
  await page.goto('./#/cards');
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Close this message' }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test('the Chrome message says how to take your cards along', async ({ page }) => {
  await page.goto('./#/');
  const notice = page.locator('.site-notice');
  await expect(notice).toContainText('Your cards stay in the browser you made them in');
  await notice.getByRole('link', { name: 'download a backup' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByText('Your cards are stored only in this browser.')).toBeVisible();
});

test.describe('on an iPad', () => {
  // iPads report themselves as a Mac with a touch screen.
  test.use({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  });

  test('there is no Chrome message: every browser there has the same voices', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
    });
    await page.goto('./#/');
    await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
    await expect(page.locator('.site-notice')).toHaveCount(0);
  });
});

test('the 墨 Ink style (beta) can be switched on and off, and Classic never loads its fonts', async ({
  page,
}) => {
  const fonts: string[] = [];
  page.on('request', (r) => {
    if (/\.woff2$|\/fonts\//.test(r.url())) fonts.push(r.url());
  });
  await page.goto('./#/settings');
  const html = page.locator('html');
  await expect(page.getByLabel('Theme', { exact: true })).toBeVisible();
  await expect(html).not.toHaveAttribute('data-style', 'ink');
  expect(fonts).toEqual([]);

  await page.getByRole('button', { name: '墨 Ink (beta)' }).click();
  await expect(html).toHaveAttribute('data-style', 'ink');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(html).toHaveAttribute('data-theme', 'ink');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(html).toHaveAttribute('data-theme', 'ink-paper');
  await expect(page.getByLabel('Theme', { exact: true })).toHaveCount(0); // Ink has its own colours
  await expect(page.getByText('墨 Ink has its own colours')).toBeVisible();
  await expect.poll(() => fonts.length).toBeGreaterThan(0); // its fonts load now

  // Applied before the first paint after a reload (by theme-init.js).
  await page.reload();
  await expect(html).toHaveAttribute('data-style', 'ink');
  await expect(html).toHaveAttribute('data-theme', 'ink-paper');

  await page.getByRole('button', { name: 'Classic', exact: true }).click();
  await expect(html).not.toHaveAttribute('data-style', 'ink');
  await expect(page.getByLabel('Theme', { exact: true })).toBeVisible();
});

test('墨 Ink sets pinyin in a font that has every tone mark (no loose or borrowed marks)', async ({
  page,
}) => {
  await addCard(page, '女兒');
  await page.goto('./#/settings');
  await page.getByRole('button', { name: '墨 Ink (beta)' }).click();
  await page.goto('./#/browse');
  await expect(page.locator('.flashcard')).toContainText('女兒');
  await page.keyboard.press('Space');
  const family = await page
    .locator('.face-pinyin')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family.startsWith("'Ink Grotesk'") || family.startsWith('"Ink Grotesk"')).toBe(true);
  // Every pinyin letter must come from that font itself: measured with two very different
  // fallback fonts behind it, a letter it has keeps its width; a borrowed one doesn't.
  const borrowed = await page.evaluate(async () => {
    const letters = [...'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜ'];
    await document.fonts.load("40px 'Ink Grotesk'", letters.join(''));
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return ['no canvas'];
    const width = (font: string, ch: string) => {
      ctx.font = font;
      return ctx.measureText(ch).width;
    };
    return letters.filter(
      (ch) =>
        Math.abs(
          width("40px 'Ink Grotesk', 'Courier New', monospace", ch) -
            width("40px 'Ink Grotesk', 'Zapfino', cursive", ch),
        ) > 0.01,
    );
  });
  expect(borrowed).toEqual([]);
});

test('a Noto Serif TC download from v1.3.0 is cleaned up on the next visit', async ({ page }) => {
  await page.goto('./#/');
  await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
  // As v1.3.0 left it for a student who downloaded the font.
  await page.evaluate(async () => {
    localStorage.setItem('portal.theme.inkFont', 'noto');
    const cache = await caches.open('fonts');
    await cache.put('fonts/noto-serif-tc/noto-serif-tc-1-500-normal.woff2', new Response('font'));
    await cache.put('assets/fraunces-abc.woff2', new Response('kept'));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('portal.theme.inkFont'))).toBeNull();
  const left = await page.evaluate(async () =>
    (await (await caches.open('fonts')).keys()).map((r) => new URL(r.url).pathname.split('/').pop()),
  );
  expect(left).toEqual(['fraunces-abc.woff2']); // only the Noto pieces are removed
  await page.goto('./#/settings');
  await page.getByRole('button', { name: '墨 Ink (beta)' }).click();
  await expect(page.getByText(/Noto Serif TC/)).toHaveCount(0);
});

test('Google Chrome users never see the Chrome message', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { brands: [{ brand: 'Google Chrome', version: '142' }] },
    });
  });
  await page.goto('./#/');
  await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
  await expect(page.locator('.site-notice')).toHaveCount(0);
});

test('Settings shows when the last backup was made, and can check a backup file', async ({
  page,
}, testInfo) => {
  await addCard(page, '銀行');
  await page.goto('./#/settings');
  await expect(page.getByText('You have not made a backup yet.')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const file = testInfo.outputPath('check.json.gz');
  await (await download).saveAs(file);
  await expect(page.getByText(/Last backup: .* \(today\), 0\.1 MB\./)).toBeVisible();

  await page.getByLabel('Check a backup file…').setInputFiles(file);
  await expect(
    page.getByText(/check\.json\.gz is a good backup from .*: 1 card in 1 deck, with 0 answers\./),
  ).toBeVisible();
  await expect(page.getByText('Nothing was changed.')).toBeVisible();

  const bad = testInfo.outputPath('notes.json');
  await writeFile(bad, '{"hello": "world"}');
  await page.getByLabel('Check a backup file…').setInputFiles(bad);
  await expect(page.getByText(/notes\.json can't be imported\./)).toBeVisible();
});

test('the Study page offers to protect your cards from clean-up', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'persisted', { value: () => Promise.resolve(false) });
    Object.defineProperty(navigator.storage, 'persist', { value: () => Promise.resolve(true) });
  });
  await addCard(page, '銀行');
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Protect my cards' }).click();
  await expect(
    page.getByText('Done: your browser will keep your cards even when space runs low.'),
  ).toBeVisible();
});

test.describe('on an iPhone', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  });

  test('the Study page explains how to keep your cards from being deleted by Safari', async ({ page }) => {
    await addCard(page, '銀行');
    await page.goto('./#/');
    const tip = page.locator('.notice', { hasText: "Safari deletes a website's data" });
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Add to Home Screen');
    await expect(tip).toContainText('import the backup there');
    await expect(page.getByRole('button', { name: 'Protect my cards' })).toHaveCount(0);
    await tip.getByRole('button', { name: 'Hide this tip for a month' }).click();
    await expect(tip).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Study' })).toBeVisible();
    await expect(tip).toHaveCount(0);
  });
});

test('the backup reminder can be hidden for a week', async ({ page }, testInfo) => {
  const now = 1_763_287_200_000;
  const file = testInfo.outputPath('ten.json');
  await writeFile(
    file,
    JSON.stringify({
      format: 'shuijiao-backup',
      version: 1,
      exportedAt: now,
      decks: [],
      cards: [...'一二三四五六七八九十'].map((t, i) => ({
        id: `c${i}`,
        deckId: 'default-deck',
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
      })),
      templates: [],
      reviewStates: [],
      reviewLogs: [],
      links: [],
    }),
  );
  await page.goto('./#/settings');
  await page.getByLabel('Import a backup…').setInputFiles(file);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported: 10 new cards/)).toBeVisible();

  await page.goto('./#/');
  const reminder = page.locator('.notice', { hasText: "so you don't lose them" });
  await expect(reminder).toBeVisible();
  await reminder.getByRole('button', { name: 'Hide this reminder for a week' }).click();
  await expect(reminder).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('10 cards total')).toBeVisible();
  await expect(reminder).toHaveCount(0);

  // Eight days later it's back.
  await page.evaluate(() => {
    localStorage.setItem('portal.notice.backupClosedAt', String(Date.now() - 8 * 86_400_000));
  });
  await page.reload();
  await expect(reminder).toBeVisible();
});

test("What's new lists every release: the newest open, the others folded up", async ({ page }) => {
  const changelog = await readFile('CHANGELOG.md', 'utf8');
  const released = [...changelog.matchAll(/^## \[(\d[^\]]*)\]/gm)].map((m) => m[1]);
  expect(released.length).toBeGreaterThan(5);

  await page.goto('./#/about');
  const releases = page.locator('details.release');
  await expect(releases).toHaveCount(released.length);
  await expect(releases.first()).toContainText(`Version ${released[0] ?? ''}`);
  await expect(releases.last()).toContainText(`Version ${released.at(-1) ?? ''}`);
  await expect(releases.first()).toHaveAttribute('open');
  for (const r of (await releases.all()).slice(1)) await expect(r).not.toHaveAttribute('open');

  const v100 = releases.filter({ hasText: 'Version 1.0.0' });
  await expect(v100.getByText('The first stable release')).toBeHidden();
  await v100.locator('summary').click();
  await expect(v100.getByText('The first stable release')).toBeVisible();
  await expect(v100.getByText('works best in Google Chrome')).toBeVisible();
});

test('the answer side breaks a word into its characters, with meanings', async ({ page }) => {
  await addCard(page, '银行');
  const breakdown = page.getByRole('region', { name: 'Character by character' });

  await page.goto('./#/browse');
  await expect(breakdown).toHaveCount(0);
  await page.getByRole('button', { name: /Show answer/ }).click();
  await expect(breakdown.getByRole('row')).toHaveCount(2);
  await expect(breakdown.getByRole('row').first()).toContainText('silver');
  await expect(breakdown.getByRole('row').last()).toContainText('háng');

  await page.goto('./#/review');
  await page.getByRole('button', { name: /Show answer/ }).click();
  await expect(breakdown.getByRole('row')).toHaveCount(2);

  // It can be turned off in Settings.
  await page.goto('./#/settings');
  await page.getByLabel('Word-by-word meanings').uncheck();
  await page.goto('./#/browse');
  await page.getByRole('button', { name: /Show answer/ }).click();
  await expect(page.locator('.face-meaning')).toBeVisible();
  await expect(breakdown).toHaveCount(0);
});

test('the dictionary starts loading before the first answer is shown', async ({ page }) => {
  await addCard(page, '银行'); // auto-fill loaded the dictionary in this page already…
  await page.goto('./#/review');
  const dictionary = page.waitForRequest(/\/dict\/cedict\./);
  await page.reload(); // …so start afresh, as when you open the portal to study
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  await dictionary; // without anyone pressing Show answer
});

test('screen readers hear the front and the answer, but not the whole word-by-word table', async ({
  page,
}) => {
  await addCard(page, '银行');
  for (const path of ['./#/review', './#/browse']) {
    await page.goto(path);
    const card = page.locator('.flashcard');
    const live = card.locator('[aria-live="polite"]');
    await expect(card).not.toHaveAttribute('aria-live');
    await expect(live).toHaveCount(2); // the front, and the (still empty) answer
    await expect(live.first()).toContainText('銀行');
    await expect(live.last()).toBeEmpty();
    await page.getByRole('button', { name: /Show answer/ }).click();
    await expect(live.last()).toContainText('bank');
    await expect(page.getByRole('region', { name: 'Character by character' })).toBeVisible();
    await expect(live.locator('.breakdown')).toHaveCount(0);
  }
});

test('a word from the word-by-word meanings can be added as a card without leaving the session', async ({
  page,
}) => {
  await addCard(page, '我是學生', 'I am a student');
  await page.goto('./#/review');
  await expect(page.locator('.flashcard')).toContainText('我是學生');
  await page.keyboard.press('Space');
  const words = page.getByRole('region', { name: 'Word by word' });
  await words.getByRole('button', { name: 'Add 學生 as a card' }).click();

  const dialog = page.getByRole('dialog', { name: 'Add a card' });
  await expect(dialog.getByLabel('Traditional')).toHaveValue('學生');
  await expect(dialog.getByLabel('Pinyin')).toHaveValue('xuéshēng');
  await expect(dialog.getByLabel('Meaning')).toHaveValue(/student/);
  await dialog.getByRole('button', { name: /Save/ }).click();
  await expect(dialog).toBeHidden();

  // Still on the same card, answer showing; the word is now marked as yours.
  await expect(page.locator('.flashcard')).toContainText('我是學生');
  await expect(words.getByRole('img', { name: 'You have 學生 as a card' })).toBeVisible();
  await expect(words.getByRole('button', { name: 'Add 學生 as a card' })).toHaveCount(0);

  await page.goto('./#/cards');
  await expect(page.locator('.card-list > li', { hasText: '學生' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit 學生' }).click();
  await expect(page.getByLabel('Notes')).toHaveValue('From: 我是學生');
});

test('a deck made in the Add a card popup is offered next time, and in the Edit popup', async ({ page }) => {
  await addCard(page, '我是學生', 'I am a student');
  await page.goto('./#/review');
  await expect(page.locator('.flashcard')).toContainText('我是學生');
  await page.keyboard.press('Space');
  const words = page.getByRole('region', { name: 'Word by word' });
  const dialog = page.getByRole('dialog', { name: 'Add a card' });

  await words.getByRole('button', { name: 'Add 學生 as a card' }).click();
  await dialog.getByLabel('Deck').selectOption({ label: '＋ New deck…' });
  await dialog.getByLabel('New deck').fill('Vocabulary');
  await dialog.getByLabel('New deck').press('Enter');
  await dialog.getByRole('button', { name: /Save/ }).click();
  await expect(dialog).toBeHidden();

  // The next word from the same card: the new deck is in the list.
  await words.getByRole('button', { name: 'Add 是 as a card' }).click();
  await expect(dialog.getByLabel('Deck').locator('option', { hasText: 'Vocabulary' })).toHaveCount(1);
  await dialog.getByRole('button', { name: /Cancel/ }).click();

  // And in the Edit popup.
  await page.keyboard.press('e');
  const edit = page.getByRole('dialog', { name: 'Edit card' });
  await expect(edit.getByLabel('Deck').locator('option', { hasText: 'Vocabulary' })).toHaveCount(1);
});

test('a word whose tone changes in the sentence (不 bù → bú) is still recognised as yours', async ({
  page,
}) => {
  await addCard(page, '不');
  // 不累 isn't a dictionary word, so 不 is shown on its own, read bú before lèi.
  await addCard(page, '我不累', "I'm not tired");
  await page.goto('./#/browse');
  const card = page.locator('.flashcard');
  await expect(card).toBeVisible();
  if (!((await card.textContent()) ?? '').includes('我不累')) {
    await page.getByRole('button', { name: 'Next card' }).click();
  }
  await expect(card).toContainText('我不累');
  await page.keyboard.press('Space');
  const words = page.getByRole('region', { name: 'Word by word' });
  await expect(words.getByRole('row', { name: /不/ })).toContainText('bú');
  await expect(words.getByRole('img', { name: 'You have 不 as a card' })).toBeVisible();
  await expect(words.getByRole('button', { name: 'Add 不 as a card' })).toHaveCount(0);
});

test('the Add a card popup can make a new deck, or hand the card over to the full editor', async ({
  page,
}) => {
  await addCard(page, '我是學生', 'I am a student');
  await page.goto('./#/review');
  await expect(page.locator('.flashcard')).toContainText('我是學生');
  await page.keyboard.press('Space');
  const words = page.getByRole('region', { name: 'Word by word' });

  // A new deck, straight from the deck list.
  await words.getByRole('button', { name: 'Add 學生 as a card' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a card' });
  await dialog.getByLabel('Deck').selectOption({ label: '＋ New deck…' });
  await dialog.getByLabel('New deck').fill('Vocabulary');
  await dialog.getByLabel('New deck').press('Enter');
  await expect(dialog.getByLabel('Deck')).toHaveValue(/.+/);
  await expect(dialog.getByLabel('Deck').locator('option:checked')).toHaveText('Vocabulary');
  await dialog.getByRole('button', { name: /Save/ }).click();
  await expect(dialog).toBeHidden();

  // The full editor, with the card as it was in the popup.
  await words.getByRole('button', { name: 'Add 是 as a card' }).click();
  await dialog.getByLabel('Meaning').fill('to be');
  await dialog.getByRole('button', { name: 'Open full editor' }).click();
  await expect(page.getByRole('heading', { name: 'Add a card' })).toBeVisible();
  await expect(page.locator('#field-traditional')).toHaveValue('是');
  await expect(page.locator('#field-meaning')).toHaveValue('to be');
  await page.getByText('All fields look right').click();
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.getByText(/Saved 是/)).toBeVisible(); // wait for the save before leaving

  await page.goto('./#/cards');
  await expect(page.getByRole('link', { name: /Vocabulary/ })).toBeVisible();
  await expect(page.locator('.card-list > li', { hasText: '學生' }).first()).toContainText('Vocabulary');
  await expect(page.locator('.card-list > li', { hasText: 'to be' })).toHaveCount(1);
});

test('the Study page has a link to report an issue or suggest a feature', async ({ page }) => {
  await page.goto('./#/');
  const link = page.getByRole('link', { name: /Report an issue or suggest a feature/ });
  await expect(link).toHaveAttribute('href', /^https:\/\/docs\.google\.com\/forms\//);
  await expect(link).toHaveAttribute('target', '_blank');
});

test('a failure while doing something offers a report; an expected problem does not', async ({ page }) => {
  await addCard(page, '你好');
  await page.goto('./#/review');
  await expect(page.locator('.flashcard')).toContainText('你好');
  // The browser refuses to save anything from now on (as with a full disk).
  await page.evaluate(() => {
    const refuse = () => {
      throw new DOMException('The disk is full.', 'QuotaExceededError');
    };
    IDBObjectStore.prototype.put = refuse;
    IDBObjectStore.prototype.add = refuse;
  });
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /Good/ }).click();
  const failure = page.getByRole('alert').filter({ hasText: 'Could not save your answer' });
  await expect(failure).toBeVisible();
  await expect(failure.getByRole('link', { name: /Report the problem/ })).toHaveAttribute(
    'href',
    /docs\.google\.com\/forms/,
  );

  // A deck name you already have is explained, and there's nothing to report.
  await page.goto('./#/decks');
  await page.reload(); // saving works again
  await page.getByLabel('New deck name').fill('My cards');
  await page.getByRole('button', { name: /Add deck/ }).click();
  const clash = page.getByText(/You already have a deck called/);
  await expect(clash).toBeVisible();
  await expect(page.getByRole('link', { name: /Report the problem/ })).toHaveCount(0);
});

test('a page that crashes shows a way out, and the rest of the portal keeps working', async ({ page }) => {
  await addCard(page, '你好');
  // Damage a card behind the portal's back, as a bug or a broken browser profile might.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('shuijiao');
        open.onerror = () => {
          reject(new Error('open failed'));
        };
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('cards', 'readwrite');
          const cards = tx.objectStore('cards');
          const all = cards.getAll();
          all.onsuccess = () => {
            for (const card of all.result as Record<string, unknown>[]) cards.put({ ...card, tags: null });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.goto('./#/cards');
  await page.getByLabel('Search cards').fill('hello'); // searching reads every card's tags
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload the portal' })).toBeVisible();
  const report = page.getByRole('link', { name: /Report the problem/ });
  await expect(report).toHaveAttribute('href', /^https:\/\/docs\.google\.com\/forms\/.*entry\.2015925771=/);
  await expect(report).toHaveAttribute('target', '_blank');
  // The menu still works, and other pages are fine.
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeHidden();
});

test('when the browser blocks storage, the Study page says what to do', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  await page.goto('./#/');
  await expect(page.getByRole('heading', { name: "Couldn't load your cards" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Report the problem/ })).toHaveAttribute(
    'href',
    /docs\.google\.com\/forms/,
  );
});

test('a newer version upgrading the database in another tab asks this tab to reload', async ({ page }) => {
  await page.goto('./#/');
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === 'shuijiao')))
    .toBe(true);
  // What a future version does when it opens the database: ask for a higher version.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('shuijiao', 10_000);
        open.onerror = () => {
          reject(new Error('upgrade failed'));
        };
        open.onsuccess = () => {
          open.result.close();
          resolve();
        };
      }),
  );
  await expect(
    page.getByText('The portal was updated in another tab. Reload this tab to keep going.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
});

test('a part of the page that can no longer be loaded asks for a reload', async ({ page }) => {
  await page.goto('./#/');
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError')));
  await expect(page.getByText('The portal was updated. Reload to keep going.')).toBeVisible();
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

test('stroke order: folded under the answer, drawn from our own site, and remembered open', async ({
  page,
}) => {
  const strokeRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/strokes/')) strokeRequests.push(r.url());
  });
  await addCard(page, '學生');
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Study now' }).click();
  await expect(page.locator('.flashcard')).toContainText('學生');
  await expect(page.getByText('Stroke order')).toHaveCount(0); // not on the question side
  await page.keyboard.press('Space');

  const section = page.locator('details.strokes');
  await expect(section).toBeVisible();
  await expect(section).not.toHaveAttribute('open', '');
  expect(strokeRequests).toEqual([]); // nothing fetched until it is opened
  await section.locator('summary').click();

  const drawing = page.getByRole('img', { name: /How to write 學, 16 strokes/ });
  await expect(drawing.locator('svg')).toBeVisible();
  await expect(page.getByText('16 strokes')).toBeVisible();
  expect(strokeRequests).toEqual([new URL('./strokes/5b78.json', page.url()).href]);

  // Step through, then pick the other character and the simplified form.
  await page.getByRole('button', { name: 'Next stroke' }).click();
  await expect(page.getByText('Stroke 1 of 16')).toBeVisible();
  await page.getByRole('group', { name: 'Character' }).getByRole('button', { name: '生' }).click();
  await expect(page.getByRole('img', { name: /How to write 生, 5 strokes/ })).toBeVisible();
  await page.getByRole('button', { name: '简 Simplified' }).click();
  await expect(page.getByRole('img', { name: /How to write 学, 8 strokes/ })).toBeVisible();
  await page.getByRole('button', { name: 'Fast' }).click();
  await expect(page.getByRole('button', { name: 'Fast' })).toHaveAttribute('aria-pressed', 'true');

  // Keys pressed inside it don't rate the card.
  await page.getByRole('button', { name: 'Replay' }).press('Space');
  await expect(page.locator('.flashcard')).toContainText('學生');

  // Opened once, it stays open on the next card.
  await page.reload();
  await expect(page.locator('.flashcard')).toContainText('學生');
  await page.keyboard.press('Space');
  await expect(section).toHaveAttribute('open', '');
  await expect(page.getByRole('img', { name: /How to write 學/ }).locator('svg')).toBeVisible();
  expect(strokeRequests.every((u) => new URL(u).origin === new URL(page.url()).origin)).toBe(true);
});

test('stroke order says so when a character has none, and can be turned off', async ({ page }) => {
  await addCard(page, '囍', 'double happiness');
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Study now' }).click();
  await expect(page.locator('.flashcard')).toContainText('囍');
  await page.keyboard.press('Space');
  await page.locator('details.strokes summary').click();
  await expect(page.getByText("Stroke order isn't available for 囍.")).toBeVisible();

  await page.goto('./#/settings');
  await page.getByLabel('Stroke order').uncheck();
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Study now' }).click();
  await expect(page.locator('.flashcard')).toContainText('囍');
  await page.keyboard.press('Space');
  await expect(page.locator('.flashcard')).toContainText('double happiness');
  await expect(page.locator('details.strokes')).toHaveCount(0);
});

test('stroke files are cached as they are viewed, never downloaded up front', async ({ page }) => {
  const sw = await (await page.request.get('./sw.js')).text();
  const precache = /const PRECACHE = (\[[^\]]*\]);/.exec(sw)?.[1] ?? '';
  expect(JSON.parse(precache)).toContain('./');
  expect(precache).not.toContain('strokes/');
  expect(sw).toContain("STROKE_CACHE = 'strokes'");
  const file = await page.request.get('./strokes/6211.json');
  expect(file.ok()).toBe(true);
  expect(((await file.json()) as { strokes: string[] }).strokes).toHaveLength(7);
  expect((await page.request.get('./strokes/LICENSE-ArphicPL.txt')).ok()).toBe(true);
});

test('the Study page shows the version at the top, which leads to what is new', async ({ page }) => {
  const { version } = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
  await page.goto('./#/');
  const chip = page.getByRole('link', { name: `Version ${version}: what's new` });
  await expect(chip).toHaveText(`v${version}`);
  await chip.click();
  await expect(page).toHaveURL(/#\/about$/);
});

test('the character style applies in Classic and 墨 Ink; Ink decoration stays serif', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 }); // wide enough for Ink's background character
  await page.goto('./#/settings');
  const style = page.getByLabel('Character style');
  const fontOf = (selector: string, pseudo?: string) =>
    page.evaluate(
      ([sel, ps]) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el, ps ?? null).fontFamily : '';
      },
      [selector, pseudo] as const,
    );
  const hanzi = () =>
    page.evaluate(() => {
      const span = document.createElement('span');
      span.className = 'hanzi-trad';
      span.textContent = '學';
      document.body.append(span);
      const font = getComputedStyle(span).fontFamily;
      span.remove();
      return font;
    });

  for (const look of ['Classic', '墨 Ink (beta)']) {
    await page.getByRole('button', { name: look, exact: true }).click();
    await style.selectOption('sans');
    expect(await hanzi()).toContain('PingFang TC');
    await style.selectOption('serif');
    expect(await hanzi()).toContain('Songti TC');
    await style.selectOption('kai');
    expect(await hanzi()).toContain('Kaiti TC');
  }
  // Ink's logo and background character are serif whatever the choice.
  await style.selectOption('sans');
  expect(await fontOf('main', '::before')).toContain('Songti TC');
  expect(await fontOf('.brand-mark', '::before')).toContain('Songti TC');
});

test('Serif and Handwriting bring their own Chinese fonts for devices without one', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/fonts/cjk/')) fontRequests.push(r.url());
  });
  await page.goto('./#/settings');
  const style = page.getByLabel('Character style');
  const sheets = () =>
    page.evaluate(() => [...document.querySelectorAll('link[id^="cjk-"]')].map((l) => l.id).sort());

  await page.getByRole('button', { name: 'Classic', exact: true }).click();
  await style.selectOption('sans');
  expect(await sheets()).toEqual([]);
  expect(fontRequests).toEqual([]); // Sans in Classic: nothing extra at all
  await style.selectOption('serif');
  expect(await sheets()).toEqual(['cjk-serif']);
  await style.selectOption('kai');
  expect(await sheets()).toEqual(['cjk-kai']);
  await page.getByRole('button', { name: '墨 Ink (beta)' }).click();
  expect(await sheets()).toEqual(['cjk-kai', 'cjk-serif']); // Ink's logo is always serif

  // As on a phone: the browser fetches just the piece with the character, from this site.
  const loaded = await page.evaluate(async () => {
    // Each stylesheet must have arrived before its fonts are known to the page.
    for (const link of document.querySelectorAll<HTMLLinkElement>('link[id^="cjk-"]')) {
      if (!link.sheet)
        await new Promise((done) => {
          link.addEventListener('load', done, { once: true });
        });
    }
    const out: Record<string, string> = {};
    for (const family of ['Shuijiao Serif TC', 'Shuijiao Serif SC', 'Shuijiao Kai']) {
      const faces = await document.fonts.load(`32px "${family}"`, family.endsWith('SC') ? '学' : '學');
      out[family] = faces.map((f) => f.status).join() || 'none';
    }
    return out;
  });
  expect(loaded).toEqual({
    'Shuijiao Serif TC': 'loaded',
    'Shuijiao Serif SC': 'loaded',
    'Shuijiao Kai': 'loaded',
  });
  // Only a few small pieces, not whole fonts (each has 100+). On a machine without its own
  // Chinese serif (like CI's Linux), the page's other Chinese text also brings in a piece or two.
  const pieces = new Set(fontRequests.filter((u) => u.endsWith('.woff2')));
  expect(pieces.size).toBeGreaterThanOrEqual(3);
  expect(pieces.size).toBeLessThanOrEqual(15);
  expect([...pieces].every((u) => /\/fonts\/cjk\/[\w.-]+\/[\w-]+-\d+-\d+-normal\.woff2$/.test(u))).toBe(true);
  expect(fontRequests.every((u) => new URL(u).origin === new URL(page.url()).origin)).toBe(true);

  // None of it is downloaded up front for offline use.
  const sw = await (await page.request.get('./sw.js')).text();
  expect(/const PRECACHE = (\[[^\]]*\]);/.exec(sw)?.[1]).not.toContain('fonts/cjk/');
});
