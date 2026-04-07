export interface RestoreResult {
  notesRestored: number;
  tokensFound: string[];
  transparentBalanceFound: boolean;
  shieldedBalanceRestored: string; // BigInt as string
  /** Backup file format version. V1 = weak SHA-256 KDF, V2 = PBKDF2-SHA512 600K. */
  formatVersion: 1 | 2;
}

export interface BackupMetadata {
  version: number;
  createdAt: number;
  publicKeyHash: string; // SHA-256(publicKey), not raw address
}
