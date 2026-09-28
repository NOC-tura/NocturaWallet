import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {bundleViolations, manifestViolations, sourceViolations, DERIVATION_MARKER, VAULT_MARKER} from '../check-vault-isolation.mjs';
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
    write('assets/unlock-1.js', `import"./base-1.js";const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";`);
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
    write('assets/vault-1.js', `const i="${VAULT_MARKER}";const d="${DERIVATION_MARKER}";`);
    expect(bundleViolations(dir)).toEqual([]);
  });

  it('fails closed on an import it cannot resolve', () => {
    write('assets/popup-1.js', 'import"./missing-1.js";');
    expect(bundleViolations(dir)).toEqual(['assets/popup-1.js imports ./missing-1.js, which is not a built file']);
    write('assets/popup-1.js', 'import"../../outside.js";');
    expect(bundleViolations(dir)).toEqual(['assets/popup-1.js imports ../../outside.js, which leaves dist']);
  });

  it('is INCONCLUSIVE — and fails — when either marker is in no built file', () => {
    write('assets/unlock-1.js', `const d="${DERIVATION_MARKER}";`);
    expect(bundleViolations(dir)).toEqual([
      'INCONCLUSIVE: the envelope marker "noctura-ext-v1/passkey-wrap" is in no built file — the check would pass trivially',
    ]);
    write('assets/unlock-1.js', `const i="${VAULT_MARKER}";`);
    expect(bundleViolations(dir)).toEqual([
      'INCONCLUSIVE: the derivation marker "ed25519 seed" is in no built file — the check would pass trivially',
    ]);
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
