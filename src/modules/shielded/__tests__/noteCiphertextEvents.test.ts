import {parseNoteCiphertextEvents} from '../noteCiphertextEvents';

function ncLine(leafIndex: number, ct: Uint8Array): string {
  const buf = Buffer.alloc(8 + 8 + 4 + 128);
  buf.writeUInt32LE(leafIndex, 8);       // leaf_index low 32 bits (u64 LE)
  buf.writeUInt32LE(128, 8 + 8);         // Vec<u8> len
  Buffer.from(ct).copy(buf, 8 + 8 + 4);
  return `Program data: ${buf.toString('base64')}`;
}

describe('parseNoteCiphertextEvents', () => {
  it('parses 148-byte NoteCiphertext events', () => {
    const ct = new Uint8Array(128).fill(9);
    const out = parseNoteCiphertextEvents(['Program log: x', ncLine(6, ct)]);
    expect(out).toEqual([{leafIndex: 6, ciphertext: ct}]);
  });
  it('ignores non-148-byte program-data lines (LeafInserted 80, Transfer 72)', () => {
    const leaf80 = `Program data: ${Buffer.alloc(80).toString('base64')}`;
    const transfer72 = `Program data: ${Buffer.alloc(72).toString('base64')}`;
    expect(parseNoteCiphertextEvents([leaf80, transfer72])).toEqual([]);
  });
  it('ignores a line whose len prefix isn\'t 128', () => {
    const buf = Buffer.alloc(8 + 8 + 4 + 128);
    buf.writeUInt32LE(64, 8 + 8); // wrong len
    expect(parseNoteCiphertextEvents([`Program data: ${buf.toString('base64')}`])).toEqual([]);
  });
});
