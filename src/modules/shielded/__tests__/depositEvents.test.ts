import {parseDepositEvents, orderedLeaves, DepositEvent} from '../depositEvents';
import {EVENT_DISC} from '../eventLogs';
import {SHIELDED_POOL_PROGRAM_ID} from '../../../constants/programs';

// Build a synthetic "Program data:" line: 8-byte disc + commitment[32] + leaf_index(u64 LE) + root[32].
function programDataLine(commitmentHex: string, leafIndex: number, rootHex: string): string {
  const buf = Buffer.alloc(8 + 32 + 8 + 32);
  Buffer.from(EVENT_DISC.leafInserted, 'hex').copy(buf, 0);
  Buffer.from(commitmentHex, 'hex').copy(buf, 8);
  buf.writeUInt32LE(leafIndex, 8 + 32); // low 32 bits suffice for tests
  Buffer.from(rootHex, 'hex').copy(buf, 8 + 32 + 8);
  return `Program data: ${buf.toString('base64')}`;
}

/** Wrap event lines in the pool program's invoke/success bracket, as the RPC returns them. */
function inPoolInvoke(...lines: string[]): string[] {
  return [
    `Program ${SHIELDED_POOL_PROGRAM_ID} invoke [1]`,
    ...lines,
    `Program ${SHIELDED_POOL_PROGRAM_ID} success`,
  ];
}

const c = (n: number) => n.toString(16).padStart(64, '0');
const r = (n: number) => (1000 + n).toString(16).padStart(64, '0');

describe('depositEvents', () => {
  it('parses commitment, leaf_index, root from Program data lines', () => {
    const logs = inPoolInvoke('Program log: Instruction: Deposit', programDataLine(c(7), 3, r(3)));
    const events = parseDepositEvents(logs);
    expect(events).toEqual<DepositEvent[]>([{commitment: c(7), leafIndex: 3, root: r(3)}]);
  });
  it('ignores non-event log lines', () => {
    expect(parseDepositEvents(['Program log: hello', 'random'])).toEqual([]);
  });
  it('orderedLeaves places commitments densely by leaf_index', () => {
    const events: DepositEvent[] = [
      {commitment: c(20), leafIndex: 2, root: r(2)},
      {commitment: c(10), leafIndex: 0, root: r(0)},
      {commitment: c(15), leafIndex: 1, root: r(1)},
    ];
    expect(orderedLeaves(events)).toEqual([c(10), c(15), c(20)]);
  });
  it('orderedLeaves throws on a gap (missing leaf index)', () => {
    const events: DepositEvent[] = [
      {commitment: c(10), leafIndex: 0, root: r(0)},
      {commitment: c(20), leafIndex: 2, root: r(2)},
    ];
    expect(() => orderedLeaves(events)).toThrow(/gap/i);
  });
  it('a duplicated leaf index does not mask a real gap', () => {
    // Events for indices {0, 1, 1, 3}: index 1 is duplicated and index 2 is
    // genuinely missing. Deriving the expected count from max (=3) rather than
    // the unique count means the gap at 2 is still detected — no silent truncation.
    const events: DepositEvent[] = [
      {commitment: c(10), leafIndex: 0, root: r(0)},
      {commitment: c(15), leafIndex: 1, root: r(1)},
      {commitment: c(16), leafIndex: 1, root: r(1)},
      {commitment: c(20), leafIndex: 3, root: r(3)},
    ];
    expect(() => orderedLeaves(events)).toThrow(/gap/i);
  });
  it('orderedLeaves returns [] for no events', () => {
    expect(orderedLeaves([])).toEqual([]);
  });
});

describe('parseDepositEvents — forgery resistance', () => {
  const POOL = SHIELDED_POOL_PROGRAM_ID;
  const EVIL = 'EViL1111111111111111111111111111111111111111';

  function leafBlob(disc: string, leafIndex: number): string {
    const b = new Uint8Array(80);
    for (let i = 0; i < 8; i++) b[i] = parseInt(disc.slice(i * 2, i * 2 + 2), 16);
    b.fill(0xaa, 8, 40); // commitment
    let idx = BigInt(leafIndex);
    for (let i = 0; i < 8; i++) {
      b[40 + i] = Number(idx & 0xffn);
      idx >>= 8n;
    }
    return `Program data: ${Buffer.from(b).toString('base64')}`;
  }

  it('accepts a LeafInserted event from the pool program', () => {
    const logs = [`Program ${POOL} invoke [1]`, leafBlob(EVENT_DISC.leafInserted, 3), `Program ${POOL} success`];
    expect(parseDepositEvents(logs)).toHaveLength(1);
    expect(parseDepositEvents(logs)[0]!.leafIndex).toBe(3);
  });

  it('still accepts the legacy Deposit discriminator (pre-rename leaves)', () => {
    const logs = [`Program ${POOL} invoke [1]`, leafBlob(EVENT_DISC.depositLegacy, 1), `Program ${POOL} success`];
    expect(parseDepositEvents(logs)).toHaveLength(1);
  });

  it('REJECTS a correctly-shaped leaf forged by another program', () => {
    // Balance-inflation / pool-wide-DoS vector: costs one transaction fee.
    const logs = [`Program ${EVIL} invoke [1]`, leafBlob(EVENT_DISC.leafInserted, 1_048_575), `Program ${EVIL} success`];
    expect(parseDepositEvents(logs)).toHaveLength(0);
  });

  it('REJECTS a pool-emitted blob with an unknown discriminator', () => {
    const logs = [`Program ${POOL} invoke [1]`, leafBlob('0011223344556677', 2), `Program ${POOL} success`];
    expect(parseDepositEvents(logs)).toHaveLength(0);
  });
});
