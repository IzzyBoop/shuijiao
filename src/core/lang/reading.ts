/**
 * Whether two pinyin readings of the same characters are the same word. Used wherever the
 * portal asks "is this a card you already have?" (duplicates on import, the course cards,
 * the ticks in the word-by-word meanings).
 *
 * The letters must match: 行 háng (row) and 行 xíng (to walk) are different words. Tones
 * must match too (好 hǎo, good, and 好 hào, to like), except where a difference in tone
 * never means a different word:
 * - a neutral tone matches any tone (xièxie = xièxiè, dōngxi = dōngxī);
 * - 不, 一, 七 and 八 change tone with the syllable after them (bù / bú, yī / yí / yì);
 * - a reading typed without any tones ("ni hao") matches any tones.
 * Readings are split into one syllable per character, so spacing and style don't matter:
 * "xièxie", "xiè xiè" and "xie4 xie5" are all the same.
 */

/** Every pinyin syllable (from CC-CEDICT), without tones; ü is written v. */
const SYLLABLES = new Set(
  (
    'a ai an ang ao ba bai ban bang bao bei ben beng bi bia bian biang biao bie bin bing biu ' +
    'bo bu ca cai can cang cao ce cen ceng cha chai chan chang chao che chen cheng chi chong ' +
    'chou chu chua chuai chuan chuang chui chun chuo ci cong cou cu cuan cui cun cuo da dai ' +
    'dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo ' +
    'e ei en eng er fa fan fang fei fen feng fiao fo fou fu ga gai gan gang gao ge gei gen ' +
    'geng ging gong gou gu gua guai guan guang gui gun guo ha hai han hang hao he hei hen ' +
    'heng hm hng hong hou hu hua huai huan huang hui hun huo ji jia jian jiang jiao jie jin ' +
    'jing jiong jiu ju juan jue jun ka kai kan kang kao ke kei ken keng kong kou ku kua kuai ' +
    'kuan kuang kui kun kuo la lai lan lang lao le lei leng li lia lian liang liao lie lin ' +
    'ling liu lo long lou lu luan lun luo lv lve m ma mai man mang mao me mei men meng mi ' +
    'mian miao mie min ming miu mo mou mu na nai nan nang nao ne nei nen neng ni nian niang ' +
    'niao nie nin ning niu nong nou nu nuan nun nuo nv nve o ou pa pai pan pang pao pei pen ' +
    'peng pi pian piao pie pin ping po pou pu qi qia qian qiang qiao qie qin qing qiong qiu ' +
    'qu quan que qun r ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo sa sai ' +
    'san sang sao se sei sen seng sha shai shan shang shao she shei shen sheng shi shou shu ' +
    'shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo ta tai tan tang ' +
    'tao te tei teng ti tian tiao tie ting tong tou tu tuan tui tun tuo wa wai wan wang wei ' +
    'wen weng wo wu xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun ya yan ' +
    'yang yao ye yi yin ying yo yong you yu yuan yue yun za zai zan zang zao ze zei zen zeng ' +
    'zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang ' +
    'zhui zhun zhuo zi zong zou zu zuan zui zun zuo'
  ).split(' '),
);
const LONGEST = 6;

type Tone = 1 | 2 | 3 | 4 | 5;
const MARKS: Record<string, Tone> = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };

/** Characters whose tone changes with what follows, and the tones they take. */
const SANDHI: Record<string, readonly Tone[]> = {
  不: [4, 2],
  一: [1, 2, 4],
  七: [1, 2],
  八: [1, 2],
};

const HAN = /\p{Script=Han}/u;

interface Scan {
  /** The letters, lowercase, ü as v. */
  letters: string;
  /** For each letter, the tone marked on it (0 if none). */
  marks: number[];
  /** Tone numbers ("xie4"): letter index where the syllable ends → tone. */
  numbers: Map<number, Tone>;
  /** Letter indexes where a syllable must end (spaces, apostrophes, tone numbers). */
  breaks: Set<number>;
}

function scan(pinyin: string): Scan {
  const letters: string[] = [];
  const marks: number[] = [];
  const numbers = new Map<number, Tone>();
  const breaks = new Set<number>();
  for (const ch of pinyin.normalize('NFD').toLowerCase().replace(/u:/g, 'v')) {
    if (ch >= 'a' && ch <= 'z') {
      letters.push(ch);
      marks.push(0);
    } else if (MARKS[ch] !== undefined) {
      if (marks.length > 0) marks[marks.length - 1] = MARKS[ch];
    } else if (ch === '\u0308') {
      if (letters[letters.length - 1] === 'u') letters[letters.length - 1] = 'v';
    } else if (ch >= '1' && ch <= '5') {
      numbers.set(letters.length, Number(ch) as Tone);
      breaks.add(letters.length);
    } else {
      breaks.add(letters.length); // a space, apostrophe, hyphen, punctuation
    }
  }
  return { letters: letters.join(''), marks, numbers, breaks };
}

/**
 * Splits the letters into valid syllables, `count` of them if possible (one per
 * character), never across a break. Returns each syllable's end index, or null.
 */
function split(s: Scan, count: number): number[] | null {
  const n = s.letters.length;
  // reach[i]: the syllable counts that can end exactly at letter i, with one way to get there.
  const reach = Array.from({ length: n + 1 }, () => new Map<number, number>());
  reach[0]?.set(0, -1);
  for (let i = 0; i < n; i++) {
    const here = reach[i];
    if (!here || here.size === 0) continue;
    for (let len = 1; len <= LONGEST && i + len <= n; len++) {
      let crosses = false;
      for (let b = i + 1; b < i + len; b++) if (s.breaks.has(b)) crosses = true;
      if (crosses) break;
      if (!SYLLABLES.has(s.letters.slice(i, i + len))) continue;
      for (const k of here.keys()) if (!reach[i + len]?.has(k + 1)) reach[i + len]?.set(k + 1, i);
    }
  }
  const end = reach[n];
  if (!end || end.size === 0) return null;
  let k = end.has(count) ? count : Math.min(...end.keys());
  const ends: number[] = [];
  for (let i = n; i > 0;) {
    ends.unshift(i);
    const from = reach[i]?.get(k);
    if (from === undefined) return null;
    i = from;
    k--;
  }
  return ends;
}

function tones(s: Scan, ends: number[]): Tone[] {
  let start = 0;
  return ends.map((end) => {
    const marked = s.marks.slice(start, end).find((m) => m > 0) as Tone | undefined;
    start = end;
    return marked ?? s.numbers.get(end) ?? 5;
  });
}

export function sameReading(a: string, b: string, hanzi: string): boolean {
  const sa = scan(a);
  const sb = scan(b);
  if (sa.letters === '' || sb.letters === '') return true; // one has no reading: can't tell apart
  if (sa.letters !== sb.letters) return false;
  const chars = [...hanzi].filter((c) => HAN.test(c));
  const ea = split(sa, chars.length);
  const eb = split(sb, chars.length);
  // Unusual spelling that won't split into syllables (or splits differently): the letters
  // matching has to do.
  if (!ea || !eb) return true;
  if (ea.join() !== eb.join()) return true;
  const ta = tones(sa, ea);
  const tb = tones(sb, eb);
  const perChar = chars.length === ta.length;
  return ta.every((t, i) => {
    const u = tb[i] ?? 5;
    if (t === u || t === 5 || u === 5) return true;
    const sandhi = perChar ? SANDHI[chars[i] ?? ''] : undefined;
    return sandhi !== undefined && sandhi.includes(t) && sandhi.includes(u);
  });
}
