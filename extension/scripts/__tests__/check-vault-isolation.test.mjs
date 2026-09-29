import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {
  bundleViolations, htmlViolations, listSourceFiles, manifestViolations, sourceViolations,
  BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, VAULT_MARKER,
} from '../check-vault-isolation.mjs';
import {render} from '../../manifest/source.mjs';

const f = (path, text) => ({path, text});

describe('vault isolation (source)', () => {
  it('allows the vault page and the vault folder to import the vault', () => {
    expect(sourceViolations([
      f('src/unlock/main.ts', "import {workerKdf} from '../vault/kdf';"),
      f('src/vault/reauth.ts', "import {decryptMnemonic} from './envelope';"),
    ])).toEqual([]);
  });

  it('refuses a value import of the vault from the popup or the background', () => {
    expect(sourceViolations([f('src/popup/main.ts', "import {decryptMnemonic} from '../vault/envelope';")])).toHaveLength(1);
    expect(sourceViolations([f('src/background/messages.ts', "import {deriveSessionAccounts} from '../vault/accounts';")])).toHaveLength(1);
  });

  it('allows a type-only import from anywhere', () => {
    expect(sourceViolations([f('src/background/session.ts', "import type {SessionAccount} from '../vault/accounts';")])).toEqual([]);
  });

  it('refuses storage.session outside the background', () => {
    expect(sourceViolations([f('src/unlock/main.ts', 'chrome.storage.session.get("v1_session")')])).toHaveLength(1);
    expect(sourceViolations([f('src/background/session.ts', '// storage.session is memory-only')])).toEqual([]);
  });

  // Controller rulings: every way a module can pull the vault in, not just `import … from`.
  it.each([
    ['a re-export', "export {decryptMnemonic} from '../vault/envelope';"],
    ['a star re-export', "export * from '../vault/envelope';"],
    ['a namespace re-export', "export * as v from '../vault/envelope';"],
    ['a dynamic import', "const m = await import('../vault/envelope');"],
    ['a dynamic import with a template literal', 'const m = await import(`../vault/envelope`);'],
    ['a require', "const m = require('../vault/envelope');"],
    ['a side-effect import', "import '../vault/envelope';"],
    ['a mixed type/value import', "import {type EnvelopeV1, decryptMnemonic} from '../vault/envelope';"],
    ['an inline-type-only import (kept as a side-effect import under verbatimModuleSyntax)', "import {type EnvelopeV1} from '../vault/envelope';"],
    ['a default import', "import envelope from '../vault/envelope';"],
    ['a namespace import', "import * as envelope from '../vault/envelope';"],
    ['a multi-line import', "import {\n  decryptMnemonic,\n  unlockWithPassword,\n} from '../vault/envelope';"],
    ['a worker URL', "new Worker(new URL('../vault/kdf.worker.ts', import.meta.url), {type: 'module'});"],
    ['an import of the folder itself', "import {x} from '../vault';"],
  ])('refuses %s of the vault from the popup', (_, text) => {
    expect(sourceViolations([f('src/popup/main.ts', text)])).toEqual(['src/popup/main.ts: imports the vault']);
  });

  it('refuses a vault import from src/ui/ and from a file at the top of src/', () => {
    expect(sourceViolations([f('src/ui/send.ts', "import {b64} from '../vault/bytes';")])).toHaveLength(1);
    expect(sourceViolations([f('src/ext.ts', "import {b64} from './vault/bytes';")])).toHaveLength(1);
  });

  it('refuses a vault import resolved from a deeper folder', () => {
    expect(sourceViolations([f('src/background/sub/x.ts', "import {b64} from '../../vault/bytes';")])).toHaveLength(1);
  });

  it('allows type-only imports and re-exports from anywhere', () => {
    expect(sourceViolations([
      f('src/popup/main.ts', "import type {EnvelopeV1} from '../vault/envelope';"),
      f('src/popup/types.ts', "export type {EnvelopeV1} from '../vault/envelope';"),
      f('src/background/messages.ts', "import type {\n  SessionAccount,\n} from '../vault/accounts';"),
    ])).toEqual([]);
  });

  it('does not mistake a folder that merely contains "vault" in its name', () => {
    expect(sourceViolations([f('src/popup/main.ts', "import {x} from '../vaultish/x';")])).toEqual([]);
  });

  it('reports each file once per rule even with several vault imports', () => {
    expect(sourceViolations([f('src/popup/main.ts', "import {a} from '../vault/a';\nimport {b} from '../vault/b';")])).toHaveLength(1);
  });

  // Fix round 1: core/keys (mnemonic → seed, SLIP-0010) is the vault's seed code, shared with the app.
  it.each([
    ['a named import', "import {mnemonicToSeed, generateMnemonic} from '../../../core/keys/mnemonic';"],
    ['an import of the folder', "import {x} from '../../../core/keys';"],
    ['a ./-prefixed path', "import {x} from './../../../core/keys/transparent';"],
    ['a dynamic import', "void import('../../../core/keys/mnemonic');"],
    ['a re-export', "export * from '../../../core/keys/mnemonic';"],
    ['a side-effect import', "import '../../../core/keys/mnemonic';"],
    ['a require', "require('../../../core/keys/mnemonic');"],
    ['a mixed type/value import', "import {type X, mnemonicToSeed} from '../../../core/keys/mnemonic';"],
    ['an aliased specifier', "import {x} from '@core/keys/mnemonic';"],
  ])('refuses %s of core/keys from the popup', (_, text) => {
    expect(sourceViolations([f('src/popup/main.ts', text)])).toEqual(['src/popup/main.ts: imports core/keys (seed code)']);
  });

  it('refuses core/keys from the background, ui and ext.ts, resolving from each file', () => {
    expect(sourceViolations([f('src/background/index.ts', "import {deriveTransparentKeypair} from '../../../core/keys/transparent';")])).toHaveLength(1);
    expect(sourceViolations([f('src/ui/x.ts', "import {x} from '../../../core/keys/mnemonic';")])).toHaveLength(1);
    expect(sourceViolations([f('src/ext.ts', "import {x} from '../../core/keys/mnemonic';")])).toHaveLength(1);
  });

  it('allows core/keys in the vault and the vault page, and type-only anywhere', () => {
    expect(sourceViolations([
      f('src/vault/accounts.ts', "import {deriveTransparentKeypair} from '../../../core/keys/transparent';\nimport {mnemonicToSeed} from '../../../core/keys/mnemonic';"),
      f('src/unlock/main.ts', "import {x} from '../../../core/keys/mnemonic';"),
      f('src/popup/main.ts', "import type {X} from '../../../core/keys/mnemonic';"),
    ])).toEqual([]);
  });

  it('does not mistake a path that resolves elsewhere for core/keys', () => {
    expect(sourceViolations([f('src/popup/main.ts', "import {x} from '../../../core/keysmith/x';")])).toEqual([]);
    expect(sourceViolations([f('src/popup/main.ts', "import {x} from '../../../core/util/x';")])).toEqual([]);
  });

  it('refuses storage.session in any spelling outside the background', () => {
    expect(sourceViolations([f('src/popup/main.ts', 'chrome.storage?.session.get(null)')])).toHaveLength(1);
    expect(sourceViolations([f('src/popup/main.ts', "chrome.storage['session'].get(null)")])).toHaveLength(1);
  });

  // src/ext.ts is the one wrapper over chrome.* and so names storage.session; it is allowed to,
  // but then only the background may value-import it — otherwise the popup could reach
  // storage.session through ext.session without ever writing the words.
  it('allows src/ext.ts to name storage.session, and only the background to value-import it', () => {
    expect(sourceViolations([f('src/ext.ts', 'session: kv(b.storage.session),')])).toEqual([]);
    expect(sourceViolations([f('src/background/index.ts', "import {browserExt} from '../ext';")])).toEqual([]);
    expect(sourceViolations([f('src/background/messages.ts', "import type {Ext} from '../ext';")])).toEqual([]);
    expect(sourceViolations([f('src/popup/main.ts', "import {browserExt} from '../ext';")])).toEqual([
      'src/popup/main.ts: imports src/ext.ts (storage.session) outside the background',
    ]);
    expect(sourceViolations([f('src/unlock/main.ts', "import {browserExt} from '../ext';")])).toHaveLength(1);
  });

  // Final review: vault.setKeys goes out via runtime.sendMessage, which every extension page
  // with a runtime.onMessage listener receives — so only the background may listen.
  it.each([
    ['runtime.onMessage', 'chrome.runtime.onMessage.addListener(m => console.log(m));'],
    ['optional-chained runtime.onMessage', 'browser?.runtime?.onMessage?.addListener(m => m);'],
    ['bracketed runtime.onMessage', "chrome.runtime['onMessage'].addListener(m => m);"],
    ['runtime.onConnect', 'chrome.runtime.onConnect.addListener(p => p.onMessage.addListener(m => m));'],
    ['runtime.onMessageExternal', 'chrome.runtime.onMessageExternal.addListener(m => m);'],
    ['runtime.onConnectExternal', 'chrome.runtime.onConnectExternal.addListener(p => p);'],
    ['a destructured listener', 'const {onMessage} = chrome.runtime;\nonMessage.addListener(m => m);'],
  ])('refuses %s outside the background', (_, text) => {
    for (const path of ['src/popup/main.ts', 'src/unlock/main.ts', 'src/vault/reauth.ts', 'src/ui/send.ts', 'src/ext.ts']) {
      expect(sourceViolations([f(path, text)])).toEqual([`${path}: listens for runtime messages outside the background`]);
    }
  });

  it('allows runtime message listeners in the background (positive control)', () => {
    expect(sourceViolations([
      f('src/background/index.ts', 'api.runtime.onMessage.addListener((msg, sender, reply) => true);'),
      f('src/background/sub/port.ts', 'chrome.runtime.onConnect.addListener(p => p);'),
    ])).toEqual([]);
  });

  it('does not mistake a worker onmessage or sendMessage for a runtime listener', () => {
    expect(sourceViolations([
      f('src/vault/kdf.ts', 'worker.onmessage = e => e; worker.postMessage({});'),
      f('src/ui/send.ts', 'chrome.runtime.sendMessage({type: "vault.status"});'),
    ])).toEqual([]);
  });
});

// Fable review (Important 1): a file outside src/ — `extension/leak/prf.ts` — imported the
// passkey module and popup.html loaded it; the source rule never saw it (it walked only src/).
describe('vault isolation (files outside src/, and the vault page as a target)', () => {
  it('refuses the reproduced layout: leak/prf.ts importing ../src/vault/passkey', () => {
    expect(sourceViolations([f('leak/prf.ts', "import {evaluatePrf} from '../src/vault/passkey';")])).toEqual([
      'leak/prf.ts: imports the vault',
    ]);
  });

  it('refuses vault, vault-page and core/keys imports from a file at the package root', () => {
    expect(sourceViolations([f('x.ts', "import {b64} from './src/vault/bytes';")])).toEqual(['x.ts: imports the vault']);
    expect(sourceViolations([f('x.ts', "import {unlockFlow} from './src/unlock/unlockFlow';")])).toEqual([
      'x.ts: imports the vault page (src/unlock)',
    ]);
    expect(sourceViolations([f('x.mjs', "import {mnemonicToSeed} from '../core/keys/mnemonic';")])).toEqual([
      'x.mjs: imports core/keys (seed code)',
    ]);
  });

  it.each([
    ['a named import', "import {unlockFlow} from '../unlock/unlockFlow';"],
    ['a dynamic import', "void import('../unlock/orchestrate');"],
    ['a side-effect import', "import '../unlock/main';"],
    ['an import of the folder', "import {x} from '../unlock';"],
  ])('refuses %s of src/unlock from the popup', (_, text) => {
    expect(sourceViolations([f('src/popup/main.ts', text)])).toEqual(['src/popup/main.ts: imports the vault page (src/unlock)']);
  });

  it('refuses src/unlock from the vault folder and the background, but not from src/unlock itself', () => {
    expect(sourceViolations([f('src/vault/reauth.ts', "import {unlockFlow} from '../unlock/unlockFlow';")])).toHaveLength(1);
    expect(sourceViolations([f('src/background/messages.ts', "import {ENVELOPE_KEY} from '../unlock/unlockFlow';")])).toHaveLength(1);
    expect(sourceViolations([
      f('src/unlock/main.ts', "import {ENVELOPE_KEY, unlockFlow} from './unlockFlow';"),
      f('src/unlock/sub/x.ts', "import {runExclusive} from '../orchestrate';"),
      f('src/popup/main.ts', "import type {Outcome} from '../unlock/orchestrate';"),
    ])).toEqual([]);
  });

  it('does not mistake a folder that merely starts with "unlock"', () => {
    expect(sourceViolations([f('src/popup/main.ts', "import {x} from '../unlockish/x';")])).toEqual([]);
  });
});

describe('vault isolation (HTML entries)', () => {
  const page = (...srcs) => `<!doctype html><html><body>${srcs.map(s => `<script type="module" src="${s}"></script>`).join('')}</body></html>`;

  it('accepts each page loading exactly its own entry (positive control)', () => {
    expect(htmlViolations([
      f('popup.html', page('./src/popup/main.ts')),
      f('unlock.html', page('./src/unlock/main.ts')),
    ])).toEqual([]);
    expect(htmlViolations([f('popup.html', page('/src/popup/main.ts')), f('unlock.html', page('src/unlock/main.ts'))])).toEqual([]);
  });

  it('refuses the reproduced layout: popup.html also loading ./leak/prf.ts', () => {
    expect(htmlViolations([f('popup.html', page('./src/popup/main.ts', './leak/prf.ts'))])).toEqual([
      'popup.html: loads ./leak/prf.ts — only src/popup/main.ts may be its entry',
    ]);
  });

  it('refuses the popup loading the vault page entry, and the vault page loading the popup entry', () => {
    expect(htmlViolations([f('popup.html', page('./src/unlock/main.ts'))])).toHaveLength(1);
    expect(htmlViolations([f('unlock.html', page('./src/popup/main.ts'))])).toHaveLength(1);
  });

  it('refuses a script on a page that has no entry of its own', () => {
    expect(htmlViolations([f('options.html', page('./src/popup/main.ts'))])).toEqual([
      'options.html: loads ./src/popup/main.ts — this page has no entry of its own',
    ]);
  });

  it('refuses an inline script and a script tag whose src it cannot read', () => {
    expect(htmlViolations([f('popup.html', `${page('./src/popup/main.ts')}<script type="module">import '../src/vault/passkey';</script>`)])).toEqual([
      'popup.html: has a <script> without a src',
    ]);
    expect(htmlViolations([f('popup.html', '<script type="module" src=./leak/prf.ts></script>')])).toEqual([
      'popup.html: has a <script> without a src',
    ]);
  });
});

describe('vault isolation (which files the source rule reads)', () => {
  let root;
  const touch = rel => {
    mkdirSync(dirname(join(root, rel)), {recursive: true});
    writeFileSync(join(root, rel), '');
  };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vault-iso-src-'));
  });
  afterEach(() => rmSync(root, {recursive: true, force: true}));

  it('reads every source file under the package except node_modules, dist, tests, e2e and scripts', () => {
    for (const rel of [
      'src/popup/main.ts', 'src/ui/a.tsx', 'leak/prf.ts', 'x.mjs', 'vite.config.ts', 'manifest/source.mjs', 'deep/a/b.js',
      'node_modules/p/index.js', 'dist/app/background.js', 'src/vault/__tests__/a.test.ts', 'e2e/a.spec.ts',
      'scripts/check.mjs', 'popup.html', 'notes.md',
    ]) touch(rel);
    expect(listSourceFiles(root).sort()).toEqual(['deep/a/b.js', 'leak/prf.ts', 'manifest/source.mjs', 'src/popup/main.ts', 'src/ui/a.tsx', 'vite.config.ts', 'x.mjs']);
  });
});

describe('vault isolation (built output)', () => {
  let dir;
  const write = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), {recursive: true});
    writeFileSync(join(dir, rel), text);
  };
  const html = src => `<!doctype html><html><head><script type="module" crossorigin src="${src}"></script></head></html>`;
  // A minimal dist/app shaped like Vite's: background.js at the root, chunks under assets/.
  const baseline = () => {
    write('background.js', 'import{n as e}from"./assets/base-1.js";e();');
    write('assets/base-1.js', 'export const n=()=>1;');
    write('popup.html', html('./assets/popup-1.js'));
    write('assets/popup-1.js', 'import{t as e}from"./send-1.js";e();');
    write('assets/send-1.js', 'export const t=()=>1;');
    write('unlock.html', html('./assets/unlock-1.js'));
    write('assets/unlock-1.js', `import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";`);
    write('assets/kdf.worker-1.js', `throw Error("${KDF_MARKER}");`);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vault-iso-'));
    baseline();
  });
  afterEach(() => rmSync(dir, {recursive: true, force: true}));

  it('passes a dist where only the unlock bundle carries vault code', () => {
    expect(bundleViolations(dir)).toEqual([]);
  });

  it('fails when a static import from the background reaches a chunk with the envelope marker', () => {
    write('assets/base-1.js', `export const n=()=>"${VAULT_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['assets/base-1.js (reachable from background.js) contains vault code (envelope)']);
  });

  it('fails on the derivation marker alone — derivation without the envelope is still the vault', () => {
    write('assets/send-1.js', `export const t=()=>"${DERIVATION_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['assets/send-1.js (reachable from assets/popup-1.js) contains vault code (derivation)']);
  });

  it('fails on the BIP-39 marker alone — mnemonic code without the envelope or derivation', () => {
    write('assets/popup-1.js', `import"./send-1.js";throw TypeError("${BIP39_MARKER}"+typeof e);`);
    expect(bundleViolations(dir)).toEqual(['assets/popup-1.js (reachable from assets/popup-1.js) contains vault code (bip39)']);
  });

  it("follows a dynamic import, including Vite's __vitePreload wrapper", () => {
    write('assets/popup-1.js', 'const m=()=>__vitePreload(()=>import("./lazy-1.js"),[]);');
    write('assets/lazy-1.js', `export const x="${VAULT_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['assets/lazy-1.js (reachable from assets/popup-1.js) contains vault code (envelope)']);
    write('assets/popup-1.js', 'const m=()=>import(`./lazy-1.js`);');
    expect(bundleViolations(dir)).toHaveLength(1);
  });

  it('follows a side-effect import and a worker URL', () => {
    write('background.js', 'import"./assets/side-1.js";');
    write('assets/side-1.js', 'new Worker(new URL(`w-1.js`,import.meta.url),{type:`module`});');
    write('assets/w-1.js', `const k="${DERIVATION_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['assets/w-1.js (reachable from background.js) contains vault code (derivation)']);
  });

  it('resolves ../ and nested paths relative to the importing file', () => {
    write('assets/popup-1.js', 'import"./deep/a-1.js";');
    write('assets/deep/a-1.js', 'import"../../chunks/b-1.js";');
    write('chunks/b-1.js', `const k="${VAULT_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['chunks/b-1.js (reachable from assets/popup-1.js) contains vault code (envelope)']);
  });

  it('resolves a root-absolute path against dist', () => {
    write('popup.html', html('/assets/popup-1.js'));
    write('assets/popup-1.js', `const k="${VAULT_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['assets/popup-1.js (reachable from assets/popup-1.js) contains vault code (envelope)']);
  });

  it('treats every page other than unlock.html as a non-vault entry', () => {
    write('options.html', html('./assets/options-1.js'));
    write('assets/options-1.js', `const k="${VAULT_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['assets/options-1.js (reachable from assets/options-1.js) contains vault code (envelope)']);
  });

  it('does not follow imports out of the unlock bundle (it may carry the vault)', () => {
    write('assets/unlock-1.js', `import"./vault-1.js";`);
    write('assets/vault-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";`);
    expect(bundleViolations(dir)).toEqual([]);
  });

  it('fails closed on an import it cannot resolve', () => {
    write('assets/popup-1.js', 'import"./missing-1.js";');
    expect(bundleViolations(dir)).toEqual(['assets/popup-1.js imports ./missing-1.js, which is not a built file']);
    write('assets/popup-1.js', 'import"../../outside.js";');
    expect(bundleViolations(dir)).toEqual(['assets/popup-1.js imports ../../outside.js, which leaves dist']);
  });

  it('is INCONCLUSIVE — and fails — when any marker is in no built file', () => {
    const all = {i: VAULT_MARKER, d: DERIVATION_MARKER, b: BIP39_MARKER, r: PASSKEY_MARKER};
    const without = k => Object.entries(all).filter(([n]) => n !== k).map(([n, m]) => `const ${n}="${m}";`).join('');
    for (const [k, name, marker] of [['i', 'envelope', VAULT_MARKER], ['d', 'derivation', DERIVATION_MARKER], ['b', 'bip39', BIP39_MARKER], ['r', 'passkey', PASSKEY_MARKER]]) {
      write('assets/unlock-1.js', without(k));
      expect(bundleViolations(dir)).toEqual([`INCONCLUSIVE: the ${name} marker "${marker}" is in no built JS file — the check would pass trivially`]);
    }
    baseline();
    rmSync(join(dir, 'assets/kdf.worker-1.js'));
    expect(bundleViolations(dir)).toEqual([`INCONCLUSIVE: the kdf marker "${KDF_MARKER}" is in no built JS file — the check would pass trivially`]);
  });

  // The built manifest names wallet.noc-tura.io (a host permission): a marker that only a
  // non-JS file carries must not count as present.
  it('does not count a marker found only in a non-JS file (the manifest) as present', () => {
    write('assets/unlock-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";`);
    write('manifest.json', `{"host_permissions":["https://${PASSKEY_MARKER}/*"]}`);
    expect(bundleViolations(dir)).toEqual([`INCONCLUSIVE: the passkey marker "${PASSKEY_MARKER}" is in no built JS file — the check would pass trivially`]);
  });

  it('fails on the passkey marker alone — the reproduced leak split passkey.ts into its own chunk', () => {
    write('popup.html', `${html('./assets/popup-1.js')}${html('./assets/prf-1.js')}`);
    write('assets/prf-1.js', 'import"./passkey-1.js";');
    write('assets/passkey-1.js', `const r="${PASSKEY_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['assets/passkey-1.js (reachable from assets/prf-1.js) contains vault code (passkey)']);
  });

  it('fails on the KDF marker alone — Argon2 outside the vault worker', () => {
    write('background.js', `import"./assets/base-1.js";const k="${KDF_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['background.js (reachable from background.js) contains vault code (kdf)']);
  });

  it('fails when the background or the popup page is missing', () => {
    rmSync(join(dir, 'background.js'));
    expect(bundleViolations(dir)).toEqual(['background.js is missing']);
    baseline();
    rmSync(join(dir, 'popup.html'));
    expect(bundleViolations(dir)).toEqual(['popup.html is missing']);
  });
});

describe('vault isolation (manifest)', () => {
  const withWar = (war, browser = 'chrome') => ({...render(browser), web_accessible_resources: war});

  it('accepts both rendered manifests', () => {
    expect(manifestViolations(render('chrome'))).toEqual([]);
    expect(manifestViolations(render('firefox'))).toEqual([]);
  });

  it.each(['unlock.html', 'popup.html', 'UNLOCK.HTML', 'pages/x.htm', '*', '**/*', '*.html', '*.htm*', 'assets/*', 'unlock.*', '/*', 'unlock.htm?'])(
    'refuses a web-accessible resource that is or could cover a page: %s',
    res => {
      expect(manifestViolations(withWar([{resources: ['icon.png', res], matches: ['<all_urls>']}]))).toEqual([
        `web_accessible_resources exposes "${res}" — a web page could frame the vault page`,
      ]);
    },
  );

  it('refuses an MV2-style string entry that covers a page', () => {
    expect(manifestViolations(withWar(['unlock.html'], 'firefox'))).toHaveLength(1);
  });

  it('allows web-accessible resources that cannot be a page', () => {
    expect(manifestViolations(withWar([{resources: ['icon.png', 'img/*.png', 'fonts/*.woff2'], matches: ['<all_urls>']}]))).toEqual([]);
  });

  it('refuses a web_accessible_resources value of an unexpected shape', () => {
    expect(manifestViolations(withWar({resources: ['icon.png']}))).toEqual(['web_accessible_resources has an unexpected shape']);
    expect(manifestViolations(withWar([{matches: ['<all_urls>']}]))).toEqual(['web_accessible_resources has an unexpected shape']);
  });
});
