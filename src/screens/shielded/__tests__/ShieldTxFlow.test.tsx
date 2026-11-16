/**
 * #19 → #20 → #21 carrying the A0 deposit (the ShieldIntent chain): #19 simulates the HELD prepared
 * deposit (`simulateA0Deposit`), #20 runs the re-auth, #21 TAKES the held deposit once and submits
 * it with a second keychain read; every outcome of `submitA0Deposit` is said as what it is (a
 * pending note is "not confirmed yet — settled at the next start", never "failed").
 */
import React from 'react';
import {render, fireEvent, act, waitFor} from '@testing-library/react-native';
import {ShieldSimulateScreen} from '../ShieldSimulateScreen';
import {ShieldConfirmScreen} from '../ShieldConfirmScreen';
import {ShieldStatusScreen} from '../ShieldStatusScreen';
import type {A0DepositOutcome, A0PreparedDeposit, A0SubmitStage} from '../../../modules/shielded/a0/depositFlow';
import {
  holdPreparedA0Deposit,
  preparedA0Deposit,
  resetPreparedA0DepositsForTests,
} from '../../../modules/shielded/a0/screenSupport';
import type {ShieldIntent} from '../../../types/shield';
import {Linking} from 'react-native';

const mockSimulate = jest.fn();
type Submit = (c: unknown, p: A0PreparedDeposit, seed: Uint8Array, o: {onStage: (s: A0SubmitStage, sig?: string) => void}) => Promise<A0DepositOutcome>;
const mockSubmit = jest.fn<ReturnType<Submit>, Parameters<Submit>>();
jest.mock('../../../modules/shielded/a0/depositFlow', () => ({
  simulateA0Deposit: (...a: unknown[]) => mockSimulate(...a),
  submitA0Deposit: (...a: Parameters<Submit>) => mockSubmit(...a),
}));
const mockBalance = jest.fn();
jest.mock('../../../modules/shielded/a0/noteStore', () => ({a0UnspentBalance: () => mockBalance()}));
const mockRetrieve = jest.fn();
jest.mock('../../../modules/keychain/keychainModule', () => ({
  keychainManager: {retrieveSeed: () => mockRetrieve()},
}));
jest.mock('../../../modules/keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn(async () => new Uint8Array(64).fill(9)),
}));
jest.mock('../../../modules/solana/connection', () => ({getConnection: () => ({rpc: 'fake'})}));
jest.mock('@react-native-clipboard/clipboard', () => ({setString: jest.fn()}));

// I-1 (final review): the first test pays the suite's first render — React Native's lazy component
// modules, lucide and nativewind loaded on first use (~0.4 s solo, 7.7 s measured under the full
// run's contention) — so Jest's 5 s default made a full run red on a test that proves nothing.
jest.setTimeout(30_000);

const PREPARED: A0PreparedDeposit = {
  amount: 2_500_000_000n,
  depositIndex: 0n,
  rho: 'ab'.repeat(32),
  commitment: 'cd'.repeat(32),
  proof: new Uint8Array(256),
  depositor: '7iQkaB129HR4mWZ8tNxF6jqLK3sP8eM2vRgCd4Y7abcd',
  depositorTokenAccount: 'TokenAcct1111111111111111111111111111111111',
  importedNotes: 0,
  foreignRhoHits: 0,
};
const SIG = '5kAj9NqzZ4s7mWm1d1b81eexampleSignature1111111111111111111111111b81e';

function intentFor(id: string): ShieldIntent {
  return {kind: 'shield', preparedId: id, amount: '2500000000', tokenSymbol: 'TEST', decimals: 9, depositor: PREPARED.depositor};
}

let clock = 5_000_000;
beforeEach(() => {
  resetPreparedA0DepositsForTests();
  mockSimulate.mockReset();
  mockSubmit.mockReset();
  mockBalance.mockReset().mockReturnValue(4_000_000_000n);
  mockRetrieve.mockReset().mockResolvedValue('mnemonic words');
  clock += 10_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});
afterEach(() => jest.restoreAllMocks());

const CHECKS = [
  {status: 'ok', title: 'Known programs only', meta: 'ComputeBudget · FeGSS… shielded pool'},
  {status: 'ok', title: 'No token approvals granted', meta: 'no Approve instruction'},
];

describe('#19 ShieldSimulate', () => {
  it('simulates the HELD deposit; ready: the public-deposit row, the risk rows, the balance delta, Continue', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    mockSimulate.mockResolvedValue({simulation: {success: true, unitsConsumed: 142287}, checks: CHECKS});
    const onContinue = jest.fn();
    const r = render(<ShieldSimulateScreen intent={intentFor(id)} onContinue={onContinue} onCancel={jest.fn()} />);
    expect(r.getByText('Simulating shield deposit')).toBeTruthy();
    await waitFor(() => expect(r.getByText('Shield simulation passed · 142,287 CU')).toBeTruthy());
    expect(mockSimulate).toHaveBeenCalledWith({rpc: 'fake'}, PREPARED);
    expect(r.getByText('3 of 4')).toBeTruthy();
    expect(r.getByTestId('shield-sim-amount').props.children).toBe('2.5 TEST');
    expect(r.getByText('A public deposit')).toBeTruthy();
    expect(r.getByText('Your main account signs it. Its amount and time are visible on chain.')).toBeTruthy();
    expect(r.getByText('Known programs only')).toBeTruthy();
    expect(r.getByText('No token approvals granted')).toBeTruthy();
    expect(r.getByText('− 2.5 TEST')).toBeTruthy();
    expect(r.getByText('− 0.000005 SOL')).toBeTruthy();
    expect(r.getByText('− ≈ 0.00069596 SOL')).toBeTruthy();
    fireEvent.press(r.getByTestId('shield-sim-continue'));
    expect(onContinue).toHaveBeenCalledWith(intentFor(id));
  });

  it('failed: the reason, Retry re-simulates, and NO "Continue anyway" (preflight would refuse it)', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    mockSimulate.mockResolvedValue({
      simulation: {success: false, error: {code: 'SIM', message: 'custom program error: 0x1771', action: 'The pool rejected the proof'}},
      checks: [],
    });
    const onContinue = jest.fn();
    const r = render(<ShieldSimulateScreen intent={intentFor(id)} onContinue={onContinue} onCancel={jest.fn()} />);
    await waitFor(() => expect(r.getByTestId('shield-sim-failed')).toBeTruthy());
    expect(r.getByText(/The pool rejected the proof\. Nothing was sent\./)).toBeTruthy();
    expect(r.queryByText(/Continue anyway/)).toBeNull();
    expect(r.queryByTestId('shield-sim-continue')).toBeNull();
    mockSimulate.mockResolvedValue({simulation: {success: true}, checks: CHECKS});
    await act(async () => {
      fireEvent.press(r.getByTestId('shield-sim-retry'));
    });
    await waitFor(() => expect(r.getByText('Shield simulation passed')).toBeTruthy());
    expect(mockSimulate).toHaveBeenCalledTimes(2);
  });

  it('a thrown A0 error shows its code', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    mockSimulate.mockRejectedValue(Object.assign(new Error('E_A0_DEPOSIT_CLUSTER: not devnet'), {code: 'E_A0_DEPOSIT_CLUSTER'}));
    const r = render(<ShieldSimulateScreen intent={intentFor(id)} onContinue={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(r.getByText(/E_A0_DEPOSIT_CLUSTER · not devnet\./)).toBeTruthy());
  });

  it('a stale / forged intent (no held deposit): nothing simulated, nothing to continue', () => {
    const r = render(<ShieldSimulateScreen intent={intentFor('a0-deposit-forged')} onContinue={jest.fn()} onCancel={jest.fn()} />);
    expect(r.getByTestId('shield-sim-missing')).toBeTruthy();
    expect(mockSimulate).not.toHaveBeenCalled();
    expect(r.queryByTestId('shield-sim-continue')).toBeNull();
  });
});

describe('#20 ShieldConfirm', () => {
  it('the design rows for a deposit; the CTA runs the re-auth, then hands over to #21', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    let approve: (v: boolean) => void = () => {};
    const requestAuth = jest.fn(() => new Promise<boolean>(res => (approve = res)));
    const onAuthorized = jest.fn();
    const r = render(
      <ShieldConfirmScreen intent={intentFor(id)} requestAuth={requestAuth} onAuthorized={onAuthorized} onCancel={jest.fn()} />,
    );
    expect(r.getByTestId('shield-confirm-headline').props.children).toBe('Shield 2.5 TEST');
    expect(r.getByText('You are about to shield')).toBeTruthy();
    expect(r.getByText('4 of 4')).toBeTruthy();
    expect(r.getByText('Solana devnet')).toBeTruthy();
    expect(r.getByText('Your main account')).toBeTruthy();
    expect(r.getByText(/^Shielded pool · 8VMe…/)).toBeTruthy();
    expect(r.getByText('The amount, the time and your main account are public in this deposit.')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('shield-confirm-send'));
    });
    expect(requestAuth).toHaveBeenCalledTimes(1);
    expect(onAuthorized).not.toHaveBeenCalled();
    expect(r.getByTestId('shield-confirm-send').props.accessibilityState.disabled).toBe(true); // no double submit
    await act(async () => approve(true));
    expect(onAuthorized).toHaveBeenCalledWith(intentFor(id));
  });

  it('a declined re-auth does not hand over; the CTA comes back', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const onAuthorized = jest.fn();
    const r = render(
      <ShieldConfirmScreen intent={intentFor(id)} requestAuth={async () => false} onAuthorized={onAuthorized} onCancel={jest.fn()} />,
    );
    await act(async () => {
      fireEvent.press(r.getByTestId('shield-confirm-send'));
    });
    expect(onAuthorized).not.toHaveBeenCalled();
    expect(r.getByTestId('shield-confirm-send').props.accessibilityState.disabled).toBe(false);
  });

  it('a stale intent: the CTA is disabled and asks for nothing', async () => {
    const requestAuth = jest.fn(async () => true);
    const r = render(
      <ShieldConfirmScreen intent={intentFor('a0-deposit-gone')} requestAuth={requestAuth} onAuthorized={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(r.getByTestId('shield-confirm-missing')).toBeTruthy();
    await act(async () => {
      fireEvent.press(r.getByTestId('shield-confirm-send'));
    });
    expect(requestAuth).not.toHaveBeenCalled();
  });
});

describe('#21 ShieldStatus', () => {
  function controlledSubmit() {
    const ctl: {stage: (s: A0SubmitStage, sig?: string) => void; resolve: (o: A0DepositOutcome) => void; reject: (e: unknown) => void} = {
      stage: () => {},
      resolve: () => {},
      reject: () => {},
    };
    mockSubmit.mockImplementation((_c, _p, _s, o) => {
      ctl.stage = o.onStage;
      return new Promise((res, rej) => {
        ctl.resolve = res;
        ctl.reject = rej;
      });
    });
    return ctl;
  }
  const title = (r: ReturnType<typeof render>) => r.getByTestId('shield-status-title').props.children;
  const sub = (r: ReturnType<typeof render>) => r.getByTestId('shield-status-sub').props.children;

  it('takes the held deposit ONCE, submits it with a second keychain read; the stages; unspent → Shielded, the position, the new balance', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    expect(preparedA0Deposit(id)).toBeNull(); // taken: no second submit can find it
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(mockRetrieve).toHaveBeenCalledTimes(1);
    expect(mockSubmit.mock.calls[0]![1]).toBe(PREPARED);
    expect(mockSubmit.mock.calls[0]![2]).toEqual(new Uint8Array(64).fill(9));
    await act(async () => ctl.stage('signing'));
    expect(sub(r)).toBe('Signing with your main account.');
    await act(async () => ctl.stage('recorded', SIG));
    expect(r.getByText('5kAj9N…b81e')).toBeTruthy(); // the signature from `recorded` on
    await act(async () => ctl.stage('confirming', SIG));
    expect(sub(r)).toBe('Submitted to Solana devnet · waiting for confirmation.');
    expect(r.getByText("Don't close · waiting for confirmation")).toBeTruthy();
    await act(async () => ctl.resolve({status: 'unspent', signature: SIG, leafIndex: 17, root: 'ee'.repeat(32)}));
    expect(title(r)).toBe('Shielded');
    expect(sub(r)).toBe('Confirmed on Solana devnet · your note is at position #17 in the pool.');
    expect(r.getByText('CONFIRMED')).toBeTruthy();
    expect(r.getByText('#17 in the pool')).toBeTruthy();
    expect(r.getByTestId('shield-status-balance').props.children).toBe('Shielded balance now 4 TEST');
  });

  it('View details opens the deposit on the devnet explorer (?cluster=devnet — S13)', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    await act(async () => ctl.stage('recorded', SIG));
    await act(async () => ctl.resolve({status: 'unspent', signature: SIG, leafIndex: 17, root: 'ee'.repeat(32)}));
    fireEvent.press(r.getByTestId('shield-status-details'));
    expect(open).toHaveBeenCalledWith(`https://explorer.solana.com/tx/${SIG}?cluster=devnet`);
  });

  it('a second mount for the same intent finds nothing to send (no double submit)', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    controlledSubmit();
    render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    const r2 = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    expect(title(r2)).toBe('Nothing to send');
  });

  it.each([
    ['send-failed', 'The network did not accept the transaction.'],
    ['not-confirmed', 'The network has not confirmed it yet.'],
    ['not-in-sync', 'It is confirmed, but the pool’s history does not list it yet.'],
  ] as const)('pending (%s) → "Not confirmed yet … settled the next time the wallet starts", never "failed"', async (reason, why) => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    await act(async () => ctl.resolve({status: 'pending', signature: SIG, reason}));
    expect(title(r)).toBe('Not confirmed yet');
    expect(sub(r)).toBe(`${why} Your deposit is kept on this device and will be settled the next time the wallet starts, or when you tap Check again.`);
    expect(r.getByText('PENDING')).toBeTruthy();
    expect(r.queryByText(/fail/i)).toBeNull();
  });

  it('dropped (a foreign deposit holds our rho) → "Not shielded", no tokens moved', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    await act(async () => ctl.resolve({status: 'dropped', signature: SIG, reason: 'foreign', foreignSignature: 'F'.repeat(64)}));
    expect(title(r)).toBe('Not shielded');
    expect(sub(r)).toMatch(/No tokens moved/);
  });

  it('a refusal BEFORE the pending write → "Not sent", its code, nothing broadcast', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    await act(async () => ctl.stage('signing'));
    await act(async () =>
      ctl.reject(Object.assign(new Error('E_A0_DEPOSIT_SIGNER: not the depositor'), {code: 'E_A0_DEPOSIT_SIGNER'})),
    );
    expect(title(r)).toBe('Not sent');
    expect(sub(r)).toBe('E_A0_DEPOSIT_SIGNER · not the depositor. Nothing was broadcast.');
  });

  it('a throw AFTER the pending write (a note-store refusal in the settle loop) → kept as pending, never "Nothing was broadcast"', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    await act(async () => ctl.stage('recorded', SIG));
    await act(async () => ctl.stage('settling', SIG));
    await act(async () =>
      ctl.reject(Object.assign(new Error('E_A0_STORE_LOCKED: the encrypted store is not open'), {code: 'E_A0_STORE_LOCKED'})),
    );
    expect(title(r)).toBe('Not confirmed yet');
    expect(sub(r)).toBe(
      'E_A0_STORE_LOCKED · the encrypted store is not open. It was sent, but this device could not record its result. The wallet settles it the next time it starts.',
    );
    expect(r.getByText('PENDING')).toBeTruthy();
    expect(r.queryByText(/Nothing was broadcast/)).toBeNull();
  });

  it('E_A0_STORE_CHANGED after the pending write (wipe + import while in flight) → "Not in this wallet": never "kept on this device", never "Nothing was broadcast"', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    await act(async () => ctl.stage('recorded', SIG));
    await act(async () => ctl.stage('settling', SIG));
    await act(async () =>
      ctl.reject(Object.assign(new Error('E_A0_STORE_CHANGED: the encrypted store was replaced'), {code: 'E_A0_STORE_CHANGED'})),
    );
    expect(title(r)).toBe('Not in this wallet');
    expect(sub(r)).toBe(
      'E_A0_STORE_CHANGED · The wallet on this device was replaced while this deposit was in flight. It was sent from the earlier wallet; restoring that wallet from its recovery phrase recovers it if it landed.',
    );
    expect(r.queryByText(/kept on this device|Nothing was broadcast/)).toBeNull();
    expect(r.queryByText('PENDING')).toBeNull();
  });

  it('a cancelled keychain read → "Not sent", the submit never called', async () => {
    mockRetrieve.mockRejectedValue(new Error('User canceled the operation.'));
    const id = holdPreparedA0Deposit(PREPARED);
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(title(r)).toBe('Not sent'));
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
