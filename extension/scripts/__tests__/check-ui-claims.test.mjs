import {mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {builtUnits, htmlUnits, scriptUnits, sourceUnits} from '../check-ui-claims.mjs';
import {ALLOWED, claimViolations, unusedAllowances} from '../claims.mjs';
import {render} from '../../manifest/source.mjs';

// B1e §6.1, §6.4 (B1e-2 Task 6): no screen of the extension says what its privacy policy contradicts. The source tier
// is read here (both builds' code: the HTML entries and every non-test .ts / .tsx under src/); the built packages are
// read by the gate's CLI (`npm run gates`, both dists), whose reader is tested here on a package written for the test.
// The claims and the allowances are scripts/claims.mjs (tested in claims.test.mjs); here they are read on the 'source' tier.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = sourceUnits(ROOT);
const at = (where, text) => ({where, text});
const onSource = units => claimViolations(units, {tier: 'source'});

/** The three sentences #1 and #39 said before (B1b-2a), each a claim the policy contradicts. */
const OLD = {
  tagline: 'A Solana wallet built for private, non-custodial holding.',
  chip: 'E2E encrypted',
  footer: 'The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address.',
  // #8's banner before E24 (owner, 2026-11-06): it named the phone app's "future private (shielded) keys".
  banner: "This phrase is also the root of the Noctura phone app's future private (shielded) keys — anyone who gets it from this browser gets those too.",
};
/** Their replacements (D27, the controller's tagline and chip; the #39 footer as corrected by this task). */
const NEW = {
  tagline: 'A non-custodial Solana wallet. Your keys stay on this device.',
  chip: 'Encrypted on this device',
  footer: "Your recovery phrase and password never leave this device. To read your balances, your accounts' public addresses are sent to the Noctura coordinator.",
  banner:
    "This phrase is also the root of the Noctura phone app's keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.",
};

/** The source tier's files, listed independently of sourceUnits (Node's own recursive readdir): the reader's positive control. */
function sourceFiles() {
  const html = readdirSync(ROOT).filter(n => n.endsWith('.html'));
  const ts = readdirSync(resolve(ROOT, 'src'), {recursive: true})
    .map(p => `src/${String(p).split('\\').join('/')}`)
    .filter(p => /\.tsx?$/.test(p) && !p.endsWith('.d.ts') && !p.includes('/__tests__/') && !/\.test\.tsx?$/.test(p));
  return [...html, ...ts].sort();
}

describe('the extension says nothing its privacy policy contradicts (source tier)', () => {
  it('reads the real files — the HTML entries and src/ without tests — and finds no refused claim', () => {
    // Positive control: the reader read exactly the files an independent listing finds (review 1 M4: derived, not a
    // pinned count, so a file added elsewhere cannot turn this red), and enough of them to be the package.
    expect(SOURCE.files.filter(f => f.endsWith('.html'))).toEqual(['approve.html', 'popup.html', 'unlock.html', 'wallet.html']);
    expect([...SOURCE.files].sort()).toEqual(sourceFiles());
    expect(SOURCE.files.length).toBeGreaterThan(200);
    expect(SOURCE.units.length).toBeGreaterThan(14_000);
    expect(SOURCE.files.some(f => f.includes('__tests__') || f.endsWith('.test.ts') || f.endsWith('.test.tsx'))).toBe(false);
    const used = new Set();
    expect(claimViolations(SOURCE.units, {tier: 'source', used})).toEqual([]);
    // Every source allowance is still needed: a stale one would let its word back in.
    expect(unusedAllowances(used, 'source')).toEqual([]);
  });

  it("reads #1's tagline and chip, #39's footer and #8's banner as they are now — and the four old sentences nowhere", () => {
    const unlock = SOURCE.units.filter(u => u.where === 'unlock.html').map(u => u.text);
    for (const text of Object.values(NEW)) expect(unlock).toContain(text);
    const all = SOURCE.units.map(u => u.text).join('\n');
    for (const text of Object.values(OLD)) expect(all).not.toContain(text);
  });

  it('refuses each old sentence, by the claim it makes; passes each new one', () => {
    expect(onSource([at('x', OLD.tagline)])).toEqual([`x: "private" in “${OLD.tagline}”`]);
    expect(onSource([at('x', OLD.chip)])).toEqual([`x: "e2e" in “${OLD.chip}”`]);
    expect(onSource([at('x', OLD.footer)])).toEqual([`x: "never see" in “${OLD.footer}”`, `x: "we don't see" in “${OLD.footer}”`, `x: "offline-only" in “${OLD.footer}”`]);
    expect(onSource([at('x', OLD.banner)])).toEqual([`x: "private" in “${OLD.banner}”`, `x: "shielded" in “${OLD.banner}”`]);
    for (const text of Object.values(NEW)) expect(onSource([at('x', text)])).toEqual([]);
  });

  it('reports a source allowance no source file uses (a stale entry); a built-only allowance admits nothing in the source', () => {
    const allowed = [...ALLOWED, {text: 'A planted private sentence.', tiers: ['source'], verdict: 'test'}];
    const used = new Set();
    claimViolations(SOURCE.units, {tier: 'source', allowed, used});
    expect(unusedAllowances(used, 'source', allowed)).toEqual(['allowance not used by any source text: “A planted private sentence.”']);
    // Review 1 I3: the bundled tslib helper's words are allowed in the packages, not on a screen's source.
    const helper = 'Private accessor was defined without a getter';
    expect(claimViolations([at('b', helper)], {tier: 'built'})).toEqual([]);
    expect(onSource([at('s', helper)])).toEqual([`s: "private" in “${helper}”`]);
  });
});

describe('the readers: what a user sees, never comments', () => {
  it('HTML: text between tags, visible attributes in all three quotings; comments, <script>, <style> and <template> dropped; inline tags keep a sentence whole', () => {
    const html = [
      '<!-- We never see anything. -->',
      '<style>.x::after{content:"private"}</style><script>const a = "shielded";</script><template><p>Anonymous</p></template>',
      '<p>By continuing you agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.</p>',
      '<input placeholder="Your private notes" aria-label="Untraceable field"><img alt="E2E" title="Zero-knowledge">',
      '<span class="chip"><svg><use href="#i" /></svg>End&#8209;to-end &amp; more</span>',
      // Review 1 I3: single-quoted and unquoted values, and a button's value, are read too; a hidden class name is not.
      "<button title='Nothing leaves this device' aria-label=Incognito class=\"private\"></button><input type=submit value=\"Stay offline\" data-x='shielded'>",
    ].join('\n');
    expect(htmlUnits(html, 'h.html').map(u => `${u.where}|${u.text}`)).toEqual([
      'h.html [attribute]|Your private notes',
      'h.html [attribute]|Untraceable field',
      'h.html [attribute]|E2E',
      'h.html [attribute]|Zero-knowledge',
      'h.html [attribute]|Nothing leaves this device',
      'h.html [attribute]|Incognito',
      'h.html [attribute]|Stay offline',
      'h.html|By continuing you agree to the Terms and Privacy Policy.',
      'h.html|End\u2011to-end & more',
    ]);
  });

  it('TS / TSX: string literals, template literals (`${}` for each interpolation) and JSX text — never comments or identifiers', () => {
    const code = [
      '// We never see your seed (a comment).',
      '/* offline-only */',
      'const privateThing = 1;',
      "export const A = {t: 'Single', u: \"Double\", v: `Plain`, w: (n: number) => `Before ${n} after ${n + 1} end`};",
      'export const C = () => <p className="x">Shown {A.t} text</p>;',
    ].join('\n');
    expect(scriptUnits(code, 'c.tsx').map(u => u.text)).toEqual(['Single', 'Double', 'Plain', 'Before ${} after ${} end', 'x', 'Shown', 'text']);
  });

  it('built packages: every .html and .js file, licenses.html skipped by name', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noctura-ui-claims-'));
    try {
      const write = (rel, text) => {
        mkdirSync(dirname(join(dir, rel)), {recursive: true});
        writeFileSync(join(dir, rel), text);
      };
      write('unlock.html', `<p>${OLD.tagline}</p>`);
      write('assets/approve-1.js', 'const T={chip:`E2E encrypted`};');
      write('background.js', 'throw TypeError("Private accessor was defined without a getter")');
      write('licenses.html', '<pre>THE SOFTWARE IS PROVIDED … private use …</pre>');
      write('assets/x.css', '.private{}');
      const built = builtUnits(dir, 'pkg');
      expect(built.files).toEqual(['assets/approve-1.js', 'background.js', 'unlock.html']);
      const used = new Set();
      expect(claimViolations(built.units, {tier: 'built', used})).toEqual([`pkg/assets/approve-1.js: "e2e" in “E2E encrypted”`, `pkg/unlock.html: "private" in “${OLD.tagline}”`]);
      expect([...used]).toEqual(['Private accessor was defined without a getter']);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});

describe("the store's summary is the manifest's description (B1e §6.4)", () => {
  it('both browsers carry one description: at most 132 characters, and no refused claim', () => {
    const d = render('chrome').description;
    expect(render('firefox').description).toBe(d);
    expect(d).toBe('A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.');
    expect([...d].length).toBeLessThanOrEqual(132);
    expect(onSource([at('description', d)])).toEqual([]);
    // The listing's summary is the same string: scripts/__tests__/storeTexts.test.mjs pins section(Summary) === description.
    expect(readFileSync(resolve(ROOT, 'release/listing.md'), 'utf8')).toContain(`## Summary (short description)\n\n${d}\n`);
  });
});
