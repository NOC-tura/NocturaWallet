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
  chain = 'solana',
): PresalePurchase => ({
  signature,
  chain,
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
        ...purchase(
          '0xbc02c07f5d905184e09d3964085cab3840f205fcfa3401014a931d182490276c',
          67.186668887,
          16.54,
          'not_credited',
          'ethereum',
        ),
      },
    ];
    verdicts = {};
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).not.toMatch(/Not found on chain/);
    expect(container.textContent).not.toMatch(/no payment was taken/);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).toMatch(/ethereum · 0xbc02c07f5d…1d182490276c/);
    expect(container.textContent).toMatch(/not_credited/);
  });

  it('does not ask Solana about a hash that is not a Solana signature', () => {
    // The check above proves the sentence is absent; this proves the QUESTION is never
    // asked, so the answer cannot arrive later by another route.
    let asked: string[] | null = null;
    purchases = [
      purchase('0xbc02c07f5d905184e09d3964085cab3840f205fcfa3401014a931d182490276c', 1, 1, 'not_credited', 'ethereum'),
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

  it('prints money with both decimal places', () => {
    const {container} = render(<PurchaseHistory />);
    expect(container.textContent).toMatch(/\$10\.50/);
    expect(container.textContent).not.toMatch(/\$10\.5 /);
  });
});
