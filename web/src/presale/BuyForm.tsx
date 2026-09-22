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
    /* One card, not four floating pieces. Choosing a currency, entering an amount,
       reading what will be signed and pressing the button are one act, and before this
       they sat on the page as separate objects with nothing saying they belonged
       together. */
    <form onSubmit={onSubmit} className="buy noc-card">
      {/* Segmented, not a dropdown: three options that each change the meaning of the
          field below deserve to be visible at once rather than hidden behind a click. */}
      <fieldset className="seg">
        <legend className="noc-overline noc-dim">Pay with</legend>
        <div className="seg-row">
          {TOKENS.map(t => (
            <label key={t} htmlFor={`pay-${t}`} className={t === token ? 'seg-on' : undefined}>
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
              <span className="noc-body-sm">{t}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="buy-amount">
        <label htmlFor="buy-amount" className="noc-overline noc-dim">
          Amount in {token}
        </label>
        <div className="noc-row">
          <input
            id="buy-amount"
            className="noc-amount"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <span className="noc-ticker">{token}</span>
        </div>

        {showSummary ? (
          <>
            <hr className="noc-rule" />
            <div className="noc-row">
              <span className="noc-balance-md noc-numeral">
                {noc !== null ? noc.toFixed(2) : '—'}
              </span>
              <span className="noc-ticker" style={{color: 'var(--accent)'}}>
                NOC
              </span>
            </div>
          </>
        ) : null}

        {/* Said before the attempt, not discovered from a rejected transaction. */}
        <div className="noc-meta noc-caption">
          <span>
            Min ${MIN_PURCHASE_USD} · max ${MAX_PURCHASE_USD.toLocaleString('en-US')}
          </span>
          {priceKnown && showSummary ? <b>≈ ${usd.toFixed(2)}</b> : null}
        </div>
      </div>

      {/* Spec 6.7: what is being signed, in words, before the request goes out. */}
      {showSummary ? (
        <ul aria-label="What you are signing" className="signing noc-body-sm">
          <li>
            Paying {amount} {token}
            {priceKnown ? ` (about $${usd.toFixed(2)})` : ''}
          </li>
          <li>
            Receiving {noc !== null ? noc.toFixed(2) : '—'} NOC at stage {stage.displayStage}, $
            {stage.pricePerNocUsd} per NOC
          </li>
          <li>
            To the presale program <span className="noc-mono">{MAINNET_PROGRAM_ID}</span>
          </li>
          <li>
            Treasury <span className="noc-mono">{MAINNET_SOL_TREASURY}</span>
          </li>
        </ul>
      ) : null}

      {gate.reason ? (
        <p role="status" className="noc-body-sm noc-warning">
          {gate.reason}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary" disabled={busy || !gate.enabled}>
        {busy ? state : `Buy NOC with ${token}`}
      </button>

      {error ? (
        <p role="alert" className="noc-body-sm noc-danger">
          {error}
        </p>
      ) : null}
      {signature ? <p className="noc-body-sm noc-mono noc-muted">Sent: {signature}</p> : null}
    </form>
  );
}
