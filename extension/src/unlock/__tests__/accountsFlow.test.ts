import {argon2idAsync} from '@noble/hashes/argon2.js';
import * as envelopeModule from '../../vault/envelope';
import {addPasskeyWrap, createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {reencryptForAccounts} from '../../vault/reencrypt';
import {deriveSessionAccounts} from '../../vault/accounts';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {MAX_ACCOUNTS} from '../../shared/envelopeRules';
import {storeEnvelope} from '../../background/accountsStore';
import {addAccount, isAccountIndex, lowestFreeIndex, removeAccount} from '../accountsFlow';
import type {Send, VaultStore} from '../types';
import {memoryVault} from './memoryVault';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'correct horse battery';
let kdfCalls = 0;
const kdf: Kdf = (pw, salt) => (kdfCalls++, argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32}));

async function wallet(indexes: number[], scheme: 'slip10' | 'cli' = 'slip10', sessionMnemonic = MNEMONIC, prf?: Uint8Array, reply: (type: string) => {ok: boolean} = () => ({ok: true})) {
  // Real derived public keys: the background refuses anything else, and unlock compares them.
  const derived = await deriveSessionAccounts(MNEMONIC, scheme, indexes);
  const accounts = derived.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}));
  let opened: EnvelopeV1 = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme, accounts, kdf});
  if (prf !== undefined) {
    const dk = await unlockWithPassword(opened, PASSWORD, kdf);
    opened = await addPasskeyWrap(opened, dk, prf, new Uint8Array([9, 9, 9]), crypto.getRandomValues(new Uint8Array(32)));
    dk.fill(0);
  }
  const store = await memoryVault(opened);
  const session = await deriveSessionAccounts(sessionMnemonic, scheme, indexes);
  const sent: {type: string; accounts?: {index: number; publicKey: string}[]}[] = [];
  const send: Send = async m => {
    const msg = m as {type: string};
    sent.push(msg);
    if (msg.type === 'vault.status') return {ok: true, data: {unlocked: true, accounts: session.map(a => ({index: a.index, publicKey: a.publicKey}))}};
    return reply(msg.type);
  };
  kdfCalls = 0;
  return {deps: {...store, send}, store, sent, opened};
}

describe('accounts in the vault page', () => {
  it('adds the next SLIP-0010 account: re-encrypted under the same password, stored over the opened revision, new keys handed over (positive control)', async () => {
    const {deps, store, sent, opened} = await wallet([0]);
    expect(await addAccount(deps, {password: PASSWORD, kdf}, 1)).toBe('done');
    expect(store.calls).toEqual([{expectedRevision: envelopeRevision(opened), outcome: 'stored'}]);
    const env = store.writes[0]!;
    const expected = await deriveSessionAccounts(MNEMONIC, 'slip10', [0, 1]);
    expect(env.accounts).toEqual([
      {index: 0, name: 'Account 1', publicKey: expected[0]!.publicKey},
      {index: 1, name: 'Account 2', publicKey: expected[1]!.publicKey},
    ]);
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PASSWORD, kdf))).toBe(MNEMONIC);
    const setKeys = sent.at(-1)!;
    expect(setKeys.type).toBe('vault.setKeys');
    expect(setKeys.accounts?.map(a => a.publicKey)).toEqual(expected.map(a => a.publicKey));
  });

  it('removes an account, and refuses the last one and an unknown one', async () => {
    const two = await wallet([0, 1]);
    expect(await removeAccount(two.deps, {password: PASSWORD, kdf}, 1)).toBe('done');
    expect(two.store.writes[0]?.accounts.map(a => a.index)).toEqual([0]);
    expect(await decryptMnemonic(two.store.writes[0]!, await unlockWithPassword(two.store.writes[0]!, PASSWORD, kdf))).toBe(MNEMONIC);
    expect(two.sent.at(-1)?.accounts?.map(a => a.index)).toEqual([0]);
    const one = await wallet([0]);
    expect(await removeAccount(one.deps, {password: PASSWORD, kdf}, 0)).toBe('last-account');
    expect(await removeAccount(one.deps, {password: PASSWORD, kdf}, 5)).toBe('no-such-account');
    expect(one.store.calls).toHaveLength(0);
  });

  it('a change the background stored but whose keys it refused locks the vault — and says the accounts WERE changed', async () => {
    const refused = await wallet([0, 1], 'slip10', MNEMONIC, undefined, type => ({ok: type !== 'vault.setKeys'}));
    expect(await removeAccount(refused.deps, {password: PASSWORD, kdf}, 1)).toBe('done-locked');
    expect(refused.sent.map(m => m.type)).toEqual(['vault.status', 'vault.setKeys', 'vault.lock']);
    expect((await refused.store.stored())?.accounts.map(a => a.index)).toEqual([0]);
    const neither = await wallet([0], 'slip10', MNEMONIC, undefined, type => ({ok: type !== 'vault.setKeys' && type !== 'vault.lock'}));
    expect(await addAccount(neither.deps, {password: PASSWORD, kdf}, 1)).toBe('done-not-locked');
    expect(neither.sent.map(m => m.type)).toEqual(['vault.status', 'vault.setKeys', 'vault.lock']);
    expect((await neither.store.stored())?.accounts.map(a => a.index)).toEqual([0, 1]);
  });

  it(`refuses an account past MAX_ACCOUNTS (${MAX_ACCOUNTS}) by name, before re-encrypting`, async () => {
    const full = await wallet(Array.from({length: MAX_ACCOUNTS}, (_, i) => i));
    expect(await addAccount(full.deps, {password: PASSWORD, kdf}, 1)).toBe('too-many-accounts');
    expect(full.store.calls).toHaveLength(0);
    expect(full.sent.map(m => m.type)).toEqual(['vault.status']);
    // Deriving 100 keys takes ~6 s under a parallel run's CPU load — past vitest's 5 s default.
  }, 30_000);

  it('a cli wallet has exactly one account', async () => {
    const cli = await wallet([0], 'cli');
    expect(await addAccount(cli.deps, {password: PASSWORD, kdf}, 1)).toBe('cli-single');
    expect(cli.store.calls).toHaveLength(0);
  });

  it('B1b-2b E13: a cli wallet\'s account 0 can never be removed, nor added over; nothing is stored', async () => {
    const cli = await wallet([0], 'cli');
    expect(await removeAccount(cli.deps, {password: PASSWORD, kdf}, 0)).toBe('last-account');
    expect(await addAccount(cli.deps, {password: PASSWORD, kdf}, 0)).toBe('cli-single');
    expect(cli.store.calls).toHaveLength(0);
    expect((await cli.store.stored())?.accounts.map(a => a.index)).toEqual([0]);
  });

  it('a wrong password changes nothing; a proof mismatch locks the vault and changes nothing', async () => {
    const w = await wallet([0]);
    expect(await addAccount(w.deps, {password: 'nope nope nope nope', kdf}, 1)).toBe('wrong');
    expect(w.store.calls).toHaveLength(0);
    const foreign = await wallet([0], 'slip10', OTHER);
    expect(await addAccount(foreign.deps, {password: PASSWORD, kdf}, 1)).toBe('mismatch-locked');
    expect(foreign.sent.map(m => m.type)).toEqual(['vault.status', 'vault.lock']);
    expect(foreign.store.calls).toHaveLength(0);
  });

  it('busy: the whole flow runs again once — a fresh read and a fresh proof — and stores over the NEW revision', async () => {
    const {deps, store, opened, sent} = await wallet([0]);
    // Another tab adds account 3 between this flow's read and its store.
    let moved = '';
    store.setBeforeStore(async call => {
      if (call !== 0) return;
      const dk = await unlockWithPassword(opened, PASSWORD, kdf);
      const next = await reencryptForAccounts(opened, dk, [{index: 0, name: 'Account 1'}, {index: 2, name: 'Account 3'}]);
      dk.fill(0);
      moved = envelopeRevision(next);
      expect(await storeEnvelope(store.ext, envelopeRevision(opened), next)).toBe('stored');
    });
    expect(await addAccount(deps, {password: PASSWORD, kdf}, 1)).toBe('done');
    expect(store.calls).toEqual([
      {expectedRevision: envelopeRevision(opened), outcome: 'busy'},
      {expectedRevision: moved, outcome: 'stored'},
    ]);
    // Ours twice (the proof is re-run, not skipped), the other tab's once.
    expect(kdfCalls).toBe(3);
    expect(sent.filter(m => m.type === 'vault.status')).toHaveLength(2);
    // The second attempt built on the other tab's envelope: 0, 2, and ours appended — 1.
    expect((await store.stored())?.accounts.map(a => a.index)).toEqual([0, 2, 1]);
  });

  it('B1b-2b E13: re-adding a removed middle account brings back the same address (explicit index, C6)', async () => {
    const three = await wallet([0, 1, 2]);
    const before = (await three.store.stored())!.accounts.find(a => a.index === 1)!.publicKey;
    expect(await removeAccount(three.deps, {password: PASSWORD, kdf}, 1)).toBe('done');
    expect((await three.store.stored())?.accounts.map(a => a.index)).toEqual([0, 2]);
    expect(await addAccount(three.deps, {password: PASSWORD, kdf}, 1)).toBe('done');
    const after = (await three.store.stored())!;
    expect(after.accounts.map(a => a.index)).toEqual([0, 2, 1]);
    expect(after.accounts.find(a => a.index === 1)).toEqual({index: 1, name: 'Account 2', publicKey: before});
  });

  it('B1b-2b E13: index-taken after a proof; bad-index before anything (no read, no proof, PRF zeroed)', async () => {
    const two = await wallet([0, 1]);
    expect(await addAccount(two.deps, {password: PASSWORD, kdf}, 1)).toBe('index-taken');
    expect(await addAccount(two.deps, {password: PASSWORD, kdf}, 0)).toBe('index-taken');
    expect(two.store.calls).toHaveLength(0);
    expect((await two.store.stored())?.accounts.map(a => a.index)).toEqual([0, 1]);
    for (const bad of [-1, 1.5, 2 ** 31, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const w = await wallet([0]);
      const prfOutput = crypto.getRandomValues(new Uint8Array(32));
      expect(await addAccount(w.deps, {prfOutput}, bad)).toBe('bad-index');
      expect(prfOutput.every(b => b === 0)).toBe(true);
      expect(w.sent).toEqual([]);
      expect(kdfCalls).toBe(0);
    }
    // The hardened limit itself is an account number.
    expect(isAccountIndex(2 ** 31 - 1)).toBe(true);
    expect(isAccountIndex(2 ** 31)).toBe(false);
  });

  it('C6: lowestFreeIndex', () => {
    expect(lowestFreeIndex([0])).toBe(1);
    expect(lowestFreeIndex([0, 2])).toBe(1);
    expect(lowestFreeIndex([1, 2])).toBe(0);
    expect(lowestFreeIndex([0, 1, 2])).toBe(3);
    expect(lowestFreeIndex([])).toBe(0);
  });

  it('C5: a remove the background refuses as send-open is `send-open`, and nothing changes', async () => {
    const two = await wallet([0, 1]);
    const refusing = vi.fn<VaultStore['storeEnvelope']>(async () => 'send-open');
    expect(await removeAccount({...two.deps, storeEnvelope: refusing}, {password: PASSWORD, kdf}, 1)).toBe('send-open');
    expect(refusing).toHaveBeenCalledTimes(1);
    expect(two.sent.filter(m => m.type === 'vault.setKeys')).toHaveLength(0);
  });

  it('a passkey factor survives the retry and is zeroed only at the end', async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const {deps, store, opened} = await wallet([0], 'slip10', MNEMONIC, prf);
    store.setBeforeStore(async call => {
      if (call !== 0) return;
      const dk = await unlockWithPassword(opened, PASSWORD, kdf);
      const next = await reencryptForAccounts(opened, dk, [{index: 0, name: 'Account 1'}]);
      dk.fill(0);
      await storeEnvelope(store.ext, envelopeRevision(opened), next);
    });
    const prfOutput = prf.slice();
    expect(await addAccount(deps, {prfOutput}, 1)).toBe('done');
    expect(store.calls.map(c => c.outcome)).toEqual(['busy', 'stored']);
    expect(prfOutput.every(b => b === 0)).toBe(true);
  });

  it('busy twice gives up; a stored envelope the background cannot read is damaged, not retried; neither hands over keys', async () => {
    const {deps, sent} = await wallet([0]);
    const busy = vi.fn<VaultStore['storeEnvelope']>(async () => 'busy');
    expect(await addAccount({...deps, storeEnvelope: busy}, {password: PASSWORD, kdf}, 1)).toBe('failed');
    expect(busy).toHaveBeenCalledTimes(2);
    expect(kdfCalls).toBe(2);
    const invalid = vi.fn<VaultStore['storeEnvelope']>(async () => 'stored-invalid');
    expect(await addAccount({...deps, storeEnvelope: invalid}, {password: PASSWORD, kdf}, 1)).toBe('damaged');
    expect(invalid).toHaveBeenCalledTimes(1);
    const gone = vi.fn<VaultStore['storeEnvelope']>(async () => 'no-wallet');
    expect(await addAccount({...deps, storeEnvelope: gone}, {password: PASSWORD, kdf}, 1)).toBe('no-wallet');
    expect(sent.filter(m => m.type === 'vault.setKeys')).toHaveLength(0);
  });

  it('zeroes every data key it unwrapped, on success, on a retry and on a refused store', async () => {
    const keys: Uint8Array[] = [];
    const original = envelopeModule.unlockWithPassword;
    const spy = vi.spyOn(envelopeModule, 'unlockWithPassword').mockImplementation(async (...args) => {
      const k = await original(...args);
      keys.push(k);
      return k;
    });
    try {
      const ok = await wallet([0]);
      const refused = await wallet([0, 1]);
      expect(await addAccount(ok.deps, {password: PASSWORD, kdf}, 1)).toBe('done');
      expect(await removeAccount({...refused.deps, storeEnvelope: async () => 'busy'}, {password: PASSWORD, kdf}, 1)).toBe('failed');
      expect(await removeAccount({...refused.deps, storeEnvelope: async () => 'malformed'}, {password: PASSWORD, kdf}, 1)).toBe('failed');
      // One for the add, two for the busy remove (the proof re-run), one for the refused remove.
      expect(keys).toHaveLength(4);
      for (const k of keys) expect(k.every(b => b === 0)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
