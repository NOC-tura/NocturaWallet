import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {LINKS, SKIPPED, linkViolations, packageFiles, urlStrings} from '../check-links.mjs';

// B1e §4.3 (I1, R8): the link gate over a package written for the test in the shapes of the real files (the real
// packages are read by scripts/__tests__/presaleBuilds.test.mjs).
const PACKAGE = {
  'manifest.json': JSON.stringify({host_permissions: ['https://api.noc-tura.io/*', 'https://wallet.noc-tura.io/*'], content_security_policy: {extension_pages: "default-src 'self'; connect-src https://api.noc-tura.io; base-uri 'none'"}}),
  'background.js': 'const B="https://api.noc-tura.io/api/v1",R=`https://api.noc-tura.io/api/v1/rpc`;throw Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");',
  'assets/mount-1.js': 'const E="https://solscan.io/tx/";const T={terms:"https://noc-tura.io/extension/terms",privacy:"https://noc-tura.io/extension/privacy",help:"https://noc-tura.io/extension/help"};c("http://www.w3.org/2000/svg","svg")',
  'assets/addressBook-1.js': '"https://reactjs.org/docs/error-decoder.html?invariant="+e;["http://www.w3.org/1999/xhtml","http://www.w3.org/1999/xlink","http://www.w3.org/XML/1998/namespace","http://www.w3.org/1998/Math/MathML"]',
  'unlock.html': '<a href="https://noc-tura.io/extension/terms" target="_blank">Terms</a>',
  'licenses.html': '<pre>http://www.apache.org/licenses/LICENSE-2.0 https://paulmillr.com</pre>',
  'assets/mount-1.css': '.a{color:red}',
  'fonts/LICENSE.txt': 'http://scripts.sil.org/OFL',
};
const files = (over = {}) =>
  Object.entries({...PACKAGE, ...over})
    .filter(([, text]) => text !== undefined)
    .map(([path, text]) => ({path, text}));

describe('the link gate (B1e §4.3)', () => {
  it('passes a package that names only the table’s strings, each where it may be, with the four links present', () => {
    expect(linkViolations(files(), false)).toEqual([]);
    expect(linkViolations(files(), true)).toEqual([]);
  });

  it('extracts with the spec’s pattern: quotes, backquotes, <, >, ), \\, ; and whitespace end a URL; a template interpolation is folded', () => {
    expect(urlStrings('a="https://x.example/a"b`wss://y.example/b`c<ftp://z.example/c>d(http://q.example/d)e https://r.example/e;f')).toEqual([
      'https://x.example/a',
      'wss://y.example/b',
      'ftp://z.example/c',
      'http://q.example/d',
      'https://r.example/e',
    ]);
    expect(urlStrings('`https://noc-tura.io?ref=${e}`, `https://noc-tura.io?ref=${tn}`')).toEqual(['https://noc-tura.io?ref=${}', 'https://noc-tura.io?ref=${}']);
    // Rev 2.6: the scheme in any case, kept as written.
    expect(urlStrings('a="HTTPS://x.example/a"b`WsS://y.example/b`c<FTP://z.example/c>d(Http://q.example/d)')).toEqual([
      'HTTPS://x.example/a',
      'WsS://y.example/b',
      'FTP://z.example/c',
      'Http://q.example/d',
    ]);
  });

  it.each([
    ['a planted https://evil.example/ in a page chunk', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};fetch("https://evil.example/")`}, 'assets/mount-1.js names "https://evil.example/" — a URL the link table does not name'],
    ['a planted wss://evil.example', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};new WebSocket("wss://evil.example")`}, 'assets/mount-1.js names "wss://evil.example" — a URL the link table does not name'],
    ['the coordinator named by a page chunk', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};x("https://api.noc-tura.io/api/v1")`}, 'assets/mount-1.js names "https://api.noc-tura.io/api/v1" — the coordinator base (API_BASE), not allowed in this file'],
    ['the RP ID host named by the background', {'background.js': `${PACKAGE['background.js']};fetch("https://wallet.noc-tura.io/*")`}, 'background.js names "https://wallet.noc-tura.io/*" — host permission (the passkey RP ID), not allowed in this file'],
    ['an inert string changed by one character', {'background.js': PACKAGE['background.js'].replace('getrandomvalues-not-supported', 'getrandomvalues-not-supportex')}, 'background.js names "https://github.com/uuidjs/uuid#getrandomvalues-not-supportex" — a URL the link table does not name'],
    ['a navigable link with a dynamic suffix', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};x(\`https://noc-tura.io/extension/terms\${q}\`)`}, 'assets/mount-1.js names "https://noc-tura.io/extension/terms${}" — a URL the link table does not name'],
    ['a planted http:// URL in CSS', {'assets/mount-1.css': '.a{background:url(http://evil.example/x.png)}'}, 'assets/mount-1.css names "http://evil.example/x.png" — a URL the link table does not name'],
    ['the same licenses.html below the root (skipped by name at the root only)', {'sub/licenses.html': PACKAGE['licenses.html']}, 'sub/licenses.html names "http://www.apache.org/licenses/LICENSE-2.0" — a URL the link table does not name'],
    // Rev 2.6 (final review, ledger T6 M1): the scheme is matched in any case — Chrome navigates HTTPS:// as https://.
    ['a planted upper-case HTTPS://evil.example/ in a page chunk', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};open("HTTPS://evil.example/")`}, 'assets/mount-1.js names "HTTPS://evil.example/" — a URL the link table does not name'],
    ['a mixed-case Wss://evil.example in a page chunk', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};new WebSocket("Wss://evil.example")`}, 'assets/mount-1.js names "Wss://evil.example" — a URL the link table does not name'],
    ['a navigable link written with an upper-case scheme (the table compare stays exact)', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};x("HTTPS://noc-tura.io/extension/terms")`}, 'assets/mount-1.js names "HTTPS://noc-tura.io/extension/terms" — a URL the link table does not name'],
    // Rev 2.6 (ledger T6 M2): .mjs and .txt files are read.
    ['a planted URL in an .mjs file', {'assets/x.mjs': 'export const u="https://evil.example/m"'}, 'assets/x.mjs names "https://evil.example/m" — a URL the link table does not name'],
    ['a planted URL in a .txt file', {'notes.txt': 'see https://evil.example/t'}, 'notes.txt names "https://evil.example/t" — a URL the link table does not name'],
    ['the fonts’ licence text anywhere but fonts/LICENSE.txt (skipped by its exact path only)', {'fonts/LICENSE2.txt': PACKAGE['fonts/LICENSE.txt']}, 'fonts/LICENSE2.txt names "http://scripts.sil.org/OFL" — a URL the link table does not name'],
    ['the fonts’ licence text at the root', {'LICENSE.txt': PACKAGE['fonts/LICENSE.txt']}, 'LICENSE.txt names "http://scripts.sil.org/OFL" — a URL the link table does not name'],
  ])('fails %s', (_, over, problem) => {
    expect(linkViolations(files(over), false)).toContain(problem);
  });

  it('a known limit, not a pass (plan Review Focus 2): a URL never written whole is not seen — the scheme split from its "://", a scheme-relative //host, a base64 text', () => {
    const hidden = 'x("http"+"s://evil.example/a");y("//evil.example/b");z(atob("aHR0cHM6Ly9ldmlsLmV4YW1wbGUvYw=="))';
    expect(urlStrings(hidden)).toEqual([]);
    expect(linkViolations(files({'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};${hidden}`}), false)).toEqual([]);
    // Controls: written whole it fails, and so does a whole scheme with the host added at run time.
    expect(linkViolations(files({'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};x("https://evil.example/a")`}), false)).toEqual(['assets/mount-1.js names "https://evil.example/a" — a URL the link table does not name']);
    expect(linkViolations(files({'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};x("https://"+h)`}), false)).toEqual(['assets/mount-1.js names "https://" — a URL the link table does not name']);
  });

  it('a link the user is given must be present: privacy removed → fails', () => {
    expect(linkViolations(files({'assets/mount-1.js': PACKAGE['assets/mount-1.js'].replace(',privacy:"https://noc-tura.io/extension/privacy"', '')}), false)).toEqual([
      'https://noc-tura.io/extension/privacy (Privacy Policy (#1, #38)) is in no file — the link the user is given is gone',
    ]);
  });

  it('the referral invite link is the presale build’s only — in the store build it fails', () => {
    const referral = {'assets/referral-1.js': 'function p(e){return`https://noc-tura.io?ref=${e}`}'};
    expect(linkViolations(files(referral), true)).toEqual([]);
    expect(linkViolations(files(referral), false)).toEqual(['assets/referral-1.js names "https://noc-tura.io?ref=${}" — a URL the link table does not name']);
  });

  it('licenses.html is skipped by name — the skip is the only reason it passes', () => {
    expect(SKIPPED).toEqual(['licenses.html', 'fonts/LICENSE.txt']);
    expect(linkViolations(files(), false, {skipped: ['fonts/LICENSE.txt']})).toEqual([
      'licenses.html names "http://www.apache.org/licenses/LICENSE-2.0" — a URL the link table does not name',
      'licenses.html names "https://paulmillr.com" — a URL the link table does not name',
    ]);
    expect(linkViolations(files({'licenses.html.copy.html': PACKAGE['licenses.html']}), false)).toHaveLength(2);
  });

  it('fonts/LICENSE.txt is skipped by name (rev 2.6) — the skip is the only reason it passes', () => {
    expect(linkViolations(files(), false, {skipped: ['licenses.html']})).toEqual(['fonts/LICENSE.txt names "http://scripts.sil.org/OFL" — a URL the link table does not name']);
    expect(linkViolations(files(), false, {skipped: []})).toEqual([
      'licenses.html names "http://www.apache.org/licenses/LICENSE-2.0" — a URL the link table does not name',
      'licenses.html names "https://paulmillr.com" — a URL the link table does not name',
      'fonts/LICENSE.txt names "http://scripts.sil.org/OFL" — a URL the link table does not name',
    ]);
  });

  it('reads an SVG document too: a link planted in one fails (review M5); a font is still not read', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="https://evil.example/">x</a></svg>';
    expect(linkViolations(files({'icons/x.svg': svg}), false)).toEqual([
      'icons/x.svg names "http://www.w3.org/2000/svg" — inert: react-dom and React elements, an XML namespace identifier, not allowed in this file',
      'icons/x.svg names "https://evil.example/" — a URL the link table does not name',
    ]);
    expect(linkViolations(files({'fonts/x.woff2': svg}), false)).toEqual([]);
  });

  it('the table is a parameter for the controls: one inert string changed by one character → the package fails', () => {
    const links = LINKS.map(l => (l.url === 'http://www.w3.org/1999/xlink' ? {...l, url: 'http://www.w3.org/1999/xlinx'} : l));
    expect(linkViolations(files(), false, {links})).toEqual(['assets/addressBook-1.js names "http://www.w3.org/1999/xlink" — a URL the link table does not name']);
  });

  it('a package with no URL string at all is INCONCLUSIVE, never a pass', () => {
    expect(linkViolations([{path: 'background.js', text: 'x'}], false)).toEqual(['INCONCLUSIVE: no URL string in the package — the extraction broke']);
  });

  it('reads every file of a package directory, with / paths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-'));
    try {
      for (const [path, text] of Object.entries(PACKAGE)) {
        mkdirSync(dirname(join(dir, path)), {recursive: true});
        writeFileSync(join(dir, path), text);
      }
      expect(linkViolations(packageFiles(dir), false)).toEqual([]);
      expect(packageFiles(dir).map(f => f.path)).toEqual(Object.keys(PACKAGE).sort());
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});
