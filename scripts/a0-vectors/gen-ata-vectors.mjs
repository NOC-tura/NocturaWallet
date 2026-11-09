#!/usr/bin/env node
/**
 * Offline generator of the A0 ATA / owner / amount vectors the Rust unshield parser is tested
 * against (spec 2026-11-08 shielded A0 M1 §3 "ATA derivation", §4 step 2, §14; I-6).
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Every value in the fixture is computed here by implementations
 * that share no code with `native/noctura-prover`:
 *   - program addresses and ATAs: `@solana/web3.js` `PublicKey.findProgramAddressSync` and
 *     `PublicKey.isOnCurve` (the app's own dependency) — the exact calls `@solana/spl-token`'s
 *     `getAssociatedTokenAddressSync` makes; with `--spl-token=<dir of @solana/spl-token>` every
 *     ATA is ALSO compared with spl-token's own `getAssociatedTokenAddressSync` (the package is
 *     not a dependency of this repository, so the comparison is opt-in);
 *   - the owner classification (canonical encoding, small order, torsion): `@noble/curves`
 *     ed25519 `Point`;
 *   - base58: `@scure/base`; the human amounts: BigInt division, not string slicing.
 * Before anything is written the script holds itself to the program side's published facts
 * (spec §1): the pool, tree and vault PDAs of mint ERkp…, and the relayer's fee ATA
 * 9643… = ATA(3jvhiz…, ERkp…). A mismatch stops the script.
 * Nothing here reads a Rust output, and the Rust code never writes this file.
 *
 * Run by hand from the repository root (no network):
 *   node scripts/a0-vectors/gen-ata-vectors.mjs                       write the fixture
 *   node scripts/a0-vectors/gen-ata-vectors.mjs --check               regenerate and compare
 *   node scripts/a0-vectors/gen-ata-vectors.mjs --check --spl-token=<path>/node_modules/@solana/spl-token
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublicKey } from '@solana/web3.js';
import { ed25519, ED25519_TORSION_SUBGROUP } from '@noble/curves/ed25519.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { base58 } from '@scure/base';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(
  ROOT,
  'native/noctura-prover/tests/fixtures/a0-ata-vectors.json',
);
const OUT_REL = relative(ROOT, OUT);

/** Pinned facts (spec §1; the program side's docs/zk-contract/devnet-a0-deployed-contract.json). */
const PROGRAM_ID = 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH';
const MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const POOL = '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT';
const MERKLE_TREE = '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc';
const POOL_AUTHORITY = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd';
const RELAYER_FEE_PAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
const RELAYER_FEE_ATA = '9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
/** The devnet mint's decimals, read from its mint account (spec §4 step 2, R3). */
const DECIMALS = 9;
const FEE_CEILING = 1_000_000n;
const U64_MAX = (1n << 64n) - 1n;
/** Ed25519 field prime p = 2^255 - 19. */
const P = (1n << 255n) - 19n;

const fail = msg => {
  console.error(`gen-ata-vectors: ${msg}`);
  process.exit(1);
};
const hex = bytes => Buffer.from(bytes).toString('hex');
const enc = new TextEncoder();
const pk = s => new PublicKey(s);

const findPda = (seeds, program) => {
  const [address, bump] = PublicKey.findProgramAddressSync(seeds, pk(program));
  return { address: address.toBase58(), bump };
};
const ataOf = ownerBytes =>
  findPda(
    [ownerBytes, pk(TOKEN_PROGRAM).toBytes(), pk(MINT).toBytes()],
    ATA_PROGRAM,
  );

// ---- 1. the program side's facts, recomputed here before anything is written ----
const poolPda = findPda([enc.encode('pool'), pk(MINT).toBytes()], PROGRAM_ID);
const treePda = findPda([enc.encode('merkle'), pk(POOL).toBytes()], PROGRAM_ID);
const vault = ataOf(pk(POOL).toBytes());
const relayerAta = ataOf(pk(RELAYER_FEE_PAYER).toBytes());
if (poolPda.address !== POOL) fail(`pool PDA ${poolPda.address} != ${POOL}`);
if (treePda.address !== MERKLE_TREE) {
  fail(`tree PDA ${treePda.address} != ${MERKLE_TREE}`);
}
if (relayerAta.address !== RELAYER_FEE_ATA) {
  fail(`relayer fee ATA ${relayerAta.address} != ${RELAYER_FEE_ATA}`);
}

// ---- 2. owner classification, in the precedence the parser applies ----
// offCurve: no point decompresses (ZIP-215 decoding = curve25519-dalek's `decompress`, the
// Solana runtime's on-curve test); nonCanonical: it decompresses but re-encodes differently;
// smallOrder: order divides 8; torsion: not in the prime-order subgroup; ok: a possible
// Ed25519 public key.
const classify = bytes => {
  let point;
  try {
    point = ed25519.Point.fromBytes(bytes, true);
  } catch {
    return 'offCurve';
  }
  if (hex(point.toBytes()) !== hex(bytes)) return 'nonCanonical';
  if (point.isSmallOrder()) return 'smallOrder';
  if (!point.isTorsionFree()) return 'torsion';
  return 'ok';
};
const web3OnCurve = bytes => PublicKey.isOnCurve(bytes);

const keyFromLabel = label =>
  ed25519.getPublicKey(sha512(enc.encode(label)).slice(0, 32));
const leY = y => {
  const b = new Uint8Array(32);
  let v = y;
  for (let i = 0; i < 32; i++) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
};

const owners = [];
const addOwner = (label, bytes, why) => {
  owners.push({ label, why, bytes: Uint8Array.from(bytes) });
};
addOwner(
  'relayer fee payer 3jvhiz… (its ATA is the published fee ATA 9643…)',
  pk(RELAYER_FEE_PAYER).toBytes(),
  'a program-side fact',
);
addOwner('pool authority GoBAm…', pk(POOL_AUTHORITY).toBytes(), 'a real key');
for (let i = 0; i < 3; i++) {
  addOwner(
    `test key ${i}`,
    keyFromLabel(`noctura/a0/ata-vectors/owner/${i}`),
    'Ed25519 public key of SHA-512(label)[0..32]',
  );
}
// owners whose ATA bump is not 255: the first and second candidates are on the curve
for (const want of [254, 253]) {
  for (let i = 0; ; i++) {
    const b = keyFromLabel(`noctura/a0/ata-vectors/bump/${i}`);
    if (ataOf(b).bump === want) {
      addOwner(
        `test key with ATA bump ${want}`,
        b,
        `the first i with bump ${want}`,
      );
      break;
    }
    if (i > 10000) fail(`no owner with bump ${want}`);
  }
}
addOwner(
  'the System Program 1111…1 (32 zero bytes: y = 0, a point of order 4)',
  new Uint8Array(32),
  'on curve for Solana, but no key',
);
addOwner(
  'the identity (y = 1)',
  leY(1n),
  'on curve, order 1 — and identity is torsion-free',
);
addOwner('y = p − 1 (order 2)', leY(P - 1n), 'on curve, small order');
{
  // a non-canonical y: y + p < 2^255 encodes the same point as y
  let k = 2n;
  for (; k < 19n; k++) {
    const b = leY(k + P);
    let pt;
    try {
      pt = ed25519.Point.fromBytes(b, true);
    } catch {
      continue;
    }
    if (!pt.isSmallOrder()) break;
  }
  if (k === 19n) fail('no non-canonical on-curve y found');
  addOwner(
    `non-canonical y = p + ${k}`,
    leY(k + P),
    'decompresses (Solana: on curve) but is not the canonical encoding',
  );
}
{
  const a = ed25519.Point.fromBytes(
    keyFromLabel('noctura/a0/ata-vectors/owner/0'),
  );
  const t = ed25519.Point.fromHex(ED25519_TORSION_SUBGROUP[1]);
  addOwner(
    'test key 0 + a torsion point of order 8',
    a.add(t).toBytes(),
    'on curve, canonical, not small order, not in the prime-order subgroup',
  );
}
addOwner(
  'the pool PDA 8VMe…',
  pk(POOL).toBytes(),
  'a PDA — off curve by construction',
);
addOwner(
  'the relayer fee ATA 9643…',
  pk(RELAYER_FEE_ATA).toBytes(),
  'an ATA — off curve by construction',
);
{
  let i = 0;
  for (; ; i++) {
    const b = sha512(enc.encode(`noctura/a0/ata-vectors/off/${i}`)).slice(
      0,
      32,
    );
    if (classify(b) === 'offCurve') {
      addOwner(`raw bytes off/${i}`, b, 'the first hash that is off the curve');
      break;
    }
  }
}

let spl = null;
const splArg = process.argv.find(a => a.startsWith('--spl-token='));
if (splArg) {
  const dir = resolve(splArg.slice('--spl-token='.length));
  const req = createRequire(join(dir, 'package.json'));
  spl = req(dir);
  spl.version = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8'),
  ).version;
}

const ownerRows = owners.map(o => {
  const s = base58.encode(o.bytes);
  if (hex(pk(s).toBytes()) !== hex(o.bytes))
    fail(`base58 round trip ${o.label}`);
  const verdict = classify(o.bytes);
  const onCurve = web3OnCurve(o.bytes);
  const ata = ataOf(o.bytes);
  if (spl) {
    const viaSpl = spl
      .getAssociatedTokenAddressSync(pk(MINT), pk(s), true)
      .toBase58();
    if (viaSpl !== ata.address) fail(`spl-token disagrees for ${o.label}`);
    let refused = false;
    try {
      spl.getAssociatedTokenAddressSync(pk(MINT), pk(s), false);
    } catch {
      refused = true;
    }
    if (refused !== !onCurve) {
      fail(`spl-token's owner check disagrees with isOnCurve for ${o.label}`);
    }
  }
  return {
    label: o.label,
    why: o.why,
    owner: s,
    ownerHex: hex(o.bytes),
    verdict,
    web3IsOnCurve: onCurve,
    ata: ata.address,
    ataHex: hex(pk(ata.address).toBytes()),
    bump: ata.bump,
  };
});
const okCount = ownerRows.filter(r => r.verdict === 'ok').length;
if (okCount < 5) fail(`only ${okCount} accepted owners`);
for (const v of ['offCurve', 'nonCanonical', 'smallOrder', 'torsion']) {
  if (!ownerRows.some(r => r.verdict === v)) fail(`no ${v} owner`);
}

// ---- 3. owner strings the parser must refuse before any curve check ----
const k0 = base58.encode(keyFromLabel('noctura/a0/ata-vectors/owner/0'));
const badOwnerStrings = [
  { label: 'empty', s: '', error: 'length', got: 0 },
  { label: 'a 0 (not in the alphabet)', s: '0' + k0.slice(1), error: 'base58' },
  { label: 'an O', s: 'O' + k0.slice(1), error: 'base58' },
  { label: 'an I', s: 'I' + k0.slice(1), error: 'base58' },
  { label: 'an l', s: 'l' + k0.slice(1), error: 'base58' },
  { label: 'a leading space', s: ' ' + k0, error: 'base58' },
  { label: 'a trailing newline', s: k0 + '\n', error: 'base58' },
  { label: 'a non-ASCII digit', s: k0.slice(0, -1) + '٣', error: 'base58' },
  {
    label: '31 bytes',
    s: base58.encode(new Uint8Array(31).fill(7)),
    error: 'length',
    got: 31,
  },
  {
    label: '33 bytes',
    s: base58.encode(new Uint8Array(33).fill(7)),
    error: 'length',
    got: 33,
  },
  {
    label: 'a valid key with an extra leading 1 (33 bytes)',
    s: '1' + k0,
    error: 'length',
    got: 33,
  },
  {
    label: 'a valid key with its last character dropped',
    s: k0.slice(0, -1),
    error: 'length',
    got: base58.decode(k0.slice(0, -1)).length,
  },
];
for (const b of badOwnerStrings) {
  let ok = true;
  let n = null;
  try {
    n = base58.decode(b.s).length;
  } catch {
    ok = false;
  }
  if (b.error === 'base58' && ok) fail(`@scure/base accepts "${b.label}"`);
  if (b.error === 'length' && (!ok || n !== b.got || n === 32)) {
    fail(`"${b.label}" decodes to ${n} bytes`);
  }
}

// ---- 4. amounts: decimal u64 strings and their human rendering ----
const human = units => {
  const scale = 10n ** BigInt(DECIMALS);
  const whole = units / scale;
  const frac = units % scale;
  if (frac === 0n) return whole.toString();
  let f = frac.toString().padStart(DECIMALS, '0');
  while (f.endsWith('0')) f = f.slice(0, -1);
  return `${whole}.${f}`;
};
const amountCases = [
  1n,
  9n,
  10n,
  10_000n,
  100_000n,
  999_999n,
  1_000_000n,
  6_000_000n,
  123_456_789n,
  999_999_999n,
  1_000_000_000n,
  1_000_000_001n,
  1_500_000_000n,
  10_000_000_000n,
  12_345_678_901_234_567n,
  U64_MAX,
].map(v => ({ units: v.toString(), human: human(v) }));

const fixture = {
  schema: 'noctura.a0.ata-vectors/1',
  _provenance:
    "Written by scripts/a0-vectors/gen-ata-vectors.mjs from @solana/web3.js findProgramAddressSync / isOnCurve, @noble/curves ed25519 and @scure/base, after recomputing the program side's pool, tree and relayer-fee-ATA addresses. No Rust output is read. Rerun: node scripts/a0-vectors/gen-ata-vectors.mjs [--check] [--spl-token=<dir>].",
  _verdicts:
    "ok = a possible Ed25519 public key (canonical, on curve, prime-order subgroup, not the identity); offCurve = no point decompresses (Solana's is_on_curve is false); nonCanonical = decompresses, re-encodes differently; smallOrder = order divides 8; torsion = not in the prime-order subgroup. Precedence: offCurve, nonCanonical, smallOrder, torsion. ata/bump are findProgramAddressSync([owner, TOKEN_PROGRAM, mint], ATA_PROGRAM) for EVERY row (spl-token allowOwnerOffCurve=true); the parser refuses every verdict but ok.",
  constants: {
    programId: PROGRAM_ID,
    programIdHex: hex(pk(PROGRAM_ID).toBytes()),
    mint: MINT,
    mintHex: hex(pk(MINT).toBytes()),
    pool: POOL,
    poolHex: hex(pk(POOL).toBytes()),
    tokenProgram: TOKEN_PROGRAM,
    tokenProgramHex: hex(pk(TOKEN_PROGRAM).toBytes()),
    ataProgram: ATA_PROGRAM,
    ataProgramHex: hex(pk(ATA_PROGRAM).toBytes()),
    decimals: DECIMALS,
    feeCeiling: FEE_CEILING.toString(),
  },
  programAddresses: [
    {
      label: 'pool = PDA(["pool", mint], programId)',
      seedsHex: [hex(enc.encode('pool')), hex(pk(MINT).toBytes())],
      program: PROGRAM_ID,
      address: poolPda.address,
      addressHex: hex(pk(poolPda.address).toBytes()),
      bump: poolPda.bump,
    },
    {
      label: 'merkle tree = PDA(["merkle", pool], programId)',
      seedsHex: [hex(enc.encode('merkle')), hex(pk(POOL).toBytes())],
      program: PROGRAM_ID,
      address: treePda.address,
      addressHex: hex(pk(treePda.address).toBytes()),
      bump: treePda.bump,
    },
    {
      label:
        'vault = ATA(pool, mint) — an off-curve owner, so findProgramAddress only',
      seedsHex: [
        hex(pk(POOL).toBytes()),
        hex(pk(TOKEN_PROGRAM).toBytes()),
        hex(pk(MINT).toBytes()),
      ],
      program: ATA_PROGRAM,
      address: vault.address,
      addressHex: hex(pk(vault.address).toBytes()),
      bump: vault.bump,
    },
  ],
  owners: ownerRows,
  badOwnerStrings,
  amounts: amountCases,
};

const text = JSON.stringify(fixture, null, 2) + '\n';
const summary = `${ownerRows.length} owners (${okCount} ok), ${badOwnerStrings.length} bad strings, ${amountCases.length} amounts${spl ? `; every ATA equal to @solana/spl-token ${spl.version}'s getAssociatedTokenAddressSync` : ''}`;
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== text) {
    fail(
      `${OUT_REL} differs from a fresh run — regenerate it and review the diff`,
    );
  }
  console.log(`gen-ata-vectors: ${OUT_REL} matches a fresh run (${summary})`);
} else {
  writeFileSync(OUT, text);
  console.log(`gen-ata-vectors: wrote ${OUT_REL} (${summary})`);
}
