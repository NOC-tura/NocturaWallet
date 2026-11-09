#!/usr/bin/env node
/**
 * Offline generator of the vectors the A0 `prove` tests are held to (spec 2026-11-08 shielded
 * A0 M1 §3 "prove", §14; I-6).
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Nothing here reads a Rust output, and the Rust code never writes
 * these files. Two kinds of content:
 *
 *  1. The desk scenarios (a deposit, two withdraw_change spends): the witness JS sends (the
 *     allow-listed part only) and every public input the proof must carry, in the circuit's
 *     order — computed here by the app's own A0 equations (`src/modules/shielded/a0/
 *     fieldEquations.ts`, poseidon-lite, held to the golden rows below before anything is
 *     written), the Merkle tree built here from `merkleNode` / `emptySubtreeRoots` (whose zeros
 *     are first compared with the zeros the program side READ FROM THE TREE ACCOUNT), and the
 *     destination ATA from @solana/web3.js (first held to a landed relayer exit's owner → ATA
 *     pair). The key values (nk, d_self, addrField, deposit rho) come from the Task 1 fixture
 *     `a0-key-vectors.json`, itself written offline by `gen-key-vectors.mjs` (bls.js +
 *     poseidon-lite) — re-checked here (addrField, commitment) before use.
 *
 *  2. The program side's FACTS, copied, never computed: the public-input order of each circuit
 *     (`devnet-a0-deployed-contract.json`), the two deployed verifying keys (`zk/keys/v2/
 *     *_vk.json`, copied byte for byte), and the proof bytes of two withdraw_with_change
 *     transactions that LANDED on devnet (`relayer-a0-golden-vectors.json`) — the proof is cut
 *     out of the landed instruction data, and its public inputs are rebuilt from that data,
 *     the destination account and the pinned mint, then compared with the program side's own
 *     decoding. Each source file is checked against a pinned sha256 before it is read.
 *
 * Run by hand from the repository root (Node 24, or Node >= 22.6 with --experimental-strip-types,
 * because the app's equations are TypeScript), with the program side's repository checked out:
 *   node scripts/a0-vectors/gen-prove-vectors.mjs --ico=<program side repo>          write
 *   node scripts/a0-vectors/gen-prove-vectors.mjs --ico=<program side repo> --check  compare only
 *
 * Writes:
 *   native/noctura-prover/tests/fixtures/a0-prove-vectors.json
 *   native/noctura-prover/tests/fixtures/a0-vk/deposit_vk.json          (verbatim copy)
 *   native/noctura-prover/tests/fixtures/a0-vk/withdraw_change_vk.json  (verbatim copy)
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublicKey } from '@solana/web3.js';
import { base58 } from '@scure/base';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIX = join(ROOT, 'native/noctura-prover/tests/fixtures');
const OUT = join(FIX, 'a0-prove-vectors.json');
const VK_OUT = join(FIX, 'a0-vk');
const KEY_VECTORS = join(FIX, 'a0-key-vectors.json');
const GOLDEN = join(
  ROOT,
  'src/modules/shielded/a0/__tests__/golden-vectors.json',
);
const EQ = await import(
  join(ROOT, 'src/modules/shielded/a0/fieldEquations.ts')
);
const R = EQ.FIELD_MODULUS;

/**
 * The program side's revision the files are read AT (`git show <rev>:<path>`, never their working
 * tree), so the fixture regenerates the same whatever their checkout has moved on to — their
 * 5fa2379 (2026-11-08, after this fixture) appended the P1/P2 landed vectors to the golden file.
 */
const ICO_REV = '37ad673360882eded6b07390e286003cc116d4bd';
/** The program side's files this script reads, each pinned by sha256 at ICO_REV. */
const ICO_FILES = {
  deployed: {
    path: 'docs/zk-contract/devnet-a0-deployed-contract.json',
    sha256: '5d3f2fa35f8aa7363faf9bbdc818ff020221674d0c8edbc0c54d626e6c67be99',
  },
  relayerGolden: {
    path: 'docs/zk-contract/relayer-a0-golden-vectors.json',
    sha256: 'de12765c43ffcd4ac2266fdf1902a02d7582ef03dc0bafd9d3c35e83e8cb684f',
  },
  depositVk: {
    path: 'zk/keys/v2/deposit_vk.json',
    sha256: 'f6f8ae49b8f032be799ee025f3e48faa34df7aa3685bee54339f538e6f9f2091',
  },
  withdrawChangeVk: {
    path: 'zk/keys/v2/withdraw_change_vk.json',
    sha256: '43dafca79a0523fcffb4a9719f67b4a260cbce2047b9a00c9abff0223134e5cd',
  },
};

const MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const TOKEN_PROGRAM = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);
const ATA_PROGRAM = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);
const DEPTH = 20;
const WITHDRAW_DISC = '6cf44379ecf67997';

const fail = msg => {
  console.error(`gen-prove-vectors: ${msg}`);
  process.exit(1);
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const be32 = v => {
  if (v < 0n || v >= R) {
    fail(`value outside the BN254 scalar field: ${v}`);
  }
  return v.toString(16).padStart(64, '0');
};
const fromHex = h => BigInt('0x' + h);
const beModR = bytes => BigInt('0x' + Buffer.from(bytes).toString('hex')) % R;
const u64le = (buf, off) => buf.readBigUInt64LE(off);

const icoArg = process.argv.find(a => a.startsWith('--ico='));
if (!icoArg) {
  fail(
    'usage: gen-prove-vectors.mjs --ico=<program side repository> [--check]',
  );
}
const ICO = resolve(icoArg.slice('--ico='.length));
const icoRead = key => {
  const { path, sha256: want } = ICO_FILES[key];
  const bytes = execFileSync('git', ['-C', ICO, 'show', `${ICO_REV}:${path}`], {
    maxBuffer: 1 << 26,
  });
  const got = sha256(bytes);
  if (got !== want) {
    fail(
      `${path}: sha256 ${got}, pinned ${want} — the program side's file changed; review it`,
    );
  }
  return bytes;
};

// ---- 0. The app's equations, held to every golden row first. ---------------------------------
const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')).vectors;
const g = (name, fn) => {
  if (!Array.isArray(golden[name]) || golden[name].length === 0) {
    fail(`golden-vectors.json has no ${name} rows`);
  }
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
{
  // merkleNode's first row is one node; its second is the depth-20 fold of that row's leaf at
  // index 0 over the zeros — checked below with this script's own tree, once the zeros exist.
  const [node] = golden.merkleNode;
  if (
    EQ.merkleNode(BigInt(node.in.left), BigInt(node.in.right)).toString() !==
    node.out
  ) {
    fail(
      `fieldEquations.merkleNode disagrees with golden-vectors.json "${node.label}"`,
    );
  }
}

// ---- 1. The program side's facts. ------------------------------------------------------------
const deployed = JSON.parse(icoRead('deployed').toString('utf8'));
const relayerGolden = JSON.parse(icoRead('relayerGolden').toString('utf8'));
const vkBytes = {
  deposit: icoRead('depositVk'),
  withdraw_change: icoRead('withdrawChangeVk'),
};
if (deployed.mint !== MINT || relayerGolden.mint !== MINT) {
  fail('the program side names another mint');
}
const publicInputOrder = {
  deposit: deployed.publicInputOrder.deposit,
  withdraw_change: deployed.publicInputOrder.withdraw_change,
};
for (const [c, order] of Object.entries(publicInputOrder)) {
  const vk = JSON.parse(vkBytes[c].toString('utf8'));
  if (vk.nPublic !== order.length || vk.IC.length !== order.length + 1) {
    fail(
      `${c}: the VK's nPublic ${vk.nPublic} disagrees with the public-input order`,
    );
  }
}

// The tree's zeros, from the rule, compared with the zeros the program side read from chain.
const Z = EQ.emptySubtreeRoots(DEPTH); // Z[0..20], Z[20] = the empty root
if (deployed.zeros.length !== DEPTH) {
  fail('the deployed contract does not list 20 zeros');
}
deployed.zeros.forEach((z, i) => {
  if (z !== be32(Z[i])) {
    fail(`zeros[${i}] from the rule disagrees with the tree account`);
  }
});
if (deployed.emptyRoot !== be32(Z[DEPTH])) {
  fail('the empty root from the rule disagrees with the tree account');
}

const mintHash = beModR(base58.decode(MINT));
const ata = owner =>
  PublicKey.findProgramAddressSync(
    [
      new PublicKey(owner).toBytes(),
      TOKEN_PROGRAM.toBytes(),
      new PublicKey(MINT).toBytes(),
    ],
    ATA_PROGRAM,
  )[0].toBase58();

// web3.js's ATA, held to a landed relayer exit (destinationOwner → destination token account).
const relayed = relayerGolden.relayerLanded.vectors.withdraw_change.payload;
if (ata(relayed.destinationOwner) !== relayed.destination) {
  fail('web3.js ATA disagrees with the landed relayer exit');
}

// ---- 2. The key values (Task 1's offline fixture), re-checked. --------------------------------
const keyVectors = JSON.parse(readFileSync(KEY_VECTORS, 'utf8'));
const seed = keyVectors.seeds[0];
if (!seed.label.startsWith('repo test mnemonic')) {
  fail('a0-key-vectors.json seeds[0] is not the repo test mnemonic');
}
const nk = fromHex(seed.nk);
const dSelf = fromHex(seed.dSelf);
const addrSelf = fromHex(seed.addrSelf);
if (EQ.addrField(nk, dSelf) !== addrSelf) {
  fail('addrField(nk, dSelf) disagrees with the key fixture');
}
const note = i => {
  const n = seed.notes.find(
    x => x.depositIndex === String(i) || x.depositIndex === i,
  );
  if (!n) {
    fail(`the key fixture has no note for deposit index ${i}`);
  }
  return n;
};
const cm = (amount, rho) =>
  EQ.commitment({ addrField: addrSelf, amount, mintHash, rho });

// ---- 3. The desk scenarios. -------------------------------------------------------------------
const deposit = (() => {
  const depositIndex = 0n;
  const amount = 1_000_000_000n;
  const rho = fromHex(note(depositIndex).rho);
  const commitment = cm(amount, rho);
  const listed = note(depositIndex).commitments.find(
    c => BigInt(c.amount) === amount,
  );
  if (!listed || fromHex(listed.commitment) !== commitment) {
    fail('the deposit commitment disagrees with the key fixture');
  }
  const values = { commitment, amount, mintHash, rho };
  return {
    label:
      'deposit: the repo test seed, depositIndex 0, 1 token (10^9 base units)',
    circuit: 'deposit',
    witness: {
      amount: amount.toString(),
      depositIndex: depositIndex.toString(),
    },
    publicInputs: publicInputOrder.deposit.map(n => be32(values[n])),
  };
})();

/** A depth-20 tree over `leaves` (index → value), zeros elsewhere; path of `leafIndex`. */
const tree = (leaves, leafIndex) => {
  let level = new Map(leaves.map((v, i) => [i, v]));
  const pathElements = [];
  const pathIndices = [];
  let idx = leafIndex;
  for (let d = 0; d < DEPTH; d += 1) {
    const sib = idx ^ 1;
    pathElements.push(level.has(sib) ? level.get(sib) : Z[d]);
    pathIndices.push(idx & 1);
    const next = new Map();
    for (const k of new Set([...level.keys()].map(x => x >> 1))) {
      const l = level.has(2 * k) ? level.get(2 * k) : Z[d];
      const r = level.has(2 * k + 1) ? level.get(2 * k + 1) : Z[d];
      next.set(k, EQ.merkleNode(l, r));
    }
    level = next;
    idx >>= 1;
  }
  return { root: level.get(0), pathElements, pathIndices };
};

// The script's tree, held to the golden depth-20 fold (a leaf alone at index 0).
{
  const [node, fold] = golden.merkleNode;
  if (!fold || !fold.label.startsWith('fold_root_depth20_leaf_at_index0')) {
    fail('golden-vectors.json no longer carries the depth-20 fold row');
  }
  if (tree([BigInt(node.in.left)], 0).root.toString() !== fold.out) {
    fail('the tree disagrees with the golden depth-20 fold');
  }
}

const withdraw = ({
  label,
  depositIndex,
  leafIndex,
  others,
  owner,
  amount,
  fee,
}) => {
  const inputAmount = 1_000_000_000n;
  const rho = fromHex(note(depositIndex).rho);
  const leaf = cm(inputAmount, rho);
  const leaves = [...others];
  leaves[leafIndex] = leaf;
  const t = tree(leaves, leafIndex);
  // The path folds back to the root — the circuit's own MerkleFold, written once more here.
  let cur = leaf;
  t.pathElements.forEach((e, i) => {
    cur =
      t.pathIndices[i] === 0 ? EQ.merkleNode(cur, e) : EQ.merkleNode(e, cur);
  });
  if (cur !== t.root) {
    fail(`${label}: the path does not fold to the root`);
  }
  const nullifier = EQ.nullifier(nk, rho);
  if (be32(nullifier) !== note(depositIndex).nullifier) {
    fail(`${label}: the nullifier disagrees with the key fixture`);
  }
  const rhoChange = EQ.rhoOut(nullifier, 0);
  if (be32(rhoChange) !== note(depositIndex).rhoChange) {
    fail(`${label}: rho_change disagrees with the key fixture`);
  }
  const change = inputAmount - amount - fee;
  if (change < 0n) {
    fail(`${label}: amount + fee exceeds the input`);
  }
  const destination = ata(owner);
  const values = {
    merkleRoot: t.root,
    nullifier,
    withdrawAmount: amount,
    recipientField: beModR(base58.decode(destination)),
    mintHash,
    changeCommitment: cm(change, rhoChange),
    fee,
  };
  return {
    label,
    circuit: 'withdraw_change',
    authorization: {
      owner,
      amount: amount.toString(),
      fee: fee.toString(),
      ata: destination,
    },
    witness: {
      merkleRoot: be32(t.root),
      inputAmount: inputAmount.toString(),
      rho: be32(rho),
      pathElements: t.pathElements.map(be32),
      pathIndices: t.pathIndices,
    },
    changeAmount: change.toString(),
    publicInputs: publicInputOrder.withdraw_change.map(n => be32(values[n])),
  };
};

const scenarios = [
  deposit,
  withdraw({
    label:
      'withdraw_change: note of depositIndex 1 (10^9) at leaf 5 of 6, 400000 out + fee 10000, change 999590000',
    depositIndex: 1,
    leafIndex: 5,
    others: [1001n, 1002n, 1003n, 1004n, 1005n],
    owner: relayed.destinationOwner,
    amount: 400_000n,
    fee: 10_000n,
  }),
  withdraw({
    label:
      'withdraw_change: note of depositIndex 2 (10^9) alone at leaf 0 (path = the zeros), everything out, change 0',
    depositIndex: 2,
    leafIndex: 0,
    others: [],
    owner: relayed.destinationOwner,
    amount: 999_990_000n,
    fee: 10_000n,
  }),
];

// ---- 4. The landed withdraw_with_change proofs (m10). -----------------------------------------
const landedFrom = (label, v) => {
  const data = Buffer.from(v.expectedIxDataHex, 'hex');
  // 8 discriminator + 32 root + 32 nullifier + 8 amount + 32 change + 8 fee + 4 length + 256
  if (data.length !== 380 || data.toString('hex', 0, 8) !== WITHDRAW_DISC) {
    fail(`${label}: not a 380-byte withdraw_with_change instruction`);
  }
  let off = 8;
  const take = n => {
    const b = data.subarray(off, off + n);
    off += n;
    return b;
  };
  const merkleRoot = take(32).toString('hex');
  const nullifier = take(32).toString('hex');
  const amount = u64le(take(8), 0);
  const changeCommitment = take(32).toString('hex');
  const fee = u64le(take(8), 0);
  const len = take(4).readUInt32LE(0);
  if (len !== 256) {
    fail(`${label}: proof length ${len}`);
  }
  const proof = take(256).toString('hex');
  if (off !== data.length) {
    fail(`${label}: trailing instruction bytes`);
  }
  const destination = v.accountMetas[3].pubkey;
  if (destination !== v.payload.destination) {
    fail(`${label}: accountMetas[3] is not the payload's destination`);
  }
  if (proof !== v.payload.proofBytes) {
    fail(`${label}: the payload's proofBytes are not the landed instruction's`);
  }
  const values = {
    merkleRoot: fromHex(merkleRoot),
    nullifier: fromHex(nullifier),
    withdrawAmount: amount,
    recipientField: beModR(base58.decode(destination)),
    mintHash,
    changeCommitment: fromHex(changeCommitment),
    fee,
  };
  const publicInputs = publicInputOrder.withdraw_change.map(n =>
    be32(values[n]),
  );
  const theirs = v.payload.publicInputs.map(d => be32(BigInt(d)));
  if (JSON.stringify(publicInputs) !== JSON.stringify(theirs)) {
    fail(
      `${label}: the public inputs rebuilt from the instruction disagree with theirs`,
    );
  }
  return {
    label,
    signature: v.landedSignature,
    proofBytes: proof,
    publicInputs,
  };
};
const landed = [
  landedFrom(
    'withdraw_with_change landed directly (fee 50000)',
    relayerGolden.vectors.withdraw_change,
  ),
  landedFrom(
    'withdraw_with_change landed by the relayer (fee 10000)',
    relayerGolden.relayerLanded.vectors.withdraw_change,
  ),
];

// ---- 5. Optional: the scenarios are TRUE statements — snarkjs proves and verifies each one. ----
// `--snarkjs=<dir of the snarkjs package>` (the program side's zk/node_modules/snarkjs, 0.7.6 in
// the dry run) proves every scenario with the program side's own key files (zk/keys/v2/, the
// files the Rust pins name) from the FULL witness assembled here, and checks the proof verifies
// against the deployed VK with exactly the scenario's public inputs. No Rust is involved.
const snarkArg = process.argv.find(a => a.startsWith('--snarkjs='));
if (snarkArg) {
  const { createRequire } = await import('node:module');
  const snarkjs = createRequire(import.meta.url)(
    resolve(snarkArg.slice('--snarkjs='.length)),
  );
  for (const sc of scenarios) {
    const pub = Object.fromEntries(
      publicInputOrder[sc.circuit].map((n, i) => [
        n,
        fromHex(sc.publicInputs[i]).toString(),
      ]),
    );
    const input =
      sc.circuit === 'deposit'
        ? { ...pub, nk: nk.toString(), d: dSelf.toString() }
        : {
            ...pub,
            nk: nk.toString(),
            d: dSelf.toString(),
            change_d: dSelf.toString(),
            inputAmount: sc.witness.inputAmount,
            rho: fromHex(sc.witness.rho).toString(),
            pathElements: sc.witness.pathElements.map(h =>
              fromHex(h).toString(),
            ),
            pathIndices: sc.witness.pathIndices.map(String),
          };
    const keys = join(ICO, 'zk/keys/v2');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      join(keys, `${sc.circuit}.wasm`),
      join(keys, `${sc.circuit}_final.zkey`),
    );
    const vk = JSON.parse(vkBytes[sc.circuit].toString('utf8'));
    const ok = await snarkjs.groth16.verify(vk, publicSignals, proof);
    const same = publicSignals.every(
      (v, i) => be32(BigInt(v)) === sc.publicInputs[i],
    );
    if (!ok || !same) {
      fail(`snarkjs: ${sc.label}: verified ${ok}, public inputs equal ${same}`);
    }
    console.log(`snarkjs proved and verified: ${sc.label}`);
  }
}

// ---- 6. Write (or compare). -------------------------------------------------------------------
const fixture = {
  schema: 'noctura.a0.prove-vectors/1',
  _provenance:
    'Written by scripts/a0-vectors/gen-prove-vectors.mjs. Scenarios: the app equations ' +
    '(fieldEquations.ts / poseidon-lite), @solana/web3.js ATAs and the Task 1 key fixture; ' +
    'publicInputOrder, the VKs and the landed proofs: the program side files named in `sources`, ' +
    'read at `sourcesRevision`, sha256-pinned. Never written from Rust. ' +
    'Rerun: node scripts/a0-vectors/gen-prove-vectors.mjs --ico=<program side repo> [--check].',
  _byteOrder:
    'Field values are 32-byte BIG-ENDIAN hex, canonical (< r). proofBytes is the 256-byte on-chain layout.',
  sourcesRevision: ICO_REV,
  sources: Object.fromEntries(
    Object.entries(ICO_FILES).map(([k, v]) => [k, v]),
  ),
  publicInputOrder,
  vkSha256: {
    deposit: ICO_FILES.depositVk.sha256,
    withdraw_change: ICO_FILES.withdrawChangeVk.sha256,
  },
  zeros: Z.slice(0, DEPTH).map(be32),
  scenarios,
  landed,
};
const text = `${JSON.stringify(fixture, null, 2)}\n`;
const outputs = [
  [OUT, Buffer.from(text)],
  [join(VK_OUT, 'deposit_vk.json'), vkBytes.deposit],
  [join(VK_OUT, 'withdraw_change_vk.json'), vkBytes.withdraw_change],
];
if (process.argv.includes('--check')) {
  for (const [path, bytes] of outputs) {
    let cur;
    try {
      cur = readFileSync(path);
    } catch {
      fail(`${relative(ROOT, path)} is missing`);
    }
    if (!cur.equals(bytes)) {
      fail(`${relative(ROOT, path)} differs from a fresh generation`);
    }
  }
  console.log('gen-prove-vectors: every output matches a fresh generation');
} else {
  mkdirSync(VK_OUT, { recursive: true });
  for (const [path, bytes] of outputs) {
    writeFileSync(path, bytes);
    console.log(
      `wrote ${relative(ROOT, path)} (${bytes.length} bytes, sha256 ${sha256(bytes)})`,
    );
  }
}
// snarkjs leaves its curve workers running; end explicitly (also when it was not loaded).
process.exit(0);
