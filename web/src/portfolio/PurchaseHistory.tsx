import {usePurchases} from './usePurchases';
import {Icon} from '../ui/Icon';

const EXPLORER = 'https://explorer.solana.com/tx/';

const num = (n: number, max = 2) =>
  n.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: max});

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
                  {num(p.paymentAmount, 6)} {p.paymentToken} · ${num(p.usdValue)} · stage {p.stage}
                </span>
                {/* Rendered, never interpreted: the coordinator owns this word, and a page
                    that translated it would be inventing a second source of truth. */}
                {p.status !== 'confirmed' ? <b className="noc-warning">{p.status}</b> : null}
              </div>

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
    </section>
  );
}
