import {EVENT_DISC, programDataBlobs} from '../eventLogs';

const POOL = 'NPkcJPqrPjWa6Z8kUKuWZ4quzUKh6X8HYaCbmYQ4HfES';
const EVIL = 'EViL1111111111111111111111111111111111111111';

/** Build a `Program data:` line carrying `disc` + `payload`. */
function dataLine(disc: string, payloadLen: number): string {
  const bytes = new Uint8Array(8 + payloadLen);
  for (let i = 0; i < 8; i++) {
    bytes[i] = parseInt(disc.slice(i * 2, i * 2 + 2), 16);
  }
  return `Program data: ${Buffer.from(bytes).toString('base64')}`;
}

describe('programDataBlobs', () => {
  it('returns blobs emitted inside the pool program invoke bracket', () => {
    const logs = [
      `Program ${POOL} invoke [1]`,
      dataLine(EVENT_DISC.leafInserted, 72),
      `Program ${POOL} success`,
    ];
    expect(programDataBlobs(logs, POOL)).toHaveLength(1);
  });

  it('REJECTS a blob emitted by another program', () => {
    // The attack: a third party sends a tx that merely references the merkle
    // tree PDA (so it appears in getSignaturesForAddress) and logs a blob of the
    // right length from their own program. Length alone cannot distinguish it.
    const logs = [
      `Program ${EVIL} invoke [1]`,
      dataLine(EVENT_DISC.leafInserted, 72),
      `Program ${EVIL} success`,
    ];
    expect(programDataBlobs(logs, POOL)).toHaveLength(0);
  });

  it('REJECTS a blob logged after the pool program returned', () => {
    const logs = [
      `Program ${POOL} invoke [1]`,
      `Program ${POOL} success`,
      dataLine(EVENT_DISC.leafInserted, 72),
    ];
    expect(programDataBlobs(logs, POOL)).toHaveLength(0);
  });

  it('handles a CPI: an inner evil program cannot emit as the pool', () => {
    const logs = [
      `Program ${POOL} invoke [1]`,
      `Program ${EVIL} invoke [2]`,
      dataLine(EVENT_DISC.leafInserted, 72),
      `Program ${EVIL} success`,
      dataLine(EVENT_DISC.leafInserted, 72),
      `Program ${POOL} success`,
    ];
    // Only the blob emitted after the inner program returned counts.
    expect(programDataBlobs(logs, POOL)).toHaveLength(1);
  });

  it('ignores a failed pool invocation', () => {
    const logs = [
      `Program ${POOL} invoke [1]`,
      dataLine(EVENT_DISC.leafInserted, 72),
      `Program ${POOL} failed: custom program error: 0x1`,
    ];
    expect(programDataBlobs(logs, POOL)).toHaveLength(0);
  });

  it('ignores malformed base64 without throwing', () => {
    const logs = [
      `Program ${POOL} invoke [1]`,
      'Program data: !!!not-base64!!!',
      `Program ${POOL} success`,
    ];
    expect(() => programDataBlobs(logs, POOL)).not.toThrow();
  });
});

describe('EVENT_DISC', () => {
  it('pins the discriminators published by the program side', () => {
    // sha256("event:<Name>")[0..8], supplied by the program repo 2026-08-08.
    expect(EVENT_DISC.leafInserted).toBe('59f3d408d7bfbb98');
    expect(EVENT_DISC.depositLegacy).toBe('3ecdf2aff4a98834');
    expect(EVENT_DISC.noteCiphertext).toBe('6c50afa0eadfd292');
  });
});
