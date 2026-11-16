/**
 * Recovery of the A0 deposits from the seed (spec §7 "Deposits", R1, R12, R13).
 *
 * LOCAL MATCHING ONLY (I-3). Recovery reads the pool's whole history through the same tree sync
 * every client runs (`syncA0Tree`: one signature walk over 5URd…, one getTransaction per listed
 * pool tx, the tree account) and matches it here, on the device. It makes no other request: no
 * rho-PDA lookup, no nullifier-PDA lookup, no getTransaction of a signature it picked — so the RPC
 * provider sees the same requests from a restoring wallet as from any other (proved by
 * `__tests__/restoreRequests.test.ts` with a recording Connection, positive controls included).
 *
 * THE STEPS (§7 "Deposits"):
 *   1. the rho set: the `rho` argument of every `deposit` in the synced history. For
 *      i = 0, 1, 2, …: `depositRho(i)` (Rust) and look for it there; stop after 20 consecutive
 *      misses (deposits are sequential; a gap only comes from a failed or abandoned tx);
 *   2. each hit is read from its (already synced) creating tx: the amount from the instruction,
 *      the leaf index and commitment from that tx's LeafInserted whose commitment is the
 *      instruction's (matched by value, never by position), and Rust's `commitment(amount, rho)`
 *      must equal it. A hit that fails this check is NOT our note — somebody landed a deposit
 *      under our rho (possible only by copying it from our own deposit tx while it was in
 *      flight, a griefing front-run): it is not imported, but its counter is used, so
 *      `nextDepositIndex` passes it and it still resets the gap count;
 *   3. spent-status of every own note at once: ONE `matchSpent(handle, allSyncedWithdrawNullifiers,
 *      ownRhos)` (R12) — JS never computes or holds an own note's nullifier.
 * `nextDepositIndex` = the highest hit (own or not) + 1, or 0 when there is none (§8).
 *
 * CHANGE NOTES ARE M1c's. This module recovers deposit notes only. The recursion of §7 "Change
 * notes" (each spent note's spending tx → its `rho_change`, change amount and change leaf, then
 * again) is not built here: M1c adds it as a step of `restoreA0FromSeed` after
 * `recoverA0Deposits`, over the same `tree` and the same open handle, before the store write. Its
 * input is the spent deposit notes returned here. NOTE for M1c: `matchSpent` returns indices into
 * `ownRhos`, not WHICH nullifier matched; attributing a spent note to its spending tx needs a
 * further `matchSpent(handle, [n], spentRhos)` per synced Withdraw nullifier `n` (local calls, no
 * request) — that is also when `spentTx` gets filled; M1b leaves it unset.
 *
 * HANDLE LIFETIME (§3 m5): one handle per recovery run — `keysOpen` after the sync (the keys
 * are live only while matching), `keysClose` in a `finally`. The caller's seed is consumed:
 * zero-filled on every path, also when the sync fails before the keys are opened.
 */
import type {Connection} from '@solana/web3.js';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {mmkvSecure} from '../../../store/mmkv/instances';
import {
  a0Commitment,
  a0DepositRho,
  a0KeysClose,
  a0KeysOpen,
  a0MatchSpent,
} from '../../zkProver/nativeProverBridge';
import type {A0Handle} from '../../zkProver/nativeProverBridge';
import {A0NoteStoreError, mergeA0RecoveredNotes} from './noteStore';
import type {A0Note} from './noteStore';
import type {A0DepositRecord, A0SyncedTx} from './syncedTx';
import {syncA0Tree} from './treeSync';
import type {A0SyncOptions, A0VerifiedTree} from './treeSync';

/** Consecutive deposit counters without a hit after which the search stops (§7). */
export const A0_DEPOSIT_GAP_LIMIT = 20;

/** R13's indexer trigger: a restore past either makes a coordinator tree indexer a pre-mainnet item (§13). */
export const A0_R13_TRIGGER = {treeTransactions: 5000, durationMs: 60_000} as const;

export type A0RecoveryErrorCode =
  /** a deposit of the synced history whose tx has no LeafInserted of its commitment */
  | 'E_A0_RECOVERY_LEAF'
  /** two successful deposits with one rho (the rho PDA is `init`: the chain cannot hold that) */
  | 'E_A0_RECOVERY_DUPLICATE_RHO'
  /** the native core answered outside its contract (matchSpent indices) */
  | 'E_A0_RECOVERY_NATIVE';

export class A0RecoveryError extends Error {
  readonly code: A0RecoveryErrorCode;
  constructor(code: A0RecoveryErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'A0RecoveryError';
    this.code = code;
  }
}

export interface A0DepositRecovery {
  /** own deposit notes, by counter; `unspent` or `spent`, each with its leaf index */
  notes: A0Note[];
  /** the highest hit (own or foreign) + 1, or 0 */
  nextDepositIndex: bigint;
  /** the highest counter with a hit, own or foreign, or null when none (R1-m4) */
  highestHit: bigint | null;
  /** counters looked up with depositRho */
  indicesTried: number;
  /** hits whose commitment is not ours (not imported) */
  foreignRhoHits: number;
  /** deposits in the synced history, and its Withdraw nullifiers (distinct) */
  depositsInHistory: number;
  withdrawNullifiersInHistory: number;
}

interface Located {
  tx: A0SyncedTx;
  deposit: A0DepositRecord;
}

/**
 * Steps 1–3 over a verified tree with an open handle (no RPC). Task 4's deposit pre-check uses
 * this too, under its own handle, when a rho PDA turns out to exist (§5 step 2 "imports it
 * exactly as recovery does").
 */
export async function recoverA0Deposits(handle: A0Handle, tree: A0VerifiedTree): Promise<A0DepositRecovery> {
  const byRho = new Map<string, Located>();
  for (const tx of tree.txs) {
    for (const deposit of tx.deposits) {
      if (byRho.has(deposit.rho)) {
        throw new A0RecoveryError(
          'E_A0_RECOVERY_DUPLICATE_RHO',
          `rho ${deposit.rho} is deposited by ${byRho.get(deposit.rho)!.tx.signature} and ${tx.signature}`,
        );
      }
      byRho.set(deposit.rho, {tx, deposit});
    }
  }

  const notes: A0Note[] = [];
  let foreignRhoHits = 0;
  let highestHit = -1n;
  let misses = 0;
  let i = 0n;
  for (; misses < A0_DEPOSIT_GAP_LIMIT; i++) {
    const rho = await a0DepositRho(handle, i);
    const hit = byRho.get(rho);
    if (!hit) {
      misses++;
      continue;
    }
    misses = 0;
    highestHit = i;
    const leaves = hit.tx.leafInserted.filter(l => l.commitment === hit.deposit.commitment);
    if (leaves.length !== 1) {
      throw new A0RecoveryError(
        'E_A0_RECOVERY_LEAF',
        `${hit.tx.signature}: ${leaves.length} LeafInserted of the deposit's commitment ${hit.deposit.commitment}`,
      );
    }
    const ours = await a0Commitment(handle, hit.deposit.amount, rho);
    if (ours !== hit.deposit.commitment) {
      foreignRhoHits++;
      continue;
    }
    notes.push({
      commitment: hit.deposit.commitment,
      amount: hit.deposit.amount,
      rho,
      depositIndex: i,
      leafIndex: leaves[0]!.leafIndex,
      status: 'unspent',
    });
  }

  const nullifiers = [...new Set(tree.txs.flatMap(t => t.withdrawNullifiers))];
  if (notes.length > 0) {
    const spent = await a0MatchSpent(
      handle,
      nullifiers,
      notes.map(n => n.rho),
    );
    let prev = -1;
    for (const k of spent) {
      if (!Number.isInteger(k) || k <= prev || k >= notes.length) {
        throw new A0RecoveryError('E_A0_RECOVERY_NATIVE', `matchSpent answered ${JSON.stringify(spent)} for ${notes.length} notes`);
      }
      prev = k;
      notes[k]!.status = 'spent';
    }
  }

  return {
    notes,
    nextDepositIndex: highestHit + 1n,
    highestHit: highestHit < 0n ? null : highestHit,
    indicesTried: Number(i),
    foreignRhoHits,
    depositsInHistory: byRho.size,
    withdrawNullifiersInHistory: nullifiers.length,
  };
}

/** R13's counters of one restore, as the checkpoint reports them (§16 M1b). */
export interface A0RestoreStats {
  /** successful tree transactions in the verified history (R13's "tree transactions") */
  treeTransactions: number;
  failedTransactions: number;
  listedSignatures: number;
  /** getTransaction requests this run made */
  fetchedTransactions: number;
  /** the tree sync alone */
  syncDurationMs: number;
  /** the whole restore: sync, matching (native calls) and the store write — R13's "duration" */
  durationMs: number;
  depositIndicesTried: number;
  depositsInHistory: number;
  withdrawNullifiersInHistory: number;
  ownNotes: number;
  spentNotes: number;
  foreignRhoHits: number;
  /**
   * R1-m4: the highest deposit counter with a hit, own or foreign, or null when none. With the
   * gap limit at 20 and a counter that is never handed back, 20 consecutive expired or front-run
   * counters hide every later own deposit from a restore; this shows how far the walk found hits.
   */
  highestHit: number | null;
  /** UTC, ISO 8601 */
  finishedAt: string;
  /** R13: more than 5,000 tree transactions or more than 60 s */
  r13TriggerReached: boolean;
}

export interface A0RestoreResult {
  notes: A0Note[];
  nextDepositIndex: bigint;
  stats: A0RestoreStats;
}

export function a0R13TriggerReached(s: {treeTransactions: number; durationMs: number}): boolean {
  return s.treeTransactions > A0_R13_TRIGGER.treeTransactions || s.durationMs > A0_R13_TRIGGER.durationMs;
}

/**
 * A full restore (§7): sync the tree, recover the deposits under a fresh handle, merge them into
 * the note store, record R13's counters. `seed` (64 bytes) is consumed — zero-filled on every
 * path. Throws the sync's `A0SyncError`, an `A0RecoveryError`, the native core's `E_A0_…`
 * refusals, or the note store's `A0NoteStoreError` (e.g. `E_A0_STORE_LOCKED`); on any throw the
 * store is unchanged.
 */
export async function restoreA0FromSeed(
  connection: Connection,
  seed: Uint8Array,
  options: {sync?: A0SyncOptions} = {},
): Promise<A0RestoreResult> {
  const started = Date.now();
  try {
    if (!mmkvSecure()) {
      // before the walk, not after it: a restore that cannot keep its result does not start
      throw new A0NoteStoreError('E_A0_STORE_LOCKED', 'the encrypted store is not open');
    }
    const {tree, stats: sync} = await syncA0Tree(connection, options.sync);
    const handle = await a0KeysOpen(seed);
    let rec: A0DepositRecovery;
    try {
      rec = await recoverA0Deposits(handle, tree);
    } finally {
      await a0KeysClose(handle);
    }
    mergeA0RecoveredNotes(rec.notes, rec.nextDepositIndex);
    const durationMs = Date.now() - started;
    const stats: A0RestoreStats = {
      treeTransactions: sync.totalTransactions,
      failedTransactions: sync.failedTransactions,
      listedSignatures: sync.listedSignatures,
      fetchedTransactions: sync.fetchedTransactions,
      syncDurationMs: sync.durationMs,
      durationMs,
      depositIndicesTried: rec.indicesTried,
      depositsInHistory: rec.depositsInHistory,
      withdrawNullifiersInHistory: rec.withdrawNullifiersInHistory,
      ownNotes: rec.notes.length,
      spentNotes: rec.notes.filter(n => n.status === 'spent').length,
      foreignRhoHits: rec.foreignRhoHits,
      highestHit: rec.highestHit === null ? null : Number(rec.highestHit),
      finishedAt: new Date().toISOString(),
      r13TriggerReached: a0R13TriggerReached({treeTransactions: sync.totalTransactions, durationMs}),
    };
    mmkvSecure()?.set(MMKV_KEYS.A0_LAST_RESTORE, JSON.stringify(stats));
    return {notes: rec.notes, nextDepositIndex: rec.nextDepositIndex, stats};
  } finally {
    seed.fill(0);
  }
}

/** The last restore's R13 counters (encrypted instance), or null. */
export function loadA0LastRestoreStats(): A0RestoreStats | null {
  const raw = mmkvSecure()?.getString(MMKV_KEYS.A0_LAST_RESTORE);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as A0RestoreStats;
  } catch {
    return null;
  }
}
