import {render, screen, fireEvent} from '@testing-library/react';
import {BuyForm, solToLamports, parseAmount, busyLabel} from '../BuyForm';
import {MAINNET_PROGRAM_ID, MAINNET_SOL_TREASURY} from '../../../../core/presale/addresses';

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
  h.balances.mockReturnValue({sol: BALANCE, noc: 0n, usdc: 25_000_000n, usdt: 0n, isError: false, isLoading: false});
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
    // Terse, because it sits in a meta row — the register the mockups use for the line
    // under a figure. The property is that the limits are stated BEFORE the attempt, not
    // the particular wording.
    const {container} = render(<BuyForm stage={STAGE} solUsd={SOL_USD} />);
    expect(container.textContent).toMatch(/Min \$10/);
    expect(container.textContent).toMatch(/max \$50,000/);
  });

  it('refuses an amount below the on-chain minimum, with the reason', () => {
    // 0.04 SOL ≈ $4.73. The program would answer BelowMinimumPurchase after the user had
    // signed and paid a network fee; this page knows it for free.
    renderWithAmount('0.04');
    expect(screen.getByRole('status').textContent).toMatch(/minimum \$10/i);
    expect(screen.getByRole('button', {name: /buy noc/i}).hasAttribute('disabled')).toBe(true);
  });

  it('refuses an amount above the per-transaction maximum', () => {
    h.balances.mockReturnValue({sol: 1_000_000_000_000n, noc: 0n, usdc: 25_000_000n, usdt: 0n, isError: false, isLoading: false});
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
    h.balances.mockReturnValue({sol: null, noc: null, usdc: 25_000_000n, usdt: 0n, isError: false, isLoading: true});
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


describe('paying with a stablecoin', () => {
  function pick(token: 'SOL' | 'USDC' | 'USDT') {
    fireEvent.click(screen.getByLabelText(token));
  }

  it('parses 6 decimals for USDC, not SOL\'s 9', () => {
    // The thousand-fold trap: one shared decimals constant would turn a $10 purchase
    // into a $10,000 one, or refuse it as dust, depending on which way the constant went.
    expect(parseAmount('10.5', 6)).toBe(10_500_000n);
    expect(parseAmount('10.5', 9)).toBe(10_500_000_000n);
    expect(() => parseAmount('1.0000001', 6)).toThrow(/6 decimal/);
  });

  it('switches the label and clears the amount, so no figure is reinterpreted', () => {
    // "10" is ten dollars in USDC and roughly $1,180 in SOL. Carrying it across would
    // rewrite the summary under the reader without the field appearing to change.
    renderWithAmount('0.2');
    pick('USDC');
    expect(screen.getByLabelText(/amount in usdc/i)).toBeTruthy();
    expect((screen.getByLabelText(/amount in usdc/i) as HTMLInputElement).value).toBe('');
  });

  it('values a stablecoin at its own number, not at the SOL price', () => {
    renderWithAmount('');
    pick('USDC');
    fireEvent.change(screen.getByLabelText(/amount in usdc/i), {target: {value: '10.5'}});
    const summary = screen.getByRole('list', {name: /what you are signing/i});
    expect(summary.textContent).toMatch(/Paying 10\.5 USDC \(about \$10\.50\)/);
  });

  it('gates on the USDC balance, not the SOL one', () => {
    // 25 USDC held, 30 requested: refused for the right reason while 17 SOL sits there.
    renderWithAmount('');
    pick('USDC');
    fireEvent.change(screen.getByLabelText(/amount in usdc/i), {target: {value: '30'}});
    expect(screen.getByRole('status').textContent).toMatch(/insufficient usdc/i);
  });

  it('refuses USDT when none is held, while USDC of the same size passes', () => {
    // The control the previous case needs: without it, "insufficient" could come from
    // any balance at all and the test would not know which one was consulted.
    renderWithAmount('');
    pick('USDT');
    fireEvent.change(screen.getByLabelText(/amount in usdt/i), {target: {value: '20'}});
    expect(screen.getByRole('status').textContent).toMatch(/insufficient usdt/i);
    pick('USDC');
    fireEvent.change(screen.getByLabelText(/amount in usdc/i), {target: {value: '20'}});
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('the redesigned buy form', () => {
  it.each([
    ['checking', 'Checking…'],
    ['simulating', 'Checking…'],
    ['signing', 'Waiting for wallet signature'],
    ['confirming', 'Confirming on chain…'],
  ] as const)('names the step: %s', (state, label) => {
    expect(busyLabel(state)).toBe(label);
  });

  it('shows the step on the button while it is in flight', () => {
    h.buy.mockReturnValue({submit: vi.fn(), state: 'signing', error: null, canBuy: true, blockedReason: null});
    renderWithAmount('0.2');
    const button = screen.getByRole('button');
    expect(button.textContent).toBe('Waiting for wallet signature');
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('shows both addresses in full, grouped, from the constants — and emphasises neither', () => {
    renderWithAmount('0.2');
    const summary = screen.getByRole('list', {name: /what you are signing/i});
    const groups = Array.from(summary.querySelectorAll('.addr-groups'));
    expect(groups.map(g => g.textContent)).toEqual([MAINNET_PROGRAM_ID, MAINNET_SOL_TREASURY]);
    expect(summary.querySelectorAll('.addr-groups b, .addr-groups strong').length).toBe(0);
    // The amounts are bold; that is where emphasis belongs.
    expect(summary.querySelector('b')?.textContent).toBe('0.2 SOL');
  });

  it('puts no inline style anywhere in the form', () => {
    const {container} = renderWithAmount('0.2');
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('shows an error after signing as an alert with its icon', () => {
    h.buy.mockReturnValue({
      submit: vi.fn(),
      state: 'error',
      error: 'The transaction expired before it confirmed.',
      canBuy: true,
      blockedReason: null,
    });
    renderWithAmount('0.2');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('The transaction expired before it confirmed.');
    expect(alert.classList.contains('tx-error')).toBe(true);
    expect(alert.querySelector('svg')).not.toBeNull();
  });

  it('asks for a wallet in its own card, with the lock', () => {
    h.buy.mockReturnValue({submit: vi.fn(), state: 'idle', error: null, canBuy: false, blockedReason: null});
    const {container} = render(<BuyForm stage={STAGE} solUsd={SOL_USD} />);
    const card = container.querySelector('.connect-to-buy');
    expect(card?.textContent).toBe('Connect a wallet to buy.');
    expect(card?.querySelector('svg')).not.toBeNull();
  });
});
