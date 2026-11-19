/**
 * Tags are free text (any script, spaces), but route parameters must be short slugs (see
 * router.ts). A tag's slug is a hash of it, "t" + base 36: stable, so a tag session
 * survives a reload, and it is matched back to the tag by comparing slugs.
 */
export function tagSlug(tag: string): string {
  const text = tag.normalize('NFC');
  // Two 32-bit FNV-1a hashes with different seeds: about 53 bits, no realistic collisions.
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return `t${((a >>> 0) * 0x200000 + ((b >>> 0) & 0x1fffff)).toString(36)}`;
}

/** Whether the card has the tag that `slug` stands for. */
export function hasTagSlug(tags: readonly string[], slug: string): boolean {
  return tags.some((t) => tagSlug(t) === slug);
}

/** The tag that `slug` stands for, among these cards' tags. */
export function tagForSlug(cards: readonly { tags: readonly string[] }[], slug: string): string | undefined {
  for (const card of cards) for (const t of card.tags) if (tagSlug(t) === slug) return t;
  return undefined;
}
