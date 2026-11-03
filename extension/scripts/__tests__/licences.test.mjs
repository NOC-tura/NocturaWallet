import {createHash} from 'node:crypto';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ALLOWED_LICENCES, FONTS, LICENCE_IDS, MODULE_MAPS, WRAP_COLUMNS, buildLicencePage, licenceEntries, licencePage, moduleKind, renderedModules, wrapText} from '../licences.mjs';
import {licencePageViolations, rpcWebsocketsViolations} from '../check-licences.mjs';
import {RPC_WEBSOCKETS_STUB} from '../rpcWebsockets.mjs';
import {staticPageViolations} from '../check-vault-isolation.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const collapse = text => text.split(/\s+/).filter(Boolean).join(' ');
/** The lines of the page's <pre> blocks as the browser renders them (entities decoded) — a <pre> never wraps; a <p> does. */
const renderedLines = html => html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').split('\n');
const preLines = html => [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].flatMap(m => renderedLines(m[1]));
const overlong = html => preLines(html).filter(l => [...l].length > WRAP_COLUMNS && /\s/.test(l.trim()));

// B1e §4.2, §4.4: the licence page from the module maps — rendered code only, the owner's allowlist, licence-ids.json,
// the fonts — over a package tree written for the test (node_modules, the tables, the repository's LICENSE).
describe('the licence page (B1e §4.2)', () => {
  let repo;
  let root;
  let out;
  const write = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), {recursive: true});
    writeFileSync(join(root, rel), text);
  };
  const pkg = (dir, json, files = {}) => {
    write(`${dir}/package.json`, JSON.stringify(json));
    for (const [name, text] of Object.entries(files)) write(`${dir}/${name}`, text);
  };
  /** One map per MODULE_MAPS file; `rendered` for the first, the content scripts' own maps carry ours only. */
  const maps = rendered => [
    ['app.modules.json', {chunks: {'background.js': Object.keys(rendered)}, rendered: {'background.js': rendered}}],
    ['app.provider.modules.json', {chunks: {'provider.js': ['src/provider/index.ts']}, rendered: {'provider.js': {'src/provider/index.ts': 10}}}],
    ['app.relay.modules.json', {chunks: {'relay.js': ['src/relay/index.ts']}, rendered: {'relay.js': {'src/relay/index.ts': 10}}}],
  ];
  const RENDERED = {
    'src/background/index.ts': 100,
    '../core/solana/rpc.ts': 50,
    'unlock.html': 0,
    '\0rolldown/runtime.js': 30,
    '__vite-browser-external': 5,
    'node_modules/alpha/index.js': 40,
    'node_modules/alpha/lib/deep/x.js': 4,
    'node_modules/beta/index.js': 12,
    'node_modules/gamma/index.js': 0,
    'node_modules/delta/node_modules/alpha/index.js': 7,
    'node_modules/epsilon/node_modules/alpha/index.js': 3,
    'node_modules/zeta/dist/z.mjs': 9,
    'node_modules/@scope/eta/index.js': 1,
  };
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'licences-'));
    root = join(repo, 'extension');
    out = join(root, 'dist');
    writeFileSync(join(repo, 'LICENSE'), 'Business Source License 1.1\r\n\r\nLicensor: Noctura\r\n');
    write(LICENCE_IDS, `${JSON.stringify({'beta@2.0.0': 'Unlicense'})}\n`);
    write('release/licence-texts/MIT.txt', 'MIT License\n\nPermission is hereby granted <standard>.\n');
    write('public/fonts/LICENSE.txt', 'Copyright (c) 2023 Vercel\n\nSIL OPEN FONT LICENSE Version 1.1\n');
    pkg('node_modules/alpha', {name: 'alpha', version: '1.0.0', license: 'MIT'}, {LICENSE: 'Copyright (c) Alpha <a@x.y>\r\nMIT text\r\n'});
    // A directory with its own package.json but no name is not a package: alpha's own is found above it.
    pkg('node_modules/alpha/lib', {type: 'module'});
    pkg('node_modules/beta', {name: 'beta', version: '2.0.0', author: 'Beta Author'}, {'LICENSE.md': 'This is free and unencumbered software released into the public domain.\n'});
    pkg('node_modules/gamma', {name: 'gamma', version: '3.0.0', license: 'LGPL-3.0-only'}, {LICENSE: 'LGPL'});
    // Two nested copies of alpha: one the same version and text as the top level (one entry), one another version.
    pkg('node_modules/delta/node_modules/alpha', {name: 'alpha', version: '1.0.0', license: 'MIT'}, {LICENSE: 'Copyright (c) Alpha <a@x.y>\nMIT text\n'});
    pkg('node_modules/epsilon/node_modules/alpha', {name: 'alpha', version: '0.9.0', license: 'MIT'}, {LICENSE: 'Copyright (c) Alpha 0.9\n'});
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'MIT', author: {name: 'Zeta Z', email: 'z@z.z', url: 'https://z.example'}});
    pkg('node_modules/@scope/eta', {name: '@scope/eta', version: '5.0.0', license: 'Apache-2.0'}, {'LICENSE-MIT.txt': 'MIT part', 'LICENSE-APACHE': 'Apache part', COPYING: 'copying part', README: 'not a licence'});
    mkdirSync(join(out, 'app', 'fonts'), {recursive: true});
    for (const f of Object.keys(FONTS.files)) copyFileSync(join(ROOT, 'public/fonts', f), join(out, 'app', 'fonts', f));
    copyFileSync(join(root, 'public/fonts/LICENSE.txt'), join(out, 'app', 'fonts', 'LICENSE.txt'));
  });
  afterEach(() => rmSync(repo, {recursive: true, force: true}));

  const entries = (rendered = RENDERED) => licenceEntries(root, maps(rendered), join(out, 'app'));
  const titles = list => list.map(e => (e.version === undefined ? e.name : `${e.name} ${e.version}`));
  const fails = (rendered = RENDERED) => {
    try {
      entries(rendered);
    } catch (e) {
      return e.message.split('\n').slice(1);
    }
    throw new Error('the page was built');
  };

  it('lists Noctura first, then every package with rendered code and the fonts, by name then version — a package rendered 0 is absent', () => {
    expect(titles(entries())).toEqual(['Noctura', '@scope/eta 5.0.0', 'alpha 0.9.0', 'alpha 1.0.0', 'beta 2.0.0', 'geist 1.7.2', 'zeta 0.1.0']);
    expect(titles(entries())).not.toContain('gamma 3.0.0');
  });

  it('copies with the same name, version and text are one entry; the same name and version with another text are two', () => {
    expect(titles(entries()).filter(t => t === 'alpha 1.0.0')).toHaveLength(1);
    write('node_modules/delta/node_modules/alpha/LICENSE', 'Copyright (c) Alpha, a fork\n');
    expect(titles(entries()).filter(t => t === 'alpha 1.0.0')).toHaveLength(2);
  });

  it('the texts: ours from the repository LICENSE, every LICENSE*/LICENCE*/COPYING* sorted (CRLF folded), the standard text headed by the author, the fonts', () => {
    const byTitle = Object.fromEntries(entries().map(e => [e.version === undefined ? e.name : `${e.name} ${e.version}`, e]));
    expect(byTitle.Noctura).toEqual({name: 'Noctura', spdx: 'BUSL-1.1', text: 'Business Source License 1.1\n\nLicensor: Noctura'});
    expect(byTitle['alpha 1.0.0'].text).toBe('Copyright (c) Alpha <a@x.y>\nMIT text');
    expect(byTitle['@scope/eta 5.0.0'].text).toBe('COPYING\n\ncopying part\n\nLICENSE-APACHE\n\nApache part\n\nLICENSE-MIT.txt\n\nMIT part');
    expect(byTitle['zeta 0.1.0'].text).toBe('Author: Zeta Z <z@z.z> (https://z.example)\nThe package ships no licence file; this is the standard MIT text its package.json names.\n\nMIT License\n\nPermission is hereby granted <standard>.');
    expect(byTitle['beta 2.0.0']).toMatchObject({spdx: 'Unlicense', text: 'This is free and unencumbered software released into the public domain.'});
    expect(byTitle['geist 1.7.2']).toEqual({name: 'geist', version: '1.7.2', spdx: 'OFL-1.1', files: ['fonts/Geist-Variable.woff2', 'fonts/GeistMono-Variable.woff2'], text: 'Copyright (c) 2023 Vercel\n\nSIL OPEN FONT LICENSE Version 1.1'});
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'MIT'});
    expect(Object.fromEntries(entries().map(e => [e.name, e]))['zeta'].text).toMatch(/^The package names no author\.\n/);
  });

  it('the page is plain text: every < escaped, no tag beyond plain text — the static-page rule holds on it', () => {
    write('node_modules/alpha/LICENSE', '<script src="x.js"></script> <a href="https://evil.example/">x</a> <style>body{}</style> & <b onclick=x>');
    const html = licencePage(entries());
    expect(html).toContain('&lt;script src="x.js"&gt;&lt;/script&gt; &lt;a href="https://evil.example/"&gt;x&lt;/a&gt;');
    expect(html).not.toContain('<script');
    expect(staticPageViolations('licenses.html', licencePage(entries({'src/a.ts': 1, 'node_modules/beta/index.js': 1})))).toEqual([]);
    expect(html.startsWith('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Open-source licenses · Noctura</title>')).toBe(true);
  });

  it('a limitation, as a test: a licence text that spells href= or style= fails the static-page rule (raw-file match) — the build stops, never ships it', () => {
    write('node_modules/alpha/LICENSE', 'see style= and href= here');
    expect(staticPageViolations('licenses.html', licencePage(entries()))).toEqual(['licenses.html contains href= — a static page links, loads and runs nothing', 'licenses.html contains style= — a static page links, loads and runs nothing']);
  });

  it('wraps every line longer than 100 columns at word boundaries; a word longer than 100 stays whole; nothing but the breaks changes', () => {
    expect(WRAP_COLUMNS).toBe(100);
    const long = Array.from({length: 40}, (_, i) => `word${i}`).join(' ');
    const giant = 'x'.repeat(130);
    const text = `short line\n${long}\n   indented ${long}\n${giant}\n${long} ${giant} tail\ntrailing  ${long}   `;
    const wrapped = wrapText(text);
    for (const line of wrapped.split('\n')) expect([line, [...line].length <= 100 || !/\s/.test(line.trim())]).toEqual([line, true]);
    expect(collapse(wrapped)).toBe(collapse(text));
    expect(wrapped.split('\n')).toContain(giant);
    expect(wrapped.split('\n')[0]).toBe('short line');
    expect(wrapText(wrapped)).toBe(wrapped);
    expect(wrapText('a'.repeat(100))).toBe('a'.repeat(100));
    expect(wrapText(`${'a'.repeat(50)} ${'b'.repeat(49)}`)).toBe(`${'a'.repeat(50)} ${'b'.repeat(49)}`);
    expect(wrapText(`${'a'.repeat(50)} ${'b'.repeat(50)}`)).toBe(`${'a'.repeat(50)}\n${'b'.repeat(50)}`);
    expect(wrapText('é'.repeat(60) + ' ' + 'é'.repeat(39))).toBe('é'.repeat(60) + ' ' + 'é'.repeat(39));
  });

  it('the page: no line of a <pre> over 100 columns but a one-word line; each text, whitespace collapsed, is the licence text', () => {
    write('node_modules/alpha/LICENSE', `${Array.from({length: 60}, (_, i) => `term<${i}>&`).join(' ')}\n${'y'.repeat(140)}`);
    const list = entries();
    const html = licencePage(list);
    expect(overlong(html)).toEqual([]);
    expect(preLines(html)).toContain('y'.repeat(140));
    const pres = [...html.matchAll(/<pre>([\s\S]*?)\n<\/pre>/g)].map(m => renderedLines(m[1]).join('\n'));
    expect(pres.map(collapse)).toEqual(list.map(e => collapse(e.text)));
  });

  it('deterministic: the same maps in another order give the same bytes; no date, no absolute path', () => {
    const a = licencePage(entries());
    const reversed = Object.fromEntries(Object.entries(RENDERED).reverse());
    expect(licencePage(licenceEntries(root, maps(reversed).reverse(), join(out, 'app')))).toBe(a);
    expect(a).not.toContain(repo);
    expect(a).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it('licence-ids.json: the row removed → the build fails; the row set to LGPL-3.0-only → the build fails', () => {
    write(LICENCE_IDS, '{}\n');
    expect(fails()).toEqual(['beta@2.0.0 (node_modules/beta): has rendered code, no license field and no row in release/licence-ids.json — classify it there']);
    write(LICENCE_IDS, `${JSON.stringify({'beta@2.0.0': 'LGPL-3.0-only'})}\n`);
    expect(fails()).toEqual([`beta@2.0.0 (node_modules/beta): LGPL-3.0-only is outside the licence allowlist (${ALLOWED_LICENCES.join(', ')}) — adding to it is the owner's decision`]);
  });

  it('a rendered LGPL package fails the build; a package rendered 0 is never judged', () => {
    expect(fails({...RENDERED, 'node_modules/gamma/index.js': 1})).toEqual([`gamma@3.0.0 (node_modules/gamma): LGPL-3.0-only is outside the licence allowlist (${ALLOWED_LICENCES.join(', ')}) (its license field; release/licence-ids.json cannot override a license field the package has) — adding to it is the owner's decision`]);
  });

  it('licence-ids.json cannot override a license field the package has: an SPDX expression or a {type} object still fails, and says so', () => {
    write(LICENCE_IDS, `${JSON.stringify({'beta@2.0.0': 'Unlicense', 'zeta@0.1.0': 'MIT'})}\n`);
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'MIT OR Apache-2.0'});
    expect(fails()).toEqual([`zeta@0.1.0 (node_modules/zeta): MIT OR Apache-2.0 is outside the licence allowlist (${ALLOWED_LICENCES.join(', ')}) (its license field; release/licence-ids.json cannot override a license field the package has) — adding to it is the owner's decision`]);
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: {type: 'MIT'}});
    expect(fails()).toEqual(['zeta@0.1.0 (node_modules/zeta): its license field is not an SPDX string ({"type":"MIT"}); release/licence-ids.json cannot override a license field the package has — admitting it is the owner\'s decision']);
    // Positive control: the same row classifies the package once it has no license field.
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0'}, {LICENSE: 'Copyright (c) Zeta\nMIT text\n'});
    expect(Object.fromEntries(entries().map(e => [e.name, e]))['zeta']).toMatchObject({spdx: 'MIT', text: 'Copyright (c) Zeta\nMIT text'});
  });

  it('fails a licence it cannot show, a module it cannot name, a license field that is not a string', () => {
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'ISC'});
    expect(fails()).toEqual(['zeta@0.1.0 (node_modules/zeta): ships no licence file, and release/licence-texts/ISC.txt does not exist — the build cannot show its licence']);
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: {type: 'MIT'}});
    expect(fails()).toEqual(['zeta@0.1.0 (node_modules/zeta): its license field is not an SPDX string ({"type":"MIT"}); release/licence-ids.json cannot override a license field the package has — admitting it is the owner\'s decision']);
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'MIT'});
    expect(fails({...RENDERED, 'vendor/x.js': 1})).toEqual(['"vendor/x.js" has rendered code but is neither ours (src/, ../core/, ../web/, a root page) nor a package\'s — the licence page cannot name it']);
    expect(fails({...RENDERED, 'node_modules/nameless/index.js': 1})).toEqual(['"node_modules/nameless/index.js": no package.json with a name above it']);
  });

  it('the fonts: a file without an entry fails, a changed face fails, a missing face is INCONCLUSIVE', () => {
    writeFileSync(join(out, 'app', 'fonts', 'Other.woff2'), 'x');
    expect(fails()).toEqual(['fonts/Other.woff2 is in the package without a licence entry']);
    rmSync(join(out, 'app', 'fonts', 'Other.woff2'));
    writeFileSync(join(out, 'app', 'fonts', 'Geist-Variable.woff2'), 'x');
    expect(fails()).toEqual(['fonts/Geist-Variable.woff2 is not the geist@1.7.2 file its entry was recorded for']);
    rmSync(join(out, 'app', 'fonts', 'Geist-Variable.woff2'));
    expect(fails()).toEqual(['INCONCLUSIVE: fonts/Geist-Variable.woff2 missing from the package — the font entry would describe nothing']);
  });

  it('INCONCLUSIVE: a map without its rendered section, a malformed length, no module of ours rendered, a missing map', () => {
    expect(() => renderedModules([['app.modules.json', {chunks: {}}]])).toThrow('INCONCLUSIVE: app.modules.json has no rendered section');
    expect(() => renderedModules([['app.modules.json', {rendered: {'a.js': {'src/a.ts': -1}}}]])).toThrow('INCONCLUSIVE: app.modules.json: a.js: "src/a.ts" has rendered length -1');
    expect(() => licenceEntries(root, [['app.modules.json', {rendered: {'a.js': {'node_modules/beta/index.js': 1}}}]], join(out, 'app'))).toThrow('INCONCLUSIVE: no module of ours has rendered code');
    expect(() => buildLicencePage(root, out)).toThrow(`INCONCLUSIVE: ${MODULE_MAPS[0]} is missing`);
  });

  it('what counts as ours, a package, skipped, or unknown', () => {
    expect(['src/a.ts', '../core/x.ts', '../web/src/ui/A.tsx', 'popup.html'].map(moduleKind)).toEqual(['ours', 'ours', 'ours', 'ours']);
    expect(['\0rolldown/runtime.js', '__vite-browser-external', '__vite-browser-external:crypto'].map(moduleKind)).toEqual(['skip', 'skip', 'skip']);
    expect(['node_modules/a/i.js', '../node_modules/a/i.js'].map(moduleKind)).toEqual(['package', 'package']);
    expect(['vendor/x.js', 'sub/page.html', '../other/x.ts'].map(moduleKind)).toEqual(['unknown', 'unknown', 'unknown']);
  });
});

describe('the licence gate (B1e §4.2, E16)', () => {
  const clean = () => [
    ['app.modules.json', {chunks: {'background.js': ['node_modules/@solana/web3.js/lib/index.browser.esm.js']}, rendered: {'background.js': {'node_modules/@solana/web3.js/lib/index.browser.esm.js': 100}}}],
  ];

  it('passes a build where rpc-websockets resolves to the stub and the stub renders nothing', () => {
    expect(rpcWebsocketsViolations(clean())).toEqual([]);
    const [[name, map]] = clean();
    map.chunks['background.js'].push(RPC_WEBSOCKETS_STUB);
    map.rendered['background.js'][RPC_WEBSOCKETS_STUB] = 0;
    expect(rpcWebsocketsViolations([[name, map]])).toEqual([]);
  });

  it('fails when the stub renders (something constructs a Connection), when the package is in the maps at all (the alias is gone), when it renders', () => {
    const [[name, map]] = clean();
    map.rendered['background.js'][RPC_WEBSOCKETS_STUB] = 325;
    expect(rpcWebsocketsViolations([[name, map]])).toEqual([`app.modules.json: background.js renders 325 bytes of ${RPC_WEBSOCKETS_STUB} — something constructs a Connection (a socket client); nothing the extension bundles may`]);
    const [[name2, map2]] = clean();
    map2.chunks['background.js'].push('node_modules/rpc-websockets/dist/index.browser.mjs');
    map2.rendered['background.js']['node_modules/rpc-websockets/dist/index.browser.mjs'] = 0;
    expect(rpcWebsocketsViolations([[name2, map2]])).toEqual([`app.modules.json: background.js carries "node_modules/rpc-websockets/dist/index.browser.mjs" — rpc-websockets must resolve to ${RPC_WEBSOCKETS_STUB} (the alias)`]);
    map2.rendered['background.js']['node_modules/rpc-websockets/dist/index.browser.mjs'] = 12;
    expect(rpcWebsocketsViolations([[name2, map2]])).toContain('app.modules.json: background.js renders 12 bytes of "node_modules/rpc-websockets/dist/index.browser.mjs" — no LGPL code may ship');
  });

  it('a map without its rendered section is INCONCLUSIVE', () => {
    expect(rpcWebsocketsViolations([['app.relay.modules.json', {chunks: {}}]])).toEqual(['INCONCLUSIVE: app.relay.modules.json has no rendered section — what rpc-websockets renders is unknown']);
  });

  it('a map without its chunks section is INCONCLUSIVE — never a vacuous "in no chunk" (review M1)', () => {
    const [[name, map]] = clean();
    for (const chunks of [undefined, null, 'background.js']) {
      expect(rpcWebsocketsViolations([[name, {...map, chunks}]])).toEqual(['INCONCLUSIVE: app.modules.json has no chunks section — whether rpc-websockets is in a chunk is unknown']);
    }
    // Positive control: the same map with its chunks passes.
    expect(rpcWebsocketsViolations([[name, map]])).toEqual([]);
  });

  it('each package carries exactly the page its build’s maps give: a hand edit or a missing copy fails', () => {
    const repo = mkdtempSync(join(tmpdir(), 'licence-gate-'));
    try {
      const root = join(repo, 'extension');
      const out = join(root, 'dist');
      mkdirSync(join(root, 'release'), {recursive: true});
      writeFileSync(join(repo, 'LICENSE'), 'BSL\n');
      writeFileSync(join(root, LICENCE_IDS), '{}\n');
      mkdirSync(join(root, 'public/fonts'), {recursive: true});
      writeFileSync(join(root, FONTS.licence), 'OFL\n');
      for (const d of ['app', 'chrome', 'firefox']) {
        mkdirSync(join(out, d, 'fonts'), {recursive: true});
        for (const f of Object.keys(FONTS.files)) copyFileSync(join(ROOT, 'public/fonts', f), join(out, d, 'fonts', f));
      }
      for (const f of MODULE_MAPS) writeFileSync(join(out, f), JSON.stringify({chunks: {'x.js': ['src/x.ts']}, rendered: {'x.js': {'src/x.ts': 1}}}));
      const page = buildLicencePage(root, out);
      for (const d of ['app', 'chrome', 'firefox']) writeFileSync(join(out, d, 'licenses.html'), page);
      expect(licencePageViolations(root, out)).toEqual([]);
      writeFileSync(join(out, 'chrome', 'licenses.html'), page.replace('BSL', 'MIT'));
      rmSync(join(out, 'firefox', 'licenses.html'));
      expect(licencePageViolations(root, out)).toEqual(["chrome/licenses.html is not the page this build's module maps give — rebuild; never edit it by hand", 'firefox/licenses.html is missing']);
      rmSync(join(out, MODULE_MAPS[1]));
      expect(licencePageViolations(root, out)).toEqual([`INCONCLUSIVE: ${MODULE_MAPS[1]} is missing next to ${join(out, 'app')} — the licence page needs every module map`]);
    } finally {
      rmSync(repo, {recursive: true, force: true});
    }
  });
});

describe('the committed licence inputs (B1e §4.2 items 4–6, E15)', () => {
  it('the owner’s allowlist, exactly', () => {
    expect(ALLOWED_LICENCES).toEqual(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'OFL-1.1', 'Unlicense']);
  });

  it('licence-ids.json has the one row today: text-encoding-utf-8@1.0.2 → Unlicense', () => {
    expect(JSON.parse(readFileSync(join(ROOT, LICENCE_IDS), 'utf8'))).toEqual({'text-encoding-utf-8@1.0.2': 'Unlicense'});
  });

  it('the fonts are geist@1.7.2’s files, and public/fonts/LICENSE.txt is that release’s LICENSE.txt', () => {
    for (const [f, digest] of Object.entries(FONTS.files)) expect([f, sha256(readFileSync(join(ROOT, 'public/fonts', f)))]).toEqual([f, digest]);
    expect(sha256(readFileSync(join(ROOT, FONTS.licence)))).toBe('930853ee1daa68554d9e35c8a9175affb74f699fad9a5da6ee5ebe76379d9137');
  });
});
