import {CONTACT, LIVE_PAGES, NAMED_ENTITIES, decodeEntities, foldText, liveCheck, missingSentences, pageProblems, pageText} from '../live-check.mjs';
import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
import {NOCTURA_PAGES} from '../../src/shared/links';
import {ABOUT_TEXT} from '../../src/app/screens/About';

// B1e §6.5: the live check's comparison and its runner, offline — fixture HTML and an injected fetch only. Nothing
// here reaches the network: globalThis.fetch is replaced by a recorder for every test and must stay unused.

const [PRIVACY, TERMS, HELP] = LIVE_PAGES;
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The privacy page as a CMS might publish it: a full document, each sentence its own <p>, typographic apostrophes
 * (alternately ’ as a character, &rsquo; and &#8217;), the words of every third sentence joined by NBSP (&nbsp; or the
 * character), and long paragraphs wrapped over lines — every difference the comparison folds away.
 */
function privacyHtml(sentences = PRIVACY_SENTENCES) {
  const apostrophes = ['\u2019', '&rsquo;', '&#8217;'];
  const body = sentences
    .map((s, i) => {
      let t = escapeHtml(s.text).replace(/'/g, apostrophes[i % 3]);
      if (i % 3 === 1) t = t.replace(/ /g, i % 2 === 0 ? '&nbsp;' : '\u00a0');
      if (i % 3 === 2) t = t.replace(/ (\S+) /, '\n      $1\n      ');
      return `    <p>${t}</p>`;
    })
    .join('\n');
  return `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Privacy Policy — Noctura</title><style>p > b { font-weight: 600 }</style></head>\n<body>\n  <main>\n    <h1>Privacy Policy</h1>\n${body}\n  </main>\n</body>\n</html>\n`;
}

const otherHtml = (title, contact = CONTACT) =>
  `<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1><p>Questions: <a href="mailto:${contact}">${contact}</a>.</p></body></html>`;

/** An injected fetch answering each URL from `answers` ({status, body, location?, type?} or an Error to throw), recording every call. */
function fakeFetch(answers) {
  const calls = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetch = async (url, init) => {
    calls.push({url, init});
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(r => setTimeout(r, 5));
    const a = answers[url];
    if (a === undefined || a instanceof Error) {
      inFlight -= 1;
      throw a ?? new Error(`no answer for ${url}`);
    }
    return {
      status: a.status,
      type: a.type ?? 'basic',
      headers: {get: n => (n.toLowerCase() === 'location' ? (a.location ?? null) : null)},
      text: async () => {
        await new Promise(r => setTimeout(r, 5));
        inFlight -= 1;
        return a.body ?? '';
      },
    };
  };
  return {fetch, calls, max: () => maxInFlight};
}

const allGood = () => ({
  [PRIVACY.url]: {status: 200, body: privacyHtml()},
  [TERMS.url]: {status: 200, body: otherHtml(TERMS.title)},
  [HELP.url]: {status: 200, body: otherHtml(HELP.title)},
});

describe('the live check (B1e §6.5)', () => {
  let globalCalls;
  let realFetch;
  beforeEach(() => {
    realFetch = globalThis.fetch;
    globalCalls = [];
    globalThis.fetch = async url => {
      globalCalls.push(String(url));
      throw new Error('a test reached globalThis.fetch');
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    expect(globalCalls, 'the live check used globalThis.fetch').toEqual([]);
  });

  it('reads the three pages at the links the extension opens; Terms and Help are titled as #38 names them', () => {
    expect(LIVE_PAGES.map(p => p.name)).toEqual(['privacy', 'terms', 'help']);
    expect(LIVE_PAGES.map(p => p.url)).toEqual([NOCTURA_PAGES.privacy, NOCTURA_PAGES.terms, NOCTURA_PAGES.help]);
    expect(LIVE_PAGES.map(p => p.title)).toEqual([ABOUT_TEXT.privacy, ABOUT_TEXT.terms, ABOUT_TEXT.help]);
    expect(LIVE_PAGES.map(p => p.sentences)).toEqual([true, false, false]);
    expect(CONTACT).toBe('privacy@noc-tura.io');
  });

  it('control: every sentence on the page → passes (the fixture uses \u2019, &rsquo;, &#8217;, NBSP and wrapped lines)', () => {
    const html = privacyHtml();
    expect(html).toContain('&rsquo;');
    expect(html).toContain('&#8217;');
    expect(html).toContain('&nbsp;');
    expect(html).toContain('\u00a0');
    expect(html).toContain('\u2019');
    expect(missingSentences(html)).toEqual([]);
    expect(pageProblems(PRIVACY, html)).toEqual([]);
  });

  it('control: one sentence with one word changed → fails, naming that sentence and no other', () => {
    const changed = PRIVACY_SENTENCES.map(s => (s.id === 'P5' ? {...s, text: s.text.replace('every 30 seconds', 'every 60 seconds')} : s));
    expect(changed.find(s => s.id === 'P5').text).not.toBe(PRIVACY_SENTENCES.find(s => s.id === 'P5').text);
    const problems = pageProblems(PRIVACY, privacyHtml(changed));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^privacy: missing P5: "Before you sign, /);
  });

  it('control: one sentence missing → fails, naming it', () => {
    const problems = pageProblems(PRIVACY, privacyHtml(PRIVACY_SENTENCES.filter(s => s.id !== 'R21')));
    expect(problems).toEqual([`privacy: missing R21: "${PRIVACY_SENTENCES.find(s => s.id === 'R21').text}"`]);
  });

  it('control: a sentence split by <b>…</b> and a line break → passes', () => {
    const p1 = PRIVACY_SENTENCES[0];
    expect(p1.text).toBe('The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator.');
    const html = '<p>The extension itself connects to <b>one\n  server</b> only: api.noc-tura.io, the Noctura <strong class="x">coordinator</strong>.</p>';
    expect(missingSentences(html, [p1])).toEqual([]);
    // And the same split with a word changed inside the <b> still fails.
    expect(missingSentences(html.replace('<b>one', '<b>two'), [p1])).toEqual([p1]);
  });

  it('comments, <script>, <style> and <template> are not page text: a sentence only there fails', () => {
    const s = {id: 'X1', text: 'Questions about privacy: privacy@noc-tura.io.'};
    expect(missingSentences(`<p>${s.text}</p>`, [s]), 'positive control').toEqual([]);
    for (const hidden of [`<!-- ${s.text} -->`, `<!-- an old draft (a > b): ${s.text} -->`, `<script>var t = "${s.text}";</script>`, `<style>/* ${s.text} */</style>`, `<template><p>${s.text}</p></template>`, `<SCRIPT type="x">${s.text}</SCRIPT >`]) {
      expect(missingSentences(`<p>Other text.</p>${hidden}`, [s]), hidden).toEqual([s]);
    }
  });

  it('a tag whose attribute holds ">" is removed whole; a bare "<" in text is kept', () => {
    expect(pageText('<a title="a > b" href="x">link</a> and 1 < 2')).toBe('link and 1 < 2');
  });

  it('entities: named and numeric (decimal, hex, 0x80–0x9F as Windows-1252) decode; an unknown named one stays → fails', () => {
    expect(decodeEntities('&amp; &lt;&gt; &quot;&apos; &rsquo;&ldquo;&rdquo; &mdash;')).toBe('& <> "\' \u2019\u201c\u201d —');
    expect(decodeEntities('&#39;&#x27;&#X27;&#8217;&#x2019;&#146;&#147;&#148;')).toBe("'''\u2019\u2019\u2019\u201c\u201d");
    expect(decodeEntities('&#0;&#x110000;&#xD800;')).toBe('\ufffd\ufffd\ufffd');
    expect(decodeEntities('&amp;lt; &unknownentity; &amp')).toBe('&lt; &unknownentity; &amp');
    expect(Object.keys(NAMED_ENTITIES)).toContain('nbsp');
    const s = {id: 'X', text: "your browser's standard headers"};
    expect(missingSentences('<p>your browser&#146;s standard headers</p>', [s])).toEqual([]);
    expect(missingSentences('<p>your browser&rsquo;s standard headers</p>', [s])).toEqual([]);
    expect(missingSentences('<p>your browser&rsquox;s standard headers</p>', [s])).toEqual([s]);
  });

  it('folding: NFC, \u2019 → \', \u201c \u201d → ", every whitespace run (NBSP, U+202F, U+3000, tabs, newlines) → one space', () => {
    expect(foldText('e\u0301')).toBe('\u00e9');
    expect(foldText('it\u2019s \u201cquoted\u201d')).toBe('it\'s "quoted"');
    expect(foldText('a\u00a0\u00a0b\u202fc\u3000d\t\n e')).toBe('a b c d e');
    const s = {id: 'X', text: 'Caf\u00e9 "menu" isn\'t here.'};
    expect(missingSentences('<p>Cafe\u0301 &ldquo;menu&rdquo; isn&rsquo;t\u00a0\n here.</p>', [s]), 'decomposed \u00e9, curly quotes, NBSP + newline').toEqual([]);
    // Only the three quote marks the spec names are folded: ‘ is not an apostrophe here.
    expect(missingSentences("<p>Cafe\u0301 \"menu\" isn\u2018t here.</p>", [s])).toEqual([s]);
  });

  it('the comparison is case-sensitive', () => {
    const s = PRIVACY_SENTENCES.find(x => x.id === 'P15');
    expect(missingSentences(`<p>${s.text}</p>`, [s])).toEqual([]);
    expect(missingSentences(`<p>${s.text.toLowerCase()}</p>`, [s])).toEqual([s]);
  });

  it('Terms and Help: their title and the contact → pass; either missing → fails, naming the page', () => {
    for (const page of [TERMS, HELP]) {
      expect(pageProblems(page, otherHtml(page.title))).toEqual([]);
      expect(pageProblems(page, otherHtml('Something else'))).toEqual([`${page.name}: missing its title "${page.title}"`]);
      expect(pageProblems(page, otherHtml(page.title, 'support@example.com'))).toEqual([`${page.name}: missing the contact privacy@noc-tura.io`]);
    }
    // Help's title carries "&": written as &amp; in HTML, decoded before the compare.
    expect(otherHtml(HELP.title)).toContain('Help &amp; support');
    // The contact only inside an attribute (a mailto: link with other text) is not on the page.
    expect(pageProblems(TERMS, `<h1>${TERMS.title}</h1><a href="mailto:${CONTACT}">write to us</a>`)).toEqual(['terms: missing the contact privacy@noc-tura.io']);
  });

  it('the runner: the three URLs in order, GET with redirect: manual, one at a time — every page good → ok', async () => {
    const f = fakeFetch(allGood());
    expect(await liveCheck({fetch: f.fetch})).toEqual({ok: true, problems: []});
    expect(f.calls.map(c => c.url)).toEqual(LIVE_PAGES.map(p => p.url));
    for (const c of f.calls) expect(c.init).toEqual({method: 'GET', redirect: 'manual'});
    expect(f.max(), 'requests in flight at once').toBe(1);
  });

  it('control: a 301 → fails (a redirect is never followed); a 404 → fails; an opaque redirect → fails', async () => {
    const moved = fakeFetch({...allGood(), [PRIVACY.url]: {status: 301, location: 'https://noc-tura.io/privacy'}});
    const r1 = await liveCheck({fetch: moved.fetch});
    expect(r1.ok).toBe(false);
    expect(r1.problems).toEqual([`privacy: ${PRIVACY.url} answered 301 (Location: https://noc-tura.io/privacy), want 200 — a redirect fails`]);
    expect(moved.calls.map(c => c.url), 'the redirect target is never asked').toEqual(LIVE_PAGES.map(p => p.url));

    const missing = fakeFetch({...allGood(), [TERMS.url]: {status: 404, body: '<h1>Not found</h1>'}});
    expect(await liveCheck({fetch: missing.fetch})).toEqual({ok: false, problems: [`terms: ${TERMS.url} answered 404, want 200`]});
    // The final review's Minor 5: the redirect suffix only on a redirect — a 500 is none; a 308 and a 399 are.
    const broken = fakeFetch({...allGood(), [TERMS.url]: {status: 500, body: 'oops'}});
    expect((await liveCheck({fetch: broken.fetch})).problems).toEqual([`terms: ${TERMS.url} answered 500, want 200`]);
    const kept = fakeFetch({...allGood(), [TERMS.url]: {status: 308, location: 'https://noc-tura.io/t'}});
    expect((await liveCheck({fetch: kept.fetch})).problems).toEqual([`terms: ${TERMS.url} answered 308 (Location: https://noc-tura.io/t), want 200 — a redirect fails`]);
    const edge = fakeFetch({...allGood(), [TERMS.url]: {status: 399}});
    expect((await liveCheck({fetch: edge.fetch})).problems).toEqual([`terms: ${TERMS.url} answered 399, want 200 — a redirect fails`]);
    const below = fakeFetch({...allGood(), [TERMS.url]: {status: 204}});
    expect((await liveCheck({fetch: below.fetch})).problems).toEqual([`terms: ${TERMS.url} answered 204, want 200`]);

    const opaque = fakeFetch({...allGood(), [HELP.url]: {status: 0, type: 'opaqueredirect'}});
    expect((await liveCheck({fetch: opaque.fetch})).problems).toEqual([`help: ${HELP.url} answered 0, want 200 — a redirect fails`]);
    const opaque200 = fakeFetch({...allGood(), [HELP.url]: {status: 200, type: 'opaqueredirect', body: otherHtml(HELP.title)}});
    expect((await liveCheck({fetch: opaque200.fetch})).ok, 'opaqueredirect fails whatever its status').toBe(false);
  });

  it('control: a page that does not answer, or a privacy page with a changed sentence → fails, naming each', async () => {
    const down = fakeFetch({...allGood(), [HELP.url]: new Error('getaddrinfo ENOTFOUND noc-tura.io')});
    expect(await liveCheck({fetch: down.fetch})).toEqual({ok: false, problems: [`help: ${HELP.url} did not answer (getaddrinfo ENOTFOUND noc-tura.io)`]});
    const stale = privacyHtml(PRIVACY_SENTENCES.map(s => (s.id === 'P8' ? {...s, text: s.text.replace('up to 10 minutes', 'up to 15 minutes')} : s)));
    expect(stale).toMatch(/15(&nbsp;|\u00a0)minutes/);
    const old = fakeFetch({...allGood(), [PRIVACY.url]: {status: 200, body: stale}});
    const r = await liveCheck({fetch: old.fetch});
    expect(r.ok).toBe(false);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/^privacy: missing P8: /);
  });

  it('it has no default fetch: called without one it refuses before any request', async () => {
    await expect(liveCheck({})).rejects.toThrow(TypeError);
    await expect(liveCheck(undefined)).rejects.toThrow(/injected fetch/);
  });
});
