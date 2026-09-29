import {createEnvelope, PRODUCTION_KDF} from '../src/vault/envelope';
import {argon2idKdf} from '../src/vault/kdf';

export const E2E_PASSWORD = 'correct horse battery staple';
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/** A real envelope at production parameters — the E2E exercises the real cost. */
export function makeEnvelope() {
  return createEnvelope({
    mnemonic: MNEMONIC,
    password: E2E_PASSWORD,
    scheme: 'slip10',
    accounts: [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}],
    kdf: argon2idKdf,
    params: PRODUCTION_KDF,
  });
}
