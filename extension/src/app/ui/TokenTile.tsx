import type {Token} from '../engine';

/** The design's synthetic token icon (`.ico.sol|noc|usdc`): a tinted circle with the symbol. No third-party logos. */
export function TokenTile({token, size = 36}: {token: Token; size?: number}) {
  return (
    <div className={`ico s8-tok ${token.toLowerCase()}`} style={{width: size, height: size}} aria-hidden="true">
      {token}
    </div>
  );
}
