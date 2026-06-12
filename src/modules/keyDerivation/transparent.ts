import {HDKey} from 'micro-key-producer/slip10.js';
import {ed25519} from '@noble/curves/ed25519.js';
import {zeroize} from '../session/zeroize';

interface TransparentKeypair {
  publicKey: Uint8Array; // 32 bytes
  secretKey: Uint8Array; // 64 bytes (privateKey + publicKey, Solana convention)
}

/**
 * Derivation scheme for the transparent (Solana Ed25519) key.
 *  - slip10: BIP-44 SLIP-0010 ed25519 at m/44'/501'/{account}'/0' — the scheme
 *    used by Phantom, Solflare and `solana-keygen --derivation-path`.
 *  - cli: ed25519 from the first 32 bytes of the BIP-39 seed, NO derivation —
 *    the `solana-keygen new` default (no path).
 */
export type TransparentScheme =
  | {kind: 'slip10'; account: number}
  | {kind: 'cli'};

export const DEFAULT_TRANSPARENT_SCHEME: TransparentScheme = {
  kind: 'slip10',
  account: 0,
};

/** Serialize a scheme for MMKV persistence. */
export function schemeToString(s: TransparentScheme): string {
  return s.kind === 'cli' ? 'cli' : `slip10:${s.account}`;
}

/** Parse a persisted scheme string; defaults to standard SLIP-0010 account 0. */
export function schemeFromString(v: string | null | undefined): TransparentScheme {
  if (v === 'cli') return {kind: 'cli'};
  if (v && v.startsWith('slip10:')) {
    const n = Number.parseInt(v.slice('slip10:'.length), 10);
    if (Number.isInteger(n) && n >= 0) return {kind: 'slip10', account: n};
  }
  return DEFAULT_TRANSPARENT_SCHEME;
}

/** Human-readable label for an account picker. */
export function schemeLabel(s: TransparentScheme): string {
  if (s.kind === 'cli') return 'Solana CLI (solana-keygen)';
  return s.account === 0
    ? 'Standard (Phantom/Solflare)'
    : `Standard · account ${s.account}`;
}

/** Extract the 32-byte ed25519 private key for a scheme (always a fresh copy). */
function privateKeyForScheme(seed: Uint8Array, scheme: TransparentScheme): Uint8Array {
  if (scheme.kind === 'cli') {
    return Uint8Array.from(seed.subarray(0, 32));
  }
  const path = `m/44'/501'/${scheme.account}'/0'`;
  const hd = HDKey.fromMasterSeed(seed).derive(path);
  if (!hd.privateKey || hd.privateKey.length !== 32) {
    throw new Error('Failed to derive private key from seed');
  }
  return Uint8Array.from(hd.privateKey);
}

/**
 * Derive the Solana Ed25519 keypair from a BIP-39 seed for the given scheme
 * (defaults to standard SLIP-0010 account 0).
 *
 * Library: micro-key-producer/slip10 — SLIP-0010 ed25519 derivation, the scheme
 * used by Phantom/Solflare/solana-keygen, so a seed phrase round-trips across
 * those wallets.
 *
 * Do NOT use @scure/bip32 here: it implements BIP-32 over the secp256k1 key
 * schedule and produces a DIFFERENT (non-standard) key matching no mainstream
 * Solana wallet.
 */
export function deriveTransparentKeypair(
  seed: Uint8Array,
  scheme: TransparentScheme = DEFAULT_TRANSPARENT_SCHEME,
): TransparentKeypair {
  const privateKey = privateKeyForScheme(seed, scheme);

  // Ed25519: private key (32 bytes) → public key (32 bytes)
  const publicKey = ed25519.getPublicKey(privateKey);

  // Solana convention: secretKey = privateKey (32) + publicKey (32) = 64 bytes
  const secretKey = new Uint8Array(64);
  secretKey.set(privateKey, 0);
  secretKey.set(publicKey, 32);

  // Zeroize the derived private key now that it's been copied into secretKey
  zeroize(privateKey);

  return {publicKey, secretKey};
}
