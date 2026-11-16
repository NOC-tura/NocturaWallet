import {keychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {zeroize} from './zeroize';
import {initSecureMmkv, mmkvSecure, mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {isShieldedEnabled} from '../../constants/features';
import {isProverSupported} from '../zkProver/nativeProverBridge';
import {getConnection} from '../solana/connection';
import {ensureA0Startup} from '../shielded/a0/startup';

/** The public-instance caches of the removed v1 shielded modules (merkleSync, noteScan). */
const V1_PUBLIC_PREFIXES = ['shielded.syncCache.', 'noctura.noteScanCursor.'] as const;

/**
 * Drop what the removed v1 shielded path left behind (spec §12 I9) — the v1 proof queue's record
 * (encrypted instance) and, in the PUBLIC instance, the 87-char
 * noc1… receive address an older version persisted, and the v1 tree-sync cache and note-scan
 * cursors. Nothing reads them any more — the shielded Receive is hidden until M2 — and they are
 * removed so no later reader can show an address of the old scheme. (The v1 notes, in the
 * encrypted instance, are cleared by the A0 note store's first call.)
 */
function dropV1ShieldedLeftovers(): void {
  // The v1 proof queue persisted its jobs' witness JSON (the v1 note secrets among them) in the
  // encrypted instance; the queue is gone, its record goes too.
  mmkvSecure()?.remove(MMKV_KEYS.PROOF_QUEUE);
  mmkvPublic.remove(MMKV_KEYS.WALLET_SHIELDED_ADDRESS);
  for (const k of mmkvPublic.getAllKeys()) {
    if (V1_PUBLIC_PREFIXES.some(p => k.startsWith(p))) {
      mmkvPublic.remove(k);
    }
  }
}

/**
 * Remove the v1 view key from the keychain (older installs stored it at onboarding; nothing reads
 * it under A0). Best effort and never rejects: a keychain failure must not block the unlock, and
 * the next unlock tries again.
 */
async function dropV1ViewKey(): Promise<void> {
  try {
    await keychainManager.dropV1ViewKey();
  } catch {
    // retried at the next unlock
  }
}

/**
 * The A0 startup step (restore when the device has no A0 note record, then reconcile pending
 * deposits — `shielded/a0/startup.ts`), started in the background with its OWN copy of the seed
 * (the restore consumes it), only where shielded can run: the devnet build (FEATURES.shielded) on
 * a device with the native prover. Never rejects; its state gates the shielded balance.
 */
function startA0(seed: Uint8Array): void {
  if (!isShieldedEnabled() || !isProverSupported()) {
    return;
  }
  ensureA0Startup(getConnection(), seed.slice()); // never rejects (its failure is a state)
}

/**
 * Initialize the encrypted note-store MMKV for this session. Retrieves the seed
 * (biometric/keychain), derives the storage key, inits the store, zeroizes the
 * seed. Idempotent — no-op if the store is already open. Call once per session
 * (unlock success + onboarding completion) so the dashboard can read notes.
 */
export async function unlockSecureStorage(): Promise<void> {
  if (mmkvSecure()) return;
  let seed: Uint8Array | null = null;
  try {
    const mnemonic = await keychainManager.retrieveSeed();
    seed = await mnemonicToSeed(mnemonic);
    initSecureMmkv(deriveSecureStorageKey(seed));
    dropV1ShieldedLeftovers();
    await dropV1ViewKey();
    startA0(seed);
  } finally {
    if (seed) zeroize(seed);
  }
}

/** Like unlockSecureStorage but the seed is already in hand (onboarding). */
export function unlockSecureStorageWithSeed(seed: Uint8Array): void {
  if (mmkvSecure()) return;
  initSecureMmkv(deriveSecureStorageKey(seed));
  dropV1ShieldedLeftovers();
  dropV1ViewKey().catch(() => undefined); // never rejects; not awaited (onboarding is synchronous here)
  startA0(seed);
}
