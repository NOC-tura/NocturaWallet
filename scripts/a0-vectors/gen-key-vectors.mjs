#!/usr/bin/env node
/**
 * Offline generator of the A0 key and field vectors the Rust core is tested against
 * (spec 2026-11-08 shielded A0 M1 §3, §14; I-6).
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Every value in the fixture is computed here by
 * implementations that share no code with `native/noctura-prover`:
 *   - EIP-2333 (seed → sk at m/12381/371/1/0): `micro-key-producer/bls.js`, itself first held to
 *     the EIP's own four published test cases, copied below from the ERC text (a mismatch stops
 *     the script before anything is written);
 *   - Poseidon: `poseidon-lite`, through the app's own A0 equations
 *     (`src/modules/shielded/a0/fieldEquations.ts`, held to the circuit-validated golden vectors —
 *     re-checked below, one row of each equation, before anything is written);
 *   - SHA-512: `@noble/hashes`; BIP-39: `@scure/bip39`; base58: `@scure/base`.
 * Nothing here reads a Rust output, and the Rust code never writes this file.
 *
 * Run by hand from the repository root (Node 24, or Node ≥ 22.6 with --experimental-strip-types,
 * because the app's equations are TypeScript):
 *   node scripts/a0-vectors/gen-key-vectors.mjs           write the fixture
 *   node scripts/a0-vectors/gen-key-vectors.mjs --check   regenerate and compare, write nothing
 *
 * The seeds are public test material only (the repo's own test mnemonics and constant byte
 * strings) — never a real seed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveChild,
  deriveMaster,
  deriveSeedTree,
} from 'micro-key-producer/bls.js';
import { poseidon2, poseidon3 } from 'poseidon-lite';
import { sha512 } from '@noble/hashes/sha2.js';
import { mnemonicToSeedSync } from '@scure/bip39';
import { base58 } from '@scure/base';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(
  ROOT,
  'native/noctura-prover/tests/fixtures/a0-key-vectors.json',
);
const OUT_REL = relative(ROOT, OUT);
const GOLDEN = join(
  ROOT,
  'src/modules/shielded/a0/__tests__/golden-vectors.json',
);
const EQ = await import(
  join(ROOT, 'src/modules/shielded/a0/fieldEquations.ts')
);
const { TAG, FIELD_MODULUS: R } = EQ;

/** The shielded spend path — this script is the one place outside native that names it (I-6). */
const SPEND_PATH = 'm/12381/371/1/0';
/** The view path — a second path through the same tree, so a wrong index order cannot pass. */
const VIEW_PATH = 'm/12381/371/2/0';
/** The pinned devnet A0 pool mint (spec §1). */
const MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const D_SELF_DOMAIN = 'noctura/a0/self-d/v1';
const DEPOSIT_RHO_DOMAIN = 'noctura/a0/deposit-rho/v1';

const fail = msg => {
  console.error(`gen-key-vectors: ${msg}`);
  process.exit(1);
};
const hex = bytes => Buffer.from(bytes).toString('hex');
const be32 = v => {
  if (v < 0n || v >= R) {
    fail(`value outside the BN254 scalar field: ${v}`);
  }
  return v.toString(16).padStart(64, '0');
};
const os2ip = bytes => (bytes.length === 0 ? 0n : BigInt('0x' + hex(bytes)));
const u64be = i => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, i, false);
  return b;
};
const concat = (...parts) => Uint8Array.from(parts.flatMap(p => [...p]));
const fieldBytes = v => Uint8Array.from(Buffer.from(be32(v), 'hex'));

// ---- 1. bls.js against the EIP's own published cases (ERC text, ethereum/ERCs ERCS/erc-2333.md) ----
const EIP_SOURCE = {
  url: 'https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-2333.md',
  commit: 'be307c948f28897adb8f25afcc253c2c909de35d',
  sha256: '0c8ee48c99befe1a7dd491d2cdde1d9d70ff99ed84d940d9ca14dfe4b9016616',
};
const EIP_CASES = [
  {
    label: 'Test Case 0',
    seed: 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
    master:
      '6083874454709270928345386274498605044986640685124978867557563392430687146096',
    childIndex: 0,
    child:
      '20397789859736650942317412262472558107875392172444076792671091975210932703118',
    // From the EIP's "Test Vector with Intermediate values" section, copied, not re-derived here
    // (bls.js does not export parentSKToLamportPK); the Rust test checks its own intermediate.
    compressedLamportPK:
      'dd635d27d1d52b9a49df9e5c0c622360a4dd17cba7db4e89bce3cb048fb721a5',
  },
  {
    label: 'Test Case 1',
    seed: '3141592653589793238462643383279502884197169399375105820974944592',
    master:
      '29757020647961307431480504535336562678282505419141012933316116377660817309383',
    childIndex: 3141592653,
    child:
      '25457201688850691947727629385191704516744796114925897962676248250929345014287',
  },
  {
    label: 'Test Case 2',
    seed: '0099ff991111002299dd7744ee3355bbdd8844115566cc55663355668888cc00',
    master:
      '27580842291869792442942448775674722299803720648445448686099262467207037398656',
    childIndex: 4294967295,
    child:
      '29358610794459428860402234341874281240803786294062035874021252734817515685787',
  },
  {
    label: 'Test Case 3',
    seed: 'd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
    master:
      '19022158461524446591288038168518313374041767046816487870552872741050760015818',
    childIndex: 42,
    child:
      '31372231650479070279774297061823572166496564838472787488249775572789064611981',
  },
];
for (const c of EIP_CASES) {
  const master = deriveMaster(Buffer.from(c.seed, 'hex'));
  if (os2ip(master).toString() !== c.master) {
    fail(`bls.js deriveMaster disagrees with the EIP's ${c.label}`);
  }
  if (os2ip(deriveChild(master, c.childIndex)).toString() !== c.child) {
    fail(`bls.js deriveChild disagrees with the EIP's ${c.label}`);
  }
}
// The EIP's Test Case 0 seed is BIP-39 of the repo's test mnemonic under passphrase "TREZOR".
const ABANDON =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
if (hex(mnemonicToSeedSync(ABANDON, 'TREZOR')) !== EIP_CASES[0].seed) {
  fail(
    'BIP-39 of the test mnemonic + "TREZOR" is not the EIP Test Case 0 seed',
  );
}

// ---- 2. the app's equations against the circuit-validated golden vectors (every row) ----
const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')).vectors;
const g = (name, fn) => {
  for (const row of golden[name]) {
    if (fn(row.in).toString() !== row.out) {
      fail(
        `fieldEquations.${name} disagrees with golden-vectors.json "${row.label}"`,
      );
    }
  }
};
g('addrField', i => EQ.addrField(BigInt(i.nk), BigInt(i.d)));
g('commitment', i =>
  EQ.commitment({
    addrField: BigInt(i.addrField),
    amount: BigInt(i.amount),
    mintHash: BigInt(i.mintHash),
    rho: BigInt(i.rho),
  }),
);
g('nullifier', i => EQ.nullifier(BigInt(i.nk), BigInt(i.rho)));
g('rhoOut', i => EQ.rhoOut(BigInt(i.nullifierIn0), Number(i.index)));

// ---- 3. the wallet-only derivations (spec §3), from the frozen text ----
const mintBytes = base58.decode(MINT);
if (mintBytes.length !== 32) {
  fail('mint is not 32 bytes');
}
const mintHash = os2ip(mintBytes) % R; // be_mod_r(mint)

const SEEDS = [
  {
    label: 'repo test mnemonic (abandon … about), no passphrase',
    mnemonic: ABANDON,
    passphrase: '',
  },
  {
    label: 'repo second test mnemonic (zoo … wrong), no passphrase',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    passphrase: '',
  },
  {
    label: 'EIP-2333 Test Case 0 seed (abandon … about + "TREZOR")',
    mnemonic: ABANDON,
    passphrase: 'TREZOR',
  },
  { label: 'edge: 64 zero bytes', seedHex: '00'.repeat(64) },
  { label: 'edge: 64 0xff bytes', seedHex: 'ff'.repeat(64) },
];
const DEPOSIT_INDICES = [0n, 1n, 2n, 4294967296n, 18446744073709551615n];
const AMOUNTS = [0n, 1n, 1000000000n, 18446744073709551615n];

const seeds = SEEDS.map(s => {
  const seed = s.seedHex
    ? Uint8Array.from(Buffer.from(s.seedHex, 'hex'))
    : mnemonicToSeedSync(s.mnemonic, s.passphrase);
  const sk = deriveSeedTree(seed, SPEND_PATH);
  const skHi = os2ip(sk.slice(0, 16));
  const skLo = os2ip(sk.slice(16, 32));
  const nk = poseidon3([TAG.NK, skHi, skLo]);
  const ivk = poseidon2([TAG.IVK, nk]);
  const dSelf =
    os2ip(
      sha512(concat(new TextEncoder().encode(D_SELF_DOMAIN), fieldBytes(nk))),
    ) % R;
  const addrSelf = EQ.addrField(nk, dSelf);
  const notes = DEPOSIT_INDICES.map(i => {
    const rho =
      os2ip(
        sha512(
          concat(
            new TextEncoder().encode(DEPOSIT_RHO_DOMAIN),
            fieldBytes(nk),
            u64be(i),
          ),
        ),
      ) % R;
    const nf = EQ.nullifier(nk, rho);
    return {
      depositIndex: i.toString(),
      rho: be32(rho),
      nullifier: be32(nf),
      rhoChange: be32(EQ.rhoOut(nf, 0)),
      commitments: AMOUNTS.map(a => ({
        amount: a.toString(),
        commitment: be32(
          EQ.commitment({ addrField: addrSelf, amount: a, mintHash, rho }),
        ),
      })),
    };
  });
  return {
    label: s.label,
    ...(s.mnemonic ? { mnemonic: s.mnemonic, passphrase: s.passphrase } : {}),
    seed: hex(seed),
    sk: hex(sk),
    viewKey: hex(deriveSeedTree(seed, VIEW_PATH)),
    nk: be32(nk),
    ivk: be32(ivk),
    dSelf: be32(dSelf),
    addrSelf: be32(addrSelf),
    notes,
  };
});

const fixture = {
  schema: 'noctura.a0.key-vectors/1',
  _provenance:
    'Written by scripts/a0-vectors/gen-key-vectors.mjs from micro-key-producer/bls.js (EIP-2333, itself checked against the EIP cases below), poseidon-lite via src/modules/shielded/a0/fieldEquations.ts (checked against golden-vectors.json), @noble/hashes SHA-512, @scure/bip39 and @scure/base. No Rust output is read. Rerun: node scripts/a0-vectors/gen-key-vectors.mjs [--check].',
  _byteOrder:
    'Every field value is 32-byte BIG-ENDIAN hex, unprefixed, zero-padded, canonical (< r). sk is the 32-byte EIP-2333 I2OSP output. Amounts and indices are decimal strings.',
  equations: {
    sk: `EIP-2333 at ${SPEND_PATH} from the BIP-39 seed`,
    viewKey: `EIP-2333 at ${VIEW_PATH} from the BIP-39 seed (a path check only; not used by A0 M1)`,
    nk: 'Poseidon3(TAG_NK = 0x14, sk_hi, sk_lo); sk_hi = OS2IP(sk[0..16]), sk_lo = OS2IP(sk[16..32])',
    ivk: 'Poseidon2(TAG_IVK = 0x15, nk)',
    dSelf: `be_mod_r(SHA-512("${D_SELF_DOMAIN}" || be32(nk)))`,
    addrSelf: 'Poseidon3(TAG_ADDR = 0x12, nk, dSelf)',
    mintHash: 'be_mod_r(mint as 32 bytes)',
    rho: `be_mod_r(SHA-512("${DEPOSIT_RHO_DOMAIN}" || be32(nk) || u64be(depositIndex)))`,
    nullifier: 'Poseidon3(TAG_NULL = 0x11, nk, rho)',
    rhoChange: 'Poseidon3(TAG_RHO = 0x13, nullifier, 0)',
    commitment: 'Poseidon5(TAG_CM = 0x10, addrSelf, amount, mintHash, rho)',
  },
  constants: {
    spendPath: SPEND_PATH,
    viewPath: VIEW_PATH,
    fieldModulus: R.toString(),
    mint: MINT,
    mintBytes: hex(mintBytes),
    mintHash: be32(mintHash),
    dSelfDomain: D_SELF_DOMAIN,
    depositRhoDomain: DEPOSIT_RHO_DOMAIN,
  },
  eip2333: { source: EIP_SOURCE, cases: EIP_CASES },
  seeds,
};

const text = JSON.stringify(fixture, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== text) {
    fail(
      `${OUT_REL} differs from a fresh run — regenerate it and review the diff`,
    );
  }
  console.log(
    `gen-key-vectors: ${OUT_REL} matches a fresh run (${seeds.length} seeds, ${EIP_CASES.length} EIP cases)`,
  );
} else {
  writeFileSync(OUT, text);
  console.log(
    `gen-key-vectors: wrote ${OUT_REL} (${seeds.length} seeds, ${EIP_CASES.length} EIP cases)`,
  );
}
