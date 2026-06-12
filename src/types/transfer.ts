/** A pending transfer carried across the #19→#20 confirm chain. */
export interface TransferIntent {
  mode: 'transparent' | 'shielded';
  recipient: string; // base58
  amount: string; // human string, e.g. "0.001"
  tokenMint: string; // 'native' for SOL, else mint base58
  tokenSymbol: string; // 'SOL' | 'NOC' | …
  decimals: number;
  priorityLevel: 'normal' | 'fast' | 'urgent';
  createAta: boolean;
}
