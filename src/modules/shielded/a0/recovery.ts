/**
 * Recovery from the seed (spec §7: "Deposits", "Change notes", "Accounts"; R1, R12, R13, I6).
 *
 * LOCAL MATCHING ONLY (I-3). Recovery reads the pool's whole history through the same tree sync
 * every client runs (`syncA0Tree`: one signature walk over 5URd…, one getTransaction per listed
 * pool tx, the tree account) and matches it here, on the device. It makes no other request: no
 * rho-PDA lookup, no nullifier-PDA lookup, no getTransaction of a signature it picked, no balance
 * or history read of a recovered account — so the RPC provider sees the same requests from a
 * restoring wallet as from any other (proved by `__tests__/restoreRequests.test.ts` with a
 * recording Connection, positive controls included, over deposits, change notes and an exit
 * account).
 *
 * DEPOSITS (§7 "Deposits", `recoverA0Deposits`):
 *   1. the rho set: the `rho` argument of every `deposit` in the synced history. For
 *      i = 0, 1, 2, …: `depositRho(i)` (Rust) and look for it there; stop after
 *      `A0_DEPOSIT_GAP_LIMIT` (100, S15) consecutive misses (deposits are sequential; a gap only
 *      comes from a failed, expired or front-run tx — a counter is never handed back);
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
 * CHANGE NOTES (§7 "Change notes", `recoverA0ChangeNotes`; M1c). For each spent own note, its
 * spending tx is found by ATTRIBUTION: per synced `Withdraw` nullifier `n` (public — it is on
 * chain), one local `matchSpent(handle, [n], spentRhos)` answers which still-unattributed spent
 * note `n` spends, if any; that tx's signature becomes the note's `spentTx` (§8). Then, from that
 * tx's `withdraw_with_change` whose nullifier argument is `n` (two chain values compared):
 *   - `rho_change = Poseidon3(TAG_RHO = 0x13, n, 0)` — computed HERE in JS, from the public
 *     nullifier (`a0ChangeRho`, the frozen equation of `fieldEquations.ts`);
 *   - `changeAmount = inputAmount − amount − fee` (the instruction's `amount` and `fee`);
 *   - Rust's `commitment(changeAmount, rho_change)` (d_self implicit) must equal the
 *     instruction's `change_commitment`, and that value's LeafInserted in the same tx gives the
 *     leaf index. A change leaf that is not ours (the note was spent by a holder of `nk` with
 *     another `change_d`, which our wallet never uses) is counted (`unmatchedChangeLeaves`) and
 *     not imported; the note is spent all the same.
 * The new change notes' spent-status is ONE further `matchSpent` over every synced nullifier, and
 * the attribution repeats for the ones spent (the recursion of §7), until no spent note is left
 * unattributed. Each round attributes at least one nullifier (else `E_A0_RECOVERY_NATIVE`: the
 * core said "spent" and then named no spender), so it ends within the history's nullifier count.
 *
 * ACCOUNTS (§7 "Accounts", I6; `recoverA0ExitAccountIndices`; `slip10` wallets only, S9): the
 * destination token account of every withdrawal that spent one of our notes is compared with
 * `ATA(slip10:n, mint)` for n = 0, 1, 2, … (derived locally from the seed); a match is an exit
 * account of this seed. The walk stops `A0_ACCOUNT_DISCOVERY_GAP` (20, controller ruling 7 — S15
 * is the DEPOSIT gap only) consecutive indices past the highest match, or as soon as every
 * destination is matched (no later index can match one more). The matched indices become
 * `fresh-exit` in the registry (`addA0RecoveredExitAccounts`, one write; the main and existing
 * exits stay as they are).
 *
 * HANDLE LIFETIME (§3 m5): one handle per recovery run — `keysOpen` after the sync (the keys
 * are live only while matching), `keysClose` in a `finally`. The caller's seed is consumed:
 * zero-filled on every path, also when the sync fails before the keys are opened; the account
 * walk derives from it after the handle is closed (`keysOpen` is given a copy, which it wipes).
 */
import {PublicKey} from '@solana/web3.js';
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
import {loadTransparentScheme} from '../../keyDerivation/derivationScheme';
import {
  A0_ACCOUNT_DISCOVERY_GAP,
  A0_MAX_ACCOUNT_INDEX,
  a0AccountAddress,
  addA0RecoveredExitAccounts,
} from './accountRegistry';
import {rhoOut, toBe32Hex} from './fieldEquations';
import {A0NoteStoreError, mergeA0RecoveredNotes} from './noteStore';
import type {A0StoreBinding} from './noteStore';
import type {A0Note} from './noteStore';
import {a0AtaOf} from './relayerClient';
import type {A0DepositRecord, A0SyncedTx, A0WithdrawRecord} from './syncedTx';
import {syncA0Tree} from './treeSync';
import type {A0SyncOptions, A0VerifiedTree} from './treeSync';

/**
 * Consecutive deposit counters without a hit after which the search stops (§7). S15 (lands with
 * M1c): 100, was 20 — a counter is never handed back, so expired or front-run deposits each burn
 * one, and 100 of them in a row (not 20) now hide later deposits from a restore. The cost is up to
 * 80 more local `depositRho` calls per restore; no request.
 */
export const A0_DEPOSIT_GAP_LIMIT = 100;

/** R13's indexer trigger: a restore past either makes a coordinator tree indexer a pre-mainnet item (§13). */
export const A0_R13_TRIGGER = {treeTransactions: 5000, durationMs: 60_000} as const;

export type A0RecoveryErrorCode =
  /** a deposit of the synced history whose tx has no LeafInserted of its commitment */
  | 'E_A0_RECOVERY_LEAF'
  /** two successful deposits with one rho (the rho PDA is `init`: the chain cannot hold that) */
  | 'E_A0_RECOVERY_DUPLICATE_RHO'
  /** the native core answered outside its contract (matchSpent indices) */
  | 'E_A0_RECOVERY_NATIVE'
  /** two successful withdrawals with one nullifier (the nullifier PDA is `init`: the chain cannot hold that) */
  | 'E_A0_RECOVERY_DUPLICATE_NULLIFIER';

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
    for (const k of checkedIndices(spent, notes.length)) {
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

/** `matchSpent`'s answer held to its contract: integers, ascending, each < `count`. */
function checkedIndices(answer: number[], count: number): number[] {
  let prev = -1;
  for (const k of answer) {
    if (!Number.isInteger(k) || k <= prev || k >= count) {
      throw new A0RecoveryError('E_A0_RECOVERY_NATIVE', `matchSpent answered ${JSON.stringify(answer)} for ${count} notes`);
    }
    prev = k;
  }
  return answer;
}

/**
 * `rho_change = Poseidon3(TAG_RHO = 0x13, nullifier, 0)` (§3 "Change note"; the circuit's `RhoOut`
 * with index 0; the program side's golden step `rho_change`). The input is a PUBLIC nullifier —
 * one that is on chain already — never an unspent note's (R12). 64 lowercase BE hex in and out.
 */
export function a0ChangeRho(nullifierHex: string): string {
  return toBe32Hex(rhoOut(BigInt(`0x${nullifierHex}`), 0));
}

/** `changeAmount = inputAmount − withdrawAmount − fee` (§3), or null when the spend exceeds the input. */
export function a0ChangeAmount(inputAmount: bigint, withdrawAmount: bigint, fee: bigint): bigint | null {
  const change = inputAmount - withdrawAmount - fee;
  return change < 0n ? null : change;
}

export interface A0ChangeRecovery {
  /**
   * the notes given (each spent one now naming its `spentTx`), then every change note found, in
   * the order found; change notes are `unspent` or `spent`, with a leaf index, no depositIndex
   */
  notes: A0Note[];
  /** change notes imported */
  changeNotes: number;
  /** spends of our notes whose change leaf is not ours (or whose withdrawal could not be read) — not imported */
  unmatchedChangeLeaves: number;
  /** the destination token account of every withdrawal that spent one of our notes, distinct, in the order found */
  exitDestinations: string[];
  /** the attribution's `matchSpent([n], …)` calls (local; for the checkpoint's numbers) */
  attributionCalls: number;
}

interface Spender {
  tx: A0SyncedTx;
  /** the top-level withdraw_with_change whose nullifier argument is the event's, or null */
  withdrawal: A0WithdrawRecord | null;
}

/**
 * §7 "Change notes" over a verified tree with an open handle (no RPC): attribute every spent note
 * of `notes` to its spending tx (`spentTx`), recover its change note, and recurse. `notes` are the
 * deposit notes `recoverA0Deposits` returned (their spent-status already from its one
 * `matchSpent`); they are copied, not changed.
 */
export async function recoverA0ChangeNotes(
  handle: A0Handle,
  tree: A0VerifiedTree,
  deposits: readonly A0Note[],
): Promise<A0ChangeRecovery> {
  const notes: A0Note[] = deposits.map(n => ({...n}));
  /** indices into `notes` of spent notes not yet attributed to a nullifier */
  let waiting = notes.flatMap((n, k) => (n.status === 'spent' ? [k] : []));
  if (waiting.length === 0) {
    // nothing of ours is spent: no change note can exist, and no matchSpent is made
    return {notes, changeNotes: 0, unmatchedChangeLeaves: 0, exitDestinations: [], attributionCalls: 0};
  }
  const spenders = new Map<string, Spender>();
  for (const tx of tree.txs) {
    for (const n of tx.withdrawNullifiers) {
      if (spenders.has(n)) {
        throw new A0RecoveryError(
          'E_A0_RECOVERY_DUPLICATE_NULLIFIER',
          `nullifier ${n} is spent by ${spenders.get(n)!.tx.signature} and ${tx.signature}`,
        );
      }
      spenders.set(n, {tx, withdrawal: tx.withdrawals.find(w => w.nullifier === n) ?? null});
    }
  }
  const allNullifiers = [...spenders.keys()];
  const open = [...allNullifiers];
  const destinations: string[] = [];
  let changeNotes = 0;
  let unmatchedChangeLeaves = 0;
  let attributionCalls = 0;

  while (waiting.length > 0) {
    const found: A0Note[] = [];
    let attributed = 0;
    for (const n of [...open]) {
      if (waiting.length === 0) {
        break;
      }
      attributionCalls++;
      const answer = checkedIndices(
        await a0MatchSpent(
          handle,
          [n],
          waiting.map(k => notes[k]!.rho),
        ),
        waiting.length,
      );
      if (answer.length === 0) {
        continue;
      }
      if (answer.length > 1) {
        throw new A0RecoveryError('E_A0_RECOVERY_NATIVE', `matchSpent named ${answer.length} notes for one nullifier`);
      }
      const k = waiting[answer[0]!]!;
      waiting = waiting.filter(j => j !== k);
      open.splice(open.indexOf(n), 1);
      attributed++;
      const {tx, withdrawal: w} = spenders.get(n)!;
      const note = notes[k]!;
      note.spentTx = tx.signature;
      if (w === null) {
        unmatchedChangeLeaves++; // a Withdraw event without its instruction: spent, no change to read
        continue;
      }
      if (!destinations.includes(w.destination)) {
        destinations.push(w.destination);
      }
      const changeAmount = a0ChangeAmount(note.amount, w.amount, w.fee);
      if (changeAmount === null) {
        unmatchedChangeLeaves++;
        continue;
      }
      const rho = a0ChangeRho(n);
      const commitment = await a0Commitment(handle, changeAmount, rho);
      if (commitment !== w.changeCommitment) {
        unmatchedChangeLeaves++;
        continue;
      }
      const leaves = tx.leafInserted.filter(l => l.commitment === commitment);
      if (leaves.length !== 1) {
        throw new A0RecoveryError(
          'E_A0_RECOVERY_LEAF',
          `${tx.signature}: ${leaves.length} LeafInserted of the change commitment ${commitment}`,
        );
      }
      found.push({commitment, amount: changeAmount, rho, leafIndex: leaves[0]!.leafIndex, status: 'unspent'});
    }
    if (attributed === 0) {
      throw new A0RecoveryError(
        'E_A0_RECOVERY_NATIVE',
        `${waiting.length} notes are spent and no synced nullifier spends them`,
      );
    }
    if (found.length > 0) {
      const base = notes.length;
      notes.push(...found);
      changeNotes += found.length;
      const spent = checkedIndices(
        await a0MatchSpent(
          handle,
          allNullifiers,
          found.map(f => f.rho),
        ),
        found.length,
      );
      for (const j of spent) {
        notes[base + j]!.status = 'spent';
        waiting.push(base + j);
      }
    }
  }
  return {notes, changeNotes, unmatchedChangeLeaves, exitDestinations: destinations, attributionCalls};
}

export interface A0ExitAccountRecovery {
  /** the `slip10` indices whose ATA is an exit destination, ascending */
  indices: number[];
  /** indices derived */
  tried: number;
}

/**
 * §7 "Accounts" (I6): which `slip10:n` of `seed` own the exit `destinations` — `ATA(slip10:n,
 * mint)` for n = 0, 1, …, stopping `A0_ACCOUNT_DISCOVERY_GAP` indices past the highest match (or
 * when every destination is matched). Local only; writes nothing. A `cli` wallet has no exit
 * accounts (S9): nothing is derived. `seed` is borrowed (not wiped here).
 */
export function recoverA0ExitAccountIndices(seed: Uint8Array, destinations: readonly string[]): A0ExitAccountRecovery {
  if (loadTransparentScheme().kind === 'cli' || destinations.length === 0) {
    return {indices: [], tried: 0};
  }
  const want = new Set(destinations);
  const indices: number[] = [];
  let highest = -1;
  let n = 0;
  for (; n <= highest + A0_ACCOUNT_DISCOVERY_GAP && n <= A0_MAX_ACCOUNT_INDEX && indices.length < want.size; n++) {
    const owner = new PublicKey(a0AccountAddress(seed, {kind: 'slip10', account: n}));
    if (want.has(a0AtaOf(owner).toBase58())) {
      indices.push(n);
      highest = n;
    }
  }
  return {indices, tried: n};
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
  /** own notes recovered: deposits AND change notes */
  ownNotes: number;
  spentNotes: number;
  foreignRhoHits: number;
  /**
   * R1-m4: the highest deposit counter with a hit, own or foreign, or null when none. With the
   * gap limit at 100 (S15) and a counter that is never handed back, 100 consecutive expired or
   * front-run counters hide every later own deposit from a restore; this shows how far the walk
   * found hits.
   */
  highestHit: number | null;
  /** M1c: change notes among `ownNotes` (§7 "Change notes") */
  changeNotes: number;
  /** M1c: spends of our notes whose change leaf is not ours — not imported */
  unmatchedChangeLeaves: number;
  /** M1c: the attribution's local matchSpent([n], …) calls */
  attributionCalls: number;
  /** M1c: `slip10` indices derived by the account walk (§7 "Accounts"), and the exit accounts it matched */
  accountIndicesTried: number;
  exitAccounts: number;
  /** UTC, ISO 8601 */
  finishedAt: string;
  /** R13: more than 5,000 tree transactions or more than 60 s */
  r13TriggerReached: boolean;
}

export interface A0RestoreResult {
  notes: A0Note[];
  nextDepositIndex: bigint;
  /** the `slip10:n` schemes the restore added to the registry as `fresh-exit` (or promoted to it) */
  exitAccounts: string[];
  stats: A0RestoreStats;
}

export function a0R13TriggerReached(s: {treeTransactions: number; durationMs: number}): boolean {
  return s.treeTransactions > A0_R13_TRIGGER.treeTransactions || s.durationMs > A0_R13_TRIGGER.durationMs;
}

/**
 * A full restore (§7): sync the tree, recover the deposits and their change notes under a fresh
 * handle, find the exit accounts, write the registry and then the note store, record R13's
 * counters. `seed` (64 bytes) is consumed — zero-filled on every path. Throws the sync's
 * `A0SyncError`, an `A0RecoveryError`, the native core's `E_A0_…` refusals, the registry's
 * `A0AccountRegistryError` (e.g. `E_A0_ACCOUNTS_CORRUPT`, `E_A0_ACCOUNTS_MAIN`) or the note
 * store's `A0NoteStoreError` (e.g. `E_A0_STORE_LOCKED`); on a throw before the registry write
 * nothing is written.
 *
 * WRITE ORDER: the registry first, then the notes. The note record's absence is what makes the
 * next start restore again (startup.ts), so a registry write that fails leaves no note record
 * and the restore repeats; the registry write is idempotent (an index already `fresh-exit` is left
 * as it is). The reverse order could leave the notes written and the exit accounts lost.
 *
 * BOUND (R1-C1): the restore is bound to the encrypted instance open at its start (or the one its
 * caller captured, `options.bound` — the startup run's). If a wipe + import replaced it while the
 * walk was in flight, the registry write, the merge and the R13 stats write refuse with
 * `E_A0_STORE_CHANGED`: nothing of this wallet lands in the new one, whose record stays absent so
 * it restores itself.
 */
export async function restoreA0FromSeed(
  connection: Connection,
  seed: Uint8Array,
  options: {sync?: A0SyncOptions; bound?: A0StoreBinding} = {},
): Promise<A0RestoreResult> {
  const started = Date.now();
  // keysOpen consumes what it is given; the account walk needs the seed after the handle closed
  const keySeed = seed.slice();
  try {
    const bound = options.bound ?? mmkvSecure();
    if (!bound || !mmkvSecure()) {
      // before the walk, not after it: a restore that cannot keep its result does not start
      throw new A0NoteStoreError('E_A0_STORE_LOCKED', 'the encrypted store is not open');
    }
    if (mmkvSecure() !== bound) {
      throw new A0NoteStoreError('E_A0_STORE_CHANGED', 'the encrypted store was replaced before the restore started');
    }
    const {tree, stats: sync} = await syncA0Tree(connection, options.sync);
    const handle = await a0KeysOpen(keySeed);
    let rec: A0DepositRecovery;
    let change: A0ChangeRecovery;
    try {
      rec = await recoverA0Deposits(handle, tree);
      change = await recoverA0ChangeNotes(handle, tree, rec.notes);
    } finally {
      await a0KeysClose(handle);
    }
    const accounts = recoverA0ExitAccountIndices(seed, change.exitDestinations);
    const exitAccounts = addA0RecoveredExitAccounts(accounts.indices, seed, {bound});
    mergeA0RecoveredNotes(change.notes, rec.nextDepositIndex, bound);
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
      ownNotes: change.notes.length,
      spentNotes: change.notes.filter(n => n.status === 'spent').length,
      foreignRhoHits: rec.foreignRhoHits,
      highestHit: rec.highestHit === null ? null : Number(rec.highestHit),
      changeNotes: change.changeNotes,
      unmatchedChangeLeaves: change.unmatchedChangeLeaves,
      attributionCalls: change.attributionCalls,
      accountIndicesTried: accounts.tried,
      exitAccounts: accounts.indices.length,
      finishedAt: new Date().toISOString(),
      r13TriggerReached: a0R13TriggerReached({treeTransactions: sync.totalTransactions, durationMs}),
    };
    if (mmkvSecure() !== bound) {
      // no await since the registry write, so not reachable today; kept so a later await cannot open it
      throw new A0NoteStoreError('E_A0_STORE_CHANGED', 'the encrypted store was replaced during the restore');
    }
    bound.set(MMKV_KEYS.A0_LAST_RESTORE, JSON.stringify(stats));
    return {notes: change.notes, nextDepositIndex: rec.nextDepositIndex, exitAccounts, stats};
  } finally {
    keySeed.fill(0);
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
