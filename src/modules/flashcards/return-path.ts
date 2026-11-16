/**
 * Remembers which card list the student came from (all cards, or one deck,
 * with its search), so the full editor can send them back there.
 */
let lastList = '/cards';

export function rememberCardList(path: string): void {
  if (path.startsWith('/cards')) lastList = path;
}

export function cardListPath(): string {
  return lastList;
}
