import {base58} from '@scure/base';

/**
 * getTransaction (jsonParsed) results of each kind the engine decodes (core/solana/history.ts), for
 * the activity screens — unit tests and the E2E's fake coordinator both use these. Public constants
 * only; nothing here is imported from core/ (the E2E rule).
 */
export const PRESALE_PROGRAM = '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const COUNTERPARTY = 'H4qZoWSv5iyeysmHzYnVfqVBtSfoJTZQJ33YtjAXm2N1';

/** A well-formed transaction signature (64 bytes, base58), different for each n. */
export const sig = (n: number): string => base58.encode(Uint8Array.from({length: 64}, (_, i) => (n * 7 + i) % 251 || 1));

const tx = (blockTime: number, meta: object, accountKeys: string[], instructions: object[]) => ({
  blockTime,
  meta: {err: null, fee: 5000, preTokenBalances: [], postTokenBalances: [], ...meta},
  transaction: {message: {accountKeys: accountKeys.map(pubkey => ({pubkey})), instructions}},
});

export function sentSol(owner: string, to: string, lamports: number, blockTime: number) {
  return tx(blockTime, {preBalances: [10_000_000_000, 0], postBalances: [10_000_000_000 - lamports - 5000, lamports]}, [owner, to], [
    {program: 'system', parsed: {type: 'transfer', info: {source: owner, destination: to, lamports}}},
  ]);
}

export function receivedUsdc(owner: string, from: string, amount: number, blockTime: number) {
  const bal = (who: string, a: number) => ({owner: who, mint: USDC_MINT, uiTokenAmount: {amount: String(a), decimals: 6}});
  return tx(
    blockTime,
    {preBalances: [1, 1], postBalances: [1, 1], preTokenBalances: [bal(owner, 0), bal(from, amount)], postTokenBalances: [bal(owner, amount), bal(from, 0)]},
    [from, owner],
    [],
  );
}

export function presalePurchase(owner: string, lamports: number, blockTime: number) {
  return tx(blockTime, {preBalances: [10_000_000_000], postBalances: [10_000_000_000 - lamports - 5000]}, [owner, PRESALE_PROGRAM], [{programId: PRESALE_PROGRAM, data: 'x'}]);
}

export function otherTx(owner: string, blockTime: number) {
  return tx(blockTime, {preBalances: [1_000], postBalances: [1_000], fee: 0}, [COUNTERPARTY, owner], []);
}

export function failedTx(owner: string, blockTime: number) {
  return {...sentSol(owner, COUNTERPARTY, 1_000_000, blockTime), meta: {err: {InstructionError: [0, 'Custom']}, fee: 5000, preBalances: [1, 1], postBalances: [1, 1]}};
}
