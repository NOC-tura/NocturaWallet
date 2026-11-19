/**
 * TEST-ONLY: a `fetch-devnet-tx.mjs` fixture (the RPC's `getTransaction` answer with
 * `encoding: 'base64'`) re-encoded as the RPC's JSON answer — the encoding the tree sync asks for
 * and `recordedRpc.ts` serves — so the recorded relayed withdraws go through the REAL web3.js
 * `Connection.getTransaction` parsing and then `parseA0SyncedTx`, exactly as a synced tx does on
 * the phone (M1c Task 3's hand-over: "`parseA0SyncedTx` takes what the real
 * `Connection.getTransaction` returns"). Never imported by app code.
 *
 * The wire bytes are decoded by the REAL @solana/web3.js `VersionedTransaction.deserialize` (the
 * suite's `realWeb3` mock line makes the import below the real library). `meta` is the RPC's own,
 * unedited: its fields are the same in both encodings. Legacy messages only (both fixtures are);
 * anything else throws instead of guessing.
 */
import {VersionedTransaction} from '@solana/web3.js';
import {base58} from '@scure/base';
import type {RecordedTx} from './recordedRpc';

export interface DevnetTxFixture {
  schema: string;
  signature: string;
  result: {
    slot: number;
    blockTime: number | null;
    version: unknown;
    meta: RecordedTx['meta'];
    transaction: [string, string];
  };
}

export function jsonEncodedTx(fixture: DevnetTxFixture): RecordedTx {
  if (fixture.schema !== 'noctura.a0.devnet-tx-fixture/1' || fixture.result.transaction[1] !== 'base64') {
    throw new Error('landedTx: not a base64 fetch-devnet-tx.mjs fixture');
  }
  const vtx = VersionedTransaction.deserialize(Buffer.from(fixture.result.transaction[0], 'base64'));
  const msg = vtx.message;
  if (msg.version !== 'legacy' || fixture.result.version !== 'legacy' || msg.addressTableLookups.length !== 0) {
    throw new Error('landedTx: only legacy messages are re-encoded');
  }
  const signatures = vtx.signatures.map(s => base58.encode(s));
  if (signatures[0] !== fixture.signature) {
    throw new Error(`landedTx: the wire's first signature is not ${fixture.signature}`);
  }
  return {
    slot: fixture.result.slot,
    blockTime: fixture.result.blockTime,
    version: 'legacy',
    meta: JSON.parse(JSON.stringify(fixture.result.meta)) as RecordedTx['meta'],
    transaction: {
      signatures,
      message: {
        accountKeys: msg.staticAccountKeys.map(k => k.toBase58()),
        header: {...msg.header},
        instructions: msg.compiledInstructions.map(ci => ({
          programIdIndex: ci.programIdIndex,
          accounts: [...ci.accountKeyIndexes],
          data: base58.encode(ci.data),
        })),
        recentBlockhash: msg.recentBlockhash,
      },
    },
  };
}
