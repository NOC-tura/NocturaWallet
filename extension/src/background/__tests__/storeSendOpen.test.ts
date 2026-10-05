import {base64} from '@scure/base';
import {VAULT_KEY, storeEnvelope} from '../accountsStore';
import {PENDING_KEY} from '../pendingStore';
import {SETTINGS_KEY} from '../settings';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {fakeExt} from './fakeExt';
import {pendingRecord} from './fixtures';

// B1b-2b C5: storeEnvelope refuses to drop an account whose send is still open — in the background, because the vault
// page cannot read v1_pending.
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const K2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const THREE = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [
    {index: 0, name: 'A', publicKey: K0},
    {index: 1, name: 'B', publicKey: K1},
    {index: 2, name: 'C', publicKey: K2},
  ],
};
const REV = envelopeRevision(THREE as Parameters<typeof envelopeRevision>[0]);
const reencrypted = (accounts: typeof THREE.accounts) => ({...THREE, seed: {iv: B(12, 5), ct: B(48, 6)}, accounts});
const WITHOUT_1 = reencrypted([THREE.accounts[0]!, THREE.accounts[2]!]);

async function wallet(records: object[]) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, THREE);
  await ext.local.set(PENDING_KEY, records);
  return ext;
}

describe('storeEnvelope: C5 send-open', () => {
  it('refuses a store that drops an account with a pending or stuck send; nothing is written', async () => {
    for (const state of ['pending', 'stuck'] as const) {
      const ext = await wallet([pendingRecord({account: K1, state})]);
      expect(await storeEnvelope(ext, REV, WITHOUT_1)).toBe('send-open');
      expect(await ext.local.get(VAULT_KEY)).toEqual(THREE);
    }
  });

  it('accepts it once the send is closed (confirmed, failed, expired)', async () => {
    for (const state of ['confirmed', 'failed', 'expired'] as const) {
      const ext = await wallet([pendingRecord({account: K1, state})]);
      expect(await storeEnvelope(ext, REV, WITHOUT_1)).toBe('stored');
    }
  });

  it('an open send from an account the change KEEPS does not refuse it — whichever account is selected', async () => {
    const ext = await wallet([pendingRecord({account: K0}), pendingRecord({id: 'r2', account: K2})]);
    expect(await storeEnvelope(ext, REV, WITHOUT_1)).toBe('stored');
  });

  it('an open send from a dropped account refuses even when another account’s send is open too', async () => {
    const ext = await wallet([pendingRecord({account: K0}), pendingRecord({id: 'r2', account: K1})]);
    expect(await storeEnvelope(ext, REV, WITHOUT_1)).toBe('send-open');
  });

  it('the check is on the DROPPED account, not the selected one: a kept, selected, idle account does not hide it', async () => {
    for (const selectedAccount of [0, 2]) {
      const ext = await wallet([pendingRecord({account: K1})]);
      await ext.local.set(SETTINGS_KEY, {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount});
      expect(await storeEnvelope(ext, REV, WITHOUT_1)).toBe('send-open');
      expect(await ext.local.get(VAULT_KEY)).toEqual(THREE);
    }
  });

  it('adding an account while a send is open is fine (nothing dropped)', async () => {
    const two = {...THREE, accounts: THREE.accounts.slice(0, 2)};
    const ext = fakeExt();
    await ext.local.set(VAULT_KEY, two);
    await ext.local.set(PENDING_KEY, [pendingRecord({account: K1})]);
    expect(await storeEnvelope(ext, envelopeRevision(two as Parameters<typeof envelopeRevision>[0]), reencrypted(THREE.accounts))).toBe('stored');
  });
});
