/**
 * post-M1d spec §5, R8, r2-6: the ONLY source of a token symbol on the transaction detail (#27). A
 * symbol is shown only when it comes from CORE_TOKENS, from the pool token (A0_TOKEN, where private
 * balances exist), or from the DAS metadata cache for a mint that passes `classifyToken` as
 * 'verified' (the Jupiter list; the DAS cache has no verified flag of its own). Anything else is the
 * short mint: an unverified mint may call itself "USDC". If the verified list is not loaded yet, a
 * verified mint reads as its short mint — fail closed. No request is made here.
 */
import {CORE_TOKENS} from './coreTokens';
import {TokenManager} from './tokenModule';
import {loadCachedMetadata} from './tokenMetadata';
import {A0_TOKEN} from '../shielded/a0/screenSupport';
import {isShieldedEnabled} from '../../constants/features';

const tokenManager = new TokenManager();

/** "Ab12cd…ef34" */
export function shortMint(mint: string): string {
  return mint.length <= 11 ? mint : `${mint.slice(0, 6)}…${mint.slice(-4)}`;
}

export function trustedSymbol(mint: string): string {
  if (mint === 'native') {
    return 'SOL';
  }
  const core = CORE_TOKENS.find(t => t.mint === mint);
  if (core) {
    return core.symbol;
  }
  if (isShieldedEnabled() && mint === A0_TOKEN.mint) {
    return A0_TOKEN.symbol;
  }
  if (tokenManager.classifyToken(mint) === 'verified') {
    const symbol = loadCachedMetadata()[mint]?.symbol;
    if (typeof symbol === 'string' && symbol.trim() !== '') {
      return symbol.trim();
    }
  }
  return shortMint(mint);
}
