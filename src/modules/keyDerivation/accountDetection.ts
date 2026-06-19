import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {getMultipleBalances, getTokenAccounts} from '../solana/queries';
import {NOC_MINT} from '../../constants/programs';
import {deriveTransparentKeypair, type TransparentScheme} from './transparent';

export interface AccountCandidate {
  scheme: TransparentScheme;
  address: string;
  lamports: bigint;
  nocAmount: bigint; // NOC in smallest unit (decimals = 9)
  funded: boolean;
}

export interface DetectionResult {
  candidates: AccountCandidate[];
  balancesResolved: boolean; // false → the balance RPC failed; addresses are still valid for manual pick
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
 * Derive every candidate address from the seed (SLIP-0010 accounts 0-4 + the
 * solana-keygen "cli" scheme) and enrich each with its on-chain SOL + NOC
 * balance. Addresses are derived locally first (no RPC), so they are always
 * returned even when balance lookup fails.
 *
 * SOL balances are fetched in ONE batched call. If that batched call throws the
 * RPC is unavailable — `balancesResolved` is set false so the UI can surface the
 * failure and offer a retry, rather than silently treating every account as
 * empty (which would auto-select the wrong account). NOC enrichment is
 * best-effort and never flips `balancesResolved`. Funded candidates sort first.
 */
export async function detectFundedAccounts(
  seed: Uint8Array,
): Promise<DetectionResult> {
  const connection = getConnection();
  const schemes = candidateSchemes();
  // Derive every candidate locally (no RPC needed for addresses).
  const derived = schemes.map(scheme => {
    const {publicKey} = deriveTransparentKeypair(seed, scheme);
    return {scheme, pk: new PublicKey(publicKey)};
  });
  const candidates: AccountCandidate[] = derived.map(d => ({
    scheme: d.scheme,
    address: d.pk.toBase58(),
    lamports: 0n,
    nocAmount: 0n,
    funded: false,
  }));

  let balancesResolved = false;
  try {
    // PRIMARY signal: one batched SOL-balance call. If this throws, the RPC is
    // unavailable — surface it rather than pretending every account is empty.
    const lamports = await getMultipleBalances(
      connection,
      derived.map(d => d.pk),
    );
    candidates.forEach((c, i) => {
      c.lamports = lamports[i] ?? 0n;
    });
    // Best-effort NOC enrichment (per-owner). A NOC lookup failure does NOT flip
    // balancesResolved — SOL is the primary signal and is already resolved.
    await Promise.all(
      derived.map(async (d, i) => {
        try {
          const accounts = await getTokenAccounts(connection, d.pk);
          let noc = 0n;
          for (const acc of accounts) {
            if (acc.mint === NOC_MINT) noc += BigInt(acc.amount);
          }
          candidates[i].nocAmount = noc;
        } catch {
          // best-effort; leave nocAmount at 0n
        }
      }),
    );
    candidates.forEach(c => {
      c.funded = c.lamports > 0n || c.nocAmount > 0n;
    });
    balancesResolved = true;
  } catch {
    // RPC unavailable: keep the derived addresses, mark balances unresolved.
    balancesResolved = false;
  }

  candidates.sort((a, b) => (a.funded === b.funded ? 0 : a.funded ? -1 : 1));
  return {candidates, balancesResolved};
}
