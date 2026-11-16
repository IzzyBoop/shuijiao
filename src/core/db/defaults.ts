import type { Deck, Template } from './model';

export const DEFAULT_DECK_ID = 'default-deck';

export function defaultDeck(now: number): Deck {
  return { id: DEFAULT_DECK_ID, name: 'My cards', createdAt: now, updatedAt: now, deleted: 0 };
}

/** Built-in card templates. Their ids are fixed so backups from any device line up. */
export function builtinTemplates(now: number): Template[] {
  const t = (id: string, name: string, front: Template['front'], back: Template['back']): Template => ({
    id,
    name,
    front,
    back,
    builtin: true,
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  });
  return [
    t(
      'tpl-reading',
      'Characters → sound & meaning',
      ['traditional'],
      ['simplified', 'pinyin', 'audio', 'meaning'],
    ),
    t('tpl-meaning', 'Meaning → characters', ['meaning'], ['traditional', 'simplified', 'pinyin', 'audio']),
    t(
      'tpl-listening',
      'Listening → characters & meaning',
      ['audio'],
      ['traditional', 'simplified', 'pinyin', 'meaning'],
    ),
    t(
      'tpl-pinyin',
      'Pinyin → characters & meaning',
      ['pinyin'],
      ['traditional', 'simplified', 'audio', 'meaning'],
    ),
  ];
}

export const DEFAULT_ACTIVE_TEMPLATES = ['tpl-reading'];
