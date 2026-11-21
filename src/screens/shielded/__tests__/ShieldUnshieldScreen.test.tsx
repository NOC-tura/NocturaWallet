/**
 * #16 shield side on the A0 pool: the amount (BigInt, from the main account's balance of the pool's
 * mint), the fee rows the design shows (with the ZK proof row) as what an A0 deposit costs, the
 * gating on the A0 startup step (the CTA only when the restore finished; every other state is a
 * state with a way out — Retry — never a spinner forever), and the direction fixed by the route
 * (owner phone pass 2026-11-21: "Make private" and "Make public" are two screens, no tabs; the
 * Make public side's own rows are in unshield/__tests__/UnshieldSide.test.tsx).
 */
import React from 'react';
import {render, fireEvent, act, waitFor, within} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {ShieldUnshieldScreen} from '../ShieldUnshieldScreen';
import type {A0ShieldedView} from '../../../hooks/useA0Shielded';
import {A0} from '../../../modules/shielded/a0/constants';

let mockView: A0ShieldedView = {kind: 'ready', unspent: 500_000_000n, pending: 0n, notes: 1};
const mockRetry = jest.fn();
let mockRefusal: string | null = null;
const mockCheck = {disabled: false, checking: false, note: null as string | null, run: jest.fn()};
jest.mock('../../../hooks/useA0Shielded', () => ({
  useA0Shielded: () => ({view: mockView, refresh: jest.fn(), checkAgain: mockCheck, refusal: mockRefusal}),
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
  mockRefusal = null;
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
  it('idle: title, the "Make private" tab, ONE balance line ("Public balance" from the pool mint), MAX, "You\'ll make private", the fee rows behind Details, the disabled CTA', async () => {
    const r = screen();
    await waitFor(() => expect(mockPoolCount).toHaveBeenCalled());
    // owner phone pass 2026-11-21: the title is the action ("Private ⇄ Public" and its tabs left)
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make private');
    expect(r.queryByText('Private ⇄ Public')).toBeNull();
    expect(r.getByText('Public balance')).toBeTruthy(); // part B: "Available" → "Public balance"
    expect(r.getByTestId('shield-balance-value').props.children).toBe('2 TEST'); // part B: by text "2 TEST" → the BalanceRow's value id
    expect(r.queryByText('Private balance')).toBeNull(); // decision B-2: one balance line per tab
    expect(r.getByLabelText('Max')).toBeTruthy();
    expect(r.getByText("You'll make private")).toBeTruthy(); // part B: "You'll shield" → "You'll make private"
    expect(r.queryByText('Network fee')).toBeNull(); // decision B-3: behind Details
    fireEvent.press(r.getByTestId('shield-details-toggle'));
    expect(r.getByText('Network fee')).toBeTruthy();
    expect(r.getByText('ZK proof fee')).toBeTruthy();
    expect(r.getByText('Deposit record rent')).toBeTruthy();
    expect(ctaDisabled(r)).toBe(true);
    expect(r.getByText('Make TEST private')).toBeTruthy(); // part B: "Shield TEST" → "Make TEST private"
    expect(r.getByTestId('shield-cta').props.accessibilityLabel).toBe('Make TEST private');
  });

  it('amount entered: the fees are the A0 deposit costs (SOL, behind Details), "You\'ll make private" is the exact amount, the pool count is the chain number + 1', async () => {
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1.25');
    await waitFor(() => expect(mockPoolCount).toHaveBeenCalled());
    await act(async () => {});
    expect(r.queryByTestId('pool-notes')).toBeNull(); // ambiguity A6: the pool size sits behind Details
    fireEvent.press(r.getByTestId('shield-details-toggle'));
    await waitFor(() => expect(r.getByTestId('pool-notes')).toBeTruthy());
    expect(r.getByText('0.000005 SOL')).toBeTruthy();
    expect(r.getByText('None · made on this device')).toBeTruthy();
    expect(r.getByText('≈ 0.00069596 SOL')).toBeTruthy();
    expect(r.getByTestId('shield-net').props.children).toBe('1.25 TEST');
    expect(r.getByTestId('pool-notes').props.children).toBe('18');
    expect(r.getByText('Make 1.25 TEST private')).toBeTruthy(); // part B: "Shield 1.25 TEST" → "Make 1.25 TEST private"
    expect(r.queryByText(/USD/)).toBeNull(); // no price exists for the devnet test token
  });

  it('UX-A 3: the amount and its symbol sit together, centred — the input is sized to its content (no min width), the symbol right after it', () => {
    const r = screen();
    const line = r.getByTestId('shield-amount-row');
    expect(line.props.className).toMatch(/(^|\s)justify-center(\s|$)/);
    expect(line.props.className).toMatch(/(^|\s)gap-2(\s|$)/);
    const [first, second] = React.Children.toArray(line.props.children) as React.ReactElement<{testID?: string}>[];
    expect(first!.props.testID).toBe('shield-amount-input');
    expect(second!.props.testID).toBe('shield-amount-symbol');
    const input = r.getByTestId('shield-amount-input');
    expect(input.props.className).not.toMatch(/min-w/);
    expect(StyleSheet.flatten(input.props.style)?.minWidth).toBeUndefined();
    expect(r.getByTestId('shield-amount-symbol').props.children).toBe('TEST');
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
    expect(r.getByTestId('shield-over-max').props.children).toBe('Insufficient balance · max 2 TEST'); // part B: through AmountLimitHint (A5)
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

  it('Review Focus 2: the SOL-short warning and the honest deposit sentence stay visible with Details collapsed', async () => {
    mockBalances = {tokenBalances: {[A0.mint]: '2000000000'}, solBalance: '700959'};
    const r = screen();
    await waitFor(() => expect(mockPoolCount).toHaveBeenCalled());
    await act(async () => {});
    expect(r.getByText(/Your main account signs this deposit\. The amount, the time and your address are public on chain/)).toBeTruthy();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1');
    expect(r.queryByTestId('shield-details-body')).toBeNull();
    expect(r.getByText(/Not enough SOL: this deposit needs about 0.00070096 SOL/)).toBeTruthy();
  });

  it('honesty (spec §2, controller ruling, fix round 1): the deposit sentence stays visible once an amount is typed, Details collapsed', async () => {
    const r = screen();
    await waitFor(() => expect(mockPoolCount).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1.25');
    expect(r.queryByTestId('shield-details-body')).toBeNull();
    expect(
      r.getByText(
        'Your main account signs this deposit. The amount, the time and your address are public on chain, and a later withdrawal to this wallet can be linked to it.',
      ),
    ).toBeTruthy();
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
  it('ready: no private balance on the Make private tab (decision B-2), the pending sum is said', () => {
    mockView = {kind: 'ready', unspent: 1_500_000_000n, pending: 250_000_000n, notes: 2};
    const r = screen();
    expect(r.queryByText('Private balance')).toBeNull(); // part B: the "Shielded balance" line left this tab
    expect(r.queryByText('1.5 TEST')).toBeNull();
    expect(r.getByTestId('shielded-line-pending').props.children).toBe('0.25 TEST pending');
  });

  it('UX-A 1 kept: the one balance line is a BalanceRow (gap, the value right-aligned); "X pending" is its own Text outside it', () => {
    mockView = {kind: 'ready', unspent: 4_980_000n, pending: 1_000_000n, notes: 2};
    const r = screen();
    const row = r.getByTestId('shield-balance');
    expect(row.props.className).toMatch(/(^|\s)gap-\d/);
    expect(within(row).queryByTestId('shielded-line-pending')).toBeNull(); // not inside the row
    expect(r.getByTestId('shielded-line-pending').props.children).toBe('0.001 TEST pending');
    expect(r.queryByText(/TEST ·/)).toBeNull(); // the old glued form is gone
  });

  it('ready, nothing pending, no note, no refusal: no status line at all', () => {
    const r = screen();
    expect(r.queryByTestId('shielded-line-pending')).toBeNull();
    expect(r.queryByTestId('shielded-check-caption')).toBeNull();
    expect(r.queryByTestId('shielded-refusal')).toBeNull();
  });

  it.each([
    ['running', {kind: 'running'} as A0ShieldedView, /Restoring your private balance from the chain/], // part B: "Restoring your shielded notes" → "Restoring your private balance"
    ['unsupported', {kind: 'unsupported'} as A0ShieldedView, /needs the on-device prover/],
    ['idle', {kind: 'idle'} as A0ShieldedView, /not loaded yet/],
    ['error', {kind: 'error', code: 'E_A0_TREE_LAYOUT', message: 'bad account'} as A0ShieldedView, /could not be restored · E_A0_TREE_LAYOUT/],
  ])('%s: a stated state, no private figure, the CTA disabled with a valid amount', (_n, view, text) => {
    mockView = view;
    const r = screen();
    fireEvent.changeText(r.getByTestId('shield-amount-input'), '1');
    expect(r.getByText(text)).toBeTruthy();
    expect(r.queryByTestId('shielded-line-pending')).toBeNull(); // part B (review I-4): no figure of the private side in a non-ready state — a "Private balance" negative would be vacuous on this tab
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
    // final review M-4 (rewritten): the code, never the message beside it
    expect(r.getByText(/E_A0_SYNC_RPC · Retry again in a moment\./)).toBeTruthy();
    expect(r.queryByText(/timeout/)).toBeNull();
    expect(r.getByText('Retry')).toBeTruthy(); // the way out stays
  });

  it('M-4: the restore error shows its code, not its message; with no code, the message', () => {
    mockView = {kind: 'error', code: 'E_A0_SYNC_RPC', message: 'https://rpc/?api-key=SENTINEL789'};
    const r = screen();
    expect(r.getByText(/could not be restored · E_A0_SYNC_RPC/)).toBeTruthy();
    expect(JSON.stringify(r.toJSON())).not.toContain('SENTINEL789');
    r.unmount();
    mockView = {kind: 'error', code: null, message: 'Network request failed'};
    expect(screen().getByText(/Network request failed/)).toBeTruthy();
  });

  it('re-review N-2: the last pending item decided → the caption stays (without "Check again"); none without a note', () => {
    mockView = {kind: 'ready', unspent: 500_000_000n, pending: 0n, notes: 1};
    Object.assign(mockCheck, {note: 'Not sent · your note is back in your private balance.'}); // part B: the fixture follows the caption Task 4 ships
    const r = screen();
    expect(r.getByTestId('shielded-check-caption').props.children).toBe('Not sent · your note is back in your private balance.'); // part B: the fixture follows the caption Task 4 ships
    expect(r.queryByTestId('shielded-check-again')).toBeNull();
    r.unmount();
    Object.assign(mockCheck, {note: null});
    expect(screen().queryByTestId('shielded-check-caption')).toBeNull();
  });

  it('final review I-1: a verifier refusal the startup step or "Check again" found is LOUD here, by its code (undrawn)', () => {
    mockView = {kind: 'ready', unspent: 0n, pending: 0n, notes: 0};
    mockRefusal = 'E_A0_VERIFY_SEED_SIGNER';
    const r = screen();
    expect(r.getByTestId('shielded-refusal')).toBeTruthy();
    expect(r.getByText('Landed, but failed verification: E_A0_VERIFY_SEED_SIGNER · a key of this wallet signed it')).toBeTruthy();
    r.unmount();
    mockRefusal = null;
    expect(screen().queryByTestId('shielded-refusal')).toBeNull();
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

describe('#16 — two screens, no tabs (owner phone pass 2026-11-21)', () => {
  it('Make private: the title is the action, a header; no tab, no "Make public" control on the screen', () => {
    const r = render(<ShieldUnshieldScreen onBack={onBack} onShield={onShield} initialDirection="private" />);
    const title = r.getByTestId('shield-unshield-title');
    expect(title.props.children).toBe('Make private');
    expect(title.props.accessibilityRole).toBe('header');
    expect(r.getAllByRole('header')).toHaveLength(1); // positive control: the role query sees roles
    expect(r.queryAllByRole('tab')).toHaveLength(0);
    expect(r.queryByLabelText('Make private')).toBeNull(); // the DirTab label pair is gone
    expect(r.queryByLabelText('Make public')).toBeNull();
    expect(r.queryByText('Make public')).toBeNull();
    expect(r.getByTestId('shield-cta')).toBeTruthy();
    expect(r.queryByTestId('unshield-cta')).toBeNull();
  });

  it('the direction is the route param for the life of the screen: a later prop does not flip it', () => {
    const r = render(<ShieldUnshieldScreen onBack={onBack} onShield={onShield} initialDirection="private" />);
    r.rerender(<ShieldUnshieldScreen onBack={onBack} onShield={onShield} initialDirection="public" />);
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make private');
    expect(r.getByTestId('shield-cta')).toBeTruthy();
    expect(r.queryByTestId('unshield-cta')).toBeNull();
  });

  it('a missing direction opens Make private (today\'s default)', () => {
    const r = screen();
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make private');
    expect(r.getByTestId('shield-cta')).toBeTruthy();
    expect(r.queryByTestId('unshield-cta')).toBeNull();
  });

  it('an unknown initialDirection opens Make private (only "public" opens Make public)', () => {
    const props = {onBack, onShield, initialDirection: 'withdraw'} as unknown as React.ComponentProps<typeof ShieldUnshieldScreen>;
    const r = render(<ShieldUnshieldScreen {...props} />);
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make private');
    expect(r.queryByTestId('unshield-cta')).toBeNull();
  });
});
