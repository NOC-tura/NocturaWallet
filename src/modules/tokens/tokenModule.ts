import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {CORE_MINTS} from './coreTokens';
import {NOC_MINT} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {API_BASE} from '../../constants/programs';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {getConnection} from '../solana/connection';

type TrustTier = 'core' | 'verified' | 'unknown';

interface SimpleAccount {
  mint: string;
  balance: string;
  address: string;
}

// Jupiter strict token list endpoint (external, no SSL pinning required)
const JUPITER_STRICT_URL = 'https://token.jup.ag/strict';
const VERIFIED_LIST_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// SPL Token program ID
const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

// Maximum closeAccount instructions per VersionedTransaction batch
const MAX_CLOSE_PER_BATCH = 20;

// In-memory cache of Jupiter verified mints (Set for O(1) lookup)
let _verifiedMints: Set<string> | null = null;
// Timestamp of the last in-memory load (mirrors MMKV for staleness check)
let _verifiedLoadedAt = 0;

/**
 * Shape of a single Jupiter token list entry.
 * Only the address field is used; all others are ignored.
 */
interface JupiterToken {
  address: string;
  [key: string]: unknown;
}

export class TokenManager {
  /**
   * Fetch the Jupiter strict verified token list, caching it in MMKV for 24 h.
   * On network failure returns the cached list (or empty array if never fetched).
   */
  async fetchVerifiedList(): Promise<string[]> {
    const now = Date.now();

    // Return in-memory cache if still fresh
    if (_verifiedMints !== null && now - _verifiedLoadedAt < VERIFIED_LIST_TTL_MS) {
      return Array.from(_verifiedMints);
    }

    // Try loading from MMKV cache before hitting the network
    const cachedAt = mmkvPublic.getNumber(MMKV_KEYS.JUPITER_VERIFIED_AT) ?? 0;
    if (now - cachedAt < VERIFIED_LIST_TTL_MS) {
      const raw = mmkvPublic.getString(MMKV_KEYS.JUPITER_VERIFIED_LIST);
      if (raw !== undefined) {
        const mints: string[] = JSON.parse(raw) as string[];
        _verifiedMints = new Set(mints);
        _verifiedLoadedAt = cachedAt;
        return mints;
      }
    }

    // Fetch fresh list from Jupiter
    try {
      const response = await fetch(JUPITER_STRICT_URL);
      const tokens = (await response.json()) as JupiterToken[];
      const mints = tokens.map(t => t.address);

      // Persist to MMKV
      mmkvPublic.set(MMKV_KEYS.JUPITER_VERIFIED_LIST, JSON.stringify(mints));
      mmkvPublic.set(MMKV_KEYS.JUPITER_VERIFIED_AT, now);

      // Update in-memory cache
      _verifiedMints = new Set(mints);
      _verifiedLoadedAt = now;

      return mints;
    } catch {
      // Fall back to whatever is in MMKV (may be stale or absent)
      const raw = mmkvPublic.getString(MMKV_KEYS.JUPITER_VERIFIED_LIST);
      if (raw !== undefined) {
        const mints: string[] = JSON.parse(raw) as string[];
        _verifiedMints = new Set(mints);
        _verifiedLoadedAt = cachedAt;
        return mints;
      }
      // No cache available — return empty array
      _verifiedMints = new Set();
      _verifiedLoadedAt = 0;
      return [];
    }
  }

  /**
   * Classify a mint address into a trust tier.
   *  - 'core'     — CORE_MINTS (NOC, SOL, USDC, USDT)
   *  - 'verified' — present in the Jupiter strict verified list
   *  - 'unknown'  — everything else
   *
   * The Jupiter list is read from the in-memory cache only (no async I/O).
   * Callers should ensure fetchVerifiedList() has been called at least once.
   */
  classifyToken(mint: string): TrustTier {
    if (CORE_MINTS.has(mint)) return 'core';
    if (_verifiedMints !== null && _verifiedMints.has(mint)) return 'verified';
    return 'unknown';
  }

  async checkScamFlag(mint: string): Promise<boolean> {
    try {
      const response = await pinnedFetch(
        `${API_BASE}/v1/tokens/flagged?mint=${encodeURIComponent(mint)}`,
      );
      const data = (await response.json()) as {flagged: boolean; reason?: string};
      return data.flagged;
    } catch {
      return false;
    }
  }

  getEmptyAccountsForCleanup(accounts: SimpleAccount[]): SimpleAccount[] {
    return accounts.filter(
      account => account.balance === '0' && !CORE_MINTS.has(account.mint),
    );
  }

  sortTokens<T extends {mint: string; symbol: string}>(tokens: T[]): T[] {
    return [...tokens].sort((a, b) => {
      if (a.mint === NOC_MINT) return -1;
      if (b.mint === NOC_MINT) return 1;
      const aCore = CORE_MINTS.has(a.mint);
      const bCore = CORE_MINTS.has(b.mint);
      if (aCore && !bCore) return -1;
      if (!aCore && bCore) return 1;
      return a.symbol.localeCompare(b.symbol);
    });
  }
}

/**
 * Build a closeAccount SPL Token instruction for a single token account.
 *
 * Layout (spl-token instruction discriminator 9):
 *   data:  Buffer [9]
 *   keys:  [account (writable), destination (writable), owner (signer)]
 *   programId: TOKEN_PROGRAM_ID
 *
 * The remaining rent lamports are returned to `destination` (= owner).
 */
function buildCloseAccountInstruction(
  account: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
): TransactionInstruction {
  const data = Buffer.from([9]);
  return new TransactionInstruction({
    keys: [
      {pubkey: account, isSigner: false, isWritable: true},
      {pubkey: destination, isSigner: false, isWritable: true},
      {pubkey: owner, isSigner: true, isWritable: false},
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

/**
 * Build one or more VersionedTransactions that close empty token accounts,
 * returning the rent SOL to `owner`.
 *
 * Safety rules:
 *  - Accounts whose mint matches any CORE_MINTS entry (including NOC) are
 *    silently filtered out and never closed.
 *  - At most `maxPerBatch` (default 20) closeAccount instructions per tx.
 *  - Returns an empty array when there are no eligible accounts after filtering.
 *
 * @param owner       Wallet public key — receives recovered rent and must sign.
 * @param accounts    Candidate token account public keys to close.
 * @param mintByAccount  Map from account address → mint address (used for NOC filtering).
 * @param maxPerBatch Maximum closeAccount instructions per transaction (default 20).
 */
export async function buildCloseAccountsTx(
  owner: PublicKey,
  accounts: PublicKey[],
  mintByAccount: ReadonlyMap<string, string>,
  maxPerBatch: number = MAX_CLOSE_PER_BATCH,
): Promise<VersionedTransaction[]> {
  // Filter out any account whose mint is in CORE_MINTS (never close NOC ATA, etc.)
  const eligible = accounts.filter(acc => {
    const mint = mintByAccount.get(acc.toBase58());
    if (mint === undefined) return true; // unknown mint — allow closing
    return !CORE_MINTS.has(mint);
  });

  if (eligible.length === 0) return [];

  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();

  const transactions: VersionedTransaction[] = [];

  for (let i = 0; i < eligible.length; i += maxPerBatch) {
    const batch = eligible.slice(i, i + maxPerBatch);

    const instructions = batch.map(acc =>
      buildCloseAccountInstruction(acc, owner, owner),
    );

    const message = new TransactionMessage({
      payerKey: owner,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    transactions.push(new VersionedTransaction(message));
  }

  return transactions;
}

/** Reset the in-memory Jupiter verified cache (test utility only). */
export function _resetVerifiedCacheForTesting(): void {
  _verifiedMints = null;
  _verifiedLoadedAt = 0;
}
