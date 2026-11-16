/**
 * What the shield screens (#16 → #18 → #19 → #20 → #21, M1b Task "screens") share about the A0
 * deposit and nothing else: the pool's token as the screens name it, the SOL a deposit costs, the
 * error text, and the one prepared deposit carried from #18 to #21.
 *
 * THE PREPARED DEPOSIT IS HELD HERE, NOT IN NAVIGATION PARAMS. It carries a 256-byte proof and
 * BigInts (not serializable params), and a param can be forged by a deep link — so the screens pass
 * only an opaque id (`ShieldIntent.preparedId`). At most one prepared deposit exists (a new #18 run
 * replaces it: every prepare takes the same next counter, so an older one is worthless), and #21
 * TAKES it (`releasePreparedA0Deposit`): a second mount, a back-and-forward or a forged route finds
 * nothing to submit — one prepared deposit is submitted at most once (cardinal rule 6, and Task 4's
 * "one blockhash, one pending write, one send").
 */
import {A0} from './constants';
import type {A0PreparedDeposit} from './depositFlow';
import {formatTokenAmount, groupInteger} from '../../../utils/parseTokenAmount';

/** The pool's mint as the screens show it. Devnet's A0 pool takes a test mint standing in for NOC. */
export const A0_TOKEN = {
  mint: A0.mint,
  symbol: 'TEST',
  name: 'Devnet test token',
  decimals: A0.mintDecimals,
} as const;

/** One signature, no compute-unit price (the deposit sets only a CU limit): 5,000 lamports —
 *  the landed deposit 3DR6F7oW…'s `meta.fee` (screenSupport.test.ts reads the fixture). */
export const A0_DEPOSIT_FEE_LAMPORTS = 5_000n;

/** The rent the depositor pays for the deposit's rho marker account (`init` in `deposit`):
 *  695,960 lamports — the marker's post-balance in the landed deposit 3DR6F7oW… (devnet, slot
 *  520075903), read from the committed fixture by screenSupport.test.ts. Shown as approximate:
 *  the cluster's rent rate decides it, not this app. */
export const A0_RHO_MARKER_RENT_LAMPORTS = 695_960n;

export const SOL_DECIMALS = 9;

/** Grouped display of base units, exact (BigInt; Hermes does not group with toLocaleString). */
export function displayAmount(units: bigint, decimals: number): string {
  const s = formatTokenAmount(units, decimals);
  const [whole, frac] = s.split('.');
  return frac ? `${groupInteger(whole ?? '0')}.${frac}` : groupInteger(whole ?? '0');
}

/** `code` + text of any A0 refusal (`A0DepositError`, `A0NoteStoreError`, `A0SyncError`, a native
 *  `E_A0_*` rejection) — the screens show the code, never a bare "something went wrong". */
export function a0ErrorText(e: unknown): {code: string | null; message: string} {
  const raw = e instanceof Error ? e.message : String(e);
  const own = (e as {code?: unknown} | null)?.code;
  const code =
    typeof own === 'string' && /^E_[A-Z0-9_]+$/.test(own) ? own : (/^(E_[A-Z0-9_]+)\b/.exec(raw)?.[1] ?? null);
  const message = code && raw.startsWith(`${code}: `) ? raw.slice(code.length + 2) : raw;
  return {code, message};
}

let held: {id: string; deposit: A0PreparedDeposit} | null = null;
let seq = 0;

/** Hold `deposit` for #19–#21 and return its id; replaces any earlier one. */
export function holdPreparedA0Deposit(deposit: A0PreparedDeposit): string {
  seq += 1;
  held = {id: `a0-deposit-${seq}`, deposit};
  return held.id;
}

/** The held deposit with this id, or null (none, replaced, or already submitted). */
export function preparedA0Deposit(id: string): A0PreparedDeposit | null {
  return held && held.id === id ? held.deposit : null;
}

/** Take the held deposit for submitting: returns it once, then null for that id. */
export function releasePreparedA0Deposit(id: string): A0PreparedDeposit | null {
  if (!held || held.id !== id) {
    return null;
  }
  const {deposit} = held;
  held = null;
  return deposit;
}

/** TEST-ONLY. */
export function resetPreparedA0DepositsForTests(): void {
  held = null;
}
