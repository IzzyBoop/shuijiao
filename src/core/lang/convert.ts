import * as OpenCC from 'opencc-js';

export type Script = 'traditional' | 'simplified' | 'same' | 'mixed';

// Mainland simplified ⇄ OpenCC standard traditional (the forms CC-CEDICT uses).
const toTraditional = OpenCC.Converter({ from: 'cn', to: 't' });
const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

export function convertToTraditional(text: string): string {
  return toTraditional(text);
}

export function convertToSimplified(text: string): string {
  return toSimplified(text);
}

/** Works out which script the text is written in. */
export function detectScript(text: string): Script {
  const t = toTraditional(text);
  const s = toSimplified(text);
  if (t === text && s === text) return 'same';
  if (s === text) return 'simplified';
  if (t === text) return 'traditional';
  return 'mixed';
}
