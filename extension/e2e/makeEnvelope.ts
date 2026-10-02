import {createEnvelope, PRODUCTION_KDF} from '../src/vault/envelope';
import {argon2idKdf} from '../src/vault/kdf';

export const E2E_PASSWORD = 'correct horse battery staple';
export const E2E_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
/** E2E_MNEMONIC's SLIP-0010 accounts 0 and 1 (derived once with src/vault/accounts.ts; written here so the E2E imports no core/ code). */
export const E2E_ACCOUNTS = ['HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'] as const;

/** A real envelope at production parameters — the E2E exercises the real cost. One account, or the two of E2E_ACCOUNTS. */
export function makeEnvelope(o: {accounts?: 1 | 2} = {}) {
  const names = ['Account 1', 'Savings'];
  return createEnvelope({
    mnemonic: E2E_MNEMONIC,
    password: E2E_PASSWORD,
    scheme: 'slip10',
    accounts: E2E_ACCOUNTS.slice(0, o.accounts ?? 1).map((publicKey, index) => ({index, name: names[index] ?? '', publicKey})),
    kdf: argon2idKdf,
    params: PRODUCTION_KDF,
  });
}
