import { describe, expect, it } from 'vitest';
import { hasTagSlug, tagForSlug, tagSlug } from '../../src/core/tags';

describe('tag slugs', () => {
  it('turns any tag into a short, stable slug the router accepts', () => {
    for (const tag of ['quiz Friday', '量詞', 'L3 / 第三課', 'x'.repeat(32), '😀 emoji']) {
      const slug = tagSlug(tag);
      expect(slug).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(tagSlug(tag)).toBe(slug);
    }
  });

  it('gives different tags different slugs, and the same tag in another Unicode form the same one', () => {
    const tags = ['a', 'b', 'A', 'quiz', 'quiz ', '量詞', '量词', 'lesson 1', 'lesson 2', 'lesson 10'];
    expect(new Set(tags.map(tagSlug)).size).toBe(tags.length);
    expect(tagSlug('café')).toBe(tagSlug('café'));
  });

  it('finds the cards, and the tag, a slug stands for', () => {
    const cards = [{ tags: ['quiz Friday', 'verbs'] }, { tags: ['verbs'] }, { tags: [] }];
    const slug = tagSlug('quiz Friday');
    expect(cards.filter((c) => hasTagSlug(c.tags, slug))).toHaveLength(1);
    expect(tagForSlug(cards, slug)).toBe('quiz Friday');
    expect(tagForSlug(cards, tagSlug('nope'))).toBeUndefined();
  });
});
