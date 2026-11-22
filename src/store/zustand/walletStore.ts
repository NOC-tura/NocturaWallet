import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvPublicStorage} from '../mmkv/publicAdapter';
import {CORE_TOKENS} from '../../modules/tokens/coreTokens';

export interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  trust: 'core' | 'verified' | 'unknown';
  isScamFlagged?: boolean;
}

interface WalletState {
  publicKey: string | null;
  // BLS12-381 G1 compressed (48 bytes). Re-derived from native on each session unlock.
  // Not persisted — excluded via partialize. Use hex encoding for bridge transport.
  pkShielded: Uint8Array | null;
  solBalance: string;
  nocBalance: string;
  tokenBalances: Record<string, string>;
  totalUsdValue: number;
  nocUsdPrice: number;
  tokens: TokenMetadata[];
  lastSyncedAt: number | null;
  // post-M1d §3.1 / R13: this session's last failed sync. Memory only — excluded via partialize and forced null on rehydration.
  lastSyncFailedAt: number | null;

  setPublicKey: (pk: string) => void;
  setPkShielded: (pk: Uint8Array) => void;
  updateBalances: (sol: string, noc: string, tokens: Record<string, string>) => void;
  setNocUsdPrice: (price: number) => void;
  markSyncFailed: () => void;
  setTokens: (tokens: TokenMetadata[]) => void;
  reset: () => void;
}

const DEFAULTS = {
  publicKey: null,
  pkShielded: null,
  solBalance: '0',
  nocBalance: '0',
  tokenBalances: {},
  totalUsdValue: 0,
  nocUsdPrice: 0,
  tokens: [],
  lastSyncedAt: null,
  lastSyncFailedAt: null,
};

/**
 * post-M1d R7 (review r1-6): the token list is persisted, so a row written by an older build can carry a
 * label the registry no longer uses (wrapped SOL was "SOL" / "Solana"). A core mint always shows its
 * CORE_TOKENS symbol and name; every other row is returned as stored. Runs on rehydration (`merge`).
 */
export function relabelCoreTokens(tokens: readonly TokenMetadata[]): TokenMetadata[] {
  return tokens.map(t => {
    const core = CORE_TOKENS.find(c => c.mint === t.mint);
    return core && (t.symbol !== core.symbol || t.name !== core.name) ? {...t, symbol: core.symbol, name: core.name} : t;
  });
}

export const useWalletStore = create<WalletState>()(
  persist(
    set => ({
      ...DEFAULTS,
      setPublicKey: (pk: string) => set({publicKey: pk}),
      setPkShielded: (pk: Uint8Array) => set({pkShielded: pk}),
      updateBalances: (sol, noc, tokens) =>
        set({solBalance: sol, nocBalance: noc, tokenBalances: tokens, lastSyncedAt: Date.now(), lastSyncFailedAt: null}),
      markSyncFailed: () => set({lastSyncFailedAt: Date.now()}),
      setNocUsdPrice: (price: number) => set({nocUsdPrice: price}),
      setTokens: (tokens: TokenMetadata[]) => set({tokens}),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'noctura-wallet',
      // Persists to mmkvPublic — publicKey is a public Solana address (no
      // privacy concern) and balances are queryable on any block explorer.
      // The actually-sensitive material (seed, PIN hash, view key) lives in
      // react-native-keychain (Android Keystore-backed). Earlier draft used
      // mmkvSecureStorage but initSecureMmkv() was never wired anywhere, so
      // all persist writes went to a dead queue and publicKey was lost on
      // every cold start. Encrypted MMKV can be re-enabled later once a
      // proper encryption-key derivation lands at app-unlock time.
      storage: createJSONStorage(() => mmkvPublicStorage),
      partialize: ({pkShielded: _pkShielded, lastSyncFailedAt: _lastSyncFailedAt, ...rest}) => rest,
      // r2-1: a new session never starts stale, whatever the record holds.
      // review r1-6: a persisted core-token row takes the registry's label (no version/migrate exists to bump).
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<WalletState>;
        return {
          ...current,
          ...stored,
          tokens: Array.isArray(stored.tokens) ? relabelCoreTokens(stored.tokens) : current.tokens,
          lastSyncFailedAt: null,
        };
      },
    },
  ),
);
