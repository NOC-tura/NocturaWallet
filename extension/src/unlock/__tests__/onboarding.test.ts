import {argon2idAsync} from '@noble/hashes/argon2.js';
import {validateMnemonic} from '../../../../core/keys/mnemonic';
import * as envelopeModule from '../../vault/envelope';
import {createEnvelope, decryptMnemonic, unlockWithPassword, unlockWithPrf, type Kdf} from '../../vault/envelope';
import {reencryptForAccounts} from '../../vault/reencrypt';
import * as passkeyModule from '../../vault/passkey';
import type {CredentialsApi} from '../../vault/passkey';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {storeEnvelope} from '../../background/accountsStore';
import {acceptedPhrase, addPasskey, chooseScheme, detectImport, finishOnboarding, importCandidates, indexesFor, newMnemonic, probeCandidates, type Candidate} from '../onboarding';
import type {Send} from '../types';
import {memoryVault} from './memoryVault';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'correct horse battery';
// The pinned SLIP-0010 account 0 of MNEMONIC (the app's vector): stored fixtures carry real keys.
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
// The app's cli vector (core/keys/__tests__/transparent.test.ts, c5785e18…), in base58.
const KCLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
// A valid 18-word phrase (BIP-39's all-zero 192-bit vector): valid, but not a length the wallet imports.
const EIGHTEEN = `${'abandon '.repeat(17)}agent`;
// Declares production Argon2id (the envelope refuses less), computes a tiny cost: see envelope.test.ts.
let kdfCalls = 0;
const kdf: Kdf = (pw, salt) => (kdfCalls++, argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32}));
const existingWallet = () => createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf});

function recorder(reply: (m: {type: string}) => {ok: boolean; data?: unknown} = () => ({ok: true})) {
  const sent: {type: string; [k: string]: unknown}[] = [];
  const send: Send = async m => {
    sent.push(m as {type: string});
    return reply(m as {type: string});
  };
  return {sent, send};
}

describe('create', () => {
  it('a new phrase is 24 valid words (256 bits)', () => {
    const m = newMnemonic();
    expect(m.split(' ')).toHaveLength(24);
    expect(validateMnemonic(m)).toBe(true);
  });
});

describe('import detection', () => {
  it("derives SLIP-0010 accounts 0–4 and cli locally — the app's vectors", async () => {
    const c = await importCandidates(MNEMONIC);
    expect(c).toHaveLength(6);
    expect(c[0]).toEqual({scheme: 'slip10', index: 0, publicKey: K0});
    expect(c[5]).toEqual({scheme: 'cli', index: 0, publicKey: KCLI});
    expect(new Set(c.map(x => x.publicKey)).size).toBe(6);
  });

  it('asks the background for balances with public keys only, and reads funded from SOL or NOC', async () => {
    const c = await importCandidates(MNEMONIC);
    const {sent, send} = recorder(() => ({
      ok: true,
      data: {resolved: true, balances: [{publicKey: c[0]!.publicKey, lamports: '0', noc: '7'}, {publicKey: c[1]!.publicKey, lamports: '0', noc: '0'}]},
    }));
    const probe = await probeCandidates(send, c);
    expect(sent).toEqual([{type: 'wallet.probeBalances', publicKeys: c.map(x => x.publicKey)}]);
    expect([...probe.funded]).toEqual([c[0]!.publicKey]);
    expect(probe.resolved).toBe(true);
  });

  it('an unanswered or refused probe is "unresolved", never "nothing funded"', async () => {
    const c = await importCandidates(MNEMONIC);
    const failing: Send = async () => {
      throw new Error('gone');
    };
    expect((await probeCandidates(failing, c)).resolved).toBe(false);
    expect((await probeCandidates(recorder(() => ({ok: false})).send, c)).resolved).toBe(false);
    expect((await probeCandidates(recorder(() => ({ok: true, data: {resolved: false, balances: []}})).send, c)).resolved).toBe(false);
  });

  it('only 12 or 24 words, as the app (spec §2): a valid 18-word phrase is refused before any probe', async () => {
    expect(validateMnemonic(EIGHTEEN)).toBe(true);
    expect(acceptedPhrase(EIGHTEEN)).toBe(false);
    expect(acceptedPhrase(MNEMONIC)).toBe(true);
    expect(acceptedPhrase(`  ${MNEMONIC.toUpperCase()}.`)).toBe(true);
    expect(acceptedPhrase(newMnemonic())).toBe(true);
    const {sent, send} = recorder();
    expect(await detectImport(send, EIGHTEEN)).toEqual({outcome: 'invalid-mnemonic'});
    expect(sent).toHaveLength(0);
  });

  it('detectImport: an unresolved probe makes the user choose; a funded cli picks cli', async () => {
    const unresolved = recorder(() => ({ok: true, data: {resolved: false, balances: []}}));
    const d = await detectImport(unresolved.send, MNEMONIC);
    expect(d.outcome === 'detected' && d.choice).toEqual({choose: 'unresolved'});
    expect(unresolved.sent.map(m => m.type)).toEqual(['wallet.probeBalances']);
    const cli = recorder(() => ({ok: true, data: {resolved: true, balances: [{publicKey: KCLI, lamports: '1', noc: '0'}]}}));
    const e = await detectImport(cli.send, MNEMONIC);
    expect(e.outcome === 'detected' && e.choice).toEqual({scheme: 'cli'});
  });

  it('funded wins; both funded or unresolved means the user chooses', async () => {
    const c = await importCandidates(MNEMONIC);
    const funded = (...keys: Candidate[]) => ({resolved: true, funded: new Set(keys.map(k => k.publicKey))});
    expect(chooseScheme(c, funded())).toEqual({scheme: 'slip10'});
    expect(indexesFor('slip10', c, funded())).toEqual([0]);
    expect(chooseScheme(c, funded(c[2]!))).toEqual({scheme: 'slip10'});
    expect(indexesFor('slip10', c, funded(c[2]!))).toEqual([0, 1, 2]);
    expect(chooseScheme(c, funded(c[5]!))).toEqual({scheme: 'cli'});
    expect(indexesFor('cli', c, funded(c[5]!))).toEqual([0]);
    expect(chooseScheme(c, funded(c[0]!, c[5]!))).toEqual({choose: 'both-funded'});
    expect(chooseScheme(c, {resolved: false, funded: new Set()})).toEqual({choose: 'unresolved'});
  });
});

describe('finishOnboarding', () => {
  beforeEach(() => {
    kdfCalls = 0;
  });

  it('stores the envelope as a first write and hands the background the keys (positive control); the phrase is stored normalised', async () => {
    const store = await memoryVault();
    const {sent, send} = recorder();
    const typed = `  ${MNEMONIC.toUpperCase().replace(/ /g, '  ')}.`;
    expect(await finishOnboarding({...store, send, kdf}, {mnemonic: typed, password: PASSWORD, scheme: 'slip10', indexes: [0, 1]})).toBe('created');
    expect(store.calls).toEqual([{expectedRevision: null, outcome: 'stored'}]);
    const env = store.writes[0]!;
    expect(env.accounts.map(a => [a.index, a.name])).toEqual([[0, 'Account 1'], [1, 'Account 2']]);
    expect(env.accounts[0]?.publicKey).toBe(K0);
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PASSWORD, kdf))).toBe(MNEMONIC);
    const setKeys = sent[0] as {type: string; accounts: {publicKey: string}[]};
    expect(setKeys.type).toBe('vault.setKeys');
    expect(setKeys.accounts.map(a => a.publicKey)).toEqual(env.accounts.map(a => a.publicKey));
  });

  it('refuses a short password and an invalid phrase, and writes nothing', async () => {
    const store = await memoryVault();
    const {send} = recorder();
    expect(await finishOnboarding({...store, send, kdf}, {mnemonic: MNEMONIC, password: 'x'.repeat(11), scheme: 'slip10', indexes: [0]})).toBe('weak-password');
    expect(await finishOnboarding({...store, send, kdf}, {mnemonic: 'abandon '.repeat(12).trim(), password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('invalid-mnemonic');
    expect(await finishOnboarding({...store, send, kdf}, {mnemonic: EIGHTEEN, password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('invalid-mnemonic');
    expect(store.calls).toHaveLength(0);
  });

  it('never overwrites a vault — checked before the Argon2id run', async () => {
    const store = await memoryVault(await existingWallet());
    kdfCalls = 0;
    expect(await finishOnboarding({...store, send: recorder().send, kdf}, {mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('exists');
    expect(kdfCalls).toBe(0);
    expect(store.calls).toHaveLength(0);
  });

  it('— and again at the store, when another tab finished first (the background refuses the first write)', async () => {
    const existing = await existingWallet();
    const store = await memoryVault(existing);
    let reads = 0;
    const racing = {...store, readEnvelope: async () => (reads++ === 0 ? undefined : existing)};
    const {sent, send} = recorder();
    expect(await finishOnboarding({...racing, send, kdf}, {mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('exists');
    expect(store.calls).toEqual([{expectedRevision: null, outcome: 'wallet-exists'}]);
    expect(await store.stored()).toEqual(existing);
    expect(sent).toHaveLength(0);
  });

  it('a refused hand-over still leaves the wallet created — to unlock normally', async () => {
    const store = await memoryVault();
    expect(await finishOnboarding({...store, send: recorder(() => ({ok: false})).send, kdf}, {mnemonic: MNEMONIC, password: PASSWORD, scheme: 'cli', indexes: [0]})).toBe('created-locked');
    expect(store.writes[0]?.scheme).toBe('cli');
  });

  it('a store the background refuses is a failure, and no keys are handed over', async () => {
    for (const outcome of ['malformed', 'failed', 'busy', 'stored-invalid'] as const) {
      const {sent, send} = recorder();
      const store = {readEnvelope: async () => undefined, storeEnvelope: async () => outcome};
      expect(await finishOnboarding({...store, send, kdf}, {mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('failed');
      expect(sent).toHaveLength(0);
    }
  });
});

describe('addPasskey', () => {
  function credentials(prf: Uint8Array | null): CredentialsApi & {creates: number} {
    const cred = (withPrf: boolean) =>
      ({
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        getClientExtensionResults: () => (withPrf && prf !== null ? {prf: {results: {first: prf.slice().buffer}}} : {}),
      }) as unknown as Credential;
    const api = {
      creates: 0,
      create: async () => (api.creates++, cred(false)),
      get: async () => cred(true),
    };
    return api;
  }
  const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

  it('wraps the data key for the passkey over the opened revision (positive control): the PRF output then unlocks it', async () => {
    const opened = await existingWallet();
    const store = await memoryVault(opened);
    const prf = randomBytes(32);
    expect(await addPasskey({...store, credentials: credentials(prf), randomBytes}, {password: PASSWORD, kdf})).toBe('added');
    expect(store.calls).toEqual([{expectedRevision: envelopeRevision(opened), outcome: 'stored'}]);
    const env = store.writes[0]!;
    expect(await decryptMnemonic(env, await unlockWithPrf(env, prf))).toBe(MNEMONIC);
  });

  it('unsupported (no PRF), a wrong password and no wallet write nothing', async () => {
    const store = await memoryVault(await existingWallet());
    expect(await addPasskey({...store, credentials: credentials(null), randomBytes}, {password: PASSWORD, kdf})).toBe('unsupported');
    expect(await addPasskey({...store, credentials: credentials(randomBytes(32)), randomBytes}, {password: 'wrong wrong wrong', kdf})).toBe('wrong');
    const empty = await memoryVault();
    expect(await addPasskey({...empty, credentials: credentials(null), randomBytes}, {password: PASSWORD, kdf})).toBe('no-wallet');
    expect(store.calls).toHaveLength(0);
    expect(empty.calls).toHaveLength(0);
  });

  it('busy: re-opens and proves the password again, once, with the same passkey — then stores over the NEW revision', async () => {
    const opened = await existingWallet();
    const store = await memoryVault(opened);
    // Another tab re-encrypts the seed between this flow's read and its store: the revision moves.
    let moved = '';
    store.setBeforeStore(async call => {
      if (call !== 0) return;
      const dk = await unlockWithPassword(opened, PASSWORD, kdf);
      const next = await reencryptForAccounts(opened, dk, [{index: 0, name: 'A'}]);
      dk.fill(0);
      moved = envelopeRevision(next);
      expect(await storeEnvelope(store.ext, envelopeRevision(opened), next)).toBe('stored');
    });
    const prf = randomBytes(32);
    const api = credentials(prf);
    kdfCalls = 0;
    expect(await addPasskey({...store, credentials: api, randomBytes}, {password: PASSWORD, kdf})).toBe('added');
    expect(store.calls).toEqual([
      {expectedRevision: envelopeRevision(opened), outcome: 'busy'},
      {expectedRevision: moved, outcome: 'stored'},
    ]);
    expect(api.creates).toBe(1);
    // Two proofs of the password (the other tab's own unlock ran one more).
    expect(kdfCalls).toBe(3);
    const env = store.writes[0]!;
    expect(await decryptMnemonic(env, await unlockWithPrf(env, prf))).toBe(MNEMONIC);
  });

  it('busy twice gives up; a stored envelope the background cannot read is damaged, not retried', async () => {
    const env = await existingWallet();
    const busy = {readEnvelope: async () => env, storeEnvelope: vi.fn(async () => 'busy' as const)};
    expect(await addPasskey({...busy, credentials: credentials(randomBytes(32)), randomBytes}, {password: PASSWORD, kdf})).toBe('failed');
    expect(busy.storeEnvelope).toHaveBeenCalledTimes(2);
    const invalid = {readEnvelope: async () => env, storeEnvelope: vi.fn(async () => 'stored-invalid' as const)};
    expect(await addPasskey({...invalid, credentials: credentials(randomBytes(32)), randomBytes}, {password: PASSWORD, kdf})).toBe('damaged');
    expect(invalid.storeEnvelope).toHaveBeenCalledTimes(1);
  });

  it('zeroes every data key it unwrapped and the PRF output, on success and on failure', async () => {
    const keys: Uint8Array[] = [];
    const original = envelopeModule.unlockWithPassword;
    const spy = vi.spyOn(envelopeModule, 'unlockWithPassword').mockImplementation(async (...args) => {
      const k = await original(...args);
      keys.push(k);
      return k;
    });
    try {
      const prf = randomBytes(32);
      const outputs: Uint8Array[] = [];
      const origReg = passkeyModule.registerPasskey;
      const regSpy = vi.spyOn(passkeyModule, 'registerPasskey').mockImplementation(async (...args) => {
        const r = await origReg(...args);
        if ('prfOutput' in r) outputs.push(r.prfOutput);
        return r;
      });
      try {
        const env = await existingWallet();
        expect(await addPasskey({...(await memoryVault(env)), credentials: credentials(prf), randomBytes}, {password: PASSWORD, kdf})).toBe('added');
        const failing = {readEnvelope: async () => env, storeEnvelope: async () => 'malformed' as const};
        expect(await addPasskey({...failing, credentials: credentials(prf), randomBytes}, {password: PASSWORD, kdf})).toBe('failed');
      } finally {
        regSpy.mockRestore();
      }
      expect(keys).toHaveLength(2);
      expect(outputs).toHaveLength(2);
      for (const k of [...keys, ...outputs]) expect(k.every(b => b === 0)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
