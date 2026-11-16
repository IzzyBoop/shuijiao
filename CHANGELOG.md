# Changelog

All notable changes to 水餃 (Shuǐjiǎo) are listed here. The newest version is at the top.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version
numbers follow [Semantic Versioning](https://semver.org/). Add new entries under
**Unreleased**; `tools/release.sh` turns that section into the next version.

## [Unreleased]

## [0.1.0-beta.1] - 2026-11-16

### Added

- First beta of 水餃 (Shuǐjiǎo), a Mandarin flashcard portal for our course.
- **Flashcards** that show traditional characters first, with simplified characters, pinyin
  (coloured by tone), the meaning, and a play button for Mainland pronunciation.
- **Add a card from a word or sentence** in traditional or simplified characters. The other
  script, the pinyin and the meaning are filled in from the CC-CEDICT dictionary, and you
  confirm each field before saving. Characters with more than one traditional form (发 → 發/髮)
  and words with more than one reading are flagged so you can pick the right one.
- **Spaced-repetition study** (FSRS): rate each card Again, Hard, Good or Easy and it comes back
  when you are about to forget it. Keyboard shortcuts: Space shows the answer, 1–4 rate it.
- **Study anyway** when nothing is due: cards come up ahead of schedule without resetting
  anything.
- **Flip through** any deck freely, with the front staying in place above the answer.
- **Card types** decide what is on the front and back (characters → sound and meaning,
  meaning → characters, listening, pinyin → characters), and you can make your own.
- **Cards page** to browse all cards or one deck, search (pinyin works without tone marks),
  sort, quick-edit in place, delete with undo, and move or delete many cards at once.
- **Decks** to organise cards, for example by lesson.
- **Resources page** with the course links (Google Classroom, Chinese Link Level 1 audio, a
  pinyin chart, dictionaries) and **My links**, where you can save your own.
- **Themes**: Catppuccin (Latte, Frappé, Macchiato, Mocha), Rosé Pine (Dawn, Moon, Main), Nord,
  Gruvbox and a plain theme, each with light, dark and match-system modes, plus a choice of
  character style (sans, serif or handwriting).
- **Pronunciation settings**: choose a voice and speed, and run an audio check if sound
  isn't working.
- **Backups**: download all your cards, progress and links as a file, and import it on another
  device.
- **Works offline** and can be installed to a phone or computer home screen.
- **Private by design**: everything you add stays in your own browser. There are no accounts,
  no server and no tracking.

### Known issues

- Firefox on Mac usually can't play Chinese audio (a Firefox limitation). Use Chrome, Edge or
  Safari for pronunciation; everything else works in Firefox.
