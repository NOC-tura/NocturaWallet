import {render, screen} from '@testing-library/react';
import {PublicKey} from '@solana/web3.js';
import {PortfolioPanel} from '../PortfolioPanel';
import {periodChangePct} from '../periodChange';

const USER = new PublicKey('2ixJm1hh6Ff8KuUCoaAe1myqKAT2PimVJ3B6ubuYQMr9');

let points: number[] | null = null;

vi.mock('@solana/wallet-adapter-react', () => ({useWallet: () => ({publicKey: USER})}));
vi.mock('../useBalances', () => ({
  useBalances: () => ({sol: 0n, noc: 0n, usdc: 0n, usdt: 0n, isError: false, isLoading: false}),
}));
vi.mock('../usePrices', () => ({
  usePrices: () => ({prices: {solana: 112.99}, isError: false, isLoading: false}),
}));
vi.mock('../useChart', () => ({
  useChart: () => ({points, isError: false, isLoading: false}),
}));

describe('periodChangePct', () => {
  it('is the move from the first point to the last', () => {
    expect(periodChangePct([100, 90, 120, 110])).toBeCloseTo(10, 10);
    expect(periodChangePct([200, 150])).toBeCloseTo(-25, 10);
  });

  it('has no answer without two points or with a zero start', () => {
    expect(periodChangePct([])).toBeNull();
    expect(periodChangePct([5])).toBeNull();
    expect(periodChangePct([0, 5])).toBeNull();
  });
});

describe('PortfolioPanel SOL row', () => {
  it('prints the move over the same seven days the label and the line show', () => {
    // 7 days: 120 → 112.99 is −5.84 %. A 24 h figure beside a "7 days" label was the
    // defect: the page claimed a week's move and printed a day's.
    points = [120, 118, 115, 112.99];
    render(<PortfolioPanel stagePriceUsd={0.1501} />);
    expect(screen.getByText('SOL · 7 days')).toBeTruthy();
    expect(screen.getByText('-5.84%')).toBeTruthy();
  });

  it('signs a rise explicitly', () => {
    points = [100, 112.99];
    render(<PortfolioPanel stagePriceUsd={0.1501} />);
    expect(screen.getByText('+12.99%')).toBeTruthy();
  });
});
