/**
 * M1d (spec §3.3): the account a transparent Send signs from — captured when #12 opens and carried
 * #19 → #20 → #21; a later selection change never moves it.
 */
export interface SendSource {
  /** `slip10:n` | `cli` — #21 parses it strictly and derives the signer from it */
  scheme: string;
  /** the account's address — #21 refuses a key that derives anything else (E_SEND_SIGNER_MISMATCH) */
  address: string;
  /** "Account 4" */
  label: string;
  isMain: boolean;
}

/** M1d (plan A8): the source's public balances when #12 handed over (base units) — #19's "After", #20's high-value gate. */
export interface SourceBalances {
  solBalance: string;
  tokenBalances: Record<string, string>;
}

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
  from: SendSource;
  sourceBalances: SourceBalances;
}
