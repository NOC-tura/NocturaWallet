import {useEffect, useState} from 'react';
import {useWallet} from '@solana/wallet-adapter-react';

export type WalletAvailability = 'searching' | 'available' | 'none';

/**
 * How long to wait before concluding that nothing is installed.
 *
 * An empty wallet list on the first render is NOT evidence of absence. Wallet Standard
 * discovery is event-driven: the app dispatches `wallet-standard:app-ready` on mount, and a
 * wallet whose content script has not run yet registers later, when its own listener fires.
 * Deciding "you have no wallet" from the first paint would tell a Phantom user to install
 * Phantom — a wrong answer delivered confidently, which is worse than a slow one.
 *
 * 800 ms is chosen to be longer than extension injection and short enough not to read as a
 * stall. It is a floor on the *bad* answer, not a delay on the good one: the moment a wallet
 * registers the state flips to `available`, whether that takes 5 ms or 700.
 */
export const SETTLE_MS = 800;

/**
 * Split out from the hook so the rule can be tested without a renderer and without timers.
 * The asymmetry is the whole point: presence is knowable immediately, absence never is.
 */
export function decideAvailability(detected: number, settled: boolean): WalletAvailability {
  if (detected > 0) return 'available';
  return settled ? 'none' : 'searching';
}

export function useWalletAvailability(settleMs: number = SETTLE_MS): WalletAvailability {
  // `wallets` is already filtered: WalletProviderBase drops every adapter reporting
  // Unsupported, which is how the Mobile Wallet Adapter stub stays out of this count.
  const {wallets} = useWallet();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), settleMs);
    return () => clearTimeout(timer);
  }, [settleMs]);

  return decideAvailability(wallets.length, settled);
}
