import {bytesToHex} from './fieldCodec';

export interface DepositEvent {
  commitment: string; // 64-char hex
  leafIndex: number;
  root: string;       // 64-char hex
}

const DISC = 8;
const COMMITMENT = 32;
const LEAF_INDEX = 8;
const ROOT = 32;
const EVENT_LEN = DISC + COMMITMENT + LEAF_INDEX + ROOT;

/**
 * Parse Anchor `Deposit` events from a transaction's log messages.
 * Each event is emitted as a base64 `Program data:` line:
 *   disc(8) + commitment[32] + leaf_index(u64 LE) + root[32].
 * Lines that do not decode to an event of the exact length are ignored (other
 * programs / events may also emit `Program data:`).
 */
export function parseDepositEvents(logs: string[]): DepositEvent[] {
  const out: DepositEvent[] = [];
  for (const line of logs) {
    const m = line.match(/^Program data: (.+)$/);
    if (!m) continue;
    const buf = Buffer.from(m[1]!, 'base64');
    if (buf.length !== EVENT_LEN) continue;
    const commitment = bytesToHex(buf.subarray(DISC, DISC + COMMITMENT));
    let leafIndex = 0n;
    for (let i = 0; i < LEAF_INDEX; i++) {
      leafIndex |= BigInt(buf[DISC + COMMITMENT + i]!) << BigInt(8 * i);
    }
    const root = bytesToHex(buf.subarray(DISC + COMMITMENT + LEAF_INDEX, EVENT_LEN));
    out.push({commitment, leafIndex: Number(leafIndex), root});
  }
  return out;
}

/**
 * Order commitments densely by leaf_index (0,1,2,...). Throws on a gap — a
 * missing index would mis-place every later leaf and silently corrupt the tree.
 */
export function orderedLeaves(events: DepositEvent[]): string[] {
  const byIndex = new Map<number, string>();
  for (const e of events) byIndex.set(e.leafIndex, e.commitment);
  const leaves: string[] = [];
  for (let i = 0; i < byIndex.size; i++) {
    const c = byIndex.get(i);
    if (c === undefined) throw new Error(`orderedLeaves: gap at leaf index ${i}`);
    leaves.push(c);
  }
  return leaves;
}
