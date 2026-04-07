import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mmkvSecureStorage} from '../mmkv/secureAdapter';

interface TokenMetadata {
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
  shieldedBalances: Record<string, string>;
  totalUsdValue: number;
  nocUsdPrice: number;
  tokens: TokenMetadata[];
  lastSyncedAt: number | null;

  setPublicKey: (pk: string) => void;
  setPkShielded: (pk: Uint8Array) => void;
  updateBalances: (sol: string, noc: string, tokens: Record<string, string>) => void;
  updateShieldedBalance: (mint: string, balance: string) => void;
  setNocUsdPrice: (price: number) => void;
  setTokens: (tokens: TokenMetadata[]) => void;
  reset: () => void;
}

const DEFAULTS = {
  publicKey: null,
  pkShielded: null,
  solBalance: '0',
  nocBalance: '0',
  tokenBalances: {},
  shieldedBalances: {},
  totalUsdValue: 0,
  nocUsdPrice: 0,
  tokens: [],
  lastSyncedAt: null,
};

export const useWalletStore = create<WalletState>()(
  persist(
    set => ({
      ...DEFAULTS,
      setPublicKey: (pk: string) => set({publicKey: pk}),
      setPkShielded: (pk: Uint8Array) => set({pkShielded: pk}),
      updateBalances: (sol, noc, tokens) =>
        set({solBalance: sol, nocBalance: noc, tokenBalances: tokens, lastSyncedAt: Date.now()}),
      updateShieldedBalance: (mint, balance) =>
        set(state => ({shieldedBalances: {...state.shieldedBalances, [mint]: balance}})),
      setNocUsdPrice: (price: number) => set({nocUsdPrice: price}),
      setTokens: (tokens: TokenMetadata[]) => set({tokens}),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'noctura-wallet',
      storage: createJSONStorage(() => mmkvSecureStorage),
      partialize: ({pkShielded: _pkShielded, ...rest}) => rest,
    },
  ),
);
