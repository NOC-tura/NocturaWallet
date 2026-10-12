import {CONFUSABLES} from './confusables';
import {KNOWN_DOMAINS} from './knownList';
import {decodeLabel} from './punycode';

/**
 * The classifier (spec §2.5): a pure function of the host the browser reports (lower-case ASCII / punycode). Rules in
 * order, so rule 1 wins: verified, then lookalike by rule a (IDN), b (edit distance), c (embedded), d (swaps), e (a
 * brand as a subdomain label, rev 3.2) — the first hit names the listed domain it imitates — else unknown. Nothing
 * here fetches anything (C6).
 */
export type LookalikeRule = 'idn' | 'edit' | 'embedded' | 'swap' | 'subdomain';

/** Rule a's banner facts: the first character that is not what it looks like, and the Latin one it imitates. */
export interface IdnDetail {
  char: string;
  /** "U+0430". */
  codePoint: string;
  /** The Unicode script's English name ("Cyrillic"), or null for a script not in SCRIPTS. */
  script: string | null;
  latin: string;
  latinCodePoint: string;
}

export type Classification =
  | {kind: 'verified'; name: string; domain: string}
  | {kind: 'lookalike'; rule: LookalikeRule; imitates: string; idn: IdnDetail | null}
  /** `international`: some label is `xn--` (47b's extra line, Q18). */
  | {kind: 'unknown'; international: boolean};

/** Every format character (Cf, which holds the bidi embeddings, overrides and isolates and the zero-width ones). */
const FORMAT = /[\p{Cf}\u202A-\u202E\u2066-\u2069]/gu;
const MARKS = /\p{M}/gu;

/**
 * skel(x) (spec §2.5): decode every `xn--` label (an invalid one is kept as-is), NFD-normalise, strip combining marks
 * (and, defensively, every format character), map each character through confusables.ts, lower-case. Applied to BOTH
 * sides of a comparison (UTS #39: two strings are confusable when their skeletons are equal) — confusables.txt maps
 * the ASCII `m` to `rn`, so a Cyrillic `\u043C` reaches `magiceden` only through skel(magiceden) (controller ruling, plan
 * Scope §3).
 */
export function skel(x: string): string {
  const decoded = x
    .split('.')
    .map(label => decodeLabel(label) ?? label)
    .join('.');
  const bare = decoded.normalize('NFD').replace(MARKS, '').replace(FORMAT, '');
  let out = '';
  for (const ch of bare) out += CONFUSABLES.get(ch.codePointAt(0) ?? 0) ?? ch;
  return out.toLowerCase();
}

/** Optimal-string-alignment (restricted Damerau–Levenshtein) distance: insertions, deletions, substitutions, adjacent swaps. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({length: a.length + 1}, (_, i) => Array.from({length: b.length + 1}, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  const at = (i: number, j: number): number => d[i]?.[j] ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i <= a.length; i++) {
    const row = d[i] as number[];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, at(i - 2, j - 2) + 1);
      row[j] = v;
    }
  }
  return at(a.length, b.length);
}

/** The scripts rule a's banner can name; anything else is "a non-Latin letter" on screen. */
const SCRIPTS = ['Latin', 'Cyrillic', 'Greek', 'Armenian', 'Cherokee', 'Georgian', 'Hebrew', 'Arabic', 'Coptic', 'Lisu', 'Vai', 'Thai', 'Devanagari', 'Han', 'Hiragana', 'Katakana', 'Hangul'];
function scriptOf(ch: string): string | null {
  return SCRIPTS.find(s => new RegExp(`^\\p{Script=${s}}$`, 'u').test(ch)) ?? null;
}

export const codePointOf = (ch: string): string => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;

/** The host's labels decoded, every format character removed (spec §2.5 Display): what rule a's banner may quote. */
export function decodedForDisplay(host: string): string {
  return host
    .split('.')
    .map(label => decodeLabel(label) ?? label)
    .join('.')
    .replace(FORMAT, '');
}

/** Rule a's first character outside ASCII whose skeleton is Latin and differs from it. */
function idnDetail(host: string): IdnDetail | null {
  for (const ch of decodedForDisplay(host)) {
    if ((ch.codePointAt(0) ?? 0) < 0x80) continue;
    const latin = skel(ch);
    if (!/^[a-z0-9]+$/.test(latin)) continue;
    return {char: ch, codePoint: codePointOf(ch), script: scriptOf(ch), latin, latinCodePoint: codePointOf(latin)};
  }
  return null;
}

const KNOWN = KNOWN_DOMAINS.map(k => {
  const label = k.domain.split('.')[0] ?? '';
  return {...k, skeleton: skel(k.domain), label, labelSkeleton: skel(label), hyphenSkeleton: skel(k.domain.replace(/\./g, '-'))};
});

/** The label left of the host's TLD (C7's name for an unknown or lookalike origin), or the host when it has one label. */
export function secondLevelLabel(host: string): string {
  const labels = host.split('.');
  return labels.length >= 2 ? (labels[labels.length - 2] ?? host) : host;
}

/** Rule d's swaps: 0→o, 1→l, rn→m, vv→w. */
const swapped = (label: string): string => label.replace(/0/g, 'o').replace(/1/g, 'l').replace(/rn/g, 'm').replace(/vv/g, 'w');

export function classify(host: string): Classification {
  const h = host.toLowerCase();
  // 1. Verified: the domain or any subdomain of it — before every lookalike rule (an IDN subdomain of a listed domain is verified).
  for (const k of KNOWN_DOMAINS) if (h === k.domain || h.endsWith(`.${k.domain}`)) return {kind: 'verified', name: k.name, domain: k.domain};
  const labels = h.split('.');
  const international = labels.some(l => l.startsWith('xn--'));
  // 2a. IDN: an xn-- label, and the skeleton of two consecutive labels is a listed domain's skeleton.
  if (international) {
    for (let i = 0; i + 1 < labels.length; i++) {
      const pair = skel(`${labels[i]}.${labels[i + 1]}`);
      const hit = KNOWN.find(k => k.skeleton === pair);
      if (hit !== undefined) return {kind: 'lookalike', rule: 'idn', imitates: hit.domain, idn: idnDetail(h)};
    }
  }
  const sld = labels.length >= 2 ? (labels[labels.length - 2] ?? '') : '';
  // The skeleton variants below are gated on `international`: a raw (non-`xn--`) host is already ASCII, and running
  // skel() on it only exercises confusables.txt's own ASCII self-entries (`1`→`l`, `m`→`rn`), which would otherwise
  // let rule b or c pre-empt rule d's dedicated, "at least one swap applied" swap check on a plain ASCII host (e.g.
  // `rnagiceden.io`, which must still resolve as rule d's swap, not a same-string edit-distance-0 "hit" on the skeleton).
  const sldSkel = international ? skel(sld) : sld;
  // 2b. Edit distance ≤ 1 from a listed second-level label of 4+ characters (distance 0 with another TLD counts);
  // also checked on the skeleton against the known label's own skeleton, so a homoglyph combined with an edit still
  // matches (controller ruling, fix round 1: rules b, c, d run on the skeleton too, not only the raw host).
  if (sld !== '') {
    const hit = KNOWN.find(
      k => k.label.length >= 4 && (editDistance(sld, k.label) <= 1 || (international && editDistance(sldSkel, k.labelSkeleton) <= 1)),
    );
    if (hit !== undefined) return {kind: 'lookalike', rule: 'edit', imitates: hit.domain, idn: null};
  }
  // 2c. Embedded: the whole host (raw or skeleton) contains a listed domain, or the domain with its dots turned to hyphens.
  const hSkel = international ? skel(h) : h;
  const embedded = KNOWN.find(
    k =>
      h.includes(k.domain) ||
      h.includes(k.domain.replace(/\./g, '-')) ||
      (international && (hSkel.includes(k.skeleton) || hSkel.includes(k.hyphenSkeleton))),
  );
  if (embedded !== undefined) return {kind: 'lookalike', rule: 'embedded', imitates: embedded.domain, idn: null};
  // 2d. Swaps that change the second-level label (raw or skeleton) into a listed one (at least one swap applied: `jup.io` stays unknown).
  const sldSwapped = swapped(sld);
  const sldSkelSwapped = international ? swapped(sldSkel) : sldSwapped;
  if (sld !== '' && (sldSwapped !== sld || (international && sldSkelSwapped !== sldSkel))) {
    const hit = KNOWN.find(k => k.label === sldSwapped || (international && (k.label === sldSkelSwapped || k.labelSkeleton === sldSkelSwapped)));
    if (hit !== undefined) return {kind: 'lookalike', rule: 'swap', imitates: hit.domain, idn: null};
  }
  // 2e. A brand as a subdomain label (rev 3.2, owner-delegated 2026-10-12): every label LEFT of the host's last two
  // (`phantom.vercel.app`, `tensr.trade.evil.com`) is held against every listed second-level label — equal, or (a
  // listed label of 4+ characters) within edit distance 1, or equal after rule d's swaps. Whole labels only:
  // `mydrift-notes.vercel.app` is unknown. On the skeleton too for an `xn--` host, as rules b–d (Task 1 ruling).
  const near = (f: string, target: string): boolean => {
    const sw = swapped(f);
    return f === target || (target.length >= 4 && editDistance(f, target) <= 1) || (sw !== f && sw === target);
  };
  for (const label of labels.slice(0, -2)) {
    const labelSkel = international ? skel(label) : label;
    const hit = KNOWN.find(k => near(label, k.label) || (international && (near(labelSkel, k.label) || near(labelSkel, k.labelSkeleton))));
    if (hit !== undefined) return {kind: 'lookalike', rule: 'subdomain', imitates: hit.domain, idn: null};
  }
  return {kind: 'unknown', international};
}

/** C7: the name an origin is shown under — the known list's for a verified host, else its second-level label. Never page-supplied. */
export function siteName(host: string, c: Classification = classify(host)): string {
  return c.kind === 'verified' ? c.name : secondLevelLabel(host.toLowerCase());
}
