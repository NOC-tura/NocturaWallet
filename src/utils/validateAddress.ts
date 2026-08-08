export type AddressType = 'solana' | 'solana_pay' | 'shielded' | 'non_solana' | 'invalid';

export interface AddressValidation {
  type: AddressType;
  address?: string;
  amount?: string;
  token?: string;
  error?: string;
}

import {isOnCurveAddress} from './isOnCurveAddress';

/**
 * Cheap shape pre-filter. It is NOT sufficient on its own: it accepts strings
 * that decode to the wrong length and off-curve program-derived addresses, both
 * of which permanently lose any SOL sent to them. Every accept path below also
 * requires `isOnCurveAddress`.
 */
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const OFF_CURVE_ERROR =
  'This address cannot receive funds — it is not a wallet address (off-curve or wrong length).';
const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}/;
const BTC_ADDRESS_REGEX = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;

export function validateRecipientInput(input: string): AddressValidation {
  const trimmed = input.trim();
  if (!trimmed) return {type: 'invalid', error: 'Address is required'};
  if (trimmed.startsWith('noc1')) return {type: 'shielded', address: trimmed};
  if (trimmed.startsWith('solana:')) return parseSolanaPay(trimmed);
  if (ETH_ADDRESS_REGEX.test(trimmed)) return {type: 'non_solana', error: 'This is not a Solana address'};
  if (BTC_ADDRESS_REGEX.test(trimmed)) return {type: 'non_solana', error: 'This is not a Solana address'};
  if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
    if (!isOnCurveAddress(trimmed)) return {type: 'invalid', error: OFF_CURVE_ERROR};
    return {type: 'solana', address: trimmed};
  }
  return {type: 'invalid', error: 'Invalid recipient address'};
}

function parseSolanaPay(uri: string): AddressValidation {
  try {
    const withoutScheme = uri.replace('solana:', '');
    const [address, queryString] = withoutScheme.split('?');
    if (!address || !SOLANA_ADDRESS_REGEX.test(address)) return {type: 'invalid', error: 'Invalid Solana Pay address'};
    if (!isOnCurveAddress(address)) return {type: 'invalid', error: OFF_CURVE_ERROR};
    const params = new URLSearchParams(queryString || '');
    return {
      type: 'solana_pay',
      address,
      amount: params.get('amount') ?? undefined,
      token: params.get('spl-token') ?? undefined,
    };
  } catch {
    return {type: 'invalid', error: 'Invalid Solana Pay URI'};
  }
}
