#!/usr/bin/env node
/**
 * The M1d checkpoint, desk side (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1d").
 * README.md next to this file is the owner's checklist; the owner drives the app by hand, the M1c
 * desk installs and collects the readouts, this script judges the chain:
 *
 *   verify --fresh ADDR --send SIG --external ADDR [--unshield SIG] [--readouts FILE] [--rpc URL] [--out DIR]
 *       reads the fresh account's and its TEST token account's signature lists and the two
 *       transactions from DEVNET (genesis-checked), judges M1d.D0–D6 (lib.mjs), prints PASS / FAIL per
 *       line, writes OUT/verify.json; exit 0 only if every line passed. The seed's keys come from the
 *       last `startup-accounts` readout in FILE (default OUT/readouts.jsonl); the unshield signature
 *       from its one spent `unshield-outcome` to ADDR, unless --unshield names it.
 *   common: --out DIR (default build/m1d-checkpoint)
 *
 * Never signs or sends anything; never holds a seed; never contacts *.noc-tura.io, solscan.io or
 * mainnet — devnet only, every answer after the genesis check.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ataOf } from '../m1c-checkpoint/chain.mjs';
import { DEVNET } from '../m1c-checkpoint/lib.mjs';
import * as L from './lib.mjs';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '../..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const OUT = resolve(opt('out', join(ROOT, 'build/m1d-checkpoint')));
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const die = msg => {
  console.error(`STOP: ${msg}`);
  process.exit(3);
};
const sleep = s => spawnSync('sleep', [String(s)]);

function rpcRefusal(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return `not a URL: ${url}`;
  }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:') {
    return `the RPC must be https: ${u.origin}`;
  }
  if (h === 'noc-tura.io' || h.endsWith('.noc-tura.io') || h === 'solscan.io' || h.endsWith('.solscan.io') || h.includes('mainnet')) {
    return `refusing ${h}: the desk reads devnet only, never noc-tura.io, solscan.io or mainnet`;
  }
  return null;
}

/** The genesis hash first (devnet's, or STOP), then each call as its own request, up to 5 tries on a 429. */
async function devnet(url, calls) {
  const why = rpcRefusal(url);
  if (why) {
    die(why);
  }
  const one = async (method, params) => {
    for (let attempt = 1; ; attempt++) {
      let res;
      let body;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }),
        });
        body = res.status === 429 ? null : res.ok ? await res.json() : die(`RPC ${new URL(url).hostname} answered HTTP ${res.status} to ${method}`);
      } catch (e) {
        die(`RPC ${new URL(url).hostname}: ${method} failed (${e instanceof Error ? e.message : String(e)}) — check the network and run again`);
      }
      if (body && body.error?.code !== 429) {
        if (body.error) {
          die(`${method}: ${JSON.stringify(body.error)}`);
        }
        return body.result;
      }
      if (attempt >= 5) {
        die(`RPC ${new URL(url).hostname}: ${method} rate-limited (429) 5 times — wait a minute and run again`);
      }
      sleep(2);
    }
  };
  const genesis = await one('getGenesisHash');
  if (genesis !== DEVNET.genesisHash) {
    die(`the RPC is not devnet (genesis ${genesis})`);
  }
  const out = [];
  for (const c of calls) {
    out.push(await one(c.method, c.params));
  }
  return out;
}

async function verify() {
  const fresh = opt('fresh');
  const send = opt('send');
  const external = opt('external');
  if (!fresh || !send || !external) {
    die('usage: verify --fresh ADDR --send SIG --external ADDR [--unshield SIG] [--readouts FILE] [--rpc URL] [--out DIR]');
  }
  const file = resolve(opt('readouts', join(OUT, 'readouts.jsonl')));
  if (!existsSync(file)) {
    die(`no readouts at ${file} — collect them first (README step 3)`);
  }
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l, i) => {
    try {
      return JSON.parse(l);
    } catch {
      return die(`${file} line ${i + 1} is not JSON — collect the readouts again (README step 3)`);
    }
  });
  const seed = L.seedFromReadouts(lines);
  if (!seed) {
    die(`no startup-accounts readout with the seed's keys in ${file} — restart the devnet app, then collect (README step 3)`);
  }
  if (!seed.isLatest) {
    console.warn('WARNING: the newest startup-accounts readout carried no keys; the seed set below is from an older start — restart the devnet app and collect again for a certain D5.');
  }
  console.log(`seed set: ${seed.seedKeys.length} keys, main ${seed.main}, from the startup-accounts readout seen at ${seed.seenAt}`);
  const unshield = opt('unshield') ?? L.freshUnshieldOf(lines, fresh);
  if (!unshield) {
    die(`no single spent unshield to ${fresh} in ${file} — pass --unshield SIG (the Tx hash on that unshield's #21)`);
  }
  const url = opt('rpc', DEFAULT_RPC);
  const TX = { encoding: 'json', maxSupportedTransactionVersion: 1, commitment: 'confirmed' };
  const LIST = { limit: 1000, commitment: 'confirmed' };
  const [owner, ata, u, s] = await devnet(url, [
    { method: 'getSignaturesForAddress', params: [fresh, LIST] },
    { method: 'getSignaturesForAddress', params: [ataOf(fresh), LIST] },
    { method: 'getTransaction', params: [unshield, TX] },
    { method: 'getTransaction', params: [send, TX] },
  ]);
  const r = L.judgeM1d({ fresh, external, unshieldSig: unshield, sendSig: send, seed, history: { owner, ata }, txs: { unshield: u, send: s } });
  for (const l of r.lines) {
    console.log(`${l.pass ? 'PASS' : 'FAIL'} ${l.id} ${l.text}\n       ${l.detail}`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, 'verify.json'),
    JSON.stringify({ at: new Date().toISOString(), rpcHost: new URL(url).hostname, fresh, external, unshield, send, seed: { seedKeys: seed.seedKeys, main: seed.main, seenAt: seed.seenAt, isLatest: seed.isLatest }, ...r }, null, 2) + '\n',
  );
  console.log(r.pass ? 'M1d desk: every line PASSED' : 'M1d desk: FAILED (see the FAIL lines; README "Reading a FAIL")');
  process.exit(r.pass ? 0 : 1);
}

if (cmd === 'verify') {
  await verify();
} else {
  console.error('usage: node scripts/m1d-checkpoint/m1d-checkpoint.mjs verify --fresh ADDR --send SIG --external ADDR [--unshield SIG] [--readouts FILE] [--rpc URL] [--out DIR]');
  process.exit(2);
}
