/**
 * Phone pass 2 fix round 1 (review M-4): `a0PrivateBalanceNow()` read against the REAL note store
 * (the real encrypted MMKV instance of the test environment, the real store writes the flows
 * call), with nothing between them mocked. The screen tests mock the read; this file holds the
 * ordering they rely on: once `confirmA0Deposit` (the deposit's landing) or `settleA0Unshield`
 * (an exit's landing) has returned, the very next read is the new total.
 *
 * Only the startup phase (it is 'ready' here: the restore is not under test), the feature flag and
 * the prover probe are stubbed, plus the hook module's own network / keychain imports.
 */
import {clearAllStores, initSecureMmkv} from '../../store/mmkv/instances';
import {
  addA0PendingDeposit,
  confirmA0Deposit,
  markA0PendingUnshield,
  mergeA0RecoveredNotes,
  settleA0Unshield,
} from '../../modules/shielded/a0/noteStore';
import type {A0Note, A0PendingUnshield} from '../../modules/shielded/a0/noteStore';
import {TEST_SEED} from '../../modules/shielded/a0/__testing__/offlineA0';
import type {A0StartupState} from '../../modules/shielded/a0/startup';
import {a0PrivateBalanceNow} from '../useA0Shielded';

jest.mock('../../constants/features', () => ({isShieldedEnabled: () => true}));
jest.mock('../../modules/zkProver/nativeProverBridge', () => ({isProverSupported: () => true}));
let mockState: A0StartupState = {phase: 'idle'};
jest.mock('../../modules/shielded/a0/startup', () => ({
  a0StartupState: () => mockState,
  subscribeA0Startup: () => () => undefined,
  ensureA0Startup: jest.fn(),
}));
jest.mock('../../modules/keychain/keychainModule', () => ({keychainManager: {retrieveSeed: jest.fn()}}));
jest.mock('../../modules/keyDerivation/mnemonicUtils', () => ({mnemonicToSeed: jest.fn()}));
jest.mock('../../modules/solana/connection', () => ({getConnection: () => ({rpc: 'fake'})}));
jest.mock('../../modules/shielded/a0/depositFlow', () => ({reconcileA0PendingDeposits: jest.fn()}));
jest.mock('../../modules/shielded/a0/unshieldFlow', () => ({
  a0HasPendingUnshields: () => false,
  reconcileA0PendingUnshields: jest.fn(),
}));

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

const N0 = TEST_SEED.notes[0]!;
const N1 = TEST_SEED.notes[1]!;
const N2 = TEST_SEED.notes[2]!;
const cm = (n: typeof N0, amount: string) => n.commitments.find(c => c.amount === amount)!.commitment;

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  mockState = READY;
});

describe('a0PrivateBalanceNow over the real note store (phone pass 2 fix round 1, M-4)', () => {
  it('a deposit: pending does not count; the read right after confirmA0Deposit returns is the new total', () => {
    expect(a0PrivateBalanceNow()).toBe(0n);
    addA0PendingDeposit({commitment: cm(N0, '1000000000'), amount: 1_000_000_000n, rho: N0.rho, depositIndex: 0n, lastValidBlockHeight: 400_000_123});
    expect(a0PrivateBalanceNow()).toBe(0n); // pending is not the private balance (the dashboard's rule)
    confirmA0Deposit(N0.rho, {leafIndex: 17, commitment: cm(N0, '1000000000')});
    expect(a0PrivateBalanceNow()).toBe(1_000_000_000n);
  });

  it('an exit: the read right after settleA0Unshield returns is the total AFTER it — the other notes plus the change, not the change alone', () => {
    const unspent = (n: typeof N0, i: bigint, leafIndex: number): A0Note => ({
      commitment: cm(n, '1000000000'),
      amount: 1_000_000_000n,
      rho: n.rho,
      depositIndex: i,
      leafIndex,
      status: 'unspent',
    });
    mergeA0RecoveredNotes([unspent(N0, 0n, 17), unspent(N2, 1n, 19)], 2n);
    expect(a0PrivateBalanceNow()).toBe(2_000_000_000n);
    const intent: A0PendingUnshield = {
      owner: 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb',
      amount: 400_000n,
      fee: 10_000n,
      feePayer: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe',
      gasGrantLamports: 3_000_000n,
      destination: 'fresh',
      scheme: 'slip10:1',
    };
    markA0PendingUnshield(N0.rho, 1, intent);
    expect(a0PrivateBalanceNow()).toBe(1_000_000_000n); // the note in flight is not counted
    settleA0Unshield(N0.rho, '47k56NfB' + '2'.repeat(80), {commitment: cm(N1, '1000000000'), amount: 999_590_000n, rho: N1.rho, leafIndex: 18});
    expect(a0PrivateBalanceNow()).toBe(1_999_590_000n); // N2 + the change
  });

  it('control: the same store, the startup not ready → null (never the store sum)', () => {
    mergeA0RecoveredNotes(
      [{commitment: cm(N0, '1000000000'), amount: 1_000_000_000n, rho: N0.rho, depositIndex: 0n, leafIndex: 17, status: 'unspent'}],
      1n,
    );
    mockState = {phase: 'running'};
    expect(a0PrivateBalanceNow()).toBeNull();
  });
});
