import {parseNoteCiphertextEvents} from '../noteCiphertextEvents';
import {EVENT_DISC} from '../eventLogs';
import {SHIELDED_POOL_PROGRAM_ID as POOL} from '../../../constants/programs';

const TREE = 'OurTree11111111111111111111111111111111111';

/** A tx whose top-level instruction targets `prog` and lists our merkle tree. */
function txFrom(prog: string, ...lines: string[]) {
  return {
    meta: {
      logMessages: [`Program ${prog} invoke [1]`, ...lines, `Program ${prog} success`],
      loadedAddresses: null,
    },
    transaction: {
      message: {
        staticAccountKeys: [prog, TREE],
        compiledInstructions: [{programIdIndex: 0, accountKeyIndexes: [1]}],
      },
    },
  };
}
const inPoolInvoke = (...lines: string[]) => txFrom(POOL, ...lines);

function ncLine(leafIndex: number, ct: Uint8Array): string {
  const buf = Buffer.alloc(8 + 8 + 4 + 128);
  Buffer.from(EVENT_DISC.noteCiphertext, 'hex').copy(buf, 0);
  buf.writeUInt32LE(leafIndex, 8);       // leaf_index low 32 bits (u64 LE)
  buf.writeUInt32LE(128, 8 + 8);         // Vec<u8> len
  Buffer.from(ct).copy(buf, 8 + 8 + 4);
  return `Program data: ${buf.toString('base64')}`;
}

describe('parseNoteCiphertextEvents', () => {
  it('parses 148-byte NoteCiphertext events', () => {
    const ct = new Uint8Array(128).fill(9);
    const out = parseNoteCiphertextEvents(inPoolInvoke('Program log: x', ncLine(6, ct)), TREE);
    expect(out).toEqual([{leafIndex: 6, ciphertext: ct}]);
  });
  it('ignores non-148-byte program-data lines (LeafInserted 80, Transfer 72)', () => {
    const leaf80 = `Program data: ${Buffer.alloc(80).toString('base64')}`;
    const transfer72 = `Program data: ${Buffer.alloc(72).toString('base64')}`;
    expect(parseNoteCiphertextEvents(inPoolInvoke(leaf80, transfer72), TREE)).toEqual([]);
  });
  it('ignores a line whose len prefix isn\'t 128', () => {
    const buf = Buffer.alloc(8 + 8 + 4 + 128);
    buf.writeUInt32LE(64, 8 + 8); // wrong len
    expect(
      parseNoteCiphertextEvents(inPoolInvoke(`Program data: ${buf.toString('base64')}`), TREE),
    ).toEqual([]);
  });

  it('REJECTS a correctly-shaped ciphertext forged by another program', () => {
    // Balance-inflation vector: a forged ciphertext encrypted to the victim's
    // public noc1... address would otherwise credit them a phantom note.
    const ct = new Uint8Array(128).fill(9);
    const evil = 'EViL1111111111111111111111111111111111111111';
    expect(parseNoteCiphertextEvents(txFrom(evil, ncLine(6, ct)), TREE)).toEqual([]);
  });
});
