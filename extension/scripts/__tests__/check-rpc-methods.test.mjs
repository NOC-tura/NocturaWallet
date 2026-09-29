import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONNECTION_ONLY, KNOWN_RPC_METHODS, SPEC_ALLOWED, allowlistFrom, checkRepo, methodViolations, reachable} from '../check-rpc-methods.mjs';
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
});
