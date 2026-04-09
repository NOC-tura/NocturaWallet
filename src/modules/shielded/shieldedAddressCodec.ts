import {bech32m} from '@scure/base';
import {SHIELDED_ADDRESS_HRP} from '../../constants/programs';
import {ERROR_CODES} from '../../constants/errors';

const SHIELDED_PK_BYTES = 48;

export function encodeShieldedAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== SHIELDED_PK_BYTES) {
    throw new Error(`Expected ${SHIELDED_PK_BYTES} bytes, got ${publicKey.length}`);
  }
  const words = bech32m.toWords(publicKey);
  return bech32m.encode(SHIELDED_ADDRESS_HRP, words, 90);
}

export function decodeShieldedAddress(address: string): Uint8Array {
  try {
    const {prefix, bytes} = bech32m.decodeToBytes(address);
    if (prefix !== SHIELDED_ADDRESS_HRP) {
      throw new Error(`Wrong HRP: expected ${SHIELDED_ADDRESS_HRP}, got ${prefix}`);
    }
    if (bytes.length !== SHIELDED_PK_BYTES) {
      throw new Error(`Wrong data length: expected ${SHIELDED_PK_BYTES}, got ${bytes.length}`);
    }
    return Uint8Array.from(bytes);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`${ERROR_CODES.INVALID_SHIELDED_ADDR.message}: ${detail}`);
  }
}

export function isValidShieldedAddress(address: string): boolean {
  try {
    decodeShieldedAddress(address);
    return true;
  } catch {
    return false;
  }
}

export function formatShieldedAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}
