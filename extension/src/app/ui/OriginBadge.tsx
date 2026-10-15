import {ExtIcon} from './ExtIcon';

/**
 * The design's OriginBadge for a dApp's transaction (index.html #26b ix:11813, #27b ix:12163; `.origin-badge
 * [data-origin="dapp"]`): "Dapp · simulated" with the chain-link glyph — the visible sign that the transaction went
 * through #48's mandatory simulation (spec B1c §3.3). The first-party "Wallet" pill is not drawn (Scope: the extension
 * knows only the transactions sites had it sign). The aria-label is the design's provenance without its timing (the
 * wallet does not keep a past simulation's milliseconds) — controller copy, Scope.
 */
export const DAPP_BADGE_TEXT = 'Dapp · simulated';
export const DAPP_BADGE_LABEL = 'dApp-originated transaction · simulated';

export function OriginBadge() {
  return (
    <span className="origin-badge" data-origin="dapp" aria-label={DAPP_BADGE_LABEL}>
      <ExtIcon name="link" size={9} />
      {DAPP_BADGE_TEXT}
    </span>
  );
}
