/**
 * R1-C1 row (c), through the app's own onboarding call: `unlockSecureStorageWithSeed` after an
 * in-app "Wipe wallet" (`clearAllStores`) starts the A0 startup step AGAIN, for the imported
 * wallet — and the onboarding path itself (the instance created → the reset hook → the run
 * captures the NEW instance) is not refused with E_A0_STORE_CHANGED.
 *
 * Real: the MMKV instances (+ the reset hook), the session module, the startup step, the restore,
 * the tree sync over the recorded devnet history (liveDevnet), the bridge over the offline fake.
 * Mocked: the build gate (the devnet build), the connection (the live devnet fake's), and the
 * keychain (the session module drops the v1 view key at unlock, M1b Task 6).
 */
jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
jest.mock('react-native', () => ({
  NativeModules: {
    NocturaProver: jest.requireActual<typeof import('../__testing__/offlineA0')>('../__testing__/offlineA0').createFakeProverNative(),
  },
  Platform: {OS: 'android', select: (o: {android?: unknown; default?: unknown}) => o.android ?? o.default},
}));
jest.mock('../../../keychain/keychainModule', () => ({
  keychainManager: {retrieveSeed: jest.fn(), dropV1ViewKey: jest.fn().mockResolvedValue(undefined)},
}));
jest.mock('../../../../constants/features', () => ({isShieldedEnabled: jest.fn(() => true)}));
const live: {connection: unknown} = {connection: null};
jest.mock('../../../solana/connection', () => ({getConnection: jest.fn(() => live.connection)}));
import {readFileSync} from 'fs';
import {join} from 'path';
import {NativeModules} from 'react-native';
import {clearAllStores} from '../../../../store/mmkv/instances';
import {OTHER_SEED, TEST_SEED, offlineKeys, seedBytes} from '../__testing__/offlineA0';
import type {FakeProverNative} from '../__testing__/offlineA0';
import {appendDeposit} from '../__testing__/ownHistory';
import {chainFrom} from '../__testing__/recordedRpc';
import type {RecordedFixture} from '../__testing__/recordedRpc';
import {liveDevnet} from '../__testing__/liveDevnet';
import {a0UnspentBalance} from '../noteStore';
import {a0StartupState, resetA0StartupForTests} from '../startup';
import type {A0StartupState} from '../startup';
import {unlockSecureStorageWithSeed} from '../../../session/secureStorageSession';

const TREE = JSON.parse(readFileSync(join(__dirname, 'fixtures/devnet-tree-5URd.json'), 'utf8')) as RecordedFixture;
const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
const own = offlineKeys(TEST_SEED);
const other = offlineKeys(OTHER_SEED);

async function settled(): Promise<A0StartupState> {
  for (let k = 0; k < 2000; k++) {
    const s = a0StartupState();
    if (s.phase === 'ready' || s.phase === 'error') {
      return s;
    }
    await new Promise(r => setTimeout(r, 2));
  }
  throw new Error('the startup step did not settle');
}

beforeEach(() => {
  clearAllStores();
  fake.reset();
  resetA0StartupForTests();
  const chain = chainFrom(TREE);
  for (const [k, amount] of [[own, 4_000_000n], [other, 9n]] as const) {
    const rho = k.rho(0n);
    appendDeposit(chain, {amount, rho, commitment: k.commitment(amount, rho)});
  }
  live.connection = liveDevnet(chain).connection;
});

describe('onboarding after an in-app wipe (R1-C1 (c))', () => {
  it('unlockSecureStorageWithSeed after clearAllStores starts the step again: the imported wallet restores', async () => {
    unlockSecureStorageWithSeed(seedBytes(TEST_SEED)); // the first wallet's onboarding
    expect(await settled()).toMatchObject({phase: 'ready', result: {restoredBecause: 'no-record'}});
    expect(a0UnspentBalance()).toBe(4_000_000n);

    clearAllStores(); // Settings → Wipe wallet
    expect(a0StartupState()).toEqual({phase: 'idle'});
    unlockSecureStorageWithSeed(seedBytes(OTHER_SEED)); // the import, same process
    expect(a0StartupState()).toEqual({phase: 'running'});
    // the onboarding path is NOT refused: the run captured the instance the import created
    expect(await settled()).toMatchObject({phase: 'ready', result: {restoredBecause: 'no-record', restore: {ownNotes: 1}}});
    expect(a0UnspentBalance()).toBe(9n);
    expect(fake.calls.filter(c => c.method === 'keysOpen')).toHaveLength(2);
  });

  it('negative control: a second onboarding call WITHOUT a wipe starts nothing (the store is open, the step ran)', async () => {
    unlockSecureStorageWithSeed(seedBytes(TEST_SEED));
    await settled();
    unlockSecureStorageWithSeed(seedBytes(OTHER_SEED));
    expect(a0StartupState()).toMatchObject({phase: 'ready'});
    expect(a0UnspentBalance()).toBe(4_000_000n);
    expect(fake.calls.filter(c => c.method === 'keysOpen')).toHaveLength(1);
  });
});
