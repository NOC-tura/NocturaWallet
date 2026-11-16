/**
 * The build's chain identity (spec S13): which Solana cluster this build talks to, as the
 * screens name it and as explorer links carry it — read from NETWORK, which programs.ts
 * refuses at import unless it is exactly `devnet` or `mainnet-beta` (networkGuard: an unknown or
 * missing value never falls back to mainnet).
 *
 * Separate from presale on purpose. The devnet build used to set NETWORK=mainnet-beta so the
 * presale constants would not hit their devnet placeholders, and so it said "Solana mainnet" and
 * linked mainnet explorers over devnet transactions. Now NETWORK says what the RPC is on, and
 * presale — which exists on mainnet only — is simply not offered on devnet.
 */
import {NETWORK} from './programs';
import type {KnownNetwork} from './networkGuard';

export interface ChainIdentity {
  readonly network: KnownNetwork;
  /** The network as a screen names it ("Network" rows, "Confirmed on …"). */
  readonly label: 'Solana devnet' | 'Solana mainnet';
  /** The short form for "Simulating on … RPC". */
  readonly short: 'devnet' | 'mainnet';
}

export function chainIdentity(network: KnownNetwork): ChainIdentity {
  return network === 'devnet'
    ? {network, label: 'Solana devnet', short: 'devnet'}
    : {network, label: 'Solana mainnet', short: 'mainnet'};
}

/** This build's chain. */
export const CHAIN: ChainIdentity = chainIdentity(NETWORK);

/**
 * Presale, and every surface of the Phase 1 program it belongs to (staking, the presale
 * referral, the purchase geo gate), exists on mainnet only: there is no devnet deployment, so
 * the devnet build does not offer it (S13: disabled, never run on placeholders).
 */
export function isPresaleEnabled(network: KnownNetwork = NETWORK): boolean {
  return network === 'mainnet-beta';
}

export type Explorer = 'solscan' | 'solanaexplorer' | 'solanafm';

const TX_BASE: Record<Explorer, string> = {
  solscan: 'https://solscan.io/tx/',
  solanaexplorer: 'https://explorer.solana.com/tx/',
  solanafm: 'https://solana.fm/tx/',
};

/**
 * A transaction's explorer link on this build's chain. On devnet every link carries
 * `?cluster=devnet` — the query Solscan and the Solana Explorer read; Solana FM's devnet
 * parameter is not that one, so on devnet a Solana FM choice links the Solana Explorer instead
 * (a link without its cluster would open the mainnet page of a devnet signature).
 */
export function explorerTxUrl(
  signature: string,
  explorer: Explorer = 'solscan',
  network: KnownNetwork = NETWORK,
): string {
  if (network === 'devnet') {
    const base = explorer === 'solanafm' ? TX_BASE.solanaexplorer : TX_BASE[explorer];
    return `${base}${signature}?cluster=devnet`;
  }
  return `${TX_BASE[explorer]}${signature}`;
}
