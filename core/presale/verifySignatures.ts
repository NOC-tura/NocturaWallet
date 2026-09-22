/**
 * Ask the chain whether each recorded signature actually landed.
 *
 * This exists because a signature the coordinator marked `confirmed` turned out not to
 * exist on chain at all: row `27BRB9fc…PtWv`, 109.763651379 NOC, written with
 * `retry_count: 0`, `error_message: null` and `created_at === processed_at` to the
 * millisecond — recorded optimistically before the transaction was confirmed, and never
 * checked back. `getSignatureStatuses` with `searchTransactionHistory` returned null for
 * it, `getTransaction` returned null, and it appeared nowhere in the buyer's own
 * allocation-account history while both of its same-day neighbours did.
 *
 * A page whose whole purpose is proof cannot pass that through. A row linking to an
 * explorer page that shows nothing is worse than no row: the reader cannot tell it from
 * a real one. So the page stops taking the backend's word for it and asks the chain.
 */

/** What the chain says about one signature. Four answers, and they are not three. */
export type SignatureVerdict =
  /** The chain has it and it succeeded. */
  | 'confirmed'
  /** The chain has it and it failed — on chain, but it moved nothing. */
  | 'failed'
  /** The chain does not know this signature. */
  | 'missing'
  /**
   * WE could not ask. Never rendered as a claim about the purchase.
   *
   * This is the whole reason the type has four members. Folding this into `missing`
   * would make an RPC outage tell a buyer their purchase does not exist — the same
   * defect as reporting "no allocation" for a failed read, with higher stakes, because
   * this one accuses us of having taken money for nothing.
   */
  | 'unknown';

/** Just the one call, so nothing here needs a `Connection`. */
export interface SignatureStatusReader {
  /**
   * Statuses in the order asked, `null` where the chain has no record.
   * Implementations MUST search transaction history, not just the recent cache — these
   * signatures are months old.
   */
  getSignatureStatuses(signatures: string[]): Promise<Array<{err: unknown} | null>>;
}

/** getSignatureStatuses takes at most 256 signatures per call. */
export const MAX_SIGNATURES_PER_CALL = 256;

/**
 * Base58 (no 0, O, I, l) at the length a 64-byte signature encodes to.
 *
 * Checked before asking, because one malformed string makes the RPC reject the WHOLE
 * batch — a single broken row would otherwise turn every other row on the page into
 * `unknown`. A string that is not a signature is not on the chain, which is exactly
 * what `missing` says.
 */
const SIGNATURE_SHAPE = /^[1-9A-HJ-NP-Za-km-z]{86,88}$/;

export function isPlausibleSignature(signature: string): boolean {
  return SIGNATURE_SHAPE.test(signature);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Verdict per signature. Never throws: a reader that fails leaves its signatures
 * `unknown`, which the page renders as silence rather than as an accusation.
 */
export async function verifySignatures(
  reader: SignatureStatusReader,
  signatures: string[],
): Promise<Record<string, SignatureVerdict>> {
  const verdicts: Record<string, SignatureVerdict> = {};
  const askable: string[] = [];

  for (const signature of new Set(signatures)) {
    if (isPlausibleSignature(signature)) askable.push(signature);
    else verdicts[signature] = 'missing';
  }

  for (const batch of chunk(askable, MAX_SIGNATURES_PER_CALL)) {
    let statuses: Array<{err: unknown} | null>;
    try {
      statuses = await reader.getSignatureStatuses(batch);
    } catch {
      for (const signature of batch) verdicts[signature] = 'unknown';
      continue;
    }

    batch.forEach((signature, i) => {
      // A short array is the same ignorance as a thrown error, not a "no".
      if (i >= statuses.length) {
        verdicts[signature] = 'unknown';
        return;
      }
      const status = statuses[i];
      if (status === null || status === undefined) verdicts[signature] = 'missing';
      else if (status.err !== null && status.err !== undefined) verdicts[signature] = 'failed';
      else verdicts[signature] = 'confirmed';
    });
  }

  return verdicts;
}
