import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {derivePublicKeys, deriveSessionAccounts} from '../../vault/accounts';
import {getSession} from '../../background/session';
import {VAULT_KEY} from '../../background/accountsStore';
import {handleMessage} from '../../background/messages';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {SETTINGS_KEY} from '../../background/settings';
import {PENDING_KEY} from '../../background/pendingStore';
import {FORBIDDEN_UNTIL_KEY} from '../../background/deps';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {pendingRecord} from '../../background/__tests__/fixtures';
import * as forgetFlow from '../forgetFlow';
import {deleteWallet, proveFactor, proveSeed, type FactorProof} from '../forgetFlow';
import type {Send} from '../types';

// B1b-2b E11: #37's delete — a factor proof, then ONE vault.forgetWallet with neither `replacement` nor `guard`, against
// the REAL background.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PW = 'correct horse battery';
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const UNLOCK = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});

async function background(o: {funded?: boolean; pending?: boolean} = {}) {
  const keys = await derivePublicKeys(M, 'slip10', [0]);
  const env: EnvelopeV1 = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: keys[0] ?? ''}], kdf});
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, env);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: keys[0], at: 1}]);
  await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 2});
  await ext.local.set(FORBIDDEN_UNTIL_KEY, 9);
  if (o.pending === true) await ext.local.set(PENDING_KEY, [pendingRecord({account: keys[0]})]);
  // A funded wallet: the C6 guard would refuse it — #37's delete sends no guard (D11).
  const reader = fakeReader({getBalance: async () => (o.funded === true ? 5_000_000_000n : 0n), getTokenAccountsByOwner: async () => []});
  const deps = fakeDeps({reader});
  const sent: {type: string; [k: string]: unknown}[] = [];
  const send: Send = async m => {
    sent.push(JSON.parse(JSON.stringify(m)) as {type: string});
    return (await handleMessage(ext, JSON.parse(JSON.stringify(m)), UNLOCK, deps)) as {ok: boolean; error?: string};
  };
  return {ext, send, sent, read: () => ext.local.get(VAULT_KEY)};
}
async function proof(b: Awaited<ReturnType<typeof background>>): Promise<FactorProof> {
  const r = await proveFactor(b.read, {password: PW, kdf});
  if (r.outcome !== 'proven') throw new Error(r.outcome);
  return r.proof;
}

describe('deleteWallet (E11)', () => {
  it('a funded wallet is deleted: one forget with neither replacement nor guard; the wipe list; v1_forbidden_until kept', async () => {
    const b = await background({funded: true});
    expect(await deleteWallet(b.send, await proof(b))).toBe('deleted');
    const forgets = b.sent.filter(m => m.type === 'vault.forgetWallet');
    expect(forgets).toHaveLength(1);
    expect(Object.keys(forgets[0] ?? {}).sort()).toEqual(['expectedRevision', 'type']);
    expect(await b.read()).toBeUndefined();
    expect(await b.ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
    expect(await b.ext.local.get(SETTINGS_KEY)).toBeUndefined();
    expect(await b.ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(9);
  });

  it('refuses an unminted proof and a seed proof: nothing is sent', async () => {
    const b = await background();
    const forged = Object.freeze({kind: 'factor', revision: (await proof(b)).revision}) as FactorProof;
    expect(await deleteWallet(b.send, forged)).toBe('failed');
    const seed = await proveSeed(b.read, M);
    if (seed.outcome !== 'match') throw new Error(seed.outcome);
    expect(await deleteWallet(b.send, seed.proof as unknown as FactorProof)).toBe('failed');
    expect(b.sent.filter(m => m.type === 'vault.forgetWallet')).toHaveLength(0);
    expect(await b.read()).toBeDefined();
  });

  it('send-open: refused, the vault intact (the background locked the wallet)', async () => {
    const b = await background({pending: true});
    // Fix round 1 (M1): unlocked first, so "left locked" is a claim the test can see fail.
    expect(await b.send({type: 'vault.setKeys', accounts: await deriveSessionAccounts(M, 'slip10', [0])})).toEqual({ok: true});
    expect(await getSession(b.ext)).not.toBeNull();
    expect(await deleteWallet(b.send, await proof(b))).toBe('send-open');
    expect(await b.read()).toBeDefined();
    expect(await getSession(b.ext)).toBeNull();
  });

  it('maps every refusal: busy, unlocked, no-wallet, damaged (stored-invalid), and the guard-only codes as failed', async () => {
    const b = await background();
    const p = await proof(b);
    for (const [error, out] of [
      ['busy', 'busy'],
      ['unlocked', 'unlocked'],
      ['no-wallet', 'no-wallet'],
      ['stored-invalid', 'damaged'],
      ['send-open', 'send-open'],
      ['funded', 'failed'],
      ['unreachable', 'failed'],
      ['coordinator-refused', 'failed'],
      ['something-else', 'failed'],
    ] as const) {
      expect(await deleteWallet(async () => ({ok: false, error}), p)).toBe(out);
    }
    expect(
      await deleteWallet(async () => {
        throw new Error('gone');
      }, p),
    ).toBe('failed');
  });
});

// E11's boundary (spec §8.1): deleteWallet is the one path to a bare (no replacement, no guard) vault.forgetWallet, so
// (1) the module's private `forget` must stay private — a screen that could call it would reach the bare message
// without a factor proof; (2) only #37's page (screens/delete.ts) may import deleteWallet. (2) is a TRIPWIRE
// over source text (a file can spell a name some other way); (1) is checked on the module's runtime exports.
describe('deleteWallet stays behind its proof', () => {
  it('forgetFlow exports exactly its proof minters and three proof-taking flows — never forget, never the minted set', () => {
    expect(Object.keys(forgetFlow).sort()).toEqual(['deleteWallet', 'proveFactor', 'proveSeed', 'replaceEmptyWallet', 'restoreWallet']);
  });

  it('exactly two extension source files name deleteWallet: forgetFlow.ts (which defines it) and screens/delete.ts (#37, its one importer)', () => {
    const src = join(__dirname, '..', '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
          if (e !== '__tests__') walk(p);
        } else if (/\.tsx?$/.test(e)) files.push(relative(src, p).split(sep).join('/'));
      }
    };
    walk(src);
    expect(files).toContain('unlock/forgetFlow.ts');
    const naming = files.filter(f => /\bdeleteWallet\b/.test(readFileSync(join(src, f), 'utf8')));
    expect(files).toContain('unlock/screens/delete.ts');
    expect(naming.sort()).toEqual(['unlock/forgetFlow.ts', 'unlock/screens/delete.ts']);
  });
});
