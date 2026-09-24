import {usePurchases} from './usePurchases';
import {useSignatureVerdicts} from './useSignatureVerdicts';
import {Icon} from '../ui/Icon';

/**
 * One explorer per chain. A hash is only checkable on the ledger it belongs to, and a
 * row whose chain we do not recognise gets no link at all rather than a guess.
 */
const EXPLORERS: Record<string, string> = {
  solana: 'https://explorer.solana.com/tx/',
  ethereum: 'https://etherscan.io/tx/',
  bnb: 'https://bscscan.com/tx/',
};


/** The chain gave a verdict about the transaction itself, rather than about our ability to ask. */
const chainSpoke = (v: string | undefined) => v === 'missing' || v === 'failed';

/**
 * The coordinator's two words for success. `completed` is what the EVM path writes once
 * an Ethereum or BNB purchase lands on Solana (coordinator.js:722) and means exactly what
 * `confirmed` means; printing it as a raw token in amber would tell a buyer something went
 * wrong when nothing did. `/user/:address` returns it only for 0x… buyers today, and the
 * coordinator asked for it to be treated as success regardless.
 */
const settled = (status: string) => status === 'confirmed' || status === 'completed';

/**
 * The coordinator has admitted the problem in the status AND said what it was.
 *
 * Both halves matter. A reason without a non-confirmed status is a note, not an
 * admission, and must not silence what we read from the chain ourselves.
 */
const acknowledged = (p: {status: string; statusReason: string}) =>
  !settled(p.status) && p.statusReason !== '';

/** The verdict for a row, or nothing at all when Solana cannot have an opinion about it. */
const verdictFor = (
  verdicts: Record<string, string>,
  p: {signature: string; chain: string},
): string | undefined => (isSolanaRow(p.chain) ? verdicts[p.signature] : undefined);

/**
 * Only a Solana hash may be asked about on Solana, and only a Solana hash may be linked
 * to a Solana explorer.
 *
 * An Ethereum hash put through getSignatureStatuses comes back unknown — correctly, it is
 * not a Solana signature — and this page renders that as "Not found on chain… no payment
 * was taken and no tokens are owed", which over a real 0.009 ETH purchase is false in the
 * most damaging direction available. Measured 2026-09-22: /user/<solana address> returns
 * only that address's own Solana rows, so no such row reaches this page today; the
 * coordinator holds cross-chain rows keyed by `buyer_solana_address`, and the natural
 * improvement of surfacing them here is what would make it live.
 */
const isSolanaRow = (chain: string) => chain === 'solana';

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
  const verdicts = useSignatureVerdicts(
    (purchases ?? []).filter(p => isSolanaRow(p.chain)).map(p => p.signature),
  );
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
          {purchases.map(p => {
            /*
              Struck when the chain itself says the transaction moved nothing. The headline
              figure is what a reader adds up, and a row that took no payment and owes no
              tokens read exactly like one that did — only the sentence under it said
              otherwise. Only the chain's answer strikes it: `unknown` is our failure to
              ask, and the coordinator's word is rendered, never acted on.
            */
            const moved = !chainSpoke(verdictFor(verdicts, p));
            const amount = (
              <span data-testid={`amount-${p.signature}`}>
                {num(p.nocAmount)} <span className="noc-ticker">NOC</span>
              </span>
            );
            return (
            <li key={p.signature} className="noc-card-quiet buy-row">
              <div className="noc-meta">
                <span className={moved ? 'noc-body noc-numeral' : 'noc-body noc-numeral noc-dim'}>
                  {moved ? amount : <s>{amount}</s>}
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
                {!settled(p.status) &&
                !chainSpoke(verdictFor(verdicts, p)) &&
                p.statusReason === '' ? (
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
              {/*
                The coordinator's own sentence for its own word, rendered verbatim and
                never translated. One statement per fact: it replaces the raw token rather
                than accompanying it, and it replaces OUR derived paragraph below — but
                only when the coordinator has acknowledged the problem in its status. A
                reason sitting on a row still marked `confirmed` is not an acknowledgement,
                and our own reading of the chain has to survive it.

                Not rendered at all on a settled row. A reason belongs to the status that
                set it, and a success needs no excuse. Until the coordinator fixed it,
                POST /admin/retry sent a row back to `pending` keeping its old reason, so
                a not_on_chain row the sweep later confirmed would have carried "no tokens
                are owed" under a real purchase. Losing a note is the cheap failure; that
                sentence under a purchase that did land is the expensive one.
              */}
              {p.statusReason !== '' && !settled(p.status) ? (
                <p className="noc-caption noc-warning">{p.statusReason}</p>
              ) : null}

              {!acknowledged(p) && verdictFor(verdicts, p) === 'missing' ? (
                <p className="noc-caption noc-danger">
                  Not found on chain. The backend recorded this purchase, but the Solana
                  ledger has no transaction with this signature — so no payment was taken
                  and no tokens are owed for it. Your allocation above is read from the
                  chain and is unaffected.
                </p>
              ) : null}
              {!acknowledged(p) && verdictFor(verdicts, p) === 'failed' ? (
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

                Solana rows only. An Ethereum hash under explorer.solana.com/tx/ is a link
                to a page that cannot exist, offered as proof. Those are rendered as text
                with their chain named, which is checkable without this page asserting
                anything about a ledger it did not read.
              */}
              {EXPLORERS[p.chain] !== undefined ? (
                <a
                  className="noc-caption noc-mono sig"
                  href={`${EXPLORERS[p.chain] as string}${p.signature}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={p.signature}
                >
                  {p.chain !== 'solana' ? `${p.chain} · ` : ''}
                  {p.signature.slice(0, 12)}…{p.signature.slice(-12)}
                </a>
              ) : (
                <span className="noc-caption noc-mono sig" title={p.signature}>
                  {p.chain || 'other chain'} · {p.signature.slice(0, 12)}…
                  {p.signature.slice(-12)}
                </span>
              )}

            </li>
            );
          })}
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
