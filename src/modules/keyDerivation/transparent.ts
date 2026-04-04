import {HDKey} from '@scure/bip32';
import {ed25519} from '@noble/curves/ed25519.js';
import {TRANSPARENT_PATH} from './paths';
import {zeroize} from '../session/zeroize';

interface TransparentKeypair {
  publicKey: Uint8Array; // 32 bytes
  secretKey: Uint8Array; // 64 bytes (seed + public key, Solana convention)
}

/**
 * Derive the Solana Ed25519 keypair from a BIP-39 seed.
 * Path: m/44'/501'/0'/0' (standard Solana BIP-44)
 * Library: @scure/bip32 (valid for Ed25519)
 */
export function deriveTransparentKeypair(seed: Uint8Array): TransparentKeypair {
  const hd = HDKey.fromMasterSeed(seed);
  const derived = hd.derive(TRANSPARENT_PATH);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key from seed');
  }

  // Ed25519: private key (32 bytes) → public key (32 bytes)
  const publicKey = ed25519.getPublicKey(derived.privateKey);

  // Solana convention: secretKey = privateKey (32) + publicKey (32) = 64 bytes
  const secretKey = new Uint8Array(64);
  secretKey.set(derived.privateKey, 0);
  secretKey.set(publicKey, 32);

  // Zeroize intermediate private key from BIP-32 derivation
  zeroize(derived.privateKey);

  return {publicKey, secretKey};
}
