import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {
  schemeToString,
  schemeFromString,
  type TransparentScheme,
} from './transparent';

/** Persist the user's chosen transparent derivation scheme (non-secret metadata). */
export function storeTransparentScheme(scheme: TransparentScheme): void {
  mmkvPublic.set(MMKV_KEYS.WALLET_TRANSPARENT_DERIVATION, schemeToString(scheme));
}

/** Load the persisted scheme; defaults to standard SLIP-0010 account 0. */
export function loadTransparentScheme(): TransparentScheme {
  return schemeFromString(
    mmkvPublic.getString(MMKV_KEYS.WALLET_TRANSPARENT_DERIVATION),
  );
}
