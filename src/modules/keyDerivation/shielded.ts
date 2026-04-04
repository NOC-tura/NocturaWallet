/**
 * BLS12-381 shielded key derivation (EIP-2333) — VIEW + DISCLOSURE keys only.
 *
 * ⛔ SECURITY BOUNDARY: This file contains ONLY view and disclosure key derivation.
 *    deriveShieldedSpendKey() MUST NOT exist in any JS/TS file.
 *    Spend key derivation lives exclusively in native code:
 *      - iOS: NocturaSecureEnclave.swift (BLST via C interop)
 *      - Android: NocturaKeyStore.kt (BLST via JNI)
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
// For shielded signing, call the native bridge:
//   NocturaKeyModule.signShieldedOp(payload)
