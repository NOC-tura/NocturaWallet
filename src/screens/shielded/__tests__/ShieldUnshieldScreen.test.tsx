/**
 * #16 shield side on the A0 pool: the amount (BigInt, from the main account's balance of the pool's
 * mint), the fee rows the design shows (with the ZK proof row) as what an A0 deposit costs, the
 * gating on the A0 startup step (the CTA only when the restore finished; every other state is a
 * state with a way out — Retry — never a spinner forever), and the hidden unshield side.
 */
import React from 'react';
import {render, fireEvent, act, waitFor} from '@testing-library/react-native';
import {ShieldUnshieldScreen} from '../ShieldUnshieldScreen';
import type {A0ShieldedView} from '../../../hooks/useA0Shielded';
import {A0} from '../../../modules/shielded/a0/constants';

let mockView: A0ShieldedView = {kind: 'ready', unspent: 500_000_000n, pending: 0n, notes: 1};
const mockRetry = jest.fn();
const mockCheck = {disabled: false, checking: false, note: null as string | null, run: jest.fn()};
jest.mock('../../../hooks/useA0Shielded', () => ({
  useA0Shielded: () => ({view: mockView, refresh: jest.fn(), checkAgain: mockCheck}),
  retryA0Startup: () => mockRetry(),
}));

let mockBalances: {tokenBalances: Record<string, string>; solBalance: string} = {
  tokenBalances: {},
  solBalance: '1000000000',
};
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: () => mockBalances,
}));

const mockPoolCount = jest.fn();
jest.mock('../../../modules/shielded/a0/poolSize', () => ({
  readA0PoolNoteCount: () => mockPoolCount(),
}));
jest.mock('../../../modules/solana/connection', () => ({getConnection: () => ({})}));

const onShield = jest.fn();
const onBack = jest.fn();
let clock = 1_000_000;

beforeEach(() => {
  mockView = {kind: 'ready', unspent: 500_000_000n, pending: 0n, notes: 1};
  mockBalances = {tokenBalances: {[A0.mint]: '2000000000'}, solBalance: '1000000000'}; // 2 TEST, 1 SOL
  mockPoolCount.mockResolvedValue({status: 'ok', count: 17});
  mockRetry.mockReset();
  Object.assign(mockCheck, {disabled: false, checking: false, note: null});
  mockCheck.run.mockReset();
  onShield.mockReset();
  clock += 10_000; // past the CTA's 500 ms debounce between tests
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const screen = () => render(<ShieldUnshieldScreen onBack={onBack} onShield={onShield} />);
const ctaDisabled = (r: ReturnType<typeof screen>) => r.getByTestId('shield-cta').props.accessibilityState?.disabled;

describe('#16 shield side — the design', () => {
  it('idle: title, the one "Make private" tab, Available from the pool mint, MAX, the fee rows with the ZK proof row, the disabled CTA', async () => {
    const r = screen();
    await waitFor(() => expect(mockPoolCount).toHaveBeenCalled());
    expect(r.getByText('Shield / Unshield')).toBeTruthy();
    expect(r.getByText('Make private')).toBeTruthy();
    expect(r.getByText('2 TEST')).toBeTruthy(); // Available
    expect(r.getByLabelText('Max')).toBeTruthy();
    expect(r.getByText('Network fee')).toBeTruthy();
    expect(r.getByText('ZK proof fee')).toBeTruthy();
    expect(r.getByText('Deposit record rent')).toBeTruthy();
    expect(r.getByText("You'll shield")).toBeTruthy();
    expect(ctaDisabled(r)).toBe(true);
    expect(r.getByText('Shield TEST')).toBeTruthy();
  });

  it('amount entered: the fees are the A0 deposit costs (SOL), "You\'ll shield" is the exact amount, the pool count is the chain number + 1', async () => {
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1.25');
    await waitFor(() => expect(r.getByTestId('pool-notes')).toBeTruthy());
    expect(r.getByText('0.000005 SOL')).toBeTruthy();
    expect(r.getByText('None · made on this device')).toBeTruthy();
    expect(r.getByText('≈ 0.00069596 SOL')).toBeTruthy();
    expect(r.getByTestId('shield-net').props.children).toBe('1.25 TEST');
    expect(r.getByTestId('pool-notes').props.children).toBe('18');
    expect(r.getByText('Shield 1.25 TEST')).toBeTruthy();
    expect(r.queryByText(/USD/)).toBeNull(); // no price exists for the devnet test token
  });

  it('CTA → onShield with the amount in BASE UNITS (BigInt-exact, 9 decimals)', () => {
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1.000000001');
    fireEvent.press(r.getByTestId('shield-cta'));
    expect(onShield).toHaveBeenCalledWith('1000000001');
  });

  it('MAX fills the exact available balance (no fee subtracted: the fees are SOL)', () => {
    mockBalances = {tokenBalances: {[A0.mint]: '1234567891'}, solBalance: '1000000000'};
    const r = screen();
    fireEvent.press(r.getByLabelText('Max'));
    fireEvent.press(r.getByTestId('shield-cta'));
    expect(onShield).toHaveBeenCalledWith('1234567891');
  });

  it('insufficient: red helper with the max, CTA disabled', () => {
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '2.000000001');
    expect(r.getByText('Insufficient balance · max 2 TEST')).toBeTruthy();
    expect(ctaDisabled(r)).toBe(true);
    fireEvent.press(r.getByTestId('shield-cta'));
    expect(onShield).not.toHaveBeenCalled();
  });

  it('exactly the available balance is allowed (boundary)', () => {
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '2');
    expect(ctaDisabled(r)).toBe(false);
  });

  it('malformed amount: a helper, CTA disabled', () => {
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1.0000000001'); // 10 decimals
    expect(r.getByText('Enter an amount of TEST (up to 9 decimals)')).toBeTruthy();
    expect(ctaDisabled(r)).toBe(true);
  });

  it('not enough SOL for the fee + the deposit record: the warning, CTA disabled', () => {
    mockBalances = {tokenBalances: {[A0.mint]: '2000000000'}, solBalance: '700959'}; // 1 lamport short
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1');
    expect(r.getByText(/Not enough SOL: this deposit needs about 0.00070096 SOL/)).toBeTruthy();
    expect(ctaDisabled(r)).toBe(true);
  });

  it('the CTA is debounced (cardinal rule 6): a second tap within 500 ms does nothing', () => {
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1');
    fireEvent.press(r.getByTestId('shield-cta'));
    clock += 499;
    fireEvent.press(r.getByTestId('shield-cta'));
    expect(onShield).toHaveBeenCalledTimes(1);
    clock += 1;
    fireEvent.press(r.getByTestId('shield-cta'));
    expect(onShield).toHaveBeenCalledTimes(2);
  });
});

describe('#16 — R1-m9: "Check again" on a pending deposit', () => {
  it('a pending deposit shows "Check again"; a tap runs the check (the hook reconciles, bound, then re-reads)', () => {
    mockView = {kind: 'ready', unspent: 1_500_000_000n, pending: 250_000_000n, notes: 2};
    const r = screen();
    const b = r.getByTestId('shielded-check-again');
    expect(b.props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(b);
    expect(mockCheck.run).toHaveBeenCalledTimes(1);
  });

  it('disabled while the startup step runs or a check is in flight: a tap does nothing; the last result is said', () => {
    mockView = {kind: 'ready', unspent: 1_500_000_000n, pending: 250_000_000n, notes: 2};
    Object.assign(mockCheck, {disabled: true, checking: true, note: 'Still not confirmed · checked just now.'});
    const r = screen();
    const b = r.getByTestId('shielded-check-again');
    expect(b.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(b);
    expect(mockCheck.run).not.toHaveBeenCalled();
    expect(r.getByText('Checking…')).toBeTruthy();
    expect(r.getByText('Still not confirmed · checked just now.')).toBeTruthy();
  });

  it('control: nothing pending → no "Check again"', () => {
    const r = screen();
    expect(r.queryByTestId('shielded-check-again')).toBeNull();
  });
});

describe('#16 — gated on the A0 startup step', () => {
  it('ready: the shielded balance line with the pending sum', () => {
    mockView = {kind: 'ready', unspent: 1_500_000_000n, pending: 250_000_000n, notes: 2};
    const r = screen();
    expect(r.getByTestId('shielded-line')).toBeTruthy();
    expect(r.getByText('1.5 TEST · 0.25 TEST pending')).toBeTruthy();
  });

  it.each([
    ['running', {kind: 'running'} as A0ShieldedView, /Restoring your shielded notes from the chain/],
    ['unsupported', {kind: 'unsupported'} as A0ShieldedView, /needs the on-device prover/],
    ['idle', {kind: 'idle'} as A0ShieldedView, /not loaded yet/],
    ['error', {kind: 'error', code: 'E_A0_TREE_LAYOUT', message: 'bad account'} as A0ShieldedView, /could not be restored · E_A0_TREE_LAYOUT/],
  ])('%s: a stated state, no balance figure, the CTA disabled with a valid amount', (_n, view, text) => {
    mockView = view;
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1');
    expect(r.getByText(text)).toBeTruthy();
    expect(r.queryByText(/Shielded balance/)).toBeNull();
    expect(ctaDisabled(r)).toBe(true);
    fireEvent.press(r.getByTestId('shield-cta'));
    expect(onShield).not.toHaveBeenCalled();
  });

  it('error → Retry runs the startup step again; a failed retry shows its code (never a spinner forever)', async () => {
    mockView = {kind: 'error', code: 'E_A0_SYNC_RPC', message: 'timeout'};
    mockRetry.mockResolvedValue({phase: 'error', code: 'E_A0_SYNC_RPC', message: 'timeout again'});
    const r = screen();
    await act(async () => {
      fireEvent.press(r.getByTestId('shielded-retry'));
    });
    expect(mockRetry).toHaveBeenCalledTimes(1);
    expect(r.getByText(/E_A0_SYNC_RPC: timeout again/)).toBeTruthy();
    expect(r.getByText('Retry')).toBeTruthy(); // the way out stays
  });

  it('idle → Retry is offered too', async () => {
    mockView = {kind: 'idle'};
    mockRetry.mockResolvedValue({phase: 'running'});
    const r = screen();
    await act(async () => {
      fireEvent.press(r.getByTestId('shielded-retry'));
    });
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});

describe('#16 — the unshield side is hidden until M1c', () => {
  it('no "Make public" tab, no vault-balance side, no Unshield CTA', () => {
    const r = screen();
    expect(r.queryByText('Make public')).toBeNull();
    expect(r.queryByText('Vault balance')).toBeNull();
    expect(r.queryByText(/^Unshield/)).toBeNull(); // the title "Shield / Unshield" is the design's
    expect(r.queryByText(/Privacy decreases on public withdraw/)).toBeNull();
  });

  it('a stale {direction: "public"} prop has no effect (the screen has no public mode)', () => {
    const props = {onBack, onShield, initialDirection: 'public'} as unknown as React.ComponentProps<typeof ShieldUnshieldScreen>;
    const r = render(<ShieldUnshieldScreen {...props} />);
    expect(r.queryByText('Make public')).toBeNull();
    expect(r.getByText('Make private')).toBeTruthy();
  });
});
