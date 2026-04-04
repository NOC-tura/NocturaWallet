import {CORE_MINTS} from './coreTokens';
import {NOC_MINT} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {API_BASE} from '../../constants/programs';

type TrustTier = 'core' | 'verified' | 'unknown';

interface SimpleAccount {
  mint: string;
  balance: string;
  address: string;
}

export class TokenManager {
  classifyToken(mint: string): TrustTier {
    if (CORE_MINTS.has(mint)) return 'core';
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
