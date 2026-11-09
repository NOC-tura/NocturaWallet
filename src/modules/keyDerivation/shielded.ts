/**
 * BLS12-381 shielded key derivation (EIP-2333) — VIEW + DISCLOSURE keys only.
 *
 * ⛔ SECURITY BOUNDARY: This file contains ONLY view and disclosure key derivation.
 *    deriveShieldedSpendKey() MUST NOT exist in any JS/TS file.
 *    Spend key derivation lives exclusively in the Rust A0 core
 *    (native/noctura-prover, src/a0 — Android, arm64-v8a; no iOS build yet).
 *
 * Library: micro-key-producer/bls.js (EIP-2333)
 *   ⚠️ NOT @scure/bip32 — BIP-32 is invalid for BLS12-381 (>54% of derived keys
 *      would be outside the curve order)
 *   ⚠️ NOT bls12-381-keygen — deprecated, merged into micro-key-producer
 */

import {deriveSeedTree} from 'micro-key-producer/bls.js';
import {SHIELDED_PATHS} from './paths';

/**
 * Derive the shielded view key (sk_view) from a BIP-39 seed.
 * Path: m/12381/371/2/0 (EIP-2333)
 *
 * ✓ ALLOWED in JS — read-only key for note decryption and ownership verification.
 *   Cannot authorize spends.
 */
export function deriveShieldedViewKey(seed: Uint8Array): Uint8Array {
  return deriveSeedTree(seed, SHIELDED_PATHS.view);
}

/**
 * Derive an ephemeral disclosure key from a BIP-39 seed.
 * Path: m/12381/371/3/{index} (EIP-2333)
 *
 * ✓ ALLOWED in JS — used for proving asset ownership to auditors.
 *   Each disclosure has a unique index. Cannot authorize spends.
 */
export function deriveDisclosureKey(seed: Uint8Array, index: number): Uint8Array {
  return deriveSeedTree(seed, SHIELDED_PATHS.disclosure(index));
}

// ⛔ deriveShieldedSpendKey() DOES NOT EXIST here.
// The A0 spend key (m/12381/371/1/0) is derived inside Rust only
// (native/noctura-prover, src/a0); JS reaches it through the opaque handle of
// src/modules/zkProver/nativeProverBridge.ts (a0KeysOpen … a0Prove).
