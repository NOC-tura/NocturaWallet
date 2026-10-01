import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type Kdf} from '../../vault/envelope';
import {storedVault} from '../stored';
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

  it.each([null, [], 'v1_vault', 0, {v: 1}])('a stored %j is damaged, never "none"', raw => {
    expect(storedVault(raw)).toEqual({kind: 'damaged'});
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
