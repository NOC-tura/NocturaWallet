import {render, screen, fireEvent} from '@testing-library/react';
import {BuyForm, solToLamports} from '../BuyForm';

const h = vi.hoisted(() => ({buy: vi.fn(), balances: vi.fn(), wallet: vi.fn()}));
vi.mock('../useBuy', () => ({useBuy: h.buy}));
vi.mock('../../portfolio/useBalances', () => ({useBalances: h.balances}));
vi.mock('@solana/wallet-adapter-react', () => ({useWallet: h.wallet}));

const STAGE = {displayStage: 1, pricePerNocUsd: 0.1501};
const SOL_USD = 118.18;
/** The real figure from the connected wallet, so the numbers below are the numbers on screen. */
const BALANCE = 17_140_461_258n;

beforeEach(() => {
  h.buy.mockReset();
  h.balances.mockReset();
  h.wallet.mockReset();
  h.buy.mockReturnValue({submit: vi.fn(), state: 'idle', error: null, canBuy: true, blockedReason: null});
  h.balances.mockReturnValue({sol: BALANCE, noc: 0n, isError: false, isLoading: false});
  h.wallet.mockReturnValue({publicKey: {toBase58: () => 'KnZ5'}});
});

/** Render, then type an amount, the way a buyer reaches every state below. */
function renderWithAmount(amount: string, solUsd: number | null = SOL_USD) {
  const result = render(<BuyForm stage={STAGE} solUsd={solUsd} />);
  if (amount !== '') {
    fireEvent.change(screen.getByLabelText(/amount in sol/i), {target: {value: amount}});
  }
  return result;
}

describe('solToLamports', () => {
  it('parses without a float', () => {
    expect(solToLamports('1.5')).toBe(1_500_000_000n);
    expect(solToLamports('0.000000001')).toBe(1n);
    expect(solToLamports('2')).toBe(2_000_000_000n);
  });

  it('refuses junk and over-precision instead of silently truncating', () => {
    expect(() => solToLamports('abc')).toThrow();
    expect(() => solToLamports('')).toThrow();
    expect(() => solToLamports('1.0000000001')).toThrow(/9 decimal/);
  });
});

describe('the pre-signature summary', () => {
  it('shows what is being signed once there is an amount', () => {
    renderWithAmount('0.2');
    const summary = screen.getByRole('list', {name: /what you are signing/i});
    expect(summary.textContent).toMatch(/presale program 6nTTJwtDuxjv/);
    expect(summary.textContent).toMatch(/stage 1/i);
    expect(summary.textContent).toMatch(/0\.2 SOL/);
  });

  it('shows nothing over an empty field', () => {
    // It used to render "Paying 0 SOL (about $0.00) · Receiving 0.00 NOC" — a concrete,
    // false claim in the one place on this page the user is being trained to read.
    renderWithAmount('');
    expect(screen.queryByRole('list', {name: /what you are signing/i})).toBeNull();
  });

  it('shows nothing for a zero amount either', () => {
    renderWithAmount('0');
    expect(screen.queryByRole('list', {name: /what you are signing/i})).toBeNull();
  });
});

describe('the purchase limits', () => {
  it('states them before the attempt, not after a rejection', () => {
    renderWithAmount('');
    expect(screen.getByText(/minimum \$10/i)).toBeTruthy();
    expect(screen.getByText(/maximum \$50,000/i)).toBeTruthy();
  });

  it('refuses an amount below the on-chain minimum, with the reason', () => {
    // 0.04 SOL ≈ $4.73. The program would answer BelowMinimumPurchase after the user had
    // signed and paid a network fee; this page knows it for free.
    renderWithAmount('0.04');
    expect(screen.getByRole('status').textContent).toMatch(/minimum \$10/i);
    expect(screen.getByRole('button', {name: /buy noc/i}).hasAttribute('disabled')).toBe(true);
  });

  it('refuses an amount above the per-transaction maximum', () => {
    h.balances.mockReturnValue({sol: 1_000_000_000_000n, noc: 0n, isError: false, isLoading: false});
    renderWithAmount('500'); // ≈ $59,090
    expect(screen.getByRole('status').textContent).toMatch(/maximum \$50,000/i);
  });

  it('refuses more SOL than the wallet holds, counting the network fee', () => {
    // 17.14 SOL is on the page; 17.14 SOL is not spendable, because the fee comes out too.
    renderWithAmount('17.140461258');
    expect(screen.getByRole('status').textContent).toMatch(/insufficient sol/i);
  });

  it('allows an amount that clears every limit (positive control)', () => {
    renderWithAmount('0.2'); // ≈ $23.64, well inside the balance
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', {name: /buy noc/i}).hasAttribute('disabled')).toBe(false);
  });

  it('says nothing about an empty field — a blank input is not an error', () => {
    renderWithAmount('');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', {name: /buy noc/i}).hasAttribute('disabled')).toBe(true);
  });
});

describe('while the inputs the gate needs are still loading', () => {
  it('holds the button closed without complaining when the price is unknown', () => {
    renderWithAmount('0.2', null);
    expect(screen.getByRole('button', {name: /buy noc/i}).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('holds the button closed when the balance has not arrived', () => {
    // Guessing zero here would print "Insufficient SOL balance" at someone whose balance is
    // simply not loaded yet; guessing infinity would let a doomed purchase through.
    h.balances.mockReturnValue({sol: null, noc: null, isError: false, isLoading: true});
    renderWithAmount('0.2');
    expect(screen.getByRole('button', {name: /buy noc/i}).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('BuyForm', () => {
  it('renders the blocked reason instead of the form when the wallet cannot broadcast', () => {
    h.buy.mockReturnValue({
      submit: vi.fn(),
      state: 'idle',
      error: null,
      canBuy: false,
      blockedReason: 'This wallet cannot broadcast transactions here yet.',
    });
    render(<BuyForm stage={STAGE} solUsd={SOL_USD} />);
    expect(screen.getByRole('alert').textContent).toMatch(/cannot broadcast/i);
    expect(screen.queryByLabelText(/amount in sol/i)).toBeNull();
  });

  it('disables the button while a purchase is in flight', () => {
    h.buy.mockReturnValue({submit: vi.fn(), state: 'signing', error: null, canBuy: true, blockedReason: null});
    renderWithAmount('0.2');
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });
});
