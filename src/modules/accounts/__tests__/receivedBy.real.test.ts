/**
 * M1d review m3: the reader joined to the REAL note store and registry over the MMKV mock — a pending
 * unshield written by `markA0PendingUnshield` carries the reserved scheme; once the registry promotes
 * that entry to `fresh-exit`, the reader names it. Nothing of a0/** is mocked or edited.
 */
import {clearAllStores, initSecureMmkv, mmkvSecure} from '../../../store/mmkv/instances';
import {TEST_SEED} from '../../shielded/a0/__testing__/offlineA0';
import {confirmA0Deposit, addA0PendingDeposit, markA0PendingUnshield, settleA0Unshield} from '../../shielded/a0/noteStore';
import {freshExitAccountOf, pendingFreshSchemeOf} from '../receivedBy';

const N0 = TEST_SEED.notes[0]!;
const N1 = TEST_SEED.notes[1]!;
const cm = (n: typeof N0, amount: string) => n.commitments.find(c => c.amount === amount)!.commitment;
const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const setRegistry = (role: string) =>
  mmkvSecure()!.set(
    'v1_accounts',
    JSON.stringify({
      schema: 1,
      accounts: [
        {scheme: 'slip10:0', role: 'main', address: MAIN},
        {scheme: 'slip10:3', role, address: A3},
      ],
    }),
  );

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  addA0PendingDeposit({commitment: cm(N0, '1000000000'), amount: 1_000_000_000n, rho: N0.rho, depositIndex: 0n, lastValidBlockHeight: 400_000_123});
  confirmA0Deposit(N0.rho, {leafIndex: 17, commitment: cm(N0, '1000000000')});
  markA0PendingUnshield(N0.rho, 1_794_200_000, {
    owner: A3,
    amount: 400_000n,
    fee: 10_000n,
    feePayer: MAIN,
    gasGrantLamports: null,
    destination: 'fresh',
    scheme: 'slip10:3',
  });
});

it('the pending intent holds the scheme; the registry entry names the account only once it is fresh-exit', () => {
  expect(pendingFreshSchemeOf(N0.rho)).toBe('slip10:3');
  setRegistry('fresh-pending');
  expect(freshExitAccountOf(pendingFreshSchemeOf(N0.rho))).toBeNull();
  setRegistry('fresh-exit');
  expect(freshExitAccountOf(pendingFreshSchemeOf(N0.rho))).toEqual({label: 'Account 4', address: A3});
});

it('the settled note drops the scheme — which is why it is read at onPending, not afterwards', () => {
  settleA0Unshield(N0.rho, '47k56NfB' + '2'.repeat(80), {commitment: cm(N1, '1000000000'), amount: 999_590_000n, rho: N1.rho, leafIndex: 18});
  expect(pendingFreshSchemeOf(N0.rho)).toBeNull();
});
