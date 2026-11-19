/**
 * The A0 pool program's errors, in the wallet's words (M1c; the controller's update R1′ of
 * 2026-11-17: FeGSS… was upgraded to the binary b0054981…, whose IDL 3ac8fda7… appends 6011
 * `CpiNotAllowed` and 6012 `UnexpectedAccounts` to the eleven before).
 *
 * THE BOUNDARY. The codes and names are facts (the IDL of the deployed binary,
 * `__tests__/fixtures/shielded-pool-a0-idl.json`; `programErrors.test.ts` holds this table to it
 * code by code and name by name). The messages are ours: they say what the code means for the
 * person holding the phone, and never claim more than the code does.
 *
 * WHERE A CODE CAN REACH THE WALLET. Only through a transaction the wallet sends itself — the
 * deposit (its preflight simulation, or a confirmation's `err`). An unshield is relayed: the
 * relayer's answer carries an outcome, never a program error (contract §1), so nothing here is
 * read from a relayer body. The deposit is one top-level FeGSS… instruction with exactly the IDL's
 * eight accounts, so 6011 / 6012 from a deposit mean the wallet's own builder is wrong — the
 * messages say so.
 *
 * ATTRIBUTION. A custom error number is only ours if FeGSS… raised it. Two readings, nothing else:
 *   - a log line `Program FeGSS… failed: custom program error: 0x…` (the runtime names the program);
 *   - the instruction index of `Error processing Instruction <i>: custom program error: 0x…` or of
 *     `{InstructionError: [i, {Custom: n}]}`, when the caller says which index is FeGSS…'s.
 * A number from any other program (the token program's 0x1 …) is never mapped.
 */
import {A0} from './constants';

export interface A0ProgramError {
  code: number;
  name: string;
  /** the wallet's sentence for it */
  message: string;
}

/** The deployed binary's errors (IDL 3ac8fda7…), with the wallet's messages. */
export const A0_PROGRAM_ERRORS: readonly A0ProgramError[] = [
  {code: 6000, name: 'BadVkLength', message: 'The pool’s verifying key has the wrong length. Nothing was spent.'},
  {code: 6001, name: 'BadProofLength', message: 'The proof is not the 256 bytes the pool reads. Nothing was spent.'},
  {code: 6002, name: 'InvalidProof', message: 'The pool did not accept the proof. Nothing was spent.'},
  {code: 6003, name: 'Unauthorized', message: 'Only the pool’s authority may do this.'},
  {code: 6004, name: 'AccountMismatch', message: 'An account in the transaction is not the pool’s. Nothing was spent.'},
  {code: 6005, name: 'TreeFull', message: 'The pool’s note tree is full: it takes no new notes.'},
  {code: 6006, name: 'RootNotFound', message: 'The tree root is no longer in the pool’s recent history. Sync and try again.'},
  {code: 6007, name: 'FeeExceedsMax', message: 'The fee is above the pool’s maximum. Nothing was spent.'},
  {code: 6008, name: 'DepositsPaused', message: 'This pool takes no deposits any more. Withdrawals still work.'},
  {code: 6009, name: 'VkChunkOutOfOrder', message: 'The pool’s verifying key is being written out of order.'},
  {code: 6010, name: 'VkIncomplete', message: 'The pool’s verifying key is not complete yet. Nothing was spent.'},
  {
    code: 6011,
    name: 'CpiNotAllowed',
    message:
      'The pool accepts this instruction only at the top level of a transaction. The wallet built it wrong; nothing was spent.',
  },
  {
    code: 6012,
    name: 'UnexpectedAccounts',
    message:
      'The transaction passed the pool more accounts than the instruction takes. The wallet built it wrong; nothing was spent.',
  },
];

const BY_CODE = new Map(A0_PROGRAM_ERRORS.map(e => [e.code, e]));

/** The table's entry for `code`, or null for a number the deployed binary does not raise. */
export function a0ProgramError(code: number): A0ProgramError | null {
  return BY_CODE.get(code) ?? null;
}

function hexCode(h: string): number | null {
  const n = parseInt(h, 16);
  return Number.isSafeInteger(n) ? n : null;
}

const LOG_FAILED = new RegExp(`^Program ${A0.programId} failed: custom program error: 0x([0-9a-fA-F]{1,8})$`);
const MSG_INDEXED = /Error processing Instruction (\d+): custom program error: 0x([0-9a-fA-F]{1,8})\b/;

function logsOf(e: object): unknown[] {
  for (const k of ['transactionLogs', 'logs'] as const) {
    const v = (e as Record<string, unknown>)[k];
    if (Array.isArray(v)) {
      return v;
    }
  }
  return [];
}

/**
 * The FeGSS… error inside `e` — a web3.js `SendTransactionError` (its logs, then its message), a
 * plain `Error` whose message carries the runtime's text, or a `TransactionError` object
 * `{InstructionError: [i, {Custom: n}]}` — or null. `programIxIndex` is the index of the FeGSS…
 * instruction in the transaction (1 in the deposit's `[ComputeBudget, deposit]`); without it only
 * a log line naming FeGSS… attributes a number.
 */
export function a0ProgramErrorOf(e: unknown, programIxIndex?: number): A0ProgramError | null {
  if (e === null || typeof e !== 'object') {
    return null;
  }
  for (const line of logsOf(e)) {
    const m = typeof line === 'string' ? LOG_FAILED.exec(line) : null;
    if (m) {
      const code = hexCode(m[1]!);
      return code === null ? null : a0ProgramError(code);
    }
  }
  if (programIxIndex === undefined) {
    return null;
  }
  const ie = (e as {InstructionError?: unknown}).InstructionError;
  if (Array.isArray(ie) && ie.length === 2 && ie[0] === programIxIndex) {
    const custom = (ie[1] as {Custom?: unknown} | null)?.Custom;
    return typeof custom === 'number' ? a0ProgramError(custom) : null;
  }
  const message = (e as {message?: unknown}).message;
  if (typeof message === 'string') {
    const m = MSG_INDEXED.exec(message);
    if (m && Number(m[1]) === programIxIndex) {
      const code = hexCode(m[2]!);
      return code === null ? null : a0ProgramError(code);
    }
  }
  return null;
}

/** `6011 CpiNotAllowed: <the wallet's message>` — the line a screen shows for a mapped error. */
export function a0ProgramErrorText(p: A0ProgramError): string {
  return `${p.code} ${p.name}: ${p.message}`;
}
