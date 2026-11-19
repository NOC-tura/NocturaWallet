/**
 * TEST-ONLY: the world an A0 unshield runs in, for the flow and reconciliation suites (never
 * imported by app code): the recorded devnet tree + the test seed's own deposits (offline
 * equations, `ownHistory.appendDeposit`), those notes `unspent` in the encrypted store, the live
 * devnet fake (`liveDevnet.ts`), the live relayer over it (`liveRelayer.ts`), and the fake native
 * core approving every confirmation (`offlineA0.ts`). The suite owns the jest mocks (the real
 * web3.js, the fake NocturaProver) and hands the fake in.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import type {AssetIO} from '../../../zkProver/provingAssets';
import {mergeA0RecoveredNotes} from '../noteStore';
import {EXIT_ACCOUNT_VECTORS, TEST_SEED, offlineKeys} from './offlineA0';
import type {FakeProverNative} from './offlineA0';
import {appendDeposit} from './ownHistory';
import {chainFrom} from './recordedRpc';
import type {RecordedFixture} from './recordedRpc';
import {liveDevnet} from './liveDevnet';
import type {LiveDevnet} from './liveDevnet';
import {liveRelayer} from './liveRelayer';
import type {LiveRelayer} from './liveRelayer';

export const TREE = JSON.parse(
  readFileSync(join(__dirname, '../__tests__/fixtures/devnet-tree-5URd.json'), 'utf8'),
) as RecordedFixture;
/** the recorded tree's leaf count (slot 522620135) */
export const RECORDED_LEAVES = 17;
export const own = offlineKeys(TEST_SEED);

/** The test seed's slip10:n (address, ATA) and the other seed's slip10:0 — offline vectors. */
export const ACCOUNT = (n: number) => EXIT_ACCOUNT_VECTORS[0]!.accounts[n]!;
export const MAIN = ACCOUNT(0);
export const OTHER = EXIT_ACCOUNT_VECTORS[1]!.accounts[0]!;

/** The withdraw_change key files, "present and pinned" (the digests are §1's). */
export const WITHDRAW_IO: AssetIO = {
  cachePath: (id, kind) => `/cache/${id}.${kind}`,
  exists: async () => true,
  download: async () => undefined,
  sha256: async p =>
    p.endsWith('.zkey')
      ? 'ec55bdbbbfedb9823a57e5a3131c457a259fe8a690c087b82ad8b7efd3d756f2'
      : '01b0ec1f28dec05e712b2fa0524c7b212409abf330b3380119d8e64d9845e0b9',
  remove: async () => undefined,
};

export interface OwnNote {
  rho: string;
  amount: bigint;
  commitment: string;
  leafIndex: number;
  nullifier: string;
}

export interface UnshieldWorld {
  net: LiveDevnet;
  relayer: LiveRelayer;
  notes: OwnNote[];
}

/**
 * Deposits of `amounts` (counters 0, 1, …) appended to the recorded tree and stored `unspent`;
 * the relayer grants unless `grant: false`; the main and the other seed's account hold SOL.
 * The caller has opened the encrypted store.
 */
export function unshieldWorld(fake: FakeProverNative, o: {amounts?: bigint[]; grant?: boolean} = {}): UnshieldWorld {
  const net = liveDevnet(chainFrom(TREE));
  const notes = (o.amounts ?? [1_000_000n]).map((amount, i) => {
    const rho = own.rho(BigInt(i));
    const commitment = own.commitment(amount, rho);
    const {leafIndex} = appendDeposit(net.chain, {amount, commitment, rho});
    return {rho, amount, commitment, leafIndex, nullifier: own.nullifier(rho)};
  });
  mergeA0RecoveredNotes(
    notes.map((n, i) => ({commitment: n.commitment, amount: n.amount, rho: n.rho, depositIndex: BigInt(i), leafIndex: n.leafIndex, status: 'unspent' as const})),
    BigInt(notes.length),
  );
  const relayer = liveRelayer(net, {grant: o.grant});
  relayer.funded.add(MAIN.address);
  relayer.funded.add(OTHER.address);
  fake.reset();
  fake.setConfirmer(() => 'approve');
  return {net, relayer, notes};
}

/** The change note an unshield of `note` for `amount` + `fee` leaves, from the offline equations. */
export function expectedChange(note: OwnNote, amount: bigint, fee: bigint): {rho: string; amount: bigint; commitment: string} {
  const rho = own.rhoChange(note.nullifier);
  const change = note.amount - amount - fee;
  return {rho, amount: change, commitment: own.commitment(change, rho)};
}
