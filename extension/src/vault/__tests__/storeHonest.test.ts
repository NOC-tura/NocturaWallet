import {argon2idAsync} from '@noble/hashes/argon2.js';
import {addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1, type Kdf} from '../envelope';
import {reencryptForAccounts} from '../reencrypt';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {VAULT_KEY, storeEnvelope} from '../../background/accountsStore';
import {fakeExt} from '../../background/__tests__/fakeExt';

/**
 * Positive controls for the background's refusals (fix round 3): what the vault page honestly
 * produces — onboarding's envelope, an account added and removed by reencryptForAccounts, a passkey
 * enrolled by addPasskeyWrap — is stored, each over the revision of the envelope it opened.
 */
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const PASSWORD = 'correct horse battery';

describe('the background stores what the vault page honestly produces', () => {
  it('onboarding, add, passkey enrolment, remove: each stored, and the result still unlocks', async () => {
    const ext = fakeExt();
    const read = async () => (await ext.local.get(VAULT_KEY)) as EnvelopeV1;
    const created = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}], kdf});
    expect(await storeEnvelope(ext, null, created)).toBe('stored');

    let opened = await read();
    let dk = await unlockWithPassword(opened, PASSWORD, kdf);
    const added = await reencryptForAccounts(opened, dk, [{index: 0, name: 'Account 1'}, {index: 1, name: 'Account 2'}]);
    expect(await storeEnvelope(ext, envelopeRevision(opened), added)).toBe('stored');

    opened = await read();
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const enrolled = await addPasskeyWrap(opened, dk, prf, crypto.getRandomValues(new Uint8Array(16)), crypto.getRandomValues(new Uint8Array(32)));
    expect(await storeEnvelope(ext, envelopeRevision(opened), enrolled)).toBe('stored');

    opened = await read();
    const removed = await reencryptForAccounts(opened, dk, [{index: 1, name: 'Account 2'}]);
    expect(await storeEnvelope(ext, envelopeRevision(opened), removed)).toBe('stored');
    dk.fill(0);

    const final = await read();
    expect(final.accounts.map(a => a.index)).toEqual([1]);
    expect(final.passkey).toEqual(enrolled.passkey);
    dk = await unlockWithPassword(final, PASSWORD, kdf);
    expect(dk.length).toBe(32);
    dk.fill(0);
  });
});
