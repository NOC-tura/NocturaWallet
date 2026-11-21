/**
 * #19 → #20 → #21 carrying the A0 deposit (the ShieldIntent chain): #19 simulates the HELD prepared
 * deposit (`simulateA0Deposit`), #20 runs the re-auth, #21 TAKES the held deposit once and submits
 * it with a second keychain read; every outcome of `submitA0Deposit` is said as what it is (a
 * pending note is "not confirmed yet — settled at the next start", never "failed").
 */
import React from 'react';
import {render, fireEvent, act, waitFor} from '@testing-library/react-native';
import {ShieldSimulateScreen, depositCheckView} from '../ShieldSimulateScreen';
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
import {checkInstructions} from '../../../modules/solana/instructionChecks';

const mockSimulate = jest.fn();
type Submit = (c: unknown, p: A0PreparedDeposit, seed: Uint8Array, o: {onStage: (s: A0SubmitStage, sig?: string) => void}) => Promise<A0DepositOutcome>;
const mockSubmit = jest.fn<ReturnType<Submit>, Parameters<Submit>>();
jest.mock('../../../modules/shielded/a0/depositFlow', () => ({
  simulateA0Deposit: (...a: unknown[]) => mockSimulate(...a),
  submitA0Deposit: (...a: Parameters<Submit>) => mockSubmit(...a),
}));
/** owner phone pass 2, 2026-11-21, item 6: the private balance as the dashboard reads it (null = not known) */
const mockBalance = jest.fn();
jest.mock('../../../hooks/useA0Shielded', () => ({a0PrivateBalanceNow: () => mockBalance()}));
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

/**
 * The REAL rows `simulateA0Deposit` returns for a deposit (compute budget + the pool): the plain
 * deposit wording (owner phone pass 2, 2026-11-21, item 4) maps these exact rows, so a drift in
 * `checkInstructions` shows here, not on the phone.
 */
const CHECKS = checkInstructions([
  {programId: 'ComputeBudget111111111111111111111111111111', data: new Uint8Array([2])},
  {programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH', data: new Uint8Array([1])},
]);

describe('#19 ShieldSimulate', () => {
  it('simulates the HELD deposit; ready: the public-deposit row, the risk rows, the balance delta, Continue', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    mockSimulate.mockResolvedValue({simulation: {success: true, unitsConsumed: 142287}, checks: CHECKS});
    const onContinue = jest.fn();
    const r = render(<ShieldSimulateScreen intent={intentFor(id)} onContinue={onContinue} onCancel={jest.fn()} />);
    expect(r.getByText('Simulating the deposit')).toBeTruthy(); // part B: "Simulating shield deposit" → "Simulating the deposit"
    // owner phone pass 2, 2026-11-21, item 4: plain words; the compute units only in Details
    await waitFor(() => expect(r.getByText('Simulation passed')).toBeTruthy());
    expect(r.queryByText(/CU/)).toBeNull();
    expect(mockSimulate).toHaveBeenCalledWith({rpc: 'fake'}, PREPARED);
    expect(r.getByText('3 of 4')).toBeTruthy();
    expect(r.getByTestId('shield-sim-amount').props.children).toBe('2.5 TEST');
    expect(r.getByText('A public deposit')).toBeTruthy();
    expect(r.getByText('Your main account signs it. Its amount and time are visible on chain.')).toBeTruthy();
    expect(r.getByText('Only known programs')).toBeTruthy();
    expect(r.getByText('Noctura and Solana programs only')).toBeTruthy();
    expect(r.getByText('Noctura and Solana programs only').props.className ?? '').not.toContain('font-geist-mono'); // plain words, plain face (M-3 control)
    expect(r.getByText('No one gets access to your tokens')).toBeTruthy();
    expect(r.getByText('No approval or authority change')).toBeTruthy();
    expect(r.getAllByText('PASS')).toHaveLength(2); // every check still shows its badge
    expect(r.queryByText(/instruction|unknown contracts|token approvals granted|Approve/)).toBeNull();
    expect(r.getByText('Your balance changes')).toBeTruthy();
    expect(r.queryByText(/Balance delta/)).toBeNull();
    expect(r.getByText('Proof fee')).toBeTruthy();
    expect(r.getByText('None · made on this device')).toBeTruthy();
    expect(r.queryByText(/ZK proof fee/)).toBeNull();
    // Details (collapsed): the compute units, the instruction count, the instruction names
    expect(r.queryByTestId('shield-sim-details-body')).toBeNull();
    fireEvent.press(r.getByTestId('shield-sim-details-toggle'));
    expect(r.getByText('142,287 CU')).toBeTruthy();
    expect(r.getByText('2 instruction(s), all known programs')).toBeTruthy();
    expect(r.getByText('no Approve / SetAuthority / CloseAccount instruction')).toBeTruthy();
    expect(r.getByText('− 2.5 TEST')).toBeTruthy();
    expect(r.getByText('the pool')).toBeTruthy(); // Task 5 carry 3: Task 4's "→ the pool" (A11)
    expect(r.getByText('Making private')).toBeTruthy(); // Task 5 carry 3: the delta row's label
    expect(r.getByText('− 0.000005 SOL')).toBeTruthy();
    expect(r.getByText('− ≈ 0.00069596 SOL')).toBeTruthy();
    fireEvent.press(r.getByTestId('shield-sim-continue'));
    expect(onContinue).toHaveBeenCalledWith(intentFor(id));
  });

  it('owner phone pass 2, 2026-11-21, item 4: a failing or inconclusive check is never plain-worded away nor hidden in Details — its own title, its meta, its badge, visible', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const bad = checkInstructions([
      {programId: 'ComputeBudget111111111111111111111111111111', data: new Uint8Array([2])},
      {programId: 'Evi1Program1111111111111111111111111111111', data: new Uint8Array([0])},
      {programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', data: new Uint8Array([4])},
    ]);
    mockSimulate.mockResolvedValue({simulation: {success: true, unitsConsumed: 1000}, checks: bad});
    const r = render(<ShieldSimulateScreen intent={intentFor(id)} onContinue={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(r.getByText('Interacts with an unknown contract')).toBeTruthy());
    expect(r.getByText('unrecognised program: Evi1Program1111111111111111111111111111111')).toBeTruthy();
    // fix round 1 (M-3): a failing row's technical line keeps the mono face (a program id reads by its shape)
    expect(r.getByText('unrecognised program: Evi1Program1111111111111111111111111111111').props.className).toContain('font-geist-mono');
    expect(r.getByText('Grants authority over your tokens')).toBeTruthy();
    expect(r.getByText('Approve — this is not part of a transfer')).toBeTruthy();
    expect(r.getAllByText('FAIL')).toHaveLength(2);
    expect(r.queryByText('Only known programs')).toBeNull();
    expect(r.queryByText('No one gets access to your tokens')).toBeNull();
    expect(r.queryByTestId('shield-sim-details-body')).toBeNull(); // all of the above with Details collapsed
    // the inconclusive row (no instructions) keeps its CHECK badge and its words
    const id2 = holdPreparedA0Deposit(PREPARED);
    mockSimulate.mockResolvedValue({simulation: {success: true}, checks: checkInstructions([])});
    const r2 = render(<ShieldSimulateScreen intent={intentFor(id2)} onContinue={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(r2.getByText("Couldn't inspect the transaction")).toBeTruthy());
    expect(r2.getByText('no instructions to check — do not read this as a pass')).toBeTruthy();
    expect(r2.getByText('CHECK')).toBeTruthy();
    // fix round 1 (M-2): no compute units and no passing row → no "Details ▾" that opens to nothing
    expect(r2.queryByTestId('shield-sim-details')).toBeNull();
    expect(r2.queryByTestId('shield-sim-details-toggle')).toBeNull();
  });

  it('owner phone pass 2, 2026-11-21, item 4: only a PASSING row is plain-worded — the same title with warn / danger keeps its own words and its meta, nothing for Details', () => {
    for (const status of ['warn', 'danger'] as const) {
      for (const title of ['No interactions with unknown contracts', 'No token approvals granted']) {
        expect(depositCheckView({status, title, meta: 'm'})).toEqual({status, title, body: 'm', detail: null});
      }
    }
    // control: the passing row is re-worded and its meta goes to Details
    expect(depositCheckView({status: 'ok', title: 'No token approvals granted', meta: 'm'})).toEqual({
      status: 'ok',
      title: 'No one gets access to your tokens',
      body: 'No approval or authority change',
      detail: {label: 'Approvals', value: 'm'},
    });
    // an unknown title (a renamed check) is shown as it is, never hidden
    expect(depositCheckView({status: 'ok', title: 'Something new', meta: 'm'})).toEqual({status: 'ok', title: 'Something new', body: 'm', detail: null});
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
    await waitFor(() => expect(r.getByText('Simulation passed')).toBeTruthy()); // part B: "Shield simulation passed" → "Simulation passed"
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
    expect(r.getByText('This deposit is no longer prepared. Go back and start again.')).toBeTruthy(); // Task 5 carry 3
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
    expect(r.getByTestId('shield-confirm-headline').props.children).toBe('Make 2.5 TEST private'); // part B: "Shield 2.5 TEST" → "Make 2.5 TEST private"
    expect(r.getByText('You are about to make this private')).toBeTruthy(); // part B: "You are about to shield" → "You are about to make this private"
    expect(r.getByText('4 of 4')).toBeTruthy();
    expect(r.getByText('Solana devnet')).toBeTruthy();
    expect(r.getByText('Your main account')).toBeTruthy();
    expect(r.getByText(/^Pool · 8VMe…/)).toBeTruthy(); // part B: "Shielded pool" → "Pool" (A11)
    expect(r.getByText('The amount, the time and your main account are public in this deposit.')).toBeTruthy();
    // owner phone pass 2, 2026-11-21, item 5: "ZK PROOF FEE" → "PROOF FEE" (the overline upper-cases it)
    expect(r.getByText('Proof fee')).toBeTruthy();
    expect(r.getByText('None · made on this device')).toBeTruthy();
    expect(r.queryByText(/ZK proof fee/)).toBeNull();
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
    expect(r.getByText('This deposit is no longer prepared. Go back and start again.')).toBeTruthy(); // Task 5 carry 3
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

  it('takes the held deposit ONCE, submits it with a second keychain read; the stages; unspent → Now private, the position, the new balance', async () => {
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
    expect(r.getByText('5kAj9N…b81e')).toBeTruthy(); // the signature from `recorded` on (fix round 1, M-6: outside Details until confirmed)
    await act(async () => ctl.stage('confirming', SIG));
    expect(r.queryByTestId('shield-status-public')).toBeNull(); // running: not landed yet
    expect(sub(r)).toBe('Submitted to Solana devnet · waiting for confirmation.');
    expect(r.getByText("Don't close · waiting for confirmation")).toBeTruthy();
    await act(async () => ctl.resolve({status: 'unspent', signature: SIG, leafIndex: 17, root: 'ee'.repeat(32)}));
    expect(title(r)).toBe('Now private'); // part B: "Shielded" → "Now private"
    // owner phone pass 2, 2026-11-21, item 6: laid out like Now public — the balance under the title,
    // the position only in Details
    expect(sub(r)).toBe('Your private balance is now 4 TEST.');
    expect(r.queryByText(/Confirmed on Solana devnet/)).toBeNull();
    expect(r.queryByTestId('shield-status-balance')).toBeNull(); // no longer a card line
    expect(r.getByText('CONFIRMED')).toBeTruthy();
    expect(r.getByText('2.5 TEST')).toBeTruthy(); // the card keeps PRIVATE {amount}
    expect(r.getByTestId('shield-status-public').props.children).toBe('Your deposit is public on chain.'); // part B (spec §4, A2)
    expect(r.queryByText('#17 in the pool')).toBeNull();
    expect(r.queryByText('5kAj9N…b81e')).toBeNull();
    expect(r.queryByTestId('shield-status-meta-details-body')).toBeNull(); // collapsed
    fireEvent.press(r.getByTestId('shield-status-meta-details-toggle'));
    expect(r.getByText('#17 in the pool')).toBeTruthy();
    expect(r.getByText('5kAj9N…b81e')).toBeTruthy();
    expect(r.getByLabelText('Copy Tx hash')).toBeTruthy(); // the copy stays, inside Details
    expect(r.getByText(/0\.000005 SOL \+ ≈ 0\.00069596 SOL rent/)).toBeTruthy();
    expect(r.getByTestId('shield-status-details')).toBeTruthy(); // the explorer stays (a deposit is public by design)
    expect(r.getByText('View on explorer')).toBeTruthy();
    expect(r.getByTestId('shield-status-details').props.accessibilityLabel).toBe('View on explorer');
    expect(r.queryByText('View details')).toBeNull();
    expect(r.getByTestId('shield-status-header-sep').props.children).toBe('·'); // Task 5 carry 1: "PRIVATE · Make private", as the unshield #21
  });

  it('owner phone pass 2, 2026-11-21, item 6: unspent but the balance NOT known → no balance sentence (never a guess); the rest unchanged', async () => {
    mockBalance.mockReturnValue(null);
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    await act(async () => ctl.resolve({status: 'unspent', signature: SIG, leafIndex: 17, root: 'ee'.repeat(32)}));
    expect(title(r)).toBe('Now private');
    expect(r.queryByTestId('shield-status-sub')).toBeNull();
    expect(r.queryByText(/private balance/i)).toBeNull();
    expect(r.getByTestId('shield-status-public').props.children).toBe('Your deposit is public on chain.');
  });

  it('owner phone pass 2, 2026-11-21, item 6: the balance is read only for a landed deposit — pending says no balance', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    await act(async () => ctl.resolve({status: 'pending', signature: SIG, reason: 'not-confirmed'}));
    expect(title(r)).toBe('Not confirmed yet');
    expect(r.queryByText(/private balance is now|Private balance now/)).toBeNull();
    expect(mockBalance).not.toHaveBeenCalled();
  });

  it('fix round 1 (M-6): pending → TX HASH (with its copy) visible OUTSIDE Details, as before; no Details at all', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    await act(async () => ctl.stage('recorded', SIG));
    expect(r.getByText('5kAj9N…b81e')).toBeTruthy(); // running: visible, as before
    expect(r.queryByTestId('shield-status-meta-details-toggle')).toBeNull();
    await act(async () => ctl.resolve({status: 'pending', signature: SIG, reason: 'not-confirmed'}));
    expect(title(r)).toBe('Not confirmed yet');
    expect(r.getByText('5kAj9N…b81e')).toBeTruthy();
    expect(r.getByLabelText('Copy Tx hash')).toBeTruthy();
    expect(r.queryByTestId('shield-status-meta-details-toggle')).toBeNull();
  });

  it('fix round 1 (M-6): a throw after the pending write ("Not confirmed yet") and dropped ("Not made private") → TX HASH visible outside Details', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
    await act(async () => ctl.stage('recorded', SIG));
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_STORE_LOCKED: x'), {code: 'E_A0_STORE_LOCKED'})));
    expect(title(r)).toBe('Not confirmed yet');
    expect(r.getByText('5kAj9N…b81e')).toBeTruthy();
    expect(r.getByLabelText('Copy Tx hash')).toBeTruthy();
    expect(r.queryByTestId('shield-status-meta-details-toggle')).toBeNull();

    const id2 = holdPreparedA0Deposit(PREPARED);
    const ctl2 = controlledSubmit();
    const r2 = render(<ShieldStatusScreen intent={intentFor(id2)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(2));
    await act(async () => ctl2.resolve({status: 'dropped', signature: SIG, reason: 'foreign', foreignSignature: 'F'.repeat(64)}));
    expect(title(r2)).toBe('Not made private');
    expect(r2.getByText('5kAj9N…b81e')).toBeTruthy();
    expect(r2.queryByTestId('shield-status-meta-details-toggle')).toBeNull();
  });

  it('View on explorer opens the deposit on the devnet explorer (?cluster=devnet — S13)', async () => {
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
    expect(sub(r2)).toBe('This deposit is no longer prepared (it was already sent, or replaced). Start again from Make private.'); // Task 5 carry 3
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
    expect(r.queryByTestId('shield-status-public')).toBeNull(); // Task 5 carry 4: pending, not landed
  });

  it('M1b I-2 (the parked #21 copy): pending not-in-sync WITH a foreign signature → says another deposit holds the number, still pending, never "failed" or "Not made private"', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    const foreign = 'F'.repeat(60) + 'abcd';
    await act(async () =>
      ctl.resolve({status: 'pending', signature: SIG, reason: 'not-in-sync', detail: `another deposit (${foreign})`, foreignSignature: foreign}),
    );
    expect(title(r)).toBe('Not confirmed yet');
    expect(sub(r)).toBe(
      "Solana devnet reported this deposit confirmed, but the pool's history shows another deposit (FFFFFF…abcd) at this note's number. Nothing is decided from that: your deposit stays pending on this device and is settled from the chain the next time the wallet starts, or when you tap Check again.",
    );
    expect(r.getByText('PENDING')).toBeTruthy();
    expect(r.queryByText(/fail|Not made private/i)).toBeNull(); // part B (review I-4): the negative row follows the new word
    expect(r.queryByTestId('shield-status-public')).toBeNull(); // pending: not landed
  });

  it('dropped (a foreign deposit holds our rho) → "Not made private", no tokens moved', async () => {
    const id = holdPreparedA0Deposit(PREPARED);
    const ctl = controlledSubmit();
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    await act(async () => ctl.resolve({status: 'dropped', signature: SIG, reason: 'foreign', foreignSignature: 'F'.repeat(64)}));
    expect(title(r)).toBe('Not made private'); // part B: "Not shielded" → "Not made private"
    expect(r.queryByTestId('shield-status-public')).toBeNull(); // "yours did not land": the line would be false
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
    expect(r.queryByTestId('shield-status-public')).toBeNull(); // nothing was broadcast: the line is not said
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
    expect(r.queryByTestId('shield-status-public')).toBeNull(); // Task 5 carry 4: its result is not recorded
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
    expect(r.queryByTestId('shield-status-public')).toBeNull(); // Task 5 carry 4: not this wallet's deposit to describe
  });

  it('a cancelled keychain read → "Not sent", the submit never called', async () => {
    mockRetrieve.mockRejectedValue(new Error('User canceled the operation.'));
    const id = holdPreparedA0Deposit(PREPARED);
    const r = render(<ShieldStatusScreen intent={intentFor(id)} onDone={jest.fn()} />);
    await waitFor(() => expect(title(r)).toBe('Not sent'));
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
