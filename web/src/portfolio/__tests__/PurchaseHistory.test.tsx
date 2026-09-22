import {render, screen} from '@testing-library/react';
import {PurchaseHistory} from '../PurchaseHistory';
import type {PresalePurchase} from '../../../../core/presale/purchases';
import type {SignatureVerdict} from '../../../../core/presale/verifySignatures';

const REAL = '75fvgBVd7oRWLYxQ9CqXymWyqEHpCcN7f9qzYQm4nUJvZPPXnFN6SPHXJKFfmyBtBFaNR34qkfjLwCbG9HUVXG81';
const PHANTOM =
  '27BRB9fcLBHhdcwYZg3HaPjTvpZrnSULt5eRxZxs6QNQeUzNakgRGrk2h9j8sPgWn2cuMjiWvzUdzQmESVA9PtWv';

const purchase = (
  signature: string,
  nocAmount: number,
  usdValue: number,
  status = 'confirmed',
): PresalePurchase => ({
  signature,
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
vi.mock('../useSignatureVerdicts', () => ({
  useSignatureVerdicts: () => verdicts,
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

  it('prints money with both decimal places', () => {
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toMatch(/\$10\.50/);
    expect(container.textContent).not.toMatch(/\$10\.5 /);
  });
});
