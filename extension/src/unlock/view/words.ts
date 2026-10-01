import {h} from './dom';

/**
 * A full address in groups of four at equal weight — the DOM twin of web/src/ui/AddressGroups.tsx
 * (spec §1.7). The gap is the stylesheet's column-gap, not a space, so a copy yields the exact address.
 */
export function addressGroups(address: string): HTMLSpanElement {
  const out = h('span', 'addr-groups noc-mono');
  for (const g of address.match(/.{1,4}/g) ?? []) out.append(h('span', '', g));
  return out;
}

const two = (n: number): string => String(n).padStart(2, '0');

/**
 * #3's recovery phrase: 24 cells in DOM order 1…24. The design's `.seed-grid` lays them out in 12 rows
 * with `grid-auto-flow: column`, so the grid reads 1–12 down the left column, 13–24 down the right
 * (column-major, wallet-ux §5). Each cell: `.word` > `.num` "01" + `.term` (the user's own word).
 */
export function seedWordCells(words: readonly string[]): HTMLDivElement[] {
  return words.map((w, i) => {
    const cell = h('div', 'word');
    cell.append(h('span', 'num', two(i + 1)), h('span', 'term', w));
    return cell;
  });
}

/**
 * #8's mono cell grid: each word typed so far as "01 legend", then empty cells "13 …" up to 12 or 24
 * (the nearer length the phrase can be), as the design's paste-detected and idle-timer states draw it.
 */
export function phraseCells(words: readonly string[]): HTMLDivElement[] {
  const target = words.length <= 12 ? 12 : 24;
  const out: HTMLDivElement[] = [];
  for (let i = 0; i < Math.max(target, words.length); i++) {
    const w = words[i];
    out.push(w === undefined ? h('div', 'w empty', `${two(i + 1)} …`) : h('div', 'w', `${two(i + 1)} ${w}`));
  }
  return out;
}

/** The words of whatever is in #8's field, as import reads them: lower-case letters, single spaces. */
export function phraseWords(text: string): string[] {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);
}
