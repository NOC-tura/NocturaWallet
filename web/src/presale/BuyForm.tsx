import {useState, type FormEvent} from 'react';
import {useWallet} from '@solana/wallet-adapter-react';
import {useBuy} from './useBuy';
import {useBalances} from '../portfolio/useBalances';
import {MAINNET_PROGRAM_ID, MAINNET_SOL_TREASURY} from '../../../core/presale/addresses';
import {
  estimateNocForSol,
  estimateNocForUsd,
  TOKEN_DECIMALS,
} from '../../../core/presale/buyInstructions';
import {
  canBuy as gatePurchase,
  MIN_PURCHASE_USD,
  MAX_PURCHASE_USD,
  type PaymentToken,
} from '../../../core/presale/purchaseGate';

const TOKENS: PaymentToken[] = ['SOL', 'USDC', 'USDT'];

/**
 * "1.5" → base units, without ever putting the amount through a float.
 *
 * Decimals are a parameter rather than a constant: SOL has 9 and both stablecoins have
 * 6, and a shared 9 would quietly multiply a USDC purchase by a thousand.
 */
export function parseAmount(input: string, decimals: number): bigint {
  const t = input.trim();
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') {
    throw new Error('Enter an amount');
  }
  const [whole = '0', frac = ''] = t.split('.');
  if (frac.length > decimals) throw new Error(`That token has at most ${decimals} decimal places`);
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
}

/** Kept for the callers and tests that only ever meant SOL. */
export const solToLamports = (input: string): bigint => parseAmount(input, 9);

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
  const balances = useBalances(publicKey ?? null);
  const [token, setToken] = useState<PaymentToken>('SOL');
  const [amount, setAmount] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const busy = state === 'checking' || state === 'simulating' || state === 'signing' || state === 'confirming';

  if (blockedReason) return <p role="alert">{blockedReason}</p>;
  if (!canBuy) return <p>Connect a wallet to buy.</p>;

  const decimals = TOKEN_DECIMALS[token];
  const entered = Number(amount);
  const held = token === 'SOL' ? balances.sol : token === 'USDC' ? balances.usdc : balances.usdt;

  // A stablecoin IS its dollar value; only SOL needs a price to be worth anything here.
  const priceKnown = token !== 'SOL' || solUsd !== null;
  const usd = token === 'SOL' ? entered * (solUsd ?? 0) : entered;
  const noc =
    priceKnown && Number.isFinite(entered)
      ? token === 'SOL'
        ? estimateNocForSol(entered, solUsd as number, stage.pricePerNocUsd)
        : estimateNocForUsd(entered, stage.pricePerNocUsd)
      : null;

  /**
   * The same rule the Android app applies, from core/. Until the price and the balance
   * have loaded there is nothing to check against, so the gate is held closed with no
   * complaint rather than guessing with a zero.
   */
  const ready = priceKnown && balances.sol !== null && held !== null;
  const gate = ready
    ? gatePurchase({
        paymentToken: token,
        amount,
        solUsd: solUsd ?? 0,
        solBalance: Number(balances.sol) / 1e9,
        tokenBalance: Number(held) / 10 ** decimals,
      })
    : {enabled: false, reason: null};

  // Only once there is a real amount to describe. Rendering "Paying 0 · Receiving 0.00
  // NOC" over an empty field puts a concrete, false claim in the one place on this page
  // the user is being trained to read before signing.
  const showSummary = Number.isFinite(entered) && entered > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSignature(null);
    try {
      setSignature(await submit(token, parseAmount(amount, decimals)));
    } catch {
      // surfaced through `error` from the hook
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <fieldset>
        <legend>Pay with</legend>
        {TOKENS.map(t => (
          <label key={t} htmlFor={`pay-${t}`}>
            <input
              id={`pay-${t}`}
              type="radio"
              name="paymentToken"
              value={t}
              checked={token === t}
              onChange={() => {
                setToken(t);
                // Not carried over: "10" means ten dollars in USDC and about $1,180 in
                // SOL, and the summary would be recomputed under the reader without the
                // field appearing to change.
                setAmount('');
                setSignature(null);
              }}
            />
            {t}
          </label>
        ))}
      </fieldset>

      <label htmlFor="buy-amount">Amount in {token}</label>
      <input
        id="buy-amount"
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
          <li>
            Paying {amount} {token}
            {priceKnown ? ` (about $${usd.toFixed(2)})` : ''}
          </li>
          <li>
            Receiving {noc !== null ? noc.toFixed(2) : '—'} NOC at stage {stage.displayStage}, $
            {stage.pricePerNocUsd} per NOC
          </li>
          <li>To the presale program {MAINNET_PROGRAM_ID}</li>
          <li>Treasury {MAINNET_SOL_TREASURY}</li>
        </ul>
      ) : null}

      {gate.reason ? <p role="status">{gate.reason}</p> : null}

      <button type="submit" disabled={busy || !gate.enabled}>
        {busy ? state : `Buy NOC with ${token}`}
      </button>

      {error ? <p role="alert">{error}</p> : null}
      {signature ? <p>Sent: {signature}</p> : null}
    </form>
  );
}
