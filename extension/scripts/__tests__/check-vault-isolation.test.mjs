import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  bundleViolations, htmlViolations, listSourceFiles, manifestViolations, sourceViolations, vaultPageModuleViolations, vaultPageViolations,
  BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, REACT_MARKER, VAULT_MARKER, WORDLIST_MARKER,
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
    expect(sourceViolations([f('src/app/popup.tsx', "import {decryptMnemonic} from '../vault/envelope';")])).toHaveLength(1);
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
    expect(sourceViolations([f('src/app/popup.tsx', text)])).toEqual(['src/app/popup.tsx: imports the vault']);
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
      f('src/app/popup.tsx', "import type {EnvelopeV1} from '../vault/envelope';"),
      f('src/popup/types.ts', "export type {EnvelopeV1} from '../vault/envelope';"),
      f('src/background/messages.ts', "import type {\n  SessionAccount,\n} from '../vault/accounts';"),
    ])).toEqual([]);
  });

  it('does not mistake a folder that merely contains "vault" in its name', () => {
    expect(sourceViolations([f('src/app/popup.tsx', "import {x} from '../vaultish/x';")])).toEqual([]);
  });

  it('reports each file once per rule even with several vault imports', () => {
    expect(sourceViolations([f('src/app/popup.tsx', "import {a} from '../vault/a';\nimport {b} from '../vault/b';")])).toHaveLength(1);
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
    expect(sourceViolations([f('src/app/popup.tsx', text)])).toEqual(['src/app/popup.tsx: imports core/keys (seed code)']);
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
      f('src/app/popup.tsx', "import type {X} from '../../../core/keys/mnemonic';"),
    ])).toEqual([]);
  });

  it('does not mistake a path that resolves elsewhere for core/keys', () => {
    expect(sourceViolations([f('src/app/popup.tsx', "import {x} from '../../../core/keysmith/x';")])).toEqual([]);
    expect(sourceViolations([f('src/app/popup.tsx', "import {x} from '../../../core/util/x';")])).toEqual([]);
  });

  it('refuses storage.session in any spelling outside the background', () => {
    expect(sourceViolations([f('src/app/popup.tsx', 'chrome.storage?.session.get(null)')])).toHaveLength(1);
    expect(sourceViolations([f('src/app/popup.tsx', "chrome.storage['session'].get(null)")])).toHaveLength(1);
  });

  // src/ext.ts is the one wrapper over chrome.* and so names storage.session; it is allowed to,
  // but then only the background may value-import it — otherwise the popup could reach
  // storage.session through ext.session without ever writing the words.
  it('allows src/ext.ts to name storage.session, and only the background to value-import it', () => {
    expect(sourceViolations([f('src/ext.ts', 'session: kv(b.storage.session),')])).toEqual([]);
    expect(sourceViolations([f('src/background/index.ts', "import {browserExt} from '../ext';")])).toEqual([]);
    expect(sourceViolations([f('src/background/messages.ts', "import type {Ext} from '../ext';")])).toEqual([]);
    expect(sourceViolations([f('src/app/popup.tsx', "import {browserExt} from '../ext';")])).toEqual([
      'src/app/popup.tsx: imports src/ext.ts (storage.session) outside the background',
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
    for (const path of ['src/app/popup.tsx', 'src/unlock/main.ts', 'src/vault/reauth.ts', 'src/ui/send.ts', 'src/ext.ts']) {
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
    expect(sourceViolations([f('src/app/popup.tsx', text)])).toEqual(['src/app/popup.tsx: imports the vault page (src/unlock)']);
  });

  it('refuses src/unlock from the vault folder and the background, but not from src/unlock itself', () => {
    expect(sourceViolations([f('src/vault/reauth.ts', "import {unlockFlow} from '../unlock/unlockFlow';")])).toHaveLength(1);
    expect(sourceViolations([f('src/background/messages.ts', "import {ENVELOPE_KEY} from '../unlock/unlockFlow';")])).toHaveLength(1);
    expect(sourceViolations([
      f('src/unlock/main.ts', "import {ENVELOPE_KEY, unlockFlow} from './unlockFlow';"),
      f('src/unlock/sub/x.ts', "import {runExclusive} from '../orchestrate';"),
      f('src/app/popup.tsx', "import type {Outcome} from '../unlock/orchestrate';"),
    ])).toEqual([]);
  });

  it('does not mistake a folder that merely starts with "unlock"', () => {
    expect(sourceViolations([f('src/app/popup.tsx', "import {x} from '../unlockish/x';")])).toEqual([]);
  });
});

// Fable review (Minor 6): the storage.session rule matched `storage.session` / `storage['session']`
// only, so destructuring walked past it. Now no file outside src/ext.ts and the background may
// name `storage` as a property or destructuring key at all; the vault page reads storage.local
// through src/shared/readLocal.ts (final review minor 4: no longer an ext.ts export).
describe('vault isolation (storage, and what may import src/ext.ts)', () => {
  const STORAGE = path => `${path}: touches storage outside src/ext.ts and the background`;

  it.each([
    ['destructured session', 'const {session} = chrome.storage;\nsession.get(null);'],
    ['nested destructuring', 'const {storage: {session: s}} = chrome;\ns.get(null);'],
    ['nested destructuring without spaces', 'const {storage:{session:s}} = chrome;'],
    ['a destructured storage used for local', "const {storage} = browser;\nstorage.local.get('v1_vault');"],
    ['a destructured storage among other keys', 'const {runtime, storage} = chrome;'],
    ['a destructuring default', 'const {storage = null} = chrome;'],
    ['storage.local', "chrome.storage.local.get('v1_vault');"],
    ['optional-chained storage', 'chrome?.storage?.local.get(null);'],
    ['bracketed storage', "chrome['storage'].local.get(null);"],
    ['storage.session (still)', 'chrome.storage.session.get(null);'],
  ])('refuses %s outside ext.ts and the background', (_, text) => {
    for (const path of ['src/app/popup.tsx', 'src/unlock/main.ts', 'src/vault/reauth.ts', 'src/ui/send.ts', 'leak/x.ts']) {
      expect(sourceViolations([f(path, text)])).toEqual([STORAGE(path)]);
    }
  });

  it('allows storage in src/ext.ts and the background (positive control)', () => {
    expect(sourceViolations([
      f('src/ext.ts', 'const {session} = b.storage;\nconst {storage: {local}} = b;'),
      f('src/background/x.ts', 'const {storage} = chrome;\nstorage.session.get(null);'),
    ])).toEqual([]);
  });

  it('does not mistake localStorage, sessionStorage or prose for the extension storage API', () => {
    expect(sourceViolations([
      f('src/app/popup.tsx', "localStorage.getItem('x'); sessionStorage.clear();\n// the vault is kept in local storage, keys in session storage"),
    ])).toEqual([]);
  });

  // Final review minor 4: readLocal lived in src/ext.ts, so the vault page's bundle carried ext.ts
  // (storage.session, setAccessLevel) in a shared chunk. It now has its own module; the vault page
  // may import nothing at all from src/ext.ts.
  it('refuses every import of src/ext.ts from the vault page, readLocal included', () => {
    const EXT = path => `${path}: imports src/ext.ts (storage.session) outside the background`;
    for (const text of [
      "import {readLocal} from '../ext';",
      "import {type Ext, readLocal as read} from '../ext';",
      "import {readLocal, browserExt} from '../ext';",
      "import * as ext from '../ext';",
      "import ext from '../ext';",
      "import '../ext';",
      "const m = await import('../ext');",
      "export {readLocal} from '../ext';",
    ]) {
      expect(sourceViolations([f('src/unlock/main.ts', text)])).toEqual([EXT('src/unlock/main.ts')]);
    }
    expect(sourceViolations([f('src/unlock/types.ts', "import type {Ext} from '../ext';")])).toEqual([]);
  });

  it('lets only the vault page import src/shared/readLocal', () => {
    expect(sourceViolations([
      f('src/unlock/main.ts', "import {readLocal} from '../shared/readLocal';"),
      f('src/unlock/modes.ts', "import {readLocal as read} from '../shared/readLocal.ts';"),
    ])).toEqual([]);
    const READER = path => `${path}: imports src/shared/readLocal, the vault page's storage reader`;
    for (const [path, text] of [
      ['src/app/popup.tsx', "import {readLocal} from '../shared/readLocal';"],
      ['src/background/x.ts', "import {readLocal} from '../shared/readLocal';"],
      ['src/ui/send.ts', "const m = await import('../shared/readLocal');"],
      ['src/shared/other.ts', "export {readLocal} from './readLocal';"],
    ]) {
      expect(sourceViolations([f(path, text)])).toEqual([READER(path)]);
    }
  });

  it('src/shared/readLocal.ts may read storage.local — and not touch storage.session, write, or import anything', () => {
    const P = 'src/shared/readLocal.ts';
    expect(sourceViolations([f(P, "const b = g.browser ?? g.chrome;\nreturn (await b.storage.local.get(key))[key];")])).toEqual([]);
    expect(sourceViolations([f(P, 'b.storage.session.get(null);')])).toEqual([`${P}: touches storage.session — it may read storage.local only`]);
    expect(sourceViolations([f(P, "b.storage['session'].get(null);")])).toEqual([`${P}: touches storage.session — it may read storage.local only`]);
    for (const text of ["b.storage.local.set({v1_vault: e});", "b.storage.local.remove('v1_vault');", 'b.storage.local.clear();', "b.storage.local['set']({});", 'const {set} = b.storage.local;']) {
      expect(sourceViolations([f(P, text)])).toEqual([`${P}: writes storage — it may only read`]);
    }
    for (const text of ["import {x} from './envelopeRules';", "import '@noble/hashes/sha2.js';", "const m = await import('../ext');"]) {
      expect(sourceViolations([f(P, text)]).some(v => v === `${P}: imports a module — it must stand alone`)).toBe(true);
    }
    expect(sourceViolations([f(P, "import type {X} from './types';")])).toEqual([]);
  });

  // B1b-1 ruling: v1_vault has ONE writer, the background (storage.local has no compare-and-set
  // across contexts); the vault page hands it the envelope by message. So the vault page gets no
  // storage writer: not a writeLocal from ext.ts, not storage.local itself.
  it('does not let the vault page write storage.local — by any ext.ts export or by the storage API', () => {
    const EXT = path => `${path}: imports src/ext.ts (storage.session) outside the background`;
    for (const text of [
      "import {writeLocal} from '../ext';",
      "import {readLocal, writeLocal} from '../ext';",
      "import {writeLocal as write} from '../ext';",
      "import {browserExt} from '../ext';\nbrowserExt().local.set('v1_vault', env);",
    ]) {
      expect(sourceViolations([f('src/unlock/onboarding.ts', text)])).toEqual([EXT('src/unlock/onboarding.ts')]);
    }
    const STORAGE = path => `${path}: touches storage outside src/ext.ts and the background`;
    for (const text of [
      'chrome.storage.local.set({v1_vault: env});',
      'browser.storage.local.set({v1_vault: env});',
      "const {storage} = chrome;\nstorage.local.set({v1_vault: env});",
    ]) {
      expect(sourceViolations([f('src/unlock/onboarding.ts', text)])).toEqual([STORAGE('src/unlock/onboarding.ts')]);
    }
    expect(sourceViolations([f('src/unlock/onboarding.ts', "import {readLocal} from '../shared/readLocal';\nawait readLocal('v1_vault');")])).toEqual([]);
  });
  // Fix round 1: src/shared/ holds what both sides of the envelope need (the revision, the bounds);
  // it is neither vault nor vault page, so the background, the vault page and the popup may import it.
  it('lets the background, the vault page and the popup import src/shared/', () => {
    expect(sourceViolations([
      f('src/background/accountsStore.ts', "import {envelopeRevision} from '../shared/envelopeRevision';\nimport {MAX_ACCOUNTS} from '../shared/envelopeRules';"),
      f('src/unlock/accountsFlow.ts', "import {envelopeRevision} from '../shared/envelopeRevision';"),
      f('src/vault/envelope.ts', "import {MAX_ACCOUNTS, cleanName} from '../shared/envelopeRules';"),
      f('src/app/popup.tsx', "import {cleanName} from '../shared/envelopeRules';"),
      f('src/shared/envelopeRevision.ts', "import {sha256} from '@noble/hashes/sha2.js';"),
    ])).toEqual([]);
    // …and src/shared/ itself is held to the same rules: it may not reach into the vault.
    expect(sourceViolations([f('src/shared/x.ts', "import {decryptMnemonic} from '../vault/envelope';")])).toEqual(['src/shared/x.ts: imports the vault']);
  });
  // B1b-1: storage.local keys only the background writes. No other file may even name them — a
  // popup writing v1_settings could undo a re-authenticated setting without re-authenticating.
  it('lets only the background name the background-owned storage keys', () => {
    const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
    expect(sourceViolations([
      f('src/background/settings.ts', "export const SETTINGS_KEY = 'v1_settings';"),
      f('src/background/knownRecipients.ts', "export const KNOWN_RECIPIENTS_KEY = 'v1_known_recipients';"),
    ])).toEqual([]);
    expect(sourceViolations([f('src/app/popup.tsx', "chrome.runtime.sendMessage({type: 'x', key: 'v1_settings'});")])).toEqual([OWNED('src/app/popup.tsx', 'v1_settings')]);
    expect(sourceViolations([f('src/unlock/main.ts', '// v1_known_recipients')])).toEqual([OWNED('src/unlock/main.ts', 'v1_known_recipients')]);
    expect(sourceViolations([f('src/ext.ts', "const k = 'v1_settings';")])).toEqual([OWNED('src/ext.ts', 'v1_settings')]);
    expect(sourceViolations([f('src/app/popup.tsx', "const p = 'v1_pending'; const f = 'v1_forbidden_until';")])).toEqual([
      OWNED('src/app/popup.tsx', 'v1_pending'),
      OWNED('src/app/popup.tsx', 'v1_forbidden_until'),
    ]);
  });
  // B1b-2a E4: the balance and price caches are the background's too.
  it('lets only the background name the two cache keys', () => {
    const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
    expect(sourceViolations([f('src/background/balanceCache.ts', "export const BALANCE_CACHE_KEY = 'v1_balance_cache'; export const P = 'v1_price_cache';")])).toEqual([]);
    expect(sourceViolations([f('src/app/screens/Home.tsx', "const k = 'v1_balance_cache';")])).toEqual([OWNED('src/app/screens/Home.tsx', 'v1_balance_cache')]);
    expect(sourceViolations([f('src/app/popup.tsx', "const k = 'v1_price_cache';")])).toEqual([OWNED('src/app/popup.tsx', 'v1_price_cache')]);
  });
});

describe('vault isolation (HTML entries)', () => {
  const page = (...srcs) => `<!doctype html><html><body>${srcs.map(s => `<script type="module" src="${s}"></script>`).join('')}</body></html>`;

  it('accepts each page loading exactly its own entry (positive control)', () => {
    expect(htmlViolations([
      f('popup.html', page('./src/app/popup.tsx')),
      f('unlock.html', page('./src/unlock/main.ts')),
    ])).toEqual([]);
    expect(htmlViolations([f('popup.html', page('/src/app/popup.tsx')), f('unlock.html', page('src/unlock/main.ts'))])).toEqual([]);
  });

  // B1b-2a: wallet.html is a third entry, the UI tab; it may load only src/app/tab.tsx.
  it('holds wallet.html to its own entry', () => {
    expect(htmlViolations([f('wallet.html', page('./src/app/tab.tsx'))])).toEqual([]);
    expect(htmlViolations([f('wallet.html', page('./src/unlock/main.ts'))])).toEqual(['wallet.html: loads ./src/unlock/main.ts — only src/app/tab.tsx may be its entry']);
  });

  it('refuses the reproduced layout: popup.html also loading ./leak/prf.ts', () => {
    expect(htmlViolations([f('popup.html', page('./src/app/popup.tsx', './leak/prf.ts'))])).toEqual([
      'popup.html: loads ./leak/prf.ts — only src/app/popup.tsx may be its entry',
    ]);
  });

  it('refuses the popup loading the vault page entry, and the vault page loading the popup entry', () => {
    expect(htmlViolations([f('popup.html', page('./src/unlock/main.ts'))])).toHaveLength(1);
    expect(htmlViolations([f('unlock.html', page('./src/app/popup.tsx'))])).toHaveLength(1);
  });

  it('refuses a script on a page that has no entry of its own', () => {
    expect(htmlViolations([f('options.html', page('./src/app/popup.tsx'))])).toEqual([
      'options.html: loads ./src/app/popup.tsx — this page has no entry of its own',
    ]);
  });

  it('refuses an inline script and a script tag whose src it cannot read', () => {
    expect(htmlViolations([f('popup.html', `${page('./src/app/popup.tsx')}<script type="module">import '../src/vault/passkey';</script>`)])).toEqual([
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
      'src/app/popup.tsx', 'src/ui/a.tsx', 'leak/prf.ts', 'x.mjs', 'vite.config.ts', 'manifest/source.mjs', 'deep/a/b.js',
      'node_modules/p/index.js', 'dist/app/background.js', 'src/vault/__tests__/a.test.ts', 'e2e/a.spec.ts',
      'scripts/check.mjs', 'popup.html', 'notes.md',
    ]) touch(rel);
    expect(listSourceFiles(root).sort()).toEqual(['deep/a/b.js', 'leak/prf.ts', 'manifest/source.mjs', 'src/app/popup.tsx', 'src/ui/a.tsx', 'vite.config.ts', 'x.mjs']);
  });

  // Fable re-review: SKIP_DIRS (node_modules, dist, e2e, scripts) must only apply at the
  // package root — a nested src/popup/scripts/ is ordinary source, not build tooling — and the
  // extension list must cover .mts/.cts/.cjs/.jsx too, not just .ts/.tsx/.js/.mjs.
  it('reads .mts files, and does not skip a nested scripts/ folder (only the root one)', () => {
    for (const rel of [
      'src/popup/leak.mts', 'src/popup/scripts/leak.ts', 'scripts/check.mjs', 'src/vault/__tests__/a.test.ts',
    ]) touch(rel);
    expect(listSourceFiles(root).sort()).toEqual(['src/popup/leak.mts', 'src/popup/scripts/leak.ts']);
  });

  it('a vault import from src/popup/leak.mts or src/popup/scripts/leak.ts is a source violation', () => {
    const files = [
      {path: 'src/popup/leak.mts', text: "import {decryptMnemonic} from '../vault/envelope';"},
      {path: 'src/popup/scripts/leak.ts', text: "import {decryptMnemonic} from '../../vault/envelope';"},
    ];
    expect(sourceViolations(files)).toEqual([
      'src/popup/leak.mts: imports the vault',
      'src/popup/scripts/leak.ts: imports the vault',
    ]);
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
    write('background.js', 'import{n as e}from"./assets/base-1.js";import"./assets/session-1.js";e();');
    write('assets/base-1.js', 'export const n=()=>1;');
    // ext.ts as Vite emits it: storage.session and its access pin, in a chunk only the background loads.
    write('assets/session-1.js', 'export const s=r=>({session:r.storage.session,pin:()=>r.storage.session.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"})});');
    write('popup.html', html('./assets/popup-1.js'));
    write('assets/popup-1.js', 'import{t as e}from"./send-1.js";e();');
    // The popup bundles React (B1b-2a): its internal marker is in some built file, as in a real build.
    write('assets/react-1.js', `export const R="${REACT_MARKER}";`);
    write('assets/send-1.js', 'export const t=()=>1;');
    write('unlock.html', html('./assets/unlock-1.js'));
    write('assets/unlock-1.js', `import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
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

  // B1b-2a S1 / §1.2: React never reaches the vault page, and the marker proves the check is live.
  it('fails when a chunk the vault page loads carries React', () => {
    write('assets/base-1.js', `export const n=()=>"${REACT_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['assets/base-1.js (reachable from unlock.html) contains React — the vault page must stay plain DOM']);
  });

  // Task 5 review I2: the source rule reads spellings; the built chunks the vault page loads are the
  // backstop (a minifier folds `'inner' + 'HTML'` back into the name).
  it.each([
    ['e.innerHTML=t', 'innerHTML'],
    ['e.insertAdjacentHTML("beforeend",t)', 'insertAdjacentHTML'],
    ['new DOMParser', 'DOMParser'],
    ['e.setHTMLUnsafe(t)', 'setHTMLUnsafe'],
    ['Document.parseHTMLUnsafe(t)', 'parseHTMLUnsafe'],
    ['e.srcdoc=t', 'srcdoc'],
    ['document.execCommand("insertHTML",!1,t)', 'execCommand'],
    ['r.writeln(t)', '.writeln('],
    ['document["write"](t)', '["write"]'],
    // Fix round 2.
    ['e.responseType="document"', 'responseType'],
    ['new Blob([t],{type:"text/html"})', 'text/html'],
    ['URL.createObjectURL(t)', 'createObjectURL'],
    // Fix round 3 (N2): how Vite starts an inline worker (`?worker&inline`), which the module map cannot
    // tie to the vault page — this name is the incidental backstop.
    ['new Worker(URL.createObjectURL(new Blob([atob(t)],{type:"text/javascript;charset=utf-8"})))', 'createObjectURL'],
  ])('fails when a chunk the vault page loads names a markup sink: %s', (code, sink) => {
    write('assets/base-1.js', `export const n=(e,t)=>{${code}};`);
    expect(bundleViolations(dir)).toEqual([`assets/base-1.js (reachable from unlock.html) names a markup sink (${sink}) — the vault page sets text only`]);
  });

  it.each([
    ['const d=Object.defineProperty;d(e,t,{set:n})', 'defineProperty'],
    ['Object.defineProperty(e,t,{set:n})', 'defineProperty'],
    ['Object.getOwnPropertyDescriptor(Element.prototype,t)', 'getOwnPropertyDescriptor'],
    ['Object.getOwnPropertyDescriptors(e)', 'getOwnPropertyDescriptors'],
    ['Object.defineProperties(e,t)', 'defineProperties'],
    ['e.__lookupSetter__(t)', '__lookupSetter__'],
  ])('fails when a chunk the vault page loads uses reflection by a computed name: %s', (code, name) => {
    write('assets/base-1.js', `export const n=(e,t,n)=>{${code}};`);
    expect(bundleViolations(dir)).toEqual([`assets/base-1.js (reachable from unlock.html) uses reflection by a computed name (${name}) — the vault page sets text only`]);
  });

  it('reflection with one literal, non-sink name is allowed — @noble/curves’ Field does it (negative control)', () => {
    write('assets/base-1.js', 'export const n=function(t){Object.defineProperty(this,"sqrt",{value:t.sqrt,enumerable:!0})};');
    expect(bundleViolations(dir)).toEqual([]);
  });

  it('a markup sink in a chunk only the popup loads is not the vault page’s (negative control)', () => {
    write('assets/send-1.js', 'export const t=e=>{e.innerHTML="";return 1};');
    expect(bundleViolations(dir)).toEqual([]);
  });

  // Fix round 2: the authoritative backstop — what the bundler itself says each chunk carries.
  // The map's shape (vite.config.ts): chunks, the stylesheets each chunk loads, what each stylesheet was
  // built from, and each sheet's raw @import/url() targets.
  const MAP = () => ({
    chunks: {
      'assets/unlock-1.js': ['../core/keys/mnemonic.ts', 'node_modules/@scure/bip39/index.js', 'src/unlock/main.ts', 'src/unlock/unlock.css', 'src/vault/envelope.ts', 'unlock.html'],
      'assets/base-1.js': ['../web/src/styles/design-system.css', 'node_modules/@scure/base/index.js', 'src/styles/design-ext.css'],
      'assets/popup-1.js': ['src/app/popup.tsx', 'node_modules/react/index.js', 'src/app/app.css'],
    },
    chunkCss: {'assets/unlock-1.js': ['assets/unlock-1.css'], 'assets/base-1.js': ['assets/base-1.css'], 'assets/popup-1.js': ['assets/popup-1.css']},
    css: {
      'assets/unlock-1.css': ['src/unlock/unlock.css'],
      'assets/base-1.css': ['../web/src/styles/design-system.css', 'src/styles/design-ext.css'],
      'assets/popup-1.css': ['src/app/app.css'],
    },
    cssRefs: {
      '../web/src/styles/design-system.css': {imports: [], urls: ['/fonts/Geist-Variable.woff2', '/fonts/GeistMono-Variable.woff2']},
      'src/styles/design-ext.css': {imports: [], urls: []},
      'src/unlock/unlock.css': {imports: [], urls: []},
      'src/app/app.css': {imports: [], urls: []},
    },
  });
  const sheets = () => {
    write('assets/unlock-1.css', '[hidden]{display:none!important}');
    write('assets/base-1.css', '@font-face{src:url(../fonts/Geist-Variable.woff2)format("woff2")}@font-face{src:url(../fonts/GeistMono-Variable.woff2)}');
    write('assets/popup-1.css', '.x{background:url(data:image/png;base64,AA)}');
  };
  it('passes when every module of every chunk the vault page loads is vault-page code or one of its packages', () => {
    sheets();
    expect(vaultPageModuleViolations(dir, MAP())).toEqual([]);
  });

  it.each([
    ['src/app/engine.ts', 'assets/unlock-1.js'],
    ['src/app/engine.ts?v', 'assets/unlock-1.js'],
    ['../web/src/ui/AddressGroups.tsx', 'assets/base-1.js'],
    ['node_modules/react/index.js', 'assets/base-1.js'],
    ['node_modules/@scure/base/node_modules/evil/index.js', 'assets/base-1.js'],
    ['node_modules/@solana/web3.js/lib/index.browser.esm.js', 'assets/unlock-1.js'],
    ['\0virtual:app', 'assets/unlock-1.js'],
  ])('fails when a chunk the vault page loads carries %s', (id, chunk) => {
    sheets();
    const map = MAP();
    map.chunks[chunk] = [...map.chunks[chunk], id];
    expect(vaultPageModuleViolations(dir, map)).toEqual([`${chunk} (reachable from unlock.html) carries ${JSON.stringify(id)} — only vault-page code and its five packages may be bundled with the seed`]);
  });

  it('fails a reachable chunk missing from the map, a missing map, and a map that does not describe the vault page', () => {
    sheets();
    const map = MAP();
    delete map.chunks['assets/base-1.js'];
    delete map.chunkCss['assets/base-1.js'];
    expect(vaultPageModuleViolations(dir, map)).toEqual([
      'assets/base-1.js (reachable from unlock.html) is not in the chunk module map — what it carries is unknown',
      "INCONCLUSIVE: no stylesheet unlock.html loads is built from ../web/src/styles/design-system.css — the map does not describe the vault page's styles",
      "INCONCLUSIVE: no stylesheet unlock.html loads is built from src/styles/design-ext.css — the map does not describe the vault page's styles",
    ]);
    const NO_MAP = 'INCONCLUSIVE: no chunk module map (app.modules.json next to dist/app, with chunks, css, chunkCss and cssRefs) — the build must write one';
    expect(vaultPageModuleViolations(dir, undefined)).toEqual([NO_MAP]);
    // The round-2 shape (chunks only) is not a map of the styles: refused, not read as an empty one.
    expect(vaultPageModuleViolations(dir, MAP().chunks)).toEqual([NO_MAP]);
    const empty = MAP();
    empty.chunks['assets/unlock-1.js'] = ['unlock.html'];
    expect(vaultPageModuleViolations(dir, empty)).toEqual(['INCONCLUSIVE: no chunk reachable from unlock.html carries src/unlock/main.ts in the module map — the check would pass trivially']);
  });

  it('UI code in a chunk only the popup loads is not the vault page’s (negative control)', () => {
    sheets();
    const map = MAP();
    map.chunks['assets/popup-1.js'].push('src/app/engine.ts');
    map.cssRefs['src/app/app.css'] = {imports: ['./more.css'], urls: ['https://example.invalid/x.png']};
    expect(vaultPageModuleViolations(dir, map)).toEqual([]);
  });

  // Fix round 3 (N1): what the vault page's stylesheets were built from, and what they load.
  it.each([
    ['a stylesheet built from app.css', m => m.css['assets/unlock-1.css'].push('src/app/app.css'), [
      'assets/unlock-1.css (loaded by unlock.html) is built from "src/app/app.css" — only ../web/src/styles/design-system.css, src/styles/design-ext.css, src/unlock/unlock.css may style the vault page',
    ]],
    ['a new src/styles/zz.css', m => {
      m.css['assets/unlock-1.css'].push('src/styles/zz.css');
      m.cssRefs['src/styles/zz.css'] = {imports: [], urls: []};
    }, ['assets/unlock-1.css (loaded by unlock.html) is built from "src/styles/zz.css" — only ../web/src/styles/design-system.css, src/styles/design-ext.css, src/unlock/unlock.css may style the vault page']],
    ['an @import in unlock.css (inlined: app.css is no module of its own)', m => {
      m.cssRefs['src/unlock/unlock.css'].imports.push('../app/app.css');
    }, ['assets/unlock-1.css (loaded by unlock.html): src/unlock/unlock.css @imports ../app/app.css — the vault page\'s sheets import nothing']],
    ['a non-font url() in unlock.css', m => {
      m.cssRefs['src/unlock/unlock.css'].urls.push('https://example.invalid/a');
    }, ['assets/unlock-1.css (loaded by unlock.html): src/unlock/unlock.css loads url(https://example.invalid/a) — only the bundled Geist faces may be loaded']],
    ['a font url() outside design-system.css', m => {
      m.cssRefs['src/styles/design-ext.css'].urls.push('/fonts/Geist-Variable.woff2');
    }, ['assets/base-1.css (loaded by unlock.html): src/styles/design-ext.css loads url(/fonts/Geist-Variable.woff2) — only the bundled Geist faces may be loaded']],
    ['a sheet with no source record', m => {
      delete m.cssRefs['src/unlock/unlock.css'];
    }, ['assets/unlock-1.css (loaded by unlock.html): no source record for src/unlock/unlock.css — what it imports is unknown']],
    ['a stylesheet missing from the map', m => {
      delete m.css['assets/unlock-1.css'];
    }, [
      'assets/unlock-1.css (loaded by unlock.html) is not in the module map — what it was built from is unknown',
      "INCONCLUSIVE: no stylesheet unlock.html loads is built from src/unlock/unlock.css — the map does not describe the vault page's styles",
    ]],
  ])('fails %s', (_name, change, expected) => {
    sheets();
    const map = MAP();
    change(map);
    expect(vaultPageModuleViolations(dir, map)).toEqual(expected);
  });

  it('checks the built text of the vault page’s stylesheets too: @import, and a url() that is not a Geist face', () => {
    sheets();
    write('assets/unlock-1.css', '@import url(https://example.invalid/x.css);input[value^="a"]{background:url(https://example.invalid/a)}');
    expect(vaultPageModuleViolations(dir, MAP())).toEqual([
      'assets/unlock-1.css (loaded by unlock.html) contains @import',
      'assets/unlock-1.css (loaded by unlock.html) loads url(https://example.invalid/x.css) — only the bundled Geist faces may be loaded',
      'assets/unlock-1.css (loaded by unlock.html) loads url(https://example.invalid/a) — only the bundled Geist faces may be loaded',
    ]);
  });

  it('a stylesheet unlock.html links directly is checked as well', () => {
    sheets();
    write('unlock.html', '<!doctype html><html><head><link rel="stylesheet" href="./assets/extra-1.css"><script type="module" crossorigin src="./assets/unlock-1.js"></script></head></html>');
    write('assets/extra-1.css', '.x{}');
    const map = MAP();
    map.css['assets/extra-1.css'] = ['src/app/app.css'];
    expect(vaultPageModuleViolations(dir, map)).toEqual([
      'assets/extra-1.css (loaded by unlock.html) is built from "src/app/app.css" — only ../web/src/styles/design-system.css, src/styles/design-ext.css, src/unlock/unlock.css may style the vault page',
    ]);
  });

  it('is INCONCLUSIVE — a failure — when no built file carries the React 18 marker (React upgraded or gone)', () => {
    write('assets/react-1.js', 'export const R="__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE";');
    expect(bundleViolations(dir)).toEqual([
      `INCONCLUSIVE: the React marker "${REACT_MARKER}" is in no built JS file — React 19 renamed it: update REACT_MARKER, or the no-React-in-the-vault-page rule passes trivially`,
    ]);
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
    write('assets/vault-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
    expect(bundleViolations(dir)).toEqual([]);
  });

  it('fails when the vault page imports the background entry, directly or through a chunk (it would run the background)', () => {
    write('assets/unlock-1.js', `import{t as x}from"../background.js";import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
    // …and through it the background's storage.session chunk (the rule below).
    const viaBackground = 'assets/session-1.js (reachable from unlock.html) touches storage.session — only the background may';
    expect(bundleViolations(dir)).toEqual(['the vault page (assets/unlock-1.js) reaches background.js — it would run the background', viaBackground]);
    write('assets/unlock-1.js', `import"./mid-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
    write('assets/mid-1.js', 'import"../background.js";');
    expect(bundleViolations(dir)).toEqual(['the vault page (assets/unlock-1.js) reaches background.js — it would run the background', viaBackground]);
  });

  it('fails closed on an import it cannot resolve', () => {
    write('assets/popup-1.js', 'import"./missing-1.js";');
    expect(bundleViolations(dir)).toEqual(['assets/popup-1.js imports ./missing-1.js, which is not a built file']);
    write('assets/popup-1.js', 'import"../../outside.js";');
    expect(bundleViolations(dir)).toEqual(['assets/popup-1.js imports ../../outside.js, which leaves dist']);
  });

  it('is INCONCLUSIVE — and fails — when any marker is in no built file', () => {
    const all = {i: VAULT_MARKER, d: DERIVATION_MARKER, b: BIP39_MARKER, r: PASSKEY_MARKER, w: WORDLIST_MARKER};
    const without = k => Object.entries(all).filter(([n]) => n !== k).map(([n, m]) => `const ${n}=\`${m}\`;`).join('');
    for (const [k, name, marker] of [['i', 'envelope', VAULT_MARKER], ['d', 'derivation', DERIVATION_MARKER], ['b', 'bip39', BIP39_MARKER], ['r', 'passkey', PASSKEY_MARKER], ['w', 'wordlist', WORDLIST_MARKER]]) {
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
    write('assets/unlock-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const w=\`${WORDLIST_MARKER}\`;`);
    write('manifest.json', `{"host_permissions":["https://${PASSKEY_MARKER}/*"]}`);
    expect(bundleViolations(dir)).toEqual([`INCONCLUSIVE: the passkey marker "${PASSKEY_MARKER}" is in no built JS file — the check would pass trivially`]);
  });

  it('fails on the passkey marker alone — the reproduced leak split passkey.ts into its own chunk', () => {
    write('popup.html', `${html('./assets/popup-1.js')}${html('./assets/prf-1.js')}`);
    write('assets/prf-1.js', 'import"./passkey-1.js";');
    write('assets/passkey-1.js', `const r="${PASSKEY_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['assets/passkey-1.js (reachable from assets/prf-1.js) contains vault code (passkey)']);
  });

  it('fails on the wordlist marker alone — generateMnemonic outside the vault page', () => {
    write('assets/send-1.js', `export const words=\`${WORDLIST_MARKER}\`;`);
    expect(bundleViolations(dir)).toEqual(['assets/send-1.js (reachable from assets/popup-1.js) contains vault code (wordlist)']);
  });

  it('the wordlist marker is how the real build spells the list: a template literal with newlines', () => {
    expect(WORDLIST_MARKER).toBe('abandon\nability\nable\nabout');
  });

  it('fails on the KDF marker alone — Argon2 outside the vault worker', () => {
    write('background.js', `import"./assets/base-1.js";const k="${KDF_MARKER}";`);
    expect(bundleViolations(dir)).toEqual(['background.js (reachable from background.js) contains vault code (kdf)']);
  });

  // Final review minor 4: readLocal lived in src/ext.ts, so the vault page's bundle carried the
  // whole of ext.ts (storage.session, setAccessLevel) in a shared chunk — every source rule passed.
  const UNLOCK_MARKERS = `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";const b="${BIP39_MARKER}";const r="${PASSKEY_MARKER}";const w=\`${WORDLIST_MARKER}\`;`;
  const SESSION = (file, from) => `${file} (reachable from ${from}) touches storage.session — only the background may`;

  it('fails when the vault page reaches storage.session — the old layout: ext.ts in a shared chunk', () => {
    write('assets/unlock-1.js', `import"./base-1.js";import{s}from"./session-1.js";${UNLOCK_MARKERS}`);
    expect(bundleViolations(dir)).toEqual([SESSION('assets/session-1.js', 'unlock.html')]);
  });

  it('fails on each spelling: storage.session, storage["session"], setAccessLevel — and from the popup too', () => {
    for (const text of ['export const s=r=>r.storage.session;', 'export const s=r=>r.storage["session"];', 'export const s=r=>r.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"});']) {
      write('assets/mid-1.js', text);
      write('assets/unlock-1.js', `import"./mid-1.js";${UNLOCK_MARKERS}`);
      expect(bundleViolations(dir)).toEqual([SESSION('assets/mid-1.js', 'unlock.html')]);
      baseline();
    }
    write('assets/send-1.js', 'export const t=r=>r.storage.session;');
    expect(bundleViolations(dir)).toEqual([SESSION('assets/send-1.js', 'popup.html')]);
  });

  it('is INCONCLUSIVE when no built JS names storage.session — the rule would pass trivially', () => {
    rmSync(join(dir, 'assets/session-1.js'));
    write('background.js', 'import{n as e}from"./assets/base-1.js";e();');
    expect(bundleViolations(dir)).toEqual(['INCONCLUSIVE: no built JS file names storage.session — the vault-page rule would pass trivially']);
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

// B1b-2a §1.2: the vault page reaches only vault-page code, and a few modules stand alone.
describe('the vault page import allowlist', () => {
  const tree = files => [p => files[p], p => p in files];
  const ENTRY = "import {x} from './modes';";

  it('passes the real vault page, and the walk really reaches the vault, core/keys and the KDF worker (positive control)', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const read = rel => {
      try {
        return readFileSync(join(root, rel), 'utf8');
      } catch {
        return undefined;
      }
    };
    const seen = [];
    const spy = rel => {
      const t = read(rel);
      if (t !== undefined) seen.push(rel);
      return t;
    };
    expect(vaultPageViolations(spy, rel => read(rel) !== undefined)).toEqual([]);
    expect(seen).toEqual(expect.arrayContaining(['src/unlock/main.ts', 'src/vault/envelope.ts', 'src/vault/kdf.worker.ts', '../core/keys/mnemonic.ts']));
  });

  it('refuses a src/unlock file importing src/app', () => {
    const [read, exists] = tree({'src/unlock/main.ts': "import {App} from '../app/x';", 'src/app/x.tsx': 'export const App = 1;'});
    expect(vaultPageViolations(read, exists)).toEqual(['the vault page reaches src/app/x.tsx — only vault-page code may be bundled with the seed']);
  });

  it('refuses react, react-dom and any package outside the five', () => {
    const [read, exists] = tree({'src/unlock/main.ts': "import React from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {PublicKey} from '@solana/web3.js';"});
    expect(vaultPageViolations(read, exists)).toEqual([
      'src/unlock/main.ts: the vault page imports the package react',
      'src/unlock/main.ts: the vault page imports the package react-dom/client',
      'src/unlock/main.ts: the vault page imports the package @solana/web3.js',
    ]);
  });

  it('follows an allowed door: a src/shared file that imports src/app, and a ../web/src/ui component', () => {
    const [read, exists] = tree({
      'src/unlock/main.ts': ENTRY,
      'src/unlock/modes.ts': "import {a} from '../shared/x';\nimport {B} from '../../../web/src/ui/Icon';",
      'src/shared/x.ts': "import {App} from '../app/x';",
      'src/app/x.tsx': '',
      '../web/src/ui/Icon.tsx': '',
    });
    expect(vaultPageViolations(read, exists).sort()).toEqual([
      'the vault page reaches ../web/src/ui/Icon.tsx — only vault-page code may be bundled with the seed',
      'the vault page reaches src/app/x.tsx — only vault-page code may be bundled with the seed',
    ]);
  });

  it('allows the shared stylesheets and the five packages (negative control of the rule above)', () => {
    const [read, exists] = tree({
      'src/unlock/main.ts': "import '../../../web/src/styles/design-system.css';\nimport '../styles/design-ext.css';\nimport {base58} from '@scure/base';\nimport {sha256} from '@noble/hashes/sha2.js';",
      '../web/src/styles/design-system.css': '',
      'src/styles/design-ext.css': '',
    });
    expect(vaultPageViolations(read, exists)).toEqual([]);
  });

  // Review fix round 1: a package name followed by a `.`/`..` segment names a file outside the package.
  it('refuses a package specifier with a . or .. segment after the package name, and any backslash', () => {
    const [read, exists] = tree({
      'src/unlock/main.ts': [
        "import {a} from '@scure/base/../../../app/leak';",
        "import {b} from '@noble/hashes/./sha2.js';",
        "import {c} from 'micro-key-producer/..';",
        // Literal backslashes in the specifier (escaped in the module source: the parser reads the string's value).
        "import {d} from '@scure/base\\\\..\\\\x';",
        "import {e} from './modes\\\\x';",
      ].join('\n'),
    });
    expect(vaultPageViolations(read, exists)).toEqual([
      "src/unlock/main.ts: the vault page imports @scure/base/../../../app/leak — a package path may not contain a . or .. segment",
      "src/unlock/main.ts: the vault page imports @noble/hashes/./sha2.js — a package path may not contain a . or .. segment",
      "src/unlock/main.ts: the vault page imports micro-key-producer/.. — a package path may not contain a . or .. segment",
      "src/unlock/main.ts: the vault page imports @scure/base\\..\\x — a specifier may not contain a backslash",
      "src/unlock/main.ts: the vault page imports ./modes\\x — a specifier may not contain a backslash",
    ]);
  });

  it('still allows the packages by name and by a plain subpath (positive control of the rule above)', () => {
    const [read, exists] = tree({
      'src/unlock/main.ts': "import {base58} from '@scure/base';\nimport {sha256} from '@noble/hashes/sha2.js';\nimport {x} from 'micro-key-producer/slip10.js';",
    });
    expect(vaultPageViolations(read, exists)).toEqual([]);
  });

  // Task 5 review I1: the walk skipped every specifier that was not plain (`?`, `#`, `:`), and Vite
  // bundled `../app/engine?v` into the vault page with every gate green.
  it('refuses a specifier it cannot resolve — a query, a hash or subpath import, a scheme, a computed one — never skips it', () => {
    const [read, exists] = tree({
      'src/unlock/main.ts': [
        "import {createEngine} from '../app/engine?v';",
        "import {a} from '#app';",
        "import {b} from 'virtual:app';",
        "export * from '../app/x?y';",
        'const c = import(`${p}`);',
      ].join('\n'),
      'src/app/engine.ts': '',
    });
    const refused = spec => `src/unlock/main.ts: the vault page imports '${spec}' — a query, hash, scheme or computed specifier is refused, never skipped`;
    expect(vaultPageViolations(read, exists)).toEqual([refused('../app/engine?v'), refused('#app'), refused('virtual:app'), refused('../app/x?y'), refused('')]);
  });

  // Fix round 2: the reviewer's forms that put src/app/engine into unlock-*.js past the regex reader.
  // The parser reads them as the bundler does: each reaches src/app, or names import.meta beyond .url.
  const REACHES_ENGINE = ['the vault page reaches src/app/engine.ts — only vault-page code may be bundled with the seed'];
  it.each([
    "const a = import(/*x*/'../app/engine');",
    "import {e} /*c*/ from '../app/engine';",
    "import {e} from /*c*/ '../app/engine';",
    "const a = import(/* @vite-ignore */ '../app/engine');",
    "export {e} /*c*/ from '../app/engine';",
  ])('a comment inside an import hides nothing: %s', code => {
    const [read, exists] = tree({'src/unlock/main.ts': code, 'src/app/engine.ts': ''});
    expect(vaultPageViolations(read, exists)).toEqual(REACHES_ENGINE);
  });

  it.each([
    ["const m = import.meta.glob('../app/engine.ts', {eager: true});", 'import.meta.glob'],
    ["const m = import.meta.glob('../app/engine.ts');", 'import.meta.glob'],
    ["const m = import.meta['glob']('../app/engine.ts');", "import.meta['glob']"],
    ['const m = import.meta.env;', 'import.meta.env'],
  ])('the vault page may name import.meta.url only: %s', (code, use) => {
    const [read, exists] = tree({'src/unlock/main.ts': code});
    expect(vaultPageViolations(read, exists)).toEqual([`src/unlock/main.ts: the vault page uses ${use} — only import.meta.url is allowed (import.meta.glob bundles files without an import)`]);
  });

  it('a computed specifier behind @vite-ignore is refused; the worker URL is not (negative control)', () => {
    const [read, exists] = tree({'src/unlock/main.ts': 'const w = import(/* @vite-ignore */ p);'});
    expect(vaultPageViolations(read, exists)).toEqual(["src/unlock/main.ts: the vault page imports '' — a query, hash, scheme or computed specifier is refused, never skipped"]);
    const [read2, exists2] = tree({'src/unlock/main.ts': "const w = new Worker(new URL('../vault/kdf.worker.ts', import.meta.url), {type: 'module'});\nconst u = new URL('https://example.invalid/');", 'src/vault/kdf.worker.ts': ''});
    expect(vaultPageViolations(read2, exists2)).toEqual([]);
  });

  // Fix round 3 (N1): the vault page's stylesheets, by name, importing nothing, loading only the fonts.
  const SHEETS = {
    '../web/src/styles/design-system.css': "@font-face{src:url('/fonts/Geist-Variable.woff2')}@font-face{src:url(\"/fonts/GeistMono-Variable.woff2\")}",
    'src/styles/design-ext.css': '.screen{display:flex}',
    'src/unlock/unlock.css': '[hidden]{display:none!important}',
  };
  const STYLED = "import '../../../web/src/styles/design-system.css';\nimport '../styles/design-ext.css';\nimport './unlock.css';";

  it('the three named sheets, importing nothing and loading only the Geist faces, pass (negative control)', () => {
    const [read, exists] = tree({'src/unlock/main.ts': STYLED, ...SHEETS});
    expect(vaultPageViolations(read, exists)).toEqual([]);
  });

  it.each([
    ['@import in unlock.css', {'src/unlock/unlock.css': "@import '../app/app.css';\n[hidden]{display:none!important}"}, '', [
      "src/unlock/unlock.css: the vault page's stylesheet uses @import — every sheet it loads is named in VAULT_PAGE_SHEETS",
    ]],
    ['@import url() in design-ext.css', {'src/styles/design-ext.css': '@import url("../app/app.css");'}, '', [
      "src/styles/design-ext.css: the vault page's stylesheet uses @import — every sheet it loads is named in VAULT_PAGE_SHEETS",
      "src/styles/design-ext.css: the vault page's stylesheet loads url(../app/app.css) — only the bundled Geist faces may be loaded",
    ]],
    ['a new src/styles/zz.css', {'src/styles/zz.css': '.x{}'}, "\nimport '../styles/zz.css';", ['the vault page reaches src/styles/zz.css — only vault-page code may be bundled with the seed']],
    ['a new src/unlock/zz.css', {'src/unlock/zz.css': '.x{}'}, "\nimport './zz.css';", ['the vault page reaches src/unlock/zz.css — only vault-page code may be bundled with the seed']],
    ['a non-font url() (an exfiltrating attribute selector)', {'src/unlock/unlock.css': 'input[value^="a"]{background:url(https://example.invalid/a)}'}, '', [
      "src/unlock/unlock.css: the vault page's stylesheet loads url(https://example.invalid/a) — only the bundled Geist faces may be loaded",
    ]],
    ['a font url() in a sheet other than design-system.css', {'src/unlock/unlock.css': "@font-face{src:url('/fonts/Geist-Variable.woff2')}"}, '', [
      "src/unlock/unlock.css: the vault page's stylesheet loads url(/fonts/Geist-Variable.woff2) — only the bundled Geist faces may be loaded",
    ]],
    ['image-set()', {'src/unlock/unlock.css': '.x{background:image-set("https://example.invalid/a" 1x)}'}, '', [
      "src/unlock/unlock.css: the vault page's stylesheet uses image-set() — it loads URLs without url()",
    ]],
    ['an escaped url(', {'src/unlock/unlock.css': '.x{background:\\75rl(https://example.invalid/a)}'}, '', [
      "src/unlock/unlock.css: the vault page's stylesheet uses a backslash escape — an escape can spell url( or @import",
    ]],
  ])('refuses %s', (_name, files, extra, expected) => {
    const [read, exists] = tree({'src/unlock/main.ts': STYLED + extra, ...SHEETS, ...files});
    expect(vaultPageViolations(read, exists)).toEqual(expected);
  });

  // Fix round 3 (N2): an inline worker is invisible to the module map; the source refuses its query.
  it('refuses an inline worker import (?worker&inline) — the query is never a plain specifier', () => {
    const [read, exists] = tree({'src/unlock/main.ts': "import KdfWorker from '../vault/kdf.worker?worker&inline';", 'src/vault/kdf.worker.ts': ''});
    expect(vaultPageViolations(read, exists)).toEqual(["src/unlock/main.ts: the vault page imports '../vault/kdf.worker?worker&inline' — a query, hash, scheme or computed specifier is refused, never skipped"]);
  });

  it('does not follow a type-only import, nor prose that looks like one', () => {
    const [read, exists] = tree({'src/unlock/main.ts': "import type {X} from '../app/x';\nif (mode === 'import' || m === 'accounts') run();"});
    expect(vaultPageViolations(read, exists)).toEqual([]);
  });
});

describe('stand-alone modules (review M4)', () => {
  it('src/shared/amount.ts and src/unlock/strings.ts may import nothing (a type-only import is erased)', () => {
    expect(sourceViolations([f('src/unlock/strings.ts', "import {x} from './y';")])).toEqual(['src/unlock/strings.ts: imports a module — it must stand alone']);
    expect(sourceViolations([f('src/shared/amount.ts', "export * from './y';")])).toEqual(['src/shared/amount.ts: imports a module — it must stand alone']);
    expect(sourceViolations([f('src/shared/amount.ts', "import type {X} from './y';")])).toEqual([]);
    expect(sourceViolations([f('src/shared/amount.ts', 'export const parse = (s: string) => s;'), f('src/unlock/strings.ts', "export const S = 'x';")])).toEqual([]);
  });

  it('prose that reads like an import in the vault page’s strings is not one; a real import still is', () => {
    expect(sourceViolations([f('src/unlock/strings.ts', "export const S = {next: 'Continue to import', b: 'import screen'};")])).toEqual([]);
    for (const code of [
      "import {x} from './y';",
      "import './y';",
      "const y = import('./y');",
      "export {x} from '../app/x';",
      // Task 5 review I1: a query, a hash or subpath import, a scheme — each still an import.
      "import {createEngine} from '../app/engine?v';",
      "import {a} from '#app';",
      "import {b} from 'virtual:app';",
      "export * from '../app/x?y';",
      // Fix round 2: comments inside the statement.
      "const a = import(/*x*/'../app/engine');",
      "import {e} /*c*/ from '../app/engine';",
      "import {e} from /*c*/ '../app/engine';",
    ]) {
      expect(sourceViolations([f('src/unlock/strings.ts', code)])).toEqual(['src/unlock/strings.ts: imports a module — it must stand alone']);
    }
  });

  it('a src/shared file may not import src/app or ../web', () => {
    expect(sourceViolations([f('src/shared/x.ts', "import {App} from '../app/x';")])).toEqual([
      'src/shared/x.ts: imports UI code (src/app, ../web) — src/shared is vault-page reachable',
    ]);
    expect(sourceViolations([f('src/shared/x.ts', "import {Icon} from '../../../web/src/ui/Icon';")])).toHaveLength(1);
  });
});

// Plan 2 (B1b-2a-2): the vault-page screens are built from src/unlock/view and src/unlock/screens.
// The boundary is the allowlist above, walked from the real entry; these fixtures put the two
// imports it exists to stop — UI code and React — inside the new folders.
describe('plan 2: the vault-page screens stay inside the boundary', () => {
  const tree = files => [p => files[p], p => p in files];
  const ENTRY = "import {start} from './screens/welcome';";

  it('a view helper importing an app component fails the gate', () => {
    const [read, exists] = tree({
      'src/unlock/main.ts': ENTRY,
      'src/unlock/screens/welcome.ts': "import {banner} from '../view/banner';",
      'src/unlock/view/banner.ts': "import {Banner} from '../../app/ui/Banner';",
      'src/app/ui/Banner.tsx': '',
    });
    expect(vaultPageViolations(read, exists)).toEqual(['the vault page reaches src/app/ui/Banner.tsx — only vault-page code may be bundled with the seed']);
  });

  it('a screen importing React (or react-dom) fails the gate; so does a web/src/ui component', () => {
    const [read, exists] = tree({
      'src/unlock/main.ts': ENTRY,
      'src/unlock/screens/welcome.ts': "import {useState} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {AddressGroups} from '../../../../web/src/ui/AddressGroups';",
      '../web/src/ui/AddressGroups.tsx': '',
    });
    expect(vaultPageViolations(read, exists)).toEqual([
      'src/unlock/screens/welcome.ts: the vault page imports the package react',
      'src/unlock/screens/welcome.ts: the vault page imports the package react-dom/client',
      'the vault page reaches ../web/src/ui/AddressGroups.tsx — only vault-page code may be bundled with the seed',
    ]);
  });

  it('the real vault page reaches its own stylesheet and the two shared ones (positive control)', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const read = rel => {
      try {
        return readFileSync(join(root, rel), 'utf8');
      } catch {
        return undefined;
      }
    };
    // A stylesheet is resolved (exists) but never read: record what the walk resolved.
    const resolved = [];
    expect(
      vaultPageViolations(read, rel => {
        const hit = read(rel) !== undefined;
        if (hit) resolved.push(rel);
        return hit;
      }),
    ).toEqual([]);
    expect(resolved).toEqual(expect.arrayContaining(['src/unlock/unlock.css', 'src/styles/design-ext.css', '../web/src/styles/design-system.css']));
  });

  it.each(['el.innerHTML = s;', 'el.outerHTML = s;', "el.insertAdjacentHTML('beforeend', s);", 'range.createContextualFragment(s);', 'new DOMParser();', 'document.write(s);', 'document.writeln(s);', 'frame.srcdoc = s;'])(
    'the vault page may not write markup: %s',
    code => {
      expect(sourceViolations([f('src/unlock/view/x.ts', code)])).toEqual(['src/unlock/view/x.ts: writes markup — the vault page sets text only (textContent)']);
    },
  );

  // Review M1: the rule covers all of src/unlock, not only view/.
  it.each(['src/unlock/screens/x.ts', 'src/unlock/strings.ts', 'src/unlock/main.ts'])('%s may not write markup either', path => {
    expect(sourceViolations([f(path, 'el.innerHTML = s;')])).toEqual([`${path}: writes markup — the vault page sets text only (textContent)`]);
  });

  // Task 5 review I2: a sink need not be spelled out. Each form is refused, and says why.
  const WHY = what => `src/unlock/view/x.ts: ${what} — the vault page sets text only (textContent)`;
  it.each([
    ['el.setHTMLUnsafe(s);', 'writes markup'],
    ['el.setHTML(s);', 'writes markup'],
    ['Document.parseHTMLUnsafe(s);', 'writes markup'],
    ["document.execCommand('insertHTML', false, s);", 'writes markup'],
    ['const d = document; d.write(s);', 'writes markup'],
    ['d.writeln(s);', 'writes markup'],
    ["frame.setAttribute('srcdoc', s);", 'writes markup'],
    ["el['inner' + 'HTML'] = s;", 'writes a computed property'],
    ['el[k] = s;', 'writes a computed property'],
    ['el[k] += s;', 'writes a computed property'],
    ['el[\n  k\n] = s;', 'writes a computed property'],
    ['el[a[0]] = s;', 'writes a computed property'],
    ["el['inner\\x48TML'] = s;", 'writes a computed property'],
    ["el['insertAdjacent' + 'HTML']('beforeend', s);", 'calls a computed property'],
    ['el[k]?.(s);', 'calls a computed property'],
    ['el.inner\\u0048TML = s;', 'uses a \\u escape'],
    ["Reflect.set(el, 'inner' + 'HTML', s);", 'sets properties reflectively'],
    ['Reflect.defineProperty(el, k, {value: s});', 'sets properties reflectively'],
    ['Object.defineProperty(el, k, {value: s});', 'sets properties reflectively'],
    ["Object.assign(el, {['inner' + 'HTML']: s});", 'sets properties reflectively'],
    ["document['wr' + 'ite'](s);", 'indexes document'],
    ['el.setAttribute(name, s);', 'sets an attribute named by a computed value'],
    ["frame.src = 'data:text/html,' + s;", 'names a data:text/html URL'],
    // Fix round 2: reflection by bracket, destructuring and the legacy accessors.
    ["const dp = Object['defineProperty'];", 'sets properties reflectively'],
    ["const g = Object['getOwnPropertyDescriptor'];", 'sets properties reflectively'],
    ['const {defineProperty: dp} = Object;', 'sets properties reflectively'],
    ['const set = el.__lookupSetter__(k);', 'sets properties reflectively'],
    ["el.__defineSetter__('x', f);", 'sets properties reflectively'],
    ["Object['assign'](el, x);", 'sets properties reflectively'],
    // Fix round 2: an HTML document through a Blob, an XHR or an object URL, in any spelling.
    ["const b = new Blob([s], {type: 'text/html'});", 'names the text/html type'],
    ["const t = 'text/ht' + 'ml';", 'names the text/html type'],
    ["const t = 'text/' + x + 'html';", 'names the text/html type'],
    ['const t = `text/${x}html`;', 'names the text/html type'],
    ["frame.src = 'data:text/ht' + 'ml,' + s;", 'names the text/html type'],
    ["xhr.responseType = 'document';", 'sets an XHR responseType'],
    ['frame.src = URL.createObjectURL(b);', 'creates an object URL'],
  ])('the vault page may not reach a sink by another spelling: %s', (code, what) => {
    expect(sourceViolations([f('src/unlock/view/x.ts', code)])).toContain(WHY(what));
  });

  it('what the vault page’s own code writes is allowed: destructuring, typed arrays, tuples, plain-named brackets, literal attributes (negative controls)', () => {
    const code = [
      'const [a, b] = pair;',
      'const xs: string[] = [];',
      'const grid: string[][] = [];',
      "let t: [string, number] = ['a', 1];",
      "const sent: Harness['sent'] = [];",
      "obj['href'] = s;",
      "el.setAttribute('aria-label', s);",
      'if (a[i] === b[0] || a[i] !== c || a[0] <= d || a[0] >= d) run();',
      'const v = /x/.exec(s)?.[1];',
      "el.textContent = 'don’t';",
      "frame.src = 'unlock.html';",
      "const kind = 'text/' + 'plain';",
      "const label = `type: ${x}`;",
    ].join('\n');
    expect(sourceViolations([f('src/unlock/view/x.ts', code)])).toEqual([]);
  });

  it('textContent is allowed, and the rule is the vault page’s alone (negative controls)', () => {
    expect(sourceViolations([f('src/unlock/view/x.ts', 'el.textContent = s; el.replaceChildren(a);')])).toEqual([]);
    expect(sourceViolations([f('src/app/x.tsx', 'el.innerHTML = s;')])).toEqual([]);
  });
});
