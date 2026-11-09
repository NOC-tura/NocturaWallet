/**
 * The M1a checkpoint's desk logic (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1a"):
 * the desk values, the deposit VK read out of the devnet Pool account, an independent Groth16
 * check, and the judge that turns a phone report into one PASS / FAIL per §16 line.
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Nothing here shares code with native/noctura-prover:
 *   - the desk values come from the seed through micro-key-producer/bls.js (EIP-2333),
 *     poseidon-lite via the app's own src/modules/shielded/a0/fieldEquations.ts, and
 *     @noble/hashes SHA-512 — the implementations the offline fixtures were written with;
 *   - the proof check is a pairing product over @noble/curves' bn254, not arkworks (which proved
 *     on the phone and self-verified there);
 *   - the VK is decoded from the account bytes by the layout of the program side's
 *     `Pool` / `DepositVk` (programs/shielded-pool/src/state.rs) and EIP-197 point encoding —
 *     a FACT taken from them; the VALUES are the chain's, compared with the pinned vk.json.
 *
 * Pure functions only (no network, no adb): m1a-checkpoint.mjs does the I/O. Tested by
 * lib.test.mjs (`node --test scripts/m1a-checkpoint/*.test.mjs`). Node 24 (fieldEquations.ts is
 * TypeScript; Node ≥ 22.6 needs --experimental-strip-types).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bn254 } from '@noble/curves/bn254.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { base58 } from '@scure/base';
import { deriveSeedTree } from 'micro-key-producer/bls.js';
import { poseidon2, poseidon3 } from 'poseidon-lite';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = join(ROOT, 'native/noctura-prover/tests/fixtures');
const EQ = await import(
  join(ROOT, 'src/modules/shielded/a0/fieldEquations.ts')
);
const R = EQ.FIELD_MODULUS;
/** The BN254 base field (G1 / G2 coordinates). */
export const P =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

/** spec §1 — the deployed devnet A0 pool (facts). */
export const DEVNET = {
  genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
  pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
  mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
  merkleTree: '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc',
};
/** The checkpoint's deposit (spec §16): the repo test seed, depositIndex 0, 10^9 base units. */
export const CHECKPOINT = {
  mnemonic:
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  spendPath: 'm/12381/371/1/0',
  depositIndex: 0n,
  amount: 1000000000n,
};
const D_SELF_DOMAIN = 'noctura/a0/self-d/v1';
const DEPOSIT_RHO_DOMAIN = 'noctura/a0/deposit-rho/v1';

const hex = b => Buffer.from(b).toString('hex');
const os2ip = b => (b.length === 0 ? 0n : BigInt('0x' + hex(b)));
const be32 = v => {
  if (v < 0n || v >= R) {
    throw new Error('value outside the scalar field');
  }
  return v.toString(16).padStart(64, '0');
};
const fieldBytes = v => Uint8Array.from(Buffer.from(be32(v), 'hex'));
const u64be = i => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, i, false);
  return b;
};
const concat = (...parts) => Uint8Array.from(parts.flatMap(p => [...p]));
const text = s => new TextEncoder().encode(s);

export const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
export const fixture = name => readJson(join(FIXTURES, name));

/**
 * The desk values of the checkpoint's deposit, computed from the mnemonic (spec §3 equations).
 * Returns hex strings (32-byte BE) plus the seed hex, so the caller can check the phone was fed
 * the same seed the desk derived from.
 */
export function deskValues() {
  const seed = mnemonicToSeedSync(CHECKPOINT.mnemonic, '');
  const sk = deriveSeedTree(seed, CHECKPOINT.spendPath);
  const nk = poseidon3([
    EQ.TAG.NK,
    os2ip(sk.slice(0, 16)),
    os2ip(sk.slice(16, 32)),
  ]);
  sk.fill(0);
  const dSelf = os2ip(sha512(concat(text(D_SELF_DOMAIN), fieldBytes(nk)))) % R;
  const addrSelf = EQ.addrField(nk, dSelf);
  const rho =
    os2ip(
      sha512(
        concat(
          text(DEPOSIT_RHO_DOMAIN),
          fieldBytes(nk),
          u64be(CHECKPOINT.depositIndex),
        ),
      ),
    ) % R;
  const mintHash = os2ip(base58.decode(DEVNET.mint)) % R;
  const commitment = EQ.commitment({
    addrField: addrSelf,
    amount: CHECKPOINT.amount,
    mintHash,
    rho,
  });
  // ivk is not part of the checkpoint; computing it only checks the Poseidon2 path is wired.
  poseidon2([EQ.TAG.IVK, nk]);
  return {
    seedHex: hex(seed),
    depositIndex: CHECKPOINT.depositIndex.toString(),
    amount: CHECKPOINT.amount.toString(),
    rho: be32(rho),
    commitment: be32(commitment),
    mintHash: be32(mintHash),
    // deposit public inputs, in the circuit's order (spec §1): commitment, amount, mintHash, rho
    publicInputs: [
      be32(commitment),
      be32(CHECKPOINT.amount),
      be32(mintHash),
      be32(rho),
    ],
  };
}

/**
 * Why an RPC URL is refused, or null. The checkpoint reads devnet only: https, never a
 * noc-tura.io or solscan.io host, never a host naming mainnet. (The genesis hash is checked on
 * the answer as well — a URL can lie, the genesis cannot.)
 */
export function rpcRefusal(url) {
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
    return `refusing ${h}: the checkpoint reads devnet only, never noc-tura.io, solscan.io or mainnet`;
  }
  return null;
}

// ---------------------------------------------------------------- the VK, chain and pinned

/** Anchor account discriminator: sha256("account:<Name>")[0..8]. */
export const accountDiscriminator = name =>
  hex(sha256(text(`account:${name}`)).slice(0, 8));

/**
 * The program side's `Pool` (zero_copy, repr(C), all fields align 1 except u64 at 8):
 * 8 discriminator | authority 32 | mint 32 | vault 32 | merkle_tree 32 | bump 1 | pad 7 |
 * deposit_vk 768 (alpha 64, beta 128, gamma 128, delta 128, ic 5 × 64) | max_fee u64 LE |
 * deposits_paused u8 | pad 7  = 928 bytes.
 */
export const POOL_LAYOUT = {
  size: 928,
  mint: 40,
  merkleTree: 104,
  depositVk: 144,
  depositVkLen: 768,
  maxFee: 912,
  paused: 920,
};

/** Checks the account is the pinned devnet pool and returns its deposit VK blob and fields. */
export function decodePoolAccount({ owner, data }) {
  const errs = [];
  if (owner !== DEVNET.programId) {
    errs.push(`owner ${owner} is not the A0 program`);
  }
  if (data.length !== POOL_LAYOUT.size) {
    errs.push(`data is ${data.length} bytes, a Pool is ${POOL_LAYOUT.size}`);
  }
  if (errs.length) {
    return { errs };
  }
  if (hex(data.subarray(0, 8)) !== accountDiscriminator('Pool')) {
    errs.push('the discriminator is not account:Pool');
  }
  const key = o => base58.encode(data.subarray(o, o + 32));
  if (key(POOL_LAYOUT.mint) !== DEVNET.mint) {
    errs.push(`mint ${key(POOL_LAYOUT.mint)} is not the pinned mint`);
  }
  if (key(POOL_LAYOUT.merkleTree) !== DEVNET.merkleTree) {
    errs.push(
      `merkle_tree ${key(POOL_LAYOUT.merkleTree)} is not the pinned tree`,
    );
  }
  const blob = data.subarray(
    POOL_LAYOUT.depositVk,
    POOL_LAYOUT.depositVk + POOL_LAYOUT.depositVkLen,
  );
  return {
    errs,
    blob,
    maxFee: data.readBigUInt64LE(POOL_LAYOUT.maxFee).toString(),
    depositsPaused: data[POOL_LAYOUT.paused],
  };
}

const int = b => BigInt('0x' + hex(b));
/** G1, 64 bytes: x BE, y BE. */
const g1 = b => [int(b.subarray(0, 32)), int(b.subarray(32, 64))];
/** G2, 128 bytes, EIP-197: x.c1, x.c0, y.c1, y.c0 — returned as [[x.c0, x.c1], [y.c0, y.c1]]. */
const g2 = b => [
  [int(b.subarray(32, 64)), int(b.subarray(0, 32))],
  [int(b.subarray(96, 128)), int(b.subarray(64, 96))],
];

/** A VK blob as the program stores it (alpha, beta, gamma, delta, ic[]) → coordinates. */
export function vkFromBlob(blob) {
  if ((blob.length - 448) % 64 !== 0 || blob.length < 448 + 128) {
    throw new Error(`a VK blob of ${blob.length} bytes is malformed`);
  }
  const ic = [];
  for (let o = 448; o < blob.length; o += 64) {
    ic.push(g1(blob.subarray(o, o + 64)));
  }
  return {
    alpha: g1(blob.subarray(0, 64)),
    beta: g2(blob.subarray(64, 192)),
    gamma: g2(blob.subarray(192, 320)),
    delta: g2(blob.subarray(320, 448)),
    ic,
  };
}

/** A snarkjs verifying key (vk.json; G2 is [c0, c1]) → the same coordinates. */
export function vkFromSnarkjs(vk) {
  if (vk.protocol !== 'groth16' || vk.curve !== 'bn128') {
    throw new Error('not a groth16 / bn128 verifying key');
  }
  const p1 = p => {
    if (p[2] !== '1') {
      throw new Error('a G1 point is not affine');
    }
    return [BigInt(p[0]), BigInt(p[1])];
  };
  const p2 = p => {
    if (p[2][0] !== '1' || p[2][1] !== '0') {
      throw new Error('a G2 point is not affine');
    }
    return [
      [BigInt(p[0][0]), BigInt(p[0][1])],
      [BigInt(p[1][0]), BigInt(p[1][1])],
    ];
  };
  if (vk.IC.length !== vk.nPublic + 1) {
    throw new Error('IC length is not nPublic + 1');
  }
  return {
    alpha: p1(vk.vk_alpha_1),
    beta: p2(vk.vk_beta_2),
    gamma: p2(vk.vk_gamma_2),
    delta: p2(vk.vk_delta_2),
    ic: vk.IC.map(p1),
  };
}

/** The coordinates that differ between two VKs (empty = the same key). */
export function vkDiff(a, b) {
  const out = [];
  const walk = (x, y, path) => {
    if (Array.isArray(x) || Array.isArray(y)) {
      if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) {
        out.push(`${path}: shape differs`);
        return;
      }
      x.forEach((v, i) => walk(v, y[i], `${path}[${i}]`));
    } else if (x !== y) {
      out.push(path);
    }
  };
  for (const k of ['alpha', 'beta', 'gamma', 'delta', 'ic']) {
    walk(a[k], b[k], k);
  }
  return out;
}

// ---------------------------------------------------------------- Groth16, independently

const { Fp2, Fp12 } = bn254.fields;
const G1 = bn254.G1.Point;
const G2 = bn254.G2.Point;
const toG1 = ([x, y]) => {
  const p = G1.fromAffine({ x, y });
  p.assertValidity();
  return p;
};
const toG2 = ([[x0, x1], [y0, y1]]) => {
  const p = G2.fromAffine({
    x: Fp2.create({ c0: x0, c1: x1 }),
    y: Fp2.create({ c0: y0, c1: y1 }),
  });
  p.assertValidity();
  return p;
};

/**
 * Verifies a proof in the on-chain 256-byte layout — A with y NEGATED (64) | B, EIP-197 (128) |
 * C (64) — against `vk` (coordinates), for `publicInputs` (32-byte BE hex, each < r):
 *   e(−A, B) · e(α, β) · e(vk_x, γ) · e(C, δ) = 1,   vk_x = IC₀ + Σ xᵢ·ICᵢ₊₁.
 * Returns {ok, reason}. Never throws on bad input.
 */
export function verifyGroth16(vk, proofHex, publicInputs) {
  try {
    if (!/^[0-9a-f]{512}$/.test(proofHex)) {
      return { ok: false, reason: 'proof is not 256 bytes of lowercase hex' };
    }
    if (publicInputs.length + 1 !== vk.ic.length) {
      return {
        ok: false,
        reason: `${publicInputs.length} public inputs for a VK with ${vk.ic.length - 1}`,
      };
    }
    const xs = publicInputs.map(h => {
      if (!/^[0-9a-f]{64}$/.test(h)) {
        throw new Error('a public input is not 32-byte hex');
      }
      const v = BigInt('0x' + h);
      if (v >= R) {
        throw new Error('a public input is not < r');
      }
      return v;
    });
    const b = Buffer.from(proofHex, 'hex');
    for (const [o, n] of [
      [0, 2],
      [64, 4],
      [192, 2],
    ]) {
      for (let i = 0; i < n; i++) {
        if (int(b.subarray(o + 32 * i, o + 32 * (i + 1))) >= P) {
          throw new Error('a proof coordinate is not < p');
        }
      }
    }
    const negA = toG1(g1(b.subarray(0, 64)));
    const B = toG2(g2(b.subarray(64, 192)));
    const C = toG1(g1(b.subarray(192, 256)));
    let vkx = toG1(vk.ic[0]);
    xs.forEach((x, i) => {
      if (x !== 0n) {
        vkx = vkx.add(toG1(vk.ic[i + 1]).multiply(x));
      }
    });
    const prod = bn254.pairingBatch([
      { g1: negA, g2: B },
      { g1: toG1(vk.alpha), g2: toG2(vk.beta) },
      { g1: vkx, g2: toG2(vk.gamma) },
      { g1: C, g2: toG2(vk.delta) },
    ]);
    return Fp12.eql(prod, Fp12.ONE)
      ? { ok: true }
      : { ok: false, reason: 'the pairing check fails' };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ---------------------------------------------------------------- the phone's report

/** The report from `am instrument -r` output (status key m1a-report) or logcat chunks. */
export function reportFromInstrumentOutput(out) {
  const m = out.match(/^INSTRUMENTATION_STATUS: m1a-report=(\{.*\})\s*$/m);
  if (m) {
    return JSON.parse(m[1]);
  }
  return reportFromLogcat(out);
}

/** Reassembles `M1A-REPORT i/n <part>` lines (logcat truncates a line near 4 KB). */
export function reportFromLogcat(out) {
  const parts = new Map();
  let total = 0;
  for (const m of out.matchAll(/M1A-REPORT (\d+)\/(\d+) (.*)$/gm)) {
    parts.set(Number(m[1]), m[3]);
    total = Number(m[2]);
  }
  if (total === 0 || parts.size !== total) {
    return null;
  }
  return JSON.parse(
    [...Array(total).keys()].map(i => parts.get(i + 1)).join(''),
  );
}

/**
 * One PASS / FAIL per §16 line (and the controls), from the phone's report, the desk values,
 * the chain's deposit VK (null if not read), the pinned VKs and the fixture's withdraw_change
 * scenario. `rehearsal` = a host report: the phone-only lines cannot pass, and say why.
 */
export function judge({
  report,
  desk,
  chainVk,
  chainVkSource,
  pinned,
  withdrawScenario,
  rehearsal = false,
  launches = [],
}) {
  const lines = [];
  const add = (id, text, pass, detail = '') =>
    lines.push({ id, text, pass, detail });
  const ok = k => report?.[k] && Object.hasOwn(report[k], 'ok');
  const val = k => (ok(k) ? report[k].ok : undefined);
  const code = k => report?.[k]?.error;
  const plat = report?.platform ?? {};

  const onPhone =
    plat.where === 'phone' &&
    plat.javaVmName === 'Dalvik' &&
    plat.osArch === 'aarch64';
  add(
    'S16.0',
    'the report comes from the phone (ART, aarch64), not a rehearsal',
    onPhone,
    `where=${plat.where} vm=${plat.javaVmName} arch=${plat.osArch} model=${plat.model ?? '-'} abis=${(plat.supportedAbis ?? []).join(',')}`,
  );
  add(
    'S16.1',
    'isSupported() is true on the phone',
    onPhone && report.isSupported === true,
    rehearsal && !onPhone
      ? 'a rehearsal cannot call the React module on ART'
      : `isSupported=${report?.isSupported}`,
  );
  add(
    'S16.2',
    "keysOpen with the repo's test seed returns a handle (and Kotlin's seed copy is zero-filled)",
    typeof val('keysOpen') === 'string' &&
      /^[1-9][0-9]*$/.test(val('keysOpen')) &&
      report.seedCopyZeroFilled === true &&
      /abandon/.test(report.seedLabel ?? ''),
    `seed=${report?.seedLabel}`,
  );
  add(
    'S16.3',
    'depositRho(0) equals the desk value',
    val('depositRho') === desk.rho,
    `phone=${val('depositRho') ?? code('depositRho')} desk=${desk.rho}`,
  );
  add(
    'S16.4',
    'commitment(10^9, rho(0)) equals the desk value',
    val('commitment') === desk.commitment &&
      report.commitment.amount === desk.amount,
    `phone=${val('commitment') ?? code('commitment')} desk=${desk.commitment}`,
  );
  const dp = report?.depositProof ?? {};
  const pubs = dp.publicInputs ?? [];
  add(
    'S16.5',
    "the deposit proof's public inputs equal the desk values (commitment, amount, mintHash, rho)",
    dp.ok === true &&
      pubs.length === 4 &&
      pubs.every((p, i) => p === desk.publicInputs[i]) &&
      report.depositWitness?.amount === desk.amount &&
      report.depositWitness?.depositIndex === desk.depositIndex,
    dp.ok
      ? pubs
          .map((p, i) => `[${i}] ${p === desk.publicInputs[i] ? '=' : '≠'}`)
          .join(' ')
      : `error=${dp.error}`,
  );
  const vkMatch = chainVk ? vkDiff(chainVk, pinned.deposit) : null;
  add(
    'S16.6',
    'the deposit VK read from chain equals the pinned deposit_vk.json',
    !!chainVk && vkMatch.length === 0,
    chainVk
      ? vkMatch.length
        ? `differs at ${vkMatch.join(', ')}`
        : chainVkSource
      : 'the VK was not read from chain',
  );
  const v =
    chainVk && dp.ok
      ? verifyGroth16(chainVk, dp.proofBytes, pubs)
      : { ok: false, reason: chainVk ? 'no deposit proof' : 'no chain VK' };
  add(
    'S16.7',
    'the deposit proof verifies against the deposit VK read from chain',
    v.ok,
    v.ok ? `${dp.ms} ms on ${dp.thread}` : v.reason,
  );
  add(
    'S16.8',
    'a withdraw_change prove without an authId refuses (E_A0_AUTH_ABSENT)',
    code('withdrawWithoutAuthId') === 'E_A0_AUTH_ABSENT' &&
      report.withdrawWithoutAuthId.withAuthId === false,
    `code=${code('withdrawWithoutAuthId') ?? 'none — it PROVED'}`,
  );
  // Controls of S16.8: the same call, approved, proves (the refusal was the missing approval);
  // the approval is single-use; the handle dies with keysClose.
  const wp = report?.withdrawWithAuthId ?? {};
  const wv = wp.ok
    ? verifyGroth16(pinned.withdrawChange, wp.proofBytes, wp.publicInputs ?? [])
    : { ok: false, reason: `error=${wp.error}` };
  const wpubs = wp.publicInputs ?? [];
  add(
    'C8.a',
    'control: the same withdraw_change call, approved, proves — public inputs = the offline scenario, verifies (pinned withdraw_change_vk.json)',
    wv.ok &&
      wpubs.length === withdrawScenario.publicInputs.length &&
      wpubs.every((p, i) => p === withdrawScenario.publicInputs[i]),
    wv.ok ? `${wp.ms} ms` : wv.reason,
  );
  add(
    'C8.b',
    'control: the used authId is refused the second time',
    code('withdrawReusedAuthId') === 'E_A0_AUTH_ABSENT',
    `code=${code('withdrawReusedAuthId')}`,
  );
  add(
    'C8.c',
    'control: keysClose ends the handle',
    code('depositRhoAfterClose') === 'E_A0_UNKNOWN_HANDLE',
    `code=${code('depositRhoAfterClose')}`,
  );
  for (const l of launches) {
    add(l.id, l.text, l.pass, l.detail);
  }
  if (!rehearsal && !launches.some(l => l.id === 'S16.9')) {
    add(
      'S16.9',
      'the production APK of the same commit launches on the phone',
      false,
      'not run (use the `phone` command)',
    );
  }
  return lines;
}

/** The lines a rehearsal is expected to fail: only those that need the phone. */
export const PHONE_ONLY = new Set(['S16.0', 'S16.1', 'S16.9', 'S16.10']);
