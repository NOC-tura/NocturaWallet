#!/usr/bin/env node
/**
 * One-off recorder of a landed DEVNET transaction into a committed test fixture
 * (spec 2026-11-08 shielded A0 M1 §14 JS, §16 M1b "first task (I1)"; the brief's convention:
 * devnet facts are fetched ONCE into committed fixtures with the slot and time recorded, and the
 * tests read only the fixtures — no test ever contacts a host).
 *
 * What it does, and nothing else:
 *   1. refuses any RPC that is not https, or whose host is noc-tura.io, solscan.io or names
 *      mainnet; then asks the RPC for its genesis hash and refuses anything but devnet's
 *      (a URL can lie, the genesis cannot);
 *   2. `getTransaction(<signature>, {encoding: 'base64', maxSupportedTransactionVersion: 0,
 *      commitment: 'finalized'})`, exactly once;
 *   3. refuses an answer whose wire transaction's first signature is not the one asked for;
 *   4. writes `{schema, cluster, genesisHash, rpc, request, fetchedAt, slot, blockTime, signature,
 *      result}` — `result` is the RPC's answer, unedited — and refuses to overwrite an existing
 *      fixture unless `--force` is given (a re-fetch is a new recording, reviewed as such).
 *
 * Run by hand from the repository root (network: the one devnet RPC, nothing else):
 *   node scripts/a0-fixtures/fetch-devnet-tx.mjs --signature=<base58> --out=<path.json>
 *        [--rpc=https://api.devnet.solana.com] [--force]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { base58 } from '@scure/base';

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const DEFAULT_RPC = 'https://api.devnet.solana.com';

const fail = msg => {
  console.error(`fetch-devnet-tx: ${msg}`);
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
  if (!['signature', 'out', 'rpc', 'force'].includes(k)) {
    fail(`unknown option --${k}`);
  }
}
const signature = args.signature;
const out = args.out;
const rpc = args.rpc ?? DEFAULT_RPC;
if (typeof signature !== 'string' || base58.decode(signature).length !== 64) {
  fail('--signature=<base58 of 64 bytes> is required');
}
if (typeof out !== 'string') {
  fail('--out=<path.json> is required');
}

/** Why an RPC URL is refused, or null. */
function rpcRefusal(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return `not a URL: ${url}`;
  }
  if (u.protocol !== 'https:') {
    return `the RPC must be https: ${u.origin}`;
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

const refusal = rpcRefusal(rpc);
if (refusal) {
  fail(refusal);
}
const outPath = resolve(out);
if (existsSync(outPath) && args.force !== true) {
  fail(
    `${out} exists — a fixture is recorded once; pass --force to re-record it`,
  );
}

async function call(method, params) {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) {
    fail(`${method}: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (body.error) {
    fail(`${method}: ${JSON.stringify(body.error)}`);
  }
  return body.result;
}

const genesisHash = await call('getGenesisHash', []);
if (genesisHash !== DEVNET_GENESIS) {
  fail(`genesis ${genesisHash} is not devnet's ${DEVNET_GENESIS}`);
}

const request = {
  method: 'getTransaction',
  params: [
    signature,
    {
      encoding: 'base64',
      maxSupportedTransactionVersion: 0,
      commitment: 'finalized',
    },
  ],
};
const result = await call(request.method, request.params);
if (result === null) {
  fail(`${signature} not found (finalized) on devnet`);
}
const wire = Buffer.from(result.transaction[0], 'base64');
// Wire format: shortvec signature count (1 byte for < 128), then 64-byte signatures.
if (wire[0] === 0 || wire[0] > 127) {
  fail(`unexpected signature count byte ${wire[0]}`);
}
const first = base58.encode(wire.subarray(1, 65));
if (first !== signature) {
  fail(`the answer's first signature is ${first}, not ${signature}`);
}

const fixture = {
  schema: 'noctura.a0.devnet-tx-fixture/1',
  cluster: 'devnet',
  genesisHash,
  rpc,
  request,
  fetchedAt: new Date().toISOString(),
  slot: result.slot,
  blockTime: result.blockTime,
  signature,
  result,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n');
console.log(
  `fetch-devnet-tx: ${signature} slot ${result.slot} blockTime ${result.blockTime} → ${out}`,
);
