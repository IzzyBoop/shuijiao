# Changelog

All notable changes to 水餃 (Shuǐjiǎo) are listed here. The newest version is at the top.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version
numbers follow [Semantic Versioning](https://semver.org/). Add new entries under
**Unreleased**; `tools/release.sh` turns that section into the next version.

## [Unreleased]

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
