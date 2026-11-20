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
import {ShieldUnshieldScreen} from '../../ShieldUnshieldScreen';
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
  useWalletStore: () => ({tokenBalances: {}, solBalance: '1000000000', publicKey: mockMain}),
}));
let mockMain: string | null = null;

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
let mockScheme: TransparentScheme = {kind: 'slip10', account: 0};
jest.mock('../../../../modules/keyDerivation/derivationScheme', () => ({
  loadTransparentScheme: () => mockScheme,
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

describe('#16 — the direction tabs (spec §12: the unshield side is no longer hidden)', () => {
  it('both tabs; "Make public" flips to the unshield side, "Make private" back to the shield side — no route; the relayer is asked only once the unshield side opens', async () => {
    const r = render(<ShieldUnshieldScreen onBack={jest.fn()} onShield={jest.fn()} onUnshield={onUnshield} />);
    await act(async () => {});
    expect(mockQuote).not.toHaveBeenCalled(); // the shield side makes no relayer request
    expect(r.getByText('Make private')).toBeTruthy();
    expect(r.getByText('Make public')).toBeTruthy();
    expect(r.getByTestId('shield-cta')).toBeTruthy();
    expect(r.queryByTestId('unshield-cta')).toBeNull();
    fireEvent.press(r.getByLabelText('Make public'));
    await act(async () => {});
    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('unshield-cta')).toBeTruthy();
    expect(r.queryByTestId('shield-cta')).toBeNull();
    fireEvent.press(r.getByLabelText('Make private'));
    expect(r.getByTestId('shield-cta')).toBeTruthy();
  });

  it('initialDirection "public" opens the unshield side; the quote is asked once, on the devnet Connection', async () => {
    const r = await screen();
    expect(r.getByLabelText('Make public').props.accessibilityState?.selected).toBe(true);
    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockQuote.mock.calls[0]![0]).toEqual({rpc: 'devnet'});
  });
});

describe('#16 unshield — the design (states 2 and 5) and the A0 lines', () => {
  it('idle: Vault balance, the one-note limit, the relayed copy, the fee rows empty, CTA "Unshield TEST" disabled', async () => {
    const r = await screen();
    expect(text(r, 'unshield-vault')).toBe('2.5 TEST');
    expect(text(r, 'unshield-one-note')).toBe(
      'You can unshield up to 1.99999 TEST from one note at a time; combining notes comes in a later version.',
    );
    expect(text(r, 'unshield-relayed')).toBe(
      'The relayer pays for and submits this transaction, so no key of yours signs it. Amounts and timing are public.',
    );
    expect(r.getByText('Privacy decreases on public withdraw')).toBeTruthy();
    expect(r.getByText('Relayer fee')).toBeTruthy();
    expect(r.getByText('ZK proof fee')).toBeTruthy();
    expect(r.getByText('Unshield TEST')).toBeTruthy();
    expect(disabled(r, 'unshield-cta')).toBe(true);
  });

  it('amount entered: the relayer fee (token), the network fee paid by the relayer, the exact amount line', async () => {
    const r = await screen();
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.25');
    expect(r.getByText('0.00001 TEST')).toBeTruthy();
    expect(r.getByText('Paid by the relayer')).toBeTruthy();
    expect(r.getByText('None · made on this device')).toBeTruthy();
    expect(text(r, 'unshield-net')).toBe('1.25 TEST');
    expect(text(r, 'unshield-amount-line')).toBe(
      'The destination receives exactly 1.25 TEST. The relayer fee of 0.00001 TEST comes out of your shielded balance.',
    );
    expect(r.getByText('Unshield 1.25 TEST')).toBeTruthy();
    expect(disabled(r, 'unshield-cta')).toBe(false); // the fresh account is preselected
  });

  it('MAX = the largest note minus the fee (§6 step 2), exact; one base unit more → the helper, CTA disabled', async () => {
    const r = await screen();
    fireEvent.press(r.getByLabelText('Max'));
    expect(r.getByTestId('unshield-amount-input').props.value).toBe('1.99999');
    expect(disabled(r, 'unshield-cta')).toBe(false);
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.999990001');
    expect(text(r, 'unshield-over-max')).toBe('Max per unshield: 1.99999 TEST (your largest note, minus the relayer fee)');
    expect(disabled(r, 'unshield-cta')).toBe(true);
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).not.toHaveBeenCalled();
  });

  it('no note can pay the fee → said, CTA disabled (a pending note is never a source)', async () => {
    mockNotes = [note(10_000n, 1), note(5_000_000_000n, 2, 'pending')];
    const r = await screen();
    expect(text(r, 'unshield-no-note')).toBe('No shielded note can pay the relayer fee of 0.00001 TEST.');
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '0.000000001');
    expect(disabled(r, 'unshield-cta')).toBe(true);
  });
});

describe('#16 unshield — the destination choice (undrawn; spec §11, S3 / S9 / S11, ruling 4)', () => {
  it('a granting quote: "A new account" PRESELECTED with the §11 default and the grant in SOL', async () => {
    const r = await screen();
    expect(selected(r, 'unshield-dest-fresh')).toBe(true);
    expect(selected(r, 'unshield-dest-main')).toBe(false);
    expect(text(r, 'unshield-dest-fresh-sub')).toBe(
      'A new account of this wallet receives it. The relayer also sends it 0.003 SOL so it can pay for its own transactions.',
    );
  });

  it('S11 (ruling 4, the Jest proof of "visible, disabled"): a quote WITHOUT a grant → fresh disabled with its reason, nothing preselected, the CTA disabled until a choice', async () => {
    mockQuote.mockResolvedValue(quote({gasGrantLamports: null, grantFloorLamports: null}));
    const r = await screen();
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
    fireEvent.press(r.getByTestId('unshield-dest-main'));
    expect(disabled(r, 'unshield-cta')).toBe(false);
  });

  it('S9: a cli wallet → fresh disabled with the cli reason, even when the quote grants', async () => {
    mockScheme = {kind: 'cli'};
    const r = await screen();
    expect(disabled(r, 'unshield-dest-fresh')).toBe(true);
    expect(selected(r, 'unshield-dest-fresh')).toBe(false);
    expect(text(r, 'unshield-dest-fresh-sub')).toBe(
      'This wallet uses the Solana CLI key scheme, which has a single account, so no new account can be created for this exit.',
    );
  });

  it('"My main account" → the link warning (§11 verbatim) and the main address; the request carries {kind: "main"}', async () => {
    const r = await screen();
    expect(r.queryByTestId('unshield-warning-main')).toBeNull();
    fireEvent.press(r.getByTestId('unshield-dest-main'));
    expect(text(r, 'unshield-warning-main')).toBe('This links your exit to your deposit: your main account made the deposit.');
    expect(text(r, 'unshield-dest-main-sub')).toBe(`${MAIN.slice(0, 6)}…${MAIN.slice(-6)}`);
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '0.5');
    fireEvent.press(r.getByTestId('unshield-cta'));
    expect(onUnshield).toHaveBeenCalledWith({destination: {kind: 'main'}, amount: '500000000'});
  });

  it('"Another address" → the payment warning (§11 verbatim), the input; a valid wallet address → {kind: "external", owner}', async () => {
    const r = await screen();
    fireEvent.press(r.getByTestId('unshield-dest-external'));
    expect(text(r, 'unshield-warning-external')).toBe('This is a payment from your shielded balance. The recipient sees the amount.');
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
    fireEvent.press(r.getByTestId('unshield-dest-external'));
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
    expect(selected(r, 'unshield-dest-fresh')).toBe(false); // no quote, no offer
    await act(async () => {
      fireEvent.press(r.getByTestId('unshield-quote-retry'));
    });
    expect(selected(r, 'unshield-dest-fresh')).toBe(true);
    fireEvent.press(r.getByTestId('unshield-dest-main'));
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1'); // re-renders
    fireEvent.changeText(r.getByTestId('unshield-amount-input'), '1.5');
    expect(selected(r, 'unshield-dest-main')).toBe(true);
    expect(selected(r, 'unshield-dest-fresh')).toBe(false);
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
    expect(disabled(r, 'unshield-dest-main')).toBe(true);
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
    expect(selected(r, 'unshield-dest-fresh')).toBe(true);
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
