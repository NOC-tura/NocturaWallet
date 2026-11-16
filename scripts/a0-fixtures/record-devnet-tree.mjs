#!/usr/bin/env node
/**
 * One-off recorder of the A0 MerkleTree's whole DEVNET history into a committed test fixture
 * (spec 2026-11-08 shielded A0 M1 §9, §14 JS "the tree sync against the real 5URd… account (a
 * recorded fixture)"; the brief's convention: devnet facts are fetched ONCE into committed
 * fixtures with the slot and time recorded, and the tests read only the fixtures).
 *
 * The sibling of fetch-devnet-tx.mjs (one transaction, base64). This one records exactly the
 * three answers the wallet's tree sync asks for, in the encodings @solana/web3.js's Connection
 * requests them (so a recorded-RPC fake can answer the real Connection in Jest):
 *   - getSignaturesForAddress(<tree>, {limit: 1000, before?}) — walked page by page until a short
 *     page, commitment finalized;
 *   - getTransaction(<sig>, {commitment: 'finalized', maxSupportedTransactionVersion: 0}) — the
 *     default JSON encoding, which is what Connection.getTransaction sends — for EVERY listed
 *     signature, failed ones included;
 *   - getAccountInfo(<tree>, {encoding: 'base64', commitment: 'finalized'}) with its context slot.
 * Then it lists the signatures again and refuses to write unless the list is unchanged, so the
 * account snapshot and the history describe the same tree (no leaf landed in between).
 *
 * It parses nothing: no event, no instruction, no root. The values are the wallet's to compute,
 * in the tests, from these unedited answers.
 *
 * Guards, as fetch-devnet-tx.mjs (duplicated on purpose: both scripts are standalone CLIs with
 * top-level effects): https only; refused BEFORE any request — an RPC URL with a query string,
 * userinfo, a hash, or a path other than exactly `/` (a keyed provider URL carries its key in one
 * of these: `?api-key=…`, Alchemy's `/v2/<key>`, QuickNode's `/<token>/`); never noc-tura.io,
 * solscan.io or a host naming mainnet; the RPC's genesis hash must be devnet's; an existing
 * fixture is never overwritten without --force. `rpc` is recorded as the origin alone, and every
 * refusal message prints the origin alone.
 *
 * No third-party import: base58 is written out by hand below (copied from fetch-devnet-tx.mjs),
 * so this script depends on nothing beyond Node itself.
 *
 * Run by hand from the repository root (network: the one devnet RPC, nothing else):
 *   node scripts/a0-fixtures/record-devnet-tree.mjs --out=<path.json>
 *        [--tree=5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc] [--rpc=https://api.devnet.solana.com] [--force]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const DEFAULT_TREE = '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc';
const PAGE = 1000;

// Bitcoin-alphabet base58, written out by hand: `@scure/base` is only a transitive dependency
// (hoisted, not in package.json — Fable review round 1, Important #1), and this script has no
// other third-party import. Copied verbatim from fetch-devnet-tx.mjs (the scripts are
// standalone; the same alphabet and method as `depositIx.golden.test.ts`'s `base58()`).
const B58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  const hex = Buffer.from(bytes).toString('hex');
  let n = BigInt(hex === '' ? '0x0' : `0x${hex}`);
  let s = '';
  while (n > 0n) {
    s = B58_ALPHABET[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const x of bytes) {
    if (x !== 0) {
      break;
    }
    s = '1' + s;
  }
  return s;
}

function base58Decode(s) {
  let n = 0n;
  for (const ch of s) {
    const v = B58_ALPHABET.indexOf(ch);
    if (v < 0) {
      throw new Error(`invalid base58 character ${JSON.stringify(ch)}`);
    }
    n = n * 58n + BigInt(v);
  }
  let hex = n.toString(16);
  if (hex.length % 2 === 1) {
    hex = '0' + hex;
  }
  const significant =
    n === 0n ? new Uint8Array() : Uint8Array.from(Buffer.from(hex, 'hex'));
  let leadingZeros = 0;
  for (const ch of s) {
    if (ch !== '1') {
      break;
    }
    leadingZeros++;
  }
  const out = new Uint8Array(leadingZeros + significant.length);
  out.set(significant, leadingZeros);
  return out;
}

const base58 = { encode: base58Encode, decode: base58Decode };

const fail = msg => {
  console.error(`record-devnet-tree: ${msg}`);
  process.exit(1);
};

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(a);
    if (!m) {
      fail(`unknown argument ${a}`);
    }
    return [m[1], m[2] ?? true];
  }),
);
for (const k of Object.keys(args)) {
  if (!['out', 'tree', 'rpc', 'force'].includes(k)) {
    fail(`unknown option --${k}`);
  }
}
const out = args.out;
const tree = args.tree ?? DEFAULT_TREE;
const rpc = args.rpc ?? DEFAULT_RPC;
if (typeof out !== 'string') {
  fail('--out=<path.json> is required');
}
let treeBytes = null;
if (typeof tree === 'string') {
  try {
    treeBytes = base58.decode(tree);
  } catch {
    treeBytes = null; // an invalid base58 character — fails the length check below
  }
}
if (treeBytes === null || treeBytes.length !== 32) {
  fail('--tree=<base58 of 32 bytes>');
}

/**
 * Why a parsed RPC URL is refused, or null. Every message names `u.origin` alone — never the
 * path, query string, hash or userinfo, which is where a provider key sits.
 */
function rpcRefusal(u) {
  if (u.protocol !== 'https:') {
    return `the RPC must be https: ${u.origin}`;
  }
  // A keyed provider URL carries its key in the query string (?api-key=…), the userinfo, the
  // hash, OR the path itself (Alchemy `/v2/<key>`, QuickNode `/<token>/`) — none may reach the
  // committed fixture or the terminal. Refused here, fail closed, before any network call — not
  // merely stripped when recording — so a keyed URL cannot even be used by accident.
  if (u.pathname !== '/') {
    return `the RPC URL must carry no path (a provider key is often placed there): ${u.origin}`;
  }
  if (u.search !== '') {
    return `the RPC URL must carry no query string (a provider key would leak into the fixture): ${u.origin}`;
  }
  if (u.hash !== '') {
    return `the RPC URL must carry no fragment: ${u.origin}`;
  }
  if (u.username !== '' || u.password !== '') {
    return `the RPC URL must carry no userinfo (a provider key would leak into the fixture): ${u.origin}`;
  }
  const h = u.hostname.toLowerCase();
  if (
    h === 'noc-tura.io' ||
    h.endsWith('.noc-tura.io') ||
    h === 'solscan.io' ||
    h.endsWith('.solscan.io') ||
    h.includes('mainnet')
  ) {
    return `refusing ${h}: devnet only, never noc-tura.io, solscan.io or mainnet`;
  }
  return null;
}

let parsedRpc;
try {
  parsedRpc = new URL(rpc);
} catch {
  // Not echoed: an unparseable string may still carry a key.
  fail('--rpc is not a URL');
}
const refusal = rpcRefusal(parsedRpc);
if (refusal) {
  fail(refusal);
}
// The fixture records the origin alone — never the path, query string, hash or userinfo — even
// though rpcRefusal above already refuses all of those; this is the recorded VALUE's own
// guarantee, independent of that check.
const rpcRecorded = parsedRpc.origin;
const outPath = resolve(out);
if (existsSync(outPath) && args.force !== true) {
  fail(
    `${out} exists — a fixture is recorded once; pass --force to re-record it`,
  );
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(method, params) {
  // The public devnet RPC rate-limits (429): back off and retry, a bounded number of times.
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      fail(`${method}: HTTP ${res.status}`);
    }
    const body = await res.json();
    if (body.error) {
      fail(`${method}: ${JSON.stringify(body.error)}`);
    }
    return body.result;
  }
  return fail(`${method}: still rate-limited after 6 attempts`);
}

const genesisHash = await call('getGenesisHash', []);
if (genesisHash !== DEVNET_GENESIS) {
  fail(`genesis ${genesisHash} is not devnet's ${DEVNET_GENESIS}`);
}

async function listSignatures() {
  const all = [];
  let before;
  for (;;) {
    const opts = { commitment: 'finalized', limit: PAGE };
    if (before) {
      opts.before = before;
    }
    const page = await call('getSignaturesForAddress', [tree, opts]);
    all.push(...page);
    if (page.length < PAGE) {
      return all;
    }
    before = page[page.length - 1].signature;
  }
}

const signatures = await listSignatures();
const txRequestConfig = {
  commitment: 'finalized',
  maxSupportedTransactionVersion: 0,
};
const transactions = {};
for (const s of signatures) {
  const result = await call('getTransaction', [s.signature, txRequestConfig]);
  if (result === null) {
    fail(`${s.signature} listed but not returned (finalized)`);
  }
  if (result.transaction.signatures[0] !== s.signature) {
    fail(
      `getTransaction(${s.signature}) answered ${result.transaction.signatures[0]}`,
    );
  }
  transactions[s.signature] = result;
}
const accountRequestConfig = { encoding: 'base64', commitment: 'finalized' };
const account = await call('getAccountInfo', [tree, accountRequestConfig]);
if (account.value === null) {
  fail(`${tree} does not exist on devnet`);
}
const again = await listSignatures();
if (
  JSON.stringify(again.map(s => s.signature)) !==
  JSON.stringify(signatures.map(s => s.signature))
) {
  fail(
    'a transaction landed while recording — the snapshot is not consistent; run again',
  );
}

const fixture = {
  schema: 'noctura.a0.devnet-tree-fixture/1',
  cluster: 'devnet',
  genesisHash,
  rpc: rpcRecorded,
  tree,
  fetchedAt: new Date().toISOString(),
  requests: {
    getSignaturesForAddress: { commitment: 'finalized', limit: PAGE },
    getTransaction: txRequestConfig,
    getAccountInfo: accountRequestConfig,
  },
  /** getSignaturesForAddress, every page concatenated, newest first, unedited. */
  signatures,
  /** getTransaction per signature, unedited (JSON encoding). */
  transactions,
  /** getAccountInfo, unedited ({context: {slot}, value}). */
  account,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(
  `record-devnet-tree: ${signatures.length} signatures (newest slot ${signatures[0]?.slot}), ` +
    `account at slot ${account.context.slot}, ${Object.keys(transactions).length} transactions → ${out}`,
);
