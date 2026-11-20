# Changelog

All notable changes to 水餃 (Shuǐjiǎo) are listed here. The newest version is at the top.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version
numbers follow [Semantic Versioning](https://semver.org/). Add new entries under
**Unreleased**; `tools/release.sh` turns that section into the next version.

## [Unreleased]

### Added

- **The version number at the top of the Study page**, as a small tag beside the buttons. Tap
  it to see what's new.

## [1.4.0] - 2026-11-20

### Added

- **Stroke order** under the answer. Open **筆順 Stroke order** to watch each character of the
  card being written, stroke by stroke (mainland standard), in your theme's colours. You can
  replay it, step through one stroke at a time, change the speed, and switch between
  traditional and simplified. Each character downloads the first time you view it (about 3 KB)
  and then works offline. You can turn it off in Settings. The stroke data comes from Make Me a
  Hanzi, and the drawing from Hanzi Writer.

### Removed

- **The How to page and its walkthrough video**, for now. They'll come back reworked.

## [1.3.3] - 2026-11-20

### Fixed

- **Tone marks in 墨 Ink.** First tones (tā, shēng) had their tone mark drawn off to the right,
  and some third and ü tones (xiǎng, nǚ) were mismatched. Pinyin in Ink now uses a font with
  every pinyin letter, and every tone mark sits where it should.

## [1.3.2] - 2026-11-20

### Changed

- **A new app icon** in the 墨 Ink look: a serif 餃 on black with an orange underline, in the
  browser tab and on your home screen.
- **A new walkthrough video** on the How to page (28 minutes), showing the portal as it is now,
  including your progress, adding words while you study, and the 墨 Ink style. The list of its
  parts has been updated to match.

## [1.3.1] - 2026-11-20

### Removed

- The option to download **Noto Serif TC** for 墨 Ink. Ink shows Chinese in your device's own
  serif font. If you had downloaded Noto, the portal frees that space (2.9 MB) on your next
  visit.

## [1.3.0] - 2026-11-20

### Added

- **墨 Ink, a new look (beta).** Switch it on in Settings → Appearance → Site style: serif type
  for headings and Chinese, small spaced capitals, hairlines and square corners, black ink in
  dark mode and paper in light mode, with one orange accent. Switch back to Classic any time.
  Chinese uses your device's serif font, or download **Noto Serif TC** (2.9 MB) in Settings so
  it looks the same everywhere, also offline. Inspired by the Ryoku Linux website.
- **Five more themes** in Settings → Appearance: **Tokyo Night** (Night, Storm, and Day),
  **Kanagawa** (Wave, Dragon, and Lotus), **Everforest**, **Dracula** (with Alucard for light
  mode), and **Solarized**. Their text and pinyin tone colours are all easy to read.
- **Report an issue or suggest a feature** from the bottom of the Study page.
- When something fails unexpectedly (saving an answer or a card, an import, erasing, undo,
  changing decks or card types), the message now has a **Report the problem** link that opens
  the form with the details filled in. Expected messages, like a deck name you already have,
  don't.

## [1.2.2] - 2026-11-19

### Fixed

- A deck made in the **Add a card** popup while studying now shows up in the deck list the next
  time you add or edit a card (it was missing until you left the session).

## [1.2.1] - 2026-11-19

### Fixed

- **Course cards:** "Please read the text." (it said "reas"), a comma in 我是學生，你呢？, and a
  shorter meaning for 是 ("to be").

## [1.2.0] - 2026-11-19

### Added

- **Add a word as a card while you study.** In the word-by-word meanings, press **+** next to a
  word to add it as a card, filled in from the dictionary, without leaving your session. Words
  you already have are ticked. The popup can make a **new deck**, or **open the full editor**
  (with auto-fill and audio) to finish the card there.
- The quick card editor (on the Cards page and while studying) can make a **new deck** from its
  deck list.
- **Study by tag.** The Study page lists your tags (like your decks), so you can study or flip
  through just the cards tagged, say, "quiz Friday" or "measure words".
- **The Study page tells you when the course cards change**: how many are new to you, and how
  many differ from yours. It goes away once you've looked at them (or closed it), until the
  next update, or until you're missing more of them than before (for example after restoring
  an older backup).
- **Your progress, on the Study page** below your decks: how many days in a row you've studied,
  a calendar of your study days, how many cards come due each day this week, how well you
  remember each deck, and the cards you keep forgetting (with a link to edit each one).
- **How to** now starts with a short **quick start** in writing, and the video has a list of
  its parts: click one to jump straight to it.
- **What's new** on the About page opens the newest version's notes straight away.
- **Report a problem or suggest an idea** from the About page. The form opens in a new tab with
  the portal's version filled in; nothing about your cards is sent.
- **Undo an import or an erase.** Before every import, and before "Erase all study data", the
  portal keeps a copy of everything in your browser. Right after an import, **Undo this import**
  puts everything back; later, Settings → Storage has **Undo the last import** (or erase) until
  the next one. It tells you if you've studied since, because those answers would be lost. When
  erasing on a shared computer, untick "Keep a copy" to remove everything for good.

- **Keeping your cards safe in Safari.** Safari (on iPhone, iPad and Mac) deletes a website's
  data if it isn't opened for 7 days. The Study page now explains how to move your cards to the
  Home Screen (or the Dock), where they are kept, and the backup reminder comes after 3 days
  instead of 14 there.
- In other browsers, the Study page offers to **protect your cards from clean-up** when your
  device runs low on space, and says what happened.
- **Check a backup file** in Settings makes sure a backup can be imported, without importing
  it. Settings also shows how long ago your last backup was and its size.

### Changed

- The "works best in Google Chrome" message now says that your cards stay in the browser you
  made them in, and how to take them along with a backup. It no longer appears on iPhone and
  iPad, where every browser uses the same voices.
- The portal now says your cards are stored "in this browser" everywhere (the footer said "on
  this device", but another browser on the same device can't see them).
- **The portal starts faster.** Since 1.1.0 every page load downloaded the code for the
  word-by-word meanings (about 140 KB compressed), even though it's only needed once you turn a
  card over. It now loads then, and the build checks that it stays that way.
- **Screen readers read just the answer** when a card is turned over, not the whole
  word-by-word table as well. The table is still there to explore.
- **Deleted cards are tidied up.** 30 days after you delete a card, its study history is
  removed, so backups stay smaller. Deleted cards also no longer count toward the card limit.
- **The first answer of a session shows up straight away.** The dictionary for the word-by-word
  meanings now loads in the background while you look at the first card, instead of after you
  turn it over.
- **The Study page opens faster** when you have several decks: it reads your cards and
  progress once, instead of once for every deck.
- **Updates download less.** A new version now only downloads the files that changed, instead
  of the whole portal again (about 1.5 MB each time).
- The same things now have the same names everywhere: **Study ahead** (it was "Study anyway"
  on its buttons), **Flip through** (the deck buttons said "Flip"), and **card types** (an error
  message said "templates").
- Firefox no longer pops up a storage permission question out of the blue when you save your
  first card; the Study page asks instead, with an explanation.
- **Backups are now compressed** (`.json.gz`), so they are about a tenth of the size. Older
  `.json` backups still import as before.

### Fixed

- **Big backups can be imported again.** Import used to refuse files over 10 MB, which a year of
  daily study can reach, so a student's own backup could be turned away just when they needed
  it. Any backup the portal makes can now be imported, and the portal checks each backup as it
  downloads it and tells you straight away if something is wrong, with a link to report the
  problem.
- **"Keep new" on import no longer deletes your cards.** When a backup or the course cards have
  a different card for a word you already have, "Keep new" now gives your card the new wording
  (pinyin, meaning, notes, tags) and keeps its deck and your study progress. Before, your card
  and its study history were deleted.
- **Tone changes don't make a word look new.** 不 (bù / bú), 一 (yī / yí / yì), 七 and 八
  change tone with the next syllable, and neutral tones (xièxie / xièxiè) vary; the portal now
  knows these are the same word, in the word-by-word meanings, on import, and in the course
  cards. Spacing and style don't matter either ("nǐhǎo", "nǐ hǎo", "ni3 hao3").
- **Words that are written the same but read differently aren't treated as duplicates** any
  more: 行 háng and 行 xíng are both kept.
- **Updates arrive reliably.** The portal now checks for a new version whenever you come back
  to it (and every hour while it's open), so an installed app or a tab left open for days
  still gets updates. "Reload" on the update message always works now; before, it could do
  nothing in a tab opened on your first visit.
- **A tab left open during an update asks you to reload** instead of quietly failing: when the
  portal is updated in another tab, or a part of the page can't be loaded any more.
- **If a page crashes, you see what to do** instead of a blank page: reload (which also gets the
  newest version) or report the problem. The menu keeps working, so you can go to another page.
- **Clearer messages when your cards can't be loaded** (for example in a private window, or when
  the browser blocks site data): what may have happened, **Try again**, and a way to report it,
  instead of a bare error.
- Course cards: "Please look at question 3." (it said "lookat").
- **A card is only ever rated once.** Tapping a rating twice quickly, or holding a number key
  down, could save the same answer twice and make your review counts too high.

## [1.1.0] - 2026-11-17

### Added

- **Word-by-word meanings on the answer side.** When studying or flipping through, the answer now
  shows the meaning of each word in a sentence, or of each character in a word (銀 silver + 行
  firm = 銀行 bank), with its pinyin. It works on every card, including the course cards. The
  first time, it downloads the dictionary (about 4 MB), which then works offline. You can turn it
  off in Settings.

## [1.0.2] - 2026-11-17

### Fixed

- **What's new** on the About page lists every release again (it only showed the latest five).
  Each one is folded up; click a version to see what changed.

## [1.0.1] - 2026-11-17

### Changed

- The link preview (when you paste the portal's link into a chat) now just says "Mandarin
  flashcards with spaced repetition."

## [1.0.0] - 2026-11-17

The first stable release of 水餃 (shuǐjiǎo): flashcards with traditional and simplified characters,
pinyin, and audio; spaced-repetition study; the course cards; backups; and a video walkthrough
under How to.

### Added

- A message at the top of the page says the portal **works best in Google Chrome** for audio. It
  only appears in other browsers, and once you close it, it stays closed.
- The **backup reminder** on the Study page can be closed. It stays hidden for a week, then comes
  back if you still haven't made a backup.

## [0.1.0-beta.6] - 2026-11-17

### Added

- **How to**, a new tab with a video walkthrough of the whole portal: adding cards, the course
  cards, studying, managing cards and decks, settings, and backups. The video streams from the
  site and isn't saved for offline use, so it doesn't fill up your device.
- **Pages for card lists.** The Cards page, each deck on the Course cards page, and the
  side-by-side duplicates on import now show cards a page at a time, with Previous and Next
  buttons and a choice of 10, 25, 50, or 100 cards per page, or all of them. The portal remembers
  your choice.
- When selecting cards, **"Select all on this page"** and **"Select all N cards"** are now separate,
  and **Clear selection** unselects everything. The count shows how many selected cards aren't on
  the page you're looking at.

### Fixed

- The hint next to "All fields look right" on the add-card page now sits neatly under it.

## [0.1.0-beta.5] - 2026-11-17

### Added

- **Course cards.** A new Course cards button on the Study page shows the cards published for the
  course: when they were last updated, how many words and sentences there are, each deck, and every
  card, marked as new to you, already yours, or yours with different details. Import them with the
  same steps as a backup: choose which decks they go into and what to keep for cards you already
  have.
- **Import a backup** right from the Study page when you don't have any cards yet, so starting on a
  new device takes one step.
- **"All fields look right"** on the add-card page ticks every filled-in field at once (and
  unticks them all); it tells you which fields still need filling in.

### Fixed

- **The same card no longer comes back again and again in a row.** A card you press Again (or
  Hard) on now returns after a few other cards, roughly when it's due, instead of jumping to the
  front of the new cards; and when you study several card types, one card's types are kept apart.
- Pressing Space to show the answer right after clicking a rating no longer rates the next card
  "Again" by accident, and in Flip through, Space after clicking Flip flips once instead of twice.

- Backup files are named with the date on your own device (for example
  `shuijiao-backup-2026-11-16.json` in the evening in the Americas), instead of the UTC date.

## [0.1.0-beta.4] - 2026-11-17

### Added

- **Bulk edits on the Cards page**: in Select mode, make many cards words or sentences, add or
  remove tags, move them to a deck, or delete them, each with Undo. "Select all" now selects every
  card that matches your filters, not just those on screen.
- **Filter by length** on the Cards page: 1 character or 2+ characters (Chinese characters only).

## [0.1.0-beta.3] - 2026-11-17

### Added

- **Edit a card while studying or flipping through**: an Edit card button (or press E) opens
  the card's details in a popup over the session. Save, and the card updates where you are
  without losing your place. Study shortcuts are paused while the popup is open, so typing
  can't rate or flip the card.
- **Create a deck while adding a card**: a New deck button next to the Deck menu makes a deck and
  selects it. Typing the name of a deck you already have just selects it.
- **Word / sentence now does something**: it sets the pinyin style of auto-filled pinyin (sentences
  get a capital letter and punctuation), shows sentences smaller on flashcards so they fit, opens the
  word-by-word hints for sentences, and can be used to filter the Cards page. It can also be changed
  in the quick editor.
- **What's the difference?** An ⓘ button next to the Word / Sentence switch explains how the two
  differ, with an example of each. Hover, focus, or tap it to open; Escape or tapping elsewhere
  closes it.

### Changed

- The header now shows a 🥟 badge followed by 水餃 (shuǐjiǎo).

### Fixed

- The Cards page says "1 card" instead of "1 cards".
- Importing with "The decks they were in" no longer creates a second deck with the same name:
  cards go into your existing deck with that name (ignoring capitals and extra spaces), and
  same-named decks within one backup become one deck.
- Decks can't be created or renamed to a name you already use. If you already have two decks with
  the same name, the Decks page offers to merge them into one, keeping every card's progress.

### Security

- The offline service worker now ignores messages that don't come from the portal itself
  (defence in depth; flagged by GitHub's CodeQL scan).

## [0.1.0-beta.2] - 2026-11-16

### Added

- **Duplicate check when saving a card**: if you already have a card with the same characters
  (in either script), a popup shows the existing card and asks whether to add it anyway, open
  the existing card, or not add it. The warning also appears at the top of the form, and the
  same check applies when you edit a card to match another one.
- **Delete any deck, including My cards**: when a deck still has cards, you choose whether to
  move them to another deck (keeping their study progress) or delete them too. The last
  remaining deck can't be deleted, so every card always has a home.
- **Choose where imported cards go**: when importing a backup, put the cards back into the decks
  they came from (any that don't exist are created, and deleted ones are restored), or put them
  all into "My cards" (created if you don't have it). The preview names the decks it will create.
- **Handle duplicates when importing**: if a backup has cards with the same characters as cards
  you already have, including edited copies of your own cards from an earlier or later backup,
  choose to keep yours, keep the backup's, or choose card by card on a side-by-side list (20
  pairs per page). Each pair says what differs (meaning, notes, tags, and so on), highlights the
  exact words, characters, and tags that were added or removed, shows both
  versions with their deck and when they last changed, and marks the newer one. Identical copies
  are skipped without asking. Importing now happens on its own page.

### Changed

- Lists throughout the portal now use the Oxford comma ("Chrome, Edge, or Safari"), including
  lists the portal builds itself, such as the card types you study and suggested measure words.

## [0.1.0-beta.1] - 2026-11-16

### Added

- First beta of 水餃 (Shuǐjiǎo), a Mandarin flashcard portal for our course.
- **Flashcards** that show traditional characters first, with simplified characters, pinyin
  (coloured by tone), the meaning, and a play button for Mainland pronunciation.
- **Add a card from a word or sentence** in traditional or simplified characters. The other
  script, the pinyin, and the meaning are filled in from the CC-CEDICT dictionary, and you
  confirm each field before saving. Characters with more than one traditional form (发 → 發/髮)
  and words with more than one reading are flagged so you can pick the right one.
- **Spaced-repetition study** (FSRS): rate each card Again, Hard, Good, or Easy, and it comes back
  when you are about to forget it. Keyboard shortcuts: Space shows the answer, 1–4 rate it.
- **Study anyway** when nothing is due: cards come up ahead of schedule without resetting
  anything.
- **Flip through** any deck freely, with the front staying in place above the answer.
- **Card types** decide what is on the front and back (characters → sound and meaning,
  meaning → characters, listening, and pinyin → characters), and you can make your own.
- **Cards page** to browse all cards or one deck, search (pinyin works without tone marks),
  sort, quick-edit in place, delete with undo, and move or delete many cards at once.
- **Decks** to organise cards, for example by lesson.
- **Resources page** with the course links (Google Classroom, Chinese Link Level 1 audio, a
  pinyin chart, and dictionaries) and **My links**, where you can save your own.
- **Themes**: Catppuccin (Latte, Frappé, Macchiato, Mocha), Rosé Pine (Dawn, Moon, Main), Nord,
  Gruvbox, and a plain theme, each with light, dark, and match-system modes, plus a choice of
  character style (sans, serif, or handwriting).
- **Pronunciation settings**: choose a voice and speed, and run an audio check if sound
  isn't working.
- **Backups**: download all your cards, progress, and links as a file, and import it on another
  device.
- **Works offline** and can be installed to a phone or computer home screen.
- **Private by design**: everything you add stays in your own browser. There are no accounts,
  no server, and no tracking.

### Known issues

- Firefox on Mac usually can't play Chinese audio (a Firefox limitation). Use Chrome, Edge, or
  Safari for pronunciation; everything else works in Firefox.
