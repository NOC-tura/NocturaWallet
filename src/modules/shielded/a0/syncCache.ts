/**
 * The A0 tree sync's cache (spec §8 "the SyncedTx cache of §9 beside [the notes]", §9 "The cache
 * lives in the encrypted MMKV with the notes").
 *
 * Everything in it is public chain data, but WHICH rows the wallet later reads is the pattern §2
 * keeps away from the RPC, so it lives in the ENCRYPTED instance (`mmkvSecure()`), never in
 * `mmkvPublic`. Without the encrypted instance (before onboarding) nothing is read or written:
 * the sync then runs in full every time, and never falls back to the public instance.
 *
 * Schema-versioned (key `v1_a0_synced_tx`, `schema: 1`) and bound to the program and the tree;
 * a record of another schema, program or tree, or one that does not decode field by field, is
 * treated as absent (a full resync), never repaired. The cache is never trusted either way: the
 * sync re-verifies every cached leaf against the chain on every run (treeSync.ts).
 *
 * `cursor` is the newest FINALIZED signature of the contiguous finalized prefix; `txs` holds the
 * successful transactions listed at or before it, oldest first. A confirmed-but-not-finalized
 * tail is never cached (a fork could still drop it); it is fetched again on the next run.
 */
import {mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {A0} from './constants';
import type {A0SyncedTx} from './syncedTx';

export const A0_SYNC_CACHE_SCHEMA = 1;

export interface A0SyncCache {
  cursor: string;
  txs: A0SyncedTx[];
}

type Json = null | boolean | number | string | Json[] | {[k: string]: Json};

const HEX64 = /^[0-9a-f]{64}$/;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,88}$/;
const INT = /^-?(0|[1-9][0-9]*)$/;

class Bad extends Error {}

const obj = (v: Json | undefined): {[k: string]: Json} => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new Bad('object');
  }
  return v;
};
const arr = (v: Json | undefined): Json[] => {
  if (!Array.isArray(v)) {
    throw new Bad('array');
  }
  return v;
};
const str = (v: Json | undefined, re: RegExp): string => {
  if (typeof v !== 'string' || !re.test(v)) {
    throw new Bad('string');
  }
  return v;
};
const big = (v: Json | undefined): bigint => BigInt(str(v, INT));
const nat = (v: Json | undefined): number => {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) {
    throw new Bad('number');
  }
  return v;
};

function decodeTx(v: Json): A0SyncedTx {
  const o = obj(v);
  const keys = (x: Json | undefined) => arr(x).map(k => str(k, B58));
  return {
    signature: str(o.signature, B58),
    slot: nat(o.slot),
    blockTime: o.blockTime === null ? null : nat(o.blockTime),
    signers: keys(o.signers),
    feePayer: str(o.feePayer, B58),
    topLevelPrograms: keys(o.topLevelPrograms),
    leafInserted: arr(o.leafInserted).map(x => {
      const l = obj(x);
      return {
        commitment: str(l.commitment, HEX64),
        leafIndex: nat(l.leafIndex),
        root: str(l.root, HEX64),
      };
    }),
    withdrawNullifiers: arr(o.withdrawNullifiers).map(n => str(n, HEX64)),
    deposits: arr(o.deposits).map(x => {
      const d = obj(x);
      return {
        amount: big(d.amount),
        commitment: str(d.commitment, HEX64),
        rho: str(d.rho, HEX64),
        depositor: str(d.depositor, B58),
        depositorTokenAccount: str(d.depositorTokenAccount, B58),
      };
    }),
    withdrawals: arr(o.withdrawals).map(x => {
      const w = obj(x);
      return {
        merkleRoot: str(w.merkleRoot, HEX64),
        nullifier: str(w.nullifier, HEX64),
        amount: big(w.amount),
        changeCommitment: str(w.changeCommitment, HEX64),
        fee: big(w.fee),
        destination: str(w.destination, B58),
        feePayer: str(w.feePayer, B58),
        feeDestination: str(w.feeDestination, B58),
        destinationTokenDelta:
          w.destinationTokenDelta === null ? null : big(w.destinationTokenDelta),
      };
    }),
    systemTransfers: arr(o.systemTransfers).map(x => {
      const t = obj(x);
      return {from: str(t.from, B58), to: str(t.to, B58), lamports: big(t.lamports)};
    }),
    createAtaIdempotent: arr(o.createAtaIdempotent).map(x => {
      const c = obj(x);
      return {
        payer: str(c.payer, B58),
        ata: str(c.ata, B58),
        owner: str(c.owner, B58),
        mint: str(c.mint, B58),
      };
    }),
    preBalances: arr(o.preBalances).map(x => {
      const p = obj(x);
      return {address: str(p.address, B58), lamports: big(p.lamports)};
    }),
    vaultTokenDelta: big(o.vaultTokenDelta),
  };
}

/** BigInt → decimal string; everything else as is. */
const encode = (tx: A0SyncedTx): string =>
  JSON.stringify(tx, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));

/** The cached record, or null (no encrypted instance, absent, other schema / program / tree, undecodable). */
export function loadA0SyncCache(): A0SyncCache | null {
  const store = mmkvSecure();
  const raw = store?.getString(MMKV_KEYS.A0_SYNCED_TX);
  if (!raw) {
    return null;
  }
  try {
    const o = obj(JSON.parse(raw) as Json);
    if (o.schema !== A0_SYNC_CACHE_SCHEMA || o.programId !== A0.programId || o.tree !== A0.merkleTree) {
      return null;
    }
    return {cursor: str(o.cursor, B58), txs: arr(o.txs).map(decodeTx)};
  } catch {
    return null;
  }
}

/** Write the record; false (and nothing written anywhere) without the encrypted instance. */
export function saveA0SyncCache(cache: A0SyncCache): boolean {
  const store = mmkvSecure();
  if (!store) {
    return false;
  }
  store.set(
    MMKV_KEYS.A0_SYNCED_TX,
    `{"schema":${A0_SYNC_CACHE_SCHEMA},"programId":"${A0.programId}","tree":"${A0.merkleTree}",` +
      `"cursor":${JSON.stringify(cache.cursor)},"txs":[${cache.txs.map(encode).join(',')}]}`,
  );
  return true;
}

export function clearA0SyncCache(): void {
  mmkvSecure()?.remove(MMKV_KEYS.A0_SYNCED_TX);
}
