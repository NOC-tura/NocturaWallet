import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CONNECTION_ONLY, DEPS_FILE, KNOWN_RPC_METHODS, RPC_FILE, RPC_PATH_LITERAL, SPEC_ALLOWED,
  allowlistFrom, checkRepo, methodViolations, networkViolations, reachable, stripComments,
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

  it('flags a web3.js Connection and its methods that bypass the list', () => {
    expect(methodViolations([f('a.ts', "import {Connection, PublicKey} from '@solana/web3.js';")], SPEC_ALLOWED)).toEqual(['a.ts: uses a web3.js Connection, which bypasses the RPC allowlist']);
    expect(methodViolations([f('b.ts', 'const c = new Connection(url);')], SPEC_ALLOWED)).toEqual(['b.ts: uses a web3.js Connection, which bypasses the RPC allowlist']);
    expect(methodViolations([f('c.ts', 'await conn.getParsedTransaction(sig);')], SPEC_ALLOWED)).toEqual(['c.ts: calls Connection.getParsedTransaction, which bypasses the RPC allowlist']);
    expect(methodViolations([f('d.ts', 'await reader.getSignatureStatuses([s]);')], SPEC_ALLOWED)).toEqual([]);
    expect(CONNECTION_ONLY).toContain('sendRawTransaction');
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

  // Fix round 1: the reviewer bypassed the original Connection check twice — a namespace import
  // used as `web3.Connection`, and `require('@solana/web3.js').Connection` — because it only
  // matched `import {Connection} from '@solana/web3.js'` and a bare `new Connection(`. The
  // controller's ruling: the token `Connection` is a violation whenever the file references
  // '@solana/web3.js' at all, with no usage-site matching. A file that references web3.js for
  // unrelated names but only *mentions* "Connection" in prose (no `.Connection`, no `{Connection}`
  // import clause) must still be spared — core/solana/transfer.ts does exactly this in a comment,
  // and is part of the real repo's reachable set.
  it('flags every way a bundled file can reach a web3.js Connection, and spares an unrelated mention', () => {
    expect(methodViolations([f('a.ts', "import * as web3 from '@solana/web3.js';\nconst c = new web3.Connection(url);")], SPEC_ALLOWED)).toEqual([
      'a.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('b.ts', "const C = require('@solana/web3.js').Connection;")], SPEC_ALLOWED)).toEqual([
      'b.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('c.ts', "export {Connection} from '@solana/web3.js';")], SPEC_ALLOWED)).toEqual([
      'c.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    // Negative control: no web3.js reference at all, and "Connection" is not a property access,
    // import clause member or `new Connection(` call — allowed (the transfer.ts shape).
    expect(methodViolations([f('d.ts', "import {PublicKey} from '@solana/web3.js';\n// store and its Connection.\n")], SPEC_ALLOWED)).toEqual([]);
    expect(methodViolations([f('e.ts', 'const Connection = 1;\nvoid Connection;')], SPEC_ALLOWED)).toEqual([]);
  });

  // Fix round 1: a raw fetch of the RPC endpoint with a computed method name bypassed both the
  // gate and createRpc's compile-time list, because nothing forbade calling fetch directly. Only
  // extension/src/background/deps.ts (timedFetch) may call the global fetch; injected
  // `opts.fetch(`/`deps.fetch(` calls (rpc.ts, broadcast.ts) stay allowed.
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
    // deps.ts itself is the one place the global fetch may be called.
    expect(networkViolations([f(DEPS_FILE, 'await fetch(url); await globalThis.fetch(url);')])).toEqual([]);
  });

  it('flags the RPC endpoint path named outside core/solana/rpc.ts', () => {
    expect(networkViolations([f('src/background/x.ts', "const u = 'https://api.noc-tura.io/api/v1/rpc';")])).toEqual([
      `src/background/x.ts: names the RPC endpoint path (${RPC_PATH_LITERAL}), which only ${RPC_FILE} may`,
    ]);
    expect(networkViolations([f(RPC_FILE, "const u = API_BASE + '/rpc';")])).toEqual([]);
  });

  it('still passes on this repository with the network checks folded in (rpc.ts and broadcast.ts use injected fetch)', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    expect(checkRepo(root)).toEqual([]);
  });

  // Fix round 2: the narrowed Connection rule (an import/export clause member or a `.Connection`
  // property access) still missed a Connection reached by destructuring — neither
  // `const {Connection} = await import('@solana/web3.js')` nor `const {Connection: C} = web3`
  // (paired with a prior web3.js reference) is a `.` access or a clause member. Controller ruling:
  // strip comments first, then apply the BLUNT rule (any `Connection` word token in a file that
  // references web3.js at all) — and the same for the fetch rule (any `fetch` call or
  // globalThis/self/window.fetch property access outside deps.ts). Comment-stripping is what now
  // keeps this sound: without it, a blunt token scan would trip on core/solana/transfer.ts's own
  // comment ("…its Connection.") and core/solana/rpc.ts's own comment ("`globalThis.fetch`
  // satisfies it") — both real, reachable files.
  it('strips // and /* */ comments outside string/template literals, leaving a same-line URL string untouched', () => {
    expect(stripComments("const u = 'https://x//y';")).toBe("const u = 'https://x//y';");
    expect(stripComments('const a = 1; // comment\nconst b = 2;')).toBe('const a = 1; \nconst b = 2;');
    expect(stripComments('/* c */const x = 1;')).toBe('const x = 1;');
    // A comment-like sequence inside a template literal's plain text also survives.
    expect(stripComments('const t = `a // not a comment`;')).toBe('const t = `a // not a comment`;');
  });

  it('catches a Connection reached by destructuring — the narrowed rule\'s own hole', () => {
    expect(methodViolations([f('a.ts', "const {Connection} = await import('@solana/web3.js');")], SPEC_ALLOWED)).toEqual([
      'a.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
    expect(methodViolations([f('b.ts', "import * as web3 from '@solana/web3.js';\nconst {Connection: C} = web3;")], SPEC_ALLOWED)).toEqual([
      'b.ts: uses a web3.js Connection, which bypasses the RPC allowlist',
    ]);
  });

  it('spares a comment that merely mentions Connection or globalThis.fetch (comments are stripped first)', () => {
    expect(methodViolations([f('c.ts', "import {PublicKey} from '@solana/web3.js';\n/** store and its Connection. */\n")], SPEC_ALLOWED)).toEqual([]);
    expect(networkViolations([f('d.ts', '/** globalThis.fetch satisfies it. */\nexport const x = 1;')])).toEqual([]);
  });

  it('still passes on this repository with comment-stripped blunt Connection/fetch rules', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    expect(checkRepo(root)).toEqual([]);
  });
});
