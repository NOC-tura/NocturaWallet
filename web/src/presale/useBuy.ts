import {useCallback, useMemo, useRef, useState} from 'react';
import {useWallet} from '@solana/wallet-adapter-react';
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {checkGeo} from '../geo/useGeo';
import {json, post} from '../lib/api';
import {accountReader, connection} from '../lib/solana';
import {buildBuyInstructions, estimateNocForSol} from '../../../core/presale/buyInstructions';
import {resolveReferrer} from '../../../core/presale/referrer';
import {recordPresalePurchase} from '../../../core/presale/record';
import {estimatePriorityFee} from '../../../core/solana/priorityFee';
import {isPresaleBlocked} from '../../../core/geo/classify';
import {MAINNET_PROGRAM_ID} from '../../../core/presale/addresses';

export type BuyState = 'idle' | 'checking' | 'simulating' | 'signing' | 'confirming' | 'done' | 'error';

/** ≥500 ms between submissions, per cardinal rule 6, held per hook instance. */
const DEBOUNCE_MS = 500;

const ALLOWED_PROGRAM_IDS = [
  MAINNET_PROGRAM_ID,
  ComputeBudgetProgram.programId.toBase58(),
  SystemProgram.programId.toBase58(),
];

/**
 * Can this wallet broadcast for itself?
 *
 * The standard adapter branches on exactly this property: with
 * `solana:signAndSendTransaction` it asks the wallet to send, and without it, it signs
 * and calls `connection.sendRawTransaction` on OUR connection — where `sendTransaction`
 * is not on the RPC allowlist and comes back 403 AFTER the user has signed. So the
 * check reads the same condition the adapter itself uses, not a proxy for it.
 */
function canBroadcast(wallet: unknown): boolean {
  const features = (wallet as {adapter?: {wallet?: {features?: Record<string, unknown>}}})?.adapter
    ?.wallet?.features;
  if (!features) return true; // non-standard adapters handle their own sending
  return 'solana:signAndSendTransaction' in features;
}

export function useBuy(stage: {displayStage: number; pricePerNocUsd: number}) {
  const {publicKey, sendTransaction, wallet} = useWallet();
  const [state, setState] = useState<BuyState>('idle');
  const [error, setError] = useState<string | null>(null);
  const lastSubmit = useRef(0);
  const inFlight = useRef(false);

  const blockedReason = useMemo(() => {
    if (!wallet) return null;
    return canBroadcast(wallet)
      ? null
      : 'This wallet cannot broadcast transactions here yet. Connect Phantom, Solflare or Backpack to buy.';
  }, [wallet]);

  const submit = useCallback(
    async (solLamports: bigint): Promise<string> => {
      if (!publicKey) throw new Error('No wallet connected');
      if (blockedReason) throw new Error(blockedReason);
      const now = Date.now();
      if (inFlight.current || now - lastSubmit.current < DEBOUNCE_MS) {
        throw new Error('Too soon — a purchase is already in flight');
      }
      inFlight.current = true;
      lastSubmit.current = now;
      setError(null);

      try {
        setState('checking');
        // Throws when the lookup fails: this gate sits in front of a purchase.
        const geo = await checkGeo();
        if (isPresaleBlocked(geo.result)) {
          throw new Error(`This region is restricted: ${geo.result.reason ?? geo.result.countryCode}`);
        }

        const conn = connection();
        const [resolved, priorityFee, latest] = await Promise.all([
          resolveReferrer(accountReader, publicKey, new URLSearchParams(window.location.search).get('ref')),
          estimatePriorityFee(conn, 'normal'),
          conn.getLatestBlockhash(),
        ]);

        const instructions = buildBuyInstructions(publicKey, solLamports, priorityFee, resolved);
        const foreign = instructions.find(ix => !ALLOWED_PROGRAM_IDS.includes(ix.programId.toBase58()));
        if (foreign) {
          // A transaction we built addressing a program we did not expect is our bug.
          // Refuse rather than ask for a signature on a summary we cannot vouch for.
          throw new Error(`Refusing to sign: unexpected program ${foreign.programId.toBase58()}`);
        }

        const tx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: latest.blockhash,
            instructions,
          }).compileToV0Message(),
        );

        setState('simulating');
        const sim = await conn.simulateTransaction(tx);
        if (sim.value.err) {
          throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);
        }

        setState('signing');
        // The WALLET broadcasts. Our proxy never sends anything, which is the property
        // one test on the coordinator can prove about that key.
        const signature = await sendTransaction(tx, conn);

        setState('confirming');
        await confirmBySignature(signature, latest.lastValidBlockHeight);

        const sol = Number(solLamports) / 1e9;
        const solUsd = await fetchSolUsd();
        // core's recordPresalePurchase swallows by contract, and this catch is the
        // same promise made locally: the money has already moved, so a failed archive
        // must never surface as a failed purchase — not even if that collaborator is
        // replaced by one that throws.
        try {
          await recordPresalePurchase(post, {
            txHash: signature,
            buyerAddress: publicKey.toBase58(),
            paymentToken: 'SOL',
            paymentAmount: sol,
            nocAmount: estimateNocForSol(sol, solUsd, stage.pricePerNocUsd),
            usdValue: sol * solUsd,
            stage: stage.displayStage,
            ...(resolved.effectiveReferrerAddress
              ? {referrerAddress: resolved.effectiveReferrerAddress}
              : {}),
          });
        } catch {
          // recorded nowhere, landed on chain — the chain is the source of truth
        }

        setState('done');
        return signature;
      } catch (e) {
        setState('error');
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        inFlight.current = false;
      }
    },
    [blockedReason, publicKey, sendTransaction, stage.displayStage, stage.pricePerNocUsd],
  );

  return {submit, state, error, canBuy: blockedReason === null && publicKey !== null, blockedReason};
}

/** Poll until confirmed, or until the blockhash this transaction used has expired. */
async function confirmBySignature(signature: string, lastValidBlockHeight: number): Promise<void> {
  const conn = connection();
  // 2 s: the coordinator's RPC route allows 240 requests a minute with an Origin, and
  // a 1 s loop on two calls would spend half of that on one purchase.
  const INTERVAL_MS = 2000;
  for (;;) {
    const statuses = await conn.getSignatureStatuses([signature]);
    const status = statuses.value[0];
    if (status?.err) throw new Error(`Transaction failed on chain: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return;
    if ((await conn.getBlockHeight()) > lastValidBlockHeight) {
      throw new Error('The transaction expired before it confirmed.');
    }
    await new Promise(r => setTimeout(r, INTERVAL_MS));
  }
}

async function fetchSolUsd(): Promise<number> {
  const body = await json.get<{success?: boolean; data?: {solana?: {usd?: number}}}>(
    '/wallet/prices?ids=solana',
  );
  const usd = body.data?.solana?.usd;
  if (!body.success || typeof usd !== 'number') {
    throw new Error('SOL price unavailable');
  }
  return usd;
}

export {canBroadcast, ALLOWED_PROGRAM_IDS};
export type {PublicKey};
