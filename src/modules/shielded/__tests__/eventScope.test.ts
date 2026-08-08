import {poolLeafBlobs, EVENT_DISC} from '../eventLogs';

const POOL_PROG = 'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES';
const OUR_TREE = 'OurTree11111111111111111111111111111111111';
const THEIR_TREE = 'TheirTree111111111111111111111111111111111';
const EVIL_PROG = 'EViL1111111111111111111111111111111111111111';

function dataLine(disc: string, payloadLen: number): string {
  const b = new Uint8Array(8 + payloadLen);
  for (let i = 0; i < 8; i++) b[i] = parseInt(disc.slice(i * 2, i * 2 + 2), 16);
  return `Program data: ${Buffer.from(b).toString('base64')}`;
}

const LEAF = dataLine(EVENT_DISC.leafInserted, 72);

/** Minimal tx shape: account keys + one entry per OUTER instruction, in order. */
function tx(
  logMessages: string[],
  outer: {programId: string; accounts: string[]}[],
) {
  const keys = [...new Set([POOL_PROG, EVIL_PROG, OUR_TREE, THEIR_TREE, ...outer.flatMap(o => o.accounts)])];
  const idx = (k: string) => keys.indexOf(k);
  return {
    meta: {logMessages, loadedAddresses: null},
    transaction: {
      message: {
        staticAccountKeys: keys,
        compiledInstructions: outer.map(o => ({
          programIdIndex: idx(o.programId),
          accountKeyIndexes: o.accounts.map(idx),
        })),
      },
    },
  };
}

describe('poolLeafBlobs — per-instruction merkle scoping', () => {
  it('accepts a leaf from a pool instruction that touches OUR tree', () => {
    const t = tx(
      [`Program ${POOL_PROG} invoke [1]`, LEAF, `Program ${POOL_PROG} success`],
      [{programId: POOL_PROG, accounts: [OUR_TREE]}],
    );
    expect(poolLeafBlobs(t, POOL_PROG, OUR_TREE)).toHaveLength(1);
  });

  it('REJECTS a genuine leaf from ANOTHER POOL on the same program', () => {
    // INV-2. The program hosts many pools and every pool starts at leaf_index 0,
    // so ingesting a foreign pool's leaves collides on index and corrupts the
    // tree. Nothing here is forged: real program, real discriminator, real event.
    const t = tx(
      [`Program ${POOL_PROG} invoke [1]`, LEAF, `Program ${POOL_PROG} success`],
      [{programId: POOL_PROG, accounts: [THEIR_TREE]}],
    );
    expect(poolLeafBlobs(t, POOL_PROG, OUR_TREE)).toHaveLength(0);
  });

  it('REJECTS a foreign-pool leaf even when the tx also references OUR tree', () => {
    // The attack that tx-level accountKeys scoping CANNOT catch, and the reason
    // scoping must be per-instruction: our scanners key on getSignaturesForAddress
    // (OUR merkle tree), so an attacker only reaches us by deliberately putting
    // our tree in the transaction. Instruction 0 deposits into THEIR pool;
    // instruction 1 merely mentions our tree to get the tx into our scan.
    const t = tx(
      [`Program ${POOL_PROG} invoke [1]`, LEAF, `Program ${POOL_PROG} success`,
       `Program ${EVIL_PROG} invoke [1]`, `Program ${EVIL_PROG} success`],
      [
        {programId: POOL_PROG, accounts: [THEIR_TREE]},
        {programId: EVIL_PROG, accounts: [OUR_TREE]},
      ],
    );
    expect(poolLeafBlobs(t, POOL_PROG, OUR_TREE)).toHaveLength(0);
  });

  it('picks the right instruction when several run in one tx', () => {
    const t = tx(
      [`Program ${POOL_PROG} invoke [1]`, LEAF, `Program ${POOL_PROG} success`,
       `Program ${POOL_PROG} invoke [1]`, LEAF, `Program ${POOL_PROG} success`],
      [
        {programId: POOL_PROG, accounts: [THEIR_TREE]}, // foreign — dropped
        {programId: POOL_PROG, accounts: [OUR_TREE]},   // ours — kept
      ],
    );
    expect(poolLeafBlobs(t, POOL_PROG, OUR_TREE)).toHaveLength(1);
  });

  it('REJECTS a leaf emitted from a CPI (depth > 1)', () => {
    // Fail closed: a CPI's own account list is not the outer instruction's, so
    // we cannot attribute it safely. The pool is only ever invoked directly.
    const t = tx(
      [`Program ${EVIL_PROG} invoke [1]`,
       `Program ${POOL_PROG} invoke [2]`, LEAF, `Program ${POOL_PROG} success`,
       `Program ${EVIL_PROG} success`],
      [{programId: EVIL_PROG, accounts: [OUR_TREE]}],
    );
    expect(poolLeafBlobs(t, POOL_PROG, OUR_TREE)).toHaveLength(0);
  });

  it('resolves address-lookup-table accounts', () => {
    const t = {
      meta: {
        logMessages: [`Program ${POOL_PROG} invoke [1]`, LEAF, `Program ${POOL_PROG} success`],
        loadedAddresses: {writable: [OUR_TREE], readonly: []},
      },
      transaction: {
        message: {
          staticAccountKeys: [POOL_PROG],
          compiledInstructions: [{programIdIndex: 0, accountKeyIndexes: [1]}], // 1 = first ALT addr
        },
      },
    };
    expect(poolLeafBlobs(t, POOL_PROG, OUR_TREE)).toHaveLength(1);
  });

  it('returns nothing when the tx shape is missing or malformed', () => {
    expect(poolLeafBlobs(null, POOL_PROG, OUR_TREE)).toHaveLength(0);
    expect(poolLeafBlobs({meta: {logMessages: [LEAF]}}, POOL_PROG, OUR_TREE)).toHaveLength(0);
  });
});
