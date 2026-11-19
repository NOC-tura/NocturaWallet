/**
 * R6 — "No fallback to self-relay. With the relayer unavailable, an unshield fails; it never signs
 * with the user's key" — as a source guard (M1c Task 3). Read three ways, each with a positive
 * control on the same check:
 *  1. no shielded module or screen sends or signs a transaction, except the deposit
 *     (`a0/depositFlow.ts`: a shield is the user's own transaction by design, §5);
 *  2. the `withdraw_with_change` discriminator is named only where it is decoded (`syncedTx.ts`),
 *     defined (`constants.ts`) and encoded for comparison (`relayerClient.ts`) — no other module
 *     can build the instruction;
 *  3. `relayerClient.ts`, the one encoder, has no way to make, sign or send a transaction: no key,
 *     no transaction type, no send call (comments excluded — they may name what is absent).
 * Stated limit: these read this repository's sources, nothing injected at run time (§2).
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const SKIP = new Set(['__tests__', '__testing__', '__mocks__', 'node_modules']);

function walk(rel: string, out: string[]): string[] {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    return out;
  }
  for (const name of fs.readdirSync(abs)) {
    const r = path.join(rel, name);
    if (fs.statSync(path.join(ROOT, r)).isDirectory()) {
      if (!SKIP.has(name)) {
        walk(r, out);
      }
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(r);
    }
  }
  return out;
}
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
/** The text without comments (block and line), so a comment may name what is absent. */
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const SEND = /\b(sendRawTransaction|sendTransaction|sendEncodedTransaction|sendAndConfirm\w*|signAndSend\w*|signTransaction|signAllTransactions)\b/;
const WITHDRAW_DISC = /\bwithdrawWithChange\b|6cf44379ecf67997/;
const SIGNING = /\b(Keypair|secretKey|sign|signTransaction|Transaction|VersionedTransaction|TransactionMessage|compileMessage|compileToV0Message|compileToLegacyMessage|sendRawTransaction|sendTransaction|deriveTransparentKeypair|mnemonic|keychain)\b/;

const SHIELDED_TREES = ['src/modules/shielded', 'src/screens/shielded', 'src/modules/zkProver'];
const shieldedFiles = SHIELDED_TREES.flatMap(t => walk(t, []));
const srcFiles = walk('src', []);

const hits = (files: string[], re: RegExp, text: (f: string) => string = read) => files.filter(f => re.test(text(f)));

describe('R6: no self-relay path exists (source guard)', () => {
  it('reads the trees it claims to (non-vacuous)', () => {
    expect(shieldedFiles).toEqual(
      expect.arrayContaining([
        'src/modules/shielded/a0/relayerClient.ts',
        'src/modules/shielded/a0/depositFlow.ts',
        'src/modules/zkProver/nativeProverBridge.ts',
      ]),
    );
    expect(shieldedFiles.some(f => f.startsWith('src/screens/shielded/'))).toBe(true);
    expect(srcFiles.length).toBeGreaterThan(shieldedFiles.length);
  });

  it('1. only the deposit sends or signs among the shielded modules and screens', () => {
    expect(hits(shieldedFiles, SEND)).toEqual(['src/modules/shielded/a0/depositFlow.ts']);
  });
  it('1. positive control: a module that relays by itself is flagged', () => {
    expect(SEND.test('await connection.sendRawTransaction(tx.serialize())')).toBe(true);
    expect(SEND.test("import {signAndSendTransaction} from '../../solana/signAndSend';")).toBe(true);
  });

  it('2. the withdraw_with_change discriminator lives in constants, the sync’s decoder and the relayer client only', () => {
    expect(hits(srcFiles, WITHDRAW_DISC).sort()).toEqual([
      'src/modules/shielded/a0/constants.ts',
      'src/modules/shielded/a0/relayerClient.ts',
      'src/modules/shielded/a0/syncedTx.ts',
    ]);
  });
  it('2. positive control: another module encoding it is flagged', () => {
    expect(WITHDRAW_DISC.test('hexBytes(A0_IX_DISCRIMINATOR.withdrawWithChange)')).toBe(true);
    expect(WITHDRAW_DISC.test("const d = '6cf44379ecf67997';")).toBe(true);
  });

  it('3. relayerClient.ts names no key, transaction type or send call (code only)', () => {
    const text = code(read('src/modules/shielded/a0/relayerClient.ts'));
    expect(text).toContain('buildA0WithdrawChangeIx'); // non-vacuous: the code is there
    expect(text.match(SIGNING)).toBeNull();
  });
  it('3. positive control: a Keypair, a Transaction or a send in that code is flagged; the same words in a comment are not', () => {
    for (const bad of ['const k = Keypair.generate();', 'new Transaction().add(ix)', 'tx.sign([payer])', 'await c.sendTransaction(t)']) {
      expect(code(bad)).toMatch(SIGNING);
    }
    expect(code('// never a Keypair, never sign\n/* no Transaction */ const x = 1;')).not.toMatch(SIGNING);
  });
});
