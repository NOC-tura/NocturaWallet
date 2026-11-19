/**
 * The shielded balance as the screens may state it: the note store's sums ONLY in the startup
 * step's 'ready' phase; every other phase is a state, never a 0 (Task 4's rule for the screens).
 */
import React from 'react';
import {Text} from 'react-native';
import {render, act, fireEvent} from '@testing-library/react-native';
import {a0ShieldedView, a0UnshieldCheckOf, a0UnshieldDecisionFor, checkA0PendingAgain, retryA0Startup, useA0Shielded} from '../useA0Shielded';
import type {A0UnshieldReconcileReport} from '../../modules/shielded/a0/unshieldFlow';
import type {A0StartupState} from '../../modules/shielded/a0/startup';
import type {A0Note} from '../../modules/shielded/a0/noteStore';

let mockEnabled = true;
let mockSupported = true;
jest.mock('../../constants/features', () => ({isShieldedEnabled: () => mockEnabled}));
jest.mock('../../modules/zkProver/nativeProverBridge', () => ({isProverSupported: () => mockSupported}));
let mockNotes: A0Note[] | Error = [];
jest.mock('../../modules/shielded/a0/noteStore', () => ({
  loadA0NoteStore: () => {
    if (mockNotes instanceof Error) throw mockNotes;
    return {nextDepositIndex: 0n, notes: mockNotes};
  },
}));
let mockState: A0StartupState = {phase: 'idle'};
const mockListeners = new Set<(s: A0StartupState) => void>();
const mockEnsure = jest.fn();
jest.mock('../../modules/shielded/a0/startup', () => ({
  a0StartupState: () => mockState,
  subscribeA0Startup: (l: (s: A0StartupState) => void) => {
    mockListeners.add(l);
    return () => mockListeners.delete(l);
  },
  ensureA0Startup: (...a: unknown[]) => mockEnsure(...a),
}));
const mockRetrieve = jest.fn();
jest.mock('../../modules/keychain/keychainModule', () => ({keychainManager: {retrieveSeed: () => mockRetrieve()}}));
jest.mock('../../modules/keyDerivation/mnemonicUtils', () => ({mnemonicToSeed: async () => new Uint8Array(64).fill(3)}));
jest.mock('../../modules/solana/connection', () => ({getConnection: () => ({rpc: 'fake'})}));
/** the encrypted instance open now (an opaque object: the binding is by identity) */
const mockInstance: {current: object | null} = {current: {instance: 'A'}};
jest.mock('../../store/mmkv/instances', () => ({mmkvSecure: () => mockInstance.current}));
const mockReconcile = jest.fn();
jest.mock('../../modules/shielded/a0/depositFlow', () => ({
  reconcileA0PendingDeposits: (...a: unknown[]) => mockReconcile(...a),
}));
let mockPendingUnshields = false;
const mockReconcileUnshields = jest.fn();
jest.mock('../../modules/shielded/a0/unshieldFlow', () => ({
  a0HasPendingUnshields: () => mockPendingUnshields,
  reconcileA0PendingUnshields: (...a: unknown[]) => mockReconcileUnshields(...a),
}));

const note = (amount: bigint, status: A0Note['status']): A0Note => ({commitment: 'c', amount, rho: 'r', status});
const READY: A0StartupState = {
  phase: 'ready',
  result: {
    restoredBecause: null,
    restore: null,
    reconcile: {confirmed: [], dropped: [], stillPending: [], skipped: 0},
    unshields: {settled: [], reverted: [], stillPending: [], skipped: 0, released: [], promoted: []},
    seedKeys: null,
  },
};

beforeEach(() => {
  mockEnabled = true;
  mockSupported = true;
  mockNotes = [note(1_000n, 'unspent'), note(250n, 'unspent'), note(40n, 'pending'), note(9_999n, 'spent')];
  mockState = {phase: 'idle'};
  mockListeners.clear();
  mockEnsure.mockReset();
  mockRetrieve.mockReset().mockResolvedValue('words');
  mockInstance.current = {instance: 'A'};
  mockReconcile.mockReset().mockResolvedValue({confirmed: [], dropped: [], stillPending: [], skipped: 0});
  mockPendingUnshields = false;
  mockReconcileUnshields.mockReset().mockResolvedValue({settled: [], reverted: [], stillPending: [], skipped: 0, released: [], promoted: []});
});

describe('a0ShieldedView', () => {
  it('ready: unspent and pending sums from the store; spent notes count for nothing', () => {
    expect(a0ShieldedView(READY)).toEqual({kind: 'ready', unspent: 1_250n, pending: 40n, notes: 2});
  });

  it.each([
    [{phase: 'idle'} as A0StartupState, {kind: 'idle'}],
    [{phase: 'running'} as A0StartupState, {kind: 'running'}],
    [{phase: 'error', code: 'E_A0_SYNC_RPC', message: 'timeout'} as A0StartupState, {kind: 'error', code: 'E_A0_SYNC_RPC', message: 'timeout'}],
  ])('%j → %j — the store is NOT read before the restore finished', (state, view) => {
    mockNotes = new Error('must not be read');
    expect(a0ShieldedView(state)).toEqual(view);
  });

  it('ready but the store refuses: an error with its code, not a 0', () => {
    mockNotes = Object.assign(new Error('E_A0_STORE_CORRUPT: bad record'), {code: 'E_A0_STORE_CORRUPT'});
    expect(a0ShieldedView(READY)).toEqual({kind: 'error', code: 'E_A0_STORE_CORRUPT', message: 'bad record'});
  });

  it('unsupported: no shielded in the build, or no prover — whatever the phase', () => {
    mockSupported = false;
    expect(a0ShieldedView(READY)).toEqual({kind: 'unsupported'});
    mockSupported = true;
    mockEnabled = false;
    expect(a0ShieldedView(READY)).toEqual({kind: 'unsupported'});
  });
});

describe('useA0Shielded', () => {
  it('follows the startup state live: running → ready', () => {
    mockState = {phase: 'running'};
    const Probe = () => {
      const {view} = useA0Shielded();
      return <Text testID="v">{view.kind === 'ready' ? `ready ${view.unspent}` : view.kind}</Text>;
    };
    const r = render(<Probe />);
    expect(r.getByTestId('v').props.children).toBe('running');
    act(() => {
      mockState = READY;
      mockListeners.forEach(l => l(READY));
    });
    expect(r.getByTestId('v').props.children).toBe('ready 1250');
  });
});

describe('retryA0Startup', () => {
  it('reads the seed once and hands it to ensureA0Startup', async () => {
    mockEnsure.mockResolvedValue({phase: 'running'});
    expect(await retryA0Startup()).toEqual({phase: 'running'});
    expect(mockRetrieve).toHaveBeenCalledTimes(1);
    expect(mockEnsure).toHaveBeenCalledWith({rpc: 'fake'}, new Uint8Array(64).fill(3));
  });

  it('a refused keychain read is an error state (never a rejection)', async () => {
    mockRetrieve.mockRejectedValue(new Error('User canceled the operation.'));
    expect(await retryA0Startup()).toEqual({phase: 'error', code: null, message: 'User canceled the operation.'});
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it('unsupported: no keychain read, no startup', async () => {
    mockSupported = false;
    await retryA0Startup();
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(mockEnsure).not.toHaveBeenCalled();
  });
});

describe('R1-m9 / R2-N2 / R3-N5: "Check again" on a pending deposit', () => {
  const EMPTY = {confirmed: [], dropped: [], stillPending: [], skipped: 0};
  const EMPTY_U = {settled: [], reverted: [], stillPending: [], skipped: 0, released: [], promoted: []};

  it('runs reconcileA0PendingDeposits bound to the instance open NOW (no seed, no keychain read)', async () => {
    const open = mockInstance.current;
    mockState = READY;
    expect(await checkA0PendingAgain()).toEqual({status: 'done', report: EMPTY, unshields: EMPTY_U});
    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith({rpc: 'fake'}, {bound: open});
    expect(mockReconcile.mock.calls[0]![1].bound).toBe(open);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('M1c: no pending unshield → the unshields\' reconciliation runs WITHOUT the seed (null), bound to the same instance; no keychain read', async () => {
    const open = mockInstance.current;
    mockState = READY;
    await checkA0PendingAgain();
    expect(mockReconcileUnshields).toHaveBeenCalledTimes(1);
    expect(mockReconcileUnshields.mock.calls[0]![1]).toBeNull();
    expect(mockReconcileUnshields.mock.calls[0]![2].bound).toBe(open);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('M1c: a pending unshield → ONE keychain read, its seed handed to the unshields\' reconciliation', async () => {
    mockState = READY;
    mockPendingUnshields = true;
    await checkA0PendingAgain();
    expect(mockRetrieve).toHaveBeenCalledTimes(1);
    const seed = mockReconcileUnshields.mock.calls[0]![1] as Uint8Array;
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed).toHaveLength(64);
  });

  it('M1c: a refused keychain read is a result with its code, never a rejection', async () => {
    mockState = READY;
    mockPendingUnshields = true;
    mockRetrieve.mockRejectedValue(Object.assign(new Error('E_KEYCHAIN_CANCELLED: no'), {code: 'E_KEYCHAIN_CANCELLED'}));
    expect(await checkA0PendingAgain()).toEqual({status: 'error', code: 'E_KEYCHAIN_CANCELLED', message: 'no'});
    expect(mockReconcileUnshields).not.toHaveBeenCalled();
  });

  it('refused while the startup step is running (busy): no reconcile', async () => {
    mockState = {phase: 'running'};
    expect(await checkA0PendingAgain()).toEqual({status: 'busy'});
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('a reconcile refusal (e.g. E_A0_STORE_CHANGED) is a result with its code, never a rejection', async () => {
    mockState = READY;
    mockReconcile.mockRejectedValue(Object.assign(new Error('E_A0_STORE_CHANGED: replaced'), {code: 'E_A0_STORE_CHANGED'}));
    expect(await checkA0PendingAgain()).toEqual({status: 'error', code: 'E_A0_STORE_CHANGED', message: 'replaced'});
  });

  it('two taps while one runs → one reconcile', async () => {
    mockState = READY;
    const [a, b] = await Promise.all([checkA0PendingAgain(), checkA0PendingAgain()]);
    expect(a).toEqual(b);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  const Probe = () => {
    const {view, checkAgain} = useA0Shielded();
    return (
      <>
        <Text testID="v">{view.kind === 'ready' ? `ready ${view.unspent} ${view.pending}` : view.kind}</Text>
        <Text testID="disabled">{String(checkAgain.disabled)}</Text>
        <Text testID="note">{checkAgain.note ?? ''}</Text>
        <Text testID="run" onPress={checkAgain.run}>
          run
        </Text>
      </>
    );
  };

  it('on completion the screen\'s store read is refreshed: the confirmed note moves from pending to the balance', async () => {
    mockState = READY;
    mockNotes = [note(1_000n, 'unspent'), note(40n, 'pending')];
    mockReconcile.mockImplementation(async () => {
      mockNotes = [note(1_000n, 'unspent'), note(40n, 'unspent')]; // the reconcile confirmed it
      return {confirmed: [{rho: 'r', leafIndex: 17, signature: 's'}], dropped: [], stillPending: [], skipped: 0};
    });
    const r = render(<Probe />);
    expect(r.getByTestId('v').props.children).toBe('ready 1000 40');
    await act(async () => {
      fireEvent.press(r.getByTestId('run'));
    });
    expect(r.getByTestId('v').props.children).toBe('ready 1040 0');
    expect(r.getByTestId('note').props.children).toBe('');
  });

  it('disabled while the startup step is running; a still-pending note says so; an error shows its code', async () => {
    mockState = {phase: 'running'};
    const r = render(<Probe />);
    expect(r.getByTestId('disabled').props.children).toBe('true');
    await act(async () => {
      fireEvent.press(r.getByTestId('run'));
    });
    expect(mockReconcile).not.toHaveBeenCalled();
    act(() => {
      mockState = READY;
      mockListeners.forEach(l => l(READY));
    });
    expect(r.getByTestId('disabled').props.children).toBe('false');
    mockReconcile.mockResolvedValue({confirmed: [], dropped: [], stillPending: [{rho: 'r', reason: 'not-expired'}], skipped: 0});
    await act(async () => {
      fireEvent.press(r.getByTestId('run'));
    });
    expect(r.getByTestId('note').props.children).toBe('Still not confirmed · checked just now.');
    mockReconcile.mockRejectedValue(Object.assign(new Error('E_A0_SYNC_RPC: timeout'), {code: 'E_A0_SYNC_RPC'}));
    await act(async () => {
      fireEvent.press(r.getByTestId('run'));
    });
    // final review M-4: where a code exists, the code + a fixed sentence — never the raw message
    expect(r.getByTestId('note').props.children).toBe('E_A0_SYNC_RPC · The check could not finish. Check again in a moment.');
    mockReconcile.mockRejectedValue(new Error('request to https://rpc.example/?api-key=SECRET failed'));
    await act(async () => {
      fireEvent.press(r.getByTestId('run'));
    });
    // no code: the raw message is all there is (the ruling's one exception)
    expect(r.getByTestId('note').props.children).toBe('request to https://rpc.example/?api-key=SECRET failed');
  });
});

describe('final review I-1: a reconciliation\'s result reaches the screens', () => {
  const report = (over: Partial<A0UnshieldReconcileReport>): A0UnshieldReconcileReport => ({
    settled: [],
    reverted: [],
    stillPending: [],
    skipped: 0,
    released: [],
    promoted: [],
    ...over,
  });
  const ok = {rho: 'r', signature: 'S1', verified: true, code: null, changeRecorded: true};
  const refused = {rho: 'r2', signature: 'S2', verified: false, code: 'E_A0_VERIFY_SEED_SIGNER' as const, changeRecorded: true};

  it('a0UnshieldCheckOf: a refusal first, then still pending, then settled, then reverted; nothing → null', () => {
    expect(a0UnshieldCheckOf(report({settled: [ok, refused], reverted: [{rho: 'x'}], stillPending: [{rho: 'y', reason: 'in-window'}]}))).toEqual({
      kind: 'unverified',
      code: 'E_A0_VERIFY_SEED_SIGNER',
    });
    expect(a0UnshieldCheckOf(report({settled: [ok], stillPending: [{rho: 'y', reason: 'in-window'}]}))).toEqual({kind: 'pending'});
    expect(a0UnshieldCheckOf(report({settled: [ok], reverted: [{rho: 'x'}]}))).toEqual({kind: 'settled', verified: true});
    expect(a0UnshieldCheckOf(report({reverted: [{rho: 'x'}]}))).toEqual({kind: 'reverted'});
    expect(a0UnshieldCheckOf(report({}))).toBeNull();
    // an intent-less settle (recovery's rules: verified false with NO code) is settled, not a refusal
    expect(a0UnshieldCheckOf(report({settled: [{...ok, verified: false}]}))).toEqual({kind: 'settled', verified: false});
  });

  it('re-review N-1: a0UnshieldDecisionFor reads ONE note by its rho — another note\'s settle / revert / refusal is null for it', () => {
    const r = report({settled: [ok, refused], reverted: [{rho: 'x'}], stillPending: [{rho: 'y', reason: 'in-window'}]});
    expect(a0UnshieldDecisionFor(r, 'r')).toEqual({kind: 'settled', verified: true});
    expect(a0UnshieldDecisionFor(r, 'r2')).toEqual({kind: 'unverified', code: 'E_A0_VERIFY_SEED_SIGNER'});
    expect(a0UnshieldDecisionFor(r, 'x')).toEqual({kind: 'reverted'});
    expect(a0UnshieldDecisionFor(r, 'y')).toEqual({kind: 'pending'});
    expect(a0UnshieldDecisionFor(r, 'z')).toBeNull();
    expect(a0UnshieldDecisionFor(report({settled: [{...ok, verified: false}]}), 'r')).toEqual({kind: 'settled', verified: false});
  });

  it('N-4: a settle by recovery\'s rules (no intent) is captioned as what it is, not "verified"', async () => {
    mockState = READY;
    mockReconcileUnshields.mockResolvedValue(report({settled: [{...ok, verified: false}]}));
    const r = render(<Probe />);
    await tap(r);
    expect(r.getByTestId('note').props.children).toBe('Settled from the chain · unshielded.');
  });

  it('N-1: the last check\'s unshield report is exposed for a per-note reading (null before any check)', async () => {
    mockState = READY;
    const rep = report({settled: [ok]});
    mockReconcileUnshields.mockResolvedValue(rep);
    const r = render(<Probe />);
    expect(r.getByTestId('report').props.children).toBe('null');
    await tap(r);
    expect(r.getByTestId('report').props.children).toBe('settled r');
  });

  const Probe = () => {
    const {checkAgain, refusal} = useA0Shielded();
    return (
      <>
        <Text testID="note">{checkAgain.note ?? ''}</Text>
        <Text testID="unshield">{JSON.stringify(checkAgain.unshield)}</Text>
        <Text testID="refusal">{refusal ?? ''}</Text>
        <Text testID="report">{checkAgain.report ? `settled ${checkAgain.report.settled.map(x => x.rho).join(',')}` : 'null'}</Text>
        <Text testID="run" onPress={checkAgain.run}>
          run
        </Text>
      </>
    );
  };
  const tap = async (r: ReturnType<typeof render>) =>
    act(async () => {
      fireEvent.press(r.getByTestId('run'));
    });

  it.each<[string, Partial<A0UnshieldReconcileReport>, string, string]>([
    ['settled + verified', {settled: [ok]}, 'Confirmed · unshielded.', '{"kind":"settled","verified":true}'],
    ['reverted', {reverted: [{rho: 'r'}], released: ['slip10:1']}, 'Not sent · your note is back in your shielded balance.', '{"kind":"reverted"}'],
    ['still pending', {stillPending: [{rho: 'r', reason: 'in-window'}]}, 'Still not confirmed · checked just now.', '{"kind":"pending"}'],
    ['a verifier refusal', {settled: [refused]}, 'Checked just now · it landed, but failed verification.', '{"kind":"unverified","code":"E_A0_VERIFY_SEED_SIGNER"}'],
  ])('"Check again" that finds %s says so (the note and the typed result)', async (_l, over, text, typed) => {
    mockState = READY;
    mockReconcileUnshields.mockResolvedValue(report(over));
    const r = render(<Probe />);
    await tap(r);
    expect(r.getByTestId('note').props.children).toBe(text);
    expect(r.getByTestId('unshield').props.children).toBe(typed);
  });

  it('a refusal found by "Check again" is LOUD for the session of this wallet — on every screen that mounts after it, by its CODE only', async () => {
    mockState = READY;
    mockReconcileUnshields.mockResolvedValue(report({settled: [{...refused, detail: 'seed key SENTINELKEY'} as A0UnshieldReconcileReport['settled'][number]]}));
    const r = render(<Probe />);
    expect(r.getByTestId('refusal').props.children).toBe('');
    await tap(r);
    expect(r.getByTestId('refusal').props.children).toBe('E_A0_VERIFY_SEED_SIGNER');
    expect(JSON.stringify(r.toJSON())).not.toContain('SENTINELKEY');
    r.unmount();
    const again = render(<Probe />); // e.g. the dashboard after #21's Done
    expect(again.getByTestId('refusal').props.children).toBe('E_A0_VERIFY_SEED_SIGNER');
    again.unmount();
    mockInstance.current = {instance: 'B'}; // a wipe + import: another wallet
    expect(render(<Probe />).getByTestId('refusal').props.children).toBe('');
  });

  it('a refusal the STARTUP step found is LOUD too (code only); a startup with none says nothing', () => {
    mockState = {...READY, result: {...READY.result, unshields: report({settled: [ok, refused]})}} as A0StartupState;
    expect(render(<Probe />).getByTestId('refusal').props.children).toBe('E_A0_VERIFY_SEED_SIGNER');
    mockState = {...READY, result: {...READY.result, unshields: report({settled: [ok]})}} as A0StartupState;
    expect(render(<Probe />).getByTestId('refusal').props.children).toBe('');
  });
});
