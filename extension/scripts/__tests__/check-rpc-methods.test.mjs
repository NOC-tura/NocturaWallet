import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CONNECTION_ONLY, DEPS_FILE, KNOWN_RPC_METHODS, RPC_FILE, RPC_PATH_LITERAL, SPEC_ALLOWED,
  allowlistFrom, checkRepo, methodViolations, networkViolations, reachable,
} from '../check-rpc-methods.mjs';
import {listSourceFiles} from '../check-vault-isolation.mjs';

const f = (path, text) => ({path, text});

describe('the RPC method gate', () => {
  it('flags a refused method named as a string, anywhere in a bundled file', () => {
    expect(methodViolations([f('src/background/x.ts', "rpc.call('getProgramAccounts' as never, [])")], SPEC_ALLOWED)).toEqual([
      'src/background/x.ts: names the RPC method getProgramAccounts, which the coordinator proxy refuses (HTTP 403)',
    ]);
    expect(methodViolations([f('../core/solana/y.ts', 'const m = `sendTransaction`;')], SPEC_ALLOWED)).toHaveLength(1);
  });

  it('accepts the allowed names (positive control) and ignores words that are not RPC methods', () => {
    expect(methodViolations([f('a.ts', "call('getBalance', []); const t = 'wallet.balances'; const u = 'getAssociatedTokenAddress';")], SPEC_ALLOWED)).toEqual([]);
  });

  it('reads the list out of core/solana/rpc.ts', () => {
    expect(allowlistFrom("export const ALLOWED_RPC_METHODS = [\n  'getBalance',\n  'getBlockHeight',\n] as const;")).toEqual(['getBalance', 'getBlockHeight']);
    expect(allowlistFrom('nothing here')).toBeNull();
  });

  it('follows relative imports from the extension into core/ and reports one it cannot resolve', () => {
    const files = {
      'src/background/index.ts': "import {x} from '../../../core/solana/a';",
      '../core/solana/a.ts': "import {y} from './b';\nexport * from '../presale/c';",
      '../core/solana/b.ts': 'export const y = 1;',
      '../core/presale/c.ts': "import('./missing');",
    };
    const {files: seen, problems} = reachable(['src/background/index.ts'], p => files[p], p => p in files);
    expect(seen.sort()).toEqual(['../core/presale/c.ts', '../core/solana/a.ts', '../core/solana/b.ts', 'src/background/index.ts']);
    expect(problems).toEqual(['../core/presale/c.ts imports ./missing, which does not resolve to a file']);
  });

  it('the spec list is the eleven methods, and every name on it is a real RPC method', () => {
    expect(SPEC_ALLOWED).toHaveLength(11);
    for (const m of SPEC_ALLOWED) expect(KNOWN_RPC_METHODS).toContain(m);
  });

  it('is INCONCLUSIVE — and fails — where core/solana/rpc.ts is not reached (negative control)', () => {
    const empty = mkdtempSync(join(tmpdir(), 'rpcgate-'));
    try {
      expect(checkRepo(empty)).toEqual(['INCONCLUSIVE: ../core/solana/rpc.ts is reachable from no extension source — the check would pass trivially']);
    } finally {
      rmSync(empty, {recursive: true, force: true});
    }
  });

  it('passes on this repository (the gate is not vacuous: rpc.ts is reached)', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    expect(checkRepo(root)).toEqual([]);
  });

  it('does not read itself: the gate spells refused method names, and scripts/ is not bundled', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    expect(listSourceFiles(root)).not.toContain('scripts/check-rpc-methods.mjs');
  });

  // Fix round 1: a namespace-import Connection (`web3.Connection`) and `require(...).Connection`
  // bypassed the original check (it only matched `import {Connection} from …` and a bare
  // `new Connection(`). Fix round 2 narrowed to a `.Connection` access or an import/export clause
  // member, gated on a web3.js reference, and added stripComments to keep that sound against two
  // real files' own comments — but round 2 still missed a Connection reached by destructuring
  // (`const {Connection} = await import(...)`, `const {Connection: C} = web3`), and stripComments
  // itself mis-parsed a regex literal (`/foo/*2`) as opening a block comment, silently swallowing
  // the rest of the file. Fix round 3 (this state): stripComments is GONE. The rule is blunt on
  // RAW text — any `Connection` word token in a file that references '@solana/web3.js' at all —
  // and the two real files that merely *mentioned* "Connection" in a comment
  // (core/solana/transfer.ts, core/presale/allocation.ts) were reworded instead, so the gate does
  // not need to understand comments at all. The runtime backstop (manifest/source.mjs's
  // connect-src, checked by check-permissions.mjs) is what actually stops a bypass this text-based
  // gate still cannot see.
  it('flags every way a bundled file can reach a web3.js Connection, on raw text', () => {
    expect(methodViolations([f('a.ts', "import {Connection, PublicKey} from '@solana/web3.js';")], SPEC_ALLOWED)).toEqual([
      'a.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('b.ts', 'const c = new Connection(url);')], SPEC_ALLOWED)).toEqual([
      'b.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('c.ts', "import * as web3 from '@solana/web3.js';\nconst c = new web3.Connection(url);")], SPEC_ALLOWED)).toEqual([
      'c.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('d.ts', "const C = require('@solana/web3.js').Connection;")], SPEC_ALLOWED)).toEqual([
      'd.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('e.ts', "export {Connection} from '@solana/web3.js';")], SPEC_ALLOWED)).toEqual([
      'e.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('g.ts', "const {Connection} = await import('@solana/web3.js');")], SPEC_ALLOWED)).toEqual([
      'g.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('h.ts', "import * as web3 from '@solana/web3.js';\nconst {Connection: C} = web3;")], SPEC_ALLOWED)).toEqual([
      'h.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('i.ts', 'await conn.getParsedTransaction(sig);')], SPEC_ALLOWED)).toEqual([
      'i.ts: calls Connection.getParsedTransaction, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('j.ts', 'await reader.getSignatureStatuses([s]);')], SPEC_ALLOWED)).toEqual([]);
    expect(CONNECTION_ONLY).toContain('sendRawTransaction');
    // Negative control: no web3.js reference at all — an unrelated identifier is still spared.
    expect(methodViolations([f('k.ts', 'const Connection = 1;\nvoid Connection;')], SPEC_ALLOWED)).toEqual([]);
  });

  it('flags a comment mentioning Connection too, now that nothing strips comments (fail-closed by design)', () => {
    expect(methodViolations([f('m.ts', "import {PublicKey} from '@solana/web3.js';\n// its Connection.\n")], SPEC_ALLOWED)).toEqual([
      'm.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
  });

  it('a regex literal does not swallow the rest of the file (no comment logic left to confuse)', () => {
    const text = "const re = /foo/*2;\nimport {Connection} from '@solana/web3.js';\n";
    expect(methodViolations([f('a.ts', text)], SPEC_ALLOWED)).toEqual(['a.ts: uses a web3.js Connection, which bypasses the RPC allowlist']);
    // `/\/\//` would have eaten a line under round 2's stripComments too; raw text never tries.
    const text2 = "const slashes = /\\/\\//;\nconst probe = 'getSlot';\n";
    expect(methodViolations([f('b.ts', text2)], SPEC_ALLOWED)).toEqual([
      'b.ts: names the RPC method getSlot, which the coordinator proxy refuses (HTTP 403)',
    ]);
  });

  // Fix round 1: forbid a direct call to the global fetch and to XMLHttpRequest/sendBeacon/
  // WebSocket anywhere except extension/src/background/deps.ts.
  //
  // Fix round 3: re-review found two more fetch bypasses round 1 missed — destructuring fetch off
  // globalThis/self/window (`const {fetch: f} = globalThis`), and a computed property access on
  // any of the three (`globalThis['fe' + 'tch']`), which cannot be read statically, so ANY
  // computed access on these three globals is a violation, no usage-site matching. Checked on RAW
  // text (round 2's stripComments is gone); core/solana/rpc.ts's own comment ("`globalThis.fetch`
  // satisfies it") was reworded instead of relying on the gate to spare it.
  it('flags the global fetch and other raw network calls outside deps.ts, but allows injected fetch', () => {
    expect(networkViolations([f('src/background/x.ts', 'await fetch(url);')])).toEqual([
      `src/background/x.ts: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
    expect(networkViolations([f('src/background/x.ts', 'await globalThis.fetch(url);')])).toEqual([
      `src/background/x.ts: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
    expect(networkViolations([f('src/background/x.ts', 'await self.fetch(url);')])).toEqual([
      `src/background/x.ts: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
    expect(networkViolations([f('src/background/x.ts', 'await window.fetch(url);')])).toEqual([
      `src/background/x.ts: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
    expect(networkViolations([f('src/background/x.ts', 'const {fetch: f} = globalThis;\nf(url);')])).toEqual([
      `src/background/x.ts: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
    expect(networkViolations([f('src/background/x.ts', 'const {fetch} = self;')])).toEqual([
      `src/background/x.ts: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
    expect(networkViolations([f('src/background/x.ts', "globalThis['fe' + 'tch'](url);")])).toEqual([
      `src/background/x.ts: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
    expect(networkViolations([f('src/background/x.ts', "const u = self['fetch'];")])).toEqual([
      `src/background/x.ts: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
    // Blunt per the controller's ruling: ANY computed access on window (not only ['fetch']).
    expect(networkViolations([f('src/background/x.ts', "const w = window['location'];")])).toEqual([
      `src/background/x.ts: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
    expect(networkViolations([f('src/background/x.ts', 'const r = new XMLHttpRequest();')])).toEqual([
      'src/background/x.ts: uses XMLHttpRequest, bypassing the coordinator client',
    ]);
    expect(networkViolations([f('src/background/x.ts', 'navigator.sendBeacon(url, body);')])).toEqual([
      'src/background/x.ts: uses navigator.sendBeacon, bypassing the coordinator client',
    ]);
    expect(networkViolations([f('src/background/x.ts', 'const ws = new WebSocket(url);')])).toEqual([
      'src/background/x.ts: uses new WebSocket, bypassing the coordinator client',
    ]);
    // Injected fetch (a parameter or a field), and a lookalike identifier, stay allowed.
    expect(networkViolations([f('src/background/x.ts', 'await opts.fetch(url); await deps.fetch(url); prefetch(url);')])).toEqual([]);
    // deps.ts itself is the one place the global fetch (in any of these forms) may be reached.
    expect(networkViolations([f(DEPS_FILE, "await fetch(url); await globalThis.fetch(url); globalThis['fetch'](url);")])).toEqual([]);
  });

  it('flags the RPC endpoint path named outside core/solana/rpc.ts', () => {
    expect(networkViolations([f('src/background/x.ts', "const u = 'https://api.noc-tura.io/api/v1/rpc';")])).toEqual([
      `src/background/x.ts: names the RPC endpoint path (${RPC_PATH_LITERAL}), which only ${RPC_FILE} may`,
    ]);
    expect(networkViolations([f(RPC_FILE, "const u = API_BASE + '/rpc';")])).toEqual([]);
  });

  it('still passes on this repository (round 3: raw-text blunt rules, the real comments reworded)', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    expect(checkRepo(root)).toEqual([]);
  });

  // B1b-2a §1.3: the screens are .tsx and import ../web/src/ui; the gate follows both, and those files may not fetch.
  it('follows .tsx imports into ../web/src/ui, where a fetch is a violation', () => {
    const files = {
      'src/app/popup.tsx': "import {CopyButton} from '../../../web/src/ui/CopyButton';",
      '../web/src/ui/CopyButton.tsx': "export function CopyButton() { return fetch('https://example.invalid'); }",
    };
    const {files: seen, problems} = reachable(['src/app/popup.tsx'], p => files[p], p => p in files);
    expect(problems).toEqual([]);
    expect(seen).toContain('../web/src/ui/CopyButton.tsx');
    expect(networkViolations(seen.map(p => f(p, files[p])))).toEqual([
      `../web/src/ui/CopyButton.tsx: calls the global fetch directly, bypassing the coordinator client (only ${DEPS_FILE} may)`,
    ]);
  });
});
