import {keychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {zeroize} from './zeroize';
import {initSecureMmkv, mmkvSecure} from '../../store/mmkv/instances';

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
  } finally {
    if (seed) zeroize(seed);
  }
}

/** Like unlockSecureStorage but the seed is already in hand (onboarding). */
export function unlockSecureStorageWithSeed(seed: Uint8Array): void {
  if (mmkvSecure()) return;
  initSecureMmkv(deriveSecureStorageKey(seed));
}
