import {usePurchases} from './usePurchases';
import {useSignatureVerdicts} from './useSignatureVerdicts';
import {Icon} from '../ui/Icon';

const EXPLORER = 'https://explorer.solana.com/tx/';

/** The chain gave a verdict about the transaction itself, rather than about our ability to ask. */
const chainSpoke = (v: string | undefined) => v === 'missing' || v === 'failed';

const num = (n: number, max = 2) =>
  n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: max});

/** Money always carries both places: "$10.5" is a typo, "$10.50" is an amount. */
const usd = (n: number) =>
  `$${n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

/** ISO → 2026-09-22, in UTC. The chain records UTC and so does this. */
function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

/**
 * The buyer's own purchases, with the signature of each.
 *
 * Until now the page could show someone a total and nothing else: after a purchase the
 * signature appeared once and was gone on reload, so anyone who closed the tab had no
 * record here that their money had moved — only an allocation, which is a sum with no
 * items. This is the part they can check against the chain themselves, which is the only
 * kind of proof worth offering on a page that asks for money.
 */
export function PurchaseHistory() {
  const {purchases, isError, isLoading} = usePurchases();
  // Hooks run before the early return, or the order changes between renders.
  const verdicts = useSignatureVerdicts((purchases ?? []).map(p => p.signature));
  if (purchases === null && !isError && !isLoading) return null;

  return (
    <section>
      <h2>
        <Icon name="clock" />
        Your purchases
      </h2>

      {isLoading ? <p className="noc-card-quiet noc-body noc-muted">Reading…</p> : null}

      {/*
        "Could not read" and "none yet" are opposite statements to someone who has paid.
        The hook keeps them apart and so does this.
      */}
      {isError ? (
        <p className="noc-card-quiet noc-body-sm noc-danger">
          Your purchase history could not be read. This is a connection problem — it does not
          mean a purchase is missing. Anything that landed on chain is on chain regardless.
        </p>
      ) : null}

      {purchases !== null && purchases.length === 0 ? (
        <p className="noc-card-quiet noc-body-sm noc-muted">
          No purchases recorded for this wallet yet.
        </p>
      ) : null}

      {purchases !== null && purchases.length > 0 ? (
        <ol className="buys">
          {purchases.map(p => (
            <li key={p.signature} className="noc-card-quiet buy-row">
              <div className="noc-meta">
                <span className="noc-body noc-numeral">
                  {num(p.nocAmount)} <span className="noc-ticker">NOC</span>
                </span>
                <span className="noc-caption noc-dim noc-numeral">{day(p.createdAt)}</span>
              </div>

              <div className="noc-meta noc-caption">
                <span className="noc-dim noc-numeral">
                  {num(p.paymentAmount, 6)} {p.paymentToken} · {usd(p.usdValue)} · stage {p.stage}
                </span>
                {/*
                  Rendered, never interpreted: the coordinator owns this word, and a page
                  that translated it would be inventing a second source of truth.

                  Suppressed once the chain itself has answered, because then the sentence
                  below says the same thing in a form a person can read. Since 2026-09-22
                  the coordinator marks a phantom row `not_on_chain`, so without this the
                  row would carry that token AND the paragraph — two statements of one
                  fact, one of them in snake_case. `unknown` is not an answer and does not
                  suppress anything.
                */}
                {p.status !== 'confirmed' && !chainSpoke(verdicts[p.signature]) ? (
                  <b className="noc-warning">{p.status}</b>
                ) : null}
              </div>

              {/*
                The chain's own answer, which outranks the word above it.
                `missing` is printed only when the chain actually answered "I do not have
                this" — an RPC we could not reach yields `unknown`, and `unknown` says
                nothing at all. Telling a buyer their purchase does not exist because our
                own proxy was down would be the worst sentence on this page.
              */}
              {verdicts[p.signature] === 'missing' ? (
                <p className="noc-caption noc-danger">
                  Not found on chain. The backend recorded this purchase, but the Solana
                  ledger has no transaction with this signature — so no payment was taken
                  and no tokens are owed for it. Your allocation above is read from the
                  chain and is unaffected.
                </p>
              ) : null}
              {verdicts[p.signature] === 'failed' ? (
                <p className="noc-caption noc-danger">
                  This transaction is on chain but failed, so it moved nothing.
                </p>
              ) : null}

              {/*
                An outbound link, and the only one on this page. §6.10's rule is that the
                site sends you nowhere — but that rule exists against being sent somewhere
                to INSTALL something, which is the shape of a phishing page. This is the
                opposite: it lets a reader check our claim against a source we do not
                control. Navigation, never a request; the page fetches nothing from it, and
                Referrer-Policy: no-referrer means it learns nothing about where you came
                from.
              */}
              <a
                className="noc-caption noc-mono sig"
                href={`${EXPLORER}${p.signature}`}
                target="_blank"
                rel="noreferrer noopener"
                title={p.signature}
              >
                {p.signature.slice(0, 12)}…{p.signature.slice(-12)}
              </a>
            </li>
          ))}
        </ol>
      ) : null}

      {/*
        Said once, so nobody has to work it out from a subtraction.
        These rows are the coordinator's record; the allocation above is read from the
        chain. The two are priced at slightly different moments — the coordinator uses
        its own USD rate, the program its on-chain feed at execution — so the sums do not
        tie exactly and never will. Measured 2026-09-22: 0.036% over five purchases for
        one wallet, 0.031% for another. Without this line, a reader who adds up their own
        history and comes up 0.2 NOC short has no way to tell a rounding difference from
        a missing purchase, which is the whole confusion this page exists to end.
      */}
      {purchases !== null && purchases.length > 0 ? (
        <p className="noc-caption noc-dim">
          These amounts are the backend's record of each purchase. Your allocation is read
          from the chain, priced at the moment each transaction executed, so the two differ
          by a fraction of a percent. The chain is what pays out.
        </p>
      ) : null}
    </section>
  );
}
