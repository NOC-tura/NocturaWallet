import {useState, type FormEvent} from 'react';
import {useBuy} from './useBuy';
import {MAINNET_PROGRAM_ID, MAINNET_SOL_TREASURY} from '../../../core/presale/addresses';
import {estimateNocForSol} from '../../../core/presale/buyInstructions';

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
  const [amount, setAmount] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const busy = state === 'checking' || state === 'simulating' || state === 'signing' || state === 'confirming';

  if (blockedReason) return <p role="alert">{blockedReason}</p>;
  if (!canBuy) return <p>Connect a wallet to buy.</p>;

  const sol = Number(amount);
  const noc = solUsd !== null && Number.isFinite(sol) ? estimateNocForSol(sol, solUsd, stage.pricePerNocUsd) : null;

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

      {/* Spec 6.7: what is being signed, in words, before the request goes out. */}
      <ul aria-label="What you are signing">
        <li>Paying {amount || '0'} SOL{solUsd !== null ? ` (about $${(sol * solUsd).toFixed(2)})` : ''}</li>
        <li>Receiving {noc !== null ? noc.toFixed(2) : '—'} NOC at stage {stage.displayStage}, ${stage.pricePerNocUsd} per NOC</li>
        <li>To the presale program {MAINNET_PROGRAM_ID}</li>
        <li>Treasury {MAINNET_SOL_TREASURY}</li>
      </ul>

      <button type="submit" disabled={busy || amount === ''}>
        {busy ? state : 'Buy NOC'}
      </button>

      {error ? <p role="alert">{error}</p> : null}
      {signature ? <p>Sent: {signature}</p> : null}
    </form>
  );
}
