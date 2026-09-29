import {b64, utf8, assertArrayBufferBacked} from './bytes';
import {checkEnvelope, decryptMnemonic, headerAad, isIndex, type EnvelopeV1} from './envelope';
import {derivePublicKeys} from './accounts';
import {MAX_ACCOUNTS, cleanName} from '../shared/envelopeRules';

// Its own module, not envelope.ts, so that the derivation is a STATIC import: e2e/makeEnvelope.ts
// loads envelope.ts into Playwright's Node loader, where a static import of core/keys
// (micro-key-producer, ESM-only) fails to load ("module is not linked"), and a dynamic import here
// made the Vite build import its runtime helper from background.js into the vault page — which
// would then run the background entry. This module is imported only by the vault page.
const subtle = () => globalThis.crypto.subtle;
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/**
 * The account list changed (an account added or removed, spec §2): re-encrypt the seed under the
 * SAME data key with the new header as its additionalData. The password and passkey wraps wrap the
 * data key, not the seed, so they stay valid; the IV is fresh (AES-GCM must never reuse an IV under
 * one key). Decrypting first proves `dataKey` and the current header before anything is built.
 *
 * The caller names only indexes and names: every public key is DERIVED here from the decrypted seed
 * (scheme-aware; a cli wallet is exactly account 0), so no caller-supplied key can enter the header.
 * Public keys only (derivePublicKeys): every secret key and the seed are zeroed, no secret-key string made.
 * The limits are the background's (src/shared/envelopeRules.ts): 1..MAX_ACCOUNTS accounts, unique
 * non-negative indexes, and a name a rename would accept (cleanName) — or, for an account already
 * stored, its stored name unchanged. The result is built field by field: nothing stray from `env` or
 * `accounts` is carried over. Names are, as everywhere, not part of the AAD.
 */
export async function reencryptForAccounts(env: EnvelopeV1, dataKey: Uint8Array, accounts: {index: number; name: string}[]): Promise<EnvelopeV1> {
  checkEnvelope(env);
  assertArrayBufferBacked(dataKey);
  if (accounts.length === 0) throw new TypeError('an envelope needs at least one account');
  if (accounts.length > MAX_ACCOUNTS) throw new TypeError(`an envelope holds at most ${MAX_ACCOUNTS} accounts`);
  const stored = new Map(env.accounts.map(a => [a.index, a.name]));
  const named: {index: number; name: string}[] = [];
  for (const a of accounts) {
    if (!isIndex(a.index) || named.some(b => b.index === a.index)) throw new TypeError('malformed account');
    const name = cleanName(a.name) ?? (stored.get(a.index) === a.name ? a.name : null);
    if (name === null) throw new TypeError('malformed account');
    named.push({index: a.index, name});
  }
  if (env.scheme === 'cli' && (named.length !== 1 || named[0]?.index !== 0)) throw new TypeError('a cli wallet has exactly one account');
  const mnemonic = await decryptMnemonic(env, dataKey);
  const derived = await derivePublicKeys(mnemonic, env.scheme, named.map(a => a.index));
  const clean = named.map((a, i) => {
    const publicKey = derived[i];
    if (publicKey === undefined || derived.length !== named.length) throw new Error('derivation did not return every account');
    return {index: a.index, name: a.name, publicKey};
  });
  const kdf = {alg: 'argon2id' as const, m: env.kdf.m, t: env.kdf.t, p: env.kdf.p, salt: env.kdf.salt};
  const aad = headerAad({v: 1, scheme: env.scheme, kdf, accounts: clean});
  const iv = random(12);
  const encoded = utf8(mnemonic);
  try {
    const key = await subtle().importKey('raw', dataKey, 'AES-GCM', false, ['encrypt']);
    const ct = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv, additionalData: aad}, key, encoded));
    const out: EnvelopeV1 = {
      v: 1,
      scheme: env.scheme,
      kdf,
      seed: {iv: b64(iv), ct: b64(ct)},
      password: {wrapped: env.password.wrapped},
      accounts: clean,
    };
    if (env.passkey !== undefined) out.passkey = {credentialId: env.passkey.credentialId, prfSalt: env.passkey.prfSalt, wrapped: env.passkey.wrapped};
    return out;
  } finally {
    encoded.fill(0);
  }
}
