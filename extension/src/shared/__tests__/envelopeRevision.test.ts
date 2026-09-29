import {base64} from '@scure/base';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';
import {envelopeRevision} from '../envelopeRevision';

const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const ENV = {
  v: 1 as const,
  scheme: 'slip10' as const,
  kdf: {alg: 'argon2id' as const, m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [
    {index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'},
    {index: 1, name: 'Account 2', publicKey: 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'},
  ],
};
const PASSKEY = {credentialId: B(16, 7), prfSalt: B(32, 8), wrapped: B(40, 9)};

describe('envelopeRevision (the compare-and-set token of v1_vault)', () => {
  it('is the sha256 hex of the fixed-order JSON of every field but the names (pinned)', () => {
    const json = JSON.stringify({
      v: 1,
      scheme: 'slip10',
      kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: ENV.kdf.salt},
      seed: {iv: ENV.seed.iv, ct: ENV.seed.ct},
      password: {wrapped: ENV.password.wrapped},
      passkey: null,
      accounts: ENV.accounts.map(a => ({index: a.index, publicKey: a.publicKey})),
    });
    expect(envelopeRevision(ENV)).toBe(bytesToHex(sha256(utf8ToBytes(json))));
    expect(envelopeRevision(ENV)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores names, stray fields and key order', () => {
    const rev = envelopeRevision(ENV);
    expect(envelopeRevision({...ENV, accounts: ENV.accounts.map(a => ({...a, name: 'renamed'}))})).toBe(rev);
    const shuffled = {accounts: ENV.accounts, password: ENV.password, seed: {ct: ENV.seed.ct, iv: ENV.seed.iv}, kdf: {salt: ENV.kdf.salt, p: 1, t: 3, m: 65536, alg: 'argon2id' as const}, scheme: ENV.scheme, v: ENV.v};
    expect(envelopeRevision({...shuffled, extra: 'x'} as typeof ENV)).toBe(rev);
  });

  it('changes with every other field: scheme, cost, salt, IV, ciphertext, either wrap, a passkey, the account list', () => {
    const rev = envelopeRevision(ENV);
    const changed = [
      {...ENV, scheme: 'cli' as const},
      {...ENV, kdf: {...ENV.kdf, m: 65537}},
      {...ENV, kdf: {...ENV.kdf, t: 4}},
      {...ENV, kdf: {...ENV.kdf, p: 2}},
      {...ENV, kdf: {...ENV.kdf, salt: B(16, 9)}},
      {...ENV, seed: {...ENV.seed, iv: B(12, 9)}},
      {...ENV, seed: {...ENV.seed, ct: B(48, 9)}},
      {...ENV, password: {wrapped: B(40, 9)}},
      {...ENV, passkey: PASSKEY},
      {...ENV, passkey: {...PASSKEY, wrapped: B(40, 10)}},
      {...ENV, accounts: [ENV.accounts[0]!]},
      {...ENV, accounts: [ENV.accounts[1]!, ENV.accounts[0]!]},
      {...ENV, accounts: [ENV.accounts[0]!, {...ENV.accounts[1]!, publicKey: 'x'}]},
      {...ENV, accounts: [ENV.accounts[0]!, {...ENV.accounts[1]!, index: 2}]},
    ];
    const revs = changed.map(envelopeRevision);
    for (const r of revs) expect(r).not.toBe(rev);
    expect(new Set(revs).size).toBe(revs.length);
    expect(envelopeRevision({...ENV, passkey: PASSKEY})).not.toBe(envelopeRevision({...ENV, passkey: {...PASSKEY, prfSalt: B(32, 10)}}));
    expect(envelopeRevision({...ENV, passkey: PASSKEY})).not.toBe(envelopeRevision({...ENV, passkey: {...PASSKEY, credentialId: B(16, 10)}}));
  });
});
