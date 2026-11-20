/**
 * The relayer client's bytes against what LANDED (spec §14 JS: "instruction data and account metas
 * byte for byte against relayer-a0-golden-vectors.json (M1c)"; the brief's Task 3 row; R1′).
 *
 * Sources, none of them the code under test:
 *   - fixtures/relayer-a0-golden-vectors.json — the program side's golden vectors, a byte copy of
 *     their docs/zk-contract/relayer-a0-golden-vectors.json, unchanged since 5fa2379 (sha256 pinned
 *     below; `relayerLandedP1P2`: the payload the relayer took, `expectedIxDataHex` and
 *     `accountMetas` of the FeGSS… instruction it landed, the grant's `dataHex`);
 *   - fixtures/landed-withdraw-{5F8Ks5qa,5sKiWZTv}.json — two relayed withdraw_with_change that
 *     landed AFTER the 2026-11-17 upgrade (slot 523346473), recorded once by
 *     scripts/a0-fixtures/fetch-devnet-tx.mjs; each signature is verified over its message here;
 *   - the program side's public inputs (golden `publicInputs`), the IDL's discriminator and the
 *     facts of the ICO state file, as literals.
 * Every PDA / ATA expected value is derived here with the REAL @solana/web3.js.
 */
import {createHash} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';
import {ed25519} from '@noble/curves/ed25519.js';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
import {PublicKey, VersionedTransaction} from '@solana/web3.js';

import {A0, A0_RELAYER} from '../constants';
import {
  a0AtaOf,
  a0NullifierRecordPda,
  buildA0WithdrawChangeIx,
  buildA0WithdrawChangePayload,
  parseA0RelayerQuote,
} from '../relayerClient';
import type {A0RelayerQuote, A0UnshieldTerms, A0WithdrawChangePayload} from '../relayerClient';
import type {A0Proof} from '../../../zkProver/nativeProverBridge';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name));

interface GoldenMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}
interface GoldenWithdraw {
  landedSignature: string;
  programOrder: string[];
  sizeBytes: number;
  gasGrant?: {from: string; to: string; lamports: string; dataHex: string};
  payload: A0WithdrawChangePayload;
  expectedIxDataHex: string;
  accountMetas: GoldenMeta[];
}
const GOLDEN_RAW = fx('relayer-a0-golden-vectors.json');
const GOLDEN = JSON.parse(GOLDEN_RAW.toString('utf8')) as {
  relayerLanded: {feePayer: string; vectors: {withdraw_change: GoldenWithdraw}};
  relayerLandedP1P2: {
    feePayer: string;
    gasGrantLamports: string;
    vectors: {withdraw_change: GoldenWithdraw; withdraw_change_existing: GoldenWithdraw};
  };
};
const P1P2 = GOLDEN.relayerLandedP1P2;

/** The live quote (ICO state file "P1 + P2 LIVE": minFee 10000/10000, grant 3000000, 60 s; maxFee 100,000 read from the pool). */
const QUOTE_BODY = {
  programId: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH',
  pool: '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT',
  mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs',
  feePayer: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe',
  maxFee: '100000',
  minFee: {transfer: '10000', withdraw_change: '10000'},
  gasGrantLamports: '3000000',
  validForSeconds: 60,
};
/** devnet getMinimumBalanceForRentExemption(0), measured 2026-11-17 18:48 UTC. */
const RENT_ZERO = 650_240n;
const quote: A0RelayerQuote = parseA0RelayerQuote(QUOTE_BODY, {fetchedAtMs: 0, rentExemptZeroLamports: RENT_ZERO});

/** withdraw_change's mintHash = be_mod_r(ERkp…) — the program side's public input [4] in every vector. */
const MINT_HASH = 2682398932710728289451863586583737043718296808864885766580558010318135811236n;
const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const hex64 = (d: string): string => BigInt(d).toString(16).padStart(64, '0');
const beModR = (b: Uint8Array): bigint => BigInt(`0x${Buffer.from(b).toString('hex')}`) % R;

/** The golden payload as Rust would hand it to JS: A0Proof (hex public inputs) + the unshield's terms. */
function asProof(p: A0WithdrawChangePayload): A0Proof {
  return {proofBytes: p.proofBytes, publicInputs: p.publicInputs.map(hex64)};
}
function termsOf(p: A0WithdrawChangePayload): A0UnshieldTerms {
  return {
    owner: p.destinationOwner,
    ata: p.destination,
    amount: BigInt(p.withdrawAmount),
    fee: BigInt(p.fee),
    merkleRoot: BigInt(p.publicInputs[0]!),
  };
}
const metasOf = (ix: ReturnType<typeof buildA0WithdrawChangeIx>): GoldenMeta[] =>
  ix.keys.map(k => ({pubkey: k.pubkey.toBase58(), isSigner: k.isSigner, isWritable: k.isWritable}));

describe('the fixtures', () => {
  it('the golden vectors are the program side’s relayer-a0-golden-vectors.json at 5fa2379 (unchanged at 2146368)', () => {
    expect(createHash('sha256').update(GOLDEN_RAW).digest('hex')).toBe(
      '5378f57643e9b5c545d7b2110d16233e7e1bb47d9492c176e5a94ceb27d97966',
    );
    expect(P1P2.feePayer).toBe('3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe');
    expect(P1P2.gasGrantLamports).toBe('3000000');
  });
});

describe('A0_RELAYER: the pinned fee payer, and the two values derived from it here', () => {
  it('feePayer is the relayer key the golden vectors landed with', () => {
    expect(A0_RELAYER.feePayer).toBe(P1P2.feePayer);
    expect(A0_RELAYER.feePayer).toBe(GOLDEN.relayerLanded.feePayer);
  });
  it('feeDestination = ATA(feePayer, mint), derived here, = the landed fee_destination', () => {
    const ata = PublicKey.findProgramAddressSync(
      [
        new PublicKey(A0_RELAYER.feePayer).toBuffer(),
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(),
        new PublicKey(A0.mint).toBuffer(),
      ],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
    )[0].toBase58();
    expect(A0_RELAYER.feeDestination).toBe(ata);
    expect(P1P2.vectors.withdraw_change.accountMetas[6]!.pubkey).toBe(ata);
    expect(a0AtaOf(new PublicKey(A0_RELAYER.feePayer)).toBase58()).toBe(ata);
  });
  it('wchangeVk = PDA(["wchange_vk", pool]) under FeGSS…, = the landed wchange_vk', () => {
    const pda = PublicKey.findProgramAddressSync(
      [Buffer.from('wchange_vk'), new PublicKey(A0.pool).toBuffer()],
      new PublicKey(A0.programId),
    )[0].toBase58();
    expect(A0_RELAYER.wchangeVk).toBe(pda);
    expect(P1P2.vectors.withdraw_change.accountMetas[7]!.pubkey).toBe(pda);
  });
});

describe.each([
  ['withdraw_change (fresh owner, create-ATA + grant)', 'withdraw_change'],
  ['withdraw_change_existing (existing owner, no grant)', 'withdraw_change_existing'],
] as const)('relayerLandedP1P2 %s', (_label, key) => {
  const g = P1P2.vectors[key];

  it('our payload is the golden payload BYTE FOR BYTE (JSON text, key order included)', () => {
    const ours = buildA0WithdrawChangePayload(asProof(g.payload), termsOf(g.payload), quote);
    expect(JSON.stringify(ours)).toBe(JSON.stringify(g.payload));
    expect(ours.destinationOwner).toBe(g.payload.destinationOwner); // REQUIRED since P2
    expect(ours.cuLimit).toBe(200_000);
  });

  it('each named field is its public input read big-endian; recipientField / mintHash are be_mod_r of the ATA / mint', () => {
    const p = g.payload;
    expect(BigInt(`0x${p.merkleRoot}`).toString()).toBe(p.publicInputs[0]);
    expect(BigInt(`0x${p.nullifier}`).toString()).toBe(p.publicInputs[1]);
    expect(p.withdrawAmount).toBe(p.publicInputs[2]);
    expect(beModR(new PublicKey(p.destination).toBytes()).toString()).toBe(p.publicInputs[3]);
    expect(beModR(new PublicKey(A0.mint).toBytes())).toBe(MINT_HASH);
    expect(p.publicInputs[4]).toBe(MINT_HASH.toString());
    expect(BigInt(`0x${p.changeCommitment}`).toString()).toBe(p.publicInputs[5]);
    expect(p.fee).toBe(p.publicInputs[6]);
  });

  it('the relayed instruction: data and account metas BYTE FOR BYTE the landed ones', () => {
    const ix = buildA0WithdrawChangeIx(g.payload);
    expect(ix.programId.toBase58()).toBe(A0.programId);
    expect(Buffer.from(ix.data).toString('hex')).toBe(g.expectedIxDataHex);
    expect(ix.data).toHaveLength(380);
    expect(metasOf(ix)).toEqual(g.accountMetas);
    // the one signer is the pinned relayer (R6: nothing of the wallet's signs a relayed exit)
    expect(metasOf(ix).filter(m => m.isSigner).map(m => m.pubkey)).toEqual([A0_RELAYER.feePayer]);
  });

  it('the nullifier record is PDA(["nullifier", n]) derived here', () => {
    const pda = PublicKey.findProgramAddressSync(
      [Buffer.from('nullifier'), Buffer.from(g.payload.nullifier, 'hex')],
      new PublicKey(A0.programId),
    )[0].toBase58();
    expect(a0NullifierRecordPda(g.payload.nullifier).toBase58()).toBe(pda);
    expect(g.accountMetas[4]!.pubkey).toBe(pda);
  });
});

describe('relayerLanded (pre-P2, the same relayer key): the instruction is the same encoding', () => {
  it('data and metas byte for byte', () => {
    const g = GOLDEN.relayerLanded.vectors.withdraw_change;
    const ix = buildA0WithdrawChangeIx(g.payload);
    expect(Buffer.from(ix.data).toString('hex')).toBe(g.expectedIxDataHex);
    expect(metasOf(ix)).toEqual(g.accountMetas);
  });
});

describe('the payload is refused before it exists when a public input is not ours (§6.6), each one', () => {
  const g = P1P2.vectors.withdraw_change.payload;
  const proof = asProof(g);
  const terms = termsOf(g);
  const withPi = (i: number, v: bigint): A0Proof => ({
    ...proof,
    publicInputs: proof.publicInputs.map((h, j) => (j === i ? v.toString(16).padStart(64, '0') : h)),
  });
  it('positive control: the golden terms pass', () => {
    expect(() => buildA0WithdrawChangePayload(proof, terms, quote)).not.toThrow();
  });
  it.each([
    ['merkleRoot (another root)', {...terms, merkleRoot: terms.merkleRoot + 1n}],
    ['withdrawAmount (another amount)', {...terms, amount: terms.amount + 1n}],
  ])('%s → E_A0_SUBMIT_PUBLIC_INPUTS', (_w, t) => {
    expect(() => buildA0WithdrawChangePayload(proof, t, quote)).toThrow(
      expect.objectContaining({code: 'E_A0_SUBMIT_PUBLIC_INPUTS'}),
    );
  });
  it.each([
    [3, 'recipientField'],
    [4, 'mintHash'],
    [6, 'fee'],
    [0, 'merkleRoot'],
    [2, 'withdrawAmount'],
  ])('public input %i (%s) altered in the proof → E_A0_SUBMIT_PUBLIC_INPUTS', (i, name) => {
    const v = BigInt(`0x${proof.publicInputs[i]}`) + 1n;
    expect(() => buildA0WithdrawChangePayload(withPi(i, v), terms, quote)).toThrow(
      expect.objectContaining({code: 'E_A0_SUBMIT_PUBLIC_INPUTS', message: expect.stringContaining(name)}),
    );
  });
  it('a fee that is not the quote’s minFee (R5) → E_A0_SUBMIT_ARGS', () => {
    expect(() => buildA0WithdrawChangePayload(withPi(6, 10001n), {...terms, fee: 10001n}, quote)).toThrow(
      expect.objectContaining({code: 'E_A0_SUBMIT_ARGS', message: expect.stringContaining('R5')}),
    );
  });
  it('a token account that is not ATA(owner, mint) → E_A0_SUBMIT_ARGS', () => {
    const other = P1P2.vectors.withdraw_change_existing.payload.destination;
    expect(() => buildA0WithdrawChangePayload(proof, {...terms, ata: other}, quote)).toThrow(
      expect.objectContaining({code: 'E_A0_SUBMIT_ARGS', message: expect.stringContaining('ATA(owner, mint)')}),
    );
  });
  it('an off-curve owner (the pool PDA) with its own ATA → E_A0_SUBMIT_ARGS', () => {
    const pool = new PublicKey(A0.pool);
    expect(PublicKey.isOnCurve(pool.toBytes())).toBe(false);
    expect(() =>
      buildA0WithdrawChangePayload(proof, {...terms, owner: A0.pool, ata: a0AtaOf(pool).toBase58()}, quote),
    ).toThrow(expect.objectContaining({code: 'E_A0_SUBMIT_ARGS', message: expect.stringContaining('curve')}));
  });
  it.each([
    ['6 public inputs', {...proof, publicInputs: proof.publicInputs.slice(0, 6)}],
    ['a public input ≥ r', {...proof, publicInputs: proof.publicInputs.map((h, j) => (j === 1 ? R.toString(16) : h))}],
    ['an uppercase public input', {...proof, publicInputs: proof.publicInputs.map((h, j) => (j === 5 ? h.toUpperCase() : h))}],
    ['a 255-byte proof', {...proof, proofBytes: proof.proofBytes.slice(2)}],
    ['an uppercase proof', {...proof, proofBytes: proof.proofBytes.toUpperCase()}],
  ])('%s → E_A0_SUBMIT_ARGS', (_w, p) => {
    expect(() => buildA0WithdrawChangePayload(p as A0Proof, terms, quote)).toThrow(
      expect.objectContaining({code: 'E_A0_SUBMIT_ARGS'}),
    );
  });
});

// ------------------------------------------------------------------ landed after the upgrade

interface TxFixture {
  genesisHash: string;
  slot: number;
  blockTime: number;
  signature: string;
  result: {meta: {err: unknown}; transaction: [string, string]};
}
const UPGRADE_SLOT = 523346473; // ICO state file, "2026-11-17 — FeGSS upgraded"
const CB = 'ComputeBudget111111111111111111111111111111';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const SYS = '11111111111111111111111111111111';

describe.each([
  ['5F8Ks5qa', '75c43033cb241d44b9306050af12a07137b7e0b722bb55b5d01c798dae7e56a6', 523346606, [CB, ATA_PROGRAM, SYS, A0.programId], 1011],
  ['5sKiWZTv', '682ac2de718761d84e8324a5bea848ea2080fe886d2455a8619ba90d7478574e', 523346628, [CB, ATA_PROGRAM, A0.programId], 994],
] as const)('landed after the upgrade: %s', (prefix, digest, slot, order, size) => {
  const raw = fx(`landed-withdraw-${prefix}.json`);
  const f = JSON.parse(raw.toString('utf8')) as TxFixture;
  const wire = Buffer.from(f.result.transaction[0], 'base64');
  const tx = VersionedTransaction.deserialize(wire);
  const keys = tx.message.staticAccountKeys.map(k => k.toBase58());
  const ixs = tx.message.compiledInstructions.map(ci => ({
    program: keys[ci.programIdIndex]!,
    data: Buffer.from(ci.data),
    accounts: ci.accountKeyIndexes,
  }));

  it('the fixture: pinned, devnet, landed after the upgrade slot, no error, signed by the relayer alone', () => {
    expect(createHash('sha256').update(raw).digest('hex')).toBe(digest);
    expect(f.genesisHash).toBe(A0.genesisHash);
    expect(f.slot).toBe(slot);
    expect(f.slot).toBeGreaterThan(UPGRADE_SLOT);
    expect(f.result.meta.err).toBeNull();
    expect(wire).toHaveLength(size);
    expect(tx.message.header.numRequiredSignatures).toBe(1);
    expect(keys[0]).toBe(A0_RELAYER.feePayer);
    const msg = tx.message.serialize();
    expect(ed25519.verify(tx.signatures[0]!, msg, new PublicKey(keys[0]!).toBytes())).toBe(true);
    expect(f.signature.startsWith(prefix)).toBe(true);
  });

  it('the program order is the P1/P2 shape', () => {
    expect(ixs.map(i => i.program)).toEqual(order);
  });

  it('our encoder, fed the landed arguments and the create-ATA owner, rebuilds the FeGSS… instruction byte for byte (data, accounts, flags)', () => {
    const w = ixs.find(i => i.program === A0.programId)!;
    const ata = ixs.find(i => i.program === ATA_PROGRAM)!;
    // an independent reader of the landed data: disc | root | nullifier | amount LE | cc | fee LE | u32 256 | proof
    const d = w.data;
    expect(d.subarray(0, 8).toString('hex')).toBe('6cf44379ecf67997');
    expect(d).toHaveLength(380);
    expect(d.readUInt32LE(120)).toBe(256);
    const le = (o: number) => d.readBigUInt64LE(o).toString();
    const payload: A0WithdrawChangePayload = {
      kind: 'withdraw_change',
      pool: A0.pool,
      mint: A0.mint,
      merkleRoot: d.subarray(8, 40).toString('hex'),
      nullifier: d.subarray(40, 72).toString('hex'),
      withdrawAmount: le(72),
      destination: keys[w.accounts[3]!]!,
      destinationOwner: keys[ata.accounts[2]!]!,
      changeCommitment: d.subarray(80, 112).toString('hex'),
      fee: le(112),
      proofBytes: d.subarray(124).toString('hex'),
      publicInputs: [],
      cuLimit: 200_000,
    };
    expect(payload.fee).toBe('10000');
    expect(a0AtaOf(new PublicKey(payload.destinationOwner)).toBase58()).toBe(payload.destination);
    const ours = buildA0WithdrawChangeIx(payload);
    expect(Buffer.from(ours.data).equals(d)).toBe(true);
    const landedMetas = w.accounts.map(i => ({
      pubkey: keys[i]!,
      isSigner: tx.message.isAccountSigner(i),
      isWritable: tx.message.isAccountWritable(i),
    }));
    expect(metasOf(ours)).toEqual(landedMetas);
  });

  it('the grant, when there is one, is the golden grant data (3,000,000 lamports) to the create-ATA owner', () => {
    const grants = ixs.filter(i => i.program === SYS);
    if (prefix === '5sKiWZTv') {
      expect(grants).toHaveLength(0);
      return;
    }
    expect(grants).toHaveLength(1);
    expect(grants[0]!.data.toString('hex')).toBe(P1P2.vectors.withdraw_change.gasGrant!.dataHex);
    const ata = ixs.find(i => i.program === ATA_PROGRAM)!;
    expect(grants[0]!.accounts.map(i => keys[i])).toEqual([A0_RELAYER.feePayer, keys[ata.accounts[2]!]]);
  });
});
