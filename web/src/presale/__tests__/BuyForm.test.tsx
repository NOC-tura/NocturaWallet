import {render, screen} from '@testing-library/react';
import {BuyForm, solToLamports} from '../BuyForm';

const h = vi.hoisted(() => ({buy: vi.fn()}));
vi.mock('../useBuy', () => ({useBuy: h.buy}));

const STAGE = {displayStage: 1, pricePerNocUsd: 0.1501};

beforeEach(() => {
  h.buy.mockReset();
  h.buy.mockReturnValue({submit: vi.fn(), state: 'idle', error: null, canBuy: true, blockedReason: null});
});

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

describe('BuyForm', () => {
  it('shows what is being signed before any signature is requested', () => {
    render(<BuyForm stage={STAGE} solUsd={118.18} />);
    const summary = screen.getByRole('list', {name: /what you are signing/i});
    expect(summary.textContent).toMatch(/presale program 6nTTJwtDuxjv/);
    expect(summary.textContent).toMatch(/stage 1/i);
  });

  it('renders the blocked reason instead of the form when the wallet cannot broadcast', () => {
    h.buy.mockReturnValue({
      submit: vi.fn(),
      state: 'idle',
      error: null,
      canBuy: false,
      blockedReason: 'This wallet cannot broadcast transactions here yet.',
    });
    render(<BuyForm stage={STAGE} solUsd={118.18} />);
    expect(screen.getByRole('alert').textContent).toMatch(/cannot broadcast/i);
    expect(screen.queryByLabelText(/amount in sol/i)).toBeNull();
  });

  it('disables the button while a purchase is in flight', () => {
    h.buy.mockReturnValue({submit: vi.fn(), state: 'signing', error: null, canBuy: true, blockedReason: null});
    render(<BuyForm stage={STAGE} solUsd={118.18} />);
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });
});
