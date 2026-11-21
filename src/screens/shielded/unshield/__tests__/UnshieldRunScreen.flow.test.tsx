/**
 * The unshield run over the REAL `unshieldA0` (M1c Task 8 fix round 1, M-3): the screen's
 * `recorded` rule (set on `submit`, cleared only by a NEW `approval`) is bound to the flow's real
 * stage order, not to a sequence the test author typed. Task 7's world drives it
 * (`__testing__/unshieldWorld.ts`): the real web3.js over the live devnet fake, the live relayer
 * fake, the fake native core. Only the screen's own wiring is replaced: the keychain answers the
 * test seed, `getConnection()` is the world's Connection, and the options the app does not pass in
 * a test VM (the key files, the uncached sync, the world's relayer transport) are added to the
 * screen's call — its `onStage` is the screen's own, passed through untouched.
 *
 * R3-N4 end to end: the relayer answers the generic signature-less `relay_failed` after the pool's
 * root left the 64-root ring → the flow re-syncs, proves the tx can never land, REVERTS the note
 * and asks a NEW confirmation. The human cancels it → the screen says "Not sent" (the revert is
 * proven), and the note store agrees: the note is unspent again. The control: the same answer with
 * the root still in the ring → the flow keeps the note pending → the screen says "Not confirmed yet".
 */
jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../../../../modules/shielded/a0/__testing__/realWeb3')>(
    '../../../../modules/shielded/a0/__testing__/realWeb3',
  ).loadRealWeb3(),
);
jest.mock('react-native', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  RN.NativeModules.NocturaProver = jest
    .requireActual<typeof import('../../../../modules/shielded/a0/__testing__/offlineA0')>('../../../../modules/shielded/a0/__testing__/offlineA0')
    .createFakeProverNative();
  return RN;
});
import React from 'react';
import {render, act, waitFor} from '@testing-library/react-native';
import {NativeModules} from 'react-native';
import type {Connection} from '@solana/web3.js';
import {clearAllStores, initSecureMmkv} from '../../../../store/mmkv/instances';
import {TEST_SEED, seedBytes, strangerField} from '../../../../modules/shielded/a0/__testing__/offlineA0';
import type {FakeProverNative} from '../../../../modules/shielded/a0/__testing__/offlineA0';
import {WITHDRAW_IO, unshieldWorld} from '../../../../modules/shielded/a0/__testing__/unshieldWorld';
import type {UnshieldWorld} from '../../../../modules/shielded/a0/__testing__/unshieldWorld';
import {resetA0ReservationsForTests} from '../../../../modules/shielded/a0/accountRegistry';
import {resetA0ReadoutForTests, setA0ReadoutDefaultsForTests} from '../../../../modules/shielded/a0/checkpointReadout';
import {A0_SUBMIT_HOLD_MS, armA0SubmitHold, resetA0SubmitHoldForTests} from '../../../../modules/shielded/a0/submitHold';
import {loadA0NoteStore} from '../../../../modules/shielded/a0/noteStore';
import {resetA0UnshieldForTests} from '../../../../modules/shielded/a0/unshieldFlow';
import type {A0UnshieldOptions, A0UnshieldStage} from '../../../../modules/shielded/a0/unshieldFlow';
import {UnshieldRunScreen} from '../UnshieldRunScreen';

const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
let w: UnshieldWorld;
const stages: A0UnshieldStage[] = [];

jest.mock('../../../../modules/keychain/keychainModule', () => ({keychainManager: {retrieveSeed: async () => 'words'}}));
jest.mock('../../../../modules/keyDerivation/mnemonicUtils', () => ({mnemonicToSeed: async () => mockSeed()}));
const mockSeed = () => seedBytes(TEST_SEED);
jest.mock('../../../../modules/solana/connection', () => ({getConnection: () => mockConnection()}));
const mockConnection = (): Connection => w.net.connection;
jest.mock('../../../../modules/shielded/a0/unshieldFlow', () => {
  const actual = jest.requireActual<typeof import('../../../../modules/shielded/a0/unshieldFlow')>(
    '../../../../modules/shielded/a0/unshieldFlow',
  );
  return {
    ...actual,
    // the REAL flow; the screen's own onStage is passed through (recorded here too)
    unshieldA0: (c: Connection, seed: Uint8Array, r: Parameters<typeof actual.unshieldA0>[2], o: A0UnshieldOptions = {}) =>
      actual.unshieldA0(c, seed, r, {
        ...o,
        ...mockWorldOptions(),
        onStage: (s: A0UnshieldStage) => {
          stages.push(s);
          o.onStage?.(s);
        },
      }),
  };
});
const mockWorldOptions = (): A0UnshieldOptions => ({io: WITHDRAW_IO, sync: {useCache: false}, transport: w.relayer.transport, confirmSyncDelayMs: 1});
jest.mock('../../../../hooks/useA0Shielded', () => ({
  useA0Shielded: () => ({
    view: {kind: 'ready', unspent: 0n, pending: 0n, notes: 0},
    refresh: () => undefined,
    checkAgain: {disabled: false, checking: false, note: null, run: () => undefined},
  }),
}));

jest.setTimeout(120_000);

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  resetA0UnshieldForTests();
  resetA0ReservationsForTests();
  resetA0ReadoutForTests();
  stages.length = 0;
  w = unshieldWorld(fake);
});
afterEach(async () => {
  w.relayer.abandon();
  await new Promise(r => setTimeout(r, 20));
  resetA0UnshieldForTests();
});

const pushOutOfTheRing = () => {
  for (let k = 0; k < 64; k++) {
    w.net.landForeign({amount: 1n + BigInt(k), commitment: strangerField(500 + k), rho: strangerField(900 + k)});
  }
};

async function runScreen() {
  const r = render(<UnshieldRunScreen request={{destination: {kind: 'fresh'}, amount: '400000'}} onDone={() => undefined} onBack={() => undefined} />);
  await waitFor(() => expect(r.queryByTestId('unshield-status-title')).not.toBeNull(), {timeout: 110_000});
  await waitFor(() => expect(r.queryByText(/Submitting…|Confirming…/)).toBeNull(), {timeout: 110_000});
  await act(async () => {});
  return r;
}
const title = (r: ReturnType<typeof render>) => r.getByTestId('unshield-status-title').props.children;

describe('the run over the real flow — R3-N4 (M-3)', () => {
  it('never lands → the flow reverts and asks a NEW confirmation; cancelled → "Not sent", and the note IS unspent again', async () => {
    let dialogs = 0;
    fake.setConfirmer(() => {
      dialogs += 1;
      return dialogs === 1 ? 'approve' : Object.assign(new Error('E_A0_CONFIRM_CANCELLED: cancelled'), {code: 'E_A0_CONFIRM_CANCELLED'});
    });
    w.relayer.script.push({answer: 'relay_failed', before: pushOutOfTheRing});
    const r = await runScreen();
    // the flow's real order: submit → the one re-sync → (the revert) → a NEW approval
    expect(stages.slice(stages.indexOf('submit'))).toEqual(['submit', 'sync', 'approval']);
    expect(title(r)).toBe('Not sent');
    expect(r.getByTestId('unshield-status-sub').props.children).toBe('You cancelled the confirmation. Nothing was sent.');
    expect(r.queryByTestId('unshield-check-again')).toBeNull();
    expect(loadA0NoteStore().notes.find(n => n.rho === w.notes[0]!.rho)!.status).toBe('unspent'); // the screen's claim, from the store
  }, 120_000);

  it('control: the root still in the ring → the flow keeps the note pending → "Not confirmed yet" + "Check again"', async () => {
    w.relayer.script.push({answer: 'relay_failed'});
    const r = await runScreen();
    expect(stages.slice(stages.indexOf('submit'))).toEqual(['submit', 'sync']);
    expect(title(r)).toBe('Not confirmed yet');
    expect(r.getByTestId('unshield-check-again')).toBeTruthy();
    expect(r.queryByText(/Not sent|Nothing was sent/)).toBeNull();
    expect(loadA0NoteStore().notes.find(n => n.rho === w.notes[0]!.rho)!.status).toBe('pending');
  }, 120_000);
});

describe('the devnet submit hold through the screen (M1c Task 9: the hold only via options.holdMs; M-2)', () => {
  let lines: string[];
  const readouts = (event: string) =>
    lines.map(l => JSON.parse(l.split(' ').slice(3).join(' ')) as Record<string, unknown>).filter(p => p.event === event);
  /** the 30 s pause made instant; `during` runs inside it */
  const shortHold = (during: () => void) => {
    const real = global.setTimeout;
    const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
      if (ms === A0_SUBMIT_HOLD_MS) {
        during();
        return real(fn, 0);
      }
      return real(fn, ms);
    }) as typeof setTimeout);
    return () => spy.mockRestore();
  };
  beforeEach(() => {
    lines = [];
    resetA0SubmitHoldForTests();
    // the devnet gate, opened for these rows (the hold is closed under Jest's production config)
    setA0ReadoutDefaultsForTests({enabled: true, sink: l => lines.push(l), session: 's'});
  });
  afterEach(() => resetA0SubmitHoldForTests());

  it('armed by the desk\'s link: the screen\'s run takes the hold (heldMs 30000 on its line) and lands as usual', async () => {
    let paused = 0;
    const restore = shortHold(() => (paused += 1));
    try {
      armA0SubmitHold(true);
      const r = await runScreen();
      expect(title(r)).toBe('Now public'); // part B: "Unshielded" → "Now public"
    } finally {
      restore();
    }
    expect(paused).toBe(1);
    expect(readouts('unshield-submitting')[0]).toMatchObject({heldMs: A0_SUBMIT_HOLD_MS});
    expect(readouts('submit-hold').map(p => p.state)).toEqual(['armed', 'taken']);
  }, 120_000);

  it('a throw INSIDE the hold window (the wallet replaced while held) never reads "Not sent" over the pending note', async () => {
    const rho = w.notes[0]!.rho;
    let before: ReturnType<typeof loadA0NoteStore> | null = null;
    const restore = shortHold(() => {
      before = loadA0NoteStore();
      clearAllStores();
      initSecureMmkv('another-wallet');
    });
    let r: ReturnType<typeof render>;
    try {
      armA0SubmitHold(true);
      r = await runScreen();
    } finally {
      restore();
    }
    // the pending unshield WAS written before the hold (in the replaced wallet's store)
    expect(before!.notes.find(n => n.rho === rho)).toMatchObject({status: 'pending'});
    expect(w.relayer.submits).toHaveLength(0);
    expect(stages[stages.length - 1]).toBe('submit');
    expect(title(r!)).toBe('Not in this wallet');
    expect(r!.queryByText(/Not sent|Nothing was sent/)).toBeNull();
  }, 120_000);
});
