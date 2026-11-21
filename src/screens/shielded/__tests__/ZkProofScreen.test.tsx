/**
 * #18 for the A0 deposit: the four rows are driven ONLY by `prepareA0Deposit`'s `onStage` (no
 * timer advances a row, no percentage is drawn), each row shows its measured time, a failure marks
 * its row and shows the E_A0_* code, there is no hosted prover, and Ready hands a ShieldIntent to
 * #19 after 400 ms with the prepared deposit held under its id.
 */
import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {ZkProofScreen} from '../ZkProofScreen';
import type {A0PrepareStage, A0PreparedDeposit} from '../../../modules/shielded/a0/depositFlow';
import {preparedA0Deposit, resetPreparedA0DepositsForTests} from '../../../modules/shielded/a0/screenSupport';
import type {ShieldIntent} from '../../../types/shield';

type Prepare = (c: unknown, seed: Uint8Array, amount: bigint, o: {onStage: (s: A0PrepareStage) => void}) => Promise<A0PreparedDeposit>;
const mockPrepare = jest.fn<ReturnType<Prepare>, Parameters<Prepare>>();
jest.mock('../../../modules/shielded/a0/depositFlow', () => ({
  prepareA0Deposit: (...a: Parameters<Prepare>) => mockPrepare(...a),
}));
const SEED = new Uint8Array(64).fill(7);
const mockRetrieve = jest.fn();
jest.mock('../../../modules/keychain/keychainModule', () => ({
  keychainManager: {retrieveSeed: () => mockRetrieve()},
}));
jest.mock('../../../modules/keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn(async () => new Uint8Array(64).fill(7)),
}));
jest.mock('../../../modules/solana/connection', () => ({getConnection: () => ({rpc: 'fake'})}));

// I-1 (final review): the first test pays the suite's first render — React Native's lazy component
// modules, lucide and nativewind loaded on first use (~0.4 s solo, 7.7 s measured under the full
// run's contention) — so Jest's 5 s default made a full run red on a test that proves nothing.
jest.setTimeout(30_000);

const PREPARED: A0PreparedDeposit = {
  amount: 5_000_000_000n,
  depositIndex: 3n,
  rho: 'ab'.repeat(32),
  commitment: 'cd'.repeat(32),
  proof: new Uint8Array(256),
  depositor: 'Depositor1111111111111111111111111111111111',
  depositorTokenAccount: 'TokenAcct1111111111111111111111111111111111',
  importedNotes: 0,
  foreignRhoHits: 0,
};

/** A prepare the test drives: `stage(s)` reports a stage, `resolve` / `reject` end it. */
function controlledPrepare() {
  const ctl: {
    onStage: ((s: A0PrepareStage) => void) | null;
    resolve: (p: A0PreparedDeposit) => void;
    reject: (e: unknown) => void;
    args: Parameters<Prepare> | null;
  } = {onStage: null, resolve: () => {}, reject: () => {}, args: null};
  mockPrepare.mockImplementation((...args) => {
    ctl.args = args;
    ctl.onStage = args[3].onStage;
    return new Promise((res, rej) => {
      ctl.resolve = res;
      ctl.reject = rej;
    });
  });
  return ctl;
}

const onReady = jest.fn<void, [ShieldIntent]>();
const onCancel = jest.fn();
const AMOUNT = '5000000000';

beforeEach(() => {
  jest.useFakeTimers({now: 1_700_000_000_000});
  mockPrepare.mockReset();
  mockRetrieve.mockReset().mockResolvedValue('mnemonic words');
  onReady.mockReset();
  onCancel.mockReset();
  resetPreparedA0DepositsForTests();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const meta = (r: ReturnType<typeof render>, n: number) => r.getByTestId(`zk-stage-${n}-meta`).props.children as string;
const status = (r: ReturnType<typeof render>, n: number) => r.getByTestId(`zk-stage-${n}`).props.accessibilityLabel as string;
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
const stage = async (ctl: ReturnType<typeof controlledPrepare>, s: A0PrepareStage, afterMs = 0) => {
  if (afterMs) {
    await act(async () => {
      jest.advanceTimersByTime(afterMs);
    });
  }
  await act(async () => {
    ctl.onStage!(s);
  });
};
const noPercent = (r: ReturnType<typeof render>) => {
  expect(r.queryAllByText(/\d\s?%/)).toHaveLength(0);
};

describe('#18 — the real stage sequence', () => {
  it('auth → checking/keyFiles/precheck/commitment (row 1) → proving (row 2) → verifying (row 3) → Ready (row 4); measured times; no %', async () => {
    const ctl = controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    expect(r.getByTestId('zk-hero').props.children).toBe('Preparing proof');
    expect(meta(r, 1)).toBe('waiting for you to unlock');
    await flush();
    // the seed came from the keychain; the amount is the BigInt of the param
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(ctl.args![1]).toEqual(SEED);
    expect(ctl.args![2]).toBe(5_000_000_000n);

    await stage(ctl, 'checking');
    expect(r.getByTestId('zk-hero').props.children).toBe('Preparing'); // part B: "Building witness" → "Preparing"
    expect(status(r, 1)).toBe('Prepare: active'); // part B: "Build witness" → "Prepare"
    expect(meta(r, 1)).toBe('checking the network and your account · 0.0 s');
    expect(status(r, 2)).toBe('Make the proof: pending'); // part B: "Prove" → "Make the proof"
    noPercent(r);

    await stage(ctl, 'keyFiles', 1000);
    expect(meta(r, 1)).toBe('loading the proving key files · 1.0 s');
    await stage(ctl, 'precheck', 500);
    expect(meta(r, 1)).toMatch(/^checking the deposit counter on chain · 1\.5 s$/);
    await stage(ctl, 'precheck', 300); // a hit repeats precheck — still row 1
    await stage(ctl, 'commitment', 300);
    expect(status(r, 1)).toBe('Prepare: active'); // part B: "Build witness" → "Prepare"
    expect(status(r, 2)).toBe('Make the proof: pending'); // part B: "Prove" → "Make the proof"

    // no timer advances a row: 60 s without a stage leaves everything where it is
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(status(r, 2)).toBe('Make the proof: pending'); // part B: "Prove" → "Make the proof"
    expect(r.getByTestId('zk-hero').props.children).toBe('Preparing'); // part B: "Building witness" → "Preparing"
    expect(meta(r, 1)).toBe('computing the note commitment · 62.1 s');

    await stage(ctl, 'proving');
    expect(r.getByTestId('zk-hero').props.children).toBe('Making the proof'); // part B: "Proving" → "Making the proof"
    expect(status(r, 1)).toBe('Prepare: done'); // part B: "Build witness" → "Prepare"
    expect(meta(r, 1)).toBe('done · 62.1 s');
    expect(status(r, 2)).toBe('Make the proof: active'); // part B: "Prove" → "Make the proof"

    await stage(ctl, 'verifying', 12_100);
    expect(r.getByTestId('zk-hero').props.children).toBe('Checking the proof'); // part B: "Verifying" → "Checking the proof"
    expect(meta(r, 2)).toBe('done · 12.1 s');
    expect(status(r, 3)).toBe('Check the proof: active'); // part B: "Verify locally" → "Check the proof"
    noPercent(r);

    await act(async () => {
      jest.advanceTimersByTime(400);
      ctl.resolve(PREPARED);
    });
    await flush();
    expect(r.getByTestId('zk-hero').props.children).toBe('Proof ready');
    expect(meta(r, 3)).toBe('done · 0.4 s');
    expect(status(r, 4)).toBe('Ready: done');
    expect(meta(r, 4)).toBe('ready');
    noPercent(r);
  });

  it('Ready → #19 after 400 ms (not before) with a ShieldIntent naming the held deposit', async () => {
    const ctl = controlledPrepare();
    render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    await flush();
    await stage(ctl, 'checking');
    await act(async () => {
      ctl.resolve(PREPARED);
    });
    await flush();
    await act(async () => {
      jest.advanceTimersByTime(399);
    });
    expect(onReady).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(onReady).toHaveBeenCalledTimes(1);
    const intent = onReady.mock.calls[0]![0];
    expect(intent).toEqual({
      kind: 'shield',
      preparedId: expect.any(String),
      amount: AMOUNT,
      tokenSymbol: 'TEST',
      decimals: 9,
      depositor: PREPARED.depositor,
    });
    expect(preparedA0Deposit(intent.preparedId)).toBe(PREPARED);
  });

  it('a re-render with a new onReady does NOT start a second prepare (one proof per attempt)', async () => {
    controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    await flush();
    r.rerender(<ZkProofScreen amount={AMOUNT} onReady={jest.fn()} onCancel={onCancel} />);
    await flush();
    expect(mockPrepare).toHaveBeenCalledTimes(1);
  });

  it('part B: the header says "Private" and "Making private…"; no old word on #18, in any stage', async () => {
    const ctl = controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    expect(r.getByTestId('zk-title').props.children).toBe('Making private…');
    expect(r.getByText('Private')).toBeTruthy();
    await flush();
    for (const s of ['checking', 'proving', 'verifying'] as const) {
      await stage(ctl, s, 100);
      expect(r.queryByText(/SHIELDED|Groth16|witness/)).toBeNull();
    }
  });
});

describe('#18 — failures show the E_A0 reason on the row it happened in', () => {
  it('a pre-check refusal in row 1: hero "Proof failed" + code, row 1 errored, rows 2–4 skipped', async () => {
    const ctl = controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    await flush();
    await stage(ctl, 'precheck');
    const e = Object.assign(new Error('E_A0_DEPOSIT_PRECHECK_UNSYNCED: counter 0: its rho PDA exists'), {
      code: 'E_A0_DEPOSIT_PRECHECK_UNSYNCED',
    });
    await act(async () => {
      ctl.reject(e);
    });
    await flush();
    expect(r.getByTestId('zk-hero').props.children).toBe('Proof failed');
    expect(r.getByTestId('zk-hero-sub').props.children).toBe(
      'E_A0_DEPOSIT_PRECHECK_UNSYNCED · counter 0: its rho PDA exists',
    );
    expect(status(r, 1)).toBe('Prepare: errored'); // part B: "Build witness" → "Prepare"
    expect(meta(r, 1)).toBe('failed · E_A0_DEPOSIT_PRECHECK_UNSYNCED');
    for (const n of [2, 3, 4]) {
      expect(meta(r, n)).toBe('— · skipped');
    }
    expect(onReady).not.toHaveBeenCalled();
  });

  it('a refusal while proving marks row 2, row 1 stays done', async () => {
    const ctl = controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    await flush();
    await stage(ctl, 'checking');
    await stage(ctl, 'proving', 2000);
    await act(async () => {
      ctl.reject(new Error('E_A0_KEYS_DIGEST: zkey digest mismatch'));
    });
    await flush();
    expect(status(r, 1)).toBe('Prepare: done'); // part B: "Build witness" → "Prepare"
    expect(meta(r, 1)).toBe('done · 2.0 s');
    expect(status(r, 2)).toBe('Make the proof: errored'); // part B: "Prove" → "Make the proof"
    expect(meta(r, 2)).toBe('failed · E_A0_KEYS_DIGEST');
  });

  it('a cancelled keychain read fails row 1 without calling the prepare', async () => {
    mockRetrieve.mockRejectedValue(new Error('User canceled the operation.'));
    controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    await flush();
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(r.getByTestId('zk-hero-sub').props.children).toBe('User canceled the operation.');
    expect(status(r, 1)).toBe('Prepare: errored'); // part B: "Build witness" → "Prepare"
  });

  it('one action: "Retry on this device" — no hosted prover anywhere — and it runs a new prepare', async () => {
    const ctl = controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    await flush();
    await act(async () => {
      ctl.reject(new Error('E_A0_DEPOSIT_CLUSTER: not devnet'));
    });
    await flush();
    expect(r.getByText('Retry on this device')).toBeTruthy();
    expect(r.queryByText(/hosted/i)).toBeNull();
    expect(r.queryByText(/Local prover slow/i)).toBeNull();
    fireEvent.press(r.getByTestId('retry-local-button'));
    await flush();
    expect(mockPrepare).toHaveBeenCalledTimes(2);
    expect(r.getByTestId('zk-hero').props.children).toBe('Preparing proof');
  });
});

describe('#18 — back', () => {
  it('during the proof: a confirmation, nothing cancelled until confirmed', async () => {
    controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    await flush();
    fireEvent.press(r.getByTestId('back-button'));
    expect(Alert.alert).toHaveBeenCalledWith('Cancel proof generation?', 'Nothing has been sent. The proof is discarded.', expect.any(Array));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('a prepare that resolves after the screen is gone navigates nowhere', async () => {
    const ctl = controlledPrepare();
    const r = render(<ZkProofScreen amount={AMOUNT} onReady={onReady} onCancel={onCancel} />);
    await flush();
    r.unmount();
    await act(async () => {
      ctl.resolve(PREPARED);
      jest.advanceTimersByTime(1000);
    });
    expect(onReady).not.toHaveBeenCalled();
  });
});
