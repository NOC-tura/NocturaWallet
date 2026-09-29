import {argon2idAsync} from '@noble/hashes/argon2.js';
import {base64} from '@scure/base';
import {createEnvelope, unlockWithPassword, CorruptEnvelope, UnsafeKdfParams, WrongPassword, KDF_CAP, PRODUCTION_KDF, type EnvelopeV1, type Kdf} from '../envelope';
import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN} from '../../shared/envelopeRules';
import {storeEnvelope} from '../../background/accountsStore';
import {fakeExt} from '../../background/__tests__/fakeExt';

/**
 * The background cannot import the vault, so it checks a handed-over envelope against copies of
 * the vault's bounds (src/shared/envelopeRules.ts). These tests pin those copies to the vault:
 * the constants equal PRODUCTION_KDF / KDF_CAP, and — field by field, at each boundary — the
 * background refuses exactly what the vault's checkEnvelope refuses.
 */
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const accounts = [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}];
const B = (n: number) => base64.encode(new Uint8Array(n).fill(7));

/** The vault's verdict: checkEnvelope runs first in unlockWithPassword; a well-formed envelope then fails only the (wrong) password. */
async function vaultAccepts(env: unknown): Promise<boolean> {
  try {
    await unlockWithPassword(env as EnvelopeV1, 'not the password', kdf);
    throw new Error('the wrong password unlocked');
  } catch (e) {
    if (e instanceof WrongPassword) return true;
    if (e instanceof CorruptEnvelope || e instanceof UnsafeKdfParams) return false;
    throw e;
  }
}

async function backgroundAccepts(env: unknown): Promise<boolean> {
  const r = await storeEnvelope(fakeExt(), null, env);
  if (r !== 'stored' && r !== 'malformed') throw new Error(r);
  return r === 'stored';
}

describe("the background's envelope bounds are the vault's", () => {
  it('pins the shared KDF bounds to PRODUCTION_KDF and KDF_CAP', () => {
    expect(ENVELOPE_KDF_MIN).toEqual(PRODUCTION_KDF);
    expect(ENVELOPE_KDF_MAX).toEqual(KDF_CAP);
  });

  it('agrees with checkEnvelope at every length and cost boundary', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf});
    const passkey = {credentialId: B(16), prfSalt: B(ENVELOPE_BYTES.prfSalt), wrapped: B(ENVELOPE_BYTES.wrapped)};
    const cases: [string, unknown][] = [['as created', env], ['with a passkey', {...env, passkey}]];
    const around = (n: number) => [n - 1, n, n + 1].filter(x => x >= 0);
    for (const n of around(ENVELOPE_BYTES.salt)) cases.push([`salt ${n}`, {...env, kdf: {...env.kdf, salt: B(n)}}]);
    for (const n of around(ENVELOPE_BYTES.iv)) cases.push([`iv ${n}`, {...env, seed: {...env.seed, iv: B(n)}}]);
    for (const n of around(ENVELOPE_BYTES.minCt)) cases.push([`ct ${n}`, {...env, seed: {...env.seed, ct: B(n)}}]);
    for (const n of around(ENVELOPE_BYTES.wrapped)) cases.push([`password wrap ${n}`, {...env, password: {wrapped: B(n)}}]);
    for (const n of around(ENVELOPE_BYTES.prfSalt)) cases.push([`prfSalt ${n}`, {...env, passkey: {...passkey, prfSalt: B(n)}}]);
    for (const n of around(ENVELOPE_BYTES.wrapped)) cases.push([`passkey wrap ${n}`, {...env, passkey: {...passkey, wrapped: B(n)}}]);
    for (const n of around(ENVELOPE_BYTES.minCredentialId)) cases.push([`credentialId ${n}`, {...env, passkey: {...passkey, credentialId: B(n)}}]);
    for (const k of ['m', 't', 'p'] as const) {
      for (const v of [PRODUCTION_KDF[k] - 1, PRODUCTION_KDF[k], KDF_CAP[k], KDF_CAP[k] + 1]) cases.push([`kdf.${k} ${v}`, {...env, kdf: {...env.kdf, [k]: v}}]);
    }
    cases.push(['kdf alg', {...env, kdf: {...env.kdf, alg: 'scrypt'}}], ['salt not base64', {...env, kdf: {...env.kdf, salt: '!!'}}]);
    const verdicts = await Promise.all(cases.map(async ([name, e]) => [name, await vaultAccepts(e), await backgroundAccepts(e)]));
    for (const [name, vault, background] of verdicts) expect([name, background]).toEqual([name, vault]);
    // Both sides of every boundary were exercised: the comparison is not all-accept or all-refuse.
    expect(verdicts.filter(v => v[1] === true).length).toBeGreaterThan(10);
    expect(verdicts.filter(v => v[1] === false).length).toBeGreaterThan(10);
  });
});
