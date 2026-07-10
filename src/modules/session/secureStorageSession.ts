import {keychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {zeroize} from './zeroize';
import {initSecureMmkv, mmkvSecure, mmkvPublic} from '../../store/mmkv/instances';
import {setShieldedViewSession} from '../shielded/shieldedViewSession';
import {getViewPublicKey} from '../shielded/shieldedIdentity';
import {encodeShieldedAddress} from '../shielded/shieldedAddressCodec';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

/**
 * Prime the shielded view-key scan cache AND persist the user's own noc1…
 * shielded receive address — BEST EFFORT. The view session powers incoming-note
 * scanning; the stored address (public data, like the transparent address — safe
 * in the unencrypted store) powers the shielded Receive screen without needing a
 * biometric prompt. If view-key derivation ever fails it must NOT abort the
 * critical unlock/onboarding path, so failures are swallowed (scanning + the
 * shielded receive address just refresh on the next unlock).
 */
function primeViewSession(seed: Uint8Array): void {
  try {
    setShieldedViewSession(seed);
    mmkvPublic.set(
      MMKV_KEYS.WALLET_SHIELDED_ADDRESS,
      encodeShieldedAddress(getViewPublicKey(seed)),
    );
  } catch {
    // best effort — see doc comment
  }
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
    primeViewSession(seed);
  } finally {
    if (seed) zeroize(seed);
  }
}

/** Like unlockSecureStorage but the seed is already in hand (onboarding). */
export function unlockSecureStorageWithSeed(seed: Uint8Array): void {
  if (mmkvSecure()) return;
  initSecureMmkv(deriveSecureStorageKey(seed));
  primeViewSession(seed);
}
