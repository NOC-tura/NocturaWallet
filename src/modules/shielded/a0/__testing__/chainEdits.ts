/**
 * TEST-ONLY: edits of a recorded chain (recordedRpc.ts) for the negative controls of the A0 tree
 * sync. Each edit changes one fact of a real recorded transaction or account and nothing else, so
 * a refusal can be attributed to that fact. Never imported by app code.
 */
import {base58} from '@scure/base';
import type {RecordedChain, RecordedTx} from './recordedRpc';

const DATA = 'Program data: ';

export const toHex = (b: Uint8Array): string =>
  Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string): Uint8Array =>
  Uint8Array.from(h.match(/../g) ?? [], x => parseInt(x, 16));

/** The tx whose signature starts with `prefix` (one, or the test is wrong). */
export function txOf(chain: RecordedChain, prefix: string): {sig: string; tx: RecordedTx} {
  const sigs = Object.keys(chain.transactions).filter(s => s.startsWith(prefix));
  if (sigs.length !== 1) {
    throw new Error(`chainEdits: ${sigs.length} transactions start with ${prefix}`);
  }
  return {sig: sigs[0]!, tx: chain.transactions[sigs[0]!]!};
}

/** The `Program data:` blobs of a tx, decoded, with their log line index. */
export function blobsOf(tx: RecordedTx): {line: number; bytes: Uint8Array}[] {
  return tx.meta.logMessages.flatMap((l, line) =>
    l.startsWith(DATA) ? [{line, bytes: Uint8Array.from(Buffer.from(l.slice(DATA.length), 'base64'))}] : [],
  );
}

/** Replace log line `line` (a Program data line) with `bytes`. */
export function setBlob(tx: RecordedTx, line: number, bytes: Uint8Array): void {
  tx.meta.logMessages[line] = DATA + Buffer.from(bytes).toString('base64');
}

/** A fresh, valid base58 signature (64 bytes) that no recorded tx has. */
export function freshSignature(seed: number): string {
  const b = new Uint8Array(64);
  b.fill(seed % 256);
  b[0] = 0xee;
  return base58.encode(b);
}

/** Remove a signature from the list (the RPC "forgets" it; its tx stays unreachable). */
export function dropSignature(chain: RecordedChain, sig: string): void {
  chain.signatures = chain.signatures.filter(s => s.signature !== sig);
}

/**
 * Append one top-level instruction to a recorded legacy tx: `program` (a key, appended as a
 * read-only unsigned account if absent), the accounts `accounts` (keys already in the tx), the
 * data `data`, and the log frame `Program <program> invoke [1]`, its `blobs` as `Program data:`
 * lines, `Program <program> success` — at the end of the logs, as the runtime would write it.
 */
export function appendTopLevelIx(
  tx: RecordedTx,
  ix: {program: string; accounts: string[]; data: Uint8Array; blobs: Uint8Array[]},
): void {
  const msg = tx.transaction.message;
  let p = msg.accountKeys.indexOf(ix.program);
  if (p < 0) {
    msg.accountKeys.push(ix.program);
    const header = msg.header as {numReadonlyUnsignedAccounts: number};
    header.numReadonlyUnsignedAccounts += 1;
    tx.meta.preBalances.push(1);
    (tx.meta.postBalances as number[]).push(1);
    p = msg.accountKeys.length - 1;
  }
  const accounts = ix.accounts.map(k => {
    const i = msg.accountKeys.indexOf(k);
    if (i < 0) {
      throw new Error(`chainEdits: ${k} is not a key of this tx`);
    }
    return i;
  });
  msg.instructions.push({programIdIndex: p, accounts, data: base58.encode(ix.data)});
  tx.meta.logMessages.push(
    `Program ${ix.program} invoke [1]`,
    ...ix.blobs.map(b => DATA + Buffer.from(b).toString('base64')),
    `Program ${ix.program} success`,
  );
}

/**
 * A new newest transaction: a copy of `template` under a fresh signature at `slot`, listed first
 * (newest) in the signature list with `err` and finalized.
 */
export function cloneAsNewest(
  chain: RecordedChain,
  template: RecordedTx,
  sig: string,
  slot: number,
  listErr: unknown = null,
): RecordedTx {
  const tx = JSON.parse(JSON.stringify(template)) as RecordedTx;
  tx.transaction.signatures[0] = sig;
  tx.slot = slot;
  chain.transactions[sig] = tx;
  chain.signatures.unshift({
    signature: sig,
    slot,
    err: listErr,
    memo: null,
    blockTime: tx.blockTime,
    confirmationStatus: 'finalized',
  });
  return tx;
}

/** The recorded tree account's bytes, and a setter. */
export function accountBytes(chain: RecordedChain): Uint8Array {
  if (!chain.account.value) {
    throw new Error('chainEdits: no account');
  }
  return Uint8Array.from(Buffer.from(chain.account.value.data[0], 'base64'));
}
export function setAccountBytes(chain: RecordedChain, bytes: Uint8Array): void {
  if (!chain.account.value) {
    throw new Error('chainEdits: no account');
  }
  chain.account.value.data = [Buffer.from(bytes).toString('base64'), 'base64'];
}

/** A LeafInserted blob: disc | commitment | leaf_index u64 LE | root. */
export function leafBlob(disc: string, commitment: string, leafIndex: number, root: string): Uint8Array {
  const idx = new Uint8Array(8);
  new DataView(idx.buffer).setUint32(0, leafIndex, true);
  return Uint8Array.from([...fromHex(disc), ...fromHex(commitment), ...idx, ...fromHex(root)]);
}
