import {useState, type FormEvent} from 'react';
import {useWallet} from '@solana/wallet-adapter-react';
import {useBuy} from './useBuy';
import {useBalances} from '../portfolio/useBalances';
import {MAINNET_PROGRAM_ID, MAINNET_SOL_TREASURY} from '../../../core/presale/addresses';
import {estimateNocForSol} from '../../../core/presale/buyInstructions';
import {
  canBuy as gatePurchase,
  MIN_PURCHASE_USD,
  MAX_PURCHASE_USD,
} from '../../../core/presale/purchaseGate';

const LAMPORTS_PER_SOL = 1_000_000_000n;

/** "1.5" → 1500000000n, without ever putting the amount through a float. */
export function solToLamports(input: string): bigint {
  if (!/^\d*\.?\d*$/.test(input.trim()) || input.trim() === '' || input.trim() === '.') {
    throw new Error('Enter an amount in SOL');
  }
  const [whole = '0', frac = ''] = input.trim().split('.');
  if (frac.length > 9) throw new Error('SOL has at most 9 decimal places');
  return BigInt(whole || '0') * LAMPORTS_PER_SOL + BigInt(frac.padEnd(9, '0') || '0');
}

export function BuyForm({
  stage,
  solUsd,
}: {
  stage: {displayStage: number; pricePerNocUsd: number};
  solUsd: number | null;
}) {
  const {submit, state, error, canBuy, blockedReason} = useBuy(stage);
  const {publicKey} = useWallet();
  // Same query key as the portfolio panel, so TanStack Query serves both from one fetch.
  const {sol: solLamports} = useBalances(publicKey ?? null);
  const [amount, setAmount] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const busy = state === 'checking' || state === 'simulating' || state === 'signing' || state === 'confirming';

  if (blockedReason) return <p role="alert">{blockedReason}</p>;
  if (!canBuy) return <p>Connect a wallet to buy.</p>;

  const sol = Number(amount);
  const noc = solUsd !== null && Number.isFinite(sol) ? estimateNocForSol(sol, solUsd, stage.pricePerNocUsd) : null;

  /**
   * The same rule the Android app applies, from core/. Without it the page would let a $5
   * purchase be signed and the PROGRAM would refuse it — the user pays a signature and a
   * network fee to be told something this page already knew.
   *
   * Until the SOL price and the balance have loaded there is nothing to check against, so
   * the gate is held closed with no complaint rather than guessing with a zero.
   */
  const ready = solUsd !== null && solLamports !== null;
  const gate = ready
    ? gatePurchase({
        paymentToken: 'SOL',
        amount,
        solUsd,
        solBalance: Number(solLamports) / Number(LAMPORTS_PER_SOL),
        tokenBalance: 0,
      })
    : {enabled: false, reason: null};

  // Only once there is a real amount to describe. Rendering "Paying 0 SOL · Receiving 0.00
  // NOC" over an empty field puts a concrete, false claim in the one place on this page the
  // user is being trained to read before signing.
  const showSummary = Number.isFinite(sol) && sol > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSignature(null);
    try {
      setSignature(await submit(solToLamports(amount)));
    } catch {
      // surfaced through `error` from the hook
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="sol-amount">Amount in SOL</label>
      <input
        id="sol-amount"
        inputMode="decimal"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      {/* Said before the attempt, not discovered from a rejected transaction. */}
      <p>
        Minimum ${MIN_PURCHASE_USD} · maximum ${MAX_PURCHASE_USD.toLocaleString('en-US')} per
        transaction
      </p>

      {/* Spec 6.7: what is being signed, in words, before the request goes out. */}
      {showSummary ? (
        <ul aria-label="What you are signing">
          <li>Paying {amount} SOL{solUsd !== null ? ` (about $${(sol * solUsd).toFixed(2)})` : ''}</li>
          <li>Receiving {noc !== null ? noc.toFixed(2) : '—'} NOC at stage {stage.displayStage}, ${stage.pricePerNocUsd} per NOC</li>
          <li>To the presale program {MAINNET_PROGRAM_ID}</li>
          <li>Treasury {MAINNET_SOL_TREASURY}</li>
        </ul>
      ) : null}

      {gate.reason ? <p role="status">{gate.reason}</p> : null}

      <button type="submit" disabled={busy || !gate.enabled}>
        {busy ? state : 'Buy NOC'}
      </button>

      {error ? <p role="alert">{error}</p> : null}
      {signature ? <p>Sent: {signature}</p> : null}
    </form>
  );
}
