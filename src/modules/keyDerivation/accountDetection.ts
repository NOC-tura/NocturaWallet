import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {getBalance, getTokenAccounts} from '../solana/queries';
import {NOC_MINT} from '../../constants/programs';
import {deriveTransparentKeypair, type TransparentScheme} from './transparent';

export interface AccountCandidate {
  scheme: TransparentScheme;
  address: string;
  lamports: bigint;
  nocAmount: bigint; // NOC in smallest unit (decimals = 9)
  funded: boolean;
}

const SLIP10_ACCOUNTS_TO_SCAN = 5; // accounts 0..4

function candidateSchemes(): TransparentScheme[] {
  const schemes: TransparentScheme[] = [];
  for (let i = 0; i < SLIP10_ACCOUNTS_TO_SCAN; i++) {
    schemes.push({kind: 'slip10', account: i});
  }
  schemes.push({kind: 'cli'});
  return schemes;
}

/**
 * Derive every candidate address from the seed and query its on-chain SOL + NOC
 * balance. Funded candidates are sorted first. Never throws on a per-account RPC
 * failure — a failed lookup is treated as a zero balance.
 */
export async function detectFundedAccounts(
  seed: Uint8Array,
): Promise<AccountCandidate[]> {
  const connection = getConnection();
  const candidates = await Promise.all(
    candidateSchemes().map(async scheme => {
      const {publicKey} = deriveTransparentKeypair(seed, scheme);
      const pk = new PublicKey(publicKey);
      let lamports = 0n;
      let nocAmount = 0n;
      try {
        lamports = await getBalance(connection, pk);
      } catch {
        lamports = 0n;
      }
      try {
        const accounts = await getTokenAccounts(connection, pk);
        for (const acc of accounts) {
          if (acc.mint === NOC_MINT) nocAmount += BigInt(acc.amount);
        }
      } catch {
        nocAmount = 0n;
      }
      return {
        scheme,
        address: pk.toBase58(),
        lamports,
        nocAmount,
        funded: lamports > 0n || nocAmount > 0n,
      };
    }),
  );
  return candidates.sort((a, b) =>
    a.funded === b.funded ? 0 : a.funded ? -1 : 1,
  );
}
