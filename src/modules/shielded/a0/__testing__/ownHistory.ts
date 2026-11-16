/* eslint-disable no-bitwise -- the incremental Merkle insert is bit arithmetic on the leaf index */
/**
 * TEST-ONLY: a synthetic continuation of the recorded devnet history in which SOMEONE ELSE's seed
 * did not make every deposit (never imported by app code).
 *
 * The recorded tree (fixtures/devnet-tree-5URd.json) holds only the program side's deposits, made
 * with their keys — so for the test seed it has no own note at all (the negative case of the
 * recovery suite). For the positive cases this helper appends transactions to a copy of it, each
 * a clone of a REAL landed transaction with exactly the fields a deposit or an unshield changes:
 *   - a deposit = a clone of `3DR6F7oW…` with the instruction's `amount` / `commitment` / `rho`
 *     rewritten (§1 layout: disc | amount u64 LE | commitment | rho | u32 256 | proof — the proof
 *     bytes are the landed one's; the sync does not verify proofs), its rho-marker account set to
 *     PDA(["rho", rho]), and its `LeafInserted` set to the new leaf;
 *   - an unshield = a clone of the relayed `3UfCx5TD…` with the `nullifier` and
 *     `change_commitment` arguments rewritten, its `LeafInserted` (the change leaf) and its
 *     `Withdraw` nullifier set accordingly;
 * and after each one the tree ACCOUNT is advanced the way the program advances it (the account's
 * own zeros and filled subtrees, the leaf inserted with poseidon-lite's Poseidon2 — not the sync's
 * code —, the ring head moved before the root is written, nextLeafIndex + 1). The tree sync
 * therefore verifies the extended chain exactly as it verifies the recorded one: every event
 * root, the ring, the head and the filled subtrees.
 *
 * The values (rho, commitment, nullifier) are the caller's — the recovery suites take them from
 * the offline equations (offlineA0.ts), never from the code under test.
 */
import {PublicKey} from '@solana/web3.js';
import {base58} from '@scure/base';
import {poseidon2} from 'poseidon-lite';
import {
  accountBytes,
  appendTopLevelIx,
  blobsOf,
  cloneAsNewest,
  freshSignature,
  fromHex,
  leafBlob,
  setAccountBytes,
  setBlob,
  toHex,
  txOf,
} from './chainEdits';
import type {RecordedChain, RecordedTx} from './recordedRpc';

const PROGRAM = 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH';
const LEAF_INSERTED = '59f3d408d7bfbb98';
const WITHDRAW = 'c0f1c9d946965af7';
const DEPOSIT_DISC = 'f223c68952e1f2b6';
const WITHDRAW_DISC = '6cf44379ecf67997';
const DEPTH = 20;
const RING = 64;
const OFF = {next: 8, zeros: 16, filled: 656, ring: 1296, head: 3344};
/** a slot after every recorded one (the newest recorded is 520152276) */
const FIRST_SLOT = 523_000_000;

const fe = (h: string): bigint => BigInt(`0x${h}`);
const hex64 = (v: bigint): string => v.toString(16).padStart(64, '0');

/** PDA(["rho", rho]) / PDA(["nullifier", n]) of FeGSS…, with the real web3.js (the suite's realWeb3 line). */
export function rhoPda(rho: string): string {
  return PublicKey.findProgramAddressSync([Buffer.from('rho'), Buffer.from(rho, 'hex')], new PublicKey(PROGRAM))[0].toBase58();
}
export function nullifierPda(nullifier: string): string {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('nullifier'), Buffer.from(nullifier, 'hex')],
    new PublicKey(PROGRAM),
  )[0].toBase58();
}

/** Insert `leaf` into the chain's account as the program does; returns its leaf index and the new root. */
function insertLeaf(chain: RecordedChain, leaf: string): {leafIndex: number; root: string} {
  const b = accountBytes(chain);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const next = Number(dv.getBigUint64(OFF.next, true));
  const at = (off: number, i: number) => toHex(b.subarray(off + 32 * i, off + 32 * (i + 1)));
  let cur = fe(leaf);
  let idx = next;
  for (let i = 0; i < DEPTH; i++) {
    if ((idx & 1) === 0) {
      b.set(fromHex(hex64(cur)), OFF.filled + 32 * i);
      cur = poseidon2([cur, fe(at(OFF.zeros, i))]);
    } else {
      cur = poseidon2([fe(at(OFF.filled, i)), cur]);
    }
    idx >>= 1;
  }
  const head = (Number(dv.getBigUint64(OFF.head, true)) + 1) % RING;
  b.set(fromHex(hex64(cur)), OFF.ring + 32 * head);
  dv.setBigUint64(OFF.head, BigInt(head), true);
  dv.setBigUint64(OFF.next, BigInt(next + 1), true);
  setAccountBytes(chain, b);
  return {leafIndex: next, root: hex64(cur)};
}

let serial = 0;
/** A fresh signature and slot for the next appended tx (unique within the test file's process). */
function nextId(): {sig: string; slot: number} {
  serial += 1;
  return {sig: freshSignature(serial), slot: FIRST_SLOT + serial};
}

function poolIx(tx: RecordedTx): {programIdIndex: number; accounts: number[]; data: string} {
  const msg = tx.transaction.message;
  const ixs = msg.instructions.filter(i => msg.accountKeys[i.programIdIndex] === PROGRAM);
  if (ixs.length !== 1) {
    throw new Error(`ownHistory: template has ${ixs.length} pool instructions`);
  }
  return ixs[0]!;
}

function setLeafBlob(tx: RecordedTx, commitment: string, leafIndex: number, root: string): void {
  const lines = blobsOf(tx).filter(x => toHex(x.bytes.subarray(0, 8)) === LEAF_INSERTED);
  if (lines.length !== 1) {
    throw new Error(`ownHistory: template has ${lines.length} LeafInserted`);
  }
  setBlob(tx, lines[0]!.line, leafBlob(LEAF_INSERTED, commitment, leafIndex, root));
}

export interface AppendedDeposit {
  signature: string;
  leafIndex: number;
  root: string;
}

/** Append a deposit `{amount, commitment, rho}` (a clone of the landed 3DR6F7oW…) as the newest tx
 *  (under `as.signature` when given — liveDevnet.ts lands a sent tx under its own signature). */
export function appendDeposit(
  chain: RecordedChain,
  d: {amount: bigint; commitment: string; rho: string},
  as?: {signature: string},
): AppendedDeposit {
  const id = nextId();
  const sig = as?.signature ?? id.sig;
  const slot = id.slot;
  const tx = cloneAsNewest(chain, txOf(chain, '3DR6F7oW').tx, sig, slot);
  const ix = poolIx(tx);
  const data = base58.decode(ix.data);
  if (data.length !== 340 || toHex(data.subarray(0, 8)) !== DEPOSIT_DISC) {
    throw new Error('ownHistory: the deposit template is not a 340-byte deposit');
  }
  new DataView(data.buffer, data.byteOffset, data.byteLength).setBigUint64(8, d.amount, true);
  data.set(fromHex(d.commitment), 16);
  data.set(fromHex(d.rho), 48);
  ix.data = base58.encode(data);
  // the rho marker is the instruction's account 5 (DepositCtx order)
  tx.transaction.message.accountKeys[ix.accounts[5]!] = rhoPda(d.rho);
  const {leafIndex, root} = insertLeaf(chain, d.commitment);
  setLeafBlob(tx, d.commitment, leafIndex, root);
  return {signature: sig, leafIndex, root};
}

/**
 * Append ONE transaction carrying two deposits: `first` as in `appendDeposit`, then `second` as a
 * second top-level pool instruction (same accounts) with its own frame and LeafInserted — so the
 * second deposit's leaf is NOT the transaction's first LeafInserted.
 */
export function appendDepositPair(
  chain: RecordedChain,
  first: {amount: bigint; commitment: string; rho: string},
  second: {amount: bigint; commitment: string; rho: string},
): {signature: string; leafIndices: [number, number]} {
  const a = appendDeposit(chain, first);
  const tx = chain.transactions[a.signature]!;
  const ix = poolIx(tx);
  const data = base58.decode(ix.data);
  new DataView(data.buffer, data.byteOffset, data.byteLength).setBigUint64(8, second.amount, true);
  data.set(fromHex(second.commitment), 16);
  data.set(fromHex(second.rho), 48);
  const {leafIndex, root} = insertLeaf(chain, second.commitment);
  appendTopLevelIx(tx, {
    program: PROGRAM,
    accounts: ix.accounts.map(k => tx.transaction.message.accountKeys[k]!),
    data,
    blobs: [leafBlob(LEAF_INSERTED, second.commitment, leafIndex, root)],
  });
  return {signature: a.signature, leafIndices: [a.leafIndex, leafIndex]};
}

/** Append a relayed unshield spending `nullifier` (a clone of 3UfCx5TD…) with change leaf `changeCommitment`. */
export function appendWithdraw(
  chain: RecordedChain,
  w: {nullifier: string; changeCommitment: string},
): AppendedDeposit {
  const {sig, slot} = nextId();
  const tx = cloneAsNewest(chain, txOf(chain, '3UfCx5TD').tx, sig, slot);
  const ix = poolIx(tx);
  const data = base58.decode(ix.data);
  if (data.length !== 380 || toHex(data.subarray(0, 8)) !== WITHDRAW_DISC) {
    throw new Error('ownHistory: the withdraw template is not a 380-byte withdraw_with_change');
  }
  data.set(fromHex(w.nullifier), 40);
  data.set(fromHex(w.changeCommitment), 80);
  ix.data = base58.encode(data);
  const {leafIndex, root} = insertLeaf(chain, w.changeCommitment);
  setLeafBlob(tx, w.changeCommitment, leafIndex, root);
  const wd = blobsOf(tx).filter(x => toHex(x.bytes.subarray(0, 8)) === WITHDRAW);
  if (wd.length !== 1) {
    throw new Error(`ownHistory: template has ${wd.length} Withdraw`);
  }
  setBlob(tx, wd[0]!.line, Uint8Array.from([...fromHex(WITHDRAW), ...fromHex(w.nullifier)]));
  return {signature: sig, leafIndex, root};
}
