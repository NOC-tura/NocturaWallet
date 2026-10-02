import {argon2idAsync} from '@noble/hashes/argon2.js';
import {base64} from '@scure/base';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type Kdf} from '../../vault/envelope';
import {passkeyOf, storedVault} from '../stored';
import {addPasskey, finishOnboarding} from '../onboarding';
import {addAccount} from '../accountsFlow';
import {runReveal} from '../revealFlow';
import {runReauth} from '../reauthFlow';
import type {Send} from '../types';
import {memoryVault} from './memoryVault';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'correct horse battery';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
let kdfCalls = 0;
const kdf: Kdf = (pw, salt) => (kdfCalls++, argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32}));
const ID = 'ab'.repeat(16);

function recorder() {
  const sent: unknown[] = [];
  const send: Send = async m => {
    sent.push(m);
    return {ok: true, data: {unlocked: true, accounts: [{index: 0, publicKey: K0}]}};
  };
  return {sent, send};
}

// Plan-1 carry (Task 7 review): the background answers 'stored-invalid' for anything in v1_vault that
// is not an envelope — null included — and 'no-wallet' only for an absent key. The page now agrees at
// every place it reads the vault.
describe('storedVault: the page reads v1_vault as the background does', () => {
  it('absent is "none"; a real envelope is a wallet', async () => {
    expect(storedVault(undefined)).toEqual({kind: 'none'});
    const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf});
    expect(storedVault(env)).toEqual({kind: 'wallet', env});
  });

  // An object table, not a bare array: it.each spreads a row that is itself an array (e.g. `[]`) into
  // zero title arguments, printing "undefined" for that case (Fable review, fix round 1 item 6) — a
  // named `$label` field sidesteps that rather than relying on the row's own shape.
  it.each([
    {label: 'null', raw: null},
    {label: '[]', raw: []},
    {label: '"v1_vault"', raw: 'v1_vault'},
    {label: '0', raw: 0},
    {label: '{"v":1}', raw: {v: 1}},
  ])('a stored $label is damaged, never "none"', ({raw}) => {
    expect(storedVault(raw)).toEqual({kind: 'damaged'});
  });

  // Fix round 1 item 1: checkEnvelope alone is weaker than the background's envelopeShape (it never
  // checked these four), so a vault the background calls stored-invalid used to read here as a whole
  // wallet. accountsPolicyOk (src/shared/envelopeRules.ts) is the one predicate both sides now apply.
  // One test per rule, each a real, otherwise-well-formed envelope (createEnvelope), damaged in
  // exactly one way.
  it('damaged past MAX_ACCOUNTS: checkEnvelope alone would accept it', async () => {
    const accounts = Array.from({length: 101}, (_, i) => ({index: i, name: `A${i}`, publicKey: `k${i}`}));
    const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts, kdf});
    expect(storedVault(env)).toEqual({kind: 'damaged'});
  });

  it('damaged on a duplicate account index: checkEnvelope alone would accept it', async () => {
    const accounts = [
      {index: 0, name: 'A', publicKey: K0},
      {index: 0, name: 'B', publicKey: 'k1'},
    ];
    const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts, kdf});
    expect(storedVault(env)).toEqual({kind: 'damaged'});
  });

  it('damaged on an empty publicKey: checkEnvelope alone would accept it (it only checks the type)', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: ''}], kdf});
    expect(storedVault(env)).toEqual({kind: 'damaged'});
  });

  it('damaged on a cli wallet with other than exactly account 0: checkEnvelope alone would accept it', async () => {
    const twoAccounts = await createEnvelope({
      mnemonic: MNEMONIC,
      password: PASSWORD,
      scheme: 'cli',
      accounts: [
        {index: 0, name: 'A', publicKey: K0},
        {index: 1, name: 'B', publicKey: 'k1'},
      ],
      kdf,
    });
    expect(storedVault(twoAccounts)).toEqual({kind: 'damaged'});
    const wrongIndex = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'cli', accounts: [{index: 1, name: 'A', publicKey: K0}], kdf});
    expect(storedVault(wrongIndex)).toEqual({kind: 'damaged'});
  });
});

// Fix round 1 item 2: the passkey-button bootstraps (main.ts, modes.ts startReauth) used to cast the
// raw storage read straight to EnvelopeV1 and read .passkey off it — offering a passkey button over
// a damaged vault that happened to carry a passkey-shaped field. Both now call passkeyOf, which only
// answers off a whole, undamaged wallet (storedVault).
describe('passkeyOf: a passkey button is offered only over a whole, undamaged wallet', () => {
  it('no passkey on a plain wallet, absent vault, or damaged vault — even one shaped like a passkey', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf});
    expect(passkeyOf(env)).toBeUndefined();
    expect(passkeyOf(undefined)).toBeUndefined();
    expect(passkeyOf(null)).toBeUndefined();
    expect(passkeyOf({...env, accounts: []})).toBeUndefined();
    // Well-formed passkey bytes, but on an otherwise damaged envelope (empty accounts) — checkEnvelope
    // must still refuse the whole thing, so passkeyOf must not read the passkey off it regardless.
    const bytes = (n: number) => base64.encode(new Uint8Array(n));
    expect(
      passkeyOf({...env, accounts: [], passkey: {credentialId: bytes(16), prfSalt: bytes(32), wrapped: bytes(40)}}),
    ).toBeUndefined();
  });

  it("returns the stored passkey once it's on a whole, undamaged wallet", async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf});
    const dataKey = await unlockWithPassword(env, PASSWORD, kdf);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const credentialId = crypto.getRandomValues(new Uint8Array(16));
    const prfSalt = crypto.getRandomValues(new Uint8Array(32));
    const withPasskey = await addPasskeyWrap(env, dataKey, prf, credentialId, prfSalt);
    dataKey.fill(0);
    expect(passkeyOf(withPasskey)).toEqual(withPasskey.passkey);
  });
});

describe('every page flow reads a stored null as a damaged wallet, never as "no wallet"', () => {
  beforeEach(() => {
    kdfCalls = 0;
  });

  it('onboarding refuses to write over it before any Argon2id run, and stores nothing', async () => {
    const store = await memoryVault(null);
    const {sent, send} = recorder();
    expect(await finishOnboarding({...store, send, kdf}, {mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('exists');
    expect(kdfCalls).toBe(0);
    expect(store.calls).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('adding a passkey, adding an account, revealing and re-authenticating say damaged and send nothing', async () => {
    const store = await memoryVault(null);
    const {sent, send} = recorder();
    const randomBytes = (n: number) => new Uint8Array(n);
    const credentials = {create: async () => null, get: async () => null};
    expect(await addPasskey({...store, credentials, randomBytes}, {password: PASSWORD, kdf})).toBe('damaged');
    expect(await addAccount({...store, send}, {password: PASSWORD, kdf})).toBe('damaged');
    expect(await runReveal({readEnvelope: store.readEnvelope, send}, {password: PASSWORD, kdf})).toEqual({outcome: 'damaged'});
    expect(await runReauth({readEnvelope: store.readEnvelope, send}, ID, {password: PASSWORD, kdf})).toBe('damaged');
    expect(sent).toEqual([]);
    expect(kdfCalls).toBe(0);
    expect(store.calls).toEqual([]);
  });

  it('an absent vault is still "no wallet" (negative control of the rule above)', async () => {
    const store = await memoryVault();
    const {send} = recorder();
    expect(await addAccount({...store, send}, {password: PASSWORD, kdf})).toBe('no-wallet');
    expect(await runReveal({readEnvelope: store.readEnvelope, send}, {password: PASSWORD, kdf})).toEqual({outcome: 'no-wallet'});
    expect(await runReauth({readEnvelope: store.readEnvelope, send}, ID, {password: PASSWORD, kdf})).toBe('no-wallet');
  });
});
