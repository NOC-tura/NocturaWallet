/**
 * Anchor event-log extraction, scoped to the emitting program.
 *
 * WHY THIS EXISTS. Events reach the wallet as `Program data: <base64>` lines in
 * a transaction's log messages, and the transaction set comes from
 * `getSignaturesForAddress(merkleTreePda)` — which returns EVERY transaction
 * that so much as references the tree PDA, including as a read-only account of
 * an unrelated instruction.
 *
 * Matching on payload length alone (the previous behaviour) therefore accepted
 * blobs authored by anybody. For the price of one transaction fee an attacker
 * could reference the tree PDA, invoke their own program, and log:
 *   - a forged leaf + a ciphertext encrypted to a victim's public address,
 *     inflating that victim's displayed shielded balance with a phantom note; or
 *   - a forged `leafIndex` near 2^20, which makes tree densification throw
 *     permanently — a pool-wide denial of service for every user.
 *
 * Both are closed by requiring (a) the blob to be emitted inside the pool
 * program's own invoke bracket, and (b) the 8-byte Anchor discriminator to match
 * a known event. Either check alone is insufficient: discriminators are public,
 * and any program can log any bytes.
 */

/**
 * `sha256("event:<Name>")[0..8]`, hex, as emitted. Supplied by the program repo
 * on 2026-08-08 — do not recompute these from a local IDL guess.
 *
 * `depositLegacy` matters: `LeafInserted` was renamed from `Deposit` with a
 * deliberately identical 80-byte layout so the old length-based scanner kept
 * working, but the rename CHANGED the discriminator. A parser that accepts only
 * the new one silently drops every pre-upgrade leaf, which breaks
 * restore-from-seed for early notes.
 */
export const EVENT_DISC = {
  leafInserted: '59f3d408d7bfbb98',
  depositLegacy: '3ecdf2aff4a98834',
  noteCiphertext: '6c50afa0eadfd292',
  withdraw: 'c0f1c9d946965af7',
  transfer: '19121707ac74821c',
} as const;

const DISC_LEN = 8;

/** Hex of a blob's leading 8 discriminator bytes, or '' when it is too short. */
export function discriminatorHex(blob: Uint8Array): string {
  if (blob.length < DISC_LEN) return '';
  let out = '';
  for (let i = 0; i < DISC_LEN; i++) {
    out += blob[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

const INVOKE = /^Program (\S+) invoke \[\d+\]$/;
const SUCCESS = /^Program (\S+) success$/;
const FAILED = /^Program (\S+) failed/;
const DATA = /^Program data: (.+)$/;

/**
 * Decode every `Program data:` blob emitted while `programId` was the innermost
 * executing program, and only from invocations that succeeded.
 *
 * Tracks the invoke/success/failed bracket structure so a CPI into another
 * program cannot emit on the pool's behalf, and so blobs logged after the pool
 * returned are excluded. Malformed base64 is skipped rather than thrown.
 */
export function programDataBlobs(logs: string[], programId: string): Uint8Array[] {
  const out: Uint8Array[] = [];
  const stack: string[] = [];
  // Blobs of the current pool frame, held until we see whether it succeeded.
  const pending: Uint8Array[][] = [];

  for (const line of logs) {
    const invoke = INVOKE.exec(line);
    if (invoke) {
      stack.push(invoke[1]!);
      pending.push([]);
      continue;
    }

    const success = SUCCESS.exec(line);
    if (success) {
      const frame = pending.pop();
      stack.pop();
      if (frame && success[1] === programId) out.push(...frame);
      continue;
    }

    if (FAILED.test(line)) {
      // Anything the failed frame logged never took effect on-chain.
      pending.pop();
      stack.pop();
      continue;
    }

    const data = DATA.exec(line);
    if (!data) continue;
    // Attribute to the INNERMOST frame — a CPI's logs belong to the callee.
    if (stack[stack.length - 1] !== programId) continue;

    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(Buffer.from(data[1]!, 'base64'));
    } catch {
      continue;
    }
    // Buffer.from silently yields garbage/empty for invalid base64 rather than
    // throwing, so drop anything too short to carry a discriminator.
    if (bytes.length < DISC_LEN) continue;
    pending[pending.length - 1]?.push(bytes);
  }

  return out;
}
