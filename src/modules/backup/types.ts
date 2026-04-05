export interface RestoreResult {
  notesRestored: number;
  tokensFound: string[];
  transparentBalanceFound: boolean;
  shieldedBalanceRestored: string; // BigInt as string
}

export interface BackupMetadata {
  version: number;
  createdAt: number;
  publicKeyHash: string; // SHA-256(publicKey), not raw address
}
