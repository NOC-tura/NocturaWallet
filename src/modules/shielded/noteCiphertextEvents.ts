const DISC = 8;
const LEAF_INDEX = 8;
const LEN = 4;
const CT = 128;
const EVENT_LEN = DISC + LEAF_INDEX + LEN + CT; // 148

export interface NoteCiphertextEvent {
  leafIndex: number;
  ciphertext: Uint8Array;
}

/**
 * Parse Anchor `NoteCiphertext{leaf_index:u64, ciphertext:Vec<u8>=128}` events
 * from a transaction's log messages.
 * Borsh layout: disc(8) + leaf_index(u64 LE, 8) + Vec len(u32 LE, 4)=128 + ciphertext(128) = 148 B.
 * Lines that decode to a different byte length are ignored (e.g. the 80-B
 * LeafInserted and 72-B Transfer events). Lines with a Vec len prefix != 128
 * are also ignored.
 */
export function parseNoteCiphertextEvents(logs: string[]): NoteCiphertextEvent[] {
  const out: NoteCiphertextEvent[] = [];
  for (const line of logs) {
    const m = line.match(/^Program data: (.+)$/);
    if (!m) continue;
    const buf = Buffer.from(m[1]!, 'base64');
    if (buf.length !== EVENT_LEN) continue;
    let leafIndex = 0n;
    for (let i = 0; i < LEAF_INDEX; i++) {
      leafIndex |= BigInt(buf[DISC + i]!) << BigInt(8 * i);
    }
    let len = 0;
    for (let i = 0; i < LEN; i++) {
      len |= buf[DISC + LEAF_INDEX + i]! << (8 * i);
    }
    if (len !== CT) continue;
    out.push({
      leafIndex: Number(leafIndex),
      ciphertext: Uint8Array.from(buf.subarray(DISC + LEAF_INDEX + LEN, EVENT_LEN)),
    });
  }
  return out;
}
