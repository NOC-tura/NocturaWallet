/**
 * #16's "Make public" side on the A0 pool (M1c Task 8; spec §6 steps 1–2, §11, S3 / S9 / S11,
 * controller ruling 4, CLAUDE.md rule 6). Rendered through the REAL #16 (`ShieldUnshieldScreen`)
 * and the REAL pure offer / source functions (`a0UnshieldDestinationOffer`, `a0UnshieldSource`);
 * only the quote's network fetch, the note store read, the scheme read and the startup view are
 * stubbed. The address checks run on the REAL @solana/web3.js (the app-wide mock's PublicKey is 32
 * zero bytes, under which every string is "on curve").
 *
 * Every expected sentence below is §11's text typed out here, never read from the copy module.
 */
import React from 'react';
import {render, fireEvent, act, waitFor} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {ShieldUnshieldScreen} from '../../ShieldUnshieldScreen';
import {A0} from '../../../../modules/shielded/a0/constants';
import type {A0ShieldedView} from '../../../../hooks/useA0Shielded';
import type {A0RelayerQuote} from '../../../../modules/shielded/a0/relayerClient';
import type {A0Note} from '../../../../modules/shielded/a0/noteStore';
import type {TransparentScheme} from '../../../../modules/keyDerivation/transparent';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../../../../modules/shielded/a0/__testing__/realWeb3')>(
    '../../../../modules/shielded/a0/__testing__/realWeb3',
  ).loadRealWeb3(),
);
const web3 = require('@solana/web3.js') as typeof import('@solana/web3.js');

let mockView: A0ShieldedView = {kind: 'ready', unspent: 0n, pending: 0n, notes: 0};
const mockCheck = {disabled: false, checking: false, note: null as string | null, run: jest.fn()};
jest.mock('../../../../hooks/useA0Shielded', () => ({
  useA0Shielded: () => ({view: mockView, refresh: jest.fn(), checkAgain: mockCheck}),
  retryA0Startup: jest.fn(),
}));

const MAIN = web3.Keypair.fromSeed(new Uint8Array(32).fill(1)).publicKey.toBase58();
const OTHER = web3.Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey.toBase58();
const OFF_CURVE = web3.PublicKey.findProgramAddressSync([Buffer.from('off-curve')], web3.SystemProgram.programId)[0].toBase58();

jest.mock('../../../../store/zustand/walletStore', () => ({
  useWalletStore: () => ({tokenBalances: mockTokenBalances, solBalance: '1000000000', publicKey: mockMain, lastSyncedAt: 1, lastSyncFailedAt: null}), // final review I1: a current main read
}));
let mockMain: string | null = null;
/** the main account's token balances — only the MAX-colour row (owner phone pass 2026-11-21) sets them */
let mockTokenBalances: Record<string, string> = {};

jest.mock('../../../../modules/shielded/a0/poolSize', () => ({
  readA0PoolNoteCount: () => Promise.resolve({status: 'ok', count: 3}),
}));
jest.mock('../../../../modules/solana/connection', () => ({getConnection: () => ({rpc: 'devnet'})}));

const mockQuote = jest.fn();
jest.mock('../../../../modules/shielded/a0/relayerClient', () => ({
  ...jest.requireActual('../../../../modules/shielded/a0/relayerClient'),
  fetchA0RelayerQuote: (...a: unknown[]) => mockQuote(...a),
}));
let mockNotes: A0Note[] = [];
const mockNoteReads = {n: 0};
jest.mock('../../../../modules/shielded/a0/noteStore', () => ({
  ...jest.requireActual('../../../../modules/shielded/a0/noteStore'),
  loadA0NoteStore: () => {
    mockNoteReads.n += 1;
    return {nextDepositIndex: 2n, notes: mockNotes};
  },
}));
let mockScheme: TransparentScheme | null = {kind: 'slip10', account: 0};
jest.mock('../../../../modules/keyDerivation/derivationScheme', () => ({
  loadTransparentScheme: () => {
    if (mockScheme === null) throw new Error('scheme unreadable'); // fix round 1: an unreadable scheme
    return mockScheme;
  },
}));

/** The live devnet quote's terms (facts file: minFee 10000, gasGrantLamports "3000000"). */
function quote(over: Partial<A0RelayerQuote> = {}): A0RelayerQuote {
  return {
    programId: 'FeGSS',
    pool: '8VMe',
    mint: 'mint',
    feePayer: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe',
    maxFee: 1_000_000n,
    minFee: {transfer: 10_000n, withdrawChange: 10_000n},
    gasGrantLamports: 3_000_000n,
    validForSeconds: 60,
    fee: 10_000n,
    grantFloorLamports: 655_240n,
    fetchedAtMs: 1,
    ...over,
  };
}

const note = (amount: bigint, leafIndex: number, status: A0Note['status'] = 'unspent'): A0Note => ({
  commitment: `${leafIndex}`.padStart(64, '0'),
  amount,
  rho: `${leafIndex}`.padStart(64, 'a'),
  leafIndex,
  status,
});

const onUnshield = jest.fn();
let clock = 5_000_000;

beforeEach(() => {
  mockView = {kind: 'ready', unspent: 2_500_000_000n, pending: 0n, notes: 2};
  mockNotes = [note(2_000_000_000n, 4), note(500_000_000n, 7)]; // 2 TEST + 0.5 TEST
  mockMain = MAIN;
  mockTokenBalances = {};
  mockScheme = {kind: 'slip10', account: 0};
  mockQuote.mockReset().mockResolvedValue(quote());
  onUnshield.mockReset();
  clock += 10_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function screen(props: Partial<React.ComponentProps<typeof ShieldUnshieldScreen>> = {}) {
  const r = render(
    <ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} initialDirection="public" {...props} />,
  );
  await waitFor(() => expect(mockQuote).toHaveBeenCalled());
  await act(async () => {});
  return r;
}
type R = Awaited<ReturnType<typeof screen>>;
const disabled = (r: R, id: string) => r.getByTestId(id).props.accessibilityState?.disabled;
const selected = (r: R, id: string) => r.getByTestId(id).props.accessibilityState?.selected;
const text = (r: R, id: string) => r.getByTestId(id).props.children;
/** part B (spec §3.3): the options live behind "Change"; a pick closes them. */
const openDest = (r: R) => fireEvent.press(r.getByTestId('unshield-dest-change'));
const pick = (r: R, which: 'fresh' | 'main' | 'external') => {
  openDest(r);
  fireEvent.press(r.getByTestId(`unshield-dest-${which}`));
};
const summary = (r: R) => text(r, 'unshield-dest-summary');

describe('#16 — two screens, no tabs (owner phone pass 2026-11-21)', () => {
  it('no direction opens Make private: no tab, no "Make public" control, and the relayer is never asked', async () => {
    const r = render(<ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} />);
    await act(async () => {});
    expect(mockQuote).not.toHaveBeenCalled(); // the shield side makes no relayer request
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make private');
    expect(r.queryAllByRole('tab')).toHaveLength(0);
    expect(r.queryByLabelText('Make public')).toBeNull();
    expect(r.getByTestId('shield-cta')).toBeTruthy();
    expect(r.queryByTestId('unshield-cta')).toBeNull();
  });

  it('initialDirection "public" opens Make public: the title is the action, a header; no tab, no "Make private" control; the quote is asked once, on the devnet Connection', async () => {
    const r = await screen();
    const title = r.getByTestId('shield-unshield-title');
    expect(title.props.children).toBe('Make public');
    expect(title.props.accessibilityRole).toBe('header');
    expect(r.getAllByRole('header')).toHaveLength(1); // positive control: the role query sees roles
    expect(r.queryAllByRole('tab')).toHaveLength(0);
    expect(r.queryByLabelText('Make private')).toBeNull(); // the DirTab label pair is gone
    expect(r.queryByLabelText('Make public')).toBeNull();
    expect(r.queryByText('Make private')).toBeNull();
    expect(r.queryByText('Private ⇄ Public')).toBeNull();
    expect(r.getByTestId('unshield-cta')).toBeTruthy();
    expect(r.queryByTestId('shield-cta')).toBeNull();
    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockQuote.mock.calls[0]![0]).toEqual({rpc: 'devnet'});
  });

  it('Make public stays Make public for the life of the screen: a later prop does not flip it', async () => {
    const r = await screen();
    r.rerender(<ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} initialDirection="private" />);
    await act(async () => {});
    expect(r.getByTestId('shield-unshield-title').props.children).toBe('Make public');
    expect(r.getByTestId('unshield-cta')).toBeTruthy();
    expect(r.queryByTestId('shield-cta')).toBeNull();
  });

  it('one MAX colour: the Make public MAX chip has exactly the Make private chip\'s classes, enabled and disabled', async () => {
    const chip = (r: R) => ({box: r.getByLabelText('Max').props.className, label: r.getByText('MAX').props.className});
    // enabled on both: 2 TEST public, 2.5 TEST private
    mockTokenBalances = {[A0.mint]: '2000000000'};
    const priv = render(<ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} />);
    await act(async () => {});
    const privOn = chip(priv as unknown as R);
    priv.unmount();
    const pubOn = chip(await screen());
    expect(privOn.label).toContain('text-accent-shielded'); // non-vacuous: the shield side's colour
    expect(pubOn).toEqual(privOn);
    // disabled on both: no public balance, no private note
    mockTokenBalances = {};
    mockNotes = [];
    const privOffR = render(<ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} />);
    await act(async () => {});
    const privOff = chip(privOffR as unknown as R);
    privOffR.unmount();
    const pubOff = chip(await screen());
    expect(privOff.label).toContain('text-fg-disabled');
    expect(pubOff).toEqual(privOff);
  });
});

describe('#16 unshield — the design (states 2 and 5) and the A0 lines', () => {
  it('UX-A 3: the amount and its symbol sit together, centred — the input is sized to its content (no min width), the symbol right after it', async () => {
    const r = await screen();
    const line = r.getByTestId('unshield-amount-row');
    expect(line.props.className).toMatch(/(^|\s)justify-center(\s|$)/);
    expect(line.props.className).toMatch(/(^|\s)gap-2(\s|$)/);
    const [first, second] = React.Children.toArray(line.props.children) as React.ReactElement<{testID?: string}>[];
    expect(first!.props.testID).toBe('unshield-amount-input');
    expect(second!.props.testID).toBe('unshield-amount-symbol');
    const input = r.getByTestId('unshield-amount-input');
    expect(input.props.className).not.toMatch(/min-w/);
    expect(StyleSheet.flatten(input.props.style)?.minWidth).toBeUndefined();
    expect(text(r, 'unshield-amount-symbol')).toBe('TEST');
  });

  it('idle: ONE balance line ("Private balance"), the relayed copy, the relayer fee visible, the rest and the one-note limit behind Details, CTA "Make TEST public" disabled', async () => {
    const r = await screen();
    expect(r.getByText('Private balance')).toBeTruthy(); // part B: "Vault balance" → "Private balance"
    expect(text(r, 'unshield-vault-value')).toBe('2.5 TEST'); // part B: "unshield-vault" → its BalanceRow value "unshield-vault-value"
    expect(r.queryByText('Public balance')).toBeNull(); // decision B-2
    expect(text(r, 'unshield-relayed')).toBe(
      'The relayer pays for and submits this transaction, so no key of yours signs it. Amounts and timing are public.',
    );
    expect(r.getByText('What stays public')).toBeTruthy(); // owner phone pass 2026-11-21: was "Privacy decreases on public withdraw"
    // phone-fix review I-1: under "What stays public" the list leads with a public thing and names the destination too
    expect(text(r, 'unshield-destination-public')).toBe('The destination address is public on chain.');
    expect(r.queryByText('Privacy decreases on public withdraw')).toBeNull();
    expect(r.getByText('Relayer fee')).toBeTruthy();
    expect(r.queryByText('Proof fee')).toBeNull(); // decision B-3: behind Details (phone pass 2 fix round 1, M-1: was "ZK proof fee")
    expect(r.queryByTestId('unshield-one-note')).toBeNull();
    fireEvent.press(r.getByTestId('unshield-details-toggle'));
    expect(r.getByText('Proof fee')).toBeTruthy();
    expect(r.queryByText(/ZK proof fee/)).toBeNull();
    expect(r.getByText('Network fee')).toBeTruthy();
    expect(text(r, 'unshield-one-note')).toBe(
      'You can make up to 1.99999 TEST public from one note at a time; combining notes comes in a later version.',
    ); // part B: "You can unshield up to" → "You can make up to … public"
    expect(r.getByText('Make TEST public')).toBeTruthy(); // part B: "Unshield TEST" → "Make TEST public"
    expect(r.getByTestId('unshield-cta').props.accessibilityLabel).toBe('Make TEST public');
    expect(disabled(r, 'unshield-cta')).toBe(true);
  });

  it('amount entered: the relayer fee (token), the exact amount line; the network fee paid by the relayer behind Details', async () => {
    const r = await screen();
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.25');
    expect(r.getByText('0.00001 TEST')).toBeTruthy();
    expect(text(r, 'unshield-net')).toBe('1.25 TEST');
    expect(text(r, 'unshield-amount-line')).toBe(
      'The destination receives exactly 1.25 TEST. The relayer fee of 0.00001 TEST comes out of your private balance.',
    ); // part B: "shielded balance" → "private balance"
    fireEvent.press(r.getByTestId('unshield-details-toggle'));
    expect(r.getByText('Paid by the relayer')).toBeTruthy();
    expect(r.getByText('None · made on this device')).toBeTruthy();
    expect(r.getByText('Make 1.25 TEST public')).toBeTruthy(); // part B: "Unshield 1.25 TEST" → "Make 1.25 TEST public"
    expect(disabled(r, 'unshield-cta')).toBe(false); // the fresh account is preselected
  });

  it('Review Focus 3: MAX = the largest note minus the fee, exact; exactly MAX → no hint, enabled; one base unit more → the hint, CTA disabled', async () => {
    const r = await screen();
    fireEvent.press(r.getByLabelText('Max'));
    expect(r.getByTestId('unshield-amount-input').props.value).toBe('1.99999');
    expect(r.queryByTestId('unshield-over-max')).toBeNull();
    expect(disabled(r, 'unshield-cta')).toBe(false);
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.999990001');
    expect(text(r, 'unshield-over-max')).toBe('You can make up to 1.99999 TEST public at once.'); // part B: AmountLimitHint
    expect(r.queryByTestId('unshield-details-body')).toBeNull(); // Review Focus 2: the hint is visible with Details collapsed
    expect(disabled(r, 'unshield-cta')).toBe(true);
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).not.toHaveBeenCalled();
  });

  it('no note can pay the fee → said, CTA disabled (a pending note is never a source)', async () => {
    mockNotes = [note(10_000n, 1), note(5_000_000_000n, 2, 'pending')];
    const r = await screen();
    expect(text(r, 'unshield-no-note')).toBe('No private note can pay the relayer fee of 0.00001 TEST.'); // part B: "No shielded note" → "No private note"
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '0.000000001');
    expect(disabled(r, 'unshield-cta')).toBe(true);
  });

  it('Review Focus 2: a refused quote, "no private note can pay" and the relayed sentence are all visible with Details collapsed', async () => {
    mockNotes = [note(10_000n, 1)];
    mockQuote.mockRejectedValueOnce(Object.assign(new Error('E_A0_QUOTE_FEE_PAYER: x'), {code: 'E_A0_QUOTE_FEE_PAYER'}));
    const r = await screen();
    expect(r.queryByTestId('unshield-details-body')).toBeNull();
    expect(r.getByText(/The relayer's quote was refused · E_A0_QUOTE_FEE_PAYER/)).toBeTruthy();
    expect(r.getByTestId('unshield-relayed')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('unshield-quote-retry'));
    });
    expect(text(r, 'unshield-no-note')).toBe('No private note can pay the relayer fee of 0.00001 TEST.');
    expect(r.queryByTestId('unshield-details-body')).toBeNull();
  });

  it.each([
    ['running', {kind: 'running'} as A0ShieldedView],
    ['idle', {kind: 'idle'} as A0ShieldedView],
    ['error', {kind: 'error', code: 'E_A0_SYNC_RPC', message: 'x'} as A0ShieldedView],
    ['unsupported', {kind: 'unsupported'} as A0ShieldedView],
  ])('review I-4: startup %s → the one balance line says "—", never a figure', async (_n, view) => {
    mockView = view;
    const r = await screen();
    expect(text(r, 'unshield-vault-value')).toBe('—');
  });
});

describe('#16 unshield — the destination row (part B, spec §3.3; M1c S3 / S9 / S11, ruling 4)', () => {
  it('a granting quote: collapsed "To: A new account (recommended) · Change"; the fresh account PRESELECTED with the §11 default and the grant in SOL', async () => {
    const r = await screen();
    expect(summary(r)).toBe('To: A new account (recommended)'); // part B: the selection read from the collapsed row
    expect(r.queryByTestId('unshield-dest-options')).toBeNull();
    openDest(r);
    expect(selected(r, 'unshield-dest-fresh')).toBe(true);
    expect(selected(r, 'unshield-dest-main')).toBe(false);
    expect(text(r, 'unshield-dest-fresh-sub')).toBe(
      'A new account of this wallet receives it. The relayer also sends it 0.003 SOL so it can pay for its own transactions.',
    );
  });

  it('Review Focus 1 / S11 (M1c\'s row, its assertions kept; owner decision A1): a quote WITHOUT a grant → "To: Choose a destination", the reason visible, fresh disabled, NOTHING preselected, the CTA disabled until a choice; main → its warning, then {kind: "main"} only on a tap', async () => {
    mockQuote.mockResolvedValue(quote({gasGrantLamports: null, grantFloorLamports: null}));
    const r = await screen();
    expect(summary(r)).toBe('To: Choose a destination'); // part B: the collapsed row (owner decision A1)
    expect(text(r, 'unshield-dest-fresh-reason')).toBe(
      'A new account is not available yet: the relayer cannot send it SOL for its own fees, and funding it from your other accounts would link them.',
    );
    openDest(r); // part B: the options sit behind Change
    expect(summary(r)).toBe('To: Choose a destination'); // carry 1a: opening Change chooses nothing
    expect(disabled(r, 'unshield-dest-fresh')).toBe(true);
    expect(text(r, 'unshield-dest-fresh-sub')).toBe(
      'A new account is not available yet: the relayer cannot send it SOL for its own fees, and funding it from your other accounts would link them.',
    );
    for (const id of ['unshield-dest-fresh', 'unshield-dest-main', 'unshield-dest-external']) {
      expect(selected(r, id)).toBe(false);
    }
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    expect(disabled(r, 'unshield-cta')).toBe(true);
    fireEvent.press(r.getByTestId('unshield-dest-fresh')); // a tap on the disabled row selects nothing
    expect(selected(r, 'unshield-dest-fresh')).toBe(false);
    expect(r.queryByTestId('unshield-warning-main')).toBeNull();
    fireEvent.press(r.getByTestId('unshield-dest-main'));
    expect(disabled(r, 'unshield-cta')).toBe(false);
    expect(text(r, 'unshield-warning-main')).toBe('This links your exit to your deposit: your main account made the deposit.');
    expect(onUnshield).not.toHaveBeenCalled(); // never sent without the tap
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledWith({destination: {kind: 'main'}, amount: '1000000000'});
  });

  it('S9 / Review Focus 1 (M1c\'s row, its assertions kept): a cli wallet → fresh disabled with the cli reason and not selected, nothing preselected, even when the quote grants', async () => {
    mockScheme = {kind: 'cli'};
    const r = await screen();
    expect(summary(r)).toBe('To: Choose a destination'); // part B: the collapsed row (owner decision A1)
    expect(text(r, 'unshield-dest-fresh-reason')).toBe(
      'This wallet uses the Solana CLI key scheme, which has a single account, so no new account can be created for this exit.',
    );
    openDest(r);
    expect(summary(r)).toBe('To: Choose a destination'); // carry 1a: opening Change chooses nothing
    expect(disabled(r, 'unshield-dest-fresh')).toBe(true);
    for (const id of ['unshield-dest-fresh', 'unshield-dest-main', 'unshield-dest-external']) {
      expect(selected(r, id)).toBe(false); // carry 1a: nothing preselected (owner decision A1)
    }
    expect(text(r, 'unshield-dest-fresh-sub')).toBe(
      'This wallet uses the Solana CLI key scheme, which has a single account, so no new account can be created for this exit.',
    );
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    expect(disabled(r, 'unshield-cta')).toBe(true);
  });

  it('"My main account" → the link warning (§11 verbatim) under the row and the main address in its option; the request carries {kind: "main"}', async () => {
    const r = await screen();
    expect(r.queryByTestId('unshield-warning-main')).toBeNull();
    pick(r, 'main'); // part B: the options sit behind Change (pick = open + tap)
    expect(summary(r)).toBe('To: My main account'); // part B: the selection read from the collapsed row
    expect(text(r, 'unshield-warning-main')).toBe('This links your exit to your deposit: your main account made the deposit.');
    openDest(r);
    expect(text(r, 'unshield-dest-main-sub')).toBe(`${MAIN.slice(0, 6)}…${MAIN.slice(-6)}`);
    fireEvent.press(r.getByTestId('unshield-dest-main'));
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '0.5');
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledWith({destination: {kind: 'main'}, amount: '500000000'});
  });

  it('UX-A 2: the "Another address" input shows the WHOLE address — multiline (2 lines), monospace; Enter submits instead of breaking the line', async () => {
    const r = await screen();
    pick(r, 'external'); // part B: the options sit behind Change (pick = open + tap)
    const input = r.getByTestId('unshield-external-input');
    expect(input.props.multiline).toBe(true); // wraps: a single-line input scrolls the start out of view
    expect(input.props.numberOfLines).toBe(2);
    expect(input.props.className).toMatch(/(^|\s)font-geist-mono(\s|$)/);
    expect(input.props.submitBehavior).toBe('blurAndSubmit');
    fireEvent.changeText(input, OTHER);
    expect(r.getByTestId('unshield-external-input').props.value).toBe(OTHER); // the full text, nothing cut
  });

  it('"Another address" → the payment warning (one word swapped) under the row, the input; a valid wallet address → {kind: "external", owner}', async () => {
    const r = await screen();
    pick(r, 'external'); // part B: the options sit behind Change (pick = open + tap)
    expect(summary(r)).toBe('To: Another address'); // part B: the selection read from the collapsed row
    expect(text(r, 'unshield-warning-external')).toBe('This is a payment from your private balance. The recipient sees the amount.'); // part B: "shielded balance" → "private balance"
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.000000001');
    expect(disabled(r, 'unshield-cta')).toBe(true); // no address yet
    fireEvent.changeText(r.getByTestId('unshield-external-input'), `  ${OTHER} `);
    expect(r.queryByTestId('unshield-external-problem')).toBeNull();
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledWith({destination: {kind: 'external', owner: OTHER}, amount: '1000000001'});
  });

  it.each([
    ['not base58', 'not-an-address', 'Not a Solana address.'],
    ['off the curve (a PDA)', OFF_CURVE, 'Not a wallet address (a program or token account cannot receive here).'],
    ['the main account', MAIN, 'This is your main account: choose "My main account" instead.'],
  ])('"Another address" refuses %s: the helper, CTA disabled', async (_n, addr, helper) => {
    const r = await screen();
    pick(r, 'external'); // part B: the options sit behind Change (pick = open + tap)
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    fireEvent.changeText(r.getByTestId('unshield-external-input'), addr);
    expect(text(r, 'unshield-external-problem')).toBe(helper);
    expect(disabled(r, 'unshield-cta')).toBe(true);
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).not.toHaveBeenCalled();
  });

  it('the preselection happens once: the user\'s own pick survives every later render (and a quote that arrives after a Retry still preselects)', async () => {
    mockQuote.mockRejectedValueOnce(Object.assign(new Error('E_A0_QUOTE_UNAVAILABLE: no answer'), {code: 'E_A0_QUOTE_UNAVAILABLE'}));
    const r = await screen();
    expect(summary(r)).toBe('To: Choose a destination'); // no quote, no offer
    expect(disabled(r, 'unshield-dest-change')).toBe(true);
    await act(async () => {
      fireEvent.press(r.getByTestId('unshield-quote-retry'));
    });
    expect(summary(r)).toBe('To: A new account (recommended)'); // part B: selected(fresh) → the collapsed row
    pick(r, 'main'); // part B: the options sit behind Change (pick = open + tap)
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1'); // re-renders
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.5');
    expect(summary(r)).toBe('To: My main account'); // part B: selected(main) → the collapsed row
  });
});

describe('#16 unshield — an unreadable key scheme (fix round 1, review Minor 6)', () => {
  it('the collapsed row says why there is no new account (not a bare "Choose a destination"); nothing preselected; main still works', async () => {
    mockScheme = null;
    const r = await screen();
    expect(summary(r)).toBe('To: Choose a destination');
    expect(text(r, 'unshield-dest-fresh-reason')).toBe(
      'A new account is not available: this wallet\'s account type could not be read.',
    );
    openDest(r);
    expect(disabled(r, 'unshield-dest-fresh')).toBe(true);
    for (const id of ['unshield-dest-fresh', 'unshield-dest-main', 'unshield-dest-external']) {
      expect(selected(r, id)).toBe(false);
    }
    fireEvent.press(r.getByTestId('unshield-dest-main'));
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledWith({destination: {kind: 'main'}, amount: '1000000000'});
  });
});

describe('#16 unshield — the quote', () => {
  it('asking → "Asking the relayer for its fee…", CTA disabled', async () => {
    mockQuote.mockReturnValue(new Promise(() => {}));
    const r = render(<ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} initialDirection="public" />);
    expect(r.getByText('Asking the relayer for its fee…')).toBeTruthy();
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    expect(disabled(r, 'unshield-cta')).toBe(true);
  });

  it('refused → its code, Retry asks again; the destinations are not choosable without a quote', async () => {
    mockQuote.mockRejectedValueOnce(Object.assign(new Error('E_A0_QUOTE_FEE_PAYER: not the pinned relayer'), {code: 'E_A0_QUOTE_FEE_PAYER'}));
    const r = await screen();
    expect(r.getByText(/The relayer's quote was refused · E_A0_QUOTE_FEE_PAYER/)).toBeTruthy();
    // final review M-4: the code + a fixed sentence, never the message beside a code
    expect(r.queryByText(/not the pinned relayer/)).toBeNull();
    expect(r.getByText(/Ask the relayer again in a moment\./)).toBeTruthy();
    expect(disabled(r, 'unshield-dest-change')).toBe(true); // part B: the options sit behind Change, disabled without a quote
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    expect(disabled(r, 'unshield-cta')).toBe(true);
    await act(async () => {
      fireEvent.press(r.getByTestId('unshield-quote-retry'));
    });
    expect(mockQuote).toHaveBeenCalledTimes(2);
    expect(r.queryByText(/quote was refused/)).toBeNull();
    expect(disabled(r, 'unshield-cta')).toBe(false);
  });
});

describe('#16 unshield — final review M-4: raw messages only without a code', () => {
  it('a quote refused without a code shows its message', async () => {
    mockQuote.mockRejectedValueOnce(new Error('Network request failed'));
    const r = await screen();
    expect(r.getByText(/The relayer's quote was refused · error/)).toBeTruthy();
    expect(r.getByText(/Network request failed/)).toBeTruthy();
  });
});

describe('#16 unshield — the CTA (cardinal rule 6; Task 7: the startup state)', () => {
  it.each([
    ['running', {kind: 'running'} as A0ShieldedView],
    ['idle', {kind: 'idle'} as A0ShieldedView],
    ['error', {kind: 'error', code: 'E_A0_SYNC_RPC', message: 'x'} as A0ShieldedView],
    ['unsupported', {kind: 'unsupported'} as A0ShieldedView],
  ])('startup %s (not ready) → the CTA stays disabled with a valid amount and destination', async (_n, view) => {
    mockView = view;
    const r = await screen();
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    expect(summary(r)).toBe('To: A new account (recommended)'); // part B: read from the collapsed row
    expect(disabled(r, 'unshield-cta')).toBe(true);
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).not.toHaveBeenCalled();
  });

  it('control: the same inputs with the startup ready → enabled, one call with {kind: "fresh"} in base units', async () => {
    const r = await screen();
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledWith({destination: {kind: 'fresh'}, amount: '1000000000'});
  });

  it('disabled ON TAP: a second tap (even after 500 ms) does nothing until the screen is focused again', async () => {
    const r = await screen({focusKey: 1});
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(disabled(r, 'unshield-cta')).toBe(true);
    clock += 5_000;
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledTimes(1);
    r.rerender(
      <ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} initialDirection="public" focusKey={2} />,
    );
    expect(disabled(r, 'unshield-cta')).toBe(false);
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledTimes(2);
  });

  it('debounced 500 ms: a tap within 500 ms of the last one does nothing, even once re-enabled', async () => {
    const r = await screen({focusKey: 1});
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1');
    fireEvent.press(r.getByTestId('unshield-cta'));
    r.rerender(
      <ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} initialDirection="public" focusKey={2} />,
    );
    clock += 499;
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledTimes(1);
    clock += 1;
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledTimes(2);
  });
});

describe('#16 unshield — the note read (fix round 1, M-9)', () => {
  it('typing an amount does not re-read the note store; a new quote or a refocus does', async () => {
    const r = await screen();
    const before = mockNoteReads.n;
    expect(before).toBeGreaterThan(0); // non-vacuous: the source was read
    for (const t of ['1', '1.', '1.2', '1.25']) {
      fireEvent.changeText(r.getByTestId('unshield-amount-input'), t);
    }
    expect(mockNoteReads.n).toBe(before);
    r.rerender(
      <ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} initialDirection="public" focusKey={1} />,
    );
    expect(mockNoteReads.n).toBeGreaterThan(before);
  });
});

describe('#16 unshield — owner phone pass 2, 2026-11-21', () => {
  it('item 3: the card heading is "Summary" (it holds "Destination receives", not only fees); the fee row keeps its name', async () => {
    const r = await screen();
    expect(r.getByText('Summary')).toBeTruthy();
    expect(r.queryByText('Fees')).toBeNull();
    expect(r.getByText('Relayer fee')).toBeTruthy();
    expect(r.getByText('Destination receives')).toBeTruthy();
  });

  // item 8: the quote's fee is 10_000 base units = 0.00001 TEST; the hint shows when fee * 2 > amount
  it.each([
    ['fee = amount → shown', '0.00001', true],
    ['fee * 2 > amount (0.000015) → shown', '0.000015', true],
    ['fee * 2 == amount → not shown', '0.00002', false],
    ['fee * 2 < amount → not shown', '1', false],
  ])('item 8: the high-fee hint, %s; it never disables the CTA', async (_n, typed, shown) => {
    const r = await screen();
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), typed);
    if (shown) {
      expect(text(r, 'unshield-fee-high')).toBe('The fee is high for this amount.');
      expect(r.getByTestId('unshield-fee-high').props.className).toContain('text-warning');
    } else {
      expect(r.queryByTestId('unshield-fee-high')).toBeNull();
    }
    expect(disabled(r, 'unshield-cta')).toBe(false);
  });

  it('item 8: no quote → no hint, whatever the amount', async () => {
    mockQuote.mockRejectedValueOnce(Object.assign(new Error('E_A0_QUOTE_UNAVAILABLE: no answer'), {code: 'E_A0_QUOTE_UNAVAILABLE'}));
    const r = await screen();
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '0.00001');
    expect(r.queryByTestId('unshield-fee-high')).toBeNull();
  });

  it('item 8: no amount typed → no hint (a quote alone says nothing about this amount)', async () => {
    const r = await screen();
    expect(r.queryByTestId('unshield-fee-high')).toBeNull();
  });
});
