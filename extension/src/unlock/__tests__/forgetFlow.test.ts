import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {derivePublicKeys} from '../../vault/accounts';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {VAULT_KEY} from '../../background/accountsStore';
import {handleMessage} from '../../background/messages';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {getSession} from '../../background/session';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {proveFactor, proveSeed, replaceEmptyWallet, restoreWallet, type FactorProof, type SeedProof} from '../forgetFlow';
import {commitWallet, prepareWallet} from '../onboarding';
import {backgroundVaultStore} from '../vaultStore';
import type {Send} from '../types';

// Spec B1b-2a E5, the vault page's half: the two proofs, and the only two ways this page may send
// vault.forgetWallet. Run against the REAL background (handleMessage over an in-memory storage), so
// "nothing changed" is checked on the stored bytes, not on a mock's word.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const OLD_PW = 'correct horse battery';
const NEW_PW = 'a brand new long password';
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const UNLOCK = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

async function storedWallet(mnemonic: string, scheme: 'slip10' | 'cli', indexes: number[], names = indexes.map(i => `Account ${i + 1}`)): Promise<EnvelopeV1> {
  const keys = await derivePublicKeys(mnemonic, scheme, indexes);
  return createEnvelope({mnemonic, password: OLD_PW, scheme, accounts: indexes.map((index, i) => ({index, name: names[i] ?? '', publicKey: keys[i] ?? ''})), kdf});
}

/** The real background with `env` stored; `sent` records every message the page sends it. */
async function background(env: EnvelopeV1 | undefined, balances: (owner: string) => bigint = () => 0n) {
  const ext = fakeExt();
  if (env !== undefined) await ext.local.set(VAULT_KEY, env);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
  const deps = fakeDeps({reader: fakeReader({getBalance: async owner => balances(owner), getTokenAccountsByOwner: async () => []})});
  const sent: {type: string; [k: string]: unknown}[] = [];
  const send: Send = async m => {
    sent.push(m as {type: string});
    return (await handleMessage(ext, JSON.parse(JSON.stringify(m)), UNLOCK, deps)) as {ok: boolean; error?: string; data?: unknown};
  };
  const read = () => ext.local.get(VAULT_KEY);
  return {ext, send, sent, read, store: backgroundVaultStore(send, read)};
}

describe('the seed proof (#39 → #8 restore)', () => {
  it('accepts the stored wallet’s phrase — slip10 with several accounts, and cli — sending nothing', async () => {
    const slip = await background(await storedWallet(M, 'slip10', [0, 1, 3]));
    expect((await proveSeed(slip.read, M)).outcome).toBe('match');
    const cli = await background(await storedWallet(M, 'cli', [0]));
    // Untidy input normalises the way import does.
    expect((await proveSeed(cli.read, `  ${M.toUpperCase()} `)).outcome).toBe('match');
    expect([...slip.sent, ...cli.sent]).toEqual([]);
  });

  it('refuses a different valid phrase, and the same phrase under the other scheme', async () => {
    const b = await background(await storedWallet(M, 'slip10', [0]));
    expect(await proveSeed(b.read, OTHER)).toEqual({outcome: 'not-this-wallet'});
    // A stored cli wallet whose key is M's SLIP-0010 key: derived under the stored scheme, M does not match.
    const env = await storedWallet(M, 'slip10', [0]);
    const crossed = await background({...env, scheme: 'cli'});
    expect(await proveSeed(crossed.read, M)).toEqual({outcome: 'not-this-wallet'});
    expect([...b.sent, ...crossed.sent]).toEqual([]);
  });

  it('no wallet, a damaged one, and a phrase import refuses are named as such', async () => {
    expect(await proveSeed(async () => undefined, M)).toEqual({outcome: 'no-wallet'});
    expect(await proveSeed(async () => null, M)).toEqual({outcome: 'damaged'});
    const b = await background(await storedWallet(M, 'slip10', [0]));
    expect(await proveSeed(b.read, 'abandon abandon')).toEqual({outcome: 'invalid-mnemonic'});
  });
});

describe('restoreWallet: the seed-proven replacement (E5 with `replacement`, D40)', () => {
  it('re-encrypts the same wallet under the new password with every stored index and name, keeps known recipients, and unlocks it', async () => {
    const env = await storedWallet(M, 'slip10', [0, 2], ['Main', 'Rainy day']);
    const b = await background(env);
    const proven = await proveSeed(b.read, M);
    if (proven.outcome !== 'match') throw new Error(proven.outcome);
    expect(await restoreWallet({send: b.send, kdf}, proven.proof, NEW_PW)).toBe('restored');

    const forget = b.sent.find(m => m.type === 'vault.forgetWallet') as unknown as {expectedRevision: string; replacement: EnvelopeV1; guard?: unknown};
    expect(forget.expectedRevision).toBe(envelopeRevision(env));
    expect(forget.guard).toBeUndefined();
    expect(forget.replacement.scheme).toBe('slip10');
    expect(forget.replacement.accounts).toEqual(env.accounts);
    const after = (await b.read()) as EnvelopeV1;
    expect(after.accounts.map(a => a.name)).toEqual(['Main', 'Rainy day']);
    expect(await decryptMnemonic(after, await unlockWithPassword(after, NEW_PW, kdf))).toBe(M);
    await expect(unlockWithPassword(after, OLD_PW, kdf)).rejects.toThrow();
    expect((await getSession(b.ext))?.map(a => a.publicKey)).toEqual(env.accounts.map(a => a.publicKey));
    expect(await b.ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1}]);
  });

  it('a proof the page did not mint, and a short password, send nothing', async () => {
    const env = await storedWallet(M, 'slip10', [0]);
    const b = await background(env);
    const forged: SeedProof = {kind: 'seed', env, revision: envelopeRevision(env), mnemonic: OTHER};
    expect(await restoreWallet({send: b.send, kdf}, forged, NEW_PW)).toBe('failed');
    const proven = await proveSeed(b.read, M);
    if (proven.outcome !== 'match') throw new Error(proven.outcome);
    expect(await restoreWallet({send: b.send, kdf}, proven.proof, 'short')).toBe('weak-password');
    expect(b.sent).toEqual([]);
    expect(await b.read()).toEqual(env);
  });

  it('a wallet that moved after the proof is busy, and nothing is written', async () => {
    const env = await storedWallet(M, 'slip10', [0]);
    const b = await background(env);
    const proven = await proveSeed(b.read, M);
    if (proven.outcome !== 'match') throw new Error(proven.outcome);
    const moved = {...env, seed: {...env.seed, iv: 'AAAAAAAAAAAAAAAA'}};
    await b.ext.local.set(VAULT_KEY, moved);
    expect(await restoreWallet({send: b.send, kdf}, proven.proof, NEW_PW)).toBe('busy');
    expect(await b.read()).toEqual(moved);
    expect(b.sent.map(m => m.type)).toEqual(['vault.forgetWallet']);
  });

  it.each([
    ['send-open', 'send-open'],
    ['unlocked', 'unlocked'],
    ['stored-invalid', 'damaged'],
    ['malformed', 'failed'],
    ['something new', 'failed'],
  ])("the background's %s is the page's %s", async (error, outcome) => {
    const env = await storedWallet(M, 'slip10', [0]);
    const b = await background(env);
    const proven = await proveSeed(b.read, M);
    if (proven.outcome !== 'match') throw new Error(proven.outcome);
    const refusing: Send = async m => ((m as {type: string}).type === 'vault.forgetWallet' ? {ok: false, error} : {ok: true});
    expect(await restoreWallet({send: refusing, kdf}, proven.proof, NEW_PW)).toBe(outcome);
  });
});

describe('the factor proof (#40 → #8 retry: the password of the wallet being replaced)', () => {
  it('proves the right password with no session and sends nothing; refuses a wrong one', async () => {
    const b = await background(await storedWallet(M, 'slip10', [0]));
    expect((await proveFactor(b.read, {password: OLD_PW, kdf})).outcome).toBe('proven');
    expect(await proveFactor(b.read, {password: 'not the password at all', kdf})).toEqual({outcome: 'wrong'});
    expect(b.sent).toEqual([]);
    expect(await getSession(b.ext)).toBeNull();
  });

  it('zeroes a passkey PRF output on every path', async () => {
    const prfOutput = new Uint8Array(32).fill(5);
    expect(await proveFactor(async () => undefined, {prfOutput})).toEqual({outcome: 'no-wallet'});
    expect(prfOutput.every(b => b === 0)).toBe(true);
  });
});

describe('replaceEmptyWallet: the factor-proven delete is ALWAYS guarded (C6), then a first write (D41)', () => {
  it('sends guard "unfunded" with the proven revision, removes the old wallet and stores the new one', async () => {
    const old = await storedWallet(M, 'slip10', [0]);
    const b = await background(old);
    const proven = await proveFactor(b.read, {password: OLD_PW, kdf});
    if (proven.outcome !== 'proven') throw new Error(proven.outcome);
    const next = await prepareWallet(kdf, {mnemonic: OTHER, password: NEW_PW, scheme: 'slip10', indexes: [0]});
    expect(await replaceEmptyWallet({...b.store, send: b.send}, proven.proof, next)).toBe('created');
    expect(b.sent.find(m => m.type === 'vault.forgetWallet')).toEqual({type: 'vault.forgetWallet', expectedRevision: envelopeRevision(old), guard: 'unfunded'});
    expect(((await b.read()) as EnvelopeV1).accounts.map(a => a.publicKey)).toEqual(next.env.accounts.map(a => a.publicKey));
    // A delete wipes the old wallet's recipients (D40).
    expect(await b.ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
  });

  it('funds that arrived meanwhile refuse it in the background, and the stored envelope is byte-identical', async () => {
    const old = await storedWallet(M, 'slip10', [0]);
    const b = await background(old, () => 1n);
    const proven = await proveFactor(b.read, {password: OLD_PW, kdf});
    if (proven.outcome !== 'proven') throw new Error(proven.outcome);
    const next = await prepareWallet(kdf, {mnemonic: OTHER, password: NEW_PW, scheme: 'slip10', indexes: [0]});
    expect(await replaceEmptyWallet({...b.store, send: b.send}, proven.proof, next)).toBe('funded');
    expect(JSON.stringify(await b.read())).toBe(JSON.stringify(old));
    expect(b.sent.map(m => m.type)).toEqual(['vault.forgetWallet']);
  });

  it('a proof the page did not mint sends nothing', async () => {
    const old = await storedWallet(M, 'slip10', [0]);
    const b = await background(old);
    const forged: FactorProof = {kind: 'factor', revision: envelopeRevision(old)};
    const next = await prepareWallet(kdf, {mnemonic: OTHER, password: NEW_PW, scheme: 'slip10', indexes: [0]});
    expect(await replaceEmptyWallet({...b.store, send: b.send}, forged, next)).toBe('failed');
    expect(b.sent).toEqual([]);
    expect(await b.read()).toEqual(old);
  });

  it('a failed store after the delete is store-failed; the retry is the store alone, and wallet-exists stops it (R2-L6)', async () => {
    const old = await storedWallet(M, 'slip10', [0]);
    const b = await background(old);
    const proven = await proveFactor(b.read, {password: OLD_PW, kdf});
    if (proven.outcome !== 'proven') throw new Error(proven.outcome);
    const next = await prepareWallet(kdf, {mnemonic: OTHER, password: NEW_PW, scheme: 'slip10', indexes: [0]});
    let failStore = true;
    const flaky: Send = async m => {
      if ((m as {type: string}).type === 'vault.storeEnvelope' && failStore) throw new Error('worker restarted');
      return b.send(m);
    };
    const store = backgroundVaultStore(flaky, b.read);
    expect(await replaceEmptyWallet({...store, send: flaky}, proven.proof, next)).toBe('store-failed');
    expect(await b.read()).toBeUndefined();
    // Another tab creates a wallet; [Try again] is commitWallet alone: 'exists', no second delete.
    const third = await storedWallet(OTHER, 'cli', [0]);
    await b.ext.local.set(VAULT_KEY, third);
    failStore = false;
    expect(await commitWallet({...store, send: flaky}, next)).toBe('exists');
    expect(b.sent.filter(m => m.type === 'vault.forgetWallet')).toHaveLength(1);
    expect(await b.read()).toEqual(third);
  });
});

// Only forgetFlow.ts may build vault.forgetWallet: every other vault-page file is held to it, so a
// screen cannot send an unguarded factor-proven delete by writing the message itself.
describe('the message is built in one place', () => {
  it('no src/unlock source file but forgetFlow.ts names vault.forgetWallet', () => {
    const root = join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
          if (e !== '__tests__') walk(p);
        } else if (/\.tsx?$/.test(e)) files.push(relative(root, p).split(sep).join('/'));
      }
    };
    walk(root);
    expect(files).toContain('forgetFlow.ts');
    expect(files.filter(f => readFileSync(join(root, f), 'utf8').includes('vault.forgetWallet'))).toEqual(['forgetFlow.ts']);
  });
});
