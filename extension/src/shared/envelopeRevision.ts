import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';

/** The fields of an envelope the revision covers (a shape-checked EnvelopeV1 has them all). */
export interface RevisionFields {
  v: number;
  scheme: string;
  kdf: {alg: string; m: number; t: number; p: number; salt: string};
  seed: {iv: string; ct: string};
  password: {wrapped: string};
  passkey?: {credentialId: string; prfSalt: string; wrapped: string};
  accounts: {index: number; publicKey: string}[];
}

/**
 * The compare-and-set token of v1_vault: the vault page sends the revision of the envelope it
 * opened with the one it re-encrypted, and the background stores the new one only if the stored
 * envelope still has that revision. It covers every field but the account names — a passkey
 * enrolment or a changed wrap changes it, a rename does not (names are outside the seed's AAD, and
 * the background carries them over).
 *
 * sha256, lowercase hex, of the UTF-8 bytes of JSON.stringify of an object built here in exactly
 * this order: {"v","scheme","kdf":{"alg","m","t","p","salt"},"seed":{"iv","ct"},"password":{"wrapped"},
 * "passkey":{"credentialId","prfSalt","wrapped"} or null,"accounts":[{"index","publicKey"}, … in stored order]}.
 */
export function envelopeRevision(env: RevisionFields): string {
  const {kdf, seed, password, passkey} = env;
  const canonical = {
    v: env.v,
    scheme: env.scheme,
    kdf: {alg: kdf.alg, m: kdf.m, t: kdf.t, p: kdf.p, salt: kdf.salt},
    seed: {iv: seed.iv, ct: seed.ct},
    password: {wrapped: password.wrapped},
    passkey: passkey === undefined ? null : {credentialId: passkey.credentialId, prfSalt: passkey.prfSalt, wrapped: passkey.wrapped},
    accounts: env.accounts.map(a => ({index: a.index, publicKey: a.publicKey})),
  };
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(canonical))));
}
