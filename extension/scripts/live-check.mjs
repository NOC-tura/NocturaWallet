// B1e §6.5: the live check — the three pages ICO publishes on noc-tura.io, read as the release sees them. Part of
// `npm run release:chrome` only (scripts/release-chrome.mjs calls liveCheck with the real fetch): never in `verify`,
// CI, a test or under `unshare -rn`. This module has no CLI and no default fetch — it cannot reach the network unless
// its caller hands it a fetch, so no test and no other script contacts noc-tura.io through it (controller ruling: the
// one sanctioned contact is the release script's three GETs, once).
//
// The comparison (pure, offline-tested with fixture HTML): the page's text after removing comments, <script>,
// <style> and <template> with their content, then every tag; decoding HTML entities (named, and numeric as a browser
// does — 0x80–0x9F through Windows-1252); NFC; ’ → ', “ and ” → "; every whitespace run (NBSP and the other Unicode
// spaces included) → one space. Each required sentence, folded the same way, must be a case-sensitive substring of
// it. A failure names the sentence (its id and text) or the page.
import {PRIVACY_SENTENCES} from '../release/privacySentences.mjs';

/** The contact every page carries (E8). */
export const CONTACT = 'privacy@noc-tura.io';

/**
 * What only the unpublished Terms draft says (release/terms.md's DRAFT note, its first sentence: "DRAFT for the
 * owner's lawyer — not legal text and not in force."). A Terms page carrying any of them is the draft published with
 * its note, and fails (B1e-2 Task 4, Fable review 1 I4): case-sensitive, compared on the folded text, so "owner’s"
 * with a typographic apostrophe is caught too.
 */
export const TERMS_DRAFT_MARKERS = Object.freeze(['DRAFT', 'not in force', "owner's lawyer"]);

/**
 * The three pages, in the order they are read. The URLs are src/shared/links.ts NOCTURA_PAGES' (a test pins them
 * equal); each title is the label of the #38 row that opens it (src/app/screens/About.tsx ABOUT_TEXT), so the page a
 * user lands on is headed with the name they clicked. Terms and Help must each carry their title and CONTACT; the
 * privacy page must carry every sentence of privacySentences.mjs (P16 is the contact). `mustNot`: text the page may
 * not carry (Terms: TERMS_DRAFT_MARKERS).
 */
export const LIVE_PAGES = Object.freeze([
  Object.freeze({name: 'privacy', url: 'https://noc-tura.io/extension/privacy', title: 'Privacy Policy', sentences: true}),
  Object.freeze({name: 'terms', url: 'https://noc-tura.io/extension/terms', title: 'Terms of Service', sentences: false, mustNot: TERMS_DRAFT_MARKERS}),
  Object.freeze({name: 'help', url: 'https://noc-tura.io/extension/help', title: 'Help & support', sentences: false}),
]);

/**
 * The named entities decoded. Any other named entity is left as written, so a sentence containing one fails (fail
 * closed: the check never guesses what an unknown entity renders as). These cover every character an editor or a CMS
 * writes into prose; the full HTML table is not needed for that.
 */
export const NAMED_ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  lsquo: '\u2018', rsquo: '\u2019', sbquo: '\u201a', ldquo: '\u201c', rdquo: '\u201d', bdquo: '\u201e',
  ndash: '\u2013', mdash: '\u2014', minus: '\u2212', hellip: '\u2026', middot: '\u00b7', bull: '\u2022',
  laquo: '\u00ab', raquo: '\u00bb', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', euro: '\u20ac', deg: '\u00b0', times: '\u00d7',
  ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009', hairsp: '\u200a', shy: '\u00ad', zwnj: '\u200c', zwj: '\u200d', lrm: '\u200e', rlm: '\u200f',
});

/** What a browser renders a numeric reference 0x80–0x9F as (HTML's Windows-1252 remap); the five unassigned stay. */
const WINDOWS_1252 = new Map([
  [0x80, 0x20ac], [0x82, 0x201a], [0x83, 0x0192], [0x84, 0x201e], [0x85, 0x2026], [0x86, 0x2020], [0x87, 0x2021],
  [0x88, 0x02c6], [0x89, 0x2030], [0x8a, 0x0160], [0x8b, 0x2039], [0x8c, 0x0152], [0x8e, 0x017d], [0x91, 0x2018],
  [0x92, 0x2019], [0x93, 0x201c], [0x94, 0x201d], [0x95, 0x2022], [0x96, 0x2013], [0x97, 0x2014], [0x98, 0x02dc],
  [0x99, 0x2122], [0x9a, 0x0161], [0x9b, 0x203a], [0x9c, 0x0153], [0x9e, 0x017e], [0x9f, 0x0178],
]);

function numericChar(code) {
  if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\ufffd';
  return String.fromCodePoint(WINDOWS_1252.get(code) ?? code);
}

/** HTML entities decoded: `&name;` from NAMED_ENTITIES, `&#123;` and `&#x7b;` as a browser does. One pass: `&amp;lt;` is "&lt;". */
export function decodeEntities(text) {
  return text.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([A-Za-z][A-Za-z0-9]*));/g, (whole, dec, hex, name) => {
    if (dec !== undefined) return numericChar(Number.parseInt(dec, 10));
    if (hex !== undefined) return numericChar(Number.parseInt(hex, 16));
    return Object.hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : whole;
  });
}

/** NFC; ’ → '; “ and ” → "; every whitespace run (`\s`: NBSP and the Unicode spaces included) → one space. */
export function foldText(text) {
  return text
    .normalize('NFC')
    .replace(/\u2019/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/gu, ' ');
}

/** The text a page's HTML is compared on (the module comment's order). */
export function pageText(html) {
  const text = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|template)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<[/!?]?[A-Za-z](?:"[^"]*"|'[^']*'|[^'">])*>/g, '')
    .replace(/<![^>]*>/g, '');
  return foldText(decodeEntities(text));
}

/** The sentences of `sentences` whose folded text is not a substring of the page's text. */
export function missingSentences(html, sentences = PRIVACY_SENTENCES) {
  const text = pageText(html);
  return sentences.filter(s => !text.includes(foldText(s.text)));
}

/** Everything wrong with one page's HTML (no status: the runner checks that first). */
export function pageProblems(page, html, sentences = PRIVACY_SENTENCES) {
  if (page.sentences) return missingSentences(html, sentences).map(s => `${page.name}: missing ${s.id}: "${s.text}"`);
  const text = pageText(html);
  const out = [];
  if (!text.includes(foldText(page.title))) out.push(`${page.name}: missing its title "${page.title}"`);
  if (!text.includes(CONTACT)) out.push(`${page.name}: missing the contact ${CONTACT}`);
  for (const m of page.mustNot ?? []) {
    if (text.includes(foldText(m))) out.push(`${page.name}: carries "${m}" — the draft's note, which is not published`);
  }
  return out;
}

/**
 * The live check: each page fetched once, one at a time (each answered and read before the next is asked), GET with
 * `redirect: 'manual'`; it must answer 200 — a redirect (3xx, or a browser's opaque redirect) fails, as does any other
 * status or no answer — and then pass pageProblems. Resolves `{ok, problems}`; never throws for a page's failure.
 *
 * @param {{fetch: (url: string, init: {method: 'GET', redirect: 'manual'}) => Promise<{status: number, type?: string, headers?: {get(name: string): string | null}, text(): Promise<string>}>, pages?: readonly object[], sentences?: readonly {id: string, text: string}[]}} io
 */
export async function liveCheck(io) {
  const fetch = io?.fetch;
  if (typeof fetch !== 'function') throw new TypeError('liveCheck needs an injected fetch (it has no default)');
  const pages = io.pages ?? LIVE_PAGES;
  const sentences = io.sentences ?? PRIVACY_SENTENCES;
  const problems = [];
  for (const page of pages) {
    let res;
    try {
      res = await fetch(page.url, {method: 'GET', redirect: 'manual'});
    } catch (e) {
      problems.push(`${page.name}: ${page.url} did not answer (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    if (res.status !== 200 || res.type === 'opaqueredirect') {
      const to = res.headers?.get('location') ?? null;
      // The final review's Minor 5: "a redirect fails" only for a redirect (a 3xx, or the browser's opaque one).
      const redirect = res.type === 'opaqueredirect' || (res.status >= 300 && res.status <= 399);
      problems.push(`${page.name}: ${page.url} answered ${res.status}${to === null ? '' : ` (Location: ${to})`}, want 200${redirect ? ' — a redirect fails' : ''}`);
      continue;
    }
    let html;
    try {
      html = await res.text();
    } catch (e) {
      problems.push(`${page.name}: ${page.url}'s body could not be read (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    problems.push(...pageProblems(page, html, sentences));
  }
  return {ok: problems.length === 0, problems};
}
