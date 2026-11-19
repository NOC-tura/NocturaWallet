/**
 * The unshield run — #18 then #21 for the A0 unshield (M1c Task 8; spec §6 steps 3–8, §11; Task 7's
 * outcomes; the controller's LOUD refusal ruling). `unshieldA0` is replaced by a controlled fake
 * that reports Task 7's six stages and resolves / rejects on command; everything the screen says is
 * typed out here (the loud text included — never read from the module under test).
 */
import React from 'react';
import {render, fireEvent, act, waitFor} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {UnshieldRunScreen} from '../UnshieldRunScreen';
import type {UnshieldRunRequest} from '../UnshieldRunScreen';
import type {A0UnshieldOutcome, A0UnshieldStage, A0UnshieldRequest} from '../../../../modules/shielded/a0/unshieldFlow';

type Unshield = (c: unknown, seed: Uint8Array, r: A0UnshieldRequest, o: {onStage: (s: A0UnshieldStage) => void}) => Promise<A0UnshieldOutcome>;
const mockUnshield = jest.fn<ReturnType<Unshield>, Parameters<Unshield>>();
jest.mock('../../../../modules/shielded/a0/unshieldFlow', () => ({
  ...jest.requireActual('../../../../modules/shielded/a0/unshieldFlow'),
  unshieldA0: (...a: Parameters<Unshield>) => mockUnshield(...a),
}));
const mockRetrieve = jest.fn();
jest.mock('../../../../modules/keychain/keychainModule', () => ({
  keychainManager: {retrieveSeed: () => mockRetrieve()},
}));
jest.mock('../../../../modules/keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn(async () => new Uint8Array(64).fill(5)),
}));
jest.mock('../../../../modules/solana/connection', () => ({getConnection: () => ({rpc: 'devnet'})}));
jest.mock('@react-native-clipboard/clipboard', () => ({setString: jest.fn()}));
const mockSecure = {on: 0, off: 0};
jest.mock('../../../../modules/screenSecurity/screenSecurityModule', () => ({
  ScreenSecurityManager: class {
    enableSecureScreen() {
      mockSecure.on += 1;
      return Promise.resolve();
    }
    disableSecureScreen() {
      mockSecure.off += 1;
      return Promise.resolve();
    }
  },
}));
const mockCheck = {disabled: false, checking: false, note: null as string | null, unshield: null as unknown, run: jest.fn()};
jest.mock('../../../../hooks/useA0Shielded', () => ({
  useA0Shielded: () => ({view: {kind: 'ready', unspent: 0n, pending: 0n, notes: 0}, refresh: jest.fn(), checkAgain: mockCheck}),
}));

jest.setTimeout(30_000);

const SIG = '4Hq7MbX1n2sV9pLr6TzKc3uYdW8eFa5GjN1oPq2RsTuVwXyZ3aBcDeFgHiJkLmNoPqRsTuVwXyZ1a2b3c4d5e6f';
const REQUEST: UnshieldRunRequest = {destination: {kind: 'fresh'}, amount: '1250000000'};
let clock = 1_000_000;

function controlled() {
  const ctl: {stage: (s: A0UnshieldStage) => void; resolve: (o: A0UnshieldOutcome) => void; reject: (e: unknown) => void} = {
    stage: () => {},
    resolve: () => {},
    reject: () => {},
  };
  mockUnshield.mockImplementation((_c, _s, _r, o) => {
    ctl.stage = o.onStage;
    return new Promise((res, rej) => {
      ctl.resolve = res;
      ctl.reject = rej;
    });
  });
  return ctl;
}

beforeEach(() => {
  mockUnshield.mockReset();
  mockRetrieve.mockReset().mockResolvedValue('words');
  mockCheck.run.mockReset();
  Object.assign(mockCheck, {disabled: false, checking: false, note: null, unshield: null});
  mockSecure.on = 0;
  mockSecure.off = 0;
  clock += 100_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  jest.restoreAllMocks();
});

async function run(request: UnshieldRunRequest = REQUEST) {
  const ctl = controlled();
  const onDone = jest.fn();
  const onBack = jest.fn();
  const r = render(<UnshieldRunScreen request={request} onDone={onDone} onBack={onBack} />);
  await waitFor(() => expect(mockUnshield).toHaveBeenCalledTimes(1));
  return {r, ctl, onDone, onBack};
}
const step = async (ctl: ReturnType<typeof controlled>, s: A0UnshieldStage, advanceMs = 0) => {
  clock += advanceMs;
  await act(async () => ctl.stage(s));
};
type R = ReturnType<typeof render>;
const meta = (r: R, s: A0UnshieldStage) => r.getByTestId(`unshield-stage-${s}-meta`).props.children;
const title = (r: R) => r.getByTestId('unshield-status-title').props.children;
const sub = (r: R) => r.getByTestId('unshield-status-sub').props.children;

describe('the run — one unshieldA0 call per mount', () => {
  it('one keychain read, ONE call with the request in base units (BigInt) and the devnet Connection; a re-render starts nothing', async () => {
    const {r} = await run();
    expect(mockRetrieve).toHaveBeenCalledTimes(1);
    const [conn, seed, req] = mockUnshield.mock.calls[0]!;
    expect(conn).toEqual({rpc: 'devnet'});
    expect(seed).toEqual(new Uint8Array(64).fill(5));
    expect(req).toEqual({destination: {kind: 'fresh'}, amount: 1_250_000_000n});
    r.rerender(<UnshieldRunScreen request={REQUEST} onDone={jest.fn()} onBack={jest.fn()} />);
    await act(async () => {});
    expect(mockUnshield).toHaveBeenCalledTimes(1);
  });

  it('a keychain refusal → "Not sent" with its code, no unshield call', async () => {
    mockRetrieve.mockRejectedValue(Object.assign(new Error('E_KEYCHAIN_CANCELLED: user cancelled'), {code: 'E_KEYCHAIN_CANCELLED'}));
    const r = render(<UnshieldRunScreen request={REQUEST} onDone={jest.fn()} onBack={jest.fn()} />);
    await waitFor(() => expect(r.getByTestId('unshield-status-title')).toBeTruthy());
    expect(mockUnshield).not.toHaveBeenCalled();
    expect(title(r)).toBe('Not sent');
    // final review M-4: the code + a fixed sentence (the raw message is not shown where a code exists)
    expect(sub(r)).toBe('E_KEYCHAIN_CANCELLED · The unshield stopped on this device. Nothing was sent.');
  });
});

describe('#18 for the unshield — the real stages, measured times, never a percentage', () => {
  it('sync → quote → approval → proof: each row runs with its elapsed time and ends "done · <measured>"; FLAG_SECURE on', async () => {
    const {r, ctl} = await run();
    expect(mockSecure.on).toBe(1);
    await step(ctl, 'sync');
    expect(r.getByTestId('unshield-hero').props.children).toBe('Syncing the pool');
    await step(ctl, 'quote', 1_200);
    expect(meta(r, 'sync')).toBe('done · 1.2 s');
    expect(meta(r, 'quote')).toBe('asking the relayer for its fee · 0.0 s');
    await step(ctl, 'approval', 300);
    expect(meta(r, 'quote')).toBe('done · 0.3 s');
    expect(meta(r, 'approval')).toBe('waiting for you in the confirmation dialog · 0.0 s');
    expect(r.getByTestId('unshield-hero').props.children).toBe('Approve in the dialog');
    await step(ctl, 'proof', 7_400);
    expect(meta(r, 'approval')).toBe('done · 7.4 s');
    expect(meta(r, 'proof')).toBe('running the Groth16 prover on this device · 0.0 s');
    expect(r.queryByText(/%/)).toBeNull();
  });

  it('fix round 1 I-2: #18 draws the design\'s hero ring (the CPU glyph) while unlocking and in every stage before the submit; #21 does not', async () => {
    const {r, ctl} = await run();
    expect(r.getByTestId('unshield-hero-ring')).toBeTruthy(); // the keychain prompt (auth)
    for (const s of ['sync', 'quote', 'approval', 'proof'] as const) {
      await step(ctl, s, 10);
      expect(r.getByTestId('unshield-hero-ring')).toBeTruthy();
      expect(r.getByTestId('unshield-hero-ring-cpu').children).toHaveLength(1); // the CPU glyph itself
    }
    await step(ctl, 'submit', 10);
    expect(r.queryByTestId('unshield-hero-ring')).toBeNull();
  });

  it('submit → #21 layout ("Submitting…"), confirm → "Confirming…"; FLAG_SECURE is released for #21', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'sync');
    await step(ctl, 'quote', 10);
    await step(ctl, 'approval', 10);
    await step(ctl, 'proof', 10);
    await step(ctl, 'submit', 2_000);
    expect(r.queryByTestId('unshield-stage-proof')).toBeNull();
    expect(title(r)).toBe('Submitting…');
    expect(sub(r)).toBe('The relayer pays for and submits it · waiting for its answer · 0.0 s.');
    expect(mockSecure.off).toBe(1);
    await step(ctl, 'confirm', 4_000);
    expect(title(r)).toBe('Confirming…');
    expect(r.getByText("Don't close · waiting for the relayer")).toBeTruthy();
  });

  it('a new round (the terms changed after the proof): the re-quote restarts its row only; the new approval restarts the proof; the hero says "2 of 3"', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'sync');
    await step(ctl, 'quote', 100);
    await step(ctl, 'approval', 100);
    await step(ctl, 'proof', 100);
    await step(ctl, 'quote', 5_000); // the re-quote after the proof
    expect(meta(r, 'proof')).toBe('done · 5.0 s'); // the proof stands while the terms are unknown
    expect(meta(r, 'quote')).toBe('asking the relayer for its fee · 0.0 s'); // restarted
    await step(ctl, 'approval', 200); // changed terms → a NEW confirmation
    expect(meta(r, 'quote')).toBe('done · 0.2 s');
    expect(meta(r, 'proof')).toBe('— · pending'); // restarted: the earlier proof was discarded
    expect(meta(r, 'sync')).toBe('done · 0.1 s'); // kept
    expect(r.getByTestId('unshield-hero-sub').props.children).toBe(
      "Check the destination and the amounts the dialog shows, then confirm it is you. The relayer's terms changed or the pool moved on, so this is a new confirmation (2 of 3).",
    );
  });

  it('back is LOCKED during the run (an alert, no navigation); after the outcome back is Done', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const {r, ctl, onDone} = await run();
    await step(ctl, 'proof');
    fireEvent.press(r.getByTestId('back-button'));
    expect(alert).toHaveBeenCalledWith('Unshield in progress', expect.stringMatching(/Leaving does not stop it/));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => ctl.resolve({status: 'not-sent', outcome: 'invalid_request'}));
    fireEvent.press(r.getByTestId('unshield-status-done'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('#21 for the unshield — every outcome said as what it is', () => {
  it('spent → "Unshielded", CONFIRMED, the grant, the change kept shielded, its position, the tx hash', async () => {
    const {r, ctl} = await run();
    await act(async () =>
      ctl.resolve({status: 'spent', signature: SIG, changeLeafIndex: 42, changeAmount: 749_990_000n, grantLamports: 3_000_000n, destinationWithoutSol: false}),
    );
    expect(title(r)).toBe('Unshielded');
    expect(sub(r)).toBe('Landed on Solana devnet and verified · the destination received 1.25 TEST.');
    expect(r.getByText('CONFIRMED')).toBeTruthy();
    expect(r.getByTestId('unshield-line-grant').props.children).toBe('The relayer also sent the new account 0.003 SOL for its own fees.');
    expect(r.getByTestId('unshield-line-change').props.children).toBe('Your change, 0.74999 TEST, stays shielded.');
    expect(r.queryByTestId('unshield-line-no-sol')).toBeNull();
    expect(r.getByText('#42 in the pool')).toBeTruthy();
    expect(r.getByText('4Hq7Mb…5e6f')).toBeTruthy();
    expect(r.queryByTestId('unshield-check-again')).toBeNull();
    expect(r.queryByTestId('unshield-status-loud')).toBeNull();
  });

  it('spent with destinationWithoutSol → the "no SOL" line, loud (warn), no grant line', async () => {
    const {r, ctl} = await run();
    await act(async () =>
      ctl.resolve({status: 'spent', signature: SIG, changeLeafIndex: 3, changeAmount: 0n, grantLamports: null, destinationWithoutSol: true}),
    );
    expect(r.getByTestId('unshield-line-no-sol').props.children).toBe(
      'The new account holds no SOL: it cannot pay for its own transactions until it receives some, and funding it from your other accounts would link them.',
    );
    expect(r.queryByTestId('unshield-line-grant')).toBeNull();
  });

  it('landed-unverified (note spent) → LOUD: "Landed, but failed verification: <code> · <what the code means>", UNVERIFIED, no retry', async () => {
    const {r, ctl} = await run();
    await act(async () =>
      ctl.resolve({
        status: 'landed-unverified',
        signature: SIG,
        code: 'E_A0_VERIFY_FEE_PAYER',
        detail: 'fee payer 9xyz is not the quote’s',
        note: 'spent',
        changeRecorded: true,
        linked: false,
        // a stray `detail` at run time (M-3 removed it from the type): the screen still never shows it
      } as A0UnshieldOutcome),
    );
    expect(title(r)).toBe('Landed, but failed verification');
    expect(r.getByTestId('unshield-status-loud')).toBeTruthy();
    expect(r.getByText("Landed, but failed verification: E_A0_VERIFY_FEE_PAYER · its fee payer is not the relayer's")).toBeTruthy();
    expect(r.queryByText(/9xyz/)).toBeNull(); // the verifier's detail is never rendered (carry 4)
    expect(r.getByText('UNVERIFIED')).toBeTruthy();
    expect(r.getByTestId('unshield-line-note').props.children).toBe('The transaction spends your note on chain, so the note is spent.');
    expect(r.getByTestId('unshield-line-change').props.children).toBe('Your change note was recorded: it is the one the transaction inserted.');
    expect(r.queryByText(/Retry|Try again/)).toBeNull();
    expect(r.queryByTestId('unshield-check-again')).toBeNull(); // the note is decided (spent)
  });

  it('landed-unverified (note pending, linked, no change) → says each, and offers "Check again"', async () => {
    const {r, ctl} = await run();
    await act(async () =>
      ctl.resolve({
        status: 'landed-unverified',
        signature: SIG,
        code: 'E_A0_VERIFY_SEED_SIGNER',
        detail: 'a key of this seed signed',
        note: 'pending',
        changeRecorded: false,
        linked: true,
        // a stray `detail` at run time (M-3 removed it from the type): the screen still never shows it
      } as A0UnshieldOutcome),
    );
    expect(r.getByText('Landed, but failed verification: E_A0_VERIFY_SEED_SIGNER · a key of this wallet signed it')).toBeTruthy();
    expect(r.getByTestId('unshield-line-note').props.children).toBe(
      'The transaction does not spend your note as far as this wallet can tell, so the note stays pending.',
    );
    expect(r.getByTestId('unshield-line-change').props.children).toBe('No change note was recorded: the transaction did not insert yours.');
    expect(r.getByTestId('unshield-line-linked').props.children).toBe(
      'A key of this wallet signed it: the new account is now linked to this wallet.',
    );
    expect(r.getByTestId('unshield-check-again')).toBeTruthy();
  });

  it('carry 4: the verifier\'s detail (it names seed keys) reaches neither the screen nor the console; the loud line is built from the code', async () => {
    const SENTINEL = 'SeedKeySentine1111111111111111111111111111';
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(k => jest.spyOn(console, k).mockImplementation(() => {}));
    const {r, ctl} = await run();
    await act(async () =>
      ctl.resolve({
        status: 'landed-unverified',
        signature: SIG,
        code: 'E_A0_VERIFY_SEED_KEY',
        detail: `seed key ${SENTINEL} appears in the tx`,
        note: 'pending',
        changeRecorded: true,
        linked: false,
        // a stray `detail` at run time (M-3 removed it from the type): the screen still never shows it
      } as A0UnshieldOutcome),
    );
    expect(r.getByTestId('unshield-status-loud')).toBeTruthy();
    expect(r.getByText('Landed, but failed verification: E_A0_VERIFY_SEED_KEY · it names another account of this wallet')).toBeTruthy();
    expect(JSON.stringify(r.toJSON())).not.toContain(SENTINEL);
    expect(JSON.stringify(r.toJSON())).not.toContain('appears in the tx');
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SENTINEL);
    }
  });

  it.each([
    ['unconfirmed', 'The relayer sent it, but it was not confirmed in time.'],
    ['already_spent', 'The relayer says this note is already spent.'],
    ['relay_failed', "The relayer's answer does not say whether it sent it."],
    ['unknown', "The relayer's answer could not be read."],
    ['not-in-sync', "The relayer reports it confirmed, but the pool's history does not list it yet."],
  ] as const)('pending (%s) → "Not confirmed yet", PENDING, kept, "Check again" runs the reconciliation; never "failed"', async (reason, why) => {
    const {r, ctl} = await run();
    await act(async () => ctl.resolve({status: 'pending', signature: SIG, reason}));
    expect(title(r)).toBe('Not confirmed yet');
    expect(sub(r)).toBe(
      `${why} Your note is kept pending on this device and is decided from the chain: the next time the wallet starts, or when you tap Check again. Nothing is sent twice.`,
    );
    expect(r.getByText('PENDING')).toBeTruthy();
    expect(r.queryByText(/fail(ed)? verification|Not sent/)).toBeNull();
    expect(sub(r)).not.toMatch(/fail/i);
    fireEvent.press(r.getByTestId('unshield-check-again'));
    expect(mockCheck.run).toHaveBeenCalledTimes(1);
  });

  it.each(['relay_failed', 'unknown'] as const)(
    'carry 2: pending (%s) with NO signature → the pending copy and "Check again"; never "Not sent", never failure copy',
    async reason => {
      const {r, ctl} = await run();
      await act(async () => ctl.resolve({status: 'pending', signature: null, reason}));
      expect(title(r)).toBe('Not confirmed yet');
      expect(r.getByText('PENDING')).toBeTruthy();
      expect(r.getByTestId('unshield-check-again')).toBeTruthy();
      expect(r.queryByText(/Not sent|Nothing was sent|Nothing left|accounted for/)).toBeNull();
      expect(sub(r)).not.toMatch(/fail/i);
      expect(r.queryByTestId('unshield-status-back')).toBeNull();
    },
  );

  it('pending without a signature (an unreadable answer) → no tx hash row, still "Check again"', async () => {
    const {r, ctl} = await run();
    await act(async () => ctl.resolve({status: 'pending', signature: null, reason: 'unknown'}));
    expect(r.queryByText('Tx hash')).toBeNull();
    expect(r.getByTestId('unshield-check-again')).toBeTruthy();
  });

  it('not-sent → "Not sent" with the relayer outcome; "Back to unshield" goes back with the form', async () => {
    const {r, ctl, onBack} = await run();
    await act(async () => ctl.resolve({status: 'not-sent', outcome: 'budget_exceeded'}));
    expect(title(r)).toBe('Not sent');
    expect(sub(r)).toBe('The relayer did not send it (budget_exceeded). Nothing left your shielded balance.');
    expect(r.queryByTestId('unshield-check-again')).toBeNull();
    fireEvent.press(r.getByTestId('unshield-status-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('the native dialog cancelled (E_A0_CONFIRM_CANCELLED) → "Not sent · You cancelled the confirmation"', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'approval');
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_CONFIRM_CANCELLED: user cancelled'), {code: 'E_A0_CONFIRM_CANCELLED'})));
    expect(title(r)).toBe('Not sent');
    expect(sub(r)).toBe('You cancelled the confirmation. Nothing was sent.');
  });

  it('E_A0_UNSHIELD_BUSY (a second unshield in this process) → "Not sent" with its code', async () => {
    const {r, ctl} = await run();
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_UNSHIELD_BUSY: another unshield is in flight'), {code: 'E_A0_UNSHIELD_BUSY'})));
    expect(sub(r)).toBe('E_A0_UNSHIELD_BUSY · Another unshield is still running on this device. Nothing was sent.');
  });

  it('a throw AFTER the submit stage (a note-store refusal) → "Not confirmed yet" with its code, never "Nothing was sent"', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'submit');
    await step(ctl, 'confirm');
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_STORE_LOCKED: not open'), {code: 'E_A0_STORE_LOCKED'})));
    expect(title(r)).toBe('Not confirmed yet');
    expect(sub(r)).toMatch(/^E_A0_STORE_LOCKED · It may have been sent/);
    expect(sub(r)).not.toContain('not open'); // M-4: the code, not the message
    expect(r.getByTestId('unshield-check-again')).toBeTruthy();
  });

  it('E_A0_STORE_CHANGED after the submit → "Not in this wallet", and no "Check again" (it would reconcile the replacing wallet; M-5)', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'submit');
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_STORE_CHANGED: replaced'), {code: 'E_A0_STORE_CHANGED'})));
    expect(title(r)).toBe('Not in this wallet');
    expect(r.queryByTestId('unshield-check-again')).toBeNull();
    expect(r.queryByText(/Not sent|Nothing was sent/)).toBeNull();
  });

  it('carry 9: a throw in the re-sync that follows a submit (the revert not yet proven) → "Not confirmed yet", never "Not sent"', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'submit');
    await step(ctl, 'sync'); // R3-N4: the generic relay_failed's one re-sync; the revert comes only after it
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_STORE_LOCKED: not open'), {code: 'E_A0_STORE_LOCKED'})));
    expect(title(r)).toBe('Not confirmed yet');
    expect(r.getByText('PENDING')).toBeTruthy();
    expect(r.getByTestId('unshield-check-again')).toBeTruthy();
    expect(r.queryByText(/Not sent|Nothing was sent/)).toBeNull();
    expect(r.queryByTestId('unshield-status-back')).toBeNull();
  });

  it('carry 9: ANY throw at the submit stage (E_A0_RELAYER_URL included) → "Not confirmed yet" + "Check again"', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'approval');
    await step(ctl, 'proof');
    await step(ctl, 'submit');
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_RELAYER_URL: refused base'), {code: 'E_A0_RELAYER_URL'})));
    expect(title(r)).toBe('Not confirmed yet');
    expect(r.getByTestId('unshield-check-again')).toBeTruthy();
    expect(r.queryByText(/Not sent|Nothing was sent/)).toBeNull();
  });

  it('control (carry 6 + 9): after a proven-dead round (submit → sync → a NEW approval) the cancelled dialog → "Not sent"', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'submit');
    await step(ctl, 'sync');
    await step(ctl, 'approval'); // the flow reverted the pending unshield and asks a new confirmation
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_CONFIRM_CANCELLED: user cancelled'), {code: 'E_A0_CONFIRM_CANCELLED'})));
    expect(title(r)).toBe('Not sent');
    expect(sub(r)).toBe('You cancelled the confirmation. Nothing was sent.');
    expect(r.queryByTestId('unshield-check-again')).toBeNull();
  });

  it('control: a throw BEFORE the submit (the proof stage) → "Not sent"', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'approval');
    await step(ctl, 'proof');
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_SUBMIT_PUBLIC_INPUTS: mismatch'), {code: 'E_A0_SUBMIT_PUBLIC_INPUTS'})));
    expect(title(r)).toBe('Not sent');
    expect(sub(r)).toBe('E_A0_SUBMIT_PUBLIC_INPUTS · The unshield stopped on this device. Nothing was sent.');
  });

  it.each([
    'E_A0_CONFIRM_BIOMETRIC',
    'E_A0_CONFIRM_BUSY',
    'E_A0_CONFIRM_INTERRUPTED',
    'E_A0_CONFIRM_NO_ACTIVITY',
    'E_A0_CONFIRM_NO_AUTHENTICATOR',
    'E_A0_CONFIRM_SESSION',
    'E_A0_CONFIRM_TIMEOUT',
    'E_A0_CONFIRM_UI',
    'E_A0_CONFIRM_MISMATCH',
    'E_A0_CONFIRM_RESULT',
  ])('carry 6: the native confirmation refused (%s) → the refused-dialog state, never pending', async code => {
    const {r, ctl} = await run();
    await step(ctl, 'approval');
    await act(async () => ctl.reject(Object.assign(new Error(`${code}: why`), {code})));
    expect(title(r)).toBe('Not sent');
    expect(sub(r)).toBe(`The confirmation did not complete (${code}): nothing was approved and nothing was sent.`);
    expect(r.queryByText('PENDING')).toBeNull();
    expect(r.queryByTestId('unshield-check-again')).toBeNull();
    expect(r.getByTestId('unshield-status-back')).toBeTruthy();
  });

  it('carry 3 (M-4 / M-7 rewritten): "Another address" that is an account of this wallet → the refusal naming its role, from the error\'s FIELD in a fixed sentence', async () => {
    const {r, ctl} = await run({destination: {kind: 'external', owner: 'BPFLoaderUpgradeab1e11111111111111111111111'}, amount: '5'});
    await step(ctl, 'sync');
    await step(ctl, 'quote');
    await act(async () =>
      ctl.reject(
        Object.assign(
          new Error('E_A0_UNSHIELD_DESTINATION: that address is an account of this wallet not offered as a destination (slip10:3, fresh-exit)'),
          {code: 'E_A0_UNSHIELD_DESTINATION', ownAccount: 'other'},
        ),
      ),
    );
    expect(title(r)).toBe('Not sent');
    expect(sub(r)).toBe(
      'E_A0_UNSHIELD_DESTINATION · That address is an account of this wallet that is not offered as a destination. Nothing was sent.',
    );
    expect(r.getByTestId('unshield-status-back')).toBeTruthy();
  });

  it('carry 3: the main account typed as "Another address" → "choose My main account"', async () => {
    const {r, ctl} = await run({destination: {kind: 'external', owner: 'BPFLoaderUpgradeab1e11111111111111111111111'}, amount: '5'});
    await act(async () =>
      ctl.reject(
        Object.assign(new Error('E_A0_UNSHIELD_DESTINATION: that address is your main account (slip10:0): choose "My main account"'), {
          code: 'E_A0_UNSHIELD_DESTINATION',
          ownAccount: 'main',
        }),
      ),
    );
    expect(sub(r)).toBe('E_A0_UNSHIELD_DESTINATION · That address is your main account: choose "My main account". Nothing was sent.');
  });

  it.each([
    'the destination is not a public key',
    'no fresh account: no-grant',
    // M-7: a message that merely STARTS like the own-account refusal is not one (no field)
    'that address is your main account (slip10:0): choose "My main account"',
  ])('M-7 (rewritten): E_A0_UNSHIELD_DESTINATION without the own-account field ("%s") → the destination\'s fixed sentence', async message => {
    const {r, ctl} = await run();
    await act(async () =>
      ctl.reject(Object.assign(new Error(`E_A0_UNSHIELD_DESTINATION: ${message}`), {code: 'E_A0_UNSHIELD_DESTINATION'})),
    );
    expect(title(r)).toBe('Not sent');
    expect(sub(r)).toBe(
      "E_A0_UNSHIELD_DESTINATION · That destination cannot be used: a new account needs the relayer's SOL grant, and another address must be a wallet address outside this wallet. Nothing was sent.",
    );
  });

  it('M-4: a raw message is never shown beside a code — a sentinel URL with an API key stays off the screen; without a code the message is all there is', async () => {
    const SECRET = 'https://devnet.example-rpc.com/?api-key=SENTINEL123';
    const {r, ctl} = await run();
    await act(async () => ctl.reject(Object.assign(new Error(`E_A0_SYNC_RPC: request to ${SECRET} failed`), {code: 'E_A0_SYNC_RPC'})));
    expect(JSON.stringify(r.toJSON())).not.toContain('SENTINEL123');
    expect(sub(r)).toBe('E_A0_SYNC_RPC · The unshield stopped on this device. Nothing was sent.');
    const second = await run();
    await act(async () => second.ctl.reject(new Error('Network request failed')));
    expect(sub(second.r)).toBe('Network request failed. Nothing was sent.');
  });

  it('M-4: a recorded throw (after the submit) with a code shows the code, not its message', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'submit');
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_SYNC_RPC: https://x/?api-key=SENTINEL456'), {code: 'E_A0_SYNC_RPC'})));
    expect(title(r)).toBe('Not confirmed yet');
    expect(JSON.stringify(r.toJSON())).not.toContain('SENTINEL456');
  });

  it('a malformed amount param → "Not sent" E_A0_UNSHIELD_AMOUNT, no keychain read, no call', async () => {
    const r = render(<UnshieldRunScreen request={{destination: {kind: 'main'}, amount: '1.5'}} onDone={jest.fn()} onBack={jest.fn()} />);
    await waitFor(() => expect(r.getByTestId('unshield-status-title')).toBeTruthy());
    expect(title(r)).toBe('Not sent');
    expect(mockRetrieve).not.toHaveBeenCalled();
    expect(mockUnshield).not.toHaveBeenCalled();
  });
});

describe('final review I-1: what "Check again" decided replaces "Not confirmed yet" on #21', () => {
  const pendingRun = async () => {
    const out = await run();
    await act(async () => out.ctl.resolve({status: 'pending', signature: SIG, reason: 'unconfirmed'}));
    expect(title(out.r)).toBe('Not confirmed yet');
    return out;
  };
  const decide = (r: R, unshield: unknown) => {
    Object.assign(mockCheck, {unshield});
    r.rerender(<UnshieldRunScreen request={REQUEST} onDone={jest.fn()} onBack={jest.fn()} />);
  };

  it('settled (verified) → "Unshielded", CONFIRMED; no PENDING, no "Check again"', async () => {
    const {r} = await pendingRun();
    decide(r, {kind: 'settled'});
    expect(title(r)).toBe('Unshielded');
    expect(sub(r)).toBe('Checked again: it landed on Solana devnet and was verified · the destination received 1.25 TEST.');
    expect(r.getByText('CONFIRMED')).toBeTruthy();
    expect(r.queryByText('PENDING')).toBeNull();
    expect(r.queryByTestId('unshield-check-again')).toBeNull();
    expect(r.queryByText(/Not confirmed yet/)).toBeNull();
  });

  it('reverted → "Not sent" with the note back; no PENDING, no "Check again"', async () => {
    const {r} = await pendingRun();
    decide(r, {kind: 'reverted'});
    expect(title(r)).toBe('Not sent');
    expect(sub(r)).toBe('Checked again: it did not land in time, so it can no longer land. Your note is back in your shielded balance.');
    expect(r.queryByText('PENDING')).toBeNull();
    expect(r.queryByTestId('unshield-check-again')).toBeNull();
  });

  it('a verifier refusal → LOUD "Landed, but failed verification" from the CODE, UNVERIFIED; no PENDING', async () => {
    const {r} = await pendingRun();
    decide(r, {kind: 'unverified', code: 'E_A0_VERIFY_SEED_SIGNER'});
    expect(title(r)).toBe('Landed, but failed verification');
    expect(r.getByTestId('unshield-status-loud')).toBeTruthy();
    expect(r.getByText('Landed, but failed verification: E_A0_VERIFY_SEED_SIGNER · a key of this wallet signed it')).toBeTruthy();
    expect(r.getByText('UNVERIFIED')).toBeTruthy();
    expect(r.queryByText('PENDING')).toBeNull();
    expect(r.queryByTestId('unshield-check-again')).toBeNull();
  });

  it('still pending → unchanged: "Not confirmed yet", PENDING, "Check again" (control)', async () => {
    const {r} = await pendingRun();
    decide(r, {kind: 'pending'});
    expect(title(r)).toBe('Not confirmed yet');
    expect(r.getByText('PENDING')).toBeTruthy();
    expect(r.getByTestId('unshield-check-again')).toBeTruthy();
  });

  it('a recorded throw (after the submit) is decided the same way', async () => {
    const {r, ctl} = await run();
    await step(ctl, 'submit');
    await act(async () => ctl.reject(Object.assign(new Error('E_A0_STORE_LOCKED: not open'), {code: 'E_A0_STORE_LOCKED'})));
    decide(r, {kind: 'settled'});
    expect(title(r)).toBe('Unshielded');
  });

  it('control: an outcome that was already decided (spent) is not changed by a later check', async () => {
    const {r, ctl} = await run();
    await act(async () =>
      ctl.resolve({status: 'spent', signature: SIG, changeLeafIndex: 21, changeAmount: 5n, grantLamports: null, destinationWithoutSol: false}),
    );
    decide(r, {kind: 'reverted'});
    expect(title(r)).toBe('Unshielded');
    expect(r.getByText('CONFIRMED')).toBeTruthy();
  });
});
