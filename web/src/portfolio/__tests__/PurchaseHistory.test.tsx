import {render, screen} from '@testing-library/react';
import {PurchaseHistory} from '../PurchaseHistory';
import type {PresalePurchase} from '../../../../core/presale/purchases';
import type {SignatureVerdict} from '../../../../core/presale/verifySignatures';

const REAL = '75fvgBVd7oRWLYxQ9CqXymWyqEHpCcN7f9qzYQm4nUJvZPPXnFN6SPHXJKFfmyBtBFaNR34qkfjLwCbG9HUVXG81';
const PHANTOM =
  '27BRB9fcLBHhdcwYZg3HaPjTvpZrnSULt5eRxZxs6QNQeUzNakgRGrk2h9j8sPgWn2cuMjiWvzUdzQmESVA9PtWv';

const ETH_HASH = '0xbc02c07f5d905184e09d3964085cab3840f205fcfa3401014a931d182490276c';

/*
 * Sample text, taken from the live API on 2026-09-22. It is a SAMPLE and not a pin: the
 * coordinator owns this prose and may reword it whenever it likes, and nothing here
 * should make it hesitate to. What these tests assert is that whatever the row carries is
 * rendered exactly — so this constant drifting out of date breaks nothing, and a comment
 * claiming it mirrors production would be false within a day.
 */
const NOT_CREDITED_REASON =
  'This payment is on the blockchain and can be verified, but no Solana allocation was ' +
  "ever created for it. It was a test purchase made from the project's own deployer " +
  'address while checking that a newly deployed contract accepted payments. Not crediting ' +
  'it was a deliberate decision at the September 2026 reconciliation, not a processing ' +
  'error and not a delay: no tokens are owed for this row and none are coming.';
const NOT_ON_CHAIN_REASON =
  'This submission never reached the blockchain. Our records created the row when it was ' +
  'sent, and the network has no transaction with this signature — checked by signature ' +
  'against the full history, and confirmed independently against the counter the presale ' +
  'program keeps for this wallet. No payment was taken for it and no tokens are owed. It ' +
  'was almost certainly a retry: the purchase that succeeded is listed separately.';

const purchase = (
  signature: string,
  nocAmount: number,
  usdValue: number,
  status = 'confirmed',
  chain = 'solana',
  statusReason = '',
): PresalePurchase => ({
  signature,
  chain,
  statusReason,
  paymentToken: 'SOL',
  paymentAmount: 0.2,
  nocAmount,
  usdValue,
  stage: 1,
  status,
  createdAt: '2026-04-12T06:26:20.541Z',
});

let purchases: PresalePurchase[] | null = [];
let verdicts: Record<string, SignatureVerdict> = {};

vi.mock('../usePurchases', () => ({
  usePurchases: () => ({purchases, isError: false, isLoading: false}),
}));
let askedSpy: ((signatures: string[]) => void) | null = null;
vi.mock('../useSignatureVerdicts', () => ({
  useSignatureVerdicts: (signatures: string[]) => {
    askedSpy?.(signatures);
    return verdicts;
  },
}));

beforeEach(() => {
  purchases = [purchase(REAL, 69.953364424, 10.5), purchase(PHANTOM, 109.763651379, 16.48)];
  verdicts = {};
});

describe('PurchaseHistory', () => {
  it('marks a row the chain does not have, and leaves the real one alone', () => {
    // The mainnet case: the coordinator recorded 27BRB… as `confirmed`, and
    // getSignatureStatuses with searchTransactionHistory has no record of it.
    verdicts = {[REAL]: 'confirmed', [PHANTOM]: 'missing'};
    render(<PurchaseHistory />);
    const notFound = screen.getAllByText(/Not found on chain/i);
    expect(notFound).toHaveLength(1);
    expect(notFound[0]?.textContent).toMatch(/no payment was taken and no tokens are owed/i);
  });

  it('says NOTHING when the verification itself could not run', () => {
    // THE test. `unknown` is our ignorance, not a fact about the purchase. Printing
    // "not found on chain" because our own RPC proxy was down would tell a buyer who
    // paid that they did not.
    verdicts = {[REAL]: 'unknown', [PHANTOM]: 'unknown'};
    render(<PurchaseHistory />);
    expect(screen.queryByText(/Not found on chain/i)).toBeNull();
    expect(screen.queryByText(/failed/i)).toBeNull();
  });

  it('says nothing before the verdicts arrive', () => {
    verdicts = {};
    render(<PurchaseHistory />);
    expect(screen.queryByText(/Not found on chain/i)).toBeNull();
  });

  it('marks a transaction that landed and failed as a different thing entirely', () => {
    verdicts = {[REAL]: 'failed', [PHANTOM]: 'confirmed'};
    render(<PurchaseHistory />);
    expect(screen.getByText(/on chain but failed/i)).toBeTruthy();
    expect(screen.queryByText(/Not found on chain/i)).toBeNull();
  });

  it('still links every signature to the explorer, including an unverified one', () => {
    // The link stays on a missing row on purpose: the explorer then says "not found"
    // too, from a source we do not control. That corroborates the claim instead of
    // asking the reader to take our word for it.
    verdicts = {[REAL]: 'confirmed', [PHANTOM]: 'missing'};
    render(<PurchaseHistory />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links.map(a => a.getAttribute('href'))).toEqual([
      `https://explorer.solana.com/tx/${REAL}`,
      `https://explorer.solana.com/tx/${PHANTOM}`,
    ]);
  });

  it('does not print the coordinator\'s token AND our sentence for the same fact', () => {
    // Since 2026-09-22 the coordinator marks these rows `not_on_chain` itself. Both
    // statements are true; showing both is one of them in snake_case.
    purchases = [purchase(PHANTOM, 109.763651379, 16.48, 'not_on_chain')];
    verdicts = {[PHANTOM]: 'missing'};
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toMatch(/Not found on chain/);
    expect(container.textContent).not.toMatch(/not_on_chain/);
  });

  it('still shows the coordinator\'s word when the chain has not answered', () => {
    // The control on the test above. `unknown` is our ignorance, and suppressing the
    // backend's own statement because of it would hide the only thing anyone knows.
    purchases = [purchase(PHANTOM, 109.763651379, 16.48, 'not_on_chain')];
    verdicts = {[PHANTOM]: 'unknown'};
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toMatch(/not_on_chain/);
    expect(container.textContent).not.toMatch(/Not found on chain/);
  });

  it('says once why the rows will never sum to the allocation exactly', () => {
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toMatch(/differ by a fraction of a percent/);
    expect(container.textContent).toMatch(/The chain is what pays out/);
  });

  it('says it only when there are rows to be confused by', () => {
    purchases = [];
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).not.toMatch(/fraction of a percent/);
  });

  it('never tells a cross-chain buyer that no payment was taken', () => {
    // The row the coordinator holds for the deployer's own Ethereum test purchases:
    // status not_credited, a 0x hash, real money moved on Ethereum, no Solana allocation.
    // Put through the Solana check its hash is not a signature, the verdict is `missing`,
    // and the sentence that follows would be false in the most damaging direction there
    // is. /user/<solana address> does not return these today; surfacing them by
    // buyer_solana_address is the obvious next improvement, and this is what must hold
    // when it lands.
    purchases = [
      {
        ...purchase(ETH_HASH, 67.186668887, 16.54, 'not_credited', 'ethereum', NOT_CREDITED_REASON),
      },
    ];
    verdicts = {};
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).not.toMatch(/Not found on chain/);
    expect(container.textContent).not.toMatch(/no payment was taken/);
    expect(container.textContent).toMatch(/ethereum · 0xbc02c07f5d…1d182490276c/);
    // The link exists, and it points at the ledger that can answer for this hash.
    expect(screen.getByRole('link').getAttribute('href')).not.toMatch(/explorer\.solana\.com/);
  });

  it('does not ask Solana about a hash that is not a Solana signature', () => {
    // The check above proves the sentence is absent; this proves the QUESTION is never
    // asked, so the answer cannot arrive later by another route.
    let asked: string[] | null = null;
    purchases = [
      purchase(ETH_HASH, 1, 1, 'not_credited', 'ethereum', NOT_CREDITED_REASON),
      purchase(REAL, 2, 2),
    ];
    askedSpy = s => {
      asked = s;
    };
    render(<PurchaseHistory />);
    expect(asked).toEqual([REAL]);
    askedSpy = null;
  });

  it('treats an unrecorded chain as not-Solana, because saying less is the safe failure', () => {
    purchases = [purchase(REAL, 1, 1, 'confirmed', '')];
    verdicts = {[REAL]: 'missing'};
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).not.toMatch(/Not found on chain/);
  });

  it("renders the row's own sentence verbatim, not the raw token", () => {
    // The string the coordinator actually stores, read from the live API 2026-09-22.
    purchases = [
      purchase(ETH_HASH, 67.18, 16.54, 'not_credited', 'ethereum', NOT_CREDITED_REASON),
    ];
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toContain(NOT_CREDITED_REASON);
    expect(container.textContent).not.toMatch(/not_credited/);
  });

  it('falls back to the raw token when the row carries no sentence', () => {
    // The control. The coordinator refuses to write these statuses without a reason, but
    // a guarantee on the writing side is not a guarantee about what arrives over a
    // network — and inventing the missing sentence here is the one thing not to do.
    purchases = [purchase(ETH_HASH, 67.18, 16.54, 'not_credited', 'ethereum', '')];
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toMatch(/not_credited/);
  });

  it("does not let a reason on a still-confirmed row silence our own reading", () => {
    // Both halves of `acknowledged` matter. A note on a row the coordinator still calls
    // confirmed is not an admission, and the chain check is then the only source there is.
    purchases = [purchase(PHANTOM, 109.76, 16.48, 'confirmed', 'solana', 'a note about something else')];
    verdicts = {[PHANTOM]: 'missing'};
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toMatch(/Not found on chain/);
  });

  it('shows the row\'s sentence instead of ours once the coordinator has admitted it', () => {
    purchases = [purchase(PHANTOM, 109.76, 16.48, 'not_on_chain', 'solana', NOT_ON_CHAIN_REASON)];
    verdicts = {[PHANTOM]: 'missing'};
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toContain(NOT_ON_CHAIN_REASON);
    expect(container.textContent).not.toMatch(/Not found on chain\. The backend recorded/);
  });

  it('renders the stored sentence exactly, adding and removing nothing', () => {
    // This replaces a control that scanned the copy for forbidden phrases. It fired on
    // "no tokens are owed" — the sentence denying the very thing it was hunting for — and
    // that was the tell: a word-level control over prose we do not own either forces the
    // author to write around our regex or rots the moment they reword it. The invariant
    // that is actually ours is that we render their sentence and add nothing to it.
    purchases = [purchase(ETH_HASH, 67.18, 16.54, 'not_credited', 'ethereum', NOT_CREDITED_REASON)];
    render(<PurchaseHistory />);
    expect(screen.getByText(NOT_CREDITED_REASON).textContent).toBe(NOT_CREDITED_REASON);
  });

  it('links an Ethereum hash to Etherscan, never to a Solana explorer', () => {
    const hash = ETH_HASH;
    purchases = [purchase(hash, 67.18, 16.54, 'not_credited', 'ethereum', NOT_CREDITED_REASON)];
    render(<PurchaseHistory />);
    expect(screen.getByRole('link').getAttribute('href')).toBe(`https://etherscan.io/tx/${hash}`);
    expect(screen.getByRole('link').textContent).toMatch(/^ethereum · /);
  });

  it('gives an unrecognised chain no link at all, rather than a guess', () => {
    purchases = [purchase(REAL, 1, 1, 'confirmed', 'someotherchain')];
    const {container} = render(<PurchaseHistory />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).toMatch(/someotherchain · /);
  });

  it('strikes the amount of a row the chain says moved nothing', () => {
    // The headline figure is what a reader adds up. A row that took no payment and owes
    // no tokens must not read like one that did, whatever the sentence under it says.
    verdicts = {[REAL]: 'confirmed', [PHANTOM]: 'missing'};
    render(<PurchaseHistory />);
    expect(screen.getByTestId(`amount-${PHANTOM}`).closest('s')).not.toBeNull();
    expect(screen.getByTestId(`amount-${REAL}`).closest('s')).toBeNull();
  });

  it('strikes a failed transaction too', () => {
    verdicts = {[REAL]: 'failed', [PHANTOM]: 'confirmed'};
    render(<PurchaseHistory />);
    expect(screen.getByTestId(`amount-${REAL}`).closest('s')).not.toBeNull();
    expect(screen.getByTestId(`amount-${PHANTOM}`).closest('s')).toBeNull();
  });

  it('strikes nothing the chain has not answered for', () => {
    // `unknown` is our failure to ask, not the chain's answer; and the coordinator's word
    // alone is rendered, never acted on.
    purchases = [purchase(PHANTOM, 109.76, 16.48, 'not_on_chain', 'solana', NOT_ON_CHAIN_REASON)];
    verdicts = {[PHANTOM]: 'unknown'};
    render(<PurchaseHistory />);
    expect(screen.getByTestId(`amount-${PHANTOM}`).closest('s')).toBeNull();
  });

  it('treats completed as confirmed: no token, no warning', () => {
    // The EVM path's success status (coordinator.js:722). It means what confirmed means,
    // and printing it in amber would tell a buyer something went wrong when nothing did.
    purchases = [purchase(REAL, 69.95, 10.5, 'completed')];
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).not.toMatch(/completed/);
    expect(container.querySelector('.noc-warning')).toBeNull();
  });

  it('does not render a stale sentence on a row that is now confirmed', () => {
    // POST /admin/retry used to send a row back through processing while keeping its old
    // reason, so a not_on_chain row the sweep later confirmed would carry "no tokens are
    // owed" under a real purchase. Fixed on the coordinator; this is the page not relying
    // on it. A confirmed row needs no excuse, so a sentence on one is dropped.
    for (const status of ['confirmed', 'completed']) {
      purchases = [purchase(REAL, 69.95, 10.5, status, 'solana', NOT_ON_CHAIN_REASON)];
      verdicts = {[REAL]: 'confirmed'};
      const {container, unmount} = render(<PurchaseHistory />);
      expect(container.textContent).not.toContain(NOT_ON_CHAIN_REASON);
      unmount();
    }
  });

  it('still shows the sentence while the row is not confirmed', () => {
    // Control for the test above: dropping every reason would pass it too.
    purchases = [purchase(REAL, 69.95, 10.5, 'failed', 'solana', NOT_ON_CHAIN_REASON)];
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toContain(NOT_ON_CHAIN_REASON);
  });

  it('renders the purchases as one list card, not a card per row', () => {
    // The redesign's density fix: five cards stacked took twice the height of one list.
    const {container} = render(<PurchaseHistory />);
    expect(container.querySelectorAll('ol.buys.noc-card').length).toBe(1);
    expect(container.querySelectorAll('li.buy-row.noc-card-quiet').length).toBe(0);
  });

  it('marks a row by what the chain said: missing is unconfirmed, failed is failed', () => {
    verdicts = {[REAL]: 'failed', [PHANTOM]: 'missing'};
    const {container} = render(<PurchaseHistory />);
    const row = (sig: string) =>
      container.querySelector(`[data-testid="amount-${sig}"]`)?.closest('.buy-row');
    expect(row(PHANTOM)?.classList.contains('is-unconfirmed')).toBe(true);
    expect(row(REAL)?.classList.contains('is-failed')).toBe(true);
    expect(row(REAL)?.classList.contains('is-unconfirmed')).toBe(false);
  });

  it('marks nothing on a row the chain confirmed, or could not be asked about', () => {
    verdicts = {[REAL]: 'confirmed', [PHANTOM]: 'unknown'};
    const {container} = render(<PurchaseHistory />);
    expect(container.querySelector('.buy-row.is-unconfirmed, .buy-row.is-failed')).toBeNull();
  });

  it('says there are no purchases in a card with its icon', () => {
    purchases = [];
    const {container} = render(<PurchaseHistory />);
    const empty = container.querySelector('.empty');
    expect(empty?.textContent).toBe('No purchases recorded for this wallet yet.');
    expect(empty?.querySelector('svg')).not.toBeNull();
  });

  it('prints money with both decimal places', () => {
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toMatch(/\$10\.50/);
    expect(container.textContent).not.toMatch(/\$10\.5 /);
  });
});
