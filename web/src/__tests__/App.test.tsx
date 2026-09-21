import {render, screen} from '@testing-library/react';
import {App} from '../App';

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
  expect(screen.getByText(/reading the tge date/i)).toBeTruthy();
});

it('opens with the connect panel in its searching state, never its empty-handed one', () => {
  render(<App />);
  expect(screen.getByRole('heading', {name: /looking for a wallet/i})).toBeTruthy();
});
