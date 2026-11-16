#!/usr/bin/env node
/**
 * One-off recorder of a landed DEVNET transaction into a committed test fixture
 * (spec 2026-11-08 shielded A0 M1 §14 JS, §16 M1b "first task (I1)"; the brief's convention:
 * devnet facts are fetched ONCE into committed fixtures with the slot and time recorded, and the
 * tests read only the fixtures — no test ever contacts a host).
 *
 * What it does, and nothing else:
 *   1. refuses any RPC that is not https, that carries a query string or userinfo (a keyed
 *      provider URL, e.g. `?api-key=…`, would otherwise be committed into the fixture), or whose
 *      host is noc-tura.io, solscan.io or names mainnet; then asks the RPC for its genesis hash
 *      and refuses anything but devnet's (a URL can lie, the genesis cannot);
 *   2. `getTransaction(<signature>, {encoding: 'base64', maxSupportedTransactionVersion: 0,
 *      commitment: 'finalized'})`, exactly once;
 *   3. refuses an answer whose wire transaction's first signature is not the one asked for;
 *   4. writes `{schema, cluster, genesisHash, rpc, request, fetchedAt, slot, blockTime, signature,
 *      result}` — `rpc` is recorded as origin + pathname only (never a query string or userinfo,
 *      belt-and-suspenders with refusal 1 above); `result` is the RPC's answer, unedited — and
 *      refuses to overwrite an existing fixture unless `--force` is given (a re-fetch is a new
 *      recording, reviewed as such).
 *
 * No third-party import: base58 encode/decode is written out by hand below (the same method as
 * `depositIx.golden.test.ts`'s `base58()`), so this script depends on nothing beyond Node itself.
 *
 * Run by hand from the repository root (network: the one devnet RPC, nothing else):
 *   node scripts/a0-fixtures/fetch-devnet-tx.mjs --signature=<base58> --out=<path.json>
 *        [--rpc=https://api.devnet.solana.com] [--force]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const DEFAULT_RPC = 'https://api.devnet.solana.com';

// Bitcoin-alphabet base58, written out by hand: `@scure/base` is only a transitive dependency
// (hoisted, not in package.json — Fable review round 1, Important #1), and this script already
// has no other third-party import. The same alphabet and method as
// `depositIx.golden.test.ts`'s `base58()`.
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
  // A keyed provider URL (?api-key=…, or a userinfo) must never reach the committed fixture
  // (Fable review round 1, Important #2). Refused here, fail closed, before any network call —
  // not merely stripped when recording — so a keyed URL cannot even be used by accident.
  if (u.search !== '') {
    return `the RPC URL must carry no query string (a provider key would leak into the fixture): ${u.origin}${u.pathname}`;
  }
  if (u.username !== '' || u.password !== '') {
    return `the RPC URL must carry no userinfo (a provider key would leak into the fixture): ${u.origin}${u.pathname}`;
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
// The fixture records only origin + pathname — never the query string or userinfo — even though
// rpcRefusal above already refuses either; this is the recorded VALUE's own guarantee, independent
// of that check (Fable review round 1, Important #2).
const rpcRecorded = new URL(rpc).origin + new URL(rpc).pathname;
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
  rpc: rpcRecorded,
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
