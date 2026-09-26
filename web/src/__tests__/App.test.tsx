import {render, screen} from '@testing-library/react';
import {App} from '../App';

// A connected referrer, so the referral panel renders and its column can be checked.
// Nothing else in this file looks at referral, so the mock changes no other claim.
vi.mock('../referral/useReferral', () => ({
  useReferral: () => ({
    address: '2ixJm1hh6Ff8KuUCoaAe1myqKAT2PimVJ3B6ubuYQMr9',
    data: {
      totalReferrals: 1,
      totalBaseBonusNoc: 16.14,
      totalExtraBonusNoc: 0,
      totalBonusNoc: 16.14,
      totalReferredNoc: 436.44,
      totalReferredUsd: 65.51,
      tierBonusCount: 0,
    },
    isPending: false,
    isError: false,
  }),
}));

// The App mounts real queries, which reach for the dev proxy and print ECONNREFUSED after
// the run finishes — noise that trains everyone to ignore the tail of the log, which is
// where a real failure would also appear.
//
// This silences the coordinator calls (they use the global fetch) but NOT the RPC ones:
// @solana/web3.js carries its own fetch implementation, so stubbing the global does not
// reach it. Two errors still print. Said plainly rather than left looking solved.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('network disabled in tests');
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('renders the product name', () => {
  render(<App />);
  expect(screen.getByRole('heading', {name: /noctura/i})).toBeTruthy();
});

it('says what the page is before asking for anything', () => {
  // A visitor arriving at a host called "wallet" and meeting a bare Connect button has to
  // guess. The page states that it is presale and portfolio, and that it does not want
  // custody of anything.
  render(<App />);
  expect(screen.getByText(/presale and portfolio/i)).toBeTruthy();
  expect(screen.getByText(/your wallet stays where it is/i)).toBeTruthy();
});

it('starts reading the presale without waiting for a wallet', () => {
  // Nothing about the stage, the price or the countdown is gated behind connecting — the
  // panels are already fetching on first paint. The connect request is for YOUR allocation,
  // not for the page to function at all.
  render(<App />);
  expect(screen.getByText(/loading the presale/i)).toBeTruthy();
});

it('publishes nothing about the TGE date', () => {
  // The owner's decision (2026-09-26): the page does not announce a TGE date or count down
  // to one. The value exists on chain; this page does not advertise it.
  const {container} = render(<App />);
  expect(container.textContent).not.toMatch(/TGE|token generation/i);
});

it('opens with the connect panel in its searching state, never its empty-handed one', () => {
  render(<App />);
  expect(screen.getByRole('heading', {name: /looking for a wallet/i})).toBeTruthy();
});

it('puts referral in the main column, under the buy form', () => {
  // The desktop redesign's balance fix: the side column carried wallet, balances, chart,
  // purchases, TGE AND referral, and ran twice the length of the main one.
  const {container} = render(<App />);
  const link = screen.getByTestId('referral-link');
  expect(link.closest('.col-main')).not.toBeNull();
  expect(container.querySelector('.col-side [data-testid="referral-link"]')).toBeNull();
});
